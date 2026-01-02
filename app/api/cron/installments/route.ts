import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const today = new Date();
  const todayDay = today.getUTCDate();

  // Projects with a dueDay matching today, and an installment > 0
  const projects = await prisma.project.findMany({
    where: { installmentMinor: { gt: 0 }, dueDay: todayDay },
    select: { id: true, quoteId: true, installmentMinor: true },
  });

  // TODO: create reminders to Accounts (and optionally to client/contact)
  // await prisma.notification.createMany({ ... });

  return NextResponse.json({ ok: true, count: projects.length });
}
