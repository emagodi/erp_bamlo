// app/(protected)/procurement/requisitions/[requisitionId]/actions.ts
'use server';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function createPOFromRequisition(requisitionId: string, fd: FormData) {
  const req = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    include: { items: true, project: true },
  });
  if (!req) throw new Error('Requisition not found');
  if (req.items.length === 0) throw new Error('No items');

  const vendor = String(fd.get('vendor') || '');
  if (!vendor) throw new Error('Provide a vendor');

  // use req.items amounts/qty
  const po = await prisma.purchaseOrder.create({
    data: {
      projectId: req.projectId,
      requisitionId,
      status: 'SUBMITTED',
      vendor,
      requestedMinor: req.items.reduce((a, it) => a + BigInt(it.amountMinor), 0n),
      items: {
        create: req.items.map((it) => ({
          requisitionItemId: it.id,
          description: it.description,
          unit: it.unit,
          qty: it.qtyRequested,
          amountMinor: it.amountMinor, // locked
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath(`/procurement/requisitions/${requisitionId}`);
  redirect(`/procurement/purchase-orders/${po.id}`);
}

import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';

export async function markAsPurchased(requisitionId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');
  assertRoles(user.role as any, ['PROCUREMENT', 'SENIOR_PROCUREMENT', 'ADMIN']);

  const fullReq = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    include: { items: true },
  });
  if (!fullReq) throw new Error('Requisition not found');

  await prisma.$transaction(async (tx) => {
    // 1. Create Purchase Order
    // 0. Calculate already purchased quantities
    const existingPurchases = await tx.purchase.findMany({
      where: { requisitionId: fullReq.id },
    });
    const purchasedMap = new Map<string, number>();
    for (const p of existingPurchases) {
      if (p.requisitionItemId) {
        purchasedMap.set(p.requisitionItemId, (purchasedMap.get(p.requisitionItemId) || 0) + Number(p.qty));
      }
    }

    // 1. Calculate items to be purchased (Remaining Qty > 0)
    const itemsToPurchase = fullReq.items.map((it) => {
      const totalReq = it.qtyRequested ?? it.qty ?? 0;
      const alreadyBought = purchasedMap.get(it.id) ?? 0;
      const remaining = Math.max(0, totalReq - alreadyBought);
      return { ...it, remaining };
    }).filter(it => it.remaining > 0);

    if (itemsToPurchase.length > 0) {
      // 2. Create Purchase Order for Remaining Items
      const poItems = itemsToPurchase.map((it) => ({
        requisitionItemId: it.id,
        description: it.description,
        unit: it.unit,
        qty: it.remaining,
        unitPriceMinor: it.requestedUnitPriceMinor ?? 0n,
        totalMinor: BigInt(Math.round(it.remaining * Number(it.requestedUnitPriceMinor ?? 0n))),
      }));

      const totalPoMinor = poItems.reduce((acc, it) => acc + it.totalMinor, 0n);

      await tx.purchaseOrder.create({
        data: {
          projectId: fullReq.projectId,
          requisitionId: fullReq.id,
          status: 'PURCHASED',
          vendor: 'Direct Purchase',
          requestedMinor: totalPoMinor,
          items: {
            create: poItems,
          },
        },
      });
    }

    // 3. Update Requisition Status to Purchased (Closing it)
    await tx.procurementRequisition.update({
      where: { id: requisitionId },
      data: { status: 'PURCHASED' },
    });
  });

  revalidatePath(`/procurement/requisitions/${requisitionId}`);
  revalidatePath(`/projects/${fullReq.projectId}`);
  redirect('/dashboard');
}

export async function submitRequisition(requisitionId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');
  assertRoles(user.role as any, ['PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN']);

  const req = await prisma.procurementRequisition.update({
    where: { id: requisitionId },
    data: {
      status: 'SUBMITTED',
      submittedById: user.id,
    },
    select: { projectId: true },
  });

  revalidatePath(`/procurement/requisitions/${requisitionId}`);
  revalidatePath(`/projects/${req.projectId}`);
  revalidatePath('/reqs');
  revalidatePath('/dashboard')
  redirect('/dashboard');
}
