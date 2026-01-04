// app/(protected)/projects/[projectId]/daily-tasks/[itemId]/page.tsx
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createScheduleTaskReport, updateScheduleItemStatus } from '@/app/(protected)/projects/actions';
import SubmitButton from '@/components/SubmitButton';

export default async function TaskReportPage({
  params,
}: {
  params: Promise<{ projectId: string; itemId: string }>;
}) {
  const { projectId, itemId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!['PM_CLERK', 'PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN'].includes(user.role as string)) {
    return <div className="p-6">Not authorized</div>;
  }

  const item = await prisma.scheduleItem.findUnique({
    where: { id: itemId },
    include: {
      schedule: {
        select: {
          projectId: true,
          project: {
            select: {
              quote: { select: { number: true } },
            },
          },
        },
      },
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
        take: 5,
        include: {
          reporter: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!item || item.schedule.projectId !== projectId) return notFound();

  const workers = item.assignees
    .map((a) => [a.givenName, a.surname].filter(Boolean).join(' '))
    .join(', ') || 'No workers assigned';

  // Calculate total completed from all reports
  const totalCompleted = item.reports.reduce((sum, r) => sum + (r.usedQty || 0), 0);
  const remaining = Math.max(0, (item.quantity || 0) - totalCompleted);

  const submitReport = async (formData: FormData) => {
    'use server';
    const activity = String(formData.get('activity') || '');
    const usedQty = Number(formData.get('usedQty') || 0);
    const usedUnit = String(formData.get('usedUnit') || item.unit || '');
    const remainingQty = Number(formData.get('remainingQty') || 0);
    const remainingUnit = String(formData.get('remainingUnit') || item.unit || '');
    const newStatus = String(formData.get('status') || 'ACTIVE') as 'ACTIVE' | 'ON_HOLD' | 'DONE';

    await createScheduleTaskReport(itemId, {
      activity,
      usedQty,
      usedUnit,
      remainingQty,
      remainingUnit,
    });

    if (newStatus !== item.status) {
      await updateScheduleItemStatus(itemId, newStatus);
    }

    redirect(`/projects/${projectId}/daily-tasks`);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Report Progress</h1>
          <p className="text-sm text-gray-600">
            {item.schedule.project.quote?.number} • {new Date().toLocaleDateString()}
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/daily-tasks`}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Tasks
        </Link>
      </div>

      {/* Task Info Card */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{item.title}</h2>
        {item.description && <p className="text-sm text-gray-600 mt-1">{item.description}</p>}

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Planned Quantity:</span>
            <div className="font-semibold">
              {item.quantity} {item.unit}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Completed So Far:</span>
            <div className="font-semibold">
              {totalCompleted.toFixed(2)} {item.unit}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Remaining:</span>
            <div className="font-semibold">
              {remaining.toFixed(2)} {item.unit}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Workers Assigned:</span>
            <div className="font-semibold text-xs">{workers}</div>
          </div>
          <div>
            <span className="text-gray-600">Planned Duration:</span>
            <div className="font-semibold">
              {item.plannedStart ? new Date(item.plannedStart).toLocaleDateString() : '-'} →{' '}
              {item.plannedEnd ? new Date(item.plannedEnd).toLocaleDateString() : '-'}
            </div>
          </div>
          <div>
            <span className="text-gray-600">Current Status:</span>
            <div>
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
          </div>
        </div>
      </div>

      {/* Report Form */}
      <form action={submitReport} className="rounded-lg border bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold">Today&apos;s Progress Report</h3>

        <div>
          <label htmlFor="activity" className="block text-sm font-medium text-gray-700 mb-1">
            Activity / What was done today *
          </label>
          <textarea
            id="activity"
            name="activity"
            rows={3}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="e.g., Laid bricks on north wall, excavated foundation trench..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="usedQty" className="block text-sm font-medium text-gray-700 mb-1">
              Quantity Completed Today *
            </label>
            <input
              type="number"
              id="usedQty"
              name="usedQty"
              step="0.01"
              min="0"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g., 500"
            />
          </div>
          <div>
            <label htmlFor="usedUnit" className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <input
              type="text"
              id="usedUnit"
              name="usedUnit"
              defaultValue={item.unit || ''}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-50"
              readOnly
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="remainingQty" className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Remaining Quantity
            </label>
            <input
              type="number"
              id="remainingQty"
              name="remainingQty"
              step="0.01"
              min="0"
              defaultValue={remaining}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="remainingUnit" className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <input
              type="text"
              id="remainingUnit"
              name="remainingUnit"
              defaultValue={item.unit || ''}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-50"
              readOnly
            />
          </div>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Task Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={item.status}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ACTIVE">Active - Work continuing</option>
            <option value="ON_HOLD">On Hold - Temporarily stopped</option>
            <option value="DONE">Done - Task completed</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Link
            href={`/projects/${projectId}/daily-tasks`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <SubmitButton
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            loadingText="Submitting..."
          >
            Submit Report
          </SubmitButton>
        </div>
      </form>

      {/* Previous Reports */}
      {item.reports.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Recent Reports</h3>
          <div className="space-y-3">
            {item.reports.map((report) => (
              <div key={report.id} className="rounded border border-gray-200 p-3 text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {new Date(report.reportedForDate).toLocaleDateString()}
                    </div>
                    <div className="text-gray-600 text-xs">
                      Reported by: {report.reporter?.name || 'Unknown'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-indigo-600">
                      {report.usedQty} {report.usedUnit}
                    </div>
                    <div className="text-xs text-gray-500">completed</div>
                  </div>
                </div>
                {report.activity && (
                  <div className="mt-2 text-gray-700">{report.activity}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
