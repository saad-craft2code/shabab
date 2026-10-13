"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Truck, type Operator } from "@/lib/api";
import { formatDate } from "@/lib/format";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Truck,
  Container,
  Pencil,
  Trash2,
  Loader2,
  Search,
  ShieldCheck,
  Stamp,
  ClipboardCheck,
} from "lucide-react";

interface FormState {
  unitNumber: string;
  type: string;
  make: string;
  model: string;
  year: string;
  vin: string;
  plateNumber: string;
  plateState: string;
  insuranceProvider: string;
  insuranceExpiry: string;
  registrationExpiry: string;
  inspectionDue: string;
  status: string;
  operatorId: string;
  notes: string;
}

const EMPTY: FormState = {
  unitNumber: "",
  type: "TRUCK",
  make: "",
  model: "",
  year: "",
  vin: "",
  plateNumber: "",
  plateState: "NC",
  insuranceProvider: "",
  insuranceExpiry: "",
  registrationExpiry: "",
  inspectionDue: "",
  status: "ACTIVE",
  operatorId: "",
  notes: "",
};

export default function FleetView() {
  const [units, setUnits] = useState<Truck[] | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [filter, setFilter] = useState<"ALL" | "TRUCK" | "TRAILER">("ALL");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Truck | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Truck | null>(null);
  const { toast } = useToast();

  function load() {
    api
      .get("/api/trucks")
      .then((d) => setUnits(d.trucks))
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }));
    api
      .get("/api/operators")
      .then((d) => setOperators(d.operators))
      .catch(() => {});
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!units) return [];
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      if (filter !== "ALL" && u.type !== filter) return false;
      if (!q) return true;
      return [u.unitNumber, u.make, u.model, u.vin, u.plateNumber, u.operator?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [units, filter, search]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(u: Truck) {
    setEditing(u);
    setForm({
      unitNumber: u.unitNumber || "",
      type: u.type || "TRUCK",
      make: u.make || "",
      model: u.model || "",
      year: u.year ? String(u.year) : "",
      vin: u.vin || "",
      plateNumber: u.plateNumber || "",
      plateState: u.plateState || "",
      insuranceProvider: u.insuranceProvider || "",
      insuranceExpiry: toInputDate(u.insuranceExpiry),
      registrationExpiry: toInputDate(u.registrationExpiry),
      inspectionDue: toInputDate(u.inspectionDue),
      status: u.status || "ACTIVE",
      operatorId: u.operatorId || "",
      notes: u.notes || "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.unitNumber.trim()) {
      toast({ title: "Unit number required", description: "e.g. TR-105 or TL-205.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, year: form.year ? Number(form.year) : null, operatorId: form.operatorId || null };
      if (editing) {
        await api.patch(`/api/trucks/${editing.id}`, payload);
        toast({ title: "Unit updated", description: form.unitNumber.toUpperCase() });
      } else {
        await api.post("/api/trucks", payload);
        toast({ title: "Unit added to fleet", description: form.unitNumber.toUpperCase() });
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
      await api.del(`/api/trucks/${deleteTarget.id}`);
      toast({ title: "Unit removed", description: deleteTarget.unitNumber });
      load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }

  const truckCount = units?.filter((u) => u.type === "TRUCK").length ?? 0;
  const trailerCount = units?.filter((u) => u.type === "TRAILER").length ?? 0;
  const alertCount = units
    ? units.reduce(
        (n, u) =>
          n +
          [u.insuranceExpiry, u.registrationExpiry, u.inspectionDue].filter((d) => {
            if (!d) return false;
            const days = (new Date(d).getTime() - Date.now()) / 86400000;
            return days <= 45;
          }).length,
        0
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Fleet
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Trucks &amp; trailers running under Shabab Express — insurance, plates and inspections in one place.
          </p>
        </div>
        <Button onClick={openAdd} className="bg-neutral-900 hover:bg-neutral-800 text-white">
          <Plus className="h-4 w-4 mr-1.5" /> Add Unit
        </Button>
      </div>

      {/* summary + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
          {(["ALL", "TRUCK", "TRAILER"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 text-[13px] rounded-md transition-colors ${
                filter === f
                  ? "bg-neutral-900 text-white font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {f === "ALL" ? `All (${units?.length ?? 0})` : f === "TRUCK" ? `Trucks (${truckCount})` : `Trailers (${trailerCount})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search unit, plate, driver…"
            className="pl-8 h-9"
          />
        </div>
        {alertCount > 0 && (
          <Badge className="bg-amber-100 text-amber-800 border-0 hover:bg-amber-100">
            {alertCount} expiring soon
          </Badge>
        )}
      </div>

      {/* units table */}
      <Card className="border-neutral-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[900px]">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[10.5px] tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-semibold">UNIT</th>
                  <th className="px-4 py-3 font-semibold">VEHICLE</th>
                  <th className="px-4 py-3 font-semibold">ASSIGNED TO</th>
                  <th className="px-4 py-3 font-semibold">PLATE</th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> INSURANCE</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="inline-flex items-center gap-1"><Stamp className="h-3 w-3" /> REGISTRATION</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="inline-flex items-center gap-1"><ClipboardCheck className="h-3 w-3" /> INSPECTION</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">STATUS</th>
                  <th className="px-4 py-3 font-semibold text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {!units &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-neutral-100">
                      <td colSpan={9} className="px-4 py-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))}
                {units && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center">
                      <Truck className="h-9 w-9 mx-auto text-neutral-300 mb-3" />
                      <p className="text-neutral-500 mb-1">
                        {search || filter !== "ALL" ? "No units match your filters." : "No units yet — add your first truck or trailer."}
                      </p>
                    </td>
                  </tr>
                )}
                {units &&
                  filtered.map((u) => (
                    <tr key={u.id} className="border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${u.type === "TRUCK" ? "bg-neutral-900" : "bg-neutral-200"}`}>
                            {u.type === "TRUCK" ? (
                              <Truck className="h-4 w-4 text-amber-400" />
                            ) : (
                              <Container className="h-4 w-4 text-neutral-700" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-neutral-900">{u.unitNumber}</div>
                            <div className="text-[10.5px] text-neutral-400">{u.type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {u.year || u.make || u.model ? (
                          <>
                            <span className="font-medium">{[u.year, u.make].filter(Boolean).join(" ")}</span>
                            {u.model ? ` ${u.model}` : ""}
                            {u.vin && (
                              <div className="text-[10.5px] text-neutral-400 font-mono">VIN {u.vin}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {u.operator ? u.operator.name : <span className="text-neutral-400">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-neutral-700 tnum">
                        {u.plateNumber ? (
                          <>
                            {u.plateNumber}
                            {u.plateState && <span className="text-neutral-400"> · {u.plateState}</span>}
                          </>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ExpiryCell date={u.insuranceExpiry} extra={u.insuranceProvider} />
                      </td>
                      <td className="px-4 py-3">
                        <ExpiryCell date={u.registrationExpiry} />
                      </td>
                      <td className="px-4 py-3">
                        <ExpiryCell date={u.inspectionDue} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`border-0 text-[10px] px-1.5 ${
                            u.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                              : u.status === "MAINTENANCE"
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                                : "bg-neutral-200 text-neutral-600 hover:bg-neutral-200"
                          }`}
                        >
                          {u.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} title="Edit">
                            <Pencil className="h-3.5 w-3.5 text-neutral-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(u)} title="Delete">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.unitNumber}` : "Add Fleet Unit"}</DialogTitle>
            <DialogDescription>
              Track insurance, registration and inspection dates — the dashboard alerts you 45 days ahead.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit Number *">
                <Input value={form.unitNumber} onChange={(e) => setForm({ ...form, unitNumber: e.target.value })} placeholder="TR-105" />
              </Field>
              <Field label="Type">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="TRUCK">Truck</option>
                  <option value="TRAILER">Trailer</option>
                </select>
              </Field>
            </div>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="MAINTENANCE">In Maintenance</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Year">
                <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2020" />
              </Field>
              <Field label="Make">
                <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Freightliner" />
              </Field>
              <Field label="Model">
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Cascadia" />
              </Field>
            </div>
            <Field label="VIN">
              <Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} placeholder="1FUJGLDR0KLLA1234" className="font-mono" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plate #">
                <Input value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} placeholder="AB4921" />
              </Field>
              <Field label="Plate State">
                <Input value={form.plateState} onChange={(e) => setForm({ ...form, plateState: e.target.value })} maxLength={2} placeholder="NC" />
              </Field>
            </div>
            <Field label="Assigned Owner-Operator">
              <select
                value={form.operatorId}
                onChange={(e) => setForm({ ...form, operatorId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Unassigned —</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Insurance Provider">
              <Input value={form.insuranceProvider} onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })} placeholder="Progressive" />
            </Field>
            <Field label="Insurance Expiry">
              <Input type="date" value={form.insuranceExpiry} onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })} />
            </Field>
            <Field label="Registration Expiry">
              <Input type="date" value={form.registrationExpiry} onChange={(e) => setForm({ ...form, registrationExpiry: e.target.value })} />
            </Field>
            <Field label="Inspection Due">
              <Input type="date" value={form.inspectionDue} onChange={(e) => setForm({ ...form, inspectionDue: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="APEX fleet GPS unit, spare tire in cabinet…" />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-neutral-900 hover:bg-neutral-800 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editing ? "Save Changes" : "Add Unit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove unit {deleteTarget?.unitNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the truck/trailer record. Expenses linked to it are kept but become
              unassigned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExpiryCell({ date, extra }: { date: string | null; extra?: string | null }) {
  if (!date) return <span className="text-neutral-400">—</span>;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const tone =
    days < 0
      ? "text-red-600 font-semibold"
      : days <= 30
        ? "text-red-500 font-semibold"
        : days <= 45
          ? "text-amber-600 font-medium"
          : "text-neutral-600";
  return (
    <div>
      <div className={`tnum ${tone}`}>{formatDate(date)}</div>
      {extra && <div className="text-[10.5px] text-neutral-400">{extra}</div>}
    </div>
  );
}

function toInputDate(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
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
