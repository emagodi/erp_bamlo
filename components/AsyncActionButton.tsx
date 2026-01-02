/* "use client";

import { useState, useTransition, type ReactNode } from 'react';
import clsx from 'clsx';

import { useLoading } from './LoadingProvider';

type AsyncActionButtonProps = {
  action: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
  loadingText?: React.ReactNode;
  disabled?: boolean;
};

export default function AsyncActionButton({
  action,
  children,
  className,
  loadingText,
  disabled,
}: AsyncActionButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const loading = useLoading();

  const handleClick = () => {
    if (disabled || isPending) return;
    startTransition(() => {
      loading.start();
      setError(null);
      Promise.resolve(action())
        .catch((err) => {
          console.error(err);
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('Something went wrong.');
          }
        })
        .finally(() => {
          loading.stop();
        });
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        className={clsx(
          'inline-flex items-center gap-2 rounded bg-barmlo-blue px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-barmlo-blue/90 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        {isPending && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
        )}
        <span>{isPending && loadingText ? loadingText : children}</span>
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
 */

// components/ServerActionButton.tsx
/* 'use client';

import { useFormStatus } from 'react-dom';
import clsx from 'clsx';
import type { ReactNode } from 'react';

type Props = {
  action: (formData: FormData) => Promise<any> | ((...args: any[]) => Promise<any>);
  children: ReactNode;
  className?: string;
  loadingText?: React.ReactNode;
  disabled?: boolean;
};

function SubmitButton({ children, className, loadingText, disabled }: Omit<Props, 'action'>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={clsx(
        'inline-flex items-center gap-2 rounded bg-barmlo-blue px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-barmlo-blue/90 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {pending && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
      )}
      <span>{pending && loadingText ? loadingText : children}</span>
    </button>
  );
}

export default function AsyncActionButton({ action, ...rest }: Props) {
  // IMPORTANT: We attach the server action directly to <form action={...}>.
  return (
    <form action={action}>
      <SubmitButton {...rest} />
    </form>
  );
}
 */

'use client';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import clsx from 'clsx';

type Props = {
  // Your server actions
  acceptAction: (formData: FormData) => Promise<any>;
  rejectAction: (formData: FormData) => Promise<any>;
};

function Buttons({
  clicked,
  setClicked,
}: {
  clicked: 'accept' | 'reject' | null;
  setClicked: (v: 'accept' | 'reject' | null) => void;
}) {
  const { pending } = useFormStatus();

  // Disable both while pending; also disable the opposite button once one is clicked
  const disableAccept = pending || clicked === 'reject';
  const disableReject = pending || clicked === 'accept';

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        name="intent"
        value="accept"
        onClick={() => setClicked('accept')}
        disabled={disableAccept}
        className={clsx(
          'rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {pending && clicked === 'accept' ? 'Accepting…' : 'Accept'}
      </button>

      <button
        type="submit"
        name="intent"
        value="reject"
        onClick={() => setClicked('reject')}
        disabled={disableReject}
        className={clsx(
          'rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {pending && clicked === 'reject' ? 'Rejecting…' : 'Reject'}
      </button>
    </div>
  );
}

export default function NegotiationActionPair({ acceptAction, rejectAction }: Props) {
  const [clicked, setClicked] = useState<'accept' | 'reject' | null>(null);

  // ONE form, one action handler that branches on submitter intent
  async function action(formData: FormData) {
    const intent = formData.get('intent');
    try {
      if (intent === 'accept') {
        await acceptAction(formData);
      } else if (intent === 'reject') {
        await rejectAction(formData);
      }
    } finally {
      // reset clicked so buttons re-enable after completion
      setClicked(null);
    }
  }

  return (
    <form action={action}>
      <Buttons clicked={clicked} setClicked={setClicked} />
    </form>
  );
}
