import { revalidatePath } from 'next/cache';

import LoadingButton from '@/components/LoadingButton';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { approveDispatch, markDispatchDelivered, createPurchase } from '@/app/(protected)/projects/actions';
import ReceivePurchaseForm from './ReceivePurchaseForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SecurityDispatchesPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;
  }

  async function savePurchase(requisitionId: string, itemId: string, formData: FormData) {
    'use server';
    await createPurchase({
      requisitionId,
      requisitionItemId: itemId,
      vendor: String(formData.get('vendor') || ''),
      taxInvoiceNo: String(formData.get('taxInvoiceNo') || ''),
      vendorPhone: String(formData.get('vendorPhone') || ''),
      qty: Number(formData.get('qty') || 0),
      unitPrice: Number(formData.get('unitPrice') || 0),
      date: String(formData.get('date') || new Date().toISOString().slice(0, 10)),
      invoiceUrl: null,
    });
    revalidatePath('/security');
  }

  const dispatches = await prisma.dispatch.findMany({
    where: { status: { in: ['SUBMITTED', 'APPROVED', 'OUT_FOR_DELIVERY'] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      project: { select: { quote: { select: { number: true } } } },
      items: true,
    },
  });

  const requisitions = await prisma.procurementRequisition.findMany({
    where: { status: { in: ['APPROVED', 'PARTIAL'] } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      project: { select: { quote: { select: { number: true } }, id: true } },
      items: true,
      purchases: true,
    },
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Security Console</h1>
        <div className="flex gap-2 text-sm">
          <a href="#dispatches" className="rounded border px-2 py-1">
            Dispatches
          </a>
          <a href="#receive" className="rounded border px-2 py-1">
            Receive Goods
          </a>
        </div>
      </div>

      <section id="dispatches" className="space-y-4">
        <h2 className="text-lg font-semibold">Dispatches</h2>
      {dispatches.length === 0 ? (
        <p className="text-gray-500">No dispatches awaiting action.</p>
      ) : (
        <div className="grid gap-3">
          {dispatches.map((dispatch) => (
            <div key={dispatch.id} className="rounded border border-gray-200 p-4 space-y-3">
              <div className="font-semibold text-gray-900">
                
                {dispatch.project.quote?.number ?? dispatch.projectId} : {dispatch.status}
              </div>
              <ul className="list-disc pl-5 text-sm text-gray-600">
                {dispatch.items.map((item) => (
                  <li key={item.id}>
                    {item.description} : {item.qty}
                    {item.unit ? ` ${item.unit}` : ''}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 text-sm">
                {dispatch.status === 'SUBMITTED' && (
                  <form
                    action={async () => {
                      'use server';
                      await approveDispatch(dispatch.id);
                      revalidatePath('/security');
                    }}
                  >
                    <LoadingButton type="submit">Approve</LoadingButton>
                  </form>
                )}
                {['APPROVED', 'OUT_FOR_DELIVERY'].includes(dispatch.status) && (
                  <form
                    action={async () => {
                      'use server';
                      await markDispatchDelivered(dispatch.id);
                      revalidatePath('/security');
                    }}
                  >
                    <LoadingButton type="submit">Mark Delivered</LoadingButton>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </section>

      <section id="receive" className="space-y-3">
        <h2 className="text-lg font-semibold">Receive Goods</h2>
        <p className="text-sm text-gray-600">
          Log goods received against approved requisitions. Totals are computed as quantity × unit price.
        </p>
        {requisitions.length === 0 ? (
          <p className="text-sm text-gray-500">No approved requisitions available.</p>
        ) : (
          <div className="space-y-4">
            {requisitions.map((req) => {
              const purchasedByItem = new Map<string, number>();
              req.purchases.forEach((p) => {
                if (p.requisitionItemId) {
                  purchasedByItem.set(
                    p.requisitionItemId,
                    (purchasedByItem.get(p.requisitionItemId) ?? 0) + Number(p.qty ?? 0),
                  );
                }
              });

              const itemsWithRemaining = req.items.filter((it) => {
                const bought = purchasedByItem.get(it.id) ?? 0;
                const remaining = Math.max(0, Number(it.qtyRequested ?? 0) - bought);
                return remaining > 0;
              });

              if (itemsWithRemaining.length === 0) return null;

              return (
                <div key={req.id} className="rounded border bg-white p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-semibold">
                      {req.project.quote?.number ?? req.projectId} — Requisition {req.id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Created {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-left">Item</th>
                          <th className="px-2 py-1 text-right">Req. Qty</th>
                          <th className="px-2 py-1 text-right">Purchased</th>
                          <th className="px-2 py-1 text-right">Remaining</th>
                          <th className="px-2 py-1 text-left">Receive</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsWithRemaining.map((it) => {
                          const bought = purchasedByItem.get(it.id) ?? 0;
                          const remaining = Math.max(0, Number(it.qtyRequested ?? 0) - bought);
                          return (
                            <tr key={it.id} className="border-b last:border-b-0 align-top">
                              <td className="px-2 py-2">
                                <div className="font-medium">{it.description}</div>
                                <div className="text-xs text-gray-600">{it.unit ?? '-'}</div>
                              </td>
                              <td className="px-2 py-2 text-right">{Number(it.qtyRequested ?? 0)}</td>
                              <td className="px-2 py-2 text-right">{bought}</td>
                              <td className="px-2 py-2 text-right">{remaining}</td>
                              <td className="px-2 py-2">
                                <ReceivePurchaseForm
                                  maxQty={remaining}
                                  defaultDate={new Date().toISOString().slice(0, 10)}
                                  action={savePurchase.bind(null, req.id, it.id)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
