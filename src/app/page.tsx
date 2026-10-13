"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import LoginView from "@/components/login-view";
import DashboardView from "@/components/dashboard-view";
import OperatorsView from "@/components/operators-view";
import InvoicesView from "@/components/invoices-view";
import InvoiceFormView from "@/components/invoice-form-view";
import InvoiceDetailView from "@/components/invoice-detail-view";
import FleetView from "@/components/fleet-view";
import ExpensesView from "@/components/expenses-view";
import SettingsView from "@/components/settings-view";
import { Loader2 } from "lucide-react";
import type { View } from "@/lib/view";

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [view, setView] = useState<View>({ name: "dashboard" });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuthed(false);
    setView({ name: "dashboard" });
  }, []);

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!authed) {
    return <LoginView onSuccess={() => setAuthed(true)} />;
  }

  return (
    <AppShell current={view} navigate={setView} onLogout={logout}>
      {view.name === "dashboard" && <DashboardView navigate={setView} />}
      {view.name === "operators" && <OperatorsView navigate={setView} />}
      {view.name === "invoices" && <InvoicesView navigate={setView} />}
      {view.name === "fleet" && <FleetView key="fleet" />}
      {view.name === "expenses" && <ExpensesView key="expenses" />}
      {view.name === "invoice-new" && (
        <InvoiceFormView
          navigate={setView}
          operatorId={view.operatorId}
          key="new"
        />
      )}
      {view.name === "invoice-edit" && (
        <InvoiceFormView navigate={setView} invoiceId={view.id} key={`edit-${view.id}`} />
      )}
      {view.name === "invoice-detail" && (
        <InvoiceDetailView navigate={setView} id={view.id} key={view.id} />
      )}
      {view.name === "settings" && <SettingsView />}
    </AppShell>
  );
}
