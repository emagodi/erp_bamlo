// app/(protected)/dispatches/actions.ts
'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

function assertSecurity(role?: string | null) {
  if (role !== 'SECURITY' && role !== 'ADMIN') {
    throw new Error('Only Security or Admin can perform this action');
  }
}

/* export async function markItemHandedOut(itemId: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Auth required');
  assertSecurity(me.role);

  // Update dispatch item and decrement inventory if linked
  await prisma.$transaction(async (tx) => {
    const item = await tx.dispatchItem.findUnique({ where: { id: itemId }, select: { id: true, dispatchId: true, qty: true, inventoryItemId: true } });
    if (!item) throw new Error('Dispatch item not found');

    await tx.dispatchItem.update({
      where: { id: itemId },
      data: { handedOutAt: new Date(), handedOutById: me.id ?? null },
    });

    if (item.inventoryItemId) {
      await tx.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: {
          qty: { decrement: item.qty },
          quantity: { decrement: item.qty },
        },
      });
    }
  });

  // revalidate both list and details in case they’re open
  revalidatePath('/dispatches');
  const d = await prisma.dispatchItem.findUnique({ where: { id: itemId }, select: { dispatchId: true } });
  if (d?.dispatchId) revalidatePath(`/dispatches/${d.dispatchId}`);
  revalidatePath('/inventory');
  return { ok: true };
} */

/* export async function markItemHandedOut(itemId: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Authentication required');
  // ensure only security (or admin) can do this:
  assertSecurity(me.role);

  const res = await prisma.$transaction(async (tx) => {
    // 1) load the dispatch item and its dispatch (we need status + projectId)
    const item = await tx.dispatchItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        qty: true,
        inventoryItemId: true,
        purchaseId: true,
        dispatch: { select: { id: true, status: true, projectId: true } },
      },
    });
    if (!item) throw new Error('Dispatch item not found');

    // 2) allowed dispatch statuses for handing out (tweak to fit your workflow)
    const allowed = ['SUBMITTED', 'IN_TRANSIT'];
    if (!item.dispatch || !allowed.includes(item.dispatch.status)) {
      throw new Error(
        `Dispatch is not in a state that allows handing out (status=${item.dispatch?.status ?? 'N/A'})`,
      );
    }

    const qtyToHand = Number(item.qty ?? 0);
    if (!(qtyToHand > 0)) throw new Error('Invalid dispatch quantity');

    // 3) mark the dispatch item as handed out
    await tx.dispatchItem.update({
      where: { id: item.id },
      data: { handedOutAt: new Date(), handedOutById: me.id ?? null },
    });

    // 4) resolve an inventory item id for decrementing
    let inventoryId: string | null = item.inventoryItemId ?? null;

    // prefer explicit linked inventory item; fallback to purchase->inventory
    if (!inventoryId && item.purchaseId) {
      const inv = await tx.inventoryItem.findFirst({
        where: { purchaseId: item.purchaseId },
        select: { id: true },
      });
      inventoryId = inv?.id ?? null;
    }

    // If still missing, decide policy:
    // - throw to prevent handing out items not tracked in inventory (recommended)
    // - OR allow handing out but skip decrement (danger: possible over-allocation)
    if (!inventoryId) {
      throw new Error('Dispatch item is not linked to an inventory record; cannot decrement stock');
    }

    // 5) atomically decrement inventory only if there's enough stock
    // use updateMany to perform an atomic conditional update
    const updated = await tx.inventoryItem.updateMany({
      where: {
        id: inventoryId,
        quantity: { gte: qtyToHand }, // ensure enough stock available
      },
      data: {
        quantity: { decrement: qtyToHand }, // "quantity" field used in your schema
        qty: { decrement: qtyToHand }, // if you store both fields keep both in sync
      },
    });

    if (updated.count === 0) {
      // no rows updated -> insufficient stock (or inventory not found)
      throw new Error('Insufficient stock to hand out the requested quantity');
    }

    // 6) create an audit/inventory transaction (recommended) — skip if model not present
    if ((tx as any).inventoryTransaction && typeof (tx as any).inventoryTransaction.create === 'function') {
      await (tx as any).inventoryTransaction.create({
        data: {
          inventoryItemId: inventoryId,
          changeById: me.id!,
          delta: -qtyToHand,
          reason: 'DISPATCH_HANDOUT',
          metaJson: JSON.stringify({ dispatchItemId: item.id, dispatchId: item.dispatch?.id }),
        },
      });
    }

    return {
      ok: true,
      inventoryId,
      handedQty: qtyToHand,
      dispatchId: item.dispatch?.id ?? null,
      projectId: item.dispatch?.projectId ?? null,
    };
  });

  // revalidate relevant pages (adjust routes to match your app)
  if (res.dispatchId) revalidatePath(`/dispatches/${res.dispatchId}`);
  if (res.projectId) revalidatePath(`/projects/${res.projectId}`);
  revalidatePath('/dispatches');
  revalidatePath('/inventory');

  return res;
} */


 /*  export async function markItemHandedOut(itemId: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Authentication required');
  assertSecurity(me.role);

  const res = await prisma.$transaction(async (tx) => {
    const item = await tx.dispatchItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        qty: true,
        inventoryItemId: true,
        purchaseId: true,
        dispatch: { select: { id: true, status: true, projectId: true } },
      },
    });
    if (!item) throw new Error('Dispatch item not found');

    const allowed = ['SUBMITTED', 'IN_TRANSIT']; // adjust as needed
    if (!item.dispatch || !allowed.includes(item.dispatch.status)) {
      throw new Error(`Dispatch is not in a state that allows handing out (status=${item.dispatch?.status ?? 'N/A'})`);
    }

    const qtyToHand = Number(item.qty ?? 0);
    if (!(qtyToHand > 0)) throw new Error('Invalid dispatch quantity');

    // mark handed out on the item
    await tx.dispatchItem.update({
      where: { id: item.id },
      data: { handedOutAt: new Date(), handedOutById: me.id ?? null },
    });

    // determine inventory item id (explicit link or via purchase)
    let inventoryId: string | null = item.inventoryItemId ?? null;
    if (!inventoryId && item.purchaseId) {
      const inv = await tx.inventoryItem.findFirst({ where: { purchaseId: item.purchaseId }, select: { id: true } });
      inventoryId = inv?.id ?? null;
    }

    if (!inventoryId) {
      throw new Error('Dispatch item is not linked to an inventory record; cannot decrement stock');
    }

    // atomically decrement quantity (ensures not negative)
    const updated = await tx.inventoryItem.updateMany({
      where: {
        id: inventoryId,
        quantity: { gte: qtyToHand },
      },
      data: {
        quantity: { decrement: qtyToHand },
        // keep both qty/quantity fields in sync if you have both
        qty: { decrement: qtyToHand },
      },
    });

    if (updated.count === 0) {
      throw new Error('Insufficient stock to hand out the requested quantity');
    }

    return {
      ok: true,
      inventoryId,
      handedQty: qtyToHand,
      dispatchId: item.dispatch?.id ?? null,
      projectId: item.dispatch?.projectId ?? null,
    };
  });

  // revalidate appropriate pages
  if (res.dispatchId) revalidatePath(`/dispatches/${res.dispatchId}`);
  if (res.projectId) revalidatePath(`/projects/${res.projectId}`);
  revalidatePath('/dispatches');
  revalidatePath('/inventory');

  return res;
} */


