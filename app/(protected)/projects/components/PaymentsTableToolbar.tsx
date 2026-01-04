'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useTransition, useState } from 'react';

export default function PaymentsTableToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [pageSize, setPageSize] = useState(searchParams.get('limit') ?? '20');
  const [type, setType] = useState(searchParams.get('type') ?? '');
  const tab = searchParams.get('tab') ?? undefined;

  useEffect(() => {
    setPageSize(searchParams.get('limit') ?? '20');
    setType(searchParams.get('type') ?? '');
  }, [searchParams]);

  const pushWithParams = (params: URLSearchParams) => {
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 p-2 border border-blue-100 mb-4">
      <div className="flex items-center gap-2">
        <span className="bg-barmlo-blue text-white px-2 py-1 rounded text-xs font-bold shadow-sm">Show</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(e.target.value);
            const params = new URLSearchParams(searchParams.toString());
            params.set('limit', e.target.value);
            if (tab) params.set('tab', tab);
            params.set('page', '1');
            pushWithParams(params);
          }}
          className="rounded border-gray-300 py-1 text-sm focus:border-blue-500 focus:ring-blue-500 shadow-sm"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="bg-barmlo-blue text-white px-2 py-1 rounded text-xs font-bold shadow-sm">Type</span>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) params.set('type', e.target.value);
            else params.delete('type');
            if (tab) params.set('tab', tab);
            params.set('page', '1');
            pushWithParams(params);
          }}
          className="rounded border-gray-300 py-1 text-sm focus:border-blue-500 focus:ring-blue-500 min-w-[150px] shadow-sm"
        >
          <option value="">All</option>
          <option value="DEPOSIT">Deposit</option>
          <option value="INSTALLMENT">Installment</option>
        </select>
      </div>
    </div>
  );
}
