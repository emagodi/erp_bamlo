import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const today = new Date();

  // Mark overdue
  await prisma.paymentSchedule.updateMany({
    where: { status: { in: ['DUE', 'PARTIAL'] }, dueOn: { lt: today } },
    data: { status: 'OVERDUE' },
  });

  // Create reminder rows
  const dueSoon = await prisma.paymentSchedule.findMany({
    where: {
      status: { in: ['DUE', 'PARTIAL', 'OVERDUE'] },
      dueOn: { lte: new Date(today.getTime() + 7 * 86400000) },
    },
    include: { project: { include: { quote: { select: { number: true } } } } },
    take: 200,
  });

  const toInsert = [];
  for (const s of dueSoon) {
    const kind = s.status === 'OVERDUE' ? 'OVERDUE' : 'UPCOMING';
    // naive: don’t duplicate same reminder in 24h
    const recent = await prisma.paymentReminder.findFirst({
      where: { scheduleId: s.id, kind, sentAt: { gte: new Date(Date.now() - 24 * 3600000) } },
      select: { id: true },
    });
    if (!recent) toInsert.push({ scheduleId: s.id, kind });
  }
  if (toInsert.length) await prisma.paymentReminder.createMany({ data: toInsert });

  // (Hook up your email/SMS here.)
  return NextResponse.json({ ok: true, created: toInsert.length });
}
