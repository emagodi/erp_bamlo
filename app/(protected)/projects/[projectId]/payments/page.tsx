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
    },
  });

  if (!project) return <div className="p-6">Project not found</div>;

  const depositDue = Number(project.depositMinor ?? 0);
  const depositPaid = Number(project.clientPayments
    .filter((p) => p.type === 'DEPOSIT')
    .reduce((acc, p) => acc + BigInt(p.amountMinor ?? 0), 0n));

  // If deposit is fully paid (and was required), default to Other Payment (Installment)
  // If deposit is 0, we assume it's an installment based project or deposit not required yet? 
  // Usually if deposit is 0, we might default to Deposit to let them set it? 
  // But logic says: "if the payment still falls under deposit or its now unders installments"
  // If deposit is satisfied, move to installment.
  const isDepositPaid = depositPaid >= depositDue && depositDue > 0;
  const defaultTab = isDepositPaid ? 'other' : 'deposit';

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
           <h2 className="text-xl font-bold text-gray-900">Record Payment</h2>
           <Link 
             href="/projects" 
             className="rounded-full p-1 hover:bg-gray-100 transition-colors"
           >
             <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
           </Link>
        </div>
        <PaymentForms 
            projectId={projectId} 
            defaultTab={defaultTab}
            cancelHref="/projects"
        />
      </div>
    </div>
  );
}
