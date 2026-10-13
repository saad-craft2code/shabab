"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Invoice, type Operator, type CompanySettings } from "@/lib/api";
import { calcTotals, formatUSD, toInputDate, loadGross, totalMiles } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Loader2,
  ArrowLeft,
  Fuel,
  PiggyBank,
  Shield,
  Coins,
  Wrench,
  Percent,
} from "lucide-react";
import type { Navigate } from "@/lib/view";

interface LoadRow {
  loadNumber: string;
  date: string;
  pickup: string;
  delivery: string;
  miles: string;
  rateType: "FLAT" | "PER_MILE";
  rate: string;
}

interface DedRow {
  label: string;
  amount: string;
}

const DEDUCTION_PRESETS = [
  "Fuel Advance",
  "Escrow Deposit",
  "Insurance",
  "Tolls",
  "Lumper Fee",
  "Repair / Maintenance",
  "Truck Rental",
];

function emptyLoad(deductDays = 0): LoadRow {
  const d = new Date();
  d.setDate(d.getDate() - deductDays);
  return {
    loadNumber: "",
    date: d.toISOString().slice(0, 10),
    pickup: "",
    delivery: "",
    miles: "",
    rateType: "PER_MILE",
    rate: "",
  };
}

export default function InvoiceFormView({
  navigate,
  operatorId,
  invoiceId,
}: {
  navigate: Navigate;
  operatorId?: string;
  invoiceId?: string;
}) {
  const isEdit = !!invoiceId;
  const { toast } = useToast();

  const [operators, setOperators] = useState<Operator[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [number, setNumber] = useState("");
  const [selectedOperator, setSelectedOperator] = useState(operatorId || "");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [mcFeePercent, setMcFeePercent] = useState("10");
  const [notes, setNotes] = useState("");

  const [loads, setLoads] = useState<LoadRow[]>([emptyLoad()]);
  const [deductions, setDeductions] = useState<DedRow[]>([]);

  useEffect(() => {
    Promise.all([
      api.get("/api/operators"),
      api.get("/api/settings"),
    ])
      .then(async ([opsRes, setRes]) => {
        const ops: Operator[] = opsRes.operators;
        setOperators(ops);
        setSettings(setRes.settings);
        if (isEdit && invoiceId) {
          const res = await api.get(`/api/invoices/${invoiceId}`);
          const inv: Invoice = res.invoice;
          setNumber(inv.number);
          setSelectedOperator(inv.operatorId);
          setIssueDate(toInputDate(inv.issueDate));
          setPeriodStart(toInputDate(inv.periodStart));
          setPeriodEnd(toInputDate(inv.periodEnd));
          setMcFeePercent(String(inv.mcFeePercent));
          setNotes(inv.notes || "");
          setLoads(
            inv.loads.map((l) => ({
              loadNumber: l.loadNumber,
              date: toInputDate(l.date),
              pickup: l.pickup,
              delivery: l.delivery,
              miles: String(l.miles),
              rateType: l.rateType === "PER_MILE" ? "PER_MILE" : "FLAT",
              rate: String(l.rate),
            }))
          );
          setDeductions(inv.deductions.map((d) => ({ label: d.label, amount: String(d.amount) })));
        } else {
          api.get("/api/invoices/next-number").then((r) => setNumber(r.number)).catch(() => {});
          const active = ops.find((o) => o.id === operatorId) || ops.find((o) => o.status === "ACTIVE");
          if (active) {
            setSelectedOperator(active.id);
            setMcFeePercent(String(active.mcFeePercent));
          }
          // default period = current week
          const now = new Date();
          const day = (now.getDay() + 6) % 7; // Monday-based
          const start = new Date(now);
          start.setDate(now.getDate() - day);
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          setPeriodStart(start.toISOString().slice(0, 10));
          setPeriodEnd(end.toISOString().slice(0, 10));
        }
      })
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [invoiceId, isEdit, operatorId]);  

  function onOperatorChange(id: string) {
    setSelectedOperator(id);
    const op = operators.find((o) => o.id === id);
    if (op) setMcFeePercent(String(op.mcFeePercent));
  }

  function updateLoad(i: number, patch: Partial<LoadRow>) {
    setLoads((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function updateDed(i: number, patch: Partial<DedRow>) {
    setDeductions((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const numericLoads = useMemo(
    () =>
      loads.map((l) => ({
        miles: Number(l.miles) || 0,
        rateType: l.rateType,
        rate: Number(l.rate) || 0,
      })),
    [loads]
  );
  const numericDeds = useMemo(
    () => deductions.map((d) => ({ amount: Number(d.amount) || 0 })),
    [deductions]
  );
  const calc = calcTotals(numericLoads, Number(mcFeePercent) || 0, numericDeds);

  async function save() {
    if (!selectedOperator) {
      toast({ title: "Operator required", description: "Select the owner-operator for this settlement.", variant: "destructive" });
      return;
    }
    const validLoads = loads.filter(
      (l) => l.loadNumber.trim() || l.pickup.trim() || l.delivery.trim() || Number(l.rate)
    );
    if (validLoads.length === 0) {
      toast({ title: "Loads required", description: "Add at least one load with a rate.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        operatorId: selectedOperator,
        issueDate,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        mcFeePercent: Number(mcFeePercent) || 0,
        notes,
        loads: validLoads.map((l) => ({
          loadNumber: l.loadNumber,
          date: l.date,
          pickup: l.pickup,
          delivery: l.delivery,
          miles: Number(l.miles) || 0,
          rateType: l.rateType,
          rate: Number(l.rate) || 0,
        })),
        deductions: deductions
          .filter((d) => d.label.trim() && Number(d.amount))
          .map((d) => ({ label: d.label, amount: Number(d.amount) || 0 })),
      };
      const res = isEdit
        ? await api.patch(`/api/invoices/${invoiceId}`, payload)
        : await api.post("/api/invoices", payload);
      toast({
        title: isEdit ? "Settlement updated" : "Settlement created",
        description: `${res.invoice.number} saved. Net payout ${formatUSD(calcTotals(res.invoice.loads, res.invoice.mcFeePercent, res.invoice.deductions).netPayout)}.`,
      });
      navigate({ name: "invoice-detail", id: res.invoice.id });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const quickAdd = (label: string) => {
    setDeductions((rows) => [...rows, { label, amount: "" }]);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ name: "invoices" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              {isEdit ? `Edit Settlement ${number}` : "New Settlement"}
            </h1>
            <p className="text-sm text-neutral-500">
              {isEdit
                ? "Update loads or deductions — totals recalculate automatically."
                : "Fill the load details. The 10% MC fee and net payout are calculated automatically."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ name: "invoices" })} className="border-neutral-300">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Settlement"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Details card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="font-semibold text-neutral-800 text-sm">SETTLEMENT DETAILS</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-600">Owner Operator *</Label>
                  <select
                    value={selectedOperator}
                    onChange={(e) => onOperatorChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select operator…</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id} disabled={op.status !== "ACTIVE"}>
                        {op.name}
                        {op.status !== "ACTIVE" ? " (inactive)" : ""}
                        {op.truckNumber ? ` — ${op.truckNumber}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-600">Settlement #</Label>
                  <Input value={number} disabled className="bg-neutral-50 text-neutral-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-600">Issue Date</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-600">MC Fee % (auto from operator)</Label>
                  <div className="relative">
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={mcFeePercent}
                      onChange={(e) => setMcFeePercent(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-600">Period Start</Label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-600">Period End</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loads card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-neutral-800 text-sm">
                  LOADS <span className="text-neutral-400 font-normal">({loads.length})</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLoads((r) => [...r, emptyLoad(1)])}
                  className="border-neutral-300 h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Load
                </Button>
              </div>

              <div className="space-y-4">
                {loads.map((l, i) => {
                  const gross = loadGross({
                    miles: Number(l.miles) || 0,
                    rateType: l.rateType,
                    rate: Number(l.rate) || 0,
                  });
                  return (
                    <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-500 tracking-wider">
                          LOAD {i + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold tnum text-neutral-900">
                            {formatUSD(gross)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setLoads((r) => r.filter((_, idx) => idx !== i))}
                            disabled={loads.length === 1}
                            title="Remove load"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-500">Load #</Label>
                          <Input
                            value={l.loadNumber}
                            onChange={(e) => updateLoad(i, { loadNumber: e.target.value })}
                            placeholder="LD-1234"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-500">Date</Label>
                          <Input type="date" value={l.date} onChange={(e) => updateLoad(i, { date: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-500">Pickup (City, ST)</Label>
                          <Input
                            value={l.pickup}
                            onChange={(e) => updateLoad(i, { pickup: e.target.value })}
                            placeholder="Greensboro, NC"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-500">Delivery (City, ST)</Label>
                          <Input
                            value={l.delivery}
                            onChange={(e) => updateLoad(i, { delivery: e.target.value })}
                            placeholder="Atlanta, GA"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-500">Miles</Label>
                          <Input
                            type="number"
                            min="0"
                            value={l.miles}
                            onChange={(e) => updateLoad(i, { miles: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-500">Rate Type</Label>
                          <select
                            value={l.rateType}
                            onChange={(e) => updateLoad(i, { rateType: e.target.value as LoadRow["rateType"] })}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="PER_MILE">Per Mile</option>
                            <option value="FLAT">Flat Rate</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-500">
                            {l.rateType === "PER_MILE" ? "Rate ($/mile)" : "Flat Rate ($)"}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.rate}
                            onChange={(e) => updateLoad(i, { rate: e.target.value })}
                            placeholder={l.rateType === "PER_MILE" ? "1.65" : "650.00"}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-500">Gross Amount</Label>
                          <div className="h-10 flex items-center justify-end px-3 rounded-md border border-neutral-200 bg-white text-sm font-bold tnum">
                            {formatUSD(gross)}
                          </div>
                        </div>
                      </div>
                      {l.rateType === "PER_MILE" && Number(l.miles) > 0 && Number(l.rate) > 0 && (
                        <p className="text-[11px] text-neutral-400">
                          {Number(l.miles).toLocaleString()} mi × ${Number(l.rate).toFixed(2)}/mi ={" "}
                          <span className="font-semibold text-neutral-600">{formatUSD(gross)}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Deductions card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-neutral-800 text-sm">
                  OTHER DEDUCTIONS{" "}
                  <span className="text-neutral-400 font-normal">
                    (besides the {mcFeePercent || 0}% MC fee)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeductions((r) => [...r, { label: "", amount: "" }])}
                  className="border-neutral-300 h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Deduction
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {DEDUCTION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => quickAdd(preset)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-neutral-200 bg-white hover:bg-neutral-100 transition-colors text-neutral-600"
                  >
                    {preset === "Fuel Advance" && <Fuel className="h-3 w-3 text-amber-600" />}
                    {preset === "Escrow Deposit" && <PiggyBank className="h-3 w-3 text-amber-600" />}
                    {preset === "Insurance" && <Shield className="h-3 w-3 text-amber-600" />}
                    {preset === "Tolls" && <Coins className="h-3 w-3 text-amber-600" />}
                    {preset === "Repair / Maintenance" && <Wrench className="h-3 w-3 text-amber-600" />}
                    {preset.includes("Truck Rental") && <TruckIcon />}
                    {preset}
                  </button>
                ))}
              </div>

              {deductions.length === 0 && (
                <p className="text-xs text-neutral-400">
                  No extra deductions. Only the {mcFeePercent || 0}% MC fee will apply.
                </p>
              )}

              <div className="space-y-2.5">
                {deductions.map((d, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-neutral-500">Description</Label>
                      <Input
                        list="ded-presets"
                        value={d.label}
                        onChange={(e) => updateDed(i, { label: e.target.value })}
                        placeholder="e.g. Fuel Advance"
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <Label className="text-[11px] text-neutral-500">Amount ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={d.amount}
                        onChange={(e) => updateDed(i, { amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => setDeductions((r) => r.filter((_, idx) => idx !== i))}
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
              <datalist id="ded-presets">
                {DEDUCTION_PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>

              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-600">Notes (printed on settlement)</Label>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes for the operator…"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: live summary */}
        <Card className="lg:sticky lg:top-24">
          <CardContent className="p-5 space-y-4">
            <div className="font-semibold text-neutral-800 text-sm">LIVE SUMMARY</div>
            <div className="space-y-2.5 text-sm">
              <Line label={`Gross Revenue (${loads.length} load${loads.length === 1 ? "" : "s"})`} value={formatUSD(calc.grossTotal)} />
              <Line label={`Total Miles`} value={totalMiles(numericLoads).toLocaleString("en-US")} plain />
              <div className="border-t border-dashed border-neutral-200 pt-2.5">
                <Line
                  label={`MC / Dispatch Fee (${mcFeePercent || 0}%)`}
                  value={`- ${formatUSD(calc.mcFee)}`}
                  muted
                />
                {deductions
                  .filter((d) => d.label.trim() && Number(d.amount))
                  .map((d, i) => (
                    <Line key={i} label={d.label} value={`- ${formatUSD(Number(d.amount))}`} muted />
                  ))}
                <Line label="Total Deductions" value={`- ${formatUSD(calc.totalDeductions)}`} />
              </div>
            </div>
            <div className="bg-neutral-950 text-white rounded-xl px-4 py-4 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider">NET PAYOUT</span>
              <span className="text-xl font-bold text-emerald-400 tnum">
                {formatUSD(calc.netPayout)}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Net = Gross − {mcFeePercent || 0}% MC fee − other deductions. The operator receives
              this amount after brokers pay {settings?.name || "Shabab Express"}.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Line({ label, value, muted, plain }: { label: string; value: string; muted?: boolean; plain?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-[13px] ${muted ? "text-neutral-500" : "text-neutral-700"}`}>{label}</span>
      <span className={`tnum font-semibold ${muted ? "text-neutral-500" : plain ? "text-neutral-600" : "text-neutral-900"}`}>
        {value}
      </span>
    </div>
  );
}

function TruckIcon() {
  return (
    <svg className="h-3 w-3 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17h4V5H2v12h3" />
      <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}
