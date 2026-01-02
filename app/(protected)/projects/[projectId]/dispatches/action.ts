// app/(protected)/dispatches/actions.ts
"use server";


import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { aw } from 'vitest/dist/chunks/reporters.C_zwCd4j.js';

function assertSecurity(role?: string | null) {
  if (role !== 'SECURITY' && role !== 'ADMIN') {
    throw new Error('Only Security or Admin can perform this action');
  }
}

// helper to format errors or build result shape
type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };


/* export async function markItemHandedOut(itemId: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Auth required');
  assertSecurity(me.role);

  console.log("Hshew wehwehj jewjewj")

  await prisma.dispatchItem.update({
    where: { id: itemId },
    data: { handedOutAt: new Date(), handedOutById: me.id ?? null },
  });

  // revalidate both list and details in case they’re open
  revalidatePath('/dispatches');
  revalidatePath(`/dispatches/${(await prisma.dispatchItem.findUnique({ where: { id: itemId }, select: { dispatchId: true } }))!.dispatchId}`);
  return { ok: true };
} */


  // working correctly
/* export async function markItemHandedOut(formData: any) {
  const itemId = formData.get('itemId');

  console.log({formData})

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
    const allowed = ['APPROVED', 'IN_TRANSIT'];
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

    if (!inventoryId) {
      const key = `${(item.description ?? '').trim()}|${(item.unit ?? '').trim()}`.toLowerCase();
      const inv = await tx.inventoryItem.findFirst({ where: { key }, select: { id: true } });
      inventoryId = inv?.id ?? null;
    }

    if (!inventoryId) {
      throw new Error('Dispatch item is not linked to an inventory record; cannot decrement stock');
    }

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


  if (res.dispatchId) revalidatePath(`/dispatches/${res.dispatchId}`);
  if (res.projectId) revalidatePath(`/projects/${res.projectId}`);
  revalidatePath('/dispatches');
  revalidatePath('/inventory');

  return res;
} */



/**
 * Mark a dispatch item as handed out and decrement inventory atomically.
 * - itemId: dispatchItem id
 * - qty: quantity to hand out (if omitted or null, will hand out remaining available in dispatchItem)
 */
/* export async function markItemHandedOut(itemId: string, qty?: number): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'Auth required' };
  assertSecurity(me.role);

  return prisma.$transaction(async (tx) => {
    // load dispatch item with dispatch and inventory/purchase references
    const item = await tx.dispatchItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        qty: true,
        handedOutQty: true,
        returnedQty: true,
        usedOutQty: true,
        inventoryItemId: true,
        purchaseId: true,
        dispatch: { select: { id: true, status: true, projectId: true } },
      },
    });

    if (!item) throw new Error('Dispatch item not found');

    // allow handout only when dispatch is in a state that permits it
    const allowedStatuses = ['SUBMITTED','APPROVED', 'IN_TRANSIT']; // change as appropriate
    if (!item.dispatch || !allowedStatuses.includes(item.dispatch.status)) {
      throw new Error(`Dispatch not in a state for handing out (${item.dispatch?.status})`);
    }

    const alreadyHanded = Number(item.handedOutQty ?? 0);
    const alreadyReturned = Number(item.returnedQty ?? 0);
    const alreadyUsed = Number(item.usedOutQty ?? 0);

    // remaining available to hand = total qty - alreadyHanded
    const remainingToHand = Math.max(0, Number(item.qty) - alreadyHanded);

    const handQty = qty == null ? remainingToHand : Number(qty);
    if (!(handQty > 0 && handQty <= remainingToHand)) {
      throw new Error(`Invalid handout qty. remainingToHand=${remainingToHand}`);
    }
    

    // Determine which inventory record to decrement (prefer inventoryItemId, fallback to purchase->inventory)
    let inventoryId: string | null = item.inventoryItemId ?? null;
    if (!inventoryId && item.purchaseId) {
      const inv = await tx.inventoryItem.findFirst({ where: { purchaseId: item.purchaseId }, select: { id: true } });
      inventoryId = inv?.id ?? null;
    }

    // If not linked to inventory -> block (you said prefer to prevent handing out untracked items)
    if (!inventoryId) {
      throw new Error('Dispatch item is not linked to an inventory record; cannot decrement stock');
    }

    // Atomically decrement inventory only when enough quantity exists
    const updated = await tx.inventoryItem.updateMany({
      where: {
        id: inventoryId,
        qty: { gte: handQty }, // ensure enough stock
      },
      data: {
        qty: { decrement: handQty },
        quantity: { decrement: handQty }, // if you store both fields
      },
    });

    if (updated.count === 0) {
      throw new Error('Insufficient stock to hand out the requested quantity');
    }

    // Update dispatch item handedOutQty and set handedOutAt/by
    await tx.dispatchItem.update({
      where: { id: item.id },
      data: {
        handedOutQty: { increment: handQty },
        handedOutAt: new Date(),
        handedOutById: me.id,
      },
    });

    // Optional: create inventory move / audit log
    await tx.inventoryMove.create({
      data: {
        inventoryItemId: inventoryId,
        changeById: me.id,
        delta: -handQty,
        reason: 'DISPATCH_HANDOUT',
        metaJson: JSON.stringify({ dispatchItemId: item.id, dispatchId: item.dispatch?.id }),
      },
    });

    // revalidate pages
    if (item.dispatch?.projectId) revalidatePath(`/projects/${item.dispatch.projectId}`);
    revalidatePath('/inventory');
    revalidatePath('/dispatches');
    revalidatePath("/dispatches/" + item.dispatch?.id);

    return { ok: true, data: { handedQty: handQty } };
  });
} */



