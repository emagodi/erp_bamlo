import Link from 'next/link';
import clsx from 'clsx';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { approveFunding, rejectFunding, recordClientPayment } from './actions';
import {
  computeBalances,
  formatDateYMD,
  nextDueDate,
  fromMinor,
} from '@/lib/accounting';
import SubmitButton from '@/components/SubmitButton';
import { revalidatePath } from 'next/cache';
import DashboardTabs from '@/app/ui/dashboard/DashboardTabs';

export default async function AccountsDashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;

  const { fundingPage, paymentsPage } = await searchParams;
  const fPage = Number(fundingPage) || 1;
  const pPage = Number(paymentsPage) || 1;
  const itemsPerPage = 5;

  const role = user.role ?? 'UNKNOWN';
  const canApprove = role === 'ACCOUNTING_OFFICER' || role === 'ACCOUNTS' || role === 'ADMIN';
  const canRecord = role === 'ACCOUNTING_CLERK' || role === 'SALES_ACCOUNTS' || role === 'ACCOUNTS' || role === 'ADMIN';

  const [totalFundings, totalProjects] = await Promise.all([
    prisma.fundingRequest.count(),
    prisma.project.count(),
  ]);

  const [fundings, projects] = await Promise.all([
    prisma.fundingRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        requisition: {
          include: {
            project: { include: { quote: true } },
          },
        },
        approvedBy: { select: { name: true, email: true } },
        submittedBy: { select: { name: true, email: true } },
      },
      skip: (fPage - 1) * itemsPerPage,
      take: itemsPerPage,
    }),
    prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        quote: true,
        payments: true,
        clientPayments: true,
      },
      skip: (pPage - 1) * itemsPerPage,
      take: itemsPerPage,
    }),
  ]);

  const fundingTotalPages = Math.ceil(totalFundings / itemsPerPage);
  const paymentsTotalPages = Math.ceil(totalProjects / itemsPerPage);

  const renderPagination = (currentPage: number, totalPages: number, paramName: string, otherParamName: string, otherParamValue: number) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-4">
        <div className="flex flex-1 justify-between sm:hidden">
          <Link
            href={`/accounts?${paramName}=${Math.max(1, currentPage - 1)}&${otherParamName}=${otherParamValue}`}
            className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
          >
            Previous
          </Link>
          <Link
            href={`/accounts?${paramName}=${Math.min(totalPages, currentPage + 1)}&${otherParamName}=${otherParamValue}`}
            className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
          >
            Next
          </Link>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, paramName === 'fundingPage' ? totalFundings : totalProjects)}</span> of <span className="font-medium">{paramName === 'fundingPage' ? totalFundings : totalProjects}</span> results
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <Link
                href={`/accounts?${paramName}=${Math.max(1, currentPage - 1)}&${otherParamName}=${otherParamValue}`}
                className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
              >
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </Link>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/accounts?${paramName}=${p}&${otherParamName}=${otherParamValue}`}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    p === currentPage
                      ? 'z-10 bg-emerald-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
                      : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0'
                  }`}
                >
                  {p}
                </Link>
              ))}
              <Link
                href={`/accounts?${paramName}=${Math.min(totalPages, currentPage + 1)}&${otherParamName}=${otherParamValue}`}
                className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
              >
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </Link>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  const fundingContent = (
    <section className="rounded border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Funding Requests</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1 text-left">ID</th>
              <th className="px-2 py-1 text-left">Project</th>
              <th className="px-2 py-1 text-right">Requested</th>
              <th className="px-2 py-1 text-right">Approved</th>
              <th className="px-2 py-1 text-left">Status</th>
              <th className="px-2 py-1 text-left">By / When</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {fundings.length === 0 && (
              <tr>
                <td className="px-2 py-3 text-gray-500" colSpan={7}>
                  No funding requests yet.
                </td>
              </tr>
            )}
            {fundings.map((f) => {
              const req = f.requisition!;
              const proj = req.project!;
              return (
                <tr key={f.id} className="border-b last:border-b-0">
                  <td className="px-2 py-1">
                    <Link
                      href={`/projects/${proj.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {f.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-2 py-1">{proj.projectNumber || proj.quote?.number || proj.id}</td>
                  <td className="px-2 py-1 text-right">{fromMinor(f.amountMinor).toFixed(2)}</td>
                  <td className="px-2 py-1 text-right">
                    {f.status === 'APPROVED' ? fromMinor(f.amountMinor).toFixed(2) : '-'}
                  </td>
                  <td className="px-2 py-1">
                    <span
                      className={clsx(
                        'rounded px-1.5 py-0.5 text-xs font-semibold',
                        f.status === 'APPROVED' && 'bg-emerald-100 text-emerald-700',
                        f.status === 'REJECTED' && 'bg-rose-100 text-rose-700',
                        (f.status === 'PENDING' || f.status === 'REQUESTED') && 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {f.status === 'REJECTED' ? 'REVISION REQUIRED' : f.status}
                    </span>
                    {f.status === 'REJECTED' && f.reason && (
                      <span className="ml-2 text-xs text-gray-500">({f.reason})</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-xs text-gray-600">
                    {f.approvedBy ? (f.approvedBy.name ?? f.approvedBy.email) : '—'}
                    <br />
                    {f.approvedAt ? new Date(f.approvedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/accounts/funding/${f.id}`}
                        className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Details
                      </Link>
                      {canApprove && (f.status === 'PENDING' || f.status === 'REQUESTED') ? (
                        <div className="flex flex-col gap-1">
                          <form
                            action={async (fd) => {
                              'use server';
                              const amt = Number(fd.get('approved') || 0);
                              await approveFunding(f.id, amt > 0 ? amt : undefined);
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              name="approved"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Approve amount (optional)"
                              className="w-40 rounded border px-2 py-1"
                            />
                            <SubmitButton className="rounded bg-emerald-600 px-2 py-1 text-white text-xs">
                              Approve
                            </SubmitButton>
                          </form>
                          <form
                            action={async (fd) => {
                              'use server';
                              await rejectFunding(f.id, String(fd.get('reason') || ''));
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              name="reason"
                              placeholder="Reason (optional)"
                              className="w-40 rounded border px-2 py-1"
                            />
                            <SubmitButton className="rounded bg-rose-600 px-2 py-1 text-white text-xs">
                              Reject
                            </SubmitButton>
                          </form>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {renderPagination(fPage, fundingTotalPages, 'fundingPage', 'paymentsPage', pPage)}
    </section>
  );

  const paymentsContent = (
    <section className="rounded border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Client Payments</h2>
      <div className="mt-3 space-y-4">
        {projects.length === 0 && <div className="text-sm text-gray-500">No projects yet.</div>}
        {projects.map((p) => {
          const totals = computeBalances({ quote: p.quote!, payments: p.clientPayments });
          const next = nextDueDate((p as any).installmentDueDay ?? null, p.commenceOn);
          const dueLabel = next ? new Date(next).toLocaleDateString() : '-';
          return (
            <div key={p.id} className="rounded border border-gray-200 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-sm">
                  <div className="font-semibold">{p.projectNumber || p.quote?.number || p.id}</div>
                  <div className="text-gray-600">
                    Contract: {totals.contractTotal.toFixed(2)} · Paid: {totals.paid.toFixed(2)} ·
                    <span
                      className={clsx(
                        'ml-1 font-semibold',
                        totals.remaining >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      )}
                    >
                      Remaining: {totals.remaining.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Next due: <span className="font-medium">{dueLabel}</span>
                  </div>
                </div>
                {canRecord && (
                  <form
                    action={async (fd) => {
                      'use server';
                      await recordClientPayment(p.id, {
                        type: (fd.get('type') as 'DEPOSIT' | 'INSTALLMENT') ?? 'INSTALLMENT',
                        amount: Number(fd.get('amount') || 0),
                        receivedAt: String(fd.get('paidOn') || formatDateYMD(new Date())),
                        attachmentUrl: String(fd.get('ref') || ''),
                      });

                      revalidatePath('/accounts');
                    }}
                    className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5"
                  >
                    <select
                      name="type"
                      title="Payment type"
                      aria-label="Payment type"
                      className="rounded border px-2 py-1"
                    >
                      <option value="DEPOSIT">Deposit</option>
                      <option value="INSTALLMENT">Installment</option>
                    </select>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Amount"
                      className="rounded border px-2 py-1"
                    />
                    <input
                      name="paidOn"
                      type="date"
                      defaultValue={formatDateYMD(new Date())}
                      className="rounded border px-2 py-1"
                    />
                    <input
                      name="ref"
                      placeholder="Reference (optional)"
                      className="rounded border px-2 py-1"
                    />
                    <div className="col-span-2 md:col-span-5">
                      <SubmitButton
                        loadingText="Saving..."
                        className="rounded bg-slate-900 px-3 py-1.5 text-white w-full"
                      >
                        Record Payment
                      </SubmitButton>
                    </div>
                  </form>
                )}
              </div>
              {p.clientPayments.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left">Type</th>
                        <th className="px-2 py-1 text-right">Amount</th>
                        <th className="px-2 py-1 text-left">Paid On</th>
                        <th className="px-2 py-1 text-left">Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.clientPayments.map((pm) => (
                        <tr key={pm.id} className="border-b last:border-b-0">
                          <td className="px-2 py-1">{pm.type}</td>
                          <td className="px-2 py-1 text-right">
                            {fromMinor(pm.amountMinor as any).toFixed(2)}
                          </td>
                          <td className="px-2 py-1">
                            {new Date(pm.receivedAt).toLocaleDateString()}
                          </td>
                          <td className="px-2 py-1">{pm.receiptNo ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {renderPagination(pPage, paymentsTotalPages, 'paymentsPage', 'fundingPage', fPage)}
    </section>
  );

  const tabs = [
    { id: 'funding', label: `Funding Requests (${totalFundings})`, content: fundingContent },
    { id: 'payments', label: `Client Payments (${totalProjects})`, content: paymentsContent },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Accounts</h1>
      <DashboardTabs tabs={tabs} />
    </div>
  );
}
