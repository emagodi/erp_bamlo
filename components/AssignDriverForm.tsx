'use client';

import { useState, useTransition } from 'react';
import { assignDriverToDispatch } from '@/app/(protected)/dispatches/driver-actions';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import LoadingButton from '@/components/LoadingButton';

export default function AssignDriverForm({ 
  dispatchId, 
  drivers 
}: { 
  dispatchId: string; 
  drivers: { id: string; name: string | null; email: string | null }[] 
}) {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAssign = () => {
    if (!selectedDriver) return;
    startTransition(async () => {
      await assignDriverToDispatch(dispatchId, selectedDriver);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
        <select
          className="rounded-lg border-gray-200 bg-gray-50 text-sm focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          value={selectedDriver}
          onChange={(e) => setSelectedDriver(e.target.value)}
          disabled={isPending}
        >
          <option value="">Select a Driver...</option>
          {drivers.map(d => (
            <option key={d.id} value={d.id}>
              {d.name || d.email || 'Unknown Driver'}
            </option>
          ))}
        </select>
        <button
           onClick={handleAssign}
           disabled={!selectedDriver || isPending}
           className={clsx(
             "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
           )}
        >
          {isPending ? 'Assigning...' : 'Assign & Hand Over'}
        </button>
    </div>
  );
}
