import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createScheduleTaskReport } from '../projects/actions';
import { revalidatePath } from 'next/cache';

export default async function MyTasksPage() {
  const user = await getCurrentUser();
  if (!user) return <div className="p-6">Auth required</div>;

  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!employee) return <div className="p-6">No employee profile found.</div>;

  const today = new Date();
  const tasks = await prisma.scheduleItem.findMany({
    where: {
      assignees: { some: { id: employee.id } },
      plannedStart: { lte: today },
      status: { not: 'DONE' },
    },
    include: {
      schedule: { include: { project: { include: { quote: { select: { customer: true } } } } } },
    },
    orderBy: { plannedStart: 'asc' },
  });

  async function submitReport(formData: FormData) {
    'use server';
    const itemId = String(formData.get('itemId'));
    const activity = String(formData.get('activity') || '');
    const usedQty = formData.get('usedQty');
    const usedUnit = String(formData.get('usedUnit') || '');
    const remainingQty = formData.get('remainingQty');
    const remainingUnit = String(formData.get('remainingUnit') || '');
    await createScheduleTaskReport(itemId, {
      activity: activity || null,
      usedQty: usedQty ? Number(usedQty) : null,
      usedUnit: usedUnit || null,
      remainingQty: remainingQty ? Number(remainingQty) : null,
      remainingUnit: remainingUnit || null,
    });
    revalidatePath('/my-tasks');
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">My Tasks (Day End)</h1>
      {tasks.length === 0 ? (
        <div className="text-sm text-gray-600">No tasks scheduled for today.</div>
      ) : (
        tasks.map((t) => (
          <div key={t.id} className="rounded border bg-white p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <div>
                <div className="font-semibold">{t.title}</div>
                <div className="text-gray-600">
                  {t.unit ?? '-'} · Qty: {t.quantity ?? '-'} · Start:{' '}
                  {t.plannedStart ? new Date(t.plannedStart).toLocaleDateString() : '-'}
                </div>
                <div className="text-xs text-gray-500">
                  Site:{' '}
                  {t.schedule.project.quote.customer?.city
                    ? `${t.schedule.project.quote.customer.city} (${t.schedule.project.quote.customer.displayName})`
                    : t.schedule.project.quote.customer?.displayName ?? '-'}
                </div>
              </div>
              <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                Status: {t.status ?? 'ACTIVE'}
              </div>
            </div>

            <form action={submitReport} className="space-y-2">
              <input type="hidden" name="itemId" value={t.id} />
              <textarea
                name="activity"
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="What did you do today?"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <input
                    name="usedQty"
                    type="number"
                    step="0.01"
                    className="w-24 rounded border px-2 py-1"
                    placeholder="Used qty"
                  />
                  <input
                    name="usedUnit"
                    className="w-24 rounded border px-2 py-1"
                    placeholder="Unit"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    name="remainingQty"
                    type="number"
                    step="0.01"
                    className="w-24 rounded border px-2 py-1"
                    placeholder="Remaining qty"
                  />
                  <input
                    name="remainingUnit"
                    className="w-24 rounded border px-2 py-1"
                    placeholder="Unit"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="rounded bg-emerald-600 px-3 py-1 text-white text-sm hover:bg-emerald-700"
              >
                Submit report
              </button>
            </form>
          </div>
        ))
      )}
    </div>
  );
}
