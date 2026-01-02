'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';

export function SearchInput({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [term, setTerm] = useState(searchParams.get('q')?.toString() || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (term) {
        params.set('q', term);
      } else {
        params.delete('q');
      }
      startTransition(() => {
        router.replace(`?${params.toString()}`);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [term, searchParams, router]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg
          className="h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="text"
        className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:text-gray-900 focus:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
        placeholder={placeholder ?? 'Search...'}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      {isPending && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      )}
    </div>
  );
}