export async function markItemHandedOut(itemId: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Auth required');
  assertSecurity(me.role); // throws if not security/admin

  const res = await prisma.$transaction(async (tx) => {
    const item = await tx.dispatchItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        qty: true,
        inventoryItemId: true,
        purchaseId: true,
        description: true,
        unit: true,
        dispatch: { select: { id: true, status: true, projectId: true } },
      },
    });
    if (!item) throw new Error('Dispatch item not found');

    console.log("Hshew wehwehj jewjewj")
    // allowed statuses (adjust to your workflow)
    const allowed = ['SUBMITTED', 'IN_TRANSIT'];
    if (!item.dispatch || !allowed.includes(item.dispatch.status)) {
      throw new Error(`Dispatch is not in a state that allows handing out (status=${item.dispatch?.status ?? 'N/A'})`);
    }

    const qtyToHand = Number(item.qty ?? 0);
    if (!(qtyToHand > 0)) throw new Error('Invalid dispatch quantity');

    // 1) mark dispatch item as handed out
    await tx.dispatchItem.update({
      where: { id: item.id },
      data: { handedOutAt: new Date(), handedOutById: me.id ?? null },
    });
    console.log("Hshew wehwehj jewjewj")

    // 2) resolve inventory id (try explicit links then fallback to key)
    let inventoryId: string | null = item.inventoryItemId ?? null;

    if (!inventoryId && item.purchaseId) {
      const inv = await tx.inventoryItem.findFirst({ where: { purchaseId: item.purchaseId }, select: { id: true } });
      inventoryId = inv?.id ?? null;
    }
    console.log("Hshew wehwehj jewjewj")

    if (!inventoryId) {
      const key = `${(item.description ?? '').trim()}|${(item.unit ?? '').trim()}`.toLowerCase();
      const inv = await tx.inventoryItem.findFirst({ where: { key }, select: { id: true } });
      inventoryId = inv?.id ?? null;
    }

    if (!inventoryId) {
      throw new Error('Dispatch item is not linked to an inventory record; cannot decrement stock');
    }

    console.log("Hshew wehwehj jewjewj")
    console.log(inventoryId)
    console.log("Hshew wehwehj jewjewj")
    // 3) atomic decrement
    const updated = await tx.inventoryItem.updateMany({
      where: { id: inventoryId, quantity: { gte: qtyToHand } },
      data: {
        quantity: { decrement: qtyToHand },
        qty: { decrement: qtyToHand },
      },
    });

    if (updated.count === 0) {
      throw new Error('Insufficient stock to hand out the requested quantity');
    }

    // Optionally create an audit record if you add an inventoryTransactions model
    // await tx.inventoryTransaction.create({ ... });

    console.log({ ok: true, inventoryId, handedQty: qtyToHand, dispatchId: item.dispatch?.id ?? null, projectId: item.dispatch?.projectId ?? null })

    return { ok: true, inventoryId, handedQty: qtyToHand, dispatchId: item.dispatch?.id ?? null, projectId: item.dispatch?.projectId ?? null };
  });

  console.log("Hshew wehwehj jewjewj after transaction")
  console.log(res)
  console.log("Hshew wehwehj jewjewj after transaction")

  if (res.dispatchId) revalidatePath(`/dispatches/${res.dispatchId}`);
  if (res.projectId) revalidatePath(`/projects/${res.projectId}`);
  revalidatePath('/dispatches');
  revalidatePath('/inventory');

  return res;
}

export async function markItemReceived(itemId: string, receiverName: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Auth required');
  // Allow SECURITY or ADMIN to set received as well; adjust if you use “STOCKIST”
  assertSecurity(me.role);

  await prisma.dispatchItem.update({
    where: { id: itemId },
    data: { receivedAt: new Date(), receivedByName: receiverName || null },
  });

  revalidatePath('/dispatches');
  revalidatePath(`/dispatches/${(await prisma.dispatchItem.findUnique({ where: { id: itemId }, select: { dispatchId: true } }))!.dispatchId}`);
  return { ok: true };
}
