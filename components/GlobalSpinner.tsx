"use client";

import clsx from 'clsx';
import { useLoading } from './LoadingProvider';

export default function GlobalSpinner() {
  const { pending } = useLoading();

  return (
    <div
      aria-hidden={!pending}
      className={clsx(
        'fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm transition-opacity duration-200 dark:bg-gray-900/60',
        pending ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
    >
      <div aria-live="polite" role="status" className="flex flex-col items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-r-transparent" />
        <span>Loading...</span>
      </div>
    </div>
  );
}
