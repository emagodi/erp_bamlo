'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import EmployeeAssignmentModal from './EmployeeAssignmentModal';

// Helper to infer task type (copied from server action logic)
function inferTaskType(unit?: string | null, description?: string | null): 'excavation' | 'brick' | 'plaster' | 'cubic' | null {
  const u = (unit || '').toLowerCase();
  const d = (description || '').toLowerCase();
  if (u.includes('m3') || u.includes('cubic')) return 'cubic';
  if (u.includes('m2') || u.includes('sqm') || d.includes('plaster')) return 'plaster';
  if (u.includes('brick') || d.includes('brick')) return 'brick';
  if (u === 'm' || d.includes('excav')) return 'excavation';
  return null;
}

type Item = {
  id?: string | null;
  title: string;
  description?: string | null;
  unit?: string | null;
  quantity?: number | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  employees?: number | null;
  estHours?: number | null;
  note?: string | null;
  employeeIds?: string[];
};

type ProductivitySettings = {
  builderShare: number;
  excavationBuilder: number;
  excavationAssistant: number;
  brickBuilder: number;
  brickAssistant: number;
  plasterBuilder: number;
  plasterAssistant: number;
  cubicBuilder: number;
  cubicAssistant: number;
};

export default function ScheduleEditor({
  projectId,
  schedule,
  user,
  employees,
  productivity,
}: {
  projectId: string;
  schedule: any | null;
  user: any | null;
  employees: Array<{ id: string; givenName: string; surname?: string | null; role: string }>;
  productivity: ProductivitySettings;
}) {
  /* ... inside ScheduleEditor ... */
  const isDraft = !schedule || schedule.status === 'DRAFT';

  const initItems: Item[] = (schedule?.items ?? []).map((i: any) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    unit: i.unit,
    quantity: i.quantity ?? null,
    plannedStart: i.plannedStart ? new Date(i.plannedStart).toISOString().slice(0, 10) : null,
    plannedEnd: i.plannedEnd ? new Date(i.plannedEnd).toISOString().slice(0, 10) : null,
    employees: i.employees ?? null,
    estHours: i.estHours ?? null,
    note: i.note ?? null,
    employeeIds: Array.isArray(i.assignees) ? i.assignees.map((a: any) => a.id) : [],
  }));

  const [items, setItems] = useState<Item[]>(initItems);
  const [note, setNote] = useState<string>(schedule?.note ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  // Auto-scheduling state
  const [projectStartDate, setProjectStartDate] = useState<string>(
    initItems[0]?.plannedStart || new Date().toISOString().slice(0, 10)
  );
  const [gapMinutes, setGapMinutes] = useState<number>(30);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  // --- Auto-Scheduling Logic ---

  const calculateSchedule = useCallback((currentItems: Item[]) => {
    if (!projectStartDate) return currentItems;

    let currentStart = new Date(projectStartDate);
    // Set start time to 07:00
    currentStart.setHours(7, 0, 0, 0);

    // Helper to add working time
    const addWorkingTime = (startDate: Date, hours: number): Date => {
      let remainingHours = hours;
      let date = new Date(startDate);

      while (remainingHours > 0) {
        // Check if current day is weekend (Sat=6, Sun=0)
        const day = date.getDay();
        if (day === 0 || day === 6) {
          // Move to next Monday 07:00
          date.setDate(date.getDate() + (day === 6 ? 2 : 1));
          date.setHours(7, 0, 0, 0);
          continue;
        }

        // Current work day ends at 17:00
        const workEnd = new Date(date);
        workEnd.setHours(17, 0, 0, 0);

        // If currently before 07:00, move to 07:00
        if (date.getHours() < 7) {
          date.setHours(7, 0, 0, 0);
        }
        // If currently after 17:00, move to next day 07:00
        if (date.getHours() >= 17) {
          date.setDate(date.getDate() + 1);
          date.setHours(7, 0, 0, 0);
          continue;
        }

        const msRemainingToday = workEnd.getTime() - date.getTime();
        const hoursRemainingToday = msRemainingToday / (1000 * 60 * 60);

        if (hoursRemainingToday >= remainingHours) {
          date.setTime(date.getTime() + remainingHours * 60 * 60 * 1000);
          remainingHours = 0;
        } else {
          remainingHours -= hoursRemainingToday;
          date.setDate(date.getDate() + 1);
          date.setHours(7, 0, 0, 0);
        }
      }
      return date;
    };

    const addGap = (date: Date, minutes: number): Date => {
      let newDate = new Date(date.getTime() + minutes * 60000);
      // If gap pushes past 17:00, move to next day 07:00
      if (newDate.getHours() >= 17 || (newDate.getHours() === 16 && newDate.getMinutes() > 59)) { // simplified check
         // Actually, let's just check if it's past 17:00
         const endOfDay = new Date(newDate);
         endOfDay.setHours(17, 0, 0, 0);
         if (newDate > endOfDay) {
             newDate.setDate(newDate.getDate() + 1);
             newDate.setHours(7, 0, 0, 0);
         }
      }
      // Handle weekends after gap
      const day = newDate.getDay();
      if (day === 0 || day === 6) {
         newDate.setDate(newDate.getDate() + (day === 6 ? 2 : 1));
         newDate.setHours(7, 0, 0, 0);
      }
      // Handle before 7am
      if (newDate.getHours() < 7) {
          newDate.setHours(7, 0, 0, 0);
      }

      return newDate;
    };

    return currentItems.map((item) => {
      const type = inferTaskType(item.unit, item.description);
      const qty = Number(item.quantity ?? 0);
      const numEmployees = item.employeeIds?.length || 0;
      
      let estHours = 8; // Default fallback

      if (type && qty > 0 && numEmployees > 0) {
        const builders = Math.max(1, Math.round(numEmployees * productivity.builderShare));
        const assistants = Math.max(0, numEmployees - builders);

        const rates = (() => {
          switch (type) {
            case 'excavation': return { b: productivity.excavationBuilder, a: productivity.excavationAssistant };
            case 'brick': return { b: productivity.brickBuilder, a: productivity.brickAssistant };
            case 'plaster': return { b: productivity.plasterBuilder, a: productivity.plasterAssistant };
            case 'cubic': return { b: productivity.cubicBuilder, a: productivity.cubicAssistant };
            default: return { b: 0, a: 0 };
          }
        })();

        const daily = builders * rates.b + assistants * rates.a;
        if (daily > 0) {
          const days = qty / daily;
          estHours = days * 10; // 10-hour workday (07:00 - 17:00)
        }
      } else if (item.estHours) {
          // Keep existing estimate if manually set or calculated previously
          estHours = item.estHours;
      }

      const start = new Date(currentStart);
      const end = addWorkingTime(start, estHours);

      // Update currentStart for next task
      currentStart = addGap(end, gapMinutes);

      return {
        ...item,
        plannedStart: start.toISOString().slice(0, 10),
        plannedEnd: end.toISOString().slice(0, 10),
        estHours: Number(estHours.toFixed(2)),
        employees: numEmployees, // Sync employee count
      };
    });
  }, [projectStartDate, gapMinutes, productivity]);

  // Recalculate when dependencies change
  useEffect(() => {
    const newItems = calculateSchedule(items);
    // Only update if values actually changed to avoid infinite loop
    // JSON.stringify comparison is a bit expensive but safe for this size
    if (JSON.stringify(newItems) !== JSON.stringify(items)) {
        setItems(newItems);
    }
  }, [projectStartDate, gapMinutes, calculateSchedule]); // items is NOT in dependency to avoid loop, we rely on calculateSchedule to use current items? No, that's wrong.
  // Wait, if I change 'items' (e.g. add row), I want schedule to update.
  // But updating schedule updates 'items'.
  // I need to separate 'input data' from 'calculated data' or be very careful.
  // Better: Trigger calculation only when specific fields change.
  
  const updateItemsWithSchedule = (newItems: Item[]) => {
      const scheduled = calculateSchedule(newItems);
      setItems(scheduled);
  };

  // --- Handlers ---

  function addRow() {
    const newItem: Item = {
        title: '',
        description: '',
        unit: '',
        quantity: null,
        employees: null,
        estHours: null,
        employeeIds: [],
    };
    updateItemsWithSchedule([...items, newItem]);
  }

  function removeRow(idx: number) {
    const copy = [...items];
    copy.splice(idx, 1);
    updateItemsWithSchedule(copy);
  }

  function updateField(idx: number, key: keyof Item, value: any) {
    const copy = [...items];
    (copy[idx] as any)[key] = value;
    updateItemsWithSchedule(copy);
  }

  async function handleSave(activate: boolean = false) {
    setLoading(true);
    setError(null);
    try {
      const status = activate ? 'ACTIVE' : 'DRAFT';
      const res = await fetch(`/api/projects/${projectId}/schedule`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note, items, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  }

  async function handleExtract() {
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/schedule/from-quote`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to extract from quote');
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || 'Failed to extract schedule');
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-end gap-6 bg-white p-4 rounded-lg border shadow-sm">
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Start Date</label>
            <input
                type="date"
                value={projectStartDate}
                onChange={(e) => setProjectStartDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gap Between Tasks</label>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min="0"
                    value={gapMinutes}
                    onChange={(e) => setGapMinutes(Number(e.target.value))}
                    className="flex h-9 w-20 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="text-sm text-gray-500">minutes</span>
            </div>
        </div>
        <div className="flex-1"></div>
        <div className="flex items-center gap-3">
             <button
                onClick={addRow}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-emerald-600 text-white shadow hover:bg-emerald-700 h-9 px-4 py-2"
            >
                Add Row
            </button>
             {items.length === 0 && (
                <button
                    onClick={handleExtract}
                    disabled={extracting}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                >
                    {extracting ? 'Extracting...' : 'Extract from Quote'}
                </button>
            )}
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ minWidth: '1200px' }}>
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground" style={{ width: '300px' }}>Task</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground" style={{ width: '80px' }}>Unit</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground" style={{ width: '80px' }}>Qty</th>
                {!isDraft && (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground" style={{ width: '120px' }}>Start (auto)</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground" style={{ width: '120px' }}>End (auto)</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground" style={{ width: '80px' }}>Hours</th>
                  </>
                )}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground" style={{ width: '250px' }}>Workers</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground" style={{ width: '200px' }}>Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it, i) => (
                <tr key={it.id ?? i} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2">
                    <input
                      value={it.title}
                      onChange={(e) => updateField(i, 'title', e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Task name"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                        value={it.unit || ''}
                        onChange={(e) => updateField(i, 'unit', e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                        type="number"
                        value={it.quantity ?? ''}
                        onChange={(e) => updateField(i, 'quantity', Number(e.target.value))}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </td>

                  {!isDraft && (
                    <>
                      <td className="px-4 py-2">
                        <div className="flex h-9 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-500">
                          {it.plannedStart || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex h-9 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-500">
                          {it.plannedEnd || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                         <div className="flex h-9 w-full items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-500">
                          {it.estHours || '-'}
                        </div>
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveRowIndex(i);
                            setModalOpen(true);
                        }}
                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-accent text-left"
                    >
                        <span className="truncate">
                            {it.employeeIds && it.employeeIds.length > 0
                                ? `${it.employeeIds.length} assigned`
                                : 'Select employees...'}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 opacity-50">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={it.note ?? ''}
                      onChange={(e) => updateField(i, 'note', e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex-1 max-w-sm">
          <input
            value={note ?? ''}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Schedule note (optional)"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        
        <div className="flex gap-2">
            <button
            onClick={() => handleSave(false)}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
            {loading ? 'Saving...' : 'Save Draft'}
            </button>
            
            {(schedule?.status === 'DRAFT' || !schedule) && (
                <button
                onClick={() => handleSave(true)}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-emerald-600 text-white shadow hover:bg-emerald-700 h-9 px-4 py-2"
                >
                {loading ? 'Processing...' : 'Create Schedule'}
                </button>
            )}

            {schedule?.status === 'ACTIVE' && (
                 <button
                 onClick={() => handleSave(true)} // Keep active
                 disabled={loading}
                 className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
                 >
                 {loading ? 'Saving...' : 'Save Changes'}
                 </button>
            )}
        </div>
      </div>
      {error && <div className="text-sm font-medium text-destructive">{error}</div>}

      {/* Employee Assignment Modal */}
      {modalOpen && activeRowIndex !== null && (
        <EmployeeAssignmentModal
            isOpen={modalOpen}
            onClose={() => {
                setModalOpen(false);
                setActiveRowIndex(null);
            }}
            employees={employees}
            selectedIds={items[activeRowIndex].employeeIds ?? []}
            onSave={(ids) => updateField(activeRowIndex, 'employeeIds', ids)}
            startDate={items[activeRowIndex].plannedStart ?? null}
            endDate={items[activeRowIndex].plannedEnd ?? null}
            scheduleItemId={items[activeRowIndex].id}
        />
      )}
    </div>
  );
}
