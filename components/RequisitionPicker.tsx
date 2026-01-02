/* // components/RequisitionPicker.tsx
'use client';
import React, { useState } from 'react';
import SubmitButton from '@/components/SubmitButton';

// types
type Line = {
  id: string;
  description: string;
  unit: string | null;
  qtyOrdered: number;
  purchased: number;
  remaining: number;
};

export default function RequisitionPicker({
  clientGrouped,
  projectId,
}: {
  clientGrouped: Record<string, Line[]>;
  projectId: string;
}) {
  // selected map lineId -> qtyRequested (0 = not included)
  const initial: Record<string, number> = {};
  for (const cat of Object.keys(clientGrouped)) {
    for (const ln of clientGrouped[cat]) {
      initial[ln.id] = 0;
    }
  }
  const [selected, setSelected] = useState<Record<string, number>>(initial);
  const [selecting, setSelecting] = useState(false);

  const toggleCategory = (cat: string, on: boolean) => {
    const copy = { ...selected };
    for (const ln of clientGrouped[cat]) {
      copy[ln.id] = on ? ln.remaining || 0 : 0;
    }
    setSelected(copy);
  };

  const toggleLine = (id: string, qty: number) => {
    setSelected((p) => ({ ...p, [id]: qty }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSelecting(true);
    try {
      const picks = Object.entries(selected)
        .filter(([, q]) => q > 0)
        .map(([quoteLineId, qtyRequested]) => ({ quoteLineId, qtyRequested }));

      if (picks.length === 0) {
        alert('Select at least one item or category to include.');
        setSelecting(false);
        return;
      }

      // call server action via fetch to a route/action (or uses form action server action)
      const res = await fetch('/api/requisitions/create-from-quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, picks }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Failed to create requisition');
      // redirect to requisition page
      window.location.href = `/procurement/requisitions/${json.requisitionId}`;
    } catch (err: any) {
      alert(err?.message ?? 'Error creating requisition');
    } finally {
      setSelecting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {Object.entries(clientGrouped).map(([cat, rows]) => {
        const allSelected = rows.every((r) => selected[r.id] && selected[r.id] > 0);
        const anySelected = rows.some((r) => selected[r.id] && selected[r.id] > 0);
        return (
          <div key={cat} className="rounded border bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{cat}</div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Select all</label>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleCategory(cat, e.target.checked)}
                />
              </div>
            </div>

            <div className="mt-2 grid gap-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{r.description}</div>
                    <div className="text-xs text-gray-500">
                      Ordered: {r.qtyOrdered} • Purchased: {r.purchased} • Remaining:{' '}
                      <b>{r.remaining}</b> {r.unit ?? ''}
                    </div>
                  </div>

                  <div className="w-36">
                    <input
                      type="number"
                      min={0}
                      max={r.remaining}
                      step="0.01"
                      value={selected[r.id] ?? 0}
                      onChange={(ev) =>
                        toggleLine(
                          r.id,
                          Math.max(0, Math.min(r.remaining, Number(ev.target.value) || 0))
                        )
                      }
                      className="w-full rounded border px-2 py-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div>
        <SubmitButton loadingText="Creating…">Create Requisition</SubmitButton>
      </div>
    </form>
  );
}
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';

type ReqLine = {
  id: string;
  description: string;
  unit?: string | null;
  qtyRequested?: number;
  qtyPurchased?: number;
  remaining?: number;
  category?: string | null;
  // any other fields you need to show
};

type GroupMap = Record<string, ReqLine[]>;

type Props = {
  // already grouped by server: { categoryName: [lines...] }
  clientGrouped: GroupMap;
  initiallySelected?: string[]; // line ids
  onChange?: (selectedIds: string[]) => void;
  showCounts?: boolean;
  // optional: disable some categories/lines by key
  disabled?: boolean;
};

export default function RequisitionPicker({
  clientGrouped,
  initiallySelected = [],
  onChange,
  showCounts = true,
  disabled = false,
}: Props) {
  // flat id list derived from clientGrouped
  const allLines = useMemo(() => {
    const arr: ReqLine[] = [];
    for (const group of Object.values(clientGrouped)) {
      for (const l of group) arr.push(l);
    }
    return arr;
  }, [clientGrouped]);

  const allIds = useMemo(() => allLines.map((l) => l.id), [allLines]);

  // selected map for O(1) toggles/lookups
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const id of allIds) m[id] = initiallySelected.includes(id);
    return m;
  });

  // ensure initial state updates if props change
  useEffect(() => {
    setSelectedMap((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const id of allIds) next[id] = initiallySelected.includes(id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiallySelected, JSON.stringify(Object.keys(clientGrouped))]);

  // derived: group -> fully selected boolean, and indeterminate
  const groupState = useMemo(() => {
    const out: Record<
      string,
      { all: boolean; some: boolean; total: number; selected: number }
    > = {};
    for (const [cat, items] of Object.entries(clientGrouped)) {
      const total = items.length;
      let sel = 0;
      for (const it of items) if (selectedMap[it.id]) sel++;
      out[cat] = { all: sel === total && total > 0, some: sel > 0 && sel < total, total, selected: sel };
    }
    return out;
  }, [clientGrouped, selectedMap]);

  // propagate selected ids to parent
  useEffect(() => {
    if (!onChange) return;
    const ids = Object.entries(selectedMap).filter(([, v]) => v).map(([k]) => k);
    onChange(ids);
  }, [selectedMap, onChange]);

  // toggle a single line
  const toggleLine = (id: string, value?: boolean) => {
    if (disabled) return;
    setSelectedMap((prev) => ({ ...prev, [id]: typeof value === 'boolean' ? value : !prev[id] }));
  };

  // toggle whole group
  const toggleGroup = (category: string, value?: boolean) => {
    if (disabled) return;
    const items = clientGrouped[category] ?? [];
    setSelectedMap((prev) => {
      const next = { ...prev };
      const setTo = typeof value === 'boolean' ? value : !groupState[category]?.all;
      for (const it of items) next[it.id] = setTo;
      return next;
    });
  };

  // global helpers
  const selectAll = (value: boolean) => {
    if (disabled) return;
    setSelectedMap(() => {
      const next: Record<string, boolean> = {};
      for (const id of allIds) next[id] = value;
      return next;
    });
  };

  const selectedCount = Object.values(selectedMap).filter(Boolean).length;
  const totalCount = allIds.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Select Requisition Items</div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>
            {selectedCount}/{totalCount}
          </span>
          <button
            type="button"
            onClick={() => selectAll(true)}
            className="text-indigo-600 hover:underline disabled:opacity-40"
            disabled={disabled}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => selectAll(false)}
            className="text-gray-600 hover:underline disabled:opacity-40"
            disabled={disabled}
          >
            Clear
          </button>
        </div>
      </div>

      {Object.entries(clientGrouped).map(([category, items]) => {
        const st = groupState[category] ?? { all: false, some: false, total: items.length, selected: 0 };
        return (
          <div key={category} className="rounded border bg-white p-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={st.all}
                  ref={(el) => {
                    if (!el) return;
                    el.indeterminate = !!st.some && !st.all;
                  }}
                  onChange={(e) => toggleGroup(category, e.target.checked)}
                  className="h-4 w-4"
                  disabled={disabled}
                />
                <span className="font-semibold">{category}</span>
                {showCounts && <span className="ml-2 text-xs text-gray-500">({st.selected}/{st.total})</span>}
              </label>

              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup(category)}
                  className="text-sm text-indigo-600 hover:underline disabled:opacity-40"
                  disabled={disabled}
                >
                  {st.all ? 'Unselect all' : 'Select all'}
                </button>
              </div>
            </div>

            <div className="mt-2 grid gap-2">
              {items.map((it) => {
                const remainingText =
                  typeof it.remaining === 'number' ? ` • remaining: ${it.remaining}` : it.qtyRequested ? ` • req: ${it.qtyRequested}` : '';
                return (
                  <label
                    key={it.id}
                    className="flex items-center justify-between gap-3 rounded px-2 py-2 hover:bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={!!selectedMap[it.id]}
                        onChange={(e) => toggleLine(it.id, e.target.checked)}
                        className="h-4 w-4"
                        disabled={disabled}
                      />
                      <div>
                        <div className="text-sm font-medium">{it.description}</div>
                        <div className="text-xs text-gray-500">
                          {it.unit ? `${it.unit}` : ''}
                          {remainingText}
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600">
                      {typeof it.qtyRequested === 'number' ? it.qtyRequested : ''}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}