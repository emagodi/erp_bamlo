import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Money from '@/components/Money';
import Link from 'next/link';
import clsx from 'clsx';
import { fromMinor } from '@/helpers/money';
import FundingDecisionActions from './FundingDecisionActions';

export default async function FundingRequestDetailPage({
  params,
}: {
  params: Promise<{ fundingId: string }>;
}) {
  const { fundingId } = await params;
  const user = await getCurrentUser();
  if (!user) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;

  const role = user.role ?? 'UNKNOWN';
  const canApprove =
    role === 'ACCOUNTING_OFFICER' ||
    role === 'ADMIN' ||
    role === 'ACCOUNTS' ||
    role === 'ACCOUNTING_CLERK' ||
    role === 'MANAGING_DIRECTOR';

  const funding = await prisma.fundingRequest.findUnique({
    where: { id: fundingId },
    include: {
      requisition: {
        include: {
          project: { include: { quote: { include: { customer: true } } } },
          items: true,
        },
      },
      approvedBy: { select: { name: true, email: true } },
      submittedBy: { select: { name: true, email: true } },
      requestedBy: { select: { name: true, email: true } },
    },
  });

  if (!funding) return <div className="p-6">Funding request not found.</div>;

  const req = funding.requisition!;
  const proj = req.project!;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Funding Request Details</h1>
        <Link href="/accounts" className="text-sm text-indigo-600 hover:underline">
          &larr; Back to Accounts
        </Link>
      </div>

      <div className="grid gap-6">
        <section className="rounded border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Request Information</h2>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Project:</span>
                <Link href={`/projects/${proj.id}`} className="text-indigo-600 hover:underline font-medium">
                  {proj.projectNumber || proj.quote?.number || proj.id}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-medium">{proj.quote?.customer?.displayName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Office:</span>
                <span>{proj.office || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Requisition ID:</span>
                <span className="font-medium">{req.id}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Request ID:</span>
                <span className="font-medium">{funding.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span
                  className={clsx(
                    'rounded px-1.5 py-0.5 text-xs font-semibold',
                    funding.status === 'APPROVED' && 'bg-emerald-100 text-emerald-700',
                    funding.status === 'REJECTED' && 'bg-rose-100 text-rose-700',
                    (funding.status === 'PENDING' || funding.status === 'REQUESTED') && 'bg-amber-100 text-amber-700'
                  )}
                >
                  {funding.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount Requested:</span>
                <span className="font-semibold text-lg">
                  <Money minor={funding.amountMinor} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Requested By:</span>
                <span>{funding.requestedBy?.name ?? funding.requestedBy?.email ?? funding.submittedBy?.name ?? funding.submittedBy?.email ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Requested At:</span>
                <span>{new Date(funding.requestedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Requisition Items</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-left">Unit</th>
                <th className="px-3 py-2 text-right">Est. Price</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {req.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">{item.description}</td>
                  <td className="px-3 py-2 text-right">{item.qtyRequested ?? item.qty}</td>
                  <td className="px-3 py-2 text-left">{item.unit ?? '-'}</td>
                  <td className="px-3 py-2 text-right">
                    <Money minor={item.requestedUnitPriceMinor ?? item.estPriceMinor} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money minor={item.amountMinor} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right">Total Requested:</td>
                <td className="px-3 py-2 text-right">
                  <Money minor={funding.amountMinor} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {canApprove && (funding.status === 'PENDING' || funding.status === 'REQUESTED') && (
        <section className="rounded border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <FundingDecisionActions fundingId={funding.id} />
        </section>
      )}
    </div>
  );
}
