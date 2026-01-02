'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { exportAuditLogs } from './actions';

type User = {
  id: string;
  name: string | null;
  email: string;
};

type AuditLog = {
  id: string;
  userId: string;
  action: string;
  method: string;
  path: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
};

type Props = {
  initialLogs: AuditLog[];
  users: User[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
  initialFilters: {
    userId?: string;
    method?: string;
    path?: string;
    dateFrom?: string;
    dateTo?: string;
  };
};

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

export default function AuditLogsClient({
  initialLogs,
  users,
  totalPages,
  currentPage,
  totalCount,
  initialFilters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  const [filters, setFilters] = useState({
    userId: initialFilters.userId || '',
    method: initialFilters.method || '',
    path: initialFilters.path || '',
    dateFrom: initialFilters.dateFrom || '',
    dateTo: initialFilters.dateTo || '',
  });

  const applyFilters = () => {
    const params = new URLSearchParams();
    
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.method) params.set('method', filters.method);
    if (filters.path) params.set('path', filters.path);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    params.set('page', '1'); // Reset to first page when filtering

    startTransition(() => {
      router.push(`/audit-logs?${params.toString()}`);
    });
  };

  const clearFilters = () => {
    setFilters({
      userId: '',
      method: '',
      path: '',
      dateFrom: '',
      dateTo: '',
    });
    startTransition(() => {
      router.push('/audit-logs');
    });
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    startTransition(() => {
      router.push(`/audit-logs?${params.toString()}`);
    });
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const content = await exportAuditLogs(
        {
          userId: filters.userId || undefined,
          method: filters.method || undefined,
          path: filters.path || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        },
        format
      );

      const blob = new Blob([content], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export audit logs');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Filters</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">User</label>
            <select
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Method</label>
            <select
              value={filters.method}
              onChange={(e) => setFilters({ ...filters, method: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All Methods</option>
              {HTTP_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Path</label>
            <input
              type="text"
              value={filters.path}
              onChange={(e) => setFilters({ ...filters, path: e.target.value })}
              placeholder="Search path..."
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={applyFilters}
            disabled={isPending}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Applying...' : 'Apply Filters'}
          </button>
          <button
            onClick={clearFilters}
            disabled={isPending}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Clear Filters
          </button>
        </div>
      </section>

      {/* Export buttons */}
      <section className="flex justify-end gap-2">
        <button
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={isExporting}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isExporting ? 'Exporting...' : 'Export JSON'}
        </button>
      </section>

      {/* Logs table */}
      <section className="rounded border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Timestamp</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Role</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Method</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Path</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">IP</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">User Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {initialLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                initialLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-900">
                        {log.user.name || log.user.email}
                      </div>
                      {log.user.name && (
                        <div className="text-xs text-gray-500">{log.user.email}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                        {log.user.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={clsx(
                          'inline-flex rounded px-2 py-1 text-xs font-semibold',
                          log.method === 'GET' && 'bg-blue-100 text-blue-700',
                          log.method === 'POST' && 'bg-green-100 text-green-700',
                          log.method === 'PUT' && 'bg-amber-100 text-amber-700',
                          log.method === 'DELETE' && 'bg-rose-100 text-rose-700',
                          log.method === 'PATCH' && 'bg-purple-100 text-purple-700'
                        )}
                      >
                        {log.method}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">
                      {log.path}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {log.ip || '—'}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-xs text-gray-600" title={log.userAgent || ''}>
                      {log.userAgent || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages} ({totalCount} total logs)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1 || isPending}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages || isPending}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
