/* app/(protected)/projects/[projectId]/requisitions/new/page.tsx */
import React from 'react';
import { prisma } from '@/lib/db';
import RequisitionPickerClient from '@/components/RequisitionPickerClient';
import { createRequisitionFromQuotePicks } from '@/app/(protected)/projects/actions'; // path where your server action lives
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { CreateRequisitionButton } from './CreateRequisitionButton';

type LineRow = {
  id: string;
  qtyOrdered: number;
  description: string;
  unit?: string | null;
  purchased: number;
  remaining: number;
  alreadyRequested: number;
  category: string;
  approvedExtra: number;
};

export default async function NewRequisitionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const currentUser = await getCurrentUser();

  // load quote lines for the project's quote
  const quote = await prisma.quote.findFirst({
    where: { project: { id: projectId } },
    include: { lines: { orderBy: { createdAt: 'asc' } } },
  });
  if (!quote) return notFound();

  const lineIds = quote.lines.map((l) => l.id);

  const extraRequests = await prisma.quoteLineExtraRequest.findMany({
    where: { projectId, quoteLineId: { in: lineIds } },
    orderBy: { createdAt: 'desc' },
    include: {
      requestedBy: { select: { name: true, role: true } },
      decidedBy: { select: { name: true, role: true } },
    },
  });

  const approvedByLine = new Map<string, number>();
  const requestsByLine: Record<string, Array<{
    id: string;
    qty: number;
    reason?: string | null;
    status: string;
    requiresAdmin: boolean;
    requestedByName: string;
    requestedByRole?: string | null;
    decidedByName?: string | null;
    decidedAt?: string | null;
    createdAt: string;
  }>> = {};

  for (const req of extraRequests) {
    if (req.status === 'APPROVED') {
      approvedByLine.set(req.quoteLineId, (approvedByLine.get(req.quoteLineId) ?? 0) + req.qty);
    }
    (requestsByLine[req.quoteLineId] ??= []).push({
      id: req.id,
      qty: req.qty,
      reason: req.reason,
      status: req.status,
      requiresAdmin: req.requiresAdmin,
      requestedByName: req.requestedBy?.name ?? 'User',
      requestedByRole: req.requestedBy?.role ?? '',
      decidedByName: req.decidedBy?.name ?? null,
      decidedAt: req.decidedAt ? req.decidedAt.toISOString() : null,
      createdAt: req.createdAt.toISOString(),
    });
  }

  // qty already requested on requisitions (by quoteLineId)
  const requestedAgg = await prisma.procurementRequisitionItem.groupBy({
    by: ['quoteLineId'],
    where: { quoteLineId: { in: lineIds } },
    _sum: { qtyRequested: true },
  });
  const requestedByLine = new Map<string, number>();
  for (const r of requestedAgg)
    requestedByLine.set(String(r.quoteLineId), Number(r._sum.qtyRequested ?? 0));

  // purchases linked to requisition items -> map to quoteLineId
  const reqItems = await prisma.procurementRequisitionItem.findMany({
    where: { quoteLineId: { in: lineIds } },
    select: { id: true, quoteLineId: true },
  });
  const reqItemIds = reqItems.map((r) => r.id);
  const purchases = await prisma.purchase.findMany({
    where: { requisitionItemId: { in: reqItemIds } },
    include: { requisitionItem: { select: { quoteLineId: true } } },
  });
  const purchasedByLine = new Map<string, number>();
  for (const p of purchases) {
    const qid = p.requisitionItem?.quoteLineId ?? null;
    if (!qid) continue;
    purchasedByLine.set(qid, (purchasedByLine.get(qid) ?? 0) + Number(p.qty ?? 0));
  }

  // compute lines with remaining
  const linesWithRemaining: LineRow[] = quote.lines.map((line) => {
    const ordered = Number(line.quantity ?? 0);
    const meta =
      typeof line.metaJson === 'string' ? JSON.parse(line.metaJson || '{}') : (line.metaJson ?? {});
    const category = (meta.section || meta.category || 'Uncategorized') as string;
    const alreadyRequested = requestedByLine.get(line.id) ?? 0;
    const approvedExtra = approvedByLine.get(line.id) ?? 0;
    const alreadyPurchased = purchasedByLine.get(line.id) ?? 0;

    // remaining = ordered - alreadyRequested - alreadyPurchased (you can change formula)
    const remaining = Math.max(0, ordered + approvedExtra - alreadyRequested);
    return {
      id: line.id,
      qtyOrdered: ordered,
      description: line.description,
      unit: line.unit ?? null,
      purchased: alreadyPurchased,
      alreadyRequested: alreadyRequested,
      remaining,
      category,
      approvedExtra,
    };
  });

  // group by category (ordered)
  const grouped: Record<string, LineRow[]> = {};
  for (const ln of linesWithRemaining) (grouped[ln.category] ??= []).push(ln);

  // pass grouped to client
  return (
    <div className="p-6 pb-32">
      <h1 className="text-xl font-semibold">Create Requisition (from Quote)</h1>
      <p className="text-sm text-gray-600 mt-1">Select lines and enter quantities to request.</p>

      {/* The form is a Server Component scope so we can use server action directly */}
      <form action={createRequisitionFromQuotePicks} className="mt-4 space-y-4">
        {/* hidden projectId for the server action */}
        <input type="hidden" name="projectId" value={projectId} />

        {/* RequisitionPickerClient renders the inputs (checkbox + qty inputs) with deterministic names */}
        <RequisitionPickerClient
          clientGrouped={grouped}
          projectId={projectId}
          currentRole={currentUser?.role ?? null}
          requestsByLine={requestsByLine}
        />

        <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-end px-4">
          <div className="pointer-events-auto rounded-full bg-white/90 shadow-lg">
            <CreateRequisitionButton />
          </div>
        </div>
      </form>
    </div>
  );
}
