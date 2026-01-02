// helpers/money.ts
export const toMinor = (amount: number, scale = 2): bigint =>
  BigInt(Math.round((amount ?? 0) * Math.pow(10, scale)));

export const fromMinor = (minor: bigint | number, scale = 2): number => {
  const m = typeof minor === 'bigint' ? Number(minor) : minor;
  return m / Math.pow(10, scale);
};

export const toBps = (pct: number) => Math.round((pct ?? 0) * 100);
export const fromBps = (bps: number) => (bps ?? 0) / 100;

export function toBigIntMinor(value: unknown, scale = 2): bigint {
  if (typeof value === 'bigint') return value;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new Error('Invalid minor');
  }
  const factor = Math.pow(10, scale);
  return BigInt(Math.round(num * factor));
}
