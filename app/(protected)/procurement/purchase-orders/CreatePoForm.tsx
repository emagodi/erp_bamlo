'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SubmitButton from '@/components/SubmitButton';
import Money from '@/components/Money';
import { createPurchaseOrder } from './actions';

type RequisitionItem = {
  id: string;
  description: string;
  qtyRequested: number;
  unit: string | null;
  estPriceMinor: bigint;
};

interface CreatePoFormProps {
  requisitionId: string;
  userId: string;
  items: RequisitionItem[];
  projectNumber: string;
  customerName: string;
}

export default function CreatePoForm({
  requisitionId,
  userId,
  items,
  projectNumber,
  customerName,
}: CreatePoFormProps) {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function clientAction(formData: FormData) {
    try {
      const vendorName = formData.get('vendor') as string;
      const vendorPhone = formData.get('vendorPhone') as string;

      const orderedItems = items.map(item => ({
        requisitionItemId: item.id,
        quantity: Number(formData.get(`qty-${item.id}`)),
        unitPriceMajor: Number(formData.get(`price-${item.id}`)),
      }));

      await createPurchaseOrder(
        requisitionId, 
        userId, 
        orderedItems, 
        { name: vendorName, phone: vendorPhone }
      );
      
      // Redirect happens in server action (via revalidatePath probably shouldn't redirect there).
      // If server action doesn't redirect, we can do it here.
      // The server action just revalidates. Let's redirect to list or dashboard.
      router.push('/procurement/purchase-orders'); 
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <form action={clientAction} className="space-y-6">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Purchase Order Details</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="vendor" className="text-sm font-medium text-gray-700">
              Vendor Name
            </label>
            <input
              id="vendor"
              name="vendor"
              type="text"
              required
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Bunnings Warehouse"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="vendorPhone" className="text-sm font-medium text-gray-700">
              Vendor Phone (Optional)
            </label>
            <input
              id="vendorPhone"
              name="vendorPhone"
              type="tel"
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. 02 1234 5678"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Order Items</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Item</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Qty Needed</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Ordered Qty</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Unit Price ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="group hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.description}</div>
                      <div className="text-xs text-gray-500">
                        Needed: {item.qtyRequested} {item.unit}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {item.qtyRequested} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        name={`qty-${item.id}`}
                        defaultValue={item.qtyRequested}
                        step="0.01"
                        min="0"
                        required
                        className="h-8 w-24 rounded border border-gray-300 px-2 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        name={`price-${item.id}`}
                        defaultValue={Number(item.estPriceMinor) / 100}
                        step="0.01"
                        min="0"
                        required
                        className="h-8 w-28 rounded border border-gray-300 px-2 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Cancel
        </button>
        <SubmitButton
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          loadingText="Creating PO..."
        >
          Create Purchase Order
        </SubmitButton>
      </div>
    </form>
  );
}
