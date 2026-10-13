"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type DocumentItem, type Operator, type Truck } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  FolderOpen,
  Pencil,
  Trash2,
  FileWarning,
  Paperclip,
  Download,
  CalendarClock,
} from "lucide-react";

export const DOC_TYPES: { value: string; label: string }[] = [
  { value: "CDL", label: "CDL / Driver License" },
  { value: "MEDICAL_CARD", label: "Medical Card" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "REGISTRATION", label: "Registration / Title" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "W9", label: "W-9" },
  { value: "AGREEMENT", label: "Signed Agreement / Contract" },
  { value: "DRUG_TEST", label: "Drug Test" },
  { value: "OTHER", label: "Other" },
];

export function docTypeLabel(v: string): string {
  return DOC_TYPES.find((t) => t.value === v)?.label || v;
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function ExpiryBadge({ date }: { date?: string | null }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-neutral-400 text-xs">No expiry</span>;
  if (days < 0)
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        Expired {-days}d ago
      </Badge>
    );
  if (days <= 15)
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        {days}d left — urgent
      </Badge>
    );
  if (days <= 45)
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        {days}d left
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
      {formatDate(date)}
    </Badge>
  );
}

const EMPTY_FORM = {
  title: "",
  type: "INSURANCE",
  holderType: "COMPANY",
  operatorId: "",
  truckId: "",
  documentNumber: "",
  issuedDate: "",
  expiryDate: "",
  notes: "",
  fileName: "",
  mimeType: "",
  fileData: "",
};

