export type UnitPriceUpdate = { itemId: string; unitPriceMajor: number };
export type ReviewFlagUpdate = { itemId: string; flag: boolean };
export type ScheduleSaveInput = {
  note?: string | null;
  items: Array<{
    id?: string | null;
    title: string;
    description?: string | null;
    unit?: string | null;
    quantity?: number | null;
    plannedStart?: string | null;
    plannedEnd?: string | null;
    employees?: number | null;
    estHours?: number | null;
    note?: string | null;
    employeeIds?: string[];
  }>;
};

export function parseUnitPriceUpdates(formData: FormData): UnitPriceUpdate[] {
  const updates: UnitPriceUpdate[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('unitPrice-') || typeof value !== 'string') continue;
    if (value.trim() === '') continue;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) continue;
    updates.push({ itemId: key.replace('unitPrice-', ''), unitPriceMajor: num });
  }
  return updates;
}

export function parseReviewFlagUpdates(formData: FormData): ReviewFlagUpdate[] {
  const updates: ReviewFlagUpdate[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('reviewFlag-') || typeof value !== 'string') continue;
    updates.push({ itemId: key.replace('reviewFlag-', ''), flag: value === '1' });
  }
  return updates;
}
