'use client';

import { useState } from 'react';
import { recordDeposit } from '@/app/actions/projects';
import { ButtonWithLoading } from '@/components/ui/button-with-loading';
import { toast } from 'sonner';

export function DepositRecordForm({ 
  projectId, 
  projectManagerId 
}: { 
  projectId: string; 
  projectManagerId: string;
}) {
  const [amountMinor, setAmountMinor] = useState('');
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split('T')[0]);
  const [receiptNo, setReceiptNo] = useState('');
  const [method, setMethod] = useState('CASH');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await recordDeposit({
        projectId,
        amountMinor: Number(amountMinor) * 100,
        receivedAt,
        receiptNo,
        method,
        projectManagerId,
      });

      if (result?.serverError) {
        toast.error('Failed to record deposit');
      } else {
        toast.success('Deposit recorded successfully');
        // Reset form
        setAmountMinor('');
        setReceiptNo('');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`amount-${projectId}`} className="block text-sm font-medium text-gray-700">
            Amount
          </label>
          <input
            type="number"
            id={`amount-${projectId}`}
            value={amountMinor}
            onChange={(e) => setAmountMinor(e.target.value)}
            step="0.01"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor={`date-${projectId}`} className="block text-sm font-medium text-gray-700">
            Received Date
          </label>
          <input
            type="date"
            id={`date-${projectId}`}
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor={`receipt-${projectId}`} className="block text-sm font-medium text-gray-700">
            Receipt No.
          </label>
          <input
            type="text"
            id={`receipt-${projectId}`}
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor={`method-${projectId}`} className="block text-sm font-medium text-gray-700">
            Payment Method
          </label>
          <select
            id={`method-${projectId}`}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="CASH">Cash</option>
            <option value="EFT">EFT</option>
            <option value="POS">POS</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>
      </div>

      <ButtonWithLoading
        type="submit"
        loading={isSubmitting}
        loadingText="Recording..."
        variant="primary"
      >
        Record Deposit
      </ButtonWithLoading>
    </form>
  );
}