export async function markItemHandedOut(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) throw new Error("Missing itemId");

  const me = await getCurrentUser();
  if (!me) throw new Error("Authentication required");

  // role guard
  const role = (me as any).role as string | undefined;
  if (!role || !["SECURITY", "ADMIN"].includes(role)) {
    throw new Error("Only security or admin may mark items handed out");
  }

  // ---- 1) Load dispatch item + minimal relations (outside tx) ----
  const it = await prisma.dispatchItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      qty: true,
      unit: true,
      inventoryItemId: true,
      purchaseId: true,
      handedOutQty: true,
      description: true,
      dispatch: { select: { id: true, status: true, projectId: true } },
    },
  });
  if (!it) throw new Error("Dispatch item not found");

  // status guard
  const allowedStatuses = ["SUBMITTED", "APPROVED", "IN_TRANSIT"] as const;
  const dispatchStatus = it.dispatch?.status ?? null;
  if (!dispatchStatus || !allowedStatuses.includes(dispatchStatus as any)) {
    throw new Error(
      `Dispatch status does not allow handing out (status=${dispatchStatus})`
    );
  }

  const qtyToHand = Number(it.qty ?? 0);
  if (!(qtyToHand > 0)) throw new Error("Invalid dispatch quantity to hand out");

  // ---- 2) Resolve/create inventory item (outside tx to keep tx short) ----
  let inventoryId: string | null = it.inventoryItemId ?? null;

  // by purchaseId
  if (!inventoryId && it.purchaseId) {
    const inv = await prisma.inventoryItem.findFirst({
      where: { purchaseId: it.purchaseId },
      select: { id: true, quantity: true, qty: true },
    });
    if (inv) inventoryId = inv.id;
  }

  // by normalized name + unit
  if (!inventoryId) {
    const normalizedName = (it.description ?? "").trim();
    if (normalizedName) {
      const invByName = await prisma.inventoryItem.findFirst({
        where: { name: normalizedName, unit: it.unit ?? null },
        select: { id: true, quantity: true, qty: true },
      });
      if (invByName) inventoryId = invByName.id;
    }
  }

  // seed by creating an inventory record (if purchase exists)
  if (!inventoryId && it.purchaseId) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: it.purchaseId },
      select: { vendor: true, taxInvoiceNo: true, qty: true, purchasedOn: true },
    });
    if (!purchase) {
      throw new Error("Linked purchase not found to seed inventory item");
    }

    const invName =
      (it.description && it.description.trim()) ||
      `${purchase.vendor ?? "Vendor"} / ${purchase.taxInvoiceNo ?? "invoice"}`;
    const unit = it.unit ?? null;
    const key = `${invName.trim()}|${(unit ?? "").trim()}`.toLowerCase();
    const seedQty = Number(purchase.qty ?? it.qty ?? qtyToHand) || qtyToHand;

    try {
      const created = await prisma.inventoryItem.create({
        data: {
          purchaseId: it.purchaseId,
          name: invName,
          description: invName,
          unit,
          key,
          qty: seedQty,
          quantity: seedQty,
          category: "MATERIAL",
        },
        select: { id: true },
      });
      inventoryId = created.id;
    } catch (err: any) {
      // handle potential unique races
      if (err?.code === "P2002" || /unique|constraint/i.test(String(err?.message || ""))) {
        const found = await prisma.inventoryItem.findFirst({
          where: { OR: [{ purchaseId: it.purchaseId }, { name: invName, unit }, { key }] },
          select: { id: true },
        });
        if (found) {
          await prisma.inventoryItem.update({
            where: { id: found.id },
            data: {
              qty: { increment: seedQty },
              quantity: { increment: seedQty },
              ...(it.purchaseId ? { purchaseId: it.purchaseId } : {}),
            },
          });
          inventoryId = found.id;
        } else {
          const fallback = await prisma.inventoryItem.create({
            data: {
              purchaseId: it.purchaseId,
              name: invName,
              description: invName,
              unit,
              key,
              qty: seedQty,
              quantity: seedQty,
              category: "MATERIAL",
            },
            select: { id: true },
          });
          inventoryId = fallback.id;
        }
      } else {
        throw err;
      }
    }
  }

  if (!inventoryId) {
    throw new Error("Dispatch item is not linked to inventory and cannot be handed out");
  }

  // ---- 3) Short transaction: atomic decrement + update dispatch item ----
  await prisma.$transaction(async (tx) => {
    // Atomic stock decrement guarded by gte
    const updated = await tx.inventoryItem.updateMany({
      where: { id: inventoryId!, quantity: { gte: qtyToHand } },
      data: { quantity: { decrement: qtyToHand }, qty: { decrement: qtyToHand } },
    });
    if (updated.count === 0) {
      throw new Error("Insufficient stock to hand out the requested quantity");
    }

    // Ensure we don't exceed dispatched quantity
    const already = Number(it.handedOutQty ?? 0);
    if (already + qtyToHand > Number(it.qty)) {
      throw new Error("Handed out quantity exceeds dispatched quantity");
    }

    // Mark dispatched item as handed out
    await tx.dispatchItem.update({
      where: { id: it.id },
      data: {
        handedOutAt: new Date(),
        handedOutById: me.id!,
        handedOutQty: { increment: qtyToHand },
      },
    });
  });

  // ---- 4) Best-effort audit record (outside tx to avoid session loss) ----
  try {
    await prisma.inventoryMove.create({
      data: {
        inventoryItemId: inventoryId!,
        changeById: me.id!,
        delta: -qtyToHand,
        reason: "DISPATCH_HANDOUT",
        metaJson: JSON.stringify({ dispatchItemId: it.id, dispatchId: it.dispatch?.id }),
      },
    });
  } catch {
    // swallow audit failure; core mutation already succeeded
  }

  // ---- 5) Revalidate affected pages ----
  if (it.dispatch?.id) revalidatePath(`/dispatches/${it.dispatch.id}`);
  revalidatePath("/dispatches");
  revalidatePath("/inventory");

  return {
    ok: true,
    inventoryId,
    handedQty: qtyToHand,
    dispatchId: it.dispatch?.id ?? null,
  };
}


