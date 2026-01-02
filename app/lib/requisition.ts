// lib/requisition.ts
import { prisma } from '@/lib/db';

export async function getProjectQuoteLinesWithRemaining(projectId: string) {
  // 1. get the project with quote lines
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      quote: {
        include: {
          lines: true,
        },
      },
    },
  });
  if (!project || !project.quote) return [];

  const quoteLines = project.quote.lines;

  // 2. get ALL requisition items for this project
  const reqItems = await prisma.procurementRequisitionItem.findMany({
    where: {
      requisition: {
        projectId,
        // optionally ignore cancelled requisitions:
        status: { not: 'CANCELLED' },
      },
    },
    select: {
      quoteLineId: true,
      qtyRequested: true,
    },
  });

  // 3. build a map: quoteLineId -> alreadyRequested
  const requestedByLine = new Map<string, number>();
  for (const ri of reqItems) {
    if (!ri.quoteLineId) continue;
    const prev = requestedByLine.get(ri.quoteLineId) ?? 0;
    requestedByLine.set(ri.quoteLineId, prev + (ri.qtyRequested ?? 0));
  }

  // 4. merge
  return quoteLines.map((ql) => {
    let unit: string | null = (ql as any).unit ?? null;
    if (!unit) {
      try {
        const meta = (ql as any).metaJson ? JSON.parse((ql as any).metaJson) : null;
        if (typeof meta?.unit === 'string' && meta.unit.trim().length) unit = meta.unit;
      } catch {}
    }
    const quoteQty = Number(ql.quantity ?? 0);
    const already = requestedByLine.get(ql.id) ?? 0;
    const remaining = Math.max(quoteQty - already, 0);
    return {
      quoteLineId: ql.id,
      description: ql.description,
      unit: unit ?? '-',
      quoteQty,
      alreadyRequested: already,
      remaining,
      // if you still need unit price/minor etc you can pass here
      unitPriceMinor: ql.unitPriceMinor,
    };
  });
}
