'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';
import { toMinor } from '@/helpers/money';
import { postStockMove, upsertInventoryItem } from '@/lib/inventory';

export async function createPurchaseAgainstPO(args: {
  poItemId: string;
  vendor: string;
  taxInvoiceNo: string;
  qty: number;
  price: number;    // total major
  purchasedAt: string; // yyyy-mm-dd
  invoiceUrl?: string | null;
}) {
  const me = await getCurrentUser();
  assertRoles(me?.role, ['PROCUREMENT', 'SENIOR_PROCUREMENT', 'ADMIN']);

  const poItem = await prisma.purchaseOrderItem.findUnique({
    where: { id: args.poItemId },
    include: { purchaseOrder: { include: { requisition: true } }, requisitionItem: true },
  });
  if (!poItem) throw new Error('PO item not found');
  if (poItem.purchaseOrder.status !== 'APPROVED') throw new Error('PO not approved');

  // Remaining qty check
  const agg = await prisma.purchase.aggregate({ where: { requisitionItemId: poItem.requisitionItemId }, _sum: { qty: true } });
  const purchasedSoFar = Number(agg._sum.qty ?? 0);
  const remaining = Math.max(0, Number(poItem.qty) - purchasedSoFar);
  if (args.qty > remaining) throw new Error(`Qty exceeds remaining (${remaining})`);

  const purchase = await prisma.purchase.create({
    data: {
      requisitionId: poItem.purchaseOrder.requisitionId,
      requisitionItemId: poItem.requisitionItemId,
      vendor: args.vendor.trim(),
      taxInvoiceNo: args.taxInvoiceNo.trim(),
      qty: Number(args.qty),
      priceMinor: toMinor(args.price),
      purchasedOn: new Date(args.purchasedAt),
      invoiceUrl: args.invoiceUrl ?? null,
      createdById: me!.id!,
    },
  });

  // Inventory IN: use description/unit to normalize inventory item
  await upsertInventoryItem(`POI-${poItem.id}`, poItem.description, poItem.unit ?? undefined);
  await postStockMove({
    description: poItem.description,
    unit: poItem.unit ?? undefined,
    qty: Number(args.qty),
    kind: 'IN',
    projectId: poItem.purchaseOrder.requisition.projectId,
    refType: 'PURCHASE',
    refId: purchase.id,
  });

  return purchase.id;
}

