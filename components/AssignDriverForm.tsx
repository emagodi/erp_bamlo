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
    <div className="flex items-center gap-3">
        <select
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
             "inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
           )}
        >
          {isPending ? 'Assigning...' : 'Assign & Hand Over'}
        </button>
    </div>
  );
}
