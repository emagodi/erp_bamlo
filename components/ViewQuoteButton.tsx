'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ViewQuoteButton({ quoteId }: { quoteId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleView = () => {
    setLoading(true);
    // Navigation will happen via the Link or router push.
    // If using Link, the loading state is just visual feedback until the page loads.
  };

  return (
    <Link
      href={`/quotes/${quoteId}`}
      onClick={handleView}
      className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
        loading ? 'opacity-70 cursor-wait' : ''
      }`}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </>
      ) : (
        'View'
      )}
    </Link>
  );
}
