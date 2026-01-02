'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignProjectToManager } from './actions';

interface ProjectAssignerProps {
  projectId: string;
  initialAssigneeId?: string | null;
  projectManagers: { id: string; name: string | null; email: string }[];
}

export function ProjectAssigner({ projectId, initialAssigneeId, projectManagers }: ProjectAssignerProps) {
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

  return (
    <div className="mt-3 bg-gray-50 p-3 rounded-md border border-gray-100">
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {hasAssignee ? 'Reassign Project Manager' : 'Assign Project Manager'}
      </label>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm h-8"
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
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving...' : (hasAssignee ? 'Reassign' : 'Assign')}
        </button>
      </div>
    </div>
  );
}
