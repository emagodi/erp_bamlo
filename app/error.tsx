'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error?.message ?? '';
  const isDbPoolIssue = /connection pool|timed out fetching a new connection|p1001|p1002/i.test(
    message,
  );

  useEffect(() => {
    console.error(error);
    const toastMsg = isDbPoolIssue
      ? 'We are having trouble reaching the database. Please try again in a few seconds.'
      : error.message || 'An unexpected error occurred';
    toast.error(toastMsg);
  }, [error, isDbPoolIssue]);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-50 ring-8 ring-orange-50/50">
          <ExclamationTriangleIcon className="h-10 w-10 text-orange-500" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Something went wrong!
          </h2>
          {isDbPoolIssue ? (
            <div className="space-y-1 text-lg text-gray-600">
              <p>We are temporarily unable to reach the database.</p>
              <p>Please try again in a few seconds. Your data was not changed.</p>
            </div>
          ) : (
            <p className="text-lg text-gray-600">
              {error.message || 'We encountered an unexpected issue while processing your request.'}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={reset}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 transition-all active:scale-95"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300 transition-all"
          >
            Go home
          </Link>
        </div>

        {error.digest && (
          <p className="text-xs font-mono text-gray-400 mt-8">
            Error Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
