'use client';

import { useMemo, useState, useTransition } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect';
import LoadingButton from '@/components/LoadingButton';
import Money from '@/components/Money';
import { useLoading } from '@/components/LoadingProvider';

import { addManualLines, type ManualRowInput } from './actions';

type ManualItemsFormProps = {
  quoteId: string;
  vatPercent: number;
};

type EditableRow = ManualRowInput & { id: string };

function emptyRow(): EditableRow {
  return {
    id: crypto.randomUUID(),
    description: '',
    unit: '',
    quantity: 1,
    rate: 0,
    section: '',
  };
}

export default function ManualItemsForm({ quoteId, vatPercent }: ManualItemsFormProps) {
  const [rows, setRows] = useState<EditableRow[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const loading = useLoading();

  const totalsPreview = useMemo(() => {
    const subtotal = rows.reduce((sum, row) => sum + row.quantity * row.rate, 0);
    const tax = subtotal * vatPercent;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [rows, vatPercent]);

  const updateRow = (id: string, patch: Partial<EditableRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string) => {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  };

  const addRow = () => {
    setRows((current) => [...current, emptyRow()]);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const payload: ManualRowInput[] = rows.map((row) => ({
      description: row.description.trim(),
      unit: row.unit?.trim() || null,
      quantity: Number(row.quantity) || 0,
      rate: Number(row.rate) || 0,
      section: row.section?.trim() || null,
    }));

    startTransition(async () => {
      try {
        loading.start();
        const canSubmit =
      
        await addManualLines(quoteId, payload);
      } catch (err) {
        // ⬇️ do NOT log RedirectError, just rethrow so Next completes the redirect
        if (isRedirectError(err)) throw err;

        // For real errors, you can log/set UI state
        // console.error(err);  // ← remove this for RedirectError
        setError(err instanceof Error ? err.message : 'Something went wrong');
        // console.error(err);
        // setError(err instanceof Error ? err.message : 'Failed to add manual lines');
      } finally {
        loading.stop();
      }
    });
  };

  return (
    <section className="rounded border bg-white p-4 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Add Manual Items</h2>
            <p className="text-sm text-gray-500">
              Amounts are gross (incl. VAT). Preview uses the quote VAT rate.
            </p>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            + Add row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Unit</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-left">Section</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(event) => updateRow(row.id, { description: event.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Description"
                      required
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.unit ?? ''}
                      onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="ea, hr..."
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.quantity}
                      onChange={(event) =>
                        updateRow(row.id, { quantity: Number(event.target.value) })
                      }
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.rate}
                      onChange={(event) => updateRow(row.id, { rate: Number(event.target.value) })}
                      className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.section ?? ''}
                      onChange={(event) => updateRow(row.id, { section: event.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Section (optional)"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={rows.length === 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-6 rounded border border-dashed border-gray-300 p-3 text-sm text-gray-600">
          <div>
            <span className="font-semibold">Subtotal:</span>{' '}
            <Money value={totalsPreview.subtotal} />
          </div>
          <div>
            <span className="font-semibold">VAT:</span> <Money value={totalsPreview.tax} />
          </div>
          <div>
            <span className="font-semibold">Total:</span> <Money value={totalsPreview.total} />
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <LoadingButton
            type="submit"
            className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            pending={isPending}
            loadingText="Saving..."
          >
            Save Manual Lines
          </LoadingButton>
        </div>
      </form>
    </section>
  );
}
