'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import { SearchInput } from '@/components/ui/search-input';
import { Prisma } from '@prisma/client';

function canManage(role: string | null | undefined) {
  return ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_MANAGER'].includes(role || '');
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required</div>;
  if (!canManage(me.role)) return <div className="p-6">Not authorized</div>;

  const { q: query } = await searchParams;
  const where: Prisma.EmployeeWhereInput = query
    ? {
        OR: [
          { givenName: { contains: query, mode: 'insensitive' } },
          { surname: { contains: query, mode: 'insensitive' } },
          { role: { contains: query, mode: 'insensitive' } },
          { office: { contains: query, mode: 'insensitive' } },
        ],
      }
    : {};

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ role: 'asc' }, { givenName: 'asc' }],
    include: {
      user: { select: { email: true, role: true } },
      scheduleItems: {
        select: {
          id: true,
          schedule: { select: { projectId: true } },
        },
      },
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-gray-600">Manage worker accounts. Default password: Password01.</p>
        </div>
        <Link
          href="/employees/add"
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
        >
          Add employee
        </Link>
      </div>

      <div className="max-w-xs">
        <SearchInput placeholder="Search employees..." />
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Office</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Jobs Assigned</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const uniqueProjects = new Set(e.scheduleItems.map((si) => si.schedule.projectId));
              return (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2">{`${e.givenName} ${e.surname ?? ''}`.trim()}</td>
                  <td className="px-3 py-2">{e.role}</td>
                  <td className="px-3 py-2">{e.office ?? '-'}</td>
                  <td className="px-3 py-2">{e.phone ?? '-'}</td>
                  <td className="px-3 py-2">{e.email}</td>
                  <td className="px-3 py-2">{uniqueProjects.size}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
