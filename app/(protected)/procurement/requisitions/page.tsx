// app/(protected)/requisitions/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RequisitionsPage() {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required.</div>;

  const reqs = await prisma.procurementRequisition.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      project: { select: { id: true, quote: { select: { number: true, customer: { select: { displayName: true } } } } } },
      items: true,
      funding: true,
    },
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Requisitions</h1>
      {reqs.length === 0 ? (
        <div className="text-sm text-gray-500">No requisitions yet.</div>
      ) : (
        <ul className="space-y-2">
          {reqs.map(r => (
            <li key={r.id} className="rounded border bg-white p-3">
              <div className="flex justify-between">
                <div className="font-medium">
                  <Link className="hover:underline" href={`/requisitions/${r.id}`}>
                    {r.project.quote?.number ?? r.projectId}
                  </Link>
                  {r.project.quote?.customer?.displayName && (
                    <span className="ml-2 text-gray-500">· {r.project.quote.customer.displayName}</span>
                  )}
                </div>
                <div className="text-sm text-gray-600">{r.status}</div>
              </div>
              <div className="mt-1 text-xs text-gray-600 flex items-center gap-2">
                <span>Items: {r.items.length}</span>
                <span>·</span>
                <span>Funding:</span>
                {r.funding?.[0]?.status === 'REJECTED' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-800">
                    Revision Required
                  </span>
                ) : (
                  <span>{r.funding?.[0]?.status ?? '—'}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
