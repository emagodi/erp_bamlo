import { prisma } from '@/lib/db';

/**
 * remainingDispatchQty: purchasedQty - sum(dispatchedQty)
 * If no purchases, remaining = 0
 */
export async function getRemainingDispatchMap(requisitionId: string) {
  const purchases = await prisma.purchase.groupBy({
    by: ['requisitionItemId'],
    where: { requisitionId, requisitionItemId: { not: null } },
    _sum: { qty: true } as any,
  });

  const dispatches = await prisma.dispatchItem.groupBy({
    by: ['requisitionItemId'],
    where: {
      requisitionItemId: { not: null },
      dispatch: { project: { requisitions: { some: { id: requisitionId } } } },
    },
    _sum: { qty: true } as any,
  });

  const purchasedByItem = new Map<string, number>();
  purchases.forEach((p: any) => {
    if (p.requisitionItemId) purchasedByItem.set(p.requisitionItemId, Number(p._sum.qty ?? 0));
  });

  const dispatchedByItem = new Map<string, number>();
  dispatches.forEach((d: any) => {
    if (d.requisitionItemId) dispatchedByItem.set(d.requisitionItemId, Number(d._sum.qty ?? 0));
  });

  const remaining = new Map<string, number>();
  for (const [itemId, purchased] of purchasedByItem.entries()) {
    const already = dispatchedByItem.get(itemId) ?? 0;
    remaining.set(itemId, Math.max(0, purchased - already));
  }
  return remaining;
}

