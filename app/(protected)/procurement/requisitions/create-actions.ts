'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import { toMinor } from '@/helpers/money';

type Selected = {
  quoteLineId?: string | null;
  description: string;
  unit?: string | null;
  qty: number;
  amount?: number; // optional per-line budget (major)
};

export async function createRequisitionAndPO(projectId: string, selected: Selected[]) {
  const me = await getCurrentUser();
  assertRoles(me?.role, ['PROJECT_MANAGER', 'ADMIN']);

  if (!selected?.length) throw new Error('Select at least one item');

  const requisition = await prisma.procurementRequisition.create({
    data: {
      projectId,
      status: 'SUBMITTED',
      items: {
        create: selected.map((l) => ({
          description: l.description,
          unit: l.unit ?? null,
          // legacy required fields (mirror new):
          qty: Number(l.qty),
          estPriceMinor: l.amount != null ? toMinor(l.amount) : 0n,
          // new preferred:
          qtyRequested: Number(l.qty),
          amountMinor: l.amount != null ? toMinor(l.amount) : 0n,
          quoteLineId: l.quoteLineId ?? null,
        })),
      },
    },
    include: { items: true },
  });

  const requestedMinor = requisition.items.reduce((n, it) => n + BigInt(it.amountMinor ?? 0), 0n);

  // Build a PO from the requisition immediately
  const po = await prisma.purchaseOrder.create({
    data: {
      projectId,
      requisitionId: requisition.id,
      status: 'SUBMITTED',
      requestedMinor,
      items: {
        create: requisition.items.map((it) => ({
          requisitionItemId: it.id,
          description: it.description,
          unit: it.unit,
          qty: it.qtyRequested || it.qty || 0,
          amountMinor: it.amountMinor || it.estPriceMinor || 0n,
        })),
      },
    },
  });

  return { requisitionId: requisition.id, poId: po.id };
}