// server action: return a single dispatch line with precise used-out logic
export async function returnLineItem(
  dispatchId: string,
  dispatchItemId: string,
  qtyMajor: number | null, // may be null/0 when marking used out only
  note?: string | null,
  markUsedOut?: boolean,
) {
  'use server';
  const me = await getCurrentUser();
  if (!me) throw new Error('Authentication required');

  // normalize inputs
  const rawQty = qtyMajor == null ? 0 : Number(qtyMajor);
  if (Number.isNaN(rawQty) || rawQty < 0) throw new Error('Invalid return quantity');

  // load the dispatch item and small context
  const item = await prisma.dispatchItem.findUnique({
    where: { id: dispatchItemId },
    select: {
      id: true,
      dispatchId: true,
      description: true,
      qty: true, // original dispatch qty (we recommend storing handedOutQty separately)
      handedOutAt: true,
      inventoryItemId: true,
      purchaseId: true,
      usedOut: true,
    },
  });
  if (!item) throw new Error('Dispatch item not found');
  if (item.dispatchId !== dispatchId) throw new Error('Dispatch item does not belong to this dispatch');

  // compute how much was handed out vs already returned
  // NOTE: it's best to store handedOutQty on DispatchItem when handing out; fallback uses qty.
  const handedOutQty = Number(item.qty ?? 0);

  const returnedAgg = await prisma.inventoryReturnItem.aggregate({
    where: { dispatchItemId: item.id },
    _sum: { qty: true },
  });
  const alreadyReturned = Number(returnedAgg._sum.qty ?? 0);

  console.log({ handedOutQty, alreadyReturned, rawQty, markUsedOut });

  const availableToReturn = Math.max(0, handedOutQty - alreadyReturned);

  console.log({ availableToReturn });

  // Decide what to do:
  // - If markUsedOut === true and rawQty === 0  -> only mark used out (no return)
  // - If markUsedOut === true and rawQty > 0   -> return rawQty (validated) and mark used out
  // - If markUsedOut !== true -> return rawQty (validated)
  if (!markUsedOut && rawQty <= 0) {
    throw new Error('Return quantity must be greater than zero unless you mark the item used out.');
  }

  // If attempting to return more than available, reject
  if (rawQty > availableToReturn) {
    throw new Error(`Return qty (${rawQty}) exceeds available to return (${availableToReturn}).`);
  }

  // Transaction: create InventoryReturn, InventoryReturnItem (if any), update inventory, optionally mark usedOut
  const txResult = await prisma.$transaction(async (tx) => {
    // create InventoryReturn (single record wrapping line items)
    const dispatchRec = await tx.dispatch.findUnique({
      where: { id: dispatchId },
      select: { projectId: true },
    });

    const invReturn = await tx.inventoryReturn.create({
      data: {
        dispatchId,
        projectId: dispatchRec?.projectId ?? null,
        createdById: me.id,
        note: note ?? null,
      },
    });

    // if there's a return quantity to persist (>0), create InventoryReturnItem and update inventory
    if (rawQty > 0) {
      await tx.inventoryReturnItem.create({
        data: {
          returnId: invReturn.id,
          dispatchItemId: item.id,
          inventoryItemId: item.inventoryItemId ?? undefined,
          description: item.description ?? '—',
          qty: rawQty,
          unit: null,
          note: note ?? null,
        },
      });

      // Determine inventory item id (first try explicit link, else try purchase->inventory)
      let inventoryId = item.inventoryItemId ?? null;
      if (!inventoryId && item.purchaseId) {
        const inv = await tx.inventoryItem.findFirst({
          where: { purchaseId: item.purchaseId },
          select: { id: true },
        });
        inventoryId = inv?.id ?? null;
      }

      if (inventoryId) {
        // update inventory atomically
        await tx.inventoryItem.update({
          where: { id: inventoryId },
          data: {
            qty: { increment: rawQty },
            quantity: { increment: rawQty },
          },
        });

        // optional: if you have an audit model (InventoryTransaction / StockMove) create a record here
        // await tx.inventoryTransaction?.create?.({ ... })
      }
    }



    // If marking used out, mark it (even if rawQty === 0)
    if (markUsedOut) {
      await tx.dispatchItem.update({
        where: { id: item.id },
        data: {
          usedOut: true,
          usedOutAt: new Date(),
          usedOutById: me.id,
          returnedQty: { increment: rawQty },
        },
      });
    }else {
      await tx.dispatchItem.update({
        where: { id: item.id },
        data: {
          returnedQty: { increment: rawQty },
        },
      });
    }

    return { ok: true, returned: rawQty, usedOut: !!markUsedOut };
  });

  // revalidate pages
  revalidatePath(`/dispatches/${dispatchId}`);
  if (item) {
    const projectId = (await prisma.dispatch.findUnique({ where: { id: dispatchId }, select: { projectId: true } }))?.projectId;
    if (projectId) revalidatePath(`/projects/${projectId}`);
  }
  revalidatePath('/inventory');

  return txResult;
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
