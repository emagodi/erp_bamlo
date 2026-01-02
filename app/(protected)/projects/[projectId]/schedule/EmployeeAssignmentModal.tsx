'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { checkEmployeeAvailability } from './actions';

type Employee = {
  id: string;
  givenName: string;
  surname?: string | null;
  role: string;
};

export default function EmployeeAssignmentModal({
  isOpen,
  onClose,
  employees,
  selectedIds,
  onSave,
  startDate,
  endDate,
  scheduleItemId,
}: {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  selectedIds: string[];
  onSave: (ids: string[]) => void;
  startDate: string | null;
  endDate: string | null;
  scheduleItemId?: string | null;
}) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);
  const [category, setCategory] = useState<string>('ALL');
  const [busyEmployees, setBusyEmployees] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSelected(selectedIds);
      checkAvailability();
    }
  }, [isOpen, selectedIds, startDate, endDate]);

  async function checkAvailability() {
    if (!startDate || !endDate) return;
    setChecking(true);
    try {
      // Check availability for ALL employees to show who is busy
      // Optimization: We could only check for selected or visible, but checking all is safer for UX
      const allIds = employees.map(e => e.id);
      const result = await checkEmployeeAvailability(allIds, startDate, endDate, scheduleItemId ?? undefined);
      setBusyEmployees(result.busy);
    } catch (err) {
      console.error('Failed to check availability', err);
    } finally {
      setChecking(false);
    }
  }

  const categories = ['ALL', ...Array.from(new Set(employees.map((e) => e.role)))];

  const filteredEmployees = employees.filter(
    (e) => category === 'ALL' || e.role === category
  );

  const toggleEmployee = (id: string) => {
    if (localSelected.includes(id)) {
      setLocalSelected(localSelected.filter((sid) => sid !== id));
    } else {
      setLocalSelected([...localSelected, id]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Assign Employees</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Employee List */}
          <div className="flex-1 overflow-y-auto border rounded-md">
            {checking ? (
              <div className="p-4 text-center text-gray-500">Checking availability...</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredEmployees.map((emp) => {
                  const isSelected = localSelected.includes(emp.id);
                  const isBusy = busyEmployees.includes(emp.id);
                  
                  // User requested to remove busy employees from the list instead of marking them
                  if (isBusy) return null;

                  return (
                    <label
                      key={emp.id}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEmployee(emp.id)}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {emp.givenName} {emp.surname}
                          </p>
                          <p className="text-xs text-gray-500">{emp.role}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">No employees found in this category.</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-3 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(localSelected);
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-colors"
          >
            Save Assignments
          </button>
        </div>
      </div>
    </div>
  );
}
