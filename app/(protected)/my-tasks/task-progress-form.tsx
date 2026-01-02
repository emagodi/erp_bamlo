'use client';

import { useState } from 'react';
import { updateTaskProgress } from '@/app/actions/scheduling';
import { toast } from 'sonner';

export function TaskProgressForm({ 
  taskId, 
  userId, 
  currentPercent 
}: { 
  taskId: string; 
  userId: string; 
  currentPercent: number; 
}) {
  const [percent, setPercent] = useState(currentPercent);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await updateTaskProgress({
        taskId,
        userId,
        percent: Number(percent),
        note,
      });

      if (result?.serverError) {
        toast.error('Failed to update progress');
      } else {
        toast.success('Progress updated successfully');
        setNote('');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor={`percent-${taskId}`} className="block text-sm font-medium text-gray-700">
          Completion Percentage
        </label>
        <div className="mt-1 flex items-center gap-4">
          <input
            type="range"
            id={`percent-${taskId}`}
            min="0"
            max="100"
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm font-medium w-12 text-right">{percent}%</span>
        </div>
      </div>

      <div>
        <label htmlFor={`note-${taskId}`} className="block text-sm font-medium text-gray-700">
          Daily Note / Update
        </label>
        <textarea
          id={`note-${taskId}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you accomplish today?"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : 'Submit Update'}
      </button>
    </form>
  );
}