export default function DocumentsView() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [holderFilter, setHolderFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [d, o, t] = await Promise.all([
        api.get<{ documents: DocumentItem[] }>("/api/documents"),
        api.get<{ operators: Operator[] }>("/api/operators"),
        api.get<{ trucks: Truck[] }>("/api/trucks"),
      ]);
      setDocuments(d.documents);
      setOperators(o.operators);
      setTrucks(t.trucks);
    } catch {
      toast({
        title: "Could not load documents",
        variant: "destructive",
      });
      setDocuments([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return (documents || []).filter((d) => {
      if (holderFilter !== "ALL" && d.holderType !== holderFilter) return false;
      if (typeFilter !== "ALL" && d.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${d.title} ${d.documentNumber || ""} ${d.operator?.name || ""} ${
          d.truck?.unitNumber || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [documents, holderFilter, typeFilter, search]);

  const expiringSoon = (documents || []).filter((d) => {
    const days = daysUntil(d.expiryDate);
    return days !== null && days <= 45;
  }).length;

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(d: DocumentItem) {
    setEditing(d);
    setForm({
      title: d.title,
      type: d.type,
      holderType: d.holderType,
      operatorId: d.operatorId || "",
      truckId: d.truckId || "",
      documentNumber: d.documentNumber || "",
      issuedDate: d.issuedDate ? d.issuedDate.slice(0, 10) : "",
      expiryDate: d.expiryDate ? d.expiryDate.slice(0, 10) : "",
      notes: d.notes || "",
      fileName: d.fileName || "",
      mimeType: d.mimeType || "",
      fileData: "",
    });
    setDialogOpen(true);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      toast({ title: "File too large — max 4 MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((p) => ({
        ...p,
        fileName: f.name,
        mimeType: f.type || "application/octet-stream",
        fileData: String(reader.result || ""),
      }));
    };
    reader.readAsDataURL(f);
  }

  async function save() {
    if (!form.title.trim()) {
      toast({ title: "Please enter a document title", variant: "destructive" });
      return;
    }
    if (form.holderType === "OPERATOR" && !form.operatorId) {
      toast({ title: "Select the owner-operator", variant: "destructive" });
      return;
    }
    if (form.holderType === "TRUCK" && !form.truckId) {
      toast({ title: "Select the truck/trailer", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        operatorId: form.holderType === "OPERATOR" ? form.operatorId : null,
        truckId: form.holderType === "TRUCK" ? form.truckId : null,
        issuedDate: form.issuedDate || null,
        expiryDate: form.expiryDate || null,
      };
      if (editing) {
        await api.patch(`/api/documents/${editing.id}`, body);
        toast({ title: "Document updated" });
      } else {
        await api.post("/api/documents", body);
        toast({ title: "Document added" });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api.del(`/api/documents/${deleting.id}`);
      toast({ title: "Document deleted" });
      load();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  function downloadFile(d: DocumentItem) {
    window.open(`/api/documents/${d.id}/file`, "_blank");
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">
            Insurance, licenses, registrations, agreements — with expiry tracking & file storage.
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-neutral-900 hover:bg-neutral-800 text-white"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Document
        </Button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{documents?.length ?? "…"}</div>
            <div className="text-xs text-neutral-500 mt-0.5">Total documents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${expiringSoon > 0 ? "text-red-600" : ""}`}>
              {documents ? expiringSoon : "…"}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">Expiring ≤ 45 days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {(documents || []).filter((d) => d.holderType === "OPERATOR").length}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">Operator documents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {(documents || []).filter((d) => d.hasFile).length}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">With files</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search title, number, holder…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={holderFilter} onValueChange={setHolderFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Holder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All holders</SelectItem>
            <SelectItem value="COMPANY">Company</SelectItem>
            <SelectItem value="OPERATOR">Owner operators</SelectItem>
            <SelectItem value="TRUCK">Trucks & trailers</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {documents === null ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FolderOpen className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">
                {documents.length === 0
                  ? "No documents yet — add insurance, licenses, agreements and track their expiry."
                  : "No documents match your filters."}
              </p>
              {documents.length === 0 && (
                <Button onClick={openAdd} className="mt-4" size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add your first document
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-[11px] uppercase tracking-wider text-neutral-400">
                    <th className="px-4 py-3 font-semibold">Document</th>
                    <th className="px-4 py-3 font-semibold">Holder</th>
                    <th className="px-4 py-3 font-semibold">Number</th>
                    <th className="px-4 py-3 font-semibold">Expiry</th>
                    <th className="px-4 py-3 font-semibold">File</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{d.title}</div>
                        <div className="text-xs text-neutral-400">{docTypeLabel(d.type)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-neutral-50 text-neutral-600 border-neutral-200">
                          {d.holderType === "OPERATOR"
                            ? d.operator?.name || "—"
                            : d.holderType === "TRUCK"
                              ? d.truck?.unitNumber || "—"
                              : "Company"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 tnum">
                        {d.documentNumber || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ExpiryBadge date={d.expiryDate} />
                      </td>
                      <td className="px-4 py-3">
                        {d.hasFile ? (
                          <button
                            onClick={() => downloadFile(d)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(d)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleting(d)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit document" : "Add document"}</DialogTitle>
            <DialogDescription>
              Track insurance, licenses and contracts with expiry reminders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Title *</Label>
                <Input
                  placeholder="e.g. Commercial Auto Insurance 2026"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Belongs to</Label>
                <Select
                  value={form.holderType}
                  onValueChange={(v) => setForm((p) => ({ ...p, holderType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPANY">Company</SelectItem>
                    <SelectItem value="OPERATOR">Owner operator</SelectItem>
                    <SelectItem value="TRUCK">Truck / trailer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.holderType === "OPERATOR" && (
                <div className="space-y-1.5 col-span-2">
                  <Label>Owner operator *</Label>
                  <Select
                    value={form.operatorId || undefined}
                    onValueChange={(v) => setForm((p) => ({ ...p, operatorId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.holderType === "TRUCK" && (
                <div className="space-y-1.5 col-span-2">
                  <Label>Unit *</Label>
                  <Select
                    value={form.truckId || undefined}
                    onValueChange={(v) => setForm((p) => ({ ...p, truckId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select truck/trailer" />
                    </SelectTrigger>
                    <SelectContent>
                      {trucks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.unitNumber} ({t.type === "TRAILER" ? "Trailer" : "Truck"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Document #</Label>
                <Input
                  placeholder="Policy / ID number"
                  value={form.documentNumber}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, documentNumber: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Issued date</Label>
                <Input
                  type="date"
                  value={form.issuedDate}
                  onChange={(e) => setForm((p) => ({ ...p, issuedDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
                  Expiry date (reminds 45 days before)
                </Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Attach file (PDF / image, max 4 MB)</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={onFile}
                  className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-neutral-900 file:text-white file:text-xs file:font-medium cursor-pointer"
                />
                {form.fileName && (
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                    <Paperclip className="h-3 w-3" />
                    {form.fileName}
                    {editing && (
                      <button
                        type="button"
                        className="text-red-500 hover:underline ml-2"
                        onClick={() => {
                          setForm((p) => ({
                            ...p,
                            fileName: "",
                            mimeType: "",
                            fileData: "",
                          }));
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                      >
                        remove
                      </button>
                    )}
                  </p>
                )}
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  placeholder="Optional details…"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving}
                className="bg-neutral-900 hover:bg-neutral-800 text-white"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Add document"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={Boolean(deleting)} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription className="flex items-start gap-2">
              <FileWarning className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <span>
                “{deleting?.title}” and its attached file will be permanently removed.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
