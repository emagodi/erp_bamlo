'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Props = {
  canRequestFunding: boolean;
  fundingPending: boolean;
  fundingAction: (fd: FormData) => Promise<void>;
  reviewFormId: string;
};

export default function FundingActionsClient({
  canRequestFunding,
  fundingPending,
  fundingAction,
  reviewFormId,
}: Props) {
  const [pending, setPending] = useState<boolean>(fundingPending);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPending(Boolean(detail));
    };
    window.addEventListener('review-flags-change', handler as any);
    return () => window.removeEventListener('review-flags-change', handler as any);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    // Get all unit price inputs from the form using .elements to include those associated via form attribute
    const allElements = Array.from(form.elements) as HTMLInputElement[];
    const unitPriceInputs = allElements.filter((el) => el.name.startsWith('unitPrice-'));
    
    // Check if any unit price is missing or zero
    const missingPrices = unitPriceInputs.filter(input => {
      const value = input.value.trim();
      return !value || parseFloat(value) <= 0;
    });

    if (missingPrices.length > 0) {
      toast.error('Enter a unit price for every requisition item before requesting funding.');
      // Highlight the first missing field
      const firstMissing = missingPrices[0];
      const itemId = firstMissing.name.replace('unitPrice-', '');
      const visibleInput = document.getElementById(`visible-unitPrice-${itemId}`);
      
      if (visibleInput) {
        visibleInput.focus();
        visibleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // If validation passes, submit the form
    setIsLoading(true);
    try {
      await fundingAction(formData);
      toast.success('Funding request submitted successfully');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request funding');
    } finally {
      setIsLoading(false);
    }
  };

  if (!canRequestFunding) return null;

  if (pending) {
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Items are pending review approval. Send to Senior Procurement.
        </div>
        {/* <button
          type="submit"
          form={reviewFormId}
          className="w-full rounded bg-indigo-600 px-3 py-2 text-white"
        >
          Send to Senior Procurement
        </button> */}
      </div>
    );
  }

  return (
    <form id={reviewFormId.replace('review', 'funding')} onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      <button 
        type="submit" 
        disabled={isLoading}
        className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {isLoading ? 'Requesting...' : 'Request Funding'}
      </button>
    </form>
  );
}
