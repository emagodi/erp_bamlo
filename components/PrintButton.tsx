'use client';

import { PrinterIcon } from '@heroicons/react/24/outline';

export default function PrintButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className={`inline-flex items-center gap-2 rounded-md border border-transparent bg-barmlo-orange px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-barmlo-orange/90 focus:outline-none focus:ring-2 focus:ring-barmlo-orange focus:ring-offset-2 print:hidden ${className}`}
    >
      <PrinterIcon className="h-4 w-4" />
      Print / Save PDF
    </button>
  );
}
