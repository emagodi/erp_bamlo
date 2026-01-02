// app/(protected)/accounts/purchase-orders/page.tsx
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { projectApprovedSpendMinor } from '@/lib/projectTotals';

export default async function AccountsPOList() {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required.</div>;

  const pos = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: 'desc' },
    include: { requisition: { select: { projectId: true } }, items: true },
    take: 50,
  });

  // example: show total used for the first project in list
  const firstProjectId = pos[0]?.requisition.projectId;
  const used = firstProjectId ? await projectApprovedSpendMinor(firstProjectId) : 0n;

  return (
    <div className="p-6 space-y-4">
      {firstProjectId && (
        <div className="rounded border bg-white p-3 text-sm">
          <b>Project spend to date:</b> {(Number(used)/100).toFixed(2)}
        </div>
      )}
      {pos.map(po => (
        <div key={po.id} className="rounded border bg-white p-3">
          <div className="font-semibold">PO {po.id.slice(0,8)} — {po.status}</div>
          <div className="text-sm">
            Vendor: {po.vendor ?? '-'} · Requested: {(Number(po.requestedMinor)/100).toFixed(2)}
          </div>
          {/* Approve/Reject buttons form here (server actions above) */}
        </div>
      ))}
    </div>
  );
}
