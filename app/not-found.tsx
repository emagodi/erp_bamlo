import Link from 'next/link';
import { MagnifyingGlassIcon, HomeIcon } from '@heroicons/react/24/outline';

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl text-center space-y-10">
        
        {/* Illustration Area */}
        <div className="relative mx-auto h-64 w-64 opacity-90">
           <svg
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full text-blue-600"
          >
            <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="4" strokeDasharray="10 10" className="opacity-20 animate-[spin_10s_linear_infinite]" />
            <path
              d="M60 100C60 77.9086 77.9086 60 100 60C122.091 60 140 77.9086 140 100"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              className="opacity-40"
            />
            <path
              d="M100 140C77.9086 140 60 122.091 60 100"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              className="opacity-60"
            />
            <text x="100" y="115" fontFamily="sans-serif" fontSize="40" fontWeight="bold" textAnchor="middle" fill="currentColor">404</text>
          </svg>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Page not found
          </h1>
          <p className="mx-auto max-w-xl text-lg text-gray-600">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved, deleted, or never existed.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all active:scale-95"
          >
            <HomeIcon className="h-4 w-4" />
            Go back home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all active:scale-95"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Search Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
