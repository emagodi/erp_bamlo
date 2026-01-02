import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { DepositRecordForm } from './deposit-record-form';

export default async function PaymentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }
  if (!['SALES_ACCOUNTS', 'ADMIN'].includes(user.role)) {
    redirect('/dashboard');
  }

  // Fetch projects pending deposit
  const projects = await prisma.project.findMany({
    where: {
      status: { in: ['CREATED', 'DEPOSIT_PENDING'] },
    },
    include: {
      quote: {
        include: {
          customer: true,
          projectManager: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pending Deposits</h1>
      
      {projects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <p className="text-gray-500">No projects pending deposit.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {project.quote.customer.displayName}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Project Manager: {project.quote.projectManager?.name || 'Not assigned'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Created: {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                  {project.status === 'CREATED' ? 'Created' : 'Deposit Pending'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <p className="text-gray-500">Deposit Amount</p>
                  <p className="font-medium text-lg">${(Number(project.depositMinor) / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Commence Date</p>
                  <p className="font-medium">{new Date(project.commenceOn).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Record Deposit</h4>
                <DepositRecordForm 
                  projectId={project.id} 
                  projectManagerId={project.quote.projectManagerId || ''}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
