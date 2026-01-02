"use client";

import clsx from 'clsx';
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

import { useLoading } from './LoadingProvider';

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  loadingText?: ReactNode;
};

export default function LoadingButton({
  children,
  className,
  pending: pendingOverride,
  loadingText,
  disabled,
  ...props
}: LoadingButtonProps) {
  const { pending: formPending } = useFormStatus();
  const loading = useLoading();
  const prevFormPending = useRef(formPending);

  useEffect(() => {
    if (formPending && !prevFormPending.current) {
      loading.start();
    } else if (!formPending && prevFormPending.current) {
      loading.stop();
    }
    prevFormPending.current = formPending;
  }, [formPending, loading]);

  useEffect(() => {
    return () => {
      if (prevFormPending.current) {
        loading.stop();
      }
    };
  }, [loading]);

  const isPending = Boolean(pendingOverride ?? formPending ?? loading.pending);

  return (
    <button
      {...props}
      disabled={isPending || disabled}
      className={clsx(
        'inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      {isPending && (
        <span className='h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent' />
      )}
      <span>{isPending && loadingText ? loadingText : children}</span>
    </button>
  );
}
