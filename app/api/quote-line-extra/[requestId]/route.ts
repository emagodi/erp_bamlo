import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

type RouteParams = {
  params: Promise<{ requestId: string }>;
};

export async function PATCH(req: Request, ctx: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { approve } = await req.json().catch(() => ({}));
    if (typeof approve !== 'boolean') {
      return NextResponse.json({ error: 'Missing approval flag' }, { status: 400 });
    }

    const { requestId } = await ctx.params;

    const request = await prisma.quoteLineExtraRequest.findUnique({
      where: { id: requestId },
      include: {
        requestedBy: { select: { role: true } },
      },
    });
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request already decided' }, { status: 400 });
    }

    const role = user.role ?? '';

    const requiresAdmin = request.requiresAdmin;
    if (requiresAdmin && role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only Admin can decide Senior PM requests' },
        { status: 403 },
      );
    }
    if (!requiresAdmin && !['SENIOR_PM', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Only Senior PM or Admin can decide this request' },
        { status: 403 },
      );
    }

    const status = approve ? 'APPROVED' : 'REJECTED';
    await prisma.quoteLineExtraRequest.update({
      where: { id: request.id },
      data: {
        status,
        decidedById: user.id!,
        decidedAt: new Date(),
      },
    });

    revalidatePath(`/projects/${request.projectId}/requisitions/new`);

    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to update request' },
      { status: 500 },
    );
  }
}
