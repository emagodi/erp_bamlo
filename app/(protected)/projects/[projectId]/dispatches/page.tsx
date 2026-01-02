// app/(protected)/dispatches/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export default async function DispatchListPage() {
  const dispatches = await prisma.dispatch.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dispatches</h1>

      <div className="space-y-3">
        {dispatches.map((d) => {
          const total = d.items.length;
          const handed = d.items.filter((i) => i.handedOutAt).length;
          const received = d.items.filter((i) => i.receivedAt).length;

          return (
            <div
              key={d.id}
              className="flex items-center justify-between rounded border bg-white p-4"
            >
              <div>
                <div className="font-semibold">
                  <Link href={`/projects/${d.projectId}/dispatches/${d.id}`}>
                    Dispatch {d.id.slice(0, 8)} — {d.status ?? 'DRAFT'}
                  </Link>
                </div>
                <div className="text-xs text-gray-600">
                  {new Date(d.createdAt).toLocaleString()} • Items: {total} • Handed out: {handed}/
                  {total} • Received: {received}/{total}
                </div>
                {d.items.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    {d.items
                      .slice(0, 3)
                      .map((i) => i.description)
                      .join(' · ')}
                    {d.items.length > 3 ? ' …' : ''}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/dispatches/${d.id}`}
                  className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Open
                </Link>
                <Link
                  href={`/dispatches/${d.id}/receipt`}
                  className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-800"
                >
                  View receipt
                </Link>
              </div>
            </div>
          );
        })}

        {dispatches.length === 0 && (
          <div className="rounded border bg-white p-4 text-sm text-gray-500">
            No dispatches yet.
          </div>
        )}
      </div>
    </div>
  );
}
