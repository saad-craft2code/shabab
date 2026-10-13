"use client";

import { useEffect, useState } from "react";
import {
  api,
  downloadInvoicePdf,
  type Invoice,
  type CompanySettings,
} from "@/lib/api";
import { calcTotals, formatUSD, formatDate, toInputDate } from "@/lib/format";
import InvoicePaper from "@/components/invoice-paper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Download,
  Pencil,
  Copy,
  Trash2,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Share2,
  Mail,
  Printer,
  BadgeCheck,
} from "lucide-react";
import type { Navigate } from "@/lib/view";

export default function InvoiceDetailView({
  id,
  navigate,
}: {
  id: string;
  navigate: Navigate;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [payDialog, setPayDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("Direct Deposit");
  const [payRef, setPayRef] = useState("");
  const { toast } = useToast();

  function load() {
    api
      .get(`/api/invoices/${id}`)
      .then((d) => setInvoice(d.invoice))
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  }

  useEffect(() => {
    load();
    api.get("/api/settings").then((d) => setSettings(d.settings)).catch(() => {});
  }, [id]);  

  if (!invoice) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const calc = calcTotals(invoice.loads, invoice.mcFeePercent, invoice.deductions);

  async function download() {
    setBusy("pdf");
    try {
      await downloadInvoicePdf(invoice!.id, invoice!.number);
      toast({ title: "PDF downloaded", description: "Ready to print or share with your operator." });
    } catch (e) {
      toast({ title: "Download failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function markPaid() {
    setBusy("pay");
    try {
      await api.patch(`/api/invoices/${invoice!.id}`, {
        status: "PAID",
        paidDate: payDate,
        paymentMethod: payMethod,
        paymentRef: payRef,
      });
      toast({ title: "Marked as paid", description: `${invoice!.number} — ${formatUSD(calc.netPayout)} via ${payMethod}` });
      setPayDialog(false);
      load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function reopen() {
    setBusy("reopen");
    try {
      await api.patch(`/api/invoices/${invoice!.id}`, { status: "PENDING" });
      toast({ title: "Reopened", description: `${invoice!.number} is pending again.` });
      load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function duplicate() {
    setBusy("dup");
    try {
      await api.post("/api/invoices", {
        operatorId: invoice!.operatorId,
        mcFeePercent: invoice!.mcFeePercent,
        notes: invoice!.notes,
        issueDate: new Date().toISOString(),
        loads: invoice!.loads.map((l) => ({
          loadNumber: l.loadNumber,
          date: l.date,
          pickup: l.pickup,
          delivery: l.delivery,
          miles: l.miles,
          rateType: l.rateType,
          rate: l.rate,
        })),
        deductions: invoice!.deductions.map((d) => ({ label: d.label, amount: d.amount })),
      });
      toast({ title: "Settlement duplicated", description: "A new copy was created with the next number." });
      navigate({ name: "invoices" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    setBusy("del");
    try {
      await api.del(`/api/invoices/${invoice!.id}`);
      toast({ title: "Settlement deleted", description: invoice!.number });
      navigate({ name: "invoices" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  function shareText() {
    return [
      `${settings?.name || "Shabab Express"} — Owner Operator Settlement`,
      `Settlement #: ${invoice!.number}`,
      `Operator: ${invoice!.operator.name}`,
      `Period: ${invoice!.periodStart ? `${formatDate(invoice!.periodStart)} – ${formatDate(invoice!.periodEnd)}` : "—"}`,
      `Loads: ${invoice!.loads.length} | Miles: ${invoice!.loads.reduce((s, l) => s + l.miles, 0).toLocaleString()}`,
      `Gross: ${formatUSD(calc.grossTotal)}`,
      `MC Fee (${invoice!.mcFeePercent}%): -${formatUSD(calc.mcFee)}`,
      ...invoice!.deductions.map((d) => `${d.label}: -${formatUSD(d.amount)}`),
      `NET PAYOUT: ${formatUSD(calc.netPayout)}`,
      `Status: ${invoice!.status}`,
    ].join("\n");
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(shareText());
      toast({ title: "Copied", description: "Settlement summary copied — paste it in a text message." });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard unavailable in this browser.", variant: "destructive" });
    }
  }

  function emailSummary() {
    const subject = `Settlement ${invoice!.number} — ${settings?.name || "Shabab Express"}`;
    window.location.href = `mailto:${invoice!.operator.email || ""}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(shareText())}`;
  }

  function printPage() {
    window.print();
  }

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ name: "invoices" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                {invoice.number}
              </h1>
              {invoice.status === "PAID" ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 hover:bg-emerald-100">
                  <BadgeCheck className="h-3 w-3 mr-1" /> PAID
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 border-0 hover:bg-amber-100">
                  PENDING
                </Badge>
              )}
            </div>
            <p className="text-sm text-neutral-500">
              {invoice.operator.name} · {formatDate(invoice.issueDate)}
              {invoice.periodStart
                ? ` · Period ${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {invoice.status === "PENDING" ? (
            <Button
              onClick={() => setPayDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark as Paid
            </Button>
          ) : (
            <Button variant="outline" onClick={reopen} disabled={busy === "reopen"} className="border-neutral-300">
              {busy === "reopen" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
              Reopen
            </Button>
          )}
          <Button onClick={download} disabled={busy === "pdf"} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            {busy === "pdf" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            Download PDF
          </Button>
          <Button variant="outline" onClick={copySummary} className="border-neutral-300">
            <Share2 className="h-4 w-4 mr-1.5" /> Copy Summary
          </Button>
          <Button variant="outline" onClick={emailSummary} className="border-neutral-300">
            <Mail className="h-4 w-4 mr-1.5" /> Email
          </Button>
          <Button variant="outline" onClick={printPage} className="border-neutral-300 hidden sm:flex">
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="border-neutral-300"
            title="Edit"
            onClick={() => navigate({ name: "invoice-edit", id: invoice.id })}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="border-neutral-300"
            title="Duplicate"
            onClick={duplicate}
            disabled={busy === "dup"}
          >
            {busy === "dup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="border-neutral-300"
            title="Delete"
            onClick={() => setDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </div>

      {/* Paid banner */}
      {invoice.status === "PAID" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3.5 px-5 flex items-center gap-3 text-sm text-emerald-800">
            <BadgeCheck className="h-4 w-4" />
            Paid {formatDate(invoice.paidDate)}
            {invoice.paymentMethod ? ` via ${invoice.paymentMethod}` : ""}
            {invoice.paymentRef ? ` · Ref ${invoice.paymentRef}` : ""} · Net{" "}
            <span className="font-bold">{formatUSD(calc.netPayout)}</span>
          </CardContent>
        </Card>
      )}

      {/* Paper preview */}
      <InvoicePaper invoice={invoice} settings={settings} />

      {/* Payment dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark {invoice.number} as Paid</DialogTitle>
            <DialogDescription>
              Net payout {formatUSD(calc.netPayout)} to {invoice.operator.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-600">Payment Date</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-600">Payment Method</Label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option>Direct Deposit</option>
                <option>Zelle</option>
                <option>Company Check</option>
                <option>ACH</option>
                <option>Cash App</option>
                <option>Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-600">Reference # (optional)</Label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="e.g. ACH-88213" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayDialog(false)}>
                Cancel
              </Button>
              <Button onClick={markPaid} disabled={busy === "pay"} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {busy === "pay" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Confirm Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete settlement {invoice.number}?</AlertDialogTitle>
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
