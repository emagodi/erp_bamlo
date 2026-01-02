'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Money from '@/components/Money';
import { verifyMultipleGRNs } from './actions';

interface VerifyPoGrnsFormProps {
  poId: string;
  verifierId: string;
  items: Array<{
    grnId: string;
    grnItemId: string;
    description: string;
    qtyDelivered: number;
    priceMinor: number;
    varianceMinor: number;
    receiptNumber: string;
    vendorName: string;
    receivedAt: string;
  }>;
}

export default function VerifyPoGrnsForm({
  items,
  verifierId,
}: VerifyPoGrnsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Local state for accepted quantities (default to delivered qty)
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((item) => {
      initial[item.grnItemId] = String(item.qtyDelivered);
    });
    return initial;
  });

  const handleAcceptChange = (itemId: string, val: string) => {
    // Allow empty string or valid number
    if (val === '' || !isNaN(parseFloat(val))) {
      setInputs((prev) => ({ ...prev, [itemId]: val }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    // Prepare payload
    const payload = items.map((item) => {
      const valStr = inputs[item.grnItemId] ?? String(item.qtyDelivered);
      const accepted = valStr === '' ? 0 : parseFloat(valStr);
      
      // Ensure accepted doesn't exceed delivered (basic validation, though backend might allow if correction needed?)
      // Usually Accepted <= Delivered. 
      const finalAccepted = Math.max(0, Math.min(item.qtyDelivered, accepted));
      const rejected = Math.max(0, item.qtyDelivered - finalAccepted);

      return {
        grnId: item.grnId,
        grnItemId: item.grnItemId,
        qtyAccepted: finalAccepted,
        qtyRejected: rejected,
      };
    });

    try {
      await verifyMultipleGRNs(payload, verifierId);
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to verify items');
      setLoading(false);
    }
  };

  // Pagination Logic
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleItems = items.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  return (
    <div className="rounded-lg border bg-white shadow-sm p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium">Verify Pending Deliveries</h3>
        <p className="text-sm text-gray-500">
          Review and verify all pending items for this Purchase Order.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 uppercase">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Receipt / Vendor</th>
              <th className="px-4 py-3 text-right">Delivered</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-center">P&L</th>
              <th className="px-4 py-3 text-right">Accepted</th>
              <th className="px-4 py-3 text-right">Rejected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visibleItems.map((item) => {
              const valStr = inputs[item.grnItemId] ?? String(item.qtyDelivered);
              const acceptedNum = valStr === '' ? 0 : parseFloat(valStr);
              // Calculate rejected based on valid numeric accepted value
              const rejected = Math.max(0, item.qtyDelivered - acceptedNum);
              
              const isProfit = item.varianceMinor > 0;
              const isVariance = item.varianceMinor !== 0;

              return (
                <tr key={item.grnItemId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                     <div className="flex flex-col">
                        <span>{item.receiptNumber}</span>
                        <span className="text-xs text-gray-400">{item.vendorName}</span>
                         <span className="text-xs text-gray-400">{new Date(item.receivedAt).toLocaleDateString()}</span>
                     </div>
                  </td>
                  <td className="px-4 py-3 text-right">{item.qtyDelivered}</td>
                  <td className="px-4 py-3 text-right">
                    <Money minor={BigInt(item.priceMinor)} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isVariance ? (
                      <span className={isProfit ? 'text-green-600' : 'text-red-600'}>
                         {isProfit ? '+' : ''}<Money minor={BigInt(item.varianceMinor)} />
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-right focus:border-emerald-500 focus:outline-none"
                      value={valStr}
                      onChange={(e) => handleAcceptChange(item.grnItemId, e.target.value)}
                      min={0}
                      max={item.qtyDelivered}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                     <span className="inline-block w-20 text-gray-500 bg-gray-100 rounded border border-gray-200 px-2 py-1">
                        {rejected}
                     </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-4">
          <div className="flex flex-1 justify-between">
            <button
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${
                currentPage === 1 ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              Previous
            </button>
            <div className="text-sm text-gray-700 self-center">
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${
                currentPage === totalPages ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify & Approve All'}
        </button>
      </div>
    </div>
  );
}
