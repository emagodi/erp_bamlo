import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7*24*3600*1000);
  const projects = await prisma.project.findMany({
    where: { commenceOn: { gte: in7, lt: new Date(in7.getTime() + 24*3600*1000) } },
    include: { quote: { select: { id: true, number: true } } },
  });
  projects.forEach(p => console.log(`[REMINDER] Project ${p.quote?.number ?? p.quoteId} starts in ~1 week`));
  return NextResponse.json({ ok: true, count: projects.length });
}

