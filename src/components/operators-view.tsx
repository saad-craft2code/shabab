"use client";

import { useEffect, useState } from "react";
import { api, type Operator } from "@/lib/api";
import { formatUSD, formatDate, toInputDate } from "@/lib/format";
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
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  FileText,
  UserRoundCheck,
  UserRoundX,
  Loader2,
  IdCard,
  Paperclip,
  Download,
  FolderOpen,
} from "lucide-react";
import type { Navigate } from "@/lib/view";
import type { DocumentItem } from "@/lib/api";
import { DOC_TYPES, docTypeLabel } from "@/components/documents-view";

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  truckNumber: string;
  trailerNumber: string;
  cdlNumber: string;
  cdlState: string;
  cdlExpiry: string;
  mcFeePercent: string;
  status: string;
  notes: string;
}

const EMPTY: FormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "NC",
  zip: "",
  truckNumber: "",
  trailerNumber: "",
  cdlNumber: "",
  cdlState: "NC",
  cdlExpiry: "",
  mcFeePercent: "10",
  status: "ACTIVE",
  notes: "",
};

interface DocRow {
  type: string;
  documentNumber: string;
  expiryDate: string;
  fileName: string;
  mimeType: string;
  fileData: string;
}

const EMPTY_DOC_ROW: DocRow = {
  type: "CDL",
  documentNumber: "",
  expiryDate: "",
  fileName: "",
  mimeType: "",
  fileData: "",
};

