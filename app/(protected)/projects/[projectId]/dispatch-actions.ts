'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getRemainingDispatchMap } from '@/lib/dispatch';

function assertRole(role?: string | null, allowed: string[]) {
  if (!role || !allowed.includes(role)) {
    throw new Error('You do not have permission for this action.');
  }
}

export async function createDispatch(
  projectId: string,
  input: {
    note?: string | null;
    items: Array<{
      requisitionItemId?: string | null;
      description: string;
      unit?: string | null;
      qty: number;
      estPriceMinor?: bigint | number | null;
    }>;
  }
) {
  const user = await getCurrentUser();
  assertRole(user?.role, ['PROJECT_MANAGER', 'ADMIN']);

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Add at least one item to dispatch.');
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      quote: true,
      requisitions: {
        where: { status: { in: ['APPROVED', 'PARTIAL'] } },
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      },
    },
  });
  if (!project) throw new Error('Project not found.');
  const requisition = project.requisitions[0] ?? null;
  const requisitionId = requisition?.id ?? null;

  if (requisitionId) {
    const remainingMap = await getRemainingDispatchMap(requisitionId);
    for (const it of input.items) {
      if (it.requisitionItemId) {
        const left = remainingMap.get(it.requisitionItemId) ?? 0;
        if (!(it.qty > 0)) throw new Error(`Qty must be > 0 for ${it.description}`);
        if (it.qty > left) {
          throw new Error(`Qty to dispatch for "${it.description}" exceeds remaining (${left}).`);
        }
      }
    }
  }

  const dispatch = await prisma.dispatch.create({
    data: {
      projectId,
      status: 'PENDING',
      note: input.note || null,
      createdById: user!.id!,
      items: {
        create: input.items.map((it) => ({
          requisitionItemId: it.requisitionItemId || null,
          description: it.description,
          unit: it.unit || null,
          qty: it.qty,
          estPriceMinor: it.estPriceMinor ? BigInt(it.estPriceMinor as any) : 0n,
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/dispatches/${dispatch.id}/receipt`);
}

export async function markDispatchSent(
  dispatchId: string,
  input: { securityById?: string | null; driverName?: string | null; vehicleReg?: string | null; securityAck?: string | null }
) {
  const user = await getCurrentUser();
  assertRole(user?.role, ['SECURITY', 'ADMIN']);

  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: {
      status: 'SENT',
      securityById: input.securityById || user!.id!,
      driverName: input.driverName || null,
      vehicleReg: input.vehicleReg || null,
      securityAck: input.securityAck || null,
      departAt: new Date(),
    },
  });

  const d = await prisma.dispatch.findUnique({ where: { id: dispatchId }, select: { projectId: true } });
  revalidatePath(`/projects/${d?.projectId}`);
  revalidatePath(`/dispatches/${dispatchId}/receipt`);
}

export async function markDispatchReceived(
  dispatchId: string,
  input: { siteAck?: string | null }
) {
  const user = await getCurrentUser();
  assertRole(user?.role, ['SECURITY', 'ADMIN', 'PROJECT_MANAGER']);

  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: {
      status: 'RECEIVED',
      siteAck: input.siteAck || null,
      receiveAt: new Date(),
    },
  });

  const d = await prisma.dispatch.findUnique({ where: { id: dispatchId }, select: { projectId: true } });
  revalidatePath(`/projects/${d?.projectId}`);
  revalidatePath(`/dispatches/${dispatchId}/receipt`);
}

