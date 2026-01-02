import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RequisitionApprovalPage() {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;
  
  const role = me.role as string;
  if (!['ACCOUNTS', 'ACCOUNTING_OFFICER', 'ADMIN'].includes(role)) {
    redirect('/dashboard');
  }

  const requisitions = await prisma.procurementRequisition.findMany({
    where: { status: 'SUBMITTED' },
    orderBy: { createdAt: 'desc' },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          quote: {
            select: {
              customer: { select: { displayName: true, city: true } },
            },
          },
        },
      },
      items: {
        select: { id: true, amountMinor: true },
      },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Requisition Approval</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review and approve requisitions submitted by project managers
          </p>
        </div>

        {requisitions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pending requisitions</h3>
            <p className="mt-1 text-sm text-gray-500">All requisitions have been reviewed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {requisitions.map((req) => {
              const totalMinor = req.items.reduce((sum, item) => sum + BigInt(item.amountMinor), 0n);
              const total = Number(totalMinor) / 100;
              
              return (
                <Link
                  key={req.id}
                  href={`/procurement/requisitions/${req.id}`}
                  className="group relative bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {req.project?.quote?.customer?.displayName || 'No customer'}
                          {req.project?.quote?.customer?.city ? ` - ${req.project.quote.customer.city}` : ''}
                        </h3>
                        <p className="mt-1 text-xs text-gray-400 truncate">
                          Req: {req.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Status</span>
                        <WorkflowStatusBadge status={req.status} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Items</span>
                        <span className="text-xs text-gray-900">{req.items.length}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Total</span>
                        <span className="text-xs text-gray-900">US${total.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Submitted</span>
                        <span className="text-xs text-gray-900">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        Project: {req.project?.name || req.project?.id.slice(0, 8)}
                      </span>
                      <span className="text-blue-600 group-hover:text-blue-700 font-medium">
                        Review →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
