"use client";
import { useState } from 'react';
import QuoteBuilder from './QuoteBuilder';
import CalcBuilder from './CalcBuilder';

function ImportExcelBox() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setResult(json);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border p-4 bg-white space-y-2">
      <div className="font-medium">Import Excel (exc.xlsx)</div>
      <input type="file" accept=".xlsx" onChange={onUpload} disabled={busy} />
      {busy && <div className="text-sm text-gray-600">Uploading & parsing…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {result && (
        <div className="text-sm text-gray-700">
          Products: +{result.productsInserted}/~{result.productsUpdated}, Rules: +{result.rulesInserted}/~{result.rulesUpdated}
        </div>
      )}
    </div>
  );
}

export default function NewQuoteEverything() {
  const [tab, setTab] = useState<'manual' | 'calc'>('calc');
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          className={`px-3 py-1 rounded ${tab === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setTab('manual')}
        >
          Manual
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === 'calc' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setTab('calc')}
        >
          Calculator (Excel-like)
        </button>
      </div>

      {tab === 'manual' && (
        <div className="space-y-4">
          <QuoteBuilder />
        </div>
      )}

      {tab === 'calc' && (
        <div className="space-y-4">
          <CalcBuilder />
        </div>
      )}
    </div>
  );
}
