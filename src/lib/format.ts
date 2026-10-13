export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(n) ? n : 0);
}

/** Plain number with 2 decimals, no symbol (for PDF / paper where $ is separate) */
export function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const neg = v < 0;
  const abs = Math.abs(v);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return neg ? `-$${s}` : `$${s}`;
}

export function num(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function toInputDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export interface LoadCalc {
  loadNumber: string;
  date: string;
  pickup: string;
  delivery: string;
  miles: number;
  rateType: "FLAT" | "PER_MILE";
  rate: number;
  gross: number;
}

export function loadGross(l: { miles: number; rateType: string; rate: number }): number {
  if (l.rateType === "PER_MILE") {
    return Math.round(l.miles * l.rate * 100) / 100;
  }
  return Math.round(l.rate * 100) / 100;
}

export interface CalcResult {
  grossTotal: number;
  mcFee: number;
  otherDeductions: number;
  totalDeductions: number;
  netPayout: number;
}

export function calcTotals(
  loads: { miles: number; rateType: string; rate: number }[],
  mcFeePercent: number,
  deductions: { amount: number }[]
): CalcResult {
  const grossTotal =
    Math.round(loads.reduce((s, l) => s + loadGross(l), 0) * 100) / 100;
  const mcFee =
    Math.round(grossTotal * (mcFeePercent / 100) * 100) / 100;
  const otherDeductions =
    Math.round(deductions.reduce((s, d) => s + (d.amount || 0), 0) * 100) / 100;
  const totalDeductions = mcFee + otherDeductions;
  const netPayout = Math.round((grossTotal - totalDeductions) * 100) / 100;
  return { grossTotal, mcFee, otherDeductions, totalDeductions, netPayout };
}

export function totalMiles(
  loads: { miles: number }[]
): number {
  return loads.reduce((s, l) => s + (l.miles || 0), 0);
}
