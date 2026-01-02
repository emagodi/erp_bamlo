import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Finds tasks past plannedEnd and not DONE; notifies their PM (createdById)
export async function GET() {
  const now = new Date();
  const overdue = await prisma.task.findMany({
    where: {
      plannedEnd: { lt: now },
      status: { not: 'DONE' },
    },
    select: { id: true, title: true, projectId: true, plannedEnd: true, createdById: true },
  });

  if (overdue.length) {
    await prisma.notification.createMany({
      data: overdue.map(t => ({
        userId: t.createdById,
        kind: 'TASK_OVERDUE',
        message: `Task "${t.title}" is overdue (planned end: ${t.plannedEnd?.toISOString().slice(0,10)})`,
      })),
    });
  }

  return NextResponse.json({ ok: true, overdue: overdue.length });
}
