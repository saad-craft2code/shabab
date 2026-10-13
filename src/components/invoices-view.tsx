"use client";

import { useEffect, useMemo, useState } from "react";
import { api, downloadInvoicePdf, type Invoice, type Operator } from "@/lib/api";
import { formatUSD, formatDate, calcTotals } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Download,
  Eye,
  Trash2,
  FileText,
  Loader2,
  Copy,
} from "lucide-react";
import type { Navigate } from "@/lib/view";

export default function InvoicesView({ navigate }: { navigate: Navigate }) {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [status, setStatus] = useState("ALL");
  const [operatorId, setOperatorId] = useState("ALL");
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [dupBusy, setDupBusy] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.get("/api/operators").then((d) => setOperators(d.operators)).catch(() => {});
  }, []);

  function load() {
    api
      .get("/api/invoices")
      .then((d) => setInvoices(d.invoices))
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  }

  useEffect(load, []);  

  const filtered = useMemo(() => {
    if (!invoices) return [];
    const query = q.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (status !== "ALL" && inv.status !== status) return false;
      if (operatorId !== "ALL" && inv.operatorId !== operatorId) return false;
      if (query) {
        const hay = `${inv.number} ${inv.operator.name} ${inv.loads
          .map((l) => l.loadNumber)
          .join(" ")}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [invoices, status, operatorId, q]);

  async function download(inv: Invoice) {
    setPdfBusy(inv.id);
    try {
      await downloadInvoicePdf(inv.id, inv.number);
      toast({ title: "PDF downloaded", description: `Settlement ${inv.number} is ready to share.` });
    } catch (e) {
      toast({ title: "Download failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPdfBusy(null);
    }
  }

  async function duplicate(inv: Invoice) {
    setDupBusy(inv.id);
    try {
      const full = await api.get(`/api/invoices/${inv.id}`);
      const src: Invoice = full.invoice;
      await api.post("/api/invoices", {
        operatorId: src.operatorId,
        mcFeePercent: src.mcFeePercent,
        notes: src.notes,
        issueDate: new Date().toISOString(),
        periodStart: null,
        periodEnd: null,
        loads: src.loads.map((l) => ({
          loadNumber: l.loadNumber,
          date: l.date,
          pickup: l.pickup,
          delivery: l.delivery,
          miles: l.miles,
          rateType: l.rateType,
          rate: l.rate,
        })),
        deductions: src.deductions.map((d) => ({ label: d.label, amount: d.amount })),
      });
      toast({ title: "Settlement duplicated", description: "A new draft copy was created with the next number." });
      load();
    } catch (e) {
      toast({ title: "Duplicate failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDupBusy(null);
    }
  }

  async function doDelete() {
    if (!deleting) return;
    try {
      await api.del(`/api/invoices/${deleting.id}`);
      toast({ title: "Settlement deleted", description: deleting.number });
      load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  const tabBtn = (key: string, label: string, count: number | undefined) => {
    const active = status === key;
    return (
      <button
        key={key}
        onClick={() => setStatus(key)}
        className={`px-3.5 py-1.5 rounded-full text-[13px] transition-colors ${
          active
            ? "bg-neutral-900 text-white font-medium"
            : "text-neutral-600 hover:bg-neutral-100"
        }`}
      >
        {label}
        {count !== undefined && (
          <span className={`ml-1.5 tnum ${active ? "text-neutral-300" : "text-neutral-400"}`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Settlements
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Full history of owner-operator settlements. Download, share, or mark paid.
          </p>
        </div>
        <Button
          onClick={() => navigate({ name: "invoice-new" })}
          className="bg-neutral-900 hover:bg-neutral-800 text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Settlement
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-full p-1">
          {tabBtn("ALL", "All", invoices?.length)}
          {tabBtn("PENDING", "Pending", invoices?.filter((i) => i.status === "PENDING").length)}
          {tabBtn("PAID", "Paid", invoices?.filter((i) => i.status === "PAID").length)}
        </div>
        <select
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
          className="h-9 rounded-md border border-input bg-white px-3 text-sm text-neutral-700"
        >
          <option value="ALL">All operators</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>
              {op.name}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search #, operator, load #…"
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* List */}
      <Card className="border-neutral-200">
        <CardContent className="p-0">
          {!invoices && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}
          {invoices && filtered.length === 0 && (
            <div className="py-16 text-center">
              <FileText className="h-10 w-10 mx-auto text-neutral-300 mb-3" />
              <p className="text-neutral-500 mb-1">
                {invoices.length === 0
                  ? "No settlements yet. Create your first one."
                  : "No settlements match your filters."}
              </p>
            </div>
          )}
          {invoices && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="text-left text-[11px] tracking-wider text-neutral-400 border-b border-neutral-200">
                    <th className="px-4 py-3 font-semibold">SETTLEMENT #</th>
                    <th className="px-4 py-3 font-semibold">OPERATOR</th>
                    <th className="px-4 py-3 font-semibold">ISSUE DATE</th>
                    <th className="px-4 py-3 font-semibold text-center">LOADS</th>
                    <th className="px-4 py-3 font-semibold text-right">GROSS</th>
                    <th className="px-4 py-3 font-semibold text-right">NET PAYOUT</th>
                    <th className="px-4 py-3 font-semibold text-center">STATUS</th>
                    <th className="px-4 py-3 font-semibold text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => {
                    const calc = calcTotals(inv.loads, inv.mcFeePercent, inv.deductions);
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors cursor-pointer"
                        onClick={() => navigate({ name: "invoice-detail", id: inv.id })}
                      >
                        <td className="px-4 py-3 font-semibold text-neutral-900">{inv.number}</td>
                        <td className="px-4 py-3 text-neutral-700">{inv.operator.name}</td>
                        <td className="px-4 py-3 text-neutral-500">{formatDate(inv.issueDate)}</td>
                        <td className="px-4 py-3 text-center text-neutral-700 tnum">
                          {inv.loads.length}
                        </td>
                        <td className="px-4 py-3 text-right tnum text-neutral-700">
                          {formatUSD(calc.grossTotal)}
                        </td>
                        <td className="px-4 py-3 text-right tnum font-bold text-neutral-900">
                          {formatUSD(calc.netPayout)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${
                              inv.status === "PAID"
                                ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                : "border-amber-200 text-amber-700 bg-amber-50"
                            }`}
                          >
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Open"
                              onClick={() => navigate({ name: "invoice-detail", id: inv.id })}
                            >
                              <Eye className="h-4 w-4 text-neutral-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Download PDF"
                              onClick={() => download(inv)}
                            >
                              {pdfBusy === inv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                              ) : (
                                <Download className="h-4 w-4 text-neutral-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Duplicate"
                              onClick={() => duplicate(inv)}
                            >
                              {dupBusy === inv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                              ) : (
                                <Copy className="h-4 w-4 text-neutral-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Delete"
                              onClick={() => setDeleting(inv)}
                            >
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete settlement {deleting?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the settlement and its loads. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
