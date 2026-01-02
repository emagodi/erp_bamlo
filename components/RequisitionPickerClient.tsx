'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ClearableNumberInput from './ClearableNumberInput';

type LineRow = {
  id: string;
  qtyOrdered: number;
  description: string;
  unit?: string | null;
  purchased: number;
  remaining: number;
  alreadyRequested: number;
  category: string;
  approvedExtra: number;
};

type ExtraRequestRow = {
  id: string;
  qty: number;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requiresAdmin: boolean;
  requestedByName: string;
  requestedByRole?: string | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  createdAt: string;
};

type Props = {
  clientGrouped: Record<string, LineRow[]>;
  initiallySelected?: { quoteLineId: string; qty: number }[];
  projectId: string;
  currentRole?: string | null;
  requestsByLine: Record<string, ExtraRequestRow[]>;
};

type ExtraModalState =
  | { mode: 'request'; line: LineRow }
  | { mode: 'review'; line: LineRow; request: ExtraRequestRow };

const REQUEST_ROLES = new Set(['PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN']);
const REVIEW_ROLES = new Set(['SENIOR_PM', 'ADMIN']);

export default function RequisitionPickerClient({
  clientGrouped,
  initiallySelected = [],
  projectId,
  currentRole,
  requestsByLine,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [catSelectAll, setCatSelectAll] = useState<Record<string, boolean>>({});
  const [extraModal, setExtraModal] = useState<ExtraModalState | null>(null);
  const [modalDraft, setModalDraft] = useState<{ qty: string; reason: string }>({ qty: '', reason: '' });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const categories = useMemo(() => Object.keys(clientGrouped), [clientGrouped]);
  const flat = useMemo(() => categories.flatMap((cat) => clientGrouped[cat] || []), [categories, clientGrouped]);
  const idxToId = useMemo(() => flat.map((l) => l.id), [flat]);

  useEffect(() => {
    const initialSelected = new Set(initiallySelected.map((row) => row.quoteLineId));
    const sel: Record<string, boolean> = {};
    const q: Record<string, number> = {};
    const catAll: Record<string, boolean> = {};
    for (const [cat, lines] of Object.entries(clientGrouped)) {
      catAll[cat] = false;
      for (const ln of lines) {
        const defaultQty = ln.remaining > 0 ? ln.remaining : 0;
        const isInit = initialSelected.has(ln.id);
        sel[ln.id] = selected[ln.id] ?? isInit;
        q[ln.id] =
          ln.id in qtys
            ? qtys[ln.id]
            : isInit
              ? Math.max(0, initiallySelected.find((row) => row.quoteLineId === ln.id)?.qty ?? defaultQty)
              : defaultQty;
      }
    }
    setSelected(sel);
    setQtys(q);
    setCatSelectAll(catAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientGrouped]);

  const syncCategoryState = (id: string, updated: Record<string, boolean>) => {
    for (const [cat, lines] of Object.entries(clientGrouped)) {
      if (lines.some((l) => l.id === id)) {
        const all = lines.every((ln) => updated[ln.id]);
        setCatSelectAll((prev) => ({ ...prev, [cat]: all }));
        break;
      }
    }
  };

  const toggleLine = (id: string) => {
    setSelected((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      syncCategoryState(id, next);
      return next;
    });
  };

  const onQtyChange = (id: string, raw: string, max: number) => {
    let n = Number(raw);
    if (!Number.isFinite(n)) n = 0;
    n = Math.ceil(n);
    if (n < 0) n = 0;
    if (n > max) n = max;
    setQtys((prev) => ({ ...prev, [id]: n }));
    setSelected((prev) => {
      const next = { ...prev, [id]: n > 0 };
      syncCategoryState(id, next);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    const lines = clientGrouped[cat] ?? [];
    const newVal = !catSelectAll[cat];
    setCatSelectAll((prev) => ({ ...prev, [cat]: newVal }));
    setSelected((prev) => {
      const next = { ...prev };
      for (const ln of lines) next[ln.id] = newVal;
      return next;
    });
    setQtys((prev) => {
      const next = { ...prev };
      for (const ln of lines) {
        if (newVal) {
          const fallback = next[ln.id];
          const numericRaw = Number(fallback);
          const numeric = Number.isFinite(numericRaw) ? numericRaw : ln.remaining;
          next[ln.id] = Math.min(ln.remaining, Math.max(0, numeric));
        } else {
          next[ln.id] = 0;
        }
      }
      return next;
    });
  };

  const canRequestMore = REQUEST_ROLES.has(currentRole ?? '');

  const openNewRequestModal = (line: LineRow) => {
    setModalDraft({ qty: '', reason: '' });
    setModalError(null);
    setExtraModal({ mode: 'request', line });
  };

  const openReviewModal = (line: LineRow, request: ExtraRequestRow) => {
    setModalError(null);
    setExtraModal({ mode: 'review', line, request });
  };

  const submitExtraRequest = () => {
    if (!extraModal || extraModal.mode !== 'request') return;
    const qty = Number(modalDraft.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setModalError('Enter a quantity greater than zero.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/quote-lines/${extraModal.line.id}/extra-request`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ qty, reason: modalDraft.reason }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setModalError(data?.error ?? 'Failed to request more');
          return;
        }
        setExtraModal(null);
        router.refresh();
      } catch (err: any) {
        setModalError(err?.message ?? 'Failed to request more');
      }
    });
  };

  const decideExtraRequest = (approve: boolean) => {
    if (!extraModal || extraModal.mode !== 'review') return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/quote-line-extra/${extraModal.request.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ approve }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setModalError(data?.error ?? 'Failed to update request');
          return;
        }
        setExtraModal(null);
        router.refresh();
      } catch (err: any) {
        setModalError(err?.message ?? 'Failed to update request');
      }
    });
  };

  const closeModal = () => {
    setExtraModal(null);
    setModalError(null);
  };

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat} className="rounded border bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{cat}</div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(catSelectAll[cat])}
                onChange={() => toggleCategory(cat)}
              />
              <span>Select all</span>
            </label>
          </div>

          <div className="mt-3 space-y-2">
            {(clientGrouped[cat] || []).map((ln) => {
              const idx = idxToId.indexOf(ln.id);
              const namePrefix = `pick-${idx}`;
              const isSelected = Boolean(selected[ln.id]);
              const currentQty = qtys[ln.id] ?? 0;
              const lineRequests = requestsByLine[ln.id] ?? [];
              const pendingRequest = lineRequests.find((req) => req.status === 'PENDING');
              const approvedSum = lineRequests
                .filter((req) => req.status === 'APPROVED')
                .reduce((sum, req) => sum + req.qty, 0);
              const latestApproval = lineRequests.find((req) => req.status === 'APPROVED');
              const canReviewPending =
                pendingRequest &&
                (pendingRequest.requiresAdmin
                  ? currentRole === 'ADMIN'
                  : REVIEW_ROLES.has(currentRole ?? ''));

              const canShowRequestButton =
                canRequestMore && ln.remaining <= 0 && !pendingRequest;
              const safeMax = Math.max(0, ln.remaining);

              return (
                <div key={ln.id} className="space-y-2 rounded border px-2 py-2">
                  <div className="flex items-start gap-3">
                    <label className="inline-flex w-64 items-start gap-2">
                      <input
                        name={`${namePrefix}-include`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLine(ln.id)}
                      />
                      <div>
                        <div className="text-sm font-medium">{ln.description}</div>
                        <div className="text-xs text-gray-500">
                          Ordered: {ln.qtyOrdered} :: Purchased: {ln.purchased} :: Requested:{' '}
                          {ln.alreadyRequested} :: Remaining: {ln.remaining} {ln.unit ?? ''}
                        </div>
                        {ln.approvedExtra > 0 && (
                          <div className="text-xs text-emerald-600">
                            Approved additions: +{ln.approvedExtra} {ln.unit ?? ''}
                          </div>
                        )}
                        {pendingRequest ? (
                          <div className="text-xs text-amber-600">
                            Pending +{pendingRequest.qty} {ln.unit ?? ''} request by{' '}
                            {pendingRequest.requestedByName} (
                            {pendingRequest.requiresAdmin ? 'awaiting Admin' : 'awaiting Senior PM'} approval)
                          </div>
                        ) : null}
                        {!pendingRequest && approvedSum > 0 && (
                          <div className="text-xs text-emerald-600">
                            Latest approval by {latestApproval?.decidedByName ?? 'Senior PM'}
                          </div>
                        )}
                      </div>
                    </label>
                    <div className="text-xs text-gray-500">{ln.unit ?? ''}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name={`${namePrefix}-quoteLineId`} value={ln.id} />
                    <ClearableNumberInput
                      name={`${namePrefix}-qty`}
                      type="text"
                      min={0}
                      max={safeMax}
                      step="1"
                      value={Number.isFinite(currentQty) ? Math.ceil(currentQty) : ''}
                      onChange={(e) => onQtyChange(ln.id, e.currentTarget.value, safeMax)}
                      className="w-28 text-right"
                      allowEmpty
                    />
                    <div className="flex flex-col gap-2 text-xs">
                      {canShowRequestButton ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                          onClick={() => openNewRequestModal(ln)}
                        >
                          Request more
                        </button>
                      ) : null}
                      {pendingRequest && (
                        <>
                          {canReviewPending ? (
                            <button
                              type="button"
                              className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                              onClick={() => openReviewModal(ln, pendingRequest)}
                            >
                              Review request
                            </button>
                          ) : (
                            <span className="text-amber-700">
                              Awaiting {pendingRequest.requiresAdmin ? 'Admin' : 'Senior PM'} decision
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {extraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold">
              {extraModal.mode === 'request' ? 'Request more' : 'Review request'}
            </h3>
            <p className="text-sm text-gray-600">{extraModal.line.description}</p>
            {extraModal.mode === 'request' ? (
              <div className="mt-4 space-y-3 text-sm">
                <label className="flex flex-col gap-1">
                  Additional quantity
                  <ClearableNumberInput
                    allowEmpty
                    value={modalDraft.qty}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setModalDraft((prev) => ({ ...prev, qty: value }));
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Reason
                  <textarea
                    className="rounded border px-2 py-1"
                    rows={3}
                    value={modalDraft.reason}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setModalDraft((prev) => ({ ...prev, reason: value }));
                    }}
                  />
                </label>
                <p className="text-xs text-gray-500">
                  Requests can only be raised when the quoted quantity is fully used.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <strong>Requested:</strong> +{extraModal.request.qty} {extraModal.line.unit ?? ''}
                </p>
                <p>
                  <strong>Requested by:</strong> {extraModal.request.requestedByName} (
                  {extraModal.request.requestedByRole ?? 'User'})
                </p>
                {extraModal.request.reason ? (
                  <p>
                    <strong>Reason:</strong> {extraModal.request.reason}
                  </p>
                ) : null}
                <p className="text-xs text-gray-500">
                  {extraModal.request.requiresAdmin
                    ? 'Admin approval required'
                    : 'Senior PM approval required'}
                </p>
              </div>
            )}
            {modalError ? <p className="mt-2 text-sm text-rose-600">{modalError}</p> : null}
            <div className="mt-4 flex items-center justify-between">
              <button type="button" className="text-sm text-gray-600 hover:underline" onClick={closeModal}>
                Cancel
              </button>
              {extraModal.mode === 'request' ? (
                <button
                  type="button"
                  className="rounded bg-barmlo-blue px-3 py-1 text-sm text-white disabled:opacity-50"
                  onClick={submitExtraRequest}
                  disabled={isSaving}
                >
                  Save
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-rose-500 px-3 py-1 text-sm text-rose-600 disabled:opacity-50"
                    onClick={() => decideExtraRequest(false)}
                    disabled={isSaving}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                    onClick={() => decideExtraRequest(true)}
                    disabled={isSaving}
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
