"use client";

import { useEffect, useState } from "react";
import { api, type CompanySettings } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  IdCard,
  Phone,
  Mail,
  MapPin,
  Percent,
  Save,
  Loader2,
  KeyRound,
  FileCheck,
} from "lucide-react";

export default function SettingsView() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    api
      .get("/api/settings")
      .then((d) => setSettings(d.settings))
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  }, []);  

  function set<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await api.put("/api/settings", settings);
      setSettings(res.settings);
      toast({
        title: "Company profile saved",
        description: "New settlements and PDFs will use these details.",
      });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      toast({ title: "Missing fields", description: "Fill in both password fields.", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      await api.put("/api/auth/password", { currentPassword, newPassword });
      toast({ title: "Password changed", description: "Use your new password next time." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPwSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Company details appear on every settlement PDF. Keep them current.
        </p>
      </div>

      {/* Company profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-amber-600" /> Company Profile
          </CardTitle>
          <CardDescription>Printed in the header of every settlement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name" icon={<Building2 className="h-3.5 w-3.5" />}>
              <Input value={settings.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Legal Name">
              <Input value={settings.legalName} onChange={(e) => set("legalName", e.target.value)} />
            </Field>
            <Field label="Street Address" icon={<MapPin className="h-3.5 w-3.5" />}>
              <Input value={settings.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City">
                <Input value={settings.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="State">
                <Input value={settings.state} onChange={(e) => set("state", e.target.value)} />
              </Field>
              <Field label="ZIP">
                <Input value={settings.zip} onChange={(e) => set("zip", e.target.value)} />
              </Field>
            </div>
            <Field label="Phone" icon={<Phone className="h-3.5 w-3.5" />}>
              <Input value={settings.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
              <Input value={settings.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="MC Number" icon={<IdCard className="h-3.5 w-3.5" />}>
              <Input value={settings.mcNumber} onChange={(e) => set("mcNumber", e.target.value)} />
            </Field>
            <Field label="DOT Number">
              <Input value={settings.dotNumber} onChange={(e) => set("dotNumber", e.target.value)} />
            </Field>
            <Field label="Default MC Fee %" icon={<Percent className="h-3.5 w-3.5" />} hint="New operators start with this rate">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={settings.mcFeePercent}
                onChange={(e) => set("mcFeePercent", Number(e.target.value) || 0)}
              />
            </Field>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-neutral-600 flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5" /> Payment Terms (printed on settlements)
            </Label>
            <Textarea
              rows={2}
              value={settings.paymentTerms}
              onChange={(e) => set("paymentTerms", e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="bg-neutral-900 hover:bg-neutral-800 text-white">
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Company Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-amber-600" /> Account Password
          </CardTitle>
          <CardDescription>Change the login password for this portal.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Current Password">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field label="New Password" hint="At least 4 characters">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={changePassword} disabled={pwSaving} variant="outline" className="border-neutral-300">
              {pwSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-neutral-600 flex items-center gap-1.5">
        {icon}
        {label}
      </Label>
      {children}
      {hint && <p className="text-[10.5px] text-neutral-400">{hint}</p>}
    </div>
  );
}
