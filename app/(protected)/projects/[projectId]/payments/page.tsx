import Link from 'next/link';
import { redirect } from 'next/navigation';

import { recordDeposit } from '@/app/actions/projects';
import { recordClientPayment } from '@/app/(protected)/accounts/actions';
import Money from '@/components/Money';
import SubmitButton from '@/components/SubmitButton';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function ProjectPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ amount?: string; type?: string }>;
}) {
  const { projectId } = await params;
  const { amount: prefilledAmount, type: paymentType } = await searchParams;
  
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (!['SALES_ACCOUNTS', 'ADMIN'].includes(me.role as string)) {
    redirect(`/projects/${projectId}`);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      quote: { include: { customer: true, projectManager: true } },
      clientPayments: true,
    },
  });

  if (!project) return <div className="p-6">Project not found</div>;

  const depositDue = BigInt(project.depositMinor ?? 0);
  const paidTotal = project.clientPayments.reduce(
    (acc, p) => acc + BigInt(p.amountMinor ?? 0),
    0n,
  );
  const depositPaid = project.clientPayments
    .filter((p) => p.type === 'DEPOSIT')
    .reduce((acc, p) => acc + BigInt(p.amountMinor ?? 0), 0n);

  const pmId = project.quote?.projectManagerId || project.assignedToId || null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payments for Project</h1>
          <p className="text-sm text-gray-600">
            {project.quote?.customer?.displayName ?? 'Customer'} — Quote{' '}
            {project.quote?.number ?? project.quoteId}
          </p>
        </div>
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          Back to project
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Deposit Due</div>
          <div className="text-xl font-semibold">
            <Money minor={depositDue} />
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Deposit Paid</div>
          <div className="text-xl font-semibold text-emerald-700">
            <Money minor={depositPaid} />
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total Received</div>
          <div className="text-xl font-semibold text-emerald-700">
            <Money minor={paidTotal} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl">
        {/* Record Deposit - Only show if deposit not fully paid */}
        {depositPaid < depositDue && (
          <div className="rounded-lg border bg-white p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Record Deposit</h2>
              <p className="text-sm text-gray-500">
                Recording a deposit moves the project to PLANNED.
              </p>
            </div>
            <form
              action={async (fd) => {
                'use server';
                await recordDeposit({
                  projectId,
                  amountMinor: Math.round(Number(fd.get('amount') || 0) * 100),
                  receivedAt: String(fd.get('receivedAt') || new Date().toISOString().slice(0, 10)),
                  receiptNo: String(fd.get('receiptNo') || ''),
                  method: String(fd.get('method') || 'CASH'),
                  projectManagerId: null,
                });
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Amount</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={paymentType === 'deposit' && prefilledAmount ? prefilledAmount : (Number(project.depositMinor ?? 0) / 100)}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Receipt #</label>
                <input
                  name="receiptNo"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Method</label>
                <select
                  name="method"
                  defaultValue="CASH"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="CASH">Cash</option>
                  <option value="EFT">EFT</option>
                  <option value="POS">POS</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <input type="hidden" name="receivedAt" value={new Date().toISOString().slice(0, 10)} />
              <SubmitButton className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700">
                Save deposit
              </SubmitButton>
            </form>
          </div>
        )}

        {/* Record Other Payment - Only show if deposit is fully paid */}
        {depositPaid >= depositDue && (
          <div className="rounded-lg border bg-white p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Record Other Payment</h2>
              <p className="text-sm text-gray-500">
                For installments or adjustments after the deposit.
              </p>
            </div>
            <form
              action={async (fd) => {
                'use server';
                await recordClientPayment(projectId, {
                  type: fd.get('type') as any,
                  amount: Number(fd.get('amount') || 0),
                  receivedAt: String(fd.get('receivedAt') || new Date().toISOString().slice(0, 10)),
                  receiptNo: String(fd.get('receiptNo') || ''),
                  method: String(fd.get('method') || 'CASH'),
                  attachmentUrl: null,
                });
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Payment type</label>
                <select
                  name="type"
                  defaultValue={paymentType === 'installment' ? 'INSTALLMENT' : 'DEPOSIT'}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="DEPOSIT">Deposit</option>
                  <option value="INSTALLMENT">Installment</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Amount</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={paymentType === 'installment' && prefilledAmount ? prefilledAmount : ''}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Receipt #</label>
                <input
                  name="receiptNo"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Method</label>
                <select
                  name="method"
                  defaultValue="CASH"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="CASH">Cash</option>
                  <option value="EFT">EFT</option>
                  <option value="POS">POS</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <input type="hidden" name="receivedAt" value={new Date().toISOString().slice(0, 10)} />
              <SubmitButton className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700">
                Save payment
              </SubmitButton>
            </form>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Payment history</h2>
        {project.clientPayments.length === 0 ? (
          <p className="text-sm text-gray-500">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Receipt</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {project.clientPayments
                  .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
                  .map((p) => (
                    <tr key={p.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{p.type}</td>
                      <td className="px-3 py-2">
                        {new Date(p.receivedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">{p.receiptNo ?? '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <Money minor={BigInt(p.amountMinor)} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
