// app/(protected)/dispatches/[dispatchId]/page.tsx
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { updateDispatchItems, submitDispatch, markDispatchItemHandedOut } from '@/app/(protected)/projects/actions';
import LoadingButton from '@/components/LoadingButton';
import { redirect } from 'next/navigation';

export default async function DispatchDetail({ params }: { params: Promise<{ dispatchId: string }> }) {
  const me = await getCurrentUser();
  if (!me) {
    redirect('/login');
  }
  //if (!me) return <div className="p-6">Auth required.</div>;
  const role = (me as any).role as string | undefined;
  // TODO: Remove this debug after verifying
  // console.log('DispatchDetail Role:', role, 'IsSecurity:', (role === 'SECURITY' || role === 'ADMIN'));
  const { dispatchId } = await params;

  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: {
      project: { select: { id: true } },
      items: { orderBy: { id: 'asc' }, include: { inventoryItem: true } },
    },
  });
  if (!dispatch) return <div className="p-6">Not found.</div>;

  const canEdit = (role === 'PROJECT_MANAGER' || role === 'ADMIN') && dispatch.status === 'DRAFT';
  const isSecurity = role === 'SECURITY' || role === 'ADMIN';

  const saveAction = async (fd: FormData) => {
    'use server';
    const updates: { id: string; qty: number; selected: boolean }[] = [];
    for (const it of dispatch.items) {
      const qtyRaw = fd.get(`qty-${it.id}`);
      const selRaw = fd.get(`sel-${it.id}`);
      const qty = qtyRaw != null ? Number(qtyRaw) : Number(it.qty);
      const selected = selRaw === 'on';
      updates.push({ id: it.id, qty, selected });
    }
    await updateDispatchItems(dispatch.id, updates);
  };

  const submitAction = async (fd: FormData) => {
    'use server';
    const updates: { id: string; qty: number; selected: boolean }[] = [];
    for (const it of dispatch.items) {
      const qtyRaw = fd.get(`qty-${it.id}`);
      const selRaw = fd.get(`sel-${it.id}`);
      const qty = qtyRaw != null ? Number(qtyRaw) : Number(it.qty);
      const selected = selRaw === 'on';
      updates.push({ id: it.id, qty, selected });
    }
    await updateDispatchItems(dispatch.id, updates);
    await submitDispatch(dispatch.id);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dispatch {dispatch.id.slice(0, 8)} — {dispatch.status}</h1>

      {canEdit ? (
        <form action={saveAction} className="rounded border bg-white p-3">
          <TableContent dispatch={dispatch} canEdit={true} isSecurity={isSecurity} />
          <div className="mt-4 flex gap-2">
            <LoadingButton type="submit">Save changes</LoadingButton>
            <LoadingButton formAction={submitAction} className="bg-indigo-600 text-white hover:bg-indigo-700">Submit for Security</LoadingButton>
          </div>
        </form>
      ) : (
        <div className="rounded border bg-white p-3">
          <TableContent dispatch={dispatch} canEdit={false} isSecurity={isSecurity} />
          {role === 'DRIVER' && dispatch.status === 'DISPATCHED' && !dispatch.driverSignedAt && (
            <div className="mt-4 flex justify-end">
              <DriverAcknowledgeButton dispatchId={dispatch.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import MarkHandedOutButton from '@/components/MarkHandedOutButton';
import DriverAcknowledgeButton from '@/components/DriverAcknowledgeButton';
import AssignDriverForm from '@/components/AssignDriverForm';
import { getDrivers } from '@/app/(protected)/dispatches/driver-actions';

async function TableContent({ dispatch, canEdit, isSecurity }: { dispatch: any, canEdit: boolean, isSecurity: boolean }) {
  let drivers: any[] = [];
  if (isSecurity && dispatch.status === 'DISPATCHED' && !dispatch.assignedToDriverId) {
      try { drivers = await getDrivers(); } catch (e) {}
  }
  
  return (
    <div>
    <table className="w-full text-sm mb-4">
      <thead>
        <tr className="bg-gray-50 text-left">
          <th className="px-3 py-2">Include</th>
          <th className="px-3 py-2">Description</th>
          <th className="px-3 py-2">Qty</th>
          <th className="px-3 py-2">Unit</th>
          <th className="px-3 py-2">Handed Out</th>
          <th className="px-3 py-2">Received</th>
          <th className="px-3 py-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {dispatch.items.map((it: any) => (
          <tr key={it.id} className="border-b">
            <td className="px-3 py-2">
              {canEdit ? (
                <input type="checkbox" name={`sel-${it.id}`} defaultChecked={it.selected ?? true} />
              ) : it.selected ? (
                '✓'
              ) : (
                '—'
              )}
            </td>
            <td className="px-3 py-2">
              {it.description}
              {it.inventoryItem ? (
                <span className="ml-2 text-xs text-gray-500">(inv: {it.inventoryItem.name})</span>
              ) : null}
            </td>
            <td className="px-3 py-2">
              {canEdit ? (
                <input name={`qty-${it.id}`} type="number" min={0} step="0.01" defaultValue={Number(it.qty)} className="w-24 rounded border px-2 py-1" />
              ) : (
                Number(it.qty)
              )}
            </td>
            <td className="px-3 py-2">{it.unit ?? '-'}</td>
            <td className="px-3 py-2">{it.handedOutAt ? new Date(it.handedOutAt).toLocaleString() : '—'}</td>
            <td className="px-3 py-2">{it.receivedAt ? new Date(it.receivedAt).toLocaleString() : '—'}</td>
            <td className="px-3 py-2">
              {!canEdit && isSecurity && dispatch.status !== 'DRAFT' && !it.handedOutAt && (
                 <MarkHandedOutButton dispatchItemId={it.id} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    
    {isSecurity && dispatch.status === 'DISPATCHED' && !dispatch.assignedToDriverId && (
        <div className="mt-4 p-4 bg-yellow-50 rounded border border-yellow-200">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">Assign to Driver for Pickup</h3>
            <AssignDriverForm dispatchId={dispatch.id} drivers={drivers} />
        </div>
    )}
    </div>
  );
}
