'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Money from '@/components/Money';
import SubmitButton from '@/components/SubmitButton';
import { verifyGRN } from './actions';

type GRNItem = {
  id: string;
  description: string;
  qtyDelivered: number;
  priceMinor: number; // passed as number to avoid serialization issues
  varianceMinor: number; // passed as number
};

type Props = {
  grnId: string;
  receivedBy: string;
  receivedAt: string;
  vendorName: string;
  vendorPhone: string;
  receiptNumber: string;
  items: GRNItem[];
  verifierId: string;
};

const ITEMS_PER_PAGE = 5;

export default function VerifyGrnForm({
  grnId,
  receivedBy,
  receivedAt,
  vendorName,
  vendorPhone,
  receiptNumber,
  items,
  verifierId,
}: Props) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const startIdx = page * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle>Verify GRN {grnId.slice(0, 8)}</CardTitle>
        <CardDescription>
          Received by {receivedBy} on {new Date(receivedAt).toLocaleString()}
        </CardDescription>
        <div className="text-xs text-gray-500 mt-1">
          Vendor: <span className="font-medium text-gray-700">{vendorName}</span> • Phone:{' '}
          <span className="font-medium text-gray-700">{vendorPhone}</span> • Receipt:{' '}
          <span className="font-medium text-gray-700">{receiptNumber}</span>
        </div>
      </CardHeader>
      <CardContent>
        <form
          action={async (fd) => {
            // We need to capture values for ALL items, potentially across pages.
            // Since we use `display: none` (hidden class) for off-page items, they ARE in the DOM
            // and their values WILL be submitted.
            const payload = items.map((item) => ({
              grnItemId: item.id,
              qtyAccepted: Number(fd.get(`accepted-${item.id}`) || 0),
              qtyRejected: Number(fd.get(`rejected-${item.id}`) || 0),
            }));

            await verifyGRN(grnId, payload, verifierId);
          }}
          className="space-y-4"
        >
          <div className="rounded-md border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Item</th>
                  <th className="px-4 py-2 text-right font-medium">Delivered</th>
                  <th className="px-4 py-2 text-right font-medium">Price</th>
                  <th className="px-4 py-2 text-right font-medium">P&L</th>
                  <th className="px-4 py-2 text-right font-medium">Accepted</th>
                  <th className="px-4 py-2 text-right font-medium">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const isVisible = index >= startIdx && index < endIdx;
                  return (
                    <tr key={item.id} className={isVisible ? 'border-t' : 'hidden'}>
                      <td className="px-4 py-2">{item.description}</td>
                      <td className="px-4 py-2 text-right">{item.qtyDelivered}</td>
                      <td className="px-4 py-2 text-right">
                        {item.priceMinor ? <Money minor={item.priceMinor} /> : '-'}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          item.varianceMinor < 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {item.varianceMinor ? <Money minor={item.varianceMinor} /> : '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          name={`accepted-${item.id}`}
                          type="number"
                          step="0.01"
                          min={0}
                          max={item.qtyDelivered}
                          defaultValue={item.qtyDelivered}
                          className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-right text-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          name={`rejected-${item.id}`}
                          type="number"
                          step="0.01"
                          min={0}
                          max={item.qtyDelivered}
                          defaultValue={0}
                          className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-right text-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          <div className="flex justify-end">
            <SubmitButton className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-emerald-600 text-white shadow hover:bg-emerald-700 h-9 px-4 py-2">
              Verify & Approve
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
