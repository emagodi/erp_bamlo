'use client';

import { useMemo, useState } from 'react';

type Props = {
  maxQty: number;
  defaultDate: string;
  action: (formData: FormData) => Promise<void> | void;
};

export default function ReceivePurchaseForm({ maxQty, defaultDate, action }: Props) {
  const [qty, setQty] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number>(0);

  const total = useMemo(() => {
    const t = (Number(qty) || 0) * (Number(unitPrice) || 0);
    return Number.isFinite(t) ? t : 0;
  }, [qty, unitPrice]);

  const disabled = !qty || qty <= 0 || qty > maxQty || unitPrice < 0;

  return (
    <form action={action} className="grid grid-cols-2 gap-2 text-sm">
      <input
        name="vendor"
        placeholder="Vendor"
        className="rounded border px-2 py-1"
        required
      />
      <input
        name="taxInvoiceNo"
        placeholder="Invoice #"
        className="rounded border px-2 py-1"
        required
      />
      <input
        name="vendorPhone"
        placeholder="Phone (optional)"
        className="rounded border px-2 py-1 col-span-2"
      />
      <input
        name="qty"
        type="number"
        min={0}
        max={maxQty}
        step="0.01"
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        placeholder={`Qty (≤ ${maxQty})`}
        className="rounded border px-2 py-1"
        required
      />
      <input
        name="unitPrice"
        type="number"
        min={0}
        step="0.01"
        value={unitPrice}
        onChange={(e) => setUnitPrice(Number(e.target.value))}
        placeholder="Unit price"
        className="rounded border px-2 py-1"
        required
      />
      <input
        name="date"
        type="date"
        defaultValue={defaultDate}
        className="rounded border px-2 py-1"
      />
      <input
        value={total.toFixed(2)}
        readOnly
        aria-label="Total price"
        className="rounded border px-2 py-1 bg-gray-50 text-right col-span-2"
      />
      <input type="hidden" name="price" value={total} />
      <button
        className="col-span-2 rounded bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={disabled}
      >
        Save Purchase
      </button>
    </form>
  );
}
