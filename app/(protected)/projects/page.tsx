import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import { redirect } from 'next/navigation';
import clsx from 'clsx';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';

import { SearchInput } from '@/components/ui/search-input';
import PaymentsTableToolbar from './components/PaymentsTableToolbar';
import QuotePagination from '@/app/(protected)/quotes/components/QuotePagination';
import { Prisma } from '@prisma/client';

import { ProjectAssigner } from './project-assigner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 20;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tab?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;
  
  try {
    assertRoles(me.role as any, [
      'ADMIN','CLIENT','VIEWER','PROJECT_MANAGER','SENIOR_PM','PROCUREMENT','SENIOR_PROCUREMENT','SECURITY','ACCOUNTS','CASHIER','ACCOUNTING_OFFICER','ACCOUNTING_AUDITOR','ACCOUNTING_CLERK','DRIVER','GENERAL_MANAGER','MANAGING_DIRECTOR','SALES_ACCOUNTS',
    ] as any);
  } catch {
    redirect('/dashboard');
  }

  const role = me.role as string;
  const isSeniorPM = ['SENIOR_PM', 'ADMIN', 'GENERAL_MANAGER', 'MANAGING_DIRECTOR'].includes(role);
  const isProjectManager = role === 'PROJECT_MANAGER';
  const isSalesAccounts = role === 'SALES_ACCOUNTS';

  const { q: query, page: pageParam, tab, limit: limitParam, type: typeParam } = await searchParams;
  const currentPage = parseInt(pageParam || '1', 10);
  const pageSize = parseInt(limitParam || String(DEFAULT_PAGE_SIZE), 10);
  const skip = (currentPage - 1) * pageSize;
  
  let currentTab = 'active';
  if (isSeniorPM) {
    currentTab = 'assignment';
  } else if (isSalesAccounts) {
    currentTab = tab === 'all_payments' ? 'all_payments' : 'due_today';
  }

  const baseWhere: Prisma.ProjectWhereInput = {
    ...(query ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { projectNumber: { contains: query, mode: 'insensitive' } },
          { quote: { customer: { displayName: { contains: query, mode: 'insensitive' } } } },
          { quote: { customer: { city: { contains: query, mode: 'insensitive' } } } },
        ],
      } : {}),
    // Delegation Filter for regular PMs:
    ...(isProjectManager ? { assignedToId: me.id } : {}),
  };

  let where = baseWhere;
  
  // Specific Filters for Senior PM Tabs
  if (isSeniorPM) {
     if (currentTab === 'assignment') {
         where = {
             ...baseWhere,
             assignedToId: null, // Only unassigned
             status: { notIn: ['CREATED', 'COMPLETED', 'CLOSED'] } // Ready for assignment
         };
     } else if (currentTab === 'planning') {
         where = {
             ...baseWhere,
             status: 'CREATED' // Needs planning/scheduling
         };
     } else {
         where = {
             ...baseWhere,
             assignedToId: { not: null } // Only assigned (Active)
         };
     }
  } else if (isSalesAccounts) {
    if (currentTab === 'due_today') {
       const today = new Date();
       today.setHours(23, 59, 59, 999);
       where = {
         ...baseWhere,
         paymentSchedules: {
           some: {
             dueOn: { lte: today },
             status: { not: 'PAID' }
           }
         }
       };
    }
    // 'all_payments' uses baseWhere (all projects)
  }

  const [projects, totalCount, projectManagers] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // PLANNED comes before ONGOING usually, or alphabetical. 
        // We might want to ensure Locked (CREATED) are clearly visible or last? 
        // Default sort 'asc' puts CREATED first? Enum order matters if sorting by enum. 
        // Let's stick to status then date.
        { createdAt: 'desc' },
      ],
      include: {
        quote: { 
          select: { 
            number: true, 
            customer: { select: { displayName: true, city: true } },
            createdBy: { select: { name: true, email: true } }
          } 
        },
        paymentSchedules: { select: { amountMinor: true, paidMinor: true, status: true, dueOn: true, label: true, seq: true } },
        clientPayments: { select: { amountMinor: true, type: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      take: pageSize,
      skip,
    }),
    prisma.project.count({ where }),
    // Fetch potential PMs ONLY if Senior PM (needed for assignment)
    isSeniorPM ? prisma.user.findMany({
      where: { role: 'PROJECT_MANAGER' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }) : Promise.resolve([]),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            {!isSalesAccounts && (
              <p className="mt-2 text-sm text-gray-600">
                {isSeniorPM ? 'This will just show unassigned projects' : 'Manage and track all your construction projects'}
              </p>
            )}
          </div>
          <div className="w-full sm:max-w-xs">
            <SearchInput placeholder="Search projects..." />
          </div>
        </div>



        {isSalesAccounts ? (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4">
              <PaymentsTableToolbar />
            </div>
            <div className="overflow-x-auto px-4 pb-2">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      REF
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      PROJECT
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      LOCATION
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      TYPE
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      DUE AMOUNT
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      ACTION(S)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {projects.length === 0 ? (
                    <tr>
                      <td className="px-6 py-8 text-center text-sm text-gray-500" colSpan={6}>
                        {currentTab === 'due_today' ? 'No payments due today.' : 'No projects found.'}
                      </td>
                    </tr>
                  ) : (
                    projects.map((project) => {
                      const schedules = (project as any).paymentSchedules || [];
                      const payments = (project as any).clientPayments || [];
                      const depositPaidByPayments = payments
                        .filter((p: any) => p.type === 'DEPOSIT')
                        .reduce((sum: number, p: any) => sum + Number(p.amountMinor ?? 0), 0);
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);
                      const depositItem = schedules.find((s: any) => String(s.label || '').toLowerCase().includes('deposit')) || null;
                      const depositBal = depositItem
                        ? Math.max(
                            0,
                            Number(depositItem.amountMinor ?? 0) -
                              Math.max(Number(depositItem.paidMinor ?? 0), depositPaidByPayments)
                          )
                        : Math.max(0, Number((project as any).depositMinor ?? 0) - depositPaidByPayments);
                      let currentItem: any = null;
                      if (currentTab === 'due_today') {
                        // Prefer deposit if due today or earlier and unpaid, else earliest unpaid installment due today/earlier
                        if (depositItem && depositBal > 0 && new Date(depositItem.dueOn) <= today && depositItem.status !== 'PAID') {
                          currentItem = depositItem;
                        } else {
                          currentItem = schedules
                            .filter((s: any) => s.status !== 'PAID' && new Date(s.dueOn) <= today)
                            .sort((a: any, b: any) => new Date(a.dueOn).getTime() - new Date(b.dueOn).getTime())[0] || null;
                        }
                      } else {
                        // Other Payments: if deposit unpaid, show deposit; otherwise show next unpaid installment
                        if (depositItem && depositBal > 0 && depositItem.status !== 'PAID') {
                          currentItem = depositItem;
                        } else {
                          currentItem = schedules
                            .filter((s: any) => s.status !== 'PAID')
                            .sort((a: any, b: any) => new Date(a.dueOn).getTime() - new Date(b.dueOn).getTime())[0] || null;
                        }
                      }
                      let dueBal = 0;
                      if (currentItem) {
                        const isDeposit = String(currentItem.label || '').toLowerCase().includes('deposit');
                        if (isDeposit) {
                          dueBal = depositBal;
                        } else {
                          dueBal = Math.max(0, Number(currentItem.amountMinor ?? 0) - Number(currentItem.paidMinor ?? 0));
                        }
                      }
                      let typeLabel = currentItem
                        ? (String(currentItem.label || '').toLowerCase().includes('deposit') ? 'Deposit' : 'Installment')
                        : '-';
                      if (!currentItem && schedules.length === 0) {
                        const dep = Math.max(0, Number((project as any).depositMinor ?? 0) - depositPaidByPayments);
                        const inst = Number((project as any).installmentMinor ?? 0);
                        if (dep > 0) {
                          dueBal = dep;
                          typeLabel = 'Deposit';
                        } else if (inst > 0) {
                          dueBal = inst;
                          typeLabel = 'Installment';
                        }
                      }
                      // Filter by type if requested
                      if (typeParam && currentItem) {
                        const isDeposit = String(currentItem.label || '').toLowerCase().includes('deposit');
                        const t = isDeposit ? 'DEPOSIT' : 'INSTALLMENT';
                        if (typeParam !== t) return null;
                      }
                      return (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {project.projectNumber || project.id.slice(0, 8)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {project.quote?.customer?.displayName || 'No customer'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {project.quote?.customer?.city || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-700">
                              {typeLabel}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dueBal / 100)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/projects/${project.id}/payments`}
                              className="inline-flex items-center justify-center rounded-md border border-transparent bg-orange-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 gap-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                              </svg>
                              Receive Payment
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Blue pagination like Quotes */}
            <div className="px-4">
              <QuotePagination total={totalCount} currentPage={currentPage} pageSize={pageSize} />
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="mt-2 text-sm font-medium text-gray-900">No projects found</h3>
            <p className="mt-1 text-sm text-gray-500">No active projects found.</p>
          </div>
        ) : isSeniorPM && currentTab === 'assignment' ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 p-4">
             <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
               <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                 <thead className="bg-gray-50 dark:bg-gray-900/50">
                   <tr>
                     <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Customer</th>
                     <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Location</th>
                     <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                     <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Logged By</th>
                     <th scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                     <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Assign PM</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                   {projects.map((project) => (
                     <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                         {project.quote?.customer?.displayName || 'Unknown'}
                       </td>
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                         {project.quote?.customer?.city || '-'}
                       </td>
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                         {new Date(project.createdAt).toLocaleDateString()}
                       </td>
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                         {(project.quote as any)?.createdBy?.name || (project.quote as any)?.createdBy?.email || '-'}
                       </td>
                       <td className="px-4 py-3 whitespace-nowrap text-center">
                         <WorkflowStatusBadge status={project.status} />
                       </td>
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                         <ProjectAssigner 
                           projectId={project.id} 
                           initialAssigneeId={project.assignedTo?.id} 
                           projectManagers={projectManagers as any}
                           variant="table"
                         />
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             <div className="mt-4">
                <QuotePagination total={totalCount} currentPage={currentPage} pageSize={pageSize} />
             </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div key={project.id} className={`group relative bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col ${
                    // Highlight actionable unassigned projects
                    isSeniorPM && currentTab === 'assignment' && project.status !== 'CREATED' ? 'border-orange-200 ring-1 ring-orange-100' : ''
                }`}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="block flex-1"
                  >
                    <div className="p-6 pb-2">
                       <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-orange-600 transition-colors">
                            {project.quote?.customer?.displayName || 'No customer'}
                          </h3>
                          <p className="mt-1 text-sm font-medium text-gray-500">
                            Ref: {project.projectNumber || project.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Status</span>
                          <WorkflowStatusBadge status={project.status} />
                        </div>

                        {project.assignedTo && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">PM</span>
                            <span className="text-xs text-gray-900">{project.assignedTo.name || project.assignedTo.email}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Start Date</span>
                          <span className="text-xs text-gray-900">
                            {new Date(project.commenceOn).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  {isSeniorPM && (
                    <div className="px-6 pb-4">
                      {project.status === 'CREATED' ? (
                         <div className="rounded bg-gray-50 px-3 py-2 text-center text-xs font-medium text-gray-500 border border-gray-200 italic">
                           Locked (Deposit Pending)
                         </div>
                      ) : (
                       <ProjectAssigner 
                         projectId={project.id} 
                         initialAssigneeId={project.assignedTo?.id} 
                         projectManagers={projectManagers as any}
                       />
                      )}
                    </div>
                  )}

                  <Link href={`/projects/${project.id}`} className="block bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 mt-auto">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-orange-50">
                        Created {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-white font-medium flex items-center gap-1">
                        View Details →
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Link
                  href={`/projects?${new URLSearchParams({ ...(query && { q: query }), ...(tab && { tab }), page: String(Math.max(1, currentPage - 1)) }).toString()}`}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  aria-disabled={currentPage === 1}
                >
                  Previous
                </Link>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    // Show first page, last page, current page, and pages around current
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <Link
                          key={pageNum}
                          href={`/projects?${new URLSearchParams({ ...(query && { q: query }), ...(tab && { tab }), page: String(pageNum) }).toString()}`}
                          className={`px-4 py-2 text-sm font-medium rounded-md ${
                            currentPage === pageNum
                              ? 'bg-orange-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </Link>
                      );
                    } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return <span key={pageNum} className="px-2 text-gray-400">...</span>;
                    }
                    return null;
                  })}
                </div>

                <Link
                  href={`/projects?${new URLSearchParams({ ...(query && { q: query }), ...(tab && { tab }), page: String(Math.min(totalPages, currentPage + 1)) }).toString()}`}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  aria-disabled={currentPage === totalPages}
                >
                  Next
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
