"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Expense, type Truck } from "@/lib/api";
import { formatUSD, formatDate } from "@/lib/format";
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
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Receipt,
  CalendarDays,
  Wallet,
  Tag,
} from "lucide-react";

const CATEGORIES = [
  "FUEL",
  "MAINTENANCE",
  "REPAIRS",
  "INSURANCE",
  "PLATES",
  "TOLLS",
  "OTHER",
] as const;

const CATEGORY_STYLE: Record<string, string> = {
  FUEL: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  MAINTENANCE: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  REPAIRS: "bg-rose-100 text-rose-800 hover:bg-rose-100",
  INSURANCE: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  PLATES: "bg-violet-100 text-violet-800 hover:bg-violet-100",
  TOLLS: "bg-lime-100 text-lime-800 hover:bg-lime-100",
  OTHER: "bg-neutral-200 text-neutral-700 hover:bg-neutral-200",
};

interface FormState {
  date: string;
  category: string;
  description: string;
  amount: string;
  truckId: string;
}

const EMPTY: FormState = {
  date: new Date().toISOString().slice(0, 10),
  category: "FUEL",
  description: "",
  amount: "",
  truckId: "",
};

export default function ExpensesView() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const { toast } = useToast();

  function load() {
    api
      .get("/api/expenses")
      .then((d) => setExpenses(d.expenses))
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }));
    api
      .get("/api/trucks")
      .then((d) => setTrucks(d.trucks))
      .catch(() => {});
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!expenses) return [];
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
      if (monthFilter && e.date.slice(0, 7) !== monthFilter) return false;
      if (!q) return true;
      return [e.description, e.truck?.unitNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [expenses, categoryFilter, monthFilter, search]);

  const totals = useMemo(() => {
    if (!expenses) return { month: 0, year: 0, filteredTotal: 0 };
    const now = new Date().toISOString().slice(0, 7);
    const month = expenses
      .filter((e) => e.date.slice(0, 7) === now)
      .reduce((s, e) => s + e.amount, 0);
    const year = expenses.reduce((s, e) => s + e.amount, 0);
    const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);
    return { month, year, filteredTotal };
  }, [expenses, filtered]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      date: e.date ? e.date.slice(0, 10) : "",
      category: e.category,
      description: e.description || "",
      amount: String(e.amount ?? ""),
      truckId: e.truckId || "",
    });
    setDialogOpen(true);
  }

  async function save() {
    const amount = Number(form.amount);
    if (!form.description.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive dollar amount.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, amount, truckId: form.truckId || null };
      if (editing) {
        await api.patch(`/api/expenses/${editing.id}`, payload);
        toast({ title: "Expense updated" });
      } else {
        await api.post("/api/expenses", payload);
        toast({ title: "Expense added", description: formatUSD(amount) });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    try {
      await api.del(`/api/expenses/${deleteTarget.id}`);
      toast({ title: "Expense removed" });
      load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Expenses
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Company fleet costs — fuel, maintenance, insurance, plates and more.
          </p>
        </div>
        <Button onClick={openAdd} className="bg-neutral-900 hover:bg-neutral-800 text-white">
          <Plus className="h-4 w-4 mr-1.5" /> Add Expense
        </Button>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="This Month"
          value={expenses ? formatUSD(totals.month) : null}
          accent="text-amber-600 bg-amber-100"
        />
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="This Year (YTD)"
          value={expenses ? formatUSD(totals.year) : null}
          accent="text-neutral-700 bg-neutral-200"
        />
        <StatCard
          icon={<Tag className="h-4 w-4" />}
          label="Filtered Total"
          value={expenses ? formatUSD(totals.filteredTotal) : null}
          sub={`${filtered.length} entr${filtered.length === 1 ? "y" : "ies"} shown`}
          accent="text-emerald-700 bg-emerald-100"
        />
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-[13px] text-neutral-700"
        >
          <option value="ALL">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="h-9 w-[160px]"
        />
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, unit…"
            className="pl-8 h-9"
          />
        </div>
        {(categoryFilter !== "ALL" || monthFilter || search) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-neutral-500"
            onClick={() => {
              setCategoryFilter("ALL");
              setMonthFilter("");
              setSearch("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* table */}
      <Card className="border-neutral-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[640px]">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[10.5px] tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-semibold">DATE</th>
                  <th className="px-4 py-3 font-semibold">CATEGORY</th>
                  <th className="px-4 py-3 font-semibold">DESCRIPTION</th>
                  <th className="px-4 py-3 font-semibold">UNIT</th>
                  <th className="px-4 py-3 font-semibold text-right">AMOUNT</th>
                  <th className="px-4 py-3 font-semibold text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {!expenses &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-neutral-100">
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {expenses && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <Receipt className="h-9 w-9 mx-auto text-neutral-300 mb-3" />
                      <p className="text-neutral-500 mb-1">No expenses found.</p>
                    </td>
                  </tr>
                )}
                {expenses &&
                  filtered.map((e) => (
                    <tr key={e.id} className="border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors">
                      <td className="px-4 py-3 tnum text-neutral-600">{formatDate(e.date)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`border-0 text-[10px] px-1.5 font-semibold ${
                            CATEGORY_STYLE[e.category] || CATEGORY_STYLE.OTHER
                          }`}
                        >
                          {e.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-800 max-w-[280px] truncate">
                        {e.description}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {e.truck ? (
                          <span className="font-medium">{e.truck.unitNumber}</span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tnum text-neutral-900">
                        {formatUSD(e.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)} title="Edit">
                            <Pencil className="h-3.5 w-3.5 text-neutral-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(e)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle>
            <DialogDescription>
              Log fleet operating costs to keep the settlement math and bookkeeping clean.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description *">
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Diesel — Pilot Flying J #442"
                />
              </Field>
            </div>
            <Field label="Amount (USD) *">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="412.50"
              />
            </Field>
            <Field label="Unit (optional)">
              <select
                value={form.truckId}
                onChange={(e) => setForm({ ...form, truckId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Company-wide —</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.unitNumber} ({t.type})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-neutral-900 hover:bg-neutral-800 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editing ? "Save Changes" : "Add Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.description} — {formatUSD(deleteTarget?.amount || 0)}. This cannot be
              undone.
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

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  sub?: string;
  accent: string;
}) {
  return (
    <Card className="border-neutral-200">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent}`}>
            {icon}
          </div>
          <span className="text-xs font-medium text-neutral-500 tracking-wide">{label}</span>
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 tnum">
          {value === null ? <Skeleton className="h-8 w-28" /> : value}
        </div>
        {sub && <div className="text-xs text-neutral-400 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-neutral-600">{label}</Label>
      {children}
      {hint && <p className="text-[10.5px] text-neutral-400">{hint}</p>}
    </div>
  );
}
