'use client';

import { useMemo, useState } from 'react';
import { BuildingStorefrontIcon, DocumentTextIcon, PhoneIcon, CalculatorIcon, CurrencyDollarIcon, CalendarIcon } from '@heroicons/react/24/outline';

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
    <form action={action} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700 transition-all hover:shadow-md">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Vendor Name</label>
          <div className="relative">
            <input
              name="vendor"
              placeholder="Vendor Name"
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
              required
            />
            <BuildingStorefrontIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Invoice Number</label>
          <div className="relative">
            <input
              name="taxInvoiceNo"
              placeholder="INV-0000"
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
              required
            />
            <DocumentTextIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Vendor Phone</label>
          <div className="relative">
            <input
              name="vendorPhone"
              placeholder="+1 (555) 000-0000"
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
            />
            <PhoneIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Quantity</label>
          <div className="relative">
            <input
              name="qty"
              type="number"
              min={0}
              max={maxQty}
              step="0.01"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              placeholder={`Max: ${maxQty}`}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
              required
            />
            <CalculatorIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Unit Price</label>
          <div className="relative">
            <input
              name="unitPrice"
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              placeholder="0.00"
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
              required
            />
            <CurrencyDollarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date Received</label>
          <div className="relative">
            <input
              name="date"
              type="date"
              defaultValue={defaultDate}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
            />
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Value</label>
          <div className="relative">
            <input
              value={total.toFixed(2)}
              readOnly
              aria-label="Total price"
              className="block w-full rounded-lg border border-gray-200 bg-gray-100 py-2.5 pl-3 pr-3 text-sm font-bold text-gray-700 text-right cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            />
          </div>
        </div>

        <input type="hidden" name="price" value={total} />
      </div>

      <div className="mt-8 flex justify-end">
        <button
          className="rounded-lg bg-slate-900 px-6 py-2.5 text-white text-sm font-medium hover:bg-slate-800 shadow-sm focus:ring-4 focus:ring-slate-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={disabled}
        >
          Save Purchase
        </button>
      </div>
    </form>
  );
}
