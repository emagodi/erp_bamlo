"use client";
import { useState, useTransition } from 'react';
import { computeAutoQuote, createAutoQuote } from './actions';
import { CalculatorIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

type BaseRow = { code: string; label: string; value: number };

const DEFAULT_BASE: BaseRow[] = [
  { code: 'TakeOff!A4', label: 'One Brick wall length (A4)', value: 0 },
  { code: 'TakeOff!B4', label: 'Half Brick wall length (B4)', value: 0 },
  { code: 'TakeOff!D4', label: 'Total Area (D4)', value: 0 },
  { code: 'TakeOff!E4', label: 'Verandah Area (E4)', value: 0 },
  { code: 'TakeOff!G4', label: 'Project Distance (G4)', value: 0 },
];

export default function AutoQuoteForm() {
  const [base, setBase] = useState<BaseRow[]>(DEFAULT_BASE);
  const [preview, setPreview] = useState<{ code: string; value: number }[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();
  const [quoteId, setQuoteId] = useState<string | null>(null);

  function setVal(i: number, v: number) {
    setBase((arr) => arr.map((r, idx) => (idx === i ? { ...r, value: v } : r)));
  }

  function toggle(code: string) {
    setSelected((s) => ({ ...s, [code]: !s[code] }));
  }

  async function onCompute() {
    start(async () => {
      const inputs = Object.fromEntries(base.map((r) => [r.code, r.value]));
      const out = await computeAutoQuote(inputs);
      setPreview(out.values);
      setSelected({});
    });
  }

  async function onCreate() {
    const picked = preview.filter((p) => selected[p.code]);
    start(async () => {
      const res = await createAutoQuote({
        baseInputs: Object.fromEntries(base.map((r) => [r.code, r.value])),
        include: picked,
      });
      setQuoteId(res.quoteId);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700 transition-all hover:shadow-md">
        <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-700">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
            <CalculatorIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Enter Base Inputs</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Provide measurements for auto-calculation</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {base.map((r, i) => (
            <div key={r.code} className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {r.label}
              </label>
              <input 
                type="number" 
                step="0.01" 
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400" 
                value={r.value}
                onChange={(e) => setVal(i, Number(e.target.value))} 
              />
            </div>
          ))}
        </div>
        
        <div className="mt-8 flex justify-end">
          <button 
            onClick={onCompute} 
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {pending ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Computing...
              </>
            ) : (
              <>
                <CalculatorIcon className="h-4 w-4" />
                Compute from Rules
              </>
            )}
          </button>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700 transition-all hover:shadow-md">
          <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-700">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Computed Values</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Select items to include in the quote</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {preview.map((p) => (
              <label key={p.code} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800">
                <input 
                  type="checkbox" 
                  checked={!!selected[p.code]} 
                  onChange={() => toggle(p.code)} 
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                />
                <div className="flex flex-1 justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.code}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{p.value}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button 
              onClick={onCreate} 
              disabled={pending || !Object.values(selected).some(Boolean)}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-4 focus:ring-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {pending ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  Create Quote
                </>
              )}
            </button>
            {quoteId && (
              <a 
                href={`/quotes/${quoteId}`}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-4 focus:ring-gray-200 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
              >
                Open created quote
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

