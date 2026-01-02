import { formatMoney, money } from '@/lib/money';

export default function Money({ value, minor, currency }: { value?: number | string; minor?: bigint | number; currency?: string }) {
  const val = minor !== undefined ? Number(minor) / 100 : value;
  return <span>{formatMoney(money(val ?? 0), currency)}</span>;
}

