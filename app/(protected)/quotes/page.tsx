// app/(protected)/quotes/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRole } from '@/lib/workflow';
import { redirect } from 'next/navigation';
import clsx from 'clsx';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED_REVIEW: 'bg-blue-100 text-blue-700',
  REVIEWED: 'bg-emerald-100 text-emerald-700',
  SENT_TO_SALES: 'bg-amber-100 text-amber-700',
  NEGOTIATION: 'bg-purple-100 text-purple-700',
  FINALIZED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-gray-200 text-gray-600',
};

export default async function QuotesPage() {
  const me = await getCurrentUser();

  // If not authenticated, redirect immediately (don’t render a fallback first)
  if (!me) redirect('/login'); // or wherever your login/landing is

  const role = assertRole(me.role);

  // Authorize without try/catch; let redirect throw and bubble.
  const allowed = new Set(['QS', 'SENIOR_QS', 'SALES', 'ADMIN']);
  if (!allowed.has(role)) {
    redirect('/projects');
  }

  // Role-based filters
  let where: any = {};
  if (role === 'QS') {
    where = { status: 'DRAFT' /*, createdById: me.id */ };
  } else if (role === 'SENIOR_QS') {
    where = { status: { in: ['SUBMITTED_REVIEW', 'NEGOTIATION', 'REVIEWED'] } };
  } else if (role === 'SALES') {
    where = { status: { in: ['REVIEWED', 'SENT_TO_SALES', 'NEGOTIATION'] } };
  } // ADMIN sees all

  const quotes = await prisma.quote.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      number: true,
      status: true,
      updatedAt: true,
      customer: { select: { displayName: true, city: true } },
    },
    take: 100,
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Quotes</h1>

      <div className="rounded border bg-white divide-y">
        {quotes.length === 0 && <div className="p-4 text-sm text-gray-500">No quotes found.</div>}
        {quotes.map((q) => (
          <div key={q.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold truncate">
                {q.customer?.displayName || 'No customer'}
                {q.customer?.city ? ` - ${q.customer.city}` : ''}
              </div>
              <div className="text-xs text-gray-500">
                Ref: {q.number ?? q.id.slice(0, 8)} · Updated {new Date(q.updatedAt).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'rounded px-2 py-0.5 text-xs font-semibold',
                  STATUS_BADGE[q.status] || 'bg-gray-100'
                )}
              >
                {q.status}
              </span>
              <Link
                href={`/quotes/${q.id}`}
                className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Open
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
