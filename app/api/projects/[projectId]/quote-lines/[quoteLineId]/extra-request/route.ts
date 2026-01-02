import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

type RouteParams = {
  params: Promise<{ projectId: string; quoteLineId: string }>;
};

async function computeRemainingCapacity(quoteLineId: string) {
  const quoteLine = await prisma.quoteLine.findUnique({
    where: { id: quoteLineId },
    select: {
      id: true,
      quantity: true,
      quote: { select: { project: { select: { id: true } } } },
    },
  });
  if (!quoteLine) throw new Error('Quote line not found');
  const projectId = quoteLine.quote?.project?.id;
  if (!projectId) throw new Error('Quote line is not attached to a project');

  const [requestedAgg, approvedAgg] = await Promise.all([
    prisma.procurementRequisitionItem.aggregate({
      where: { quoteLineId },
      _sum: { qtyRequested: true },
    }),
    prisma.quoteLineExtraRequest.aggregate({
      where: { quoteLineId, status: 'APPROVED' },
      _sum: { qty: true },
    }),
  ]);

  const ordered = Number(quoteLine.quantity ?? 0);
  const alreadyRequested = Number(requestedAgg._sum.qtyRequested ?? 0);
  const approvedExtra = Number(approvedAgg._sum.qty ?? 0);

  const remaining = Math.max(0, ordered + approvedExtra - alreadyRequested);
  return { remaining, projectId };
}

export async function POST(req: Request, ctx: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const role = user.role ?? '';
    if (!['PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized to request more' }, { status: 403 });
    }

    const { projectId, quoteLineId } = await ctx.params;
    const payload = await req.json().catch(() => ({}));
    const qty = Number(payload?.qty ?? 0);
    const reason =
      typeof payload?.reason === 'string' && payload.reason.trim().length > 0
        ? payload.reason.trim()
        : null;

    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 });
    }

    const line = await prisma.quoteLine.findUnique({
      where: { id: quoteLineId },
      select: { id: true, quote: { select: { project: { select: { id: true } } } } },
    });
    if (!line || line.quote?.project?.id !== projectId) {
      return NextResponse.json({ error: 'Quote line does not belong to project' }, { status: 400 });
    }

    const pending = await prisma.quoteLineExtraRequest.findFirst({
      where: { quoteLineId, status: 'PENDING' },
    });
    if (pending) {
      return NextResponse.json(
        { error: 'A request is already pending for this line' },
        { status: 400 },
      );
    }

    const { remaining, projectId: projectCheck } = await computeRemainingCapacity(quoteLineId);
    if (projectCheck !== projectId) {
      return NextResponse.json({ error: 'Quote line mismatch' }, { status: 400 });
    }
    if (remaining > 0) {
      return NextResponse.json(
        { error: 'Request more is only available when the line is fully requested' },
        { status: 400 },
      );
    }

    const requiresAdmin = role === 'SENIOR_PM';
    const requestRecord = await prisma.quoteLineExtraRequest.create({
      data: {
        projectId,
        quoteLineId,
        qty,
        reason,
        requiresAdmin,
        requestedById: user.id!,
      },
      include: {
        requestedBy: { select: { name: true, role: true } },
      },
    });

    revalidatePath(`/projects/${projectId}/requisitions/new`);

    return NextResponse.json({
      request: {
        id: requestRecord.id,
        qty: requestRecord.qty,
        reason: requestRecord.reason,
        status: requestRecord.status,
        requiresAdmin: requestRecord.requiresAdmin,
        requestedBy: requestRecord.requestedBy?.name ?? 'User',
        requestedRole: requestRecord.requestedBy?.role ?? '',
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to create request' },
      { status: 500 },
    );
  }
}
