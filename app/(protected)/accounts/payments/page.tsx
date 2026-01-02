import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { recordClientPayment } from '@/app/(protected)/accounts/actions';
import SubmitButton from '@/components/SubmitButton';
import { redirect } from 'next/navigation';

const money = (minor?: bigint | number | null) =>
  typeof minor === 'bigint'
    ? (Number(minor) / 100).toFixed(2)
    : typeof minor === 'number'
      ? (minor / 100).toFixed(2)
      : '0.00';

export default async function PaymentsDashboard() {
  const me = await getCurrentUser();
  //if (!me) return <div className="p-6">Auth required.</div>;

  if (!me) {
    redirect('/login');
  }
  if (!['SALES_ACCOUNTS', 'ADMIN'].includes(me.role as string)) {
    redirect('/dashboard');
  }

  const schedules = await prisma.paymentSchedule.findMany({
    orderBy: [{ dueOn: 'asc' }],
    include: {
      project: {
        include: {
          quote: { select: { number: true, customer: { select: { displayName: true } } } },
        },
      },
    },
    take: 200,
  });

  const upcoming = schedules.filter((s) => s.status === 'DUE' || s.status === 'PARTIAL');
  const overdue = schedules.filter((s) => s.status === 'OVERDUE');

  const firstProject = schedules[0]?.projectId;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Client Payments</h1>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Overdue</h2>
        {overdue.length === 0 ? (
          <p className="text-sm text-gray-500 mt-1">No overdue installments.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left">Quote</th>
                  <th className="px-2 py-1 text-left">Customer</th>
                  <th className="px-2 py-1">Due Date</th>
                  <th className="px-2 py-1 text-right">Due</th>
                  <th className="px-2 py-1 text-right">Paid</th>
                  <th className="px-2 py-1 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((s) => {
                  const bal = BigInt(s.amountMinor) - BigInt(s.paidMinor ?? 0);
                  return (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="px-2 py-1">{s.project.quote?.number ?? s.projectId}</td>
                      <td className="px-2 py-1">{s.project.quote?.customer?.displayName ?? '-'}</td>
                      <td className="px-2 py-1">{new Date(s.dueOn).toLocaleDateString()}</td>
                      <td className="px-2 py-1 text-right">{money(s.amountMinor)}</td>
                      <td className="px-2 py-1 text-right">{money(s.paidMinor)}</td>
                      <td className="px-2 py-1 text-right text-red-600">{money(bal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Upcoming / Due</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500 mt-1">Nothing due.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left">Quote</th>
                  <th className="px-2 py-1 text-left">Customer</th>
                  <th className="px-2 py-1">Due Date</th>
                  <th className="px-2 py-1 text-right">Due</th>
                  <th className="px-2 py-1 text-right">Paid</th>
                  <th className="px-2 py-1 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((s) => {
                  const bal = BigInt(s.amountMinor) - BigInt(s.paidMinor ?? 0);
                  return (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="px-2 py-1">{s.project.quote?.number ?? s.projectId}</td>
                      <td className="px-2 py-1">{s.project.quote?.customer?.displayName ?? '-'}</td>
                      <td className="px-2 py-1">{new Date(s.dueOn).toLocaleDateString()}</td>
                      <td className="px-2 py-1 text-right">{money(s.amountMinor)}</td>
                      <td className="px-2 py-1 text-right">{money(s.paidMinor)}</td>
                      <td className="px-2 py-1 text-right">{money(bal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {firstProject && (
        <section className="rounded border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Record Payment (quick)</h2>
          <form
            action={async (fd) => {
              'use server';
              await recordClientPayment(String(fd.get('projectId') || firstProject), {
                type: fd.get('type') as any,
                amount: Number(fd.get('amount') || 0),
                receivedAt: String(fd.get('receivedAt') || new Date().toISOString().slice(0, 10)),
                receiptNo: String(fd.get('receiptNo') || ''),
                method: String(fd.get('method') || ''),
                attachmentUrl: null,
              });
            }}
            className="mt-3 grid gap-2 md:grid-cols-3 text-sm max-w-3xl"
          >
            <input
              name="projectId"
              placeholder="Project ID"
              className="rounded border px-2 py-1"
              defaultValue={firstProject}
            />
            <label htmlFor="type" className="sr-only">
              Payment type
            </label>
            <select id="type" name="type" className="rounded border px-2 py-1">
              <option value="DEPOSIT">Deposit</option>
              <option value="INSTALLMENT">Installment</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
            <input
              name="amount"
              type="number"
              step="0.01"
              placeholder="Amount"
              className="rounded border px-2 py-1"
              required
            />
            <input name="receivedAt" type="date" className="rounded border px-2 py-1" required />
            <input name="receiptNo" placeholder="Receipt #" className="rounded border px-2 py-1" />
            <input name="method" placeholder="Method" className="rounded border px-2 py-1" />
            <SubmitButton
              loadingText="Submitting..."
              className="md:col-span-3 rounded bg-slate-900 px-3 py-1.5 text-white"
            >
              Save Payment
            </SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}
