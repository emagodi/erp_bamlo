import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

const HEAD_ROLES = ['ADMIN', 'PROJECT_MANAGER', 'SENIOR_QS', 'GENERAL_MANAGER', 'MANAGING_DIRECTOR', 'ACCOUNTS'];

export async function GET() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const pendingFunding = await prisma.fundingRequest.findMany({
    where: {
      status: 'PENDING',
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lte: oneHourAgo } }],
    },
    include: {
      requisition: {
        include: { project: { include: { quote: true } } },
      },
    },
  });

  for (const request of pendingFunding) {
    const newCount = (request.reminderCount ?? 0) + 1;
    console.log('[reminder] funding request pending', {
      fundingRequestId: request.id,
      requisitionId: request.requisitionId,
      amountMinor: request.amountMinor,
      reminderCount: newCount,
    });

    await prisma.fundingRequest.update({
      where: { id: request.id },
      data: { lastReminderAt: now, reminderCount: newCount },
    });

    if (newCount >= 4) {
      console.log('[escalation] funding sla', {
        fundingRequestId: request.id,
        notifyRoles: HEAD_ROLES,
      });
    }
  }

  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfTargetDay = new Date(Date.UTC(
    sevenDaysFromNow.getUTCFullYear(),
    sevenDaysFromNow.getUTCMonth(),
    sevenDaysFromNow.getUTCDate(),
    0,
    0,
    0,
  ));
  const endOfTargetDay = new Date(startOfTargetDay.getTime() + 24 * 60 * 60 * 1000);

  const commencingSoon = await prisma.project.findMany({
    where: {
      status: 'PLANNED',
      commenceOn: { gte: startOfTargetDay, lt: endOfTargetDay },
    },
    include: { quote: true },
  });

  for (const project of commencingSoon) {
    console.log('[reminder] project commence T-7', {
      projectId: project.id,
      commenceOn: project.commenceOn,
      quote: project.quote?.number,
    });
  }

  const projectsForInstallments = await prisma.project.findMany({
    where: {
      status: { in: ['PLANNED', 'READY', 'ONGOING'] },
    },
    select: { id: true, installmentDueDay: true },
  });

  const dueSoon: { projectId: string; dueDay: number }[] = [];
  const today = now.getUTCDate();

  for (const project of projectsForInstallments) {
    const dueDay = project.installmentDueDay ?? 1;
    const daysUntilDue = dueDay - today;
    if (daysUntilDue === 3 || daysUntilDue === 0) {
      dueSoon.push({ projectId: project.id, dueDay });
      console.log('[reminder] installment due', {
        projectId: project.id,
        dueDay,
        notify: ['ACCOUNTS'],
      });
    }
  }

  return NextResponse.json({
    ok: true,
    fundingReminders: pendingFunding.length,
    commenceTMinus7: commencingSoon.length,
    installmentReminders: dueSoon.length,
  });
}
