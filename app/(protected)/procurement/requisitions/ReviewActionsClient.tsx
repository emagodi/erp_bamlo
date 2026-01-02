'use client';

import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  reviewFormId: string;
  sendForReviewAction: (fd: FormData) => Promise<void>;
};

export default function ReviewActionsClient({ reviewFormId, sendForReviewAction }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    setIsLoading(true);
    try {
      await sendForReviewAction(formData);
      toast.success('Requisition sent for review');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send for review');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      id={reviewFormId}
      onSubmit={handleSubmit}
      className="flex items-center gap-3"
    >
      <span>
        Items are marked for review. Send them to Senior Procurement for approval.
      </span>
      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {isLoading ? 'Sending...' : 'Send to Senior Procurement'}
      </button>
    </form>
  );
}
