import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import CreatePoForm from '../CreatePoForm';
import { redirect } from 'next/navigation';

export default async function CreatePoPage(props: {
  searchParams: Promise<{ requisitionId: string }>;
}) {
  const searchParams = await props.searchParams;
  const { requisitionId } = searchParams;
  const me = await getCurrentUser();

  if (!me) return <div className="p-6">Auth Required</div>;
  if (!requisitionId) return <div className="p-6">Requisition ID required</div>;

  const isProcurement = me.role === 'PROCUREMENT' || me.role === 'SENIOR_PROCUREMENT' || me.role === 'ADMIN';

  if (!isProcurement) return <div className="p-6">Access Denied</div>;

  const req = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    include: {
      items: true,
      project: {
        include: { quote: { include: { customer: true } } }
      }
    }
  });

  if (!req) return <div className="p-6">Requisition not found</div>;
  // If already ordered, maybe redirect or show message?
  // status 'ORDERED'
  if (req.status === 'ORDERED') return <div className="p-6">This requisition has already been ordered.</div>;
  if (req.status !== 'SUBMITTED') return <div className="p-6">Requisition is not in SUBMITTED state ({req.status})</div>;

  const items = req.items.map(i => ({
    id: i.id,
    description: i.description,
    qtyRequested: i.qtyRequested ?? 0,
    unit: i.unit,
    estPriceMinor: i.estPriceMinor
  }));

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create Purchase Order</h1>
        <p className="mt-2 text-sm text-gray-500">
          Review requisition items and create a Purchase Order for{' '}
          <span className="font-semibold text-gray-900">{req.project.quote.customer.displayName}</span>
        </p>
      </header>
      
      <div className="mb-8 rounded-md bg-blue-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm text-blue-700">
              Project: <span className="font-semibold">{req.project.projectNumber || 'N/A'}</span>
            </p>
            <p className="mt-3 text-sm md:mt-0 md:ml-6">
              <span className="font-medium text-blue-700">Requisition #{req.id.slice(-6).toUpperCase()}</span>
            </p>
          </div>
        </div>
      </div>

      <CreatePoForm 
        requisitionId={req.id}
        userId={me.id}
        items={items}
        projectNumber={req.project.projectNumber || ''}
        customerName={req.project.quote.customer.displayName}
      />
    </div>
  );
}
