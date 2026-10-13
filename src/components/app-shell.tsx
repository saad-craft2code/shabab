"use client";

import { useEffect, useRef, useState } from "react";
import {
  LogOut,
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  Plus,
  Boxes,
  Receipt,
  FolderOpen,
  Bell,
  X,
  Menu,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Navigate, View } from "@/lib/view";

const NAV: { key: View["name"]; label: string; icon: React.ReactNode; view: View }[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, view: { name: "dashboard" } },
  { key: "invoices", label: "Settlements", icon: <FileText className="h-4 w-4" />, view: { name: "invoices" } },
  { key: "operators", label: "Owner Operators", icon: <Users className="h-4 w-4" />, view: { name: "operators" } },
  { key: "fleet", label: "Fleet", icon: <Boxes className="h-4 w-4" />, view: { name: "fleet" } },
  { key: "documents", label: "Documents", icon: <FolderOpen className="h-4 w-4" />, view: { name: "documents" } },
  { key: "expenses", label: "Expenses", icon: <Receipt className="h-4 w-4" />, view: { name: "expenses" } },
  { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" />, view: { name: "settings" } },
];

type Alert = { kind: string; unit: string; detail: string; date: string; daysLeft: number };

export default function AppShell({
  current,
  navigate,
  onLogout,
  children,
}: {
  current: View;
  navigate: Navigate;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const isDetail =
    current.name === "invoice-detail" ||
    current.name === "invoice-new" ||
    current.name === "invoice-edit";

  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d?.alerts) setAlerts(d.alerts);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [current.name]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const alertCount = alerts?.length ?? 0;
  const urgent = alerts?.filter((a) => a.daysLeft <= 15).length ?? 0;

  const sidebarContent = (
    <>
      {/* Brand */}
      <button
        onClick={() => {
          navigate({ name: "dashboard" });
          setDrawerOpen(false);
        }}
        className="flex items-center gap-3 px-5 pt-6 pb-5 w-full text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shabab-logo.png" alt="Shabab Express LLC" className="h-11 w-auto" />
        <div className="leading-tight">
          <div className="font-bold tracking-tight text-neutral-900 text-[14px]">
            SHABAB EXPRESS
          </div>
          <div className="text-[10px] text-neutral-400">Greensboro, NC</div>
        </div>
      </button>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = current.name === item.key || (isDetail && item.key === "invoices");
          return (
            <button
              key={item.key}
              onClick={() => {
                navigate(item.view);
                setDrawerOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] transition-colors ${
                active
                  ? "bg-neutral-900 text-white font-medium shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {item.icon}
              {item.label}
              {item.key === "documents" && alertCount > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-5 pt-3 space-y-1 border-t border-neutral-100">
        <Button
          onClick={() => {
            navigate({ name: "invoice-new" });
            setDrawerOpen(false);
          }}
          className="w-full bg-amber-500 hover:bg-amber-600 text-neutral-950 font-semibold"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Settlement
        </Button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ===== Desktop sidebar ===== */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-white border-r border-neutral-200 z-40">
        {sidebarContent}
      </aside>

      {/* ===== Mobile drawer ===== */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex flex-col bg-white w-72 max-w-[82%] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-3 p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ===== Main column ===== */}
      <div className="md:pl-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-neutral-200">
          <div className="px-4 sm:px-7 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setDrawerOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-lg text-neutral-600 hover:bg-neutral-100"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="font-semibold text-neutral-900 text-[15px] truncate">
                {NAV.find((n) => n.key === current.name)?.label ||
                  (isDetail ? "Settlements" : "Portal")}
              </h1>
            </div>

            <div className="flex items-center gap-2" ref={bellRef}>
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setBellOpen((v) => !v)}
                  className="relative p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                  title="Expiry alerts"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {alertCount > 0 && (
                    <span
                      className={`absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9.5px] font-bold flex items-center justify-center ${
                        urgent > 0
                          ? "bg-red-500 text-white"
                          : "bg-amber-400 text-neutral-900"
                      }`}
                    >
                      {alertCount}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-neutral-800">
                        Expiry Alerts
                      </span>
                      <button
                        onClick={() => {
                          navigate({ name: "documents" });
                          setBellOpen(false);
                        }}
                        className="text-[11px] font-semibold text-amber-700 hover:text-amber-800"
                      >
                        View documents
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {!alerts && (
                        <div className="px-4 py-6 text-center text-xs text-neutral-400">
                          Loading…
                        </div>
                      )}
                      {alerts && alerts.length === 0 && (
                        <div className="px-4 py-6 text-center text-xs text-neutral-400">
                          All clear — nothing expires in the next 45 days.
                        </div>
                      )}
                      {alerts &&
                        alerts.map((a, i) => (
                          <div
                            key={i}
                            className="px-4 py-2.5 flex items-start gap-2.5 hover:bg-neutral-50 border-b border-neutral-50 last:border-0"
                          >
                            <TriangleAlert
                              className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                                a.daysLeft <= 15
                                  ? "text-red-500"
                                  : a.daysLeft <= 30
                                    ? "text-amber-500"
                                    : "text-neutral-300"
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="text-[12px] font-medium text-neutral-800 truncate">
                                {a.detail}
                              </div>
                              <div className="text-[10.5px] text-neutral-400">
                                {a.unit} ·{" "}
                                {a.daysLeft < 0
                                  ? `expired ${-a.daysLeft} day${-a.daysLeft === 1 ? "" : "s"} ago`
                                  : `${a.daysLeft} day${a.daysLeft === 1 ? "" : "s"} left`}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={() => navigate({ name: "invoice-new" })}
                className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-semibold h-9 hidden sm:inline-flex"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Settlement
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 py-6 sm:py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-neutral-200 bg-white py-4">
          <div className="max-w-6xl mx-auto px-4 sm:px-7 flex flex-wrap justify-between gap-2 text-xs text-neutral-400">
            <span>© {new Date().getFullYear()} Shabab Express LLC · Greensboro, North Carolina</span>
            <span>MC 1820180 · DOT 4574766</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
