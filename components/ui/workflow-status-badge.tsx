'use client';

import { ProjectStatus } from '@prisma/client';

interface WorkflowStatusBadgeProps {
  status: ProjectStatus;
}

export function WorkflowStatusBadge({ status }: WorkflowStatusBadgeProps) {
  const statusConfig: Record<ProjectStatus, { label: string; className: string }> = {
    CREATED: {
      label: 'Created',
      className: 'bg-slate-100 text-slate-800 ring-slate-600/20',
    },
    PLANNED: {
      label: 'Planned',
      className: 'bg-gray-100 text-gray-800 ring-gray-600/20',
    },
    DEPOSIT_PENDING: {
      label: 'Awaiting Deposit',
      className: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
    },
    SCHEDULING_PENDING: {
      label: 'Awaiting Schedule',
      className: 'bg-blue-100 text-blue-800 ring-blue-600/20',
    },
    PREPARING: {
      label: 'Preparing',
      className: 'bg-indigo-100 text-indigo-800 ring-indigo-600/20',
    },
    READY: {
      label: 'Ready',
      className: 'bg-green-100 text-green-800 ring-green-600/20',
    },
    ONGOING: {
      label: 'Ongoing',
      className: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
    },
    ON_HOLD: {
      label: 'On Hold',
      className: 'bg-orange-100 text-orange-800 ring-orange-600/20',
    },
    COMPLETED: {
      label: 'Completed',
      className: 'bg-teal-100 text-teal-800 ring-teal-600/20',
    },
    CLOSED: {
      label: 'Closed',
      className: 'bg-gray-100 text-gray-800 ring-gray-600/20',
    },
  };

  const config = statusConfig[status] || statusConfig.PLANNED;

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${config.className}`}
    >
      {config.label}
    </span>
  );
}
