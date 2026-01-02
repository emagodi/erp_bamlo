import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import { redirect } from 'next/navigation';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';

import { SearchInput } from '@/components/ui/search-input';
import { Prisma } from '@prisma/client';

import { ProjectAssigner } from './project-assigner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ITEMS_PER_PAGE = 6;

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

  const { q: query, page: pageParam, tab } = await searchParams;
  const currentPage = parseInt(pageParam || '1', 10);
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;
  
  const currentTab = isSeniorPM ? (tab === 'assignment' ? 'assignment' : 'active') : 'active';

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
         };
     } else {
         where = {
             ...baseWhere,
             assignedToId: { not: null } // Only assigned (Active)
         };
     }
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
          } 
        },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      take: ITEMS_PER_PAGE,
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage and track all your construction projects
            </p>
          </div>
          <div className="w-full sm:max-w-xs">
            <SearchInput placeholder="Search projects..." />
          </div>
        </div>

        {isSeniorPM && (
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <Link
                  href="/projects?tab=active"
                  className={`${
                    currentTab === 'active'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Active Projects
                </Link>
                <Link
                  href="/projects?tab=assignment"
                  className={`${
                    currentTab === 'assignment'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Assign Project Manager
                </Link>
              </nav>
            </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
             {/* Empty State */}
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No projects found</h3>
            <p className="mt-1 text-sm text-gray-500">
                {isSeniorPM && currentTab === 'assignment' 
                    ? "No projects pending assignment." 
                    : "No active projects found."}
            </p>
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
