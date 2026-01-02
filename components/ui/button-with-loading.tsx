'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Spinner } from './spinner';
import { cn } from '@/lib/utils';

interface ButtonWithLoadingProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const ButtonWithLoading = forwardRef<HTMLButtonElement, ButtonWithLoadingProps>(
  ({ loading = false, loadingText, variant = 'primary', size = 'md', className, children, disabled, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
    
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus-visible:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
      ghost: 'hover:bg-gray-100 text-gray-700 focus-visible:ring-gray-500',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner size="sm" variant={variant === 'primary' || variant === 'danger' ? 'white' : 'primary'} />}
        {loading && loadingText ? loadingText : children}
      </button>
    );
  }
);

ButtonWithLoading.displayName = 'ButtonWithLoading';
