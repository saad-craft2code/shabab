export type View =
  | { name: "dashboard" }
  | { name: "operators" }
  | { name: "invoices" }
  | { name: "fleet" }
  | { name: "documents" }
  | { name: "expenses" }
  | { name: "invoice-new"; operatorId?: string }
  | { name: "invoice-edit"; id: string }
  | { name: "invoice-detail"; id: string }
  | { name: "settings" };

export type Navigate = (v: View) => void;
