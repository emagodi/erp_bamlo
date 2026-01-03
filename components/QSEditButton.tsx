'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

import { PencilSquareIcon } from '@heroicons/react/24/outline';

export default function QSEditButton({
  quoteId,
  className,
}: {
  quoteId: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(() => {
      router.push(`/quotes/${quoteId}/edit`);
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded bg-barmlo-orange px-3 py-1 text-sm font-semibold text-white shadow-sm transition hover:bg-barmlo-orange/90 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {isPending ? (
        <svg
          className="h-4 w-4 animate-spin text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : (
        <PencilSquareIcon className="h-4 w-4" />
      )}
      <span>Edit</span>
    </button>
  );
}
