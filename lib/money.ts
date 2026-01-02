//@ts-nocheck
import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal;

export function money(x: Decimal.Value): Money {
  if (x === null || x === undefined) return new Decimal(0);
  if (typeof x === 'string' && x.trim() === '') return new Decimal(0);
  if (Decimal.isDecimal(x as any)) return x as Decimal;
  try {
    return new Decimal(x);
  } catch {
    return new Decimal(0);
  }
}

export function roundMoney(x: Money): Money {
  return new Decimal(x.toFixed(2));
}

export function toNumber(x: Money): number {
  return Number(x);
}

export function add(a: Money, b: Money): Money {
  return a.add(b);
}

export function mul(a: Money, b: Decimal.Value): Money {
  return a.mul(b);
}

export function formatMoney(
  x: Money,
  currency = process.env.NEXT_PUBLIC_CURRENCY || 'USD',
) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(x));
}
