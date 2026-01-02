import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  updateDispatchItems,
  submitDispatch,
  approveDispatch,
  markDispatchDelivered,
  markItemUsedOut,
} from '@/app/(protected)/projects/actions';
import { returnItemsToInventory } from '@/app/(protected)/projects/actions';
import LoadingButton from '@/components/LoadingButton';
import { revalidatePath } from 'next/cache';
import { markItemHandedOut, returnLineItem } from '../action';
import { redirect } from 'next/navigation';
import { use } from 'react';

export const runtime = 'nodejs';

export default async function DispatchDetail({
  params,
}: {
  params: Promise<{ dispatchId: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required.</div>;
  const role = (me as any).role as string | undefined;

  const { dispatchId } = await params;
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: { project: { select: { id: true } }, items: true },
  });
  if (!dispatch) return <div className="p-6">Not found.</div>;

  const canEdit = (role === 'PROJECT_MANAGER' || role === 'ADMIN') && dispatch.status === 'DRAFT';
  const canApprove =
    (role === 'PROJECT_MANAGER' || role === 'ADMIN') && dispatch.status === 'SUBMITTED';
  const isSecurity = role === 'SECURITY' || role === 'ADMIN';
  const isDriver = role === 'DRIVER' || role === 'ADMIN';
  const canReturn = role === 'PROJECT_MANAGER' || role === 'PROCUREMENT' || role === 'SENIOR_PROCUREMENT' || role === 'ADMIN';

  // ---------- server actions ----------
  // Save table edits (PM)
  const saveAction = async (fd: FormData) => {
    'use server';
    const updates: { id: string; qty: number }[] = [];
    // re-fetch items to iterate stable list
    const fresh = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });
    if (!fresh) throw new Error('Dispatch not found.');
    for (const it of fresh.items) {
      const raw = fd.get(`qty-${it.id}`);
      if (raw == null || raw === '') continue;
      const qty = Number(raw);
      if (!(qty >= 0)) throw new Error('Invalid qty');
      updates.push({ id: it.id, qty });
    }
    if (updates.length) {
      await updateDispatchItems(dispatchId, updates);
    }
    revalidatePath(`/dispatches/${dispatchId}`);
  };

  // Submit for Security (PM)
  const submitAction = async (fd: FormData) => {
    'use server';
    // persist any current edits first
    await saveAction(fd);
    await submitDispatch(dispatchId);
    revalidatePath(`/dispatches/${dispatchId}`);
  };

  // SECURITY: mark a single line handed out
  const markHandedOut = async (fd: FormData) => {
    'use server';
    const me = await getCurrentUser();
    if (!me) throw new Error('Auth required');
    const role = (me as any).role as string | undefined;
    if (!(role === 'SECURITY' || role === 'ADMIN')) throw new Error('Forbidden');

    const itemId = String(fd.get('itemId') ?? '');
    if (!itemId) throw new Error('Missing itemId');

    // Only allowed when dispatch is APPROVED/READY
    /*   const d = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      select: { status: true },
    });
    if (!d) throw new Error('Dispatch not found');
    if (d.status !== 'APPROVED' && d.status !== 'IN_TRANSIT') {
      throw new Error('Dispatch not ready for handout');
    }

    await prisma.dispatchItem.update({
      where: { id: itemId },
      data: {
        handedOutAt: new Date(),
        handedOutById: me.id!,
      },
    });

    // If at least one is handed out, treat as IN_TRANSIT
    if (d.status === 'APPROVED') {
      await prisma.dispatch.update({
        where: { id: dispatchId },
        data: { status: 'IN_TRANSIT' },
      });
    } */

    const qty = Number(fd.get('qty') ?? '');

    //console.log({ fd, itemId, qty });
    // await markItemHandedOut(itemId, qty);

    console.log('Hshew wehwehj kkkkk eeee rrr www ffff');
    revalidatePath(`/dispatches/${dispatchId}`);
  };

  // DRIVER: acknowledge received for a single line
  const acknowledgeReceived = async (fd: FormData) => {
    'use server';
    const me = await getCurrentUser();
    if (!me) throw new Error('Auth required');
    const role = (me as any).role as string | undefined;
    if (!(role === 'DRIVER' || role === 'ADMIN')) throw new Error('Forbidden');

    const itemId = String(fd.get('itemId') ?? '');
    if (!itemId) throw new Error('Missing itemId');

    const item = await prisma.dispatchItem.findUnique({
      where: { id: itemId },
      select: { dispatchId: true, handedOutAt: true },
    });
    if (!item) throw new Error('Item not found');
    if (!item.handedOutAt) throw new Error('Item not yet handed out');

    await prisma.dispatchItem.update({
      where: { id: itemId },
      data: {
        receivedAt: new Date(),
        receivedById: me.id!,
      },
    });

    // If ALL items received, mark dispatch DELIVERED
    const remaining = await prisma.dispatchItem.count({
      where: { dispatchId, receivedAt: null },
    });
    if (remaining === 0) {
      await prisma.dispatch.update({
        where: { id: dispatchId },
        data: { status: 'DELIVERED' },
      });
    }

    revalidatePath(`/dispatches/${dispatchId}`);
  };

  // RETURN: items back to inventory
  /* const returnAction = async (fd: FormData) => {
    'use server';
    const rows: any[] = [];
    // refresh items for stable iteration
    const fresh = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });
    if (!fresh) throw new Error('Dispatch not found');
    for (const it of fresh.items) {
      const key = `return-${it.id}`;
      const raw = fd.get(key);
      if (!raw) continue;
      const qty = Number(raw);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      rows.push({
        dispatchItemId: it.id,
        inventoryItemId: it.inventoryItemId ?? null,
        description: it.description,
        unit: it.unit ?? null,
        qty,
        note: String(fd.get(`note-${it.id}`) || ''),
      });
    }
    if (rows.length === 0) throw new Error('No items selected to return');

    await returnItemsToInventory(
      dispatch.id,
      dispatch.projectId ?? null,
      rows,
      String(fd.get('globalNote') || '')
    );
    revalidatePath(`/dispatches/${dispatchId}`);
  }; */
  // inside your server component file where prisma is available
  // server-side in the page/component file
  const returnAction = async (fd: FormData) => {
    'use server';
    // ensure dispatchId is available in scope (use closure or pass-in)
    // const dispatchId = ...;

    // fetch fresh dispatch items
    const fresh = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });
    if (!fresh) throw new Error('Dispatch not found');

    // typed row shape expected by returnItemsToInventory
    type ReturnRow = {
      dispatchItemId: string;
      inventoryItemId: string | null;
      description: string;
      unit: string | null;
      qty: number;
      note?: string | null;
      usedOut?: boolean;
    };

    const rows: ReturnRow[] = [];

    for (const it of fresh.items) {
      const raw = fd.get(`return-${it.id}`);
      const usedOut = !!fd.get(`usedout-${it.id}`);
      const note = String(fd.get(`note-${it.id}`) || '');
      const qty = raw ? Number(raw) : 0;

      // try to include inventoryItemId and description/unit from DB row
      rows.push({
        dispatchItemId: it.id,
        inventoryItemId: it.inventoryItemId ?? null,
        description: it.description,
        unit: it.unit ?? null,
        qty,
        note: note || null,
        usedOut,
      });
    }

    // partition rows: returns vs used-out-only
    const toReturn = rows.filter((r) => r.qty > 0);
    const toUsedOut = rows
      .filter((r) => r.usedOut)
      // If user checked usedOut and also provided qty to return, we will mark usedOut for the remainder later.
      .map((r) => ({
        dispatchItemId: r.dispatchItemId,
        qty: r.qty,
        inventoryItemId: r.inventoryItemId,
      }));

    // Now orchestrate in one logical flow:
    // 1) apply actual returns (if any)
    if (toReturn.length > 0) {
      // call your server action to process returns
      await returnItemsToInventory(
        dispatchId,
        fresh.projectId ?? null,
        toReturn.map((r) => ({
          dispatchItemId: r.dispatchItemId,
          inventoryItemId: r.inventoryItemId,
          description: r.description,
          unit: r.unit,
          qty: r.qty,
          note: r.note ?? null,
        })),
        null
      );
    }

    // 2) handle used-out marks: note that some usedOut rows might have provided qty for return as well.
    // We must compute leftover available-to-mark-used per item: fetch fresh state again
    const refreshed = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });
    if (!refreshed) throw new Error('Dispatch not found after return');

    for (const u of toUsedOut) {
      const it = refreshed.items.find((x) => x.id === u.dispatchItemId);
      if (!it) continue;
      const alreadyHanded = Number(it.handedOutQty ?? 0);
      const alreadyReturned = Number(it.returnedQty ?? 0);
      const alreadyUsed = Number(it.usedOutQty ?? 0);
      const available = Math.max(0, alreadyHanded - alreadyReturned - alreadyUsed);

      // If user provided qty to return (u.qty), then used-out should apply to remaining after the return.
      // If u.qty === 0, user only ticked usedOut -> mark all available as used
      const markQty = u.qty > 0 ? Math.max(0, available - u.qty) : available;
      if (markQty > 0) {
        // call markItemUsedOut action
        await markItemUsedOut(u.dispatchItemId, markQty);
      }
    }

    // Revalidate and redirect if needed
    revalidatePath(`/dispatches/${dispatchId}`);
    revalidatePath('/dispatches');
    return redirect(`/dispatches/${dispatchId}`); // or return { ok:true, dispatchId } if you prefer
  };

  // Use your existing helper if present (keeps logic centralized)
  // returnItemsToInventory(dispatch.id, dispatch.projectId ?? null, rows, globalNote);
  // If you have returnItemsToInventory, call it:
  /*  if (typeof returnItemsToInventory === 'function') {
      await returnItemsToInventory(fresh.id, fresh.projectId ?? null, rows, globalNote);
    } else {
      // Inline fallback implementation (transactional): create InventoryReturn + InventoryReturnItem rows
      // and increment inventory quantities. Adjust field names to match your schema.
      await prisma.$transaction(
        async (tx) => {
          // create return record
          const invReturn = await tx.inventoryReturn.create({
            data: {
              dispatchId: fresh.id,
              projectId: fresh.projectId ?? null,
              createdById: (await getCurrentUser())?.id ?? null,
              note: globalNote || null,
              items: {
                create: rows
                  .filter((r) => r.qty > 0) // only create items for positive qty
                  .map((r) => ({
                    dispatchItemId: r.dispatchItemId,
                    inventoryItemId: r.inventoryItemId ?? undefined,
                    description: r.description,
                    qty: r.qty,
                    unit: r.unit ?? undefined,
                    note: r.note ?? undefined,
                  })),
              },
            },
            include: { items: true },
          });

          // increment inventory quantities for each item that had qty > 0
          for (const r of rows) {
            if (!r.inventoryItemId) {
              // try to resolve via purchaseId (if dispatch item references a purchase)
              const di = await tx.dispatchItem.findUnique({
                where: { id: r.dispatchItemId },
                select: { purchaseId: true },
              });
              if (di?.purchaseId) {
                const inv = await tx.inventoryItem.findFirst({
                  where: { purchaseId: di.purchaseId },
                  select: { id: true },
                });
                if (inv) {
                  r.inventoryItemId = inv.id;
                }
              }
            }

            if (r.qty > 0 && r.inventoryItemId) {
              // increment quantity
              await tx.inventoryItem.update({
                where: { id: r.inventoryItemId },
                data: { quantity: { increment: r.qty }, qty: { increment: r.qty } },
              });
            }
          }

          // mark usedOut flags on dispatch items if requested (and/or increment returnedQty if you have field)
          for (const r of rows) {
            if (r.usedOut) {
              await tx.dispatchItem.update({
                where: { id: r.dispatchItemId },
                data: {
                  usedOut: true,
                  usedOutAt: new Date(),
                  usedOutById: (await getCurrentUser())?.id ?? null,
                },
              });
            } else if (r.qty > 0) {
              // if you have returnedQty column
              const hasReturnedQty = Object.prototype.hasOwnProperty.call(r, 'returnedQty');
              if (hasReturnedQty) {
                // @ts-ignore
                await tx.dispatchItem.update({
                  where: { id: r.dispatchItemId },
                  data: { returnedQty: { increment: r.qty } },
                });
              }
            }
          }
        },
        { maxWait: 5000 }
      );
    }

    // revalidate pages
    revalidatePath(`/dispatches/${dispatchId}`);
    revalidatePath(`/projects/${fresh.projectId}`);
    revalidatePath('/inventory');
  }; */

  // ---------- end actions ----------

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">
        Dispatch {dispatch.id.slice(0, 8)} — {dispatch.status}
      </h1>

      {/* TABLE (no outer form!) */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Handed Out</th>
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {dispatch.items.map((it) => (
              <tr key={it.id} className="border-b">
                <td className="px-3 py-2">{it.description}</td>
                <td className="px-3 py-2">
                  {/* <— points to the bottom form */}
                  {canEdit ? (
                    <input
                      name={`qty-${it.id}`}
                      form="editForm"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={Number(it.qty)}
                      className="w-24 rounded border px-2 py-1"
                    />
                  ) : (
                    Number(it.qty)
                  )}
                </td>
                <td className="px-3 py-2">{it.unit ?? '-'}</td>
                <td className="px-3 py-2">
                  {it.handedOutAt ? new Date(it.handedOutAt).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2">
                  {it.receivedAt ? new Date(it.receivedAt).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {isSecurity &&
                      (dispatch.status === 'APPROVED' || dispatch.status === 'IN_TRANSIT') &&
                      !it.handedOutAt && (
                        <form action={markItemHandedOut}>
                          <input type="hidden" name="itemId" value={it.id} />
                          <input type="hidden" name="qty" value={it.qty} />
                          {/* <button className="rounded border px-2 py-1 text-xs">
                            Mark handed out
                          </button> */}
                          <LoadingButton
                            type="submit"
                            className="rounded border px-2 py-1 text-xs"
                            loadingText="Handing out..."
                          >
                            Mark handed out
                          </LoadingButton>
                        </form>
                      )}
                    {isDriver &&
                      (dispatch.status === 'IN_TRANSIT' ||
                        dispatch.status === 'APPROVED' ||
                        dispatch.status === 'DELIVERED') &&
                      it.handedOutAt &&
                      !it.receivedAt && (
                        <form action={acknowledgeReceived}>
                          <input type="hidden" name="itemId" value={it.id} />
                          <button className="rounded border px-2 py-1 text-xs">
                            Acknowledge received
                          </button>
                        </form>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        {canApprove && dispatch.status === 'SUBMITTED' && (
          <form
            action={async () => {
              'use server';
              await approveDispatch(dispatch.id);
              revalidatePath(`/dispatches/${dispatchId}`);
            }}
          >
            <LoadingButton type="submit">Approve</LoadingButton>
          </form>
        )}
        {/*  {['APPROVED', 'OUT_FOR_DELIVERY'].includes(dispatch.status) && (
          <form
            action={async () => {
              'use server';
              await markDispatchDelivered(dispatch.id);
              revalidatePath('/security');
            }}
          >
            <LoadingButton type="submit">Mark Delivered</LoadingButton>
          </form>
        )} */}
      </div>

      {canEdit && (
        <form id="editForm" action={saveAction} className="mt-4 flex gap-2">
          <LoadingButton type="submit">Save changes</LoadingButton>
          <LoadingButton
            formAction={submitAction}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Submit for Security
          </LoadingButton>
        </form>
      )}

      {canReturn && (
        <>
          {/* <form action={returnAction} className="mt-6 border rounded p-4 bg-white">
          <h3 className="font-semibold">Return items to inventory</h3>
          <p className="text-sm text-gray-600">Enter quantities to return (positive numbers)</p>

          <div className="mt-2 space-y-2">
            {dispatch.items
              .filter((it) => Number(it.qty) > 0)
              .map((it) => (
                <div key={it.id} className="flex items-center gap-2">
                  <label className="flex-1">
                    <div className="text-sm font-medium">{it.description}</div>
                    <div className="text-xs text-gray-500">
                      Dispatched: {Number(it.qty)} {it.unit ?? ''}
                    </div>
                  </label>

                  <input
                    name={`return-${it.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Qty to return"
                    className="w-28 rounded border px-2 py-1"
                  />
                  <input
                    name={`note-${it.id}`}
                    placeholder="Note (optional)"
                    className="w-56 rounded border px-2 py-1"
                  />
                </div>
              ))}
          </div>

          <label className="block mt-3 text-sm">
            <span className="text-xs text-gray-500">Global note</span>
            <input
              name="globalNote"
              className="w-full rounded border px-2 py-1 mt-1"
              placeholder="Reason for return (optional)"
            />
          </label>

          <div className="mt-3">
            <button className="rounded bg-emerald-600 px-3 py-1.5 text-white">
              Return to inventory
            </button>
          </div>
        </form> */}
          <div className="mt-6 border rounded p-4 bg-white">
            <h3 className="font-semibold">Return items to inventory</h3>
            <p className="text-sm text-gray-600">
              Return individual items or mark them used out. Each line has its own Return button.
            </p>

            <div className="mt-4 space-y-4">
              {dispatch.items.map((it) => {
                // compute alreadyReturned here if you have a dispatched-side value; otherwise server will re-check.
                const returned = it.returnedQty ?? 0; // prefer explicit field if present
                const handedOut = it.handedOutQty ?? Number(it.qty ?? 0); // prefer stored handedOutQty if available
                const available = Math.max(0, handedOut - Number(returned ?? 0));
                const usedOut = it.usedOut ?? false;

                return (
                  <form
                    key={it.id}
                    action={async (fd) => {
                      'use server';
                      const rawQty = fd.get('qty');
                      const qty = rawQty ? Number(rawQty) : 0;
                      const note = String(fd.get('note') || '');
                      const used = fd.get('used') === 'on';
                      await returnLineItem(dispatch.id, it.id, qty, note, used);
                    }}
                    className="flex items-center gap-3"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">{it.description}</div>
                      <div className="text-xs text-gray-500">
                        Handed out: <b>{handedOut}</b> · Available to return:{' '}
                        <span className={available > 0 ? 'text-emerald-700' : 'text-gray-500'}>
                          {available}
                        </span>
                        {it.usedOut && (
                          <span className="ml-2 inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
                            USED OUT
                          </span>
                        )}
                      </div>
                    </div>

                    {!usedOut && (
                      <>
                        <input
                          name="qty"
                          type="number"
                          step="0.01"
                          min="0"
                          max={available}
                          placeholder="Qty to return"
                          className="w-28 rounded border px-2 py-1"
                          disabled={available <= 0 && !!it.usedOut}
                        />

                        <input
                          name="note"
                          placeholder="Note (optional)"
                          className="w-56 rounded border px-2 py-1"
                          disabled={available <= 0 && !!it.usedOut}
                        />

                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            name="used"
                            className="h-4 w-4"
                            defaultChecked={false}
                            disabled={!!it.usedOut}
                          />
                          <span>Mark used out</span>
                        </label>

                        <LoadingButton
                          type="submit"
                          className="rounded bg-emerald-600 px-3 py-1.5 text-white"
                          loadingText="Returning ..."
                        >
                          Return
                        </LoadingButton>
                      </>
                    )}

                    {/* <button
                      type="submit"
                      className="rounded bg-emerald-600 px-3 py-1.5 text-white"
                      title="Return this line"
                    >
                      Return
                    </button> */}
                  </form>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
