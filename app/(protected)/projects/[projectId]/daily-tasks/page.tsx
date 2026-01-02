// app/(protected)/projects/[projectId]/daily-tasks/page.tsx
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { fromMinor } from '@/helpers/money';

export default async function DailyTasksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Only PM_CLERK, PROJECT_MANAGER, and ADMIN can access
  if (!['PM_CLERK', 'PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN'].includes(user.role as string)) {
    return <div className="p-6">Not authorized</div>;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      quote: { select: { number: true } },
    },
  });

  if (!project) return notFound();

  const schedule = await prisma.schedule.findUnique({
    where: { projectId },
    include: {
      items: {
        where: {
          status: { not: 'DONE' },
          plannedStart: { lte: new Date() },
        },
        include: {
          assignees: {
            select: {
              id: true,
              givenName: true,
              surname: true,
              role: true,
            },
          },
          quoteLine: {
            select: {
              metaJson: true,
            },
          },
          reports: {
            orderBy: { reportedForDate: 'desc' },
            take: 1,
            include: {
              reporter: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { plannedStart: 'asc' },
      },
    },
  });

  if (!schedule || schedule.items.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Daily Tasks</h1>
            <p className="text-sm text-gray-600">
              Project: {project.quote?.number ?? projectId}
            </p>
          </div>
          <Link
            href={`/projects/${projectId}`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Project
          </Link>
        </div>
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            No active tasks found. Tasks will appear here once they have started (plannedStart date has arrived) and are not yet completed.
          </p>
        </div>
      </div>
    );
  }

  // Group tasks by category
  const getCategory = (item: any) => {
    try {
      const meta = item.quoteLine?.metaJson;
      if (typeof meta === 'string') {
        const parsed = JSON.parse(meta);
        return parsed?.section || parsed?.category || 'Uncategorized';
      }
    } catch {}
    return 'Uncategorized';
  };

  const grouped = schedule.items.reduce((acc, item) => {
    const category = getCategory(item);
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof schedule.items>);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Daily Tasks - End of Day Reporting</h1>
          <p className="text-sm text-gray-600">
            Project: {project.quote?.number ?? projectId} • {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/projects/${projectId}/reports`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View All Reports
          </Link>
          <Link
            href={`/projects/${projectId}`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Project
          </Link>
        </div>
      </div>

      <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">End of Day Reporting</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Report progress on active tasks. Enter quantities completed, materials used, and update task status.
                This helps track actual progress against planned work.
              </p>
            </div>
          </div>
        </div>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">
            {category}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const lastReport = item.reports[0];
              const workers = item.assignees.map((a: any) =>
                [a.givenName, a.surname].filter(Boolean).join(' ')
              ).join(', ') || 'No workers assigned';

              return (
                <div
                  key={item.id}
                  className="rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        item.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : item.status === 'ON_HOLD'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Planned Quantity:</span>
                      <span className="font-medium">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Workers:</span>
                      <span className="font-medium text-xs">{workers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Planned:</span>
                      <span className="font-medium">
                        {item.plannedStart ? new Date(item.plannedStart).toLocaleDateString() : '-'} →{' '}
                        {item.plannedEnd ? new Date(item.plannedEnd).toLocaleDateString() : '-'}
                      </span>
                    </div>
                  </div>

                  {lastReport && (
                    <div className="mt-3 rounded bg-gray-50 p-2 text-xs">
                      <div className="font-medium text-gray-700">Last Report:</div>
                      <div className="text-gray-600">
                        {new Date(lastReport.reportedForDate).toLocaleDateString()} by{' '}
                        {lastReport.reporter?.name || 'Unknown'}
                      </div>
                      {lastReport.usedQty && (
                        <div className="text-gray-600">
                          Completed: {lastReport.usedQty} {lastReport.usedUnit}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4">
                    <Link
                      href={`/projects/${projectId}/daily-tasks/${item.id}`}
                      className="block w-full rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Report Progress
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
