'use client';

import { useTransition } from 'react';
import { markDispatchItemHandedOut } from '@/app/(protected)/projects/actions';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

export default function MarkHandedOutButton({ dispatchItemId }: { dispatchItemId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      await markDispatchItemHandedOut(dispatchItemId);
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={clsx(
        "inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      {isPending && (
        <span className='h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent' />
      )}
      <span>{isPending ? 'Processing...' : 'Mark Handed Out'}</span>
    </button>
  );
}
