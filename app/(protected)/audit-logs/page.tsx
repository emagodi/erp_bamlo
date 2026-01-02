import { getCurrentUser } from '@/lib/auth';
import { getAuditLogs, getAllUsers } from './actions';
import AuditLogsClient from './AuditLogsClient';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="rounded border border-rose-200 bg-rose-50 p-4 text-rose-700">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="mt-1 text-sm">You must be an administrator to view audit logs.</p>
        </div>
      </div>
    );
  }

  const filters = {
    userId: typeof searchParams.userId === 'string' ? searchParams.userId : undefined,
    method: typeof searchParams.method === 'string' ? searchParams.method : undefined,
    path: typeof searchParams.path === 'string' ? searchParams.path : undefined,
    dateFrom: typeof searchParams.dateFrom === 'string' ? searchParams.dateFrom : undefined,
    dateTo: typeof searchParams.dateTo === 'string' ? searchParams.dateTo : undefined,
    page: typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1,
  };

  const [logsData, users] = await Promise.all([
    getAuditLogs(filters),
    getAllUsers(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <div className="text-sm text-gray-600">
          Total: {logsData.totalCount} logs
        </div>
      </div>

      <AuditLogsClient
        initialLogs={logsData.logs}
        users={users}
        totalPages={logsData.totalPages}
        currentPage={logsData.page}
        totalCount={logsData.totalCount}
        initialFilters={filters}
      />
    </div>
  );
}
