export const money = (n: number | string | null | undefined) =>
  (Number(n) || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' ฿';

export const fmtQty = (n: number) =>
  Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);

export const unitInfo = (unit: string, perUnit: number) =>
  unit + (perUnit > 1 ? ` (${perUnit} ฟอง)` : '');
