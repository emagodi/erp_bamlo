'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordClientPayment } from '@/app/(protected)/accounts/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Props = {
  projectId: string;
  defaultTab?: 'deposit' | 'other';
  onCancel?: () => void;
  cancelHref?: string;
};

export default function PaymentForms({ projectId, defaultTab = 'deposit', onCancel, cancelHref }: Props) {
  return (
    <div className="w-full bg-white">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="other">Other Payment</TabsTrigger>
        </TabsList>
        
        <TabsContent value="deposit">
          <PaymentForm 
            projectId={projectId} 
            type="DEPOSIT" 
            onSuccess={onCancel || (() => {})}
            onCancel={onCancel}
            cancelHref={cancelHref}
            submitLabel="Save Deposit"
          />
        </TabsContent>
        
        <TabsContent value="other">
          <PaymentForm 
            projectId={projectId} 
            type="INSTALLMENT" 
            defaultType="INSTALLMENT"
            showTypeSelect={false}
            onSuccess={onCancel || (() => {})}
            onCancel={onCancel}
            cancelHref={cancelHref}
            submitLabel="Save Installment"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentForm({ 
  projectId, 
  type: fixedType, 
  defaultType, 
  showTypeSelect,
  onSuccess,
  onCancel,
  cancelHref,
  submitLabel
}: { 
  projectId: string; 
  type: 'DEPOSIT' | 'INSTALLMENT' | 'ADJUSTMENT'; 
  defaultType?: 'INSTALLMENT' | 'ADJUSTMENT';
  showTypeSelect?: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
  cancelHref?: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(defaultType || fixedType);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState(''); // Receipt No
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState('CASH');
  const [file, setFile] = useState<File | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      let attachmentUrl = null;

      // Handle File Upload
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error('File upload failed');
        const data = await res.json();
        attachmentUrl = data.url;
      }

      // Record Payment
      await recordClientPayment(projectId, {
        type: showTypeSelect ? (type as any) : fixedType,
        amount: Number(amount),
        receivedAt: date,
        receiptNo: ref,
        method,
        description,
        attachmentUrl,
      });

      toast.success('Payment recorded successfully');
      router.refresh();
      onSuccess();
      if (!onCancel && cancelHref) {
        router.push(cancelHref);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showTypeSelect && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Payment Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="INSTALLMENT">Installment</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="DEPOSIT">Deposit</option>
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent pl-7 pr-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Date Received</label>
          <div className="relative">
            <input
              type="date"
              value={date}
              readOnly
              className="flex h-10 w-full rounded-md border border-input bg-gray-50 px-3 py-2 text-sm text-gray-500 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-not-allowed"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Reference / Receipt #</label>
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="e.g. RCP-12345"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Payment Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="POS">POS</option>
            <option value="EFT">EFT</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Additional details about the payment..."
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Proof of Payment</label>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            <span>{file ? 'Change File' : 'Upload File'}</span>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              accept="image/*,application/pdf"
            />
          </label>
          {file && (
            <span className="text-sm text-gray-600 truncate max-w-[200px]">
              {file.name}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">Supported formats: PDF, JPG, PNG.</p>
      </div>

      <div className="pt-4 flex justify-end gap-3">
        {(onCancel || cancelHref) && (
          <button
            type="button"
            onClick={onCancel || (() => router.push(cancelHref!))}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-orange-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
