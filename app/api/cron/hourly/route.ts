import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const pendings = await prisma.fundingRequest.findMany({
    where: { status: 'PENDING' },
    include: { requisition: { include: { project: true } } },
  });
  for (const f of pendings) {
    const p = f.requisition.project;
    console.log(`[SLA] Funding pending for project ${p.quoteId}`);
    const next = p.alertsCount + 1;
    if (next >= 3) {
      console.log(`[ESCALATION] Notify Heads for project ${p.quoteId}`);
    }
    await prisma.project.update({ where: { id: p.id }, data: { alertsCount: next }});
  }
  return NextResponse.json({ ok: true, reminded: pendings.length });
}

