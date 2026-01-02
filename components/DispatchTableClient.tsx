
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createDispatch } from '@/app/(protected)/projects/actions';
import clsx from 'clsx';

type DispatchItemRow = {
  id: string; // This is the ITEM key (e.g. RequisitionItemId or InventoryItemId)
  requisitionItemId?: string;
  description: string;
  unit: string;
  qtyAvailable: number;
  qtyRequested?: number;
  sourceLabel: string; // e.g. "Req #123456"
};

export default function DispatchTableClient({
  items,
  projectId,
}: {
  items: DispatchItemRow[];
  projectId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pagination state
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const displayedItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleQtyChange = (itemId: string, val: string, max: number) => {
    const num = Number(val);
    if (!val) {
      const next = { ...selectedItems };
      delete next[itemId];
      setSelectedItems(next);
      return;
    }
    
    // Allow typing, but validate on blur or submit? 
    // For now, clamp or just store. Storing allows partial edits.
    if (isNaN(num)) return;
    
    setSelectedItems(prev => ({ ...prev, [itemId]: num }));
  };

  const handleDispatch = () => {
    setError(null);
    setSuccess(null);
    
    const payload: { description: string; qty: number; unit?: string; requisitionItemId?: string }[] = [];
    
    let hasError = false;

    // Iterate over selected items
    Object.entries(selectedItems).forEach(([itemId, qty]) => {
      if (qty <= 0) return;
      const original = items.find(i => i.id === itemId);
      if (!original) return;

      if (qty > original.qtyAvailable) {
        setError(`Quantity for ${original.description} exceeds availability (${original.qtyAvailable})`);
        hasError = true;
        return;
      }
      
      payload.push({
        description: original.description,
        qty: qty,
        unit: original.unit,
        requisitionItemId: original.requisitionItemId
      });
    });

    if (hasError) return;
    if (payload.length === 0) {
      setError('Please enter quantities to dispatch.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await createDispatch(projectId, payload);
          // Note: createDispatch signature might need adjustment or we need a new action 
          // that accepts requisitionItemId to link correctly. 
          // The current createDispatch takes { description, qty, unit }.
          // But to correctly decrement `remainingByItem` (which is calculated from `dispatchedItems`), 
          // we technically need to ensure `DispatchItem` links back to `requisitionItemId`.
          // I will check `createDispatch` logic in a moment.
          // For now, assuming it handles it or I'll update it.
        
        if (res.ok && res.dispatchId) {
          setSelectedItems({});
          setSuccess('Dispatch created successfully! Redirecting...');
          router.push(`/dispatches/${res.dispatchId}`);
        } else {
          router.refresh(); // Fallback
        }
      } catch (e: any) {
        setError(e.message || 'Failed to create dispatch');
      }
    });
  };

  const totalSelected = Object.keys(selectedItems).length;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-700 border border-emerald-200">
          {success}
        </div>
      )}

      <div className="rounded-md border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Item</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Available</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Dispatch Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No items available for dispatch.
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => (
                  <tr key={item.id} className={clsx(selectedItems[item.id] ? 'bg-blue-50/50' : '')}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.description}</div>
                      <div className="text-xs text-gray-500">Unit: {item.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.sourceLabel}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {item.qtyAvailable}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        max={item.qtyAvailable}
                        step="any"
                        placeholder="0"
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={selectedItems[item.id] ?? ''}
                        onChange={(e) => handleQtyChange(item.id, e.target.value, item.qtyAvailable)}
                        disabled={isPending}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, items.length)} of {items.length} items
        </div>
        
        <div className="flex gap-2">
           <button
             onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
             disabled={currentPage === 1 || isPending}
             className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
           >
             Previous
           </button>
           <button
             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
             disabled={currentPage === totalPages || isPending}
             className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
           >
             Next
           </button>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleDispatch}
          disabled={totalSelected === 0 || isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? 'Processing...' : `Dispatch Selected (${totalSelected})`}
        </button>
      </div>
    </div>
  );
}
