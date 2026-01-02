// actions/dispatch-returns.ts
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Helper: compute returned quantity for a dispatch item by summing InventoryReturnItem rows.
 * Used only if you haven't added returnedQty to DispatchItem.
 */
async function computeReturnedQtyForItem(tx: any, dispatchItemId: string) {
  const agg = await tx.inventoryReturnItem.aggregate({
    where: { dispatchItemId },
    _sum: { qty: true },
  });
  return Number(agg._sum.qty ?? 0);
}

/**
 * Mark a dispatch item as handed out — decrement inventory atomically.
 * Only users in 'SECURITY' (or ADMIN) should call this.
 */
export async function markDispatchItemHandedOut(itemId: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Authentication required');

  // role check (adjust to your role names)
  if (!['SECURITY', 'ADMIN'].includes((me as any).role)) {
    throw new Error('Only Security or Admin can mark items handed out');
  }

  return prisma.$transaction(async (tx) => {
    // load dispatch item + parent dispatch
    const item = await tx.dispatchItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        qty: true,
        inventoryItemId: true,
        purchaseId: true,
        handedOutAt: true,
        dispatch: { select: { id: true, status: true, projectId: true } },
      },
    });
    if (!item) throw new Error('Dispatch item not found');

    if (!item.dispatch) throw new Error('Parent dispatch not found');

    // Only allow if dispatch is in a state that permits hand-out
    const allowedDispatchStatuses = ['APPROVED', 'SUBMITTED', 'PENDING'];
    if (!allowedDispatchStatuses.includes(item.dispatch.status)) {
      throw new Error(`Dispatch is not ready for hand-out (status=${item.dispatch.status})`);
    }

    const qtyToHand = Number(item.qty ?? 0);
    if (!(qtyToHand > 0)) throw new Error('Invalid dispatch qty');

    // resolve inventory item
    let inventoryItemId: string | null = item.inventoryItemId ?? null;
    if (!inventoryItemId && item.purchaseId) {
      // if inventory items are linked to purchases
      const inv = await tx.inventoryItem.findFirst({
        where: { purchaseId: item.purchaseId },
        select: { id: true, quantity: true },
      });
      inventoryItemId = inv?.id ?? null;
    }

    if (!inventoryItemId) {
      throw new Error('Dispatch item not linked to an inventory record; cannot hand out');
    }

    // atomically decrement inventory ensuring quantity >= qtyToHand
    const updated = await tx.inventoryItem.updateMany({
      where: { id: inventoryItemId, quantity: { gte: qtyToHand } },
      data: { quantity: { decrement: qtyToHand }, qty: { decrement: qtyToHand } },
    });

    if (updated.count === 0) {
      throw new Error('Insufficient stock to hand out the requested quantity');
    }

    // mark item as handed out
    await tx.dispatchItem.update({
      where: { id: item.id },
      data: { handedOutAt: new Date(), handedOutById: me.id },
    });

    // optional: set dispatch status to IN_TRANSIT (or your desired state)
    if (['APPROVED', 'SUBMITTED', 'PENDING'].includes(item.dispatch.status)) {
      await tx.dispatch.update({
        where: { id: item.dispatch.id },
        data: { status: 'IN_TRANSIT', departAt: new Date() },
      });
    }

    // revalidate pages
    revalidatePath(`/dispatches/${item.dispatch.id}`);
    revalidatePath(`/projects/${item.dispatch.projectId}`);
    revalidatePath('/inventory');

    return { ok: true };
  });
}

/**
 * Return some quantity from a previously handed-out dispatch item.
 * - Creates InventoryReturn + InventoryReturnItem
 * - increments inventory quantity
 * - atomic
 */
