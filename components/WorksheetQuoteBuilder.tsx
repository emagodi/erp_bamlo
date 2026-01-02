'use client';
import { useMemo, useState, useTransition } from 'react';
import { WORKSHEET_SECTIONS } from '@/lib/worksheetConfig';
import { createQuote, upsertCustomer } from '@/app/(protected)/actions';

type RowState = { qty: number; rate: number };

export default function WorksheetQuoteBuilder() {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const sec of WORKSHEET_SECTIONS) {
      for (const it of sec.items) init[it.id] = { qty: 0, rate: it.defaultRate };
    }
    return init;
  });
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', city: '' });
  const [currency, setCurrency] = useState(process.env.NEXT_PUBLIC_CURRENCY || 'USD');
  const [vatRate, setVatRate] = useState<number>(parseFloat(process.env.VAT_DEFAULT || '0.15'));
  const [pending, start] = useTransition();
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [customerAddress, setCustomerAddress] = useState('');

  const sectionTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const sec of WORKSHEET_SECTIONS) {
      let t = 0;
      for (const it of sec.items) {
        const s = rows[it.id];
        if (!s) continue;
        t += (s.qty || 0) * (s.rate || 0);
      }
      totals[sec.key] = t;
    }
    return totals;
  }, [rows]);

  const grand = useMemo(
    () => Object.values(sectionTotals).reduce((a, b) => a + b, 0),
    [sectionTotals]
  );

  function setQty(id: string, qty: number) {
    setRows((r) => ({ ...r, [id]: { ...(r[id] || { qty: 0, rate: 0 }), qty } }));
  }
  function setRate(id: string, rate: number) {
    setRows((r) => ({ ...r, [id]: { ...(r[id] || { qty: 0, rate: 0 }), rate } }));
  }

  async function onCreate() {
    start(async () => {
      const { customerId } = await upsertCustomer({
        displayName: customer.name || 'Walk-in Customer',
        city: customer.city || null,
        email: customer.email || null,
        phone: customer.phone || null,
        addressJson: customerAddress ? JSON.stringify({ line1: customerAddress }) : null,
      });
      const lines: any[] = [];
      for (const sec of WORKSHEET_SECTIONS) {
        for (const it of sec.items) {
          const s = rows[it.id];
          if (!s || !s.qty) continue;
          lines.push({
            description: it.description,
            quantity: s.qty,
            unitPrice: s.rate,
            metaJson: { section: sec.title, unit: it.unit, itemId: it.id },
          });
        }
      }
      const res = await createQuote({
        customerId,
        currency,
        vatRate,
        discountPolicy: 'none',
        lines,
      });
      setQuoteId(res.quoteId);
    });
  }

  return (
    <div className="space-y-6">
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

        <textarea
          className="col-span-3 px-2 py-1 border rounded"
          placeholder="Physical Address"
          rows={3}
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

      {WORKSHEET_SECTIONS.map((sec, sIdx) => (
        <div key={sec.key} className="rounded border bg-white p-4">
          <div className="text-lg font-semibold">{sec.title}</div>
          {sec.note && <div className="text-sm text-gray-600 mb-2">{sec.note}</div>}
          <table className="w-full text-sm border border-gray-300 border-collapse table-fixed">
            <thead>
              <tr className="text-left bg-gray-100">
                <th className="py-1 px-2 w-16 border border-gray-300">Item</th>
                <th className="px-2 border border-gray-300">Description</th>
                <th className="px-2 w-20 border border-gray-300">Unit</th>
                <th className="px-2 w-24 border border-gray-300">Qty</th>
                <th className="px-2 w-28 border border-gray-300">Rate</th>
                <th className="px-2 w-28 border border-gray-300">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sec.items.map((it, iIdx) => {
                const idx = iIdx + 1;
                const st = rows[it.id] || { qty: 0, rate: it.defaultRate };
                const amt = (st.qty || 0) * (st.rate || 0);
                return (
                  <tr key={it.id}>
                    <td className="py-1 px-2 border border-gray-300">{idx}</td>
                    <td className="py-1 px-2 border border-gray-300">{it.description}</td>
                    <td className="py-1 px-2 border border-gray-300">{it.unit}</td>
                    <td className="py-1 px-2 border border-gray-300">
                      <input
                        type="number"
                        className="px-2 py-1 border rounded w-full"
                        value={st.qty}
                        onChange={(e) => setQty(it.id, Number(e.target.value))}
                      />
                    </td>
                    <td className="py-1 px-2 border border-gray-300">
                      <input
                        type="number"
                        className="px-2 py-1 border rounded w-full"
                        value={st.rate}
                        onChange={(e) => setRate(it.id, Number(e.target.value))}
                      />
                    </td>
                    <td className="py-1 px-2 border border-gray-300 text-right">
                      {amt.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td
                  colSpan={5}
                  className="text-right font-semibold py-2 px-2 border border-gray-300"
                >
                  Total Carried to Summary
                </td>
                <td className="font-semibold px-2 border border-gray-300 text-right">
                  {sectionTotals[sec.key].toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      <div className="rounded border bg-white p-4">
        <div className="text-right text-lg font-semibold">
          Grand Total (ex VAT): {grand.toFixed(2)}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={onCreate}
          disabled={pending}
        >
          {pending ? 'Creating…' : 'Create Quote'}
        </button>
        {quoteId && (
          <a className="px-4 py-2 bg-gray-200 rounded" href={`/quotes/${quoteId}`}>
            Open Quote
          </a>
        )}
      </div>
    </div>
  );
}
