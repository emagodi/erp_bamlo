import { prisma } from '@/lib/db';
import { approvePO, rejectPO } from '@/app/(protected)/accounts/actions';

export default async function POReview({ params }: { params: Promise<{ poId: string }>}) {
  const { poId } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { requisition: { include: { project: true } }, items: true, decidedBy: true },
  });
  if (!po) return <div className="p-6">PO not found</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Purchase Order {po.id.slice(0,8)} — {po.status}</h1>

      <table className="min-w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 text-left">Item</th>
            <th className="px-2 py-1">Unit</th>
            <th className="px-2 py-1">Qty</th>
            <th className="px-2 py-1">Budget</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map(it => (
            <tr key={it.id} className="border-t">
              <td className="px-2 py-1">{it.description}</td>
              <td className="px-2 py-1 text-center">{it.unit ?? '-'}</td>
              <td className="px-2 py-1 text-right">{it.qty}</td>
              <td className="px-2 py-1 text-right">{(Number(it.amountMinor)/100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {po.status === 'SUBMITTED' ? (
        <div className="flex gap-2">
          <form action={async () => { 'use server'; await approvePO(po.id); }}>
            <button className="rounded bg-emerald-600 px-3 py-1.5 text-white">Approve</button>
          </form>
          <form action={async () => { 'use server'; await rejectPO(po.id); }}>
            <button className="rounded bg-red-600 px-3 py-1.5 text-white">Reject</button>
          </form>
        </div>
      ) : (
        <div className="text-sm text-gray-600">
          Decided by: {po.decidedBy?.name ?? po.decidedBy?.email ?? '—'} · {po.decidedAt?.toLocaleString() ?? '—'}
        </div>
      )}
    </div>
  );
}

