import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import PaymentForms from './PaymentForms';

export default async function ProjectPaymentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (!['SALES_ACCOUNTS', 'ADMIN'].includes(me.role as string)) {
    redirect(`/projects/${projectId}`);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      clientPayments: true,
      quote: { include: { customer: true } },
      paymentSchedules: { select: { id: true, label: true, amountMinor: true, paidMinor: true, dueOn: true, status: true, seq: true } },
    },
  });

  if (!project) return <div className="p-6">Project not found</div>;

  const schedules = (project as any).paymentSchedules || [];
  
  // Sort schedules by date/seq
  schedules.sort((a: any, b: any) => {
    const dateA = new Date(a.dueOn).getTime();
    const dateB = new Date(b.dueOn).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a.seq || 0) - (b.seq || 0);
  });

  // Calculate total paid from all client payments
  const totalPaid = (project as any).clientPayments.reduce(
    (sum: bigint, p: any) => sum + BigInt(p.amountMinor ?? 0),
    0n
  );

  let currentItem: any = null;
  let dueBal = 0;
  let cumulativeDue = 0n;

  // Find the first schedule that isn't fully covered by total payments
  for (const s of schedules) {
    const amount = BigInt(s.amountMinor ?? 0);
    cumulativeDue += amount;
    
    if (cumulativeDue > totalPaid) {
      currentItem = s;
      // The amount due is the difference between what should have been paid by now (cumulativeDue)
      // and what has actually been paid (totalPaid).
      // However, we only want the portion for THIS item.
      // So effectively: due for this item = cumulativeDue - totalPaid
      dueBal = Number(cumulativeDue - totalPaid);
      break;
    }
  }

  // Fallback: If no schedules (e.g. legacy project), try to infer from project fields
  if (!currentItem && schedules.length === 0) {
    const dep = Number((project as any).depositMinor ?? 0);
    const inst = Number((project as any).installmentMinor ?? 0);
    if (dep > 0) {
      dueBal = dep;
      currentItem = { label: 'Deposit' }; // Dummy item for type detection
    } else if (inst > 0) {
      dueBal = inst;
      currentItem = { label: 'Installment' };
    }
  }

  let typeLabel = currentItem
    ? (String(currentItem.label || '').toLowerCase().includes('deposit') ? 'DEPOSIT' : 'INSTALLMENT')
    : 'INSTALLMENT';

  const initialAmount = Number(dueBal) / 100;
  const fixedType = typeLabel as 'DEPOSIT' | 'INSTALLMENT';
  const customerName = project.quote?.customer?.displayName || 'Project';

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Record Payment</h2>
              <p className="text-sm text-gray-600">{customerName}</p>
            </div>
          </div>
          <Link href="/projects" className="rounded-full p-1 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Link>
        </div>
        <PaymentForms
          projectId={projectId}
          initialAmount={initialAmount}
          fixedType={fixedType}
          customerName={customerName}
          cancelHref="/projects"
        />
      </div>
    </div>
  );
}
