import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';


function StatusBadge({ status }: { status: string }) {
  const styles = {
    Pending: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
    Approved: 'bg-green-50 text-green-700 ring-green-600/20',
    Draft: 'bg-gray-50 text-gray-600 ring-gray-500/10',
    Sent: 'bg-blue-50 text-blue-700 ring-blue-700/10',
    Rejected: 'bg-red-50 text-red-700 ring-red-600/10',
  };

  const className = styles[status as keyof typeof styles] || styles.Draft;

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${className}`}>
      {status}
    </span>
  );
}

export default function RecentQuotes({
  quotes
}: {
  quotes: {
    id: string;
    customer: string;
    amount: number;
    status: string;
    date: string;
  }[]
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-5 sm:px-6">
        <h3 className="text-base font-semibold leading-6 text-gray-900">Recent Quotes</h3>
        <Link href="/quotes" className="text-sm font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1">
          View all <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
      <ul role="list" className="divide-y divide-gray-100">
        {quotes.map((quote) => (
          <li key={quote.id} className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6">
            <div className="flex min-w-0 gap-x-4">
              <div className="min-w-0 flex-auto">
                <p className="text-sm font-semibold leading-6 text-gray-900">
                  <Link href={`/quotes/${quote.id}`}>
                    <span className="absolute inset-x-0 -top-px bottom-0" />
                    {quote.customer}
                  </Link>
                </p>
                <p className="mt-1 flex text-xs leading-5 text-gray-500">
                  <span className="relative truncate">{quote.date}</span>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-x-4">
              <div className="hidden sm:flex sm:flex-col sm:items-end">
                <p className="text-sm leading-6 text-gray-900">${quote.amount.toLocaleString()}</p>
                <StatusBadge status={quote.status} />
              </div>
              <ArrowRightIcon className="h-5 w-5 flex-none text-gray-400" aria-hidden="true" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
