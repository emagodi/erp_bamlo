'use client';
import React, { useEffect, useState } from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  allowEmpty?: boolean;
  selectOnFocus?: boolean;
};



export default function ClearableNumberInput({
  allowEmpty = true,
  selectOnFocus = true,
  value,
  defaultValue,
  type = 'number',
  step = 'any',
  className = '',
  onChange,
  onFocus,
  onKeyDown,
  ...rest
}: Props) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (defaultValue === undefined || defaultValue === null) return '';
    return String(defaultValue);
  });

  useEffect(() => {
    if (isControlled) return;
    if (defaultValue === undefined || defaultValue === null) return;
    setInternalValue(String(defaultValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

  const displayValue = isControlled ? String(value ?? '') : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      const incoming = e.target.value;
      if (!allowEmpty && incoming === '') {
        setInternalValue('0');
      } else {
        setInternalValue(incoming);
      }
    }
    onChange?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (selectOnFocus) {
      (e.target as HTMLInputElement).select();
    }
    onFocus?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      !isControlled &&
      allowEmpty &&
      (e.key === 'Backspace' || e.key === 'Delete') &&
      displayValue === '0'
    ) {
      setInternalValue('');
    }
    onKeyDown?.(e);
  };

  return (
    <input
      type={type}
      step={step}
      {...rest}
      value={displayValue}
      inputMode="decimal"
      onChange={handleChange}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={`rounded border px-2 py-1 text-sm ${className}`.trim()}
    />
  );
}
