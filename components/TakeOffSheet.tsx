'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Parser } from 'expr-eval';
import { SHEET_COLUMNS, TAKEOFF_LAYOUT } from '@/lib/takeoffLayout';
import { createQuote, upsertCustomer } from '@/app/(protected)/actions';
import { QUOTE_LINE_MAP } from '@/lib/quoteMap';
import { evalExpr, normalizeContext, missingVars } from '@/lib/expr';
import ClearableNumberInput from './ClearableNumberInput';

const parser = new Parser({ allowMemberAccess: false });

const TAKEOFF_DEFAULTS: Record<string, number> = {
  A2: 3000,
  B2: 0.6,
  C2: 0.6,
  D2: 100,
};

type UnitMap = Record<string, string>; // code -> unit label (optional)

function varsFromExpr(expr: string): string[] {
  try {
    const ast = parser.parse(expr as any);
    // @ts-ignore expr-eval exposes .variables()
    const v = typeof ast.variables === 'function' ? ast.variables() : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function TakeOffSheet() {
  const [vals, setVals] = useState<Record<string, number>>({
    ...TAKEOFF_DEFAULTS,
    A4: 0,
    B4: 0,
    D4: 0,
    E4: 0,
    G4: 0,
  });
  const [tab, setTab] = useState<'materials' | 'labour'>('materials');
  const [units, setUnits] = useState<UnitMap>({});
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', city: '' });
  const [customerAddress, setCustomerAddress] = useState('');
  const [currency, setCurrency] = useState(process.env.NEXT_PUBLIC_CURRENCY || 'USD');
  const [vatRate, setVatRate] = useState<number>(parseFloat(process.env.VAT_DEFAULT || '0.15'));
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  type CustomItem = {
    description: string;
    unit: string;
    qty: number;
    rate: number;
    section: string;
  };
  const [customItems, setCustomItems] = useState<CustomItem[]>([
    { description: '', unit: '', qty: 0, rate: 0, section: '' },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  // Per-cell numeric literal overrides, by literal index
  const [constOverrides, setConstOverrides] = useState<Record<string, Record<number, number>>>({});
  const [editConst, setEditConst] = useState<{ code: string; index: number; value: string } | null>(
    null
  );

  // Find numeric literals that are not part of identifiers
  function findNumericLiterals(expr: string): { start: number; end: number; text: string }[] {
    const results: { start: number; end: number; text: string }[] = [];
    const re = /(\d+\.?\d*|\.\d+)/g; // 12, 12.34, .5
    let m: RegExpExecArray | null;
    while ((m = re.exec(expr))) {
      const start = m.index;
      const end = m.index + m[0].length;
      const before = expr[start - 1] || '';
      const after = expr[end] || '';
      const isPartOfIdent = /[A-Za-z_]/.test(before) || /[A-Za-z_]/.test(after);
      if (!isPartOfIdent) results.push({ start, end, text: m[0] });
    }
    return results;
  }

  function applyOverrides(expr: string, code: string): string {
    const lits = findNumericLiterals(expr);
    if (!lits.length) return expr;
    const overrides = constOverrides[code] || {};
    let out = '';
    let last = 0;
    lits.forEach((lit, i) => {
      out += expr.slice(last, lit.start);
      const val = overrides[i] ?? parseFloat(lit.text);
      out += String(val);
      last = lit.end;
    });
    out += expr.slice(last);
    return out;
  }

  function renderFormula(expr: string, code: string) {
    const lits = findNumericLiterals(expr);
    const overrides = constOverrides[code] || {};
    const parts: JSX.Element[] = [];
    let last = 0;
    lits.forEach((lit, i) => {
      const pre = expr.slice(last, lit.start);
      if (pre) parts.push(<span key={code + '-pre-' + i}>{pre}</span>);
      const shown = overrides[i] ?? lit.text;
      const editing = editConst && editConst.code === code && editConst.index === i;
      parts.push(
        <span
          key={code + '-num-' + i}
          className="text-blue-700 underline decoration-dotted cursor-pointer"
          onClick={() => setEditConst({ code, index: i, value: String(shown) })}
        >
          {editing ? (
            <ClearableNumberInput
              autoFocus
              allowEmpty
              className="w-20 px-1 py-0.5 border rounded"
              value={editConst.value}
              onChange={(e) => setEditConst({ code, index: i, value: e.currentTarget.value })}
              onBlur={() => {
                const num = Number(editConst?.value);
                setConstOverrides((prev) => ({
                  ...prev,
                  [code]: { ...(prev[code] || {}), [i]: num },
                }));
                setEditConst(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const num = Number(editConst?.value);
                  setConstOverrides((prev) => ({
                    ...prev,
                    [code]: { ...(prev[code] || {}), [i]: num },
                  }));
                  setEditConst(null);
                } else if (e.key === 'Escape') {
                  setEditConst(null);
                }
              }}
            />
          ) : (
            <>{String(shown)}</>
          )}
        </span>
      );
      last = lit.end;
    });
    const tail = expr.slice(last);
    if (tail) parts.push(<span key={code + '-tail'}>{tail}</span>);
    return <span>= {parts}</span>;
  }

  const [missingByCode, setMissingByCode] = useState<Record<string, string[]>>({});

  const { ctx: context, missing } = useMemo(() => {
    const ctx: Record<string, number> = { ...vals };
    const missing: Record<string, string[]> = {};
    // Multi-pass to allow dependencies
    let safety = 0;
    let progressed = true;
    while (progressed && safety++ < 120) {
      progressed = false;
      for (const row of TAKEOFF_LAYOUT) {
        if (row.type !== 'cells') continue;
        for (const cell of row.cells) {
          if (!cell || cell.kind !== 'calc' || !cell.expr) continue;
          try {
            // Track missing refs first
            const modified = applyOverrides(cell.expr, cell.code);
            const req = varsFromExpr(modified).filter(
              (v) => ctx[v] === undefined || Number.isNaN(ctx[v])
            );
            if (req.length) {
              missing[cell.code] = req;
            } else if (missing[cell.code]) {
              delete missing[cell.code];
            }
            const v = parser.evaluate(modified, ctx);
            if (Number.isFinite(v)) {
              if (ctx[cell.code] !== v) {
                ctx[cell.code] = Number(v);
                progressed = true;
              }
            }
          } catch {}
        }
      }
    }
    return { ctx, missing };
  }, [vals, constOverrides]);

  useEffect(() => {
    setMissingByCode(missing);
  }, [missing]);

  function rowsForTab() {
    const idxLabour = TAKEOFF_LAYOUT.findIndex(
      (r) => r.type === 'heading' && r.title.toUpperCase().includes('LABOUR')
    );
    if (idxLabour === -1) return TAKEOFF_LAYOUT;
    if (tab === 'materials') return TAKEOFF_LAYOUT.slice(0, idxLabour);
    return TAKEOFF_LAYOUT.slice(idxLabour);
  }

  // async function onCreateQuote() {
  //   setCreating(true);
  //   try {
  //     setFormError(null);
  //     const { customerId } = await upsertCustomer({
  //       displayName: customer.name || 'Walk-in Customer',
  //       email: customer.email || null,
  //       phone: customer.phone || null,
  //     });
  //     // Prefer explicit mapping: codes -> description/unit/rate
  //     const lines: any[] = [];
  //     for (const m of QUOTE_LINE_MAP) {
  //       const qty = context[m.code];
  //       if (!Number.isFinite(qty) || qty <= 0) continue;
  //       lines.push({
  //         description: m.description,
  //         quantity: Number(qty),
  //         unitPrice: m.rate ?? 0,
  //         metaJson: {
  //           unit: m.unit || '',
  //           code: m.code,
  //           label: m.description,
  //           section: m.section || null,
  //           from: 'TakeOffSheet',
  //         },
  //       });
  //     }

  //     // Note: removed fallback auto-inclusion of all worksheet cells.
  //     // Only include explicitly mapped items and manual rows.
  //     // Append manual items
  //     for (const ci of customItems) {
  //       if (!ci.description || !(Number.isFinite(ci.qty) && ci.qty > 0)) continue;
  //       lines.push({
  //         description: ci.description,
  //         quantity: Number(ci.qty),
  //         unitPrice: Number(ci.rate || 0),
  //         metaJson: {
  //           unit: ci.unit || '',
  //           code: 'MANUAL',
  //           label: ci.description,
  //           section: ci.section || 'CUSTOM',
  //           from: 'Manual',
  //         },
  //       });
  //     }
  //     if (lines.length === 0) {
  //       setFormError('No items to include. Enter inputs so at least one value is > 0.');
  //       return; // do not proceed
  //     }
  //     const res = await createQuote({
  //       customerId,
  //       currency,
  //       vatRate,
  //       discountPolicy: 'none',
  //       lines,
  //     });
  //     router.push(`/quotes/${res.quoteId}`);
  //   } finally {
  //     setCreating(false);
  //   }
  // }
  // Preview: count of items with qty > 0

  async function onCreateQuote() {
    setCreating(true);
    try {
      setFormError(null);

      const { customerId } = await upsertCustomer({
        displayName: customer.name || 'Walk-in Customer',
        city: customer.city || null,
        email: customer.email || null,
        phone: customer.phone || null,
        addressJson: customerAddress ? JSON.stringify({ line1: customerAddress }) : null,
      });

      // 1) normalize once for case-insensitive, numeric-safe lookups
      const ctx = normalizeContext(context);

      const lines: any[] = [];

      // 2) compute qty from expressions
      for (const m of QUOTE_LINE_MAP) {
        console.log(m);
        const qty = evalExpr(ctx, m.code); // handles A36, A36+A25, D22+D33+G22, J22*0.05, A4/3*3.6, etc.

        console.log('qty', m.code, '==>', qty);
        if (!(qty > 0)) continue;

        // (optional) debug missing variables
        // const miss = missingVars(m.code, ctx);
        // if (miss.length) console.warn(`Missing in '${m.code}':`, miss);

        lines.push({
          description: m.description,
          quantity: Math.ceil(Number(qty)),
          unitPrice: m.rate ?? 0,
          metaJson: {
            unit: m.unit || '',
            code: m.code,
            label: m.description,
            section: m.section || null,
            from: 'TakeOffSheet',
          },
        });
      }

      // Manual items unchanged
      for (const ci of customItems) {
        if (!ci.description || !(Number.isFinite(ci.qty) && ci.qty > 0)) continue;
        lines.push({
          description: ci.description,
          quantity: Math.ceil(Number(ci.qty)),
          unitPrice: Number(ci.rate || 0),
          metaJson: {
            unit: ci.unit || '',
            code: 'MANUAL',
            label: ci.description,
            section: ci.section || 'CUSTOM',
            from: 'Manual',
          },
        });
      }

      if (lines.length === 0) {
        setFormError('No items to include. Enter inputs so at least one value is > 0.');
        return;
      }

      const res = await createQuote({
        customerId,
        currency,
        vatRate,
        discountPolicy: 'none',
        lines,
      });

      router.push(`/quotes/${res.quoteId}`);
    } finally {
      setCreating(false);
    }
  }

  const itemCount = (() => {
    let n = 0;
    for (const row of TAKEOFF_LAYOUT) {
      if (row.type !== 'cells') continue;
      for (const cell of row.cells) {
        if (!cell || !cell.label || cell.label.trim() === '') continue;
        const qty = context[cell.code];
        if (Number.isFinite(qty) && qty > 0) n += 1;
      }
    }
    // Include custom items
    n += customItems.filter((ci) => Number.isFinite(ci.qty) && ci.qty > 0 && ci.description).length;
    return n;
  })();

  return (
    <div className="space-y-4">
      {/* Customer & Settings at top */}
      <div className="grid grid-cols-5 gap-2 bg-white dark:bg-gray-800 p-3 border rounded dark:border-gray-700">
        <div className="col-span-5 font-medium">Customer & Settings</div>
        <input
          className="px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
          placeholder="Customer name"
          value={customer.name}
          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
        />
        <input
          className="px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
          placeholder="Email"
          value={customer.email}
          onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
        />
        <input
          className="px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
          placeholder="Phone"
          value={customer.phone}
          onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
        />
        <input
          className="px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
          placeholder="City"
          value={customer.city}
          onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
        />
        <textarea
          className="col-span-3 px-2 py-1 border rounded"
          placeholder="Physical Address"
          rows={3}
          value={customerAddress}
          onChange={(e) => setCustomerAddress(e.target.value)}
        />

        {/*  <input
          className="px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
          placeholder="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        />
        <input
          type="number"
          step="0.0001"
          className="px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
          placeholder="VAT (e.g., 0.15)"
          value={vatRate}
          onChange={(e) => setVatRate(Number(e.target.value))}
        /> */}
      </div>

      <div className="space-y-2">
        {formError && (
          <div className="border border-red-300 bg-red-50 text-red-700 rounded p-2 text-sm">
            {formError}
          </div>
        )}
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 rounded ${tab === 'materials' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setTab('materials')}
          >
            Materials
          </button>
          <button
            className={`px-3 py-1 rounded ${tab === 'labour' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setTab('labour')}
          >
            Labour
          </button>
          <button
            className="ml-auto px-3 py-1 rounded border bg-white dark:bg-gray-800 dark:border-gray-700"
            onClick={async () => {
              const res = await fetch('/takeoff/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: vals, label: `takeoff-${Date.now()}` }),
              });
              if (!res.ok) return alert('Export failed');
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `takeoff-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }}
          >
            Generate Excel
          </button>
        </div>
        {rowsForTab().map((row, rIdx) => {
          if (row.type === 'heading') {
            return (
              <div
                key={rIdx}
                className="font-extrabold text-xl pt-4 bg-gray-100 dark:bg-gray-900/40 px-2 py-1 border dark:border-gray-700 text-gray-900 dark:text-gray-100"
              >
                {row.title}
              </div>
            );
          }
          if (row.type === 'subheading') {
            return (
              <div
                key={rIdx}
                className="font-bold text-base pt-2 bg-gray-50 dark:bg-gray-900/30 px-2 py-1 border dark:border-gray-700 text-gray-800 dark:text-gray-200"
              >
                {row.title}
              </div>
            );
          }
          const isMaterials = tab === 'materials';
          const visibleCells =
            row.type === 'cells'
              ? row.cells.filter((c) => c && c.label && c.label.trim() !== '' && c.kind === 'input')
              : [];
          if (row.type === 'cells' && visibleCells.length === 0) return null;
          const cols = Math.max(1, visibleCells.length);
          return (
            <div
              key={rIdx}
              className="grid"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {visibleCells.map((cell, cIdx) => {
                const isInput = cell!.kind === 'input';
                const defaultVal = TAKEOFF_DEFAULTS[cell!.code] ?? 0;
                const value = isInput
                  ? (vals[cell!.code] ?? defaultVal)
                  : (context as any)[cell!.code];
                return (
                  <div
                    key={cIdx}
                    className={`border border-gray-300 dark:border-gray-700 p-2 h-28 flex flex-col justify-between bg-white dark:bg-gray-800`}
                  >
                    <div className="font-semibold text-sm">{cell!.label}</div>
                    <div>
                      {isInput ? (
                        cell!.code === 'A2' ? (
                          <select
                            className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            value={value ?? TAKEOFF_DEFAULTS.A2}
                            onChange={(e) =>
                              setVals((v) => ({ ...v, [cell!.code]: Number(e.target.value) }))
                            }
                          >
                            {[3000, 5000, 7000].map((option) => (
                              <option key={option} value={option}>
                                {option.toLocaleString()}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <ClearableNumberInput
                            type="number"
                            step={cell!.code === 'B2' || cell!.code === 'C2' ? 0.01 : 'any'}
                            className="w-full border border-gray-300 px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            value={Number.isFinite(value) ? (value as number) : ''}
                            placeholder={String(TAKEOFF_DEFAULTS[cell!.code] ?? 0)}
                            onChange={(e) => {
                              const raw = e.currentTarget.value;
                              setVals((v) => ({
                                ...v,
                                [cell!.code]: raw === '' ? Number.NaN : Number(raw),
                              }));
                            }}
                          />
                        )
                      ) : (
                        <>
                          <div className="text-red-600 font-semibold">
                            {Number.isFinite(value) ? Number((value as number).toFixed(4)) : '—'}
                          </div>
                          {!!missingByCode[cell!.code]?.length && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              Needs: {missingByCode[cell!.code].join(', ')}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      {cell!.expr ? (
                        <div className="text-red-500 font-mono">
                          {renderFormula(cell!.expr!, cell!.code)}
                        </div>
                      ) : (
                        <span />
                      )}
                      <span />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {Object.keys(missingByCode).length > 0 && (
        <div className="border rounded p-3 bg-white dark:bg-gray-800 dark:border-gray-700">
          <div className="font-medium mb-2">Unresolved Inputs</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            Enter values for these referenced cells to compute all formulas.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Array.from(new Set(Object.values(missingByCode).flat()))
              .filter((code) => vals[code] === undefined) // show only ones not already inputs
              .map((code) => (
                <label key={code} className="text-xs flex items-center gap-2">
                  <span className="w-12 font-mono text-gray-500 dark:text-gray-400">{code}</span>
                  <ClearableNumberInput
                    className="flex-1 border border-gray-300 px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                    value={Number.isFinite(vals[code]) ? vals[code] : ''}
                    onChange={(e) => {
                      const raw = e.currentTarget.value;
                      setVals((v) => ({
                        ...v,
                        [code]: raw === '' ? Number.NaN : Number(raw),
                      }));
                    }}
                  />
                </label>
              ))}
          </div>
        </div>
      )}

      {/* Manual additional items (e.g., Electrical materials) */}
      <div className="border rounded p-3 bg-white dark:bg-gray-800 dark:border-gray-700 space-y-2">
        <div className="font-medium">Manual Items (optional)</div>
        <table className="w-full text-sm border border-gray-300 dark:border-gray-700">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-900/30 text-left">
              <th className="px-2 py-1">Description</th>
              <th className="px-2 py-1 w-24">Unit</th>
              <th className="px-2 py-1 w-24">Qty</th>
              <th className="px-2 py-1 w-24">Rate</th>
              <th className="px-2 py-1 w-48">Section</th>
              <th className="px-2 py-1 w-20">Action</th>
            </tr>
          </thead>
          <tbody>
            {customItems.map((ci, idx) => (
              <tr key={idx} className="border-t dark:border-gray-700">
                <td className="px-2 py-1">
                  <input
                    className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    value={ci.description}
                    onChange={(e) =>
                      setCustomItems((arr) =>
                        arr.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x))
                      )
                    }
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    value={ci.unit}
                    onChange={(e) =>
                      setCustomItems((arr) =>
                        arr.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x))
                      )
                    }
                  />
                </td>
                <td className="px-2 py-1">
                  <ClearableNumberInput
                    className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    value={Number.isFinite(ci.qty) ? ci.qty : ''}
                    onChange={(e) => {
                      const raw = e.currentTarget.value;
                      setCustomItems((arr) =>
                        arr.map((x, i) =>
                          i === idx ? { ...x, qty: raw === '' ? Number.NaN : Number(raw) } : x
                        )
                      );
                    }}
                  />
                </td>
                <td className="px-2 py-1">
                  <ClearableNumberInput
                    className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    value={Number.isFinite(ci.rate) ? ci.rate : ''}
                    onChange={(e) => {
                      const raw = e.currentTarget.value;
                      setCustomItems((arr) =>
                        arr.map((x, i) =>
                          i === idx ? { ...x, rate: raw === '' ? Number.NaN : Number(raw) } : x
                        )
                      );
                    }}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    placeholder="e.g., ELECTRICAL"
                    value={ci.section}
                    onChange={(e) =>
                      setCustomItems((arr) =>
                        arr.map((x, i) => (i === idx ? { ...x, section: e.target.value } : x))
                      )
                    }
                  />
                </td>
                <td className="px-2 py-1">
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() => setCustomItems((arr) => arr.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <button
            type="button"
            className="px-3 py-1 bg-gray-800 text-white rounded"
            onClick={() =>
              setCustomItems((arr) => [
                ...arr,
                { description: '', unit: '', qty: 0, rate: 0, section: '' },
              ])
            }
          >
            Add Row
          </button>
        </div>
      </div>

      <div className="border rounded p-3 bg-white dark:bg-gray-800 dark:border-gray-700 flex items-center justify-around">
        {/*  <div className="font-semibold">
           Items to include (qty {'>'} 0): {itemCount}
        </div> */}
        <button
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          disabled={creating}
          onClick={onCreateQuote}
        >
          {creating ? 'Generating…' : 'Generate Quotation'}
        </button>
      </div>

      {/* Extra space at the end to keep bottom button visible when scrolling */}
      <div className="h-32" />
    </div>
  );
}