export async function returnDispatchItem(
  itemId: string,
  returnQty: number,
  note?: string | null
) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Authentication required');

  // allow PM, PROCUREMENT, SECURITY, ADMIN to create returns (adjust as you need)
  if (!['PROJECT_MANAGER', 'PROCUREMENT', 'SENIOR_PROCUREMENT', 'SECURITY', 'ADMIN'].includes((me as any).role)) {
    throw new Error('Not allowed to perform returns');
  }

  if (!(returnQty > 0)) throw new Error('Return quantity must be greater than zero');

  return prisma.$transaction(async (tx) => {
    const item = await tx.dispatchItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        qty: true,
        inventoryItemId: true,
        purchaseId: true,
        handedOutAt: true,
        dispatchId: true,
        dispatch: { select: { projectId: true } },
      },
    });
    if (!item) throw new Error('Dispatch item not found');

    if (!item.handedOutAt) throw new Error('Item has not been handed out — cannot return');

    // compute already returned (if you have returnedQty field you can use it — otherwise sum return items)
    let alreadyReturned = 0;
    // prefer field if exists
    const hasReturnedQtyField = Object.prototype.hasOwnProperty.call(item, 'returnedQty');
    if (hasReturnedQtyField) {
      // @ts-ignore
      alreadyReturned = Number(item['returnedQty'] ?? 0);
    } else {
      alreadyReturned = await computeReturnedQtyForItem(tx, item.id);
    }

    const availableToReturn = Number(item.qty) - alreadyReturned;
    if (availableToReturn <= 0) throw new Error('Nothing left to return for this dispatch item');
    if (returnQty > availableToReturn) throw new Error(`Return qty (${returnQty}) exceeds available (${availableToReturn})`);

    // resolve inventory item to increment
    let inventoryItemId: string | null = item.inventoryItemId ?? null;
    if (!inventoryItemId && item.purchaseId) {
      const inv = await tx.inventoryItem.findFirst({
        where: { purchaseId: item.purchaseId },
        select: { id: true },
      });
      inventoryItemId = inv?.id ?? null;
    }
    if (!inventoryItemId) throw new Error('Dispatch item not linked to an inventory record; cannot return to inventory');

    // increment inventory
    await tx.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { quantity: { increment: returnQty }, qty: { increment: returnQty } },
    });

    // update dispatch item returnedQty (if column exists) otherwise skip
    if (hasReturnedQtyField) {
      // @ts-ignore
      await tx.dispatchItem.update({ where: { id: item.id }, data: { returnedQty: { increment: returnQty } } });
    }

    // create InventoryReturn and InventoryReturnItem
    const invReturn = await tx.inventoryReturn.create({
      data: {
        dispatchId: item.dispatchId,
        projectId: item.dispatch?.projectId ?? null,
        createdById: me.id,
        note: note ?? null,
        items: {
          create: [
            {
              dispatchItemId: item.id,
              inventoryItemId: inventoryItemId,
              description: 'Returned from dispatch item',
              qty: returnQty,
              unit: null,
              note: note ?? null,
            },
          ],
        },
      },
      include: { items: true },
    });

    // revalidate pages
    revalidatePath(`/dispatches/${item.dispatchId}`);
    revalidatePath(`/projects/${item.dispatch?.projectId}`);
    revalidatePath('/inventory');

    return { ok: true, returnId: invReturn.id };
  });
}

/**
 * Mark a dispatch item as USED OUT (consumed) — prevents returns afterwards.
 * Recommended: add usedOut boolean to DispatchItem schema.
 * This version assumes you did add usedOut boolean to dispatchItem. If you haven't,
 * see note below for an alternative approach.
 */
export async function markDispatchItemUsedOut(itemId: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Authentication required');

  if (!['PROJECT_MANAGER', 'SECURITY', 'ADMIN'].includes((me as any).role)) {
    throw new Error('Not allowed to mark used out');
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.dispatchItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        qty: true,
        handedOutAt: true,
        dispatchId: true,
        dispatch: { select: { projectId: true } },
      },
    });
    if (!item) throw new Error('Dispatch item not found');
    if (!item.handedOutAt) throw new Error('Item has not been handed out — cannot mark used out');

    // compute available not-returned amount
    const hasReturnedQtyField = Object.prototype.hasOwnProperty.call(item, 'returnedQty');
    let alreadyReturned = 0;
    if (hasReturnedQtyField) {
      // @ts-ignore
      alreadyReturned = Number(item['returnedQty'] ?? 0);
    } else {
      alreadyReturned = await computeReturnedQtyForItem(tx, item.id);
    }
    const available = Number(item.qty) - alreadyReturned;
    if (available <= 0) throw new Error('No remaining qty to mark used out');

    // set usedOut flag (requires schema change)
    await tx.dispatchItem.update({
      where: { id: item.id },
      data: { usedOut: true, usedOutAt: new Date(), usedOutById: me.id },
    });

    revalidatePath(`/dispatches/${item.dispatchId}`);
    revalidatePath(`/projects/${item.dispatch?.projectId}`);
    revalidatePath('/inventory');

    return { ok: true };
  });
}