'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignProjectToManager } from './actions';

interface ProjectAssignerProps {
  projectId: string;
  initialAssigneeId?: string | null;
  projectManagers: { id: string; name: string | null; email: string }[];
  variant?: 'card' | 'table';
}

export function ProjectAssigner({ projectId, initialAssigneeId, projectManagers, variant = 'card' }: ProjectAssignerProps) {
  const [selectedId, setSelectedId] = useState(initialAssigneeId || '');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAssign = () => {
    if (!selectedId) return;
    
    startTransition(async () => {
      try {
        await assignProjectToManager(projectId, selectedId);
        router.refresh();
      } catch (e: any) {
        alert('Failed to assign project: ' + e.message);
      }
    });
  };

  const hasAssignee = !!initialAssigneeId;
  const isChanged = selectedId !== initialAssigneeId;

  if (variant === 'table') {
    return (
      <div className="flex items-center gap-2">
        <select
          className="block w-48 rounded-md border-gray-300 py-1.5 text-xs focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isPending}
        >
          <option value="">-- Select PM --</option>
          {projectManagers.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.name || pm.email}
            </option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={isPending || !selectedId || !isChanged}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
        >
          {isPending ? '...' : 'Assign'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700">
      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 dark:text-gray-400">
        {hasAssignee ? 'Reassign Project Manager' : 'Assign Project Manager'}
      </label>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 block w-full rounded-lg border-gray-200 bg-gray-50 text-sm focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isPending}
        >
          <option value="">-- Unassigned --</option>
          {projectManagers.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.name || pm.email}
            </option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={isPending || !selectedId || !isChanged}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-orange-600 hover:bg-orange-700 focus:ring-4 focus:ring-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? 'Saving...' : (hasAssignee ? 'Reassign' : 'Assign')}
        </button>
      </div>
    </div>
  );
}
