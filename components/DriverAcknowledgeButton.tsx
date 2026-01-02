'use client';

import { useTransition } from 'react';
import { acknowledgeDispatchByDriver } from '@/app/(protected)/dispatches/driver-actions';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

export default function DriverAcknowledgeButton({ dispatchId }: { dispatchId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      await acknowledgeDispatchByDriver(dispatchId);
      router.refresh();
      router.push('/dashboard'); // Go back to dashboard after pickup
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={clsx(
        "inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      {isPending && (
        <span className='h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent' />
      )}
      <span>{isPending ? 'Processing...' : 'Confirm Receipt'}</span>
    </button>
  );
}
