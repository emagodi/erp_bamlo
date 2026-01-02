'use client';

import { useMemo, useState, useTransition } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect';
import LoadingButton from '@/components/LoadingButton';
import Money from '@/components/Money';
import { useLoading } from '@/components/LoadingProvider';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

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
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Manual Items</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Amounts are gross (incl. VAT). Preview uses the quote VAT rate.
            </p>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600 transition-all hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
          >
            <PlusIcon className="h-4 w-4" />
            Add Row
          </button>
        </div>

        <div className="space-y-4">
          {rows.map((row, index) => (
            <div 
              key={row.id} 
              className="relative rounded-xl border border-gray-200 bg-gray-50/50 p-4 transition-all hover:border-blue-200 hover:bg-white hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-blue-800 dark:hover:bg-gray-800"
            >
              <div className="mb-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Description
                  </label>
                  <input
                    type="text"
                    value={row.description}
                    onChange={(event) => updateRow(row.id, { description: event.target.value })}
                    className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
                    placeholder="Item description..."
                    required
                    autoFocus={index === rows.length - 1}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Section (Optional)
                  </label>
                  <input
                    type="text"
                    value={row.section ?? ''}
                    onChange={(event) => updateRow(row.id, { section: event.target.value })}
                    className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
                    placeholder="e.g. Materials"
                  />
                </div>
              </div>

              <div className="flex items-end gap-4">
                <div className="grid flex-1 grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={row.unit ?? ''}
                      onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
                      placeholder="ea"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Qty
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.quantity}
                      onChange={(event) =>
                        updateRow(row.id, { quantity: Number(event.target.value) })
                      }
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Rate
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.rate}
                      onChange={(event) => updateRow(row.id, { rate: Number(event.target.value) })}
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
                      required
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  className="mb-[1px] inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition-all hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed dark:border-red-900/30 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  title="Remove row"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div className="flex gap-6">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Subtotal:</span>{' '}
                <span className="font-semibold text-gray-900 dark:text-white"><Money value={totalsPreview.subtotal} /></span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">VAT:</span>{' '}
                <span className="font-semibold text-gray-900 dark:text-white"><Money value={totalsPreview.tax} /></span>
              </div>
            </div>
            <div>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                Total: <Money value={totalsPreview.total} />
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <LoadingButton
            type="submit"
            className="inline-flex items-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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
