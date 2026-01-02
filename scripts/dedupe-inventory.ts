// scripts/dedupe-inventory.ts
import { prisma } from '../lib/db';

async function dedupe() {
  console.log('Fetching inventory items...');
  const items = await prisma.inventoryItem.findMany({
    select: { id: true, key: true, name: true, description: true, unit: true, qty: true, quantity: true },
  });

  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const key = String(it.key ?? `${it.description ?? it.name ?? ''}|${it.unit ?? ''}`).toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }

  for (const [key, group] of groups) {
    if (group.length <= 1) continue;
    console.log(`Merging key=${key} (${group.length} rows)`);

    const canonical = group[0];
    let totalQty = 0;
    let totalQuantity = 0;
    for (const g of group) {
      totalQty += Number(g.qty ?? 0);
      totalQuantity += Number(g.quantity ?? 0);
    }

    // update canonical
    await prisma.inventoryItem.update({
      where: { id: canonical.id },
      data: { qty: totalQty, quantity: totalQuantity },
    });

    // reassign dispatch items pointing to duplicates -> canonical
    const dupIds = group.slice(1).map((g) => g.id);
    await prisma.dispatchItem.updateMany({
      where: { inventoryItemId: { in: dupIds } },
      data: { inventoryItemId: canonical.id },
    });

    // delete duplicate rows
    for (const dup of dupIds) {
      await prisma.inventoryItem.delete({ where: { id: dup } });
    }

    console.log(`Merged ${group.length} -> ${canonical.id}`);
  }

  console.log('Dedupe finished.');
}

dedupe()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));