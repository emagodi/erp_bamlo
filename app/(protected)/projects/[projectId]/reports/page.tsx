// app/(protected)/projects/[projectId]/reports/page.tsx
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import PrintButton from '@/components/PrintButton';
import PrintHeader from '@/components/PrintHeader';
import ExcelExportButton from '@/components/ExcelExportButton';

export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

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
        include: {
          assignees: {
            select: {
              id: true,
              givenName: true,
              surname: true,
            },
          },
          reports: {
            orderBy: { reportedForDate: 'desc' },
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

  if (!schedule) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Progress Reports</h1>
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
            No schedule found for this project. Create a schedule first to start tracking progress.
          </p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalTasks = schedule.items.length;
  const doneTasks = schedule.items.filter((i) => i.status === 'DONE').length;
  const activeTasks = schedule.items.filter((i) => i.status === 'ACTIVE').length;
  const onHoldTasks = schedule.items.filter((i) => i.status === 'ON_HOLD').length;
  const totalReports = schedule.items.reduce((sum, item) => sum + item.reports.length, 0);

  // Calculate progress for each task
  const tasksWithProgress = schedule.items.map((item) => {
    const totalCompleted = item.reports.reduce((sum, r) => sum + (r.usedQty || 0), 0);
    const planned = item.quantity || 0;
    const progress = planned > 0 ? (totalCompleted / planned) * 100 : 0;
    const remaining = Math.max(0, planned - totalCompleted);
    const variance = totalCompleted - planned;

    return {
      ...item,
      totalCompleted,
      progress: Math.min(100, progress),
      remaining,
      variance,
      isAhead: variance > 0,
      isBehind: progress < 100 && item.status === 'ACTIVE' && item.plannedEnd && new Date(item.plannedEnd) < new Date(),
    };
  });

  const behindSchedule = tasksWithProgress.filter((t) => t.isBehind).length;

  return (
    <div className="p-6 space-y-6">
      <PrintHeader />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Progress Reports & Analytics</h1>
          <p className="text-sm text-gray-600">
            Project: {project.quote?.number ?? projectId}
          </p>
        </div>
        <div className="flex gap-2">
          {['PM_CLERK', 'PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN'].includes(user.role as string) && (
            <Link
              href={`/projects/${projectId}/daily-tasks`}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Daily Tasks
            </Link>
          )}
          <Link
            href={`/projects/${projectId}`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Project
          </Link>
          <ExcelExportButton tasks={tasksWithProgress} projectName={project.quote?.number ?? projectId} />
          <PrintButton />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Total Tasks</div>
          <div className="text-3xl font-bold text-gray-900">{totalTasks}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Active</div>
          <div className="text-3xl font-bold text-green-600">{activeTasks}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Completed</div>
          <div className="text-3xl font-bold text-blue-600">{doneTasks}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Behind Schedule</div>
          <div className="text-3xl font-bold text-red-600">{behindSchedule}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-600">Total Reports</div>
          <div className="text-3xl font-bold text-indigo-600">{totalReports}</div>
        </div>
      </div>

      {/* Progress Table */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Task Progress Tracking</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Task</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Planned</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Completed</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Remaining</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Progress</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Last Report</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Workers</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasksWithProgress.map((task) => {
                const lastReport = task.reports[0];
                const workers = task.assignees
                  .map((a) => [a.givenName, a.surname].filter(Boolean).join(' '))
                  .join(', ') || '-';

                return (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-gray-500">{task.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          task.status === 'DONE'
                            ? 'bg-blue-100 text-blue-800'
                            : task.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {task.status}
                      </span>
                      {task.isBehind && (
                        <div className="text-xs text-red-600 mt-1">Behind schedule</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {task.quantity} {task.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {task.totalCompleted.toFixed(2)} {task.unit}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {task.remaining.toFixed(2)} {task.unit}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              task.progress >= 100
                                ? 'bg-blue-600'
                                : task.progress >= 75
                                  ? 'bg-green-600'
                                  : task.progress >= 50
                                    ? 'bg-yellow-600'
                                    : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(100, task.progress)}%` }}
                          />
                        </div>
                        <span className="font-medium">{task.progress.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lastReport ? (
                        <div>
                          <div className="text-xs text-gray-600">
                            {new Date(lastReport.reportedForDate).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            by {lastReport.reporter?.name || 'Unknown'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">No reports</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{workers}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
