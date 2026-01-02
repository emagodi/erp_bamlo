'use client';

import { useState } from 'react';

export default function QuantityInput({
  name,
  max,
  min = 0.01,
  defaultValue = '',
  className = '',
}: {
  name: string;
  max: number;
  min?: number;
  defaultValue?: number | string;
  className?: string;
}) {
  const [val, setVal] = useState<string>(
    defaultValue === '' ? '' : String(defaultValue)
  );

  const clamp = (n: number) => Math.min(Math.max(n, min), max);

  return (
    <input
      name={name}
      type="number"
      step="0.01"
      min={min}
      value={val}
      onChange={(e) => {
        const s = e.target.value;
        if (s === '') return setVal('');
        const n = Number(s);
        if (Number.isNaN(n)) return;
        setVal(String(clamp(n)));
      }}
      placeholder="Qty"
      className={className}
      required
    />
  );
}
