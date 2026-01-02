'use client';

import { useState } from 'react';
import { approveFunding, rejectFunding } from '@/app/(protected)/accounts/actions';

type Props = {
  fundingId: string;
};

export default function FundingDecisionActions({ fundingId }: Props) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // We wrap the server actions to handle loading state
  // We can't use form action attribute directly if we want to toggle state easily without useFormStatus hook inside a nested component
  // Or we just use onSubmit and handle the FormData manually.

  const handleApprove = async (formData: FormData) => {
    setApproving(true);
    try {
      const amt = Number(formData.get('approved') || 0);
      await approveFunding(fundingId, amt > 0 ? amt : undefined);
    } catch (e) {
      console.error(e);
      alert('Failed to approve: ' + (e instanceof Error ? e.message : String(e)));
      setApproving(false);
    }
  };

  const handleReject = async (formData: FormData) => {
    setRejecting(true);
    try {
      await rejectFunding(fundingId, String(formData.get('reason') || ''));
    } catch (e) {
      console.error(e);
      alert('Failed to reject: ' + (e instanceof Error ? e.message : String(e)));
      setRejecting(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form action={handleApprove} className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Approve Amount (Optional)</label>
        <div className="flex gap-2">
          <input
            name="approved"
            type="number"
            step="0.01"
            min="0"
            placeholder="Full amount if empty"
            className="flex-1 rounded border px-3 py-2 text-sm"
            disabled={approving || rejecting}
          />
          <button
            type="submit"
            disabled={approving || rejecting}
            className="rounded bg-emerald-600 px-6 py-2 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {approving && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            Approve
          </button>
        </div>
      </form>
      <form action={handleReject} className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Rejection Reason (Optional)</label>
        <div className="flex gap-2">
          <input
            name="reason"
            placeholder="Reason for rejection"
            className="flex-1 rounded border px-3 py-2 text-sm"
            disabled={approving || rejecting}
          />
          <button
            type="submit"
            disabled={approving || rejecting}
            className="rounded bg-rose-600 px-6 py-2 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {rejecting && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            Reject
          </button>
        </div>
      </form>
    </div>
  );
}
