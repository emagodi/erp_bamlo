// app/(protected)/projects/[projectId]/dispatches/consolidated/page.tsx
import { getConsolidatedDispatch } from '@/app/(protected)/projects/actions';
import { getCurrentUser } from '@/lib/auth';

export default async function ConsolidatedDispatchPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <div className="p-6">Auth required.</div>;

  const projectId = (await params).projectId;

  const rows = await getConsolidatedDispatch(projectId);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Consolidated Dispatch</h1>
      {rows.length === 0 ? (
        <div className="text-gray-500 text-sm">No dispatch items yet.</div>
      ) : (
        <table className="min-w-[560px] text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Total Dispatched</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="px-3 py-2">{r.description}</td>
                <td className="px-3 py-2">{r.unit ?? '-'}</td>
                <td className="px-3 py-2 text-right">{r.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="pt-2">
        <button onClick={() => window.print()} className="rounded border px-3 py-1.5 text-sm">
          Print
        </button>
      </div>
    </div>
  );
}
