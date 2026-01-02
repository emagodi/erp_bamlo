import { prisma } from '@/lib/db';
import Money from '@/components/Money'; // expects a major-unit number
import { fromMinor } from '@/helpers/money'; // (minor: bigint|number) -> number

export default async function ScheduleBlock({ projectId }: { projectId: string }) {
  const schedule = await prisma.paymentSchedule.findMany({
    where: { projectId },
    orderBy: [{ seq: 'asc' }],
    select: { id: true, seq: true, dueOn: true, amountMinor: true, paidMinor: true, status: true },
  });

  // Totals in minor (BigInt)
  const totalDueMinor = schedule.reduce<bigint>((a, s) => a + BigInt(s.amountMinor), 0n);
  const totalPaidMinor = schedule.reduce<bigint>((a, s) => a + BigInt(s.paidMinor ?? 0), 0n);
  const balanceMinor = totalDueMinor - totalPaidMinor;

  // Convert to major for display
  const totalDue = fromMinor(totalDueMinor);
  const totalPaid = fromMinor(totalPaidMinor);
  const balance = fromMinor(balanceMinor);

  const balClass =
    balanceMinor < 0n ? 'text-red-700' : balanceMinor > 0n ? 'text-emerald-700' : 'text-gray-800';

  return (
    <section className="rounded border bg-white p-4 shadow-sm">
      {/* Header line */}
      <div className="mb-3 text-sm">
        <span className="mr-3">
          Paid:{' '}
          <b>
            <Money value={totalPaid} />
          </b>
        </span>
        <span className="mr-3">
          Due:{' '}
          <b>
            <Money value={totalDue} />
          </b>
        </span>
        <span className={balClass}>
          Balance:{' '}
          <b>
            <Money value={balance} />
          </b>
        </span>
      </div>

      {/* Mini table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1 text-left">#</th>
              <th className="px-2 py-1 text-left">Due On</th>
              <th className="px-2 py-1 text-right">Amount</th>
              <th className="px-2 py-1 text-right">Paid</th>
              <th className="px-2 py-1 text-right">Remain</th>
              <th className="px-2 py-1 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((row) => {
              const amt = fromMinor(row.amountMinor);
              const paid = fromMinor(row.paidMinor ?? 0);
              const remainMinor = BigInt(row.amountMinor) - BigInt(row.paidMinor ?? 0);
              const remain = fromMinor(remainMinor);
              const remainClass = remainMinor > 0n ? 'text-amber-700' : 'text-gray-700';

              return (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-2 py-1">{row.seq}</td>
                  <td className="px-2 py-1">
                    {row.dueOn ? new Date(row.dueOn).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Money value={amt} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Money value={paid} />
                  </td>
                  <td className={`px-2 py-1 text-right ${remainClass}`}>
                    <Money value={remain} />
                  </td>
                  <td className="px-2 py-1">{row.status}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td className="px-2 py-2" colSpan={2}>
                Totals
              </td>
              <td className="px-2 py-2 text-right">
                <Money value={totalDue} />
              </td>
              <td className="px-2 py-2 text-right">
                <Money value={totalPaid} />
              </td>
              <td className={`px-2 py-2 text-right ${balClass}`}>
                <Money value={balance} />
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
