import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { assertRoles } from '@/lib/workflow';

const PAGE_SIZE = 20;

type SearchParamsShape = {
  q?: string;
  page?: string;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  const me = await getCurrentUser();

  if (!me) {
    redirect('/login');
  }
  // if (!me) return <div className="p-6">Auth required.</div>;
  try {
    assertRoles(me.role as any, ['PROJECT_MANAGER', 'PROCUREMENT', 'SENIOR_PROCUREMENT', 'SECURITY', 'ADMIN'] as any);
  } catch {
    const r = String((me as any).role || '');
    if (['QS', 'SENIOR_QS', 'SALES'].includes(r)) redirect('/quotes');
    redirect('/projects');
  }

  const resolved = await searchParams;
  const q = (resolved.q ?? '').trim();
  const page = Math.max(1, Number(resolved.page ?? '1'));

  const where: any = { category: 'MATERIAL' };
  if (q) where.name = { contains: q, mode: 'insensitive' };

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-semibold">Inventory</h1>

      <form className="flex gap-2 items-center" action="/inventory" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name..."
          className="rounded border px-3 py-1"
        />
        <input type="hidden" name="page" value="1" />
        <button className="rounded bg-slate-900 px-3 py-1 text-white">Filter</button>
      </form>

      <div className="rounded border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Unit</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-left">Category</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-gray-500" colSpan={4}>
                  No inventory items found.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2">{it.unit ?? '-'}</td>
                  <td className="px-3 py-2 text-right">{it.qty}</td>
                  <td className="px-3 py-2">{it.category ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">
          Page {page} of {totalPages} ({total} items)
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <a
              href={`/inventory?${new URLSearchParams({ q, page: String(page - 1) }).toString()}`}
              className="rounded border px-3 py-1 text-sm"
            >
              Prev
            </a>
          ) : null}
          {page < totalPages ? (
            <a
              href={`/inventory?${new URLSearchParams({ q, page: String(page + 1) }).toString()}`}
              className="rounded border px-3 py-1 text-sm"
            >
              Next
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// server action
async function addInventoryItem(formData: FormData) {
  'use server';

  const me = await getCurrentUser();
  if (!me) redirect('/inventory');
  try {
    assertRoles((me as any).role, ['PROJECT_MANAGER', 'PROCUREMENT', 'SENIOR_PROCUREMENT', 'ADMIN'] as any);
  } catch {
    const r = String((me as any).role || '');
    if (['QS', 'SENIOR_QS', 'SALES'].includes(r)) redirect('/quotes');
    redirect('/projects');
  }

  const name = String(formData.get('name') || '').trim();
  const unit = String(formData.get('unit') || '').trim() || null;
  const qty = Number(formData.get('qty') || 0);
  const category = String(formData.get('category') || 'MATERIAL').trim() || 'MATERIAL';

  if (!name || isNaN(qty)) {
    redirect('/inventory');
  }

  const key = `${name}|${unit || ''}`.toLowerCase();

  await prisma.inventoryItem.upsert({
    where: { key },
    update: {
      qty: { increment: qty },
      quantity: { increment: qty },
      category,
    },
    create: {
      name,
      description: name,
      unit,
      qty,
      quantity: qty,
      category,
      key,
    },
  });

  redirect('/inventory');
}
