// app/(protected)/projects/[projectId]/helpers/pnl.ts
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fromMinor } from '@/helpers/money'; // your existing money helper

type LinePnL = {
  lineId: string;
  section: string;
  description: string;
  unit?: string | null;
  qtyOrdered: number;          // required/quoted qty
  quotedUnitMinor: bigint;     // unit price in minor
  quotedTotalMinor: bigint;    // quoted total (qty * unit)
  purchasedQty: number;        // sum of purchased qty mapped to this line
  purchasedTotalMinor: bigint; // sum of purchase prices (minor)
  avgPurchaseUnitMinor?: bigint | null; // if purchasedQty > 0
  pnlMinor: bigint;            // quotedTotalMinor - purchasedTotalMinor
  extraRequestedQty?: number;
  approvedExtraQty?: number;
};

export async function buildProjectPnL(projectId: string): Promise<{
  quoteId: string | null;
  lines: LinePnL[];
  sections: Record<string, { lines: LinePnL[]; sectionTotalMinor: bigint; sectionPnlMinor: bigint }>;
  grandQuotedMinor: bigint;
  grandPurchasedMinor: bigint;
  grandPnlMinor: bigint;
}> {
  // Find project's quote
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, quoteId: true },
  });
  if (!project) throw new Error('Project not found');

  if (!project.quoteId) {
    return {
      quoteId: null,
      lines: [],
      sections: {},
      grandQuotedMinor: 0n,
      grandPurchasedMinor: 0n,
      grandPnlMinor: 0n,
    };
  }

  const quoteId = project.quoteId;

  // Fetch lines (include metaJson to get section/category)
  const lines = await prisma.quoteLine.findMany({
    where: { quoteId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      description: true,
      unit: true,
      quantity: true,
      unitPriceMinor: true,
      lineTotalMinor: true,
      metaJson: true,
    },
  });

  const lineIds = lines.map((l) => l.id);

  // Fetch purchases that are linked to requisition items which reference these quote lines,
  // and also purchases that have direct quoteLineId (if your schema records it)
  // We aggregate purchases grouped by quoteLineId (when available) and also try to map via requisitionItem -> quoteLineId.
  // 1) purchases with direct relation (p.requisitionItem.requisitionItem.quoteLineId)
  const purchases = await prisma.purchase.findMany({
    where: {
      OR: [
        // purchases with requisitionItem -> quoteLineId
        {
          requisitionItem: {
            quoteLineId: { in: lineIds },
          },
        },
        // if your purchase model has a direct quoteLineId (uncommon), include it:
        // { quoteLineId: { in: lineIds } as any } // enable if you have this field
      ],
    },
    include: {
      requisitionItem: { select: { quoteLineId: true } },
    },
  });

  // Reduce purchases aggregated by quoteLineId
  const purchasedByLine = new Map<string, { qty: number; totalMinor: bigint }>();
  for (const p of purchases) {
    const qid = p.requisitionItem?.quoteLineId ?? null;
    if (!qid) continue;
    const prev = purchasedByLine.get(qid) ?? { qty: 0, totalMinor: 0n };
    const qty = Number(p.qty ?? 0);
    const priceMinor = BigInt(p.priceMinor ?? 0n);
    purchasedByLine.set(qid, { qty: prev.qty + qty, totalMinor: prev.totalMinor + priceMinor });
  }

  const extraRequestedByLine = new Map<string, number>();
  const extraRows = await prisma.procurementRequisitionItem.groupBy({
    by: ['quoteLineId'],
    where: {
      quoteLineId: { in: lineIds },
      extraRequestedQty: { gt: 0 },
    },
    _sum: { extraRequestedQty: true },
  });
  for (const row of extraRows) {
    if (!row.quoteLineId) continue;
    extraRequestedByLine.set(row.quoteLineId, Number(row._sum.extraRequestedQty ?? 0));
  }

  const approvedExtraByLine = new Map<string, number>();
  const approvedRows = await prisma.quoteLineExtraRequest.groupBy({
    by: ['quoteLineId'],
    where: {
      projectId,
      quoteLineId: { in: lineIds },
      status: 'APPROVED',
    },
    _sum: { qty: true },
  });
  for (const row of approvedRows) {
    if (!row.quoteLineId) continue;
    approvedExtraByLine.set(row.quoteLineId, Number(row._sum.qty ?? 0));
  }

  // Build line-level objects
  const linePnls: LinePnL[] = [];
  for (const l of lines) {
    const section = (() => {
      if (typeof l.metaJson === 'string') {
        try {
          const m = JSON.parse(l.metaJson || '{}') as Record<string, any>;
          return (m.section || m.category || 'Uncategorized') as string;
        } catch {
          return 'Uncategorized';
        }
      }

      if (l.metaJson && typeof l.metaJson === 'object') {
        const m = l.metaJson as Record<string, any>;
        return (m.section || m.category || 'Uncategorized') as string;
      }

      return 'Uncategorized';
    })();

    const approvedExtraQty = approvedExtraByLine.get(l.id) ?? 0;
    const qtyOrdered = Number(l.quantity ?? 0) + approvedExtraQty;
    const quotedUnitMinor = BigInt(l.unitPriceMinor ?? 0);

    const quotedTotalMinor =
      l.lineTotalMinor != null
        ? BigInt(l.lineTotalMinor)
        : BigInt(Math.round(qtyOrdered * Number(quotedUnitMinor)));

    const purchased = purchasedByLine.get(l.id) ?? { qty: 0, totalMinor: 0n };
    const avgPurchaseUnitMinor =
      purchased.qty > 0 ? BigInt(Math.round(Number(purchased.totalMinor) / purchased.qty)) : null;

    const pnlMinor = quotedTotalMinor - purchased.totalMinor;

    linePnls.push({
      lineId: l.id,
      section,
      description: l.description,
      unit: l.unit ?? null,
      qtyOrdered,
      quotedUnitMinor,
      quotedTotalMinor,
      purchasedQty: purchased.qty,
      purchasedTotalMinor: purchased.totalMinor,
      avgPurchaseUnitMinor,
      pnlMinor,
      extraRequestedQty: extraRequestedByLine.get(l.id) ?? 0,
      approvedExtraQty,
    });
  }

  // group sections and aggregate
  const sections: Record<string, { lines: LinePnL[]; sectionTotalMinor: bigint; sectionPnlMinor: bigint }> = {};
  let grandQuotedMinor = 0n;
  let grandPurchasedMinor = 0n;
  let grandPnlMinor = 0n;

  for (const ln of linePnls) {
    const sec = ln.section || 'Uncategorized';
    if (!sections[sec]) sections[sec] = { lines: [], sectionTotalMinor: 0n, sectionPnlMinor: 0n };
    sections[sec].lines.push(ln);
    sections[sec].sectionTotalMinor += ln.quotedTotalMinor;
    sections[sec].sectionPnlMinor += ln.pnlMinor;

    grandQuotedMinor += ln.quotedTotalMinor;
    grandPurchasedMinor += ln.purchasedTotalMinor;
    grandPnlMinor += ln.pnlMinor;
  }

  return {
    quoteId,
    lines: linePnls,
    sections,
    grandQuotedMinor,
    grandPurchasedMinor,
    grandPnlMinor,
  };
}
