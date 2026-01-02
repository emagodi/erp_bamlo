import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  // PENDING funding older than 1/2/3 hours -> escalate
  const now = new Date();
  const cut1 = new Date(now.getTime() - 60 * 60 * 1000);
  const cut2 = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const cut3 = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  const pending = await prisma.fundingRequest.findMany({
    where: { status: 'PENDING' },
    include: { requisition: { include: { project: true } } },
  });

  // Decide who to notify at each threshold; plug in your notifier (email/slack/db Notification)
  const notifications: any[] = [];

  for (const fr of pending) {
    const age = fr.createdAt;
    const projectId = fr.requisition.projectId;
    if (age < cut3) {
      notifications.push({ level: 'ESCALATE_ALL', projectId, fundingId: fr.id });
    } else if (age < cut2) {
      notifications.push({ level: 'REMINDER_3', projectId, fundingId: fr.id });
    } else if (age < cut1) {
      notifications.push({ level: 'REMINDER_2', projectId, fundingId: fr.id });
    } else {
      notifications.push({ level: 'REMINDER_1', projectId, fundingId: fr.id });
    }
  }

  // TODO: send notifications. For now just log to DB table if you have one.
  // await prisma.notification.createMany({ data: ... });

  return NextResponse.json({ ok: true, count: notifications.length });
}
