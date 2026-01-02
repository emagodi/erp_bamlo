"use client";
import { useState } from 'react';

export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: { type: 'percent' | 'fixed'; value: number } | null;
};

export default function LineItemRow({ index, value, onChange, onRemove }: {
  index: number;
  value: LineItem;
  onChange: (v: LineItem) => void;
  onRemove: () => void;
}) {
  const [item, setItem] = useState<LineItem>(value);
  function set<K extends keyof LineItem>(k: K, v: LineItem[K]) {
    const next = { ...item, [k]: v } as LineItem;
    setItem(next);
    onChange(next);
  }
  const discountType = item.discount?.type ?? 'percent';
  const discountValue = item.discount?.value ?? 0;
  return (
    <div className="grid grid-cols-12 gap-2 items-center py-2 border-b">
      <input className="col-span-4 px-2 py-1 border rounded" placeholder="Description" value={item.description} onChange={(e) => set('description', e.target.value)} />
      <input type="number" className="col-span-2 px-2 py-1 border rounded" placeholder="Qty" value={item.quantity} onChange={(e) => set('quantity', Number(e.target.value))} />
      <input type="number" className="col-span-2 px-2 py-1 border rounded" placeholder="Unit Price" value={item.unitPrice} onChange={(e) => set('unitPrice', Number(e.target.value))} />
      <div className="col-span-3 flex gap-2 items-center">
        <select className="px-2 py-1 border rounded" value={discountType} onChange={(e) => set('discount', { type: e.target.value as 'percent' | 'fixed', value: discountValue })}>
          <option value="percent">% off</option>
          <option value="fixed">Fixed</option>
        </select>
        <input type="number" className="w-24 px-2 py-1 border rounded" placeholder="Disc" value={discountValue} onChange={(e) => set('discount', { type: discountType, value: Number(e.target.value) })} />
      </div>
      <button type="button" className="col-span-1 text-red-600" onClick={onRemove}>Remove</button>
    </div>
  );
}
