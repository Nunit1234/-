export const money = (n: number | string | null | undefined) =>
  (Number(n) || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' ฿';

// ใส่เครื่องหมายลบเฉพาะตอนค่าไม่เท่ากับศูนย์ กันไม่ให้ขึ้นว่า "−0 ฿"
export const signed = (n: number) => (n < 0 ? '−' : '') + money(Math.abs(n));

export const fmtQty = (n: number) =>
  Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);

export const unitInfo = (unit: string, perUnit: number) =>
  unit + (perUnit > 1 ? ` (${perUnit} ฟอง)` : '');
