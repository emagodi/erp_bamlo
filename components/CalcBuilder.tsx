'use client';
import { useEffect, useMemo, useState } from 'react';
import { Parser } from 'expr-eval';
import { CALC_FIELDS } from '@/lib/calcConfig';
import { createQuote, upsertCustomer } from '@/app/(protected)/actions';

type RowUI = {
  code: string;
  label: string;
  section: 'MATERIALS' | 'LABOUR';
  group?: string;
  kind: 'input' | 'calc';
};

const parser = new Parser({ allowMemberAccess: false });

export default function CalcBuilder() {
  const rows: RowUI[] = CALC_FIELDS;
  const [values, setValues] = useState<Record<string, number>>({});
  const [include, setInclude] = useState<Record<string, boolean>>({});
  const [unit, setUnit] = useState<Record<string, number>>({});

  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', city: '' });
  const [customerAddress, setCustomerAddress] = useState('');
  const [currency, setCurrency] = useState(process.env.NEXT_PUBLIC_CURRENCY || 'USD');
  const [vatRate, setVatRate] = useState<number>(parseFloat(process.env.VAT_DEFAULT || '0.15'));
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Initialize input defaults
  useEffect(() => {
    const init: Record<string, number> = {};
    for (const r of rows) if (r.kind === 'input') init[r.code] = init[r.code] ?? 0;
    setValues((v) => ({ ...init, ...v }));
  }, []);

  // Compute derived values whenever inputs change
  const computedValues = useMemo(() => {
    const context: Record<string, number> = { ...values };
    const remaining = CALC_FIELDS.filter((f) => f.kind === 'calc').map((f) => f.code);
    let guard = 0;
    while (remaining.length && guard++ < 100) {
      let progressed = false;
      for (let i = 0; i < remaining.length; i++) {
        const code = remaining[i];
        const f = CALC_FIELDS.find((x) => x.code === code)!;
        if (!f.expr) continue;
        try {
          const val = parser.evaluate(f.expr, context);
          if (Number.isFinite(val)) {
            context[code] = Number(val);
            remaining.splice(i, 1);
            i--;
            progressed = true;
          }
        } catch {}
      }
      if (!progressed) break;
    }
    return context;
  }, [values]);

  async function onCreateQuote() {
    setCreating(true);
    try {
      const { customerId } = await upsertCustomer({
        displayName: customer.name || 'Walk-in Customer',
        city: customer.city || null,
        email: customer.email || null,
        phone: customer.phone || null,
        address: customerAddress || null,
      });
      // Build lines from included rows
      const lines = Object.keys(include)
        .filter((code) => include[code])
        .map((code) => ({
          description: `${code} - ${rows.find((r) => r.code === code)?.label || ''}`.trim(),
          quantity: 1,
          unitPrice: unit[code] ?? 0,
        }));
      const res = await createQuote({
        customerId,
        currency,
        vatRate,
        discountPolicy: 'none',
        lines,
      });
      setCreatedId(res.quoteId);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Settings */}
      <div className="grid grid-cols-3 gap-3 bg-white p-4 border rounded">
        <div className="col-span-3 font-medium">Customer & Settings</div>
        <input
          className="px-2 py-1 border rounded"
          placeholder="Customer name"
          value={customer.name}
          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
        />
        <input
          className="px-2 py-1 border rounded"
          placeholder="Email"
          value={customer.email}
          onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
        />
        <input
          className="px-2 py-1 border rounded"
          placeholder="Phone"
          value={customer.phone}
          onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
        />
        <input
          className="px-2 py-1 border rounded"
          placeholder="City"
          value={customer.city}
          onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
        />
        <input
          className="px-2 py-1 border rounded"
          placeholder="Location / Address"
          value={customerAddress}
          onChange={(e) => setCustomerAddress(e.target.value)}
        />

        {/* <input
          className="px-2 py-1 border rounded"
          placeholder="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        />
        <input
          type="number"
          step="0.0001"
          className="px-2 py-1 border rounded"
          placeholder="VAT Rate (e.g., 0.15)"
          value={vatRate}
          onChange={(e) => setVatRate(Number(e.target.value))}
        /> */}
      </div>

      {/* Grid */}
      {(['MATERIALS', 'LABOUR'] as const).map((section) => (
        <div key={section} className="rounded border bg-white p-4">
          <div className="text-lg font-semibold mb-2">{section}</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1">Group</th>
                <th>Code</th>
                <th>Label</th>
                <th>Value</th>
                <th>Include</th>
                <th>Unit Price</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.section === section)
                .map((r) => (
                  <tr key={r.code} className="border-b">
                    <td className="py-1 text-gray-500">{r.group || ''}</td>
                    <td className="py-1 font-mono text-xs">{r.code}</td>
                    <td className="py-1">{r.label}</td>
                    <td className="py-1">
                      {r.kind === 'input' ? (
                        <input
                          type="number"
                          className="px-2 py-1 border rounded w-32"
                          value={values[r.code] ?? 0}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [r.code]: Number(e.target.value) }))
                          }
                        />
                      ) : (
                        <span>
                          {Number.isFinite(computedValues[r.code]) ? computedValues[r.code] : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-1 text-center">
                      <input
                        type="checkbox"
                        checked={!!include[r.code]}
                        onChange={(e) => setInclude((s) => ({ ...s, [r.code]: e.target.checked }))}
                      />
                    </td>
                    <td className="py-1">
                      <input
                        type="number"
                        className="px-2 py-1 border rounded w-32"
                        value={unit[r.code] ?? 0}
                        onChange={(e) =>
                          setUnit((u) => ({ ...u, [r.code]: Number(e.target.value) }))
                        }
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="flex gap-2">
        <button
          onClick={onCreateQuote}
          disabled={creating}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          {creating ? 'Creating…' : 'Create Quote'}
        </button>
        {createdId && (
          <a className="px-4 py-2 bg-gray-200 rounded" href={`/quotes/${createdId}`}>
            Open Quote
          </a>
        )}
      </div>
    </div>
  );
}