export default function OperatorsView({ navigate }: { navigate: Navigate }) {
  const [operators, setOperators] = useState<Operator[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Operator | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Operator | null>(null);
  const [docRows, setDocRows] = useState<DocRow[]>([]);
  const [existingDocs, setExistingDocs] = useState<DocumentItem[] | null>(null);
  const { toast } = useToast();

  function load() {
    api
      .get("/api/operators")
      .then((d) => setOperators(d.operators))
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  }

  useEffect(load, []);  

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setDocRows([]);
    setExistingDocs(null);
    setDialogOpen(true);
  }

  function openEdit(op: Operator) {
    setEditing(op);
    setForm({
      name: op.name || "",
      phone: op.phone || "",
      email: op.email || "",
      address: op.address || "",
      city: op.city || "",
      state: op.state || "",
      zip: op.zip || "",
      truckNumber: op.truckNumber || "",
      trailerNumber: op.trailerNumber || "",
      cdlNumber: op.cdlNumber || "",
      cdlState: op.cdlState || "NC",
      cdlExpiry: toInputDate(op.cdlExpiry),
      mcFeePercent: String(op.mcFeePercent ?? 10),
      status: op.status,
      notes: op.notes || "",
    });
    setDocRows([]);
    setExistingDocs(null);
    api
      .get<{ documents: DocumentItem[] }>(`/api/documents?operatorId=${op.id}`)
      .then((d) => setExistingDocs(d.documents))
      .catch(() => setExistingDocs([]));
    setDialogOpen(true);
  }

  function updateDocRow(i: number, patch: Partial<DocRow>) {
    setDocRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function docFile(e: React.ChangeEvent<HTMLInputElement>, i: number) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      toast({ title: "File too large — max 4 MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      updateDocRow(i, {
        fileName: f.name,
        mimeType: f.type || "application/octet-stream",
        fileData: String(reader.result || ""),
      });
    reader.readAsDataURL(f);
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Please enter the operator's full name.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, mcFeePercent: Number(form.mcFeePercent) || 10 };
      let operatorId = editing?.id;
      if (editing) {
        await api.patch(`/api/operators/${editing.id}`, payload);
        toast({ title: "Operator updated", description: `${form.name} has been saved.` });
      } else {
        const res = await api.post<{ operator: Operator }>("/api/operators", payload);
        operatorId = res.operator.id;
        toast({ title: "Operator added", description: `${form.name} is now on your roster.` });
      }
      // create any attached document rows
      let created = 0;
      for (const row of docRows) {
        if (!operatorId) break;
        await api.post("/api/documents", {
          title: `${docTypeLabel(row.type)} — ${form.name.trim()}`,
          type: row.type,
          holderType: "OPERATOR",
          operatorId,
          documentNumber: row.documentNumber || null,
          expiryDate: row.expiryDate || null,
          fileName: row.fileName || null,
          mimeType: row.mimeType || null,
          fileData: row.fileData || null,
        });
        created += 1;
      }
      if (created > 0) {
        toast({ title: `${created} document${created === 1 ? "" : "s"} attached to ${form.name}` });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(op: Operator) {
    try {
      await api.patch(`/api/operators/${op.id}`, {
        status: op.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      toast({
        title: op.status === "ACTIVE" ? "Operator deactivated" : "Operator activated",
        description: op.name,
      });
      load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    try {
      await api.del(`/api/operators/${deleteTarget.id}`);
      toast({ title: "Operator removed", description: deleteTarget.name });
      load();
    } catch (e) {
      toast({ title: "Cannot delete", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }

  function statsFor(op: Operator) {
    const invoices = op.invoices || [];
    const paid = invoices.filter((i) => i.status === "PAID").length;
    const pending = invoices.filter((i) => i.status === "PENDING").length;
    return { total: invoices.length, paid, pending };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Owner Operators
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Drivers working under the Shabab Express MC authority.
          </p>
        </div>
        <Button onClick={openAdd} className="bg-neutral-900 hover:bg-neutral-800 text-white">
          <Plus className="h-4 w-4 mr-1.5" /> Add Operator
        </Button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {!operators &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}

        {operators && operators.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-16 text-center">
              <Truck className="h-10 w-10 mx-auto text-neutral-300 mb-3" />
              <p className="text-neutral-500 mb-4">
                No owner-operators yet. Add your first driver to start creating settlements.
              </p>
              <Button onClick={openAdd} className="bg-neutral-900 hover:bg-neutral-800 text-white">
                <Plus className="h-4 w-4 mr-1.5" /> Add Operator
              </Button>
            </CardContent>
          </Card>
        )}

        {operators &&
          operators.map((op) => {
            const s = statsFor(op);
            return (
              <Card key={op.id} className="flex flex-col">
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900 truncate flex items-center gap-2">
                        {op.name}
                        {op.status === "ACTIVE" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 hover:bg-emerald-100 text-[10px] px-1.5">
                            <UserRoundCheck className="h-3 w-3 mr-0.5" /> ACTIVE
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5">
                            <UserRoundX className="h-3 w-3 mr-0.5" /> INACTIVE
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        MC Fee {op.mcFeePercent}%
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(op)} title="Edit">
                        <Pencil className="h-3.5 w-3.5 text-neutral-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteTarget(op)}
                        title="Delete"
                        disabled={s.total > 0}
                      >
                        <Trash2 className={`h-3.5 w-3.5 ${s.total > 0 ? "text-neutral-300" : "text-red-400"}`} />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-neutral-600">
                    {op.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-neutral-400" /> {op.phone}
                      </div>
                    )}
                    {op.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{op.email}</span>
                      </div>
                    )}
                    {(op.city || op.state) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                        {op.city}
                        {op.city && op.state ? ", " : ""}
                        {op.state}
                      </div>
                    )}
                    {op.truckNumber && (
                      <div className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5 text-neutral-400" /> Truck {op.truckNumber}
                        {op.trailerNumber ? ` · Trailer ${op.trailerNumber}` : ""}
                      </div>
                    )}
                    {op.cdlNumber && (
                      <div className="flex items-center gap-2">
                        <IdCard className="h-3.5 w-3.5 text-neutral-400" />
                        CDL {op.cdlNumber}
                        {op.cdlState ? ` · ${op.cdlState}` : ""}
                        {op.cdlExpiry && (
                          <span
                            className={`text-[10px] font-medium ${cdlExpiryClass(op.cdlExpiry)}`}
                          >
                            exp {formatDate(op.cdlExpiry)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center border-t border-neutral-100 pt-3">
                    <div>
                      <div className="text-lg font-bold tnum text-neutral-900">{s.total}</div>
                      <div className="text-[10px] text-neutral-400 tracking-wide">SETTLEMENTS</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold tnum text-emerald-600">{s.paid}</div>
                      <div className="text-[10px] text-neutral-400 tracking-wide">PAID</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold tnum text-amber-600">{s.pending}</div>
                      <div className="text-[10px] text-neutral-400 tracking-wide">PENDING</div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-semibold"
                      onClick={() => navigate({ name: "invoice-new", operatorId: op.id })}
                      disabled={op.status !== "ACTIVE"}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" /> New Settlement
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(op)} className="border-neutral-300">
                      {op.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add Owner Operator"}</DialogTitle>
            <DialogDescription>
              Driver details used on settlements. MC fee defaults to 10%.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Muhammad Imran" />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(336) 555-0123" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="driver@email.com" />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label="State">
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </Field>
              <Field label="ZIP">
                <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Truck #">
                <Input value={form.truckNumber} onChange={(e) => setForm({ ...form, truckNumber: e.target.value })} />
              </Field>
              <Field label="Trailer #">
                <Input value={form.trailerNumber} onChange={(e) => setForm({ ...form, trailerNumber: e.target.value })} />
              </Field>
              <Field label="CDL #">
                <Input value={form.cdlNumber} onChange={(e) => setForm({ ...form, cdlNumber: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CDL State">
                <Input value={form.cdlState} onChange={(e) => setForm({ ...form, cdlState: e.target.value })} placeholder="NC" maxLength={2} />
              </Field>
              <Field label="CDL Expiry" hint="Dashboard alerts at 45 days">
                <Input type="date" value={form.cdlExpiry} onChange={(e) => setForm({ ...form, cdlExpiry: e.target.value })} />
              </Field>
            </div>
            <Field label="MC Fee %" hint="Deducted from gross on every settlement">
              <Input type="number" min="0" max="100" step="0.5" value={form.mcFeePercent} onChange={(e) => setForm({ ...form, mcFeePercent: e.target.value })} />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Endorsements, preferred lanes, onboarding notes…" />
              </Field>
            </div>

            {/* ===== Documents section ===== */}
            <div className="sm:col-span-2 border-t border-neutral-100 pt-4">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-neutral-600 flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 text-amber-600" />
                  Operator documents (CDL, medical card, W-9, agreement…)
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setDocRows((r) => [...r, { ...EMPTY_DOC_ROW }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add row
                </Button>
              </div>
              <p className="text-[10.5px] text-neutral-400 mb-3">
                Attached files are saved with the operator and expiry dates trigger alerts.
              </p>

              {/* existing docs when editing */}
              {editing && existingDocs !== null && existingDocs.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {existingDocs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-neutral-800">{d.title}</span>
                        {d.expiryDate && (
                          <span className="text-neutral-400 ml-2">exp {formatDate(d.expiryDate)}</span>
                        )}
                      </div>
                      {d.hasFile && (
                        <button
                          type="button"
                          onClick={() => window.open(`/api/documents/${d.id}/file`, "_blank")}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium shrink-0"
                        >
                          <Download className="h-3 w-3" /> file
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="text-[10px] text-neutral-400">
                    Manage these in the Documents section of the portal.
                  </p>
                </div>
              )}

              {docRows.map((row, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-neutral-200 p-3 mb-2.5 bg-neutral-50/40"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                      Document {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDocRows((r) => r.filter((_, idx) => idx !== i))}
                      className="text-neutral-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Type">
                      <select
                        value={row.type}
                        onChange={(e) => updateDocRow(i, { type: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {DOC_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Number">
                      <Input
                        value={row.documentNumber}
                        onChange={(e) => updateDocRow(i, { documentNumber: e.target.value })}
                        placeholder="ID / policy #"
                      />
                    </Field>
                    <Field label="Expiry date">
                      <Input
                        type="date"
                        value={row.expiryDate}
                        onChange={(e) => updateDocRow(i, { expiryDate: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="mt-2.5">
                    <Label className="text-xs text-neutral-600">File (optional, max 4 MB)</Label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => docFile(e, i)}
                      className="mt-1 text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-neutral-900 file:text-white file:text-xs file:font-medium cursor-pointer"
                    />
                    {row.fileName && (
                      <p className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1">
                        <Paperclip className="h-3 w-3" /> {row.fileName}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-neutral-900 hover:bg-neutral-800 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editing ? "Save Changes" : "Add Operator"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the operator from your roster. Operators with existing settlements
              cannot be deleted — deactivate them instead.
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

function cdlExpiryClass(d: string): string {
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (days < 0) return "text-red-600";
  if (days <= 45) return "text-amber-600";
  return "text-neutral-400";
}
