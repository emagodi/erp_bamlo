'use client';

import { useState } from 'react';
import { recordDeposit } from '@/app/actions/projects';
import { ButtonWithLoading } from '@/components/ui/button-with-loading';
import { toast } from 'sonner';
import { CurrencyDollarIcon, CalendarIcon, DocumentTextIcon, CreditCardIcon } from '@heroicons/react/24/outline';

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700 transition-all hover:shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor={`amount-${projectId}`} className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Amount
            </label>
            <div className="relative">
              <input
                type="number"
                id={`amount-${projectId}`}
                value={amountMinor}
                onChange={(e) => setAmountMinor(e.target.value)}
                step="0.01"
                required
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
                placeholder="0.00"
              />
              <CurrencyDollarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor={`date-${projectId}`} className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Received Date
            </label>
            <div className="relative">
              <input
                type="date"
                id={`date-${projectId}`}
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
              />
              <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor={`receipt-${projectId}`} className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Receipt No.
            </label>
            <div className="relative">
              <input
                type="text"
                id={`receipt-${projectId}`}
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400"
                placeholder="REC-001"
              />
              <DocumentTextIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor={`method-${projectId}`} className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Payment Method
            </label>
            <div className="relative">
              <select
                id={`method-${projectId}`}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 appearance-none"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="ECOCASH">EcoCash</option>
                <option value="OTHER">Other</option>
              </select>
              <CreditCardIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <ButtonWithLoading
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-white text-sm font-medium hover:bg-emerald-700 shadow-sm focus:ring-4 focus:ring-emerald-500/20 transition-all"
          >
            Record Deposit
          </ButtonWithLoading>
        </div>
      </div>
    </form>
  );
}
