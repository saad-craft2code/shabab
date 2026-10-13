"use client";

export interface Operator {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  truckNumber: string | null;
  trailerNumber: string | null;
  cdlNumber: string | null;
  cdlState: string | null;
  cdlExpiry: string | null;
  mcFeePercent: number;
  status: string;
  notes: string | null;
  createdAt: string;
  invoices?: { id: string; status: string }[];
}

export interface Truck {
  id: string;
  unitNumber: string;
  type: string; // TRUCK | TRAILER
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  plateNumber: string | null;
  plateState: string | null;
  insuranceProvider: string | null;
  insuranceExpiry: string | null;
  registrationExpiry: string | null;
  inspectionDue: string | null;
  status: string; // ACTIVE | MAINTENANCE | INACTIVE
  notes: string | null;
  operatorId: string | null;
  operator?: { id: string; name: string } | null;
  expenses?: { id: string; amount: number }[];
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  truckId: string | null;
  truck?: { id: string; unitNumber: string; type: string } | null;
  createdAt: string;
}

export interface LoadItem {
  id: string;
  invoiceId: string;
  loadNumber: string;
  date: string;
  pickup: string;
  delivery: string;
  miles: number;
  rateType: string;
  rate: number;
  gross: number;
  sortOrder: number;
}

export interface DeductionItem {
  id: string;
  invoiceId: string;
  label: string;
  amount: number;
  sortOrder: number;
}

export interface Invoice {
  id: string;
  number: string;
  issueDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  operatorId: string;
  operator: Operator;
  mcFeePercent: number;
  status: string;
  paidDate: string | null;
  paymentMethod: string | null;
  paymentRef: string | null;
  notes: string | null;
  createdAt: string;
  loads: LoadItem[];
  deductions: DeductionItem[];
}

export interface CompanySettings {
  id: string;
  name: string;
  legalName: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  mcNumber: string;
  dotNumber: string;
  mcFeePercent: number;
  paymentTerms: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  type: string;
  holderType: "COMPANY" | "OPERATOR" | "TRUCK" | string;
  operatorId?: string | null;
  operator?: { id: string; name: string } | null;
  truckId?: string | null;
  truck?: { id: string; unitNumber: string; type: string } | null;
  documentNumber?: string | null;
  issuedDate?: string | null;
  expiryDate?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  hasFile?: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface Stats {
  grossYTD: number;
  netYTD: number;
  outstanding: number;
  mcFeesYTD: number;
  paidCount: number;
  pendingCount: number;
  totalInvoices: number;
  totalLoads: number;
  activeOperators: number;
  totalOperators: number;
  months: { key: string; label: string; net: number }[];
  recentInvoices: {
    id: string;
    number: string;
    operatorName: string;
    issueDate: string;
    status: string;
    gross: number;
    net: number;
  }[];
  fleet: {
    trucks: number;
    trailers: number;
    activeUnits: number;
    totalUnits: number;
  };
  alerts: {
    kind: string;
    unit: string;
    detail: string;
    date: string;
    daysLeft: number;
  }[];
  expensesMonth: number;
  expensesYTD: number;
  topCategories: { category: string; total: number }[];
}

async function handle(res: Response) {
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: <T = any>(url: string): Promise<T> =>
    fetch(url, { cache: "no-store" }).then(handle) as Promise<T>,
  post: <T = any>(url: string, body: unknown): Promise<T> =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle) as Promise<T>,
  patch: <T = any>(url: string, body: unknown): Promise<T> =>
    fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle) as Promise<T>,
  put: <T = any>(url: string, body: unknown): Promise<T> =>
    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle) as Promise<T>,
  del: <T = any>(url: string): Promise<T> =>
    fetch(url, { method: "DELETE" }).then(handle) as Promise<T>,
};

export async function downloadInvoicePdf(id: string, number: string) {
  const res = await fetch(`/api/invoices/${id}/pdf`);
  if (!res.ok) throw new Error("Failed to generate PDF");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Shabab-Express-Settlement-${number}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
