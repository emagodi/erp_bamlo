// app/(protected)/quotes/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRole } from '@/lib/workflow';
import { redirect } from 'next/navigation';
import clsx from 'clsx';
import { DocumentTextIcon, CalendarIcon, MapPinIcon, UserIcon, ArrowRightIcon, PlusIcon } from '@heroicons/react/24/outline';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  SUBMITTED_REVIEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  REVIEWED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  SENT_TO_SALES: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  NEGOTIATION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  FINALIZED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  ARCHIVED: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quotes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage and view your quotations</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/quotes/new/worksheet"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <PlusIcon className="h-4 w-4" />
            New Worksheet
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {quotes.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center dark:border-gray-700 dark:bg-gray-800/50">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No quotes found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new quote.</p>
          </div>
        )}
        
        {quotes.map((q) => (
          <div 
            key={q.id} 
            className="group relative flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                    <DocumentTextIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {q.number ?? q.id.slice(0, 8)}
                    </h3>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Ref ID
                    </p>
                  </div>
                </div>
                <span
                  className={clsx(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    STATUS_BADGE[q.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  )}
                >
                  {q.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <UserIcon className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate font-medium">{q.customer?.displayName || 'Walk-in Customer'}</span>
                </div>
                {q.customer?.city && (
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <MapPinIcon className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">{q.customer.city}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <CalendarIcon className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>{new Date(q.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-700">
              <Link
                href={`/quotes/${q.id}`}
                className="flex items-center justify-between text-sm font-bold text-blue-600 transition-colors group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300"
              >
                View Details
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
