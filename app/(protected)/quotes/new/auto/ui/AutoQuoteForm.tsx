"use client";
import { useState, useTransition } from 'react';
import { computeAutoQuote, createAutoQuote } from './actions';

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
      <div className="rounded border bg-white p-4 space-y-3">
        <div className="font-medium">Enter Base Inputs</div>
        <div className="grid grid-cols-2 gap-3">
          {base.map((r, i) => (
            <label key={r.code} className="flex items-center gap-2">
              <span className="w-56 text-sm text-gray-600">{r.label}</span>
              <input type="number" step="0.01" className="px-2 py-1 border rounded w-40" value={r.value}
                onChange={(e) => setVal(i, Number(e.target.value))} />
            </label>
          ))}
        </div>
        <button onClick={onCompute} className="px-3 py-1 bg-blue-600 text-white rounded" disabled={pending}>
          {pending ? 'Computing…' : 'Compute from Rules'}
        </button>
      </div>

      {preview.length > 0 && (
        <div className="rounded border bg-white p-4 space-y-3">
          <div className="font-medium">Computed Values (select to include as lines)</div>
          <div className="grid grid-cols-2 gap-2">
            {preview.map((p) => (
              <label key={p.code} className="flex items-center gap-2">
                <input type="checkbox" checked={!!selected[p.code]} onChange={() => toggle(p.code)} />
                <span className="w-72 text-sm text-gray-700">{p.code}</span>
                <span className="text-sm">{p.value}</span>
              </label>
            ))}
          </div>
          <button onClick={onCreate} className="px-3 py-1 bg-green-600 text-white rounded" disabled={pending || !Object.values(selected).some(Boolean)}>
            {pending ? 'Creating…' : 'Create Quote'}
          </button>
          {quoteId && (
            <div className="pt-2">
              <a className="underline text-blue-700" href={`/quotes/${quoteId}`}>Open created quote</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

