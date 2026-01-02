// lib/inventory.ts
import { prisma } from '@/lib/db';

export function invKey(desc: string, unit?: string | null) {
  return `${desc.trim()}|${(unit || '').trim()}`.toLowerCase();
}

export async function getOrCreateInventoryItem(desc: string, unit?: string | null) {
  const key = invKey(desc, unit);
  const found = await prisma.inventoryItem.findUnique({ where: { key } });
  if (found) return found;
  return prisma.inventoryItem.create({
    data: { key, description: desc, unit: unit ?? null, quantity: 0 },
  });
}

export async function postStockMove(args: {
  description: string;
  unit?: string | null;
  qty: number; // positive for IN/RETURN, negative for OUT
  kind: 'IN' | 'OUT' | 'RETURN' | 'ADJUST';
  projectId?: string | null;
  refType: string;
  refId: string;
}) {
  if (!Number.isFinite(args.qty) || args.qty === 0) return;

  const item = await getOrCreateInventoryItem(args.description, args.unit);
  const newQty = item.quantity + args.qty;

  await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: newQty },
    }),
    prisma.stockMove.create({
      data: {
        inventoryItemId: item.id,
        projectId: args.projectId ?? null,
        kind: args.kind,
        qty: args.qty,
        refType: args.refType,
        refId: args.refId,
      },
    }),
  ]);
}

// --- Compat helpers with requested API ---
// Treat `sku` as a logical key; we still key by description+unit under the hood.
export async function upsertInventoryItem(sku: string, name: string, unit?: string | null) {
  // We use name+unit as inventory identity. sku is ignored in storage but accepted for API compat.
  const key = invKey(name, unit);
  const found = await prisma.inventoryItem.findUnique({ where: { key } });
  if (found) return prisma.inventoryItem.update({ where: { id: found.id }, data: { description: name, unit: unit ?? null } });
  return prisma.inventoryItem.create({ data: { key, description: name, unit: unit ?? null, quantity: 0 } });
}

export async function addInventoryTxn(
  itemId: string,
  kind: 'IN' | 'OUT' | 'ADJUST',
  qty: number,
  refType: string,
  refId: string,
  note?: string | null,
) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('Inventory item not found');
  const delta = kind === 'IN' ? Math.abs(qty) : kind === 'OUT' ? -Math.abs(qty) : qty;
  await postStockMove({ description: item.description, unit: item.unit, qty: delta, kind: delta >= 0 ? 'IN' : 'OUT', refType, refId });
  return true;
}
