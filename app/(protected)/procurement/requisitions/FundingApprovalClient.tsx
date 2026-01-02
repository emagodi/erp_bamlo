
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Props = {
  handleApproveFunding: (formData: FormData) => Promise<void>;
  handleRejectFunding: (formData: FormData) => Promise<void>;
  amount: number;
};

export default function FundingApprovalClient({
  handleApproveFunding,
  handleRejectFunding,
  amount,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  const onApprove = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading('approve');
    try {
      const fd = new FormData(e.currentTarget);
      await handleApproveFunding(fd);
      toast.success('Funding request approved');
      router.push('/dashboard');
    } catch (err) {
      toast.error('Failed to approve funding');
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const onReject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading('reject');
    try {
      const fd = new FormData(e.currentTarget);
      await handleRejectFunding(fd);
      toast.success('Funding request rejected');
      router.push('/dashboard');
    } catch (err) {
      toast.error('Failed to reject funding');
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-4 rounded border border-indigo-200 bg-indigo-50 p-4">
      <h3 className="mb-2 text-sm font-semibold text-indigo-900">Funding Request Pending</h3>
      <p className="mb-4 text-sm text-indigo-800">
        Review the requested amount of <span className="font-bold">${amount.toFixed(2)}</span>.
      </p>
      
      <div className="flex flex-wrap gap-4">
        <form onSubmit={onApprove} className="flex gap-2 items-center">
            {/* Hidden input to pass amount if needed, or rely on server state */}
            <button
                type="submit"
                disabled={!!loading}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
                {loading === 'approve' ? 'Approving...' : 'Approve Funding'}
            </button>
        </form>

        <form onSubmit={onReject} className="flex gap-2 items-center">
            <input 
                name="reason" 
                placeholder="Rejection reason" 
                required 
                className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
                type="submit"
                disabled={!!loading}
                className="rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
                {loading === 'reject' ? 'Rejecting...' : 'Reject'}
            </button>
        </form>
      </div>
    </div>
  );
}
