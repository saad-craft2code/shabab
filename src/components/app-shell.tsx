"use client";

import { Truck, LogOut, LayoutDashboard, Users, FileText, Settings, Plus, Boxes, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Navigate, View } from "@/lib/view";

const NAV: { key: View["name"]; label: string; icon: React.ReactNode; view: View }[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, view: { name: "dashboard" } },
  { key: "invoices", label: "Settlements", icon: <FileText className="h-4 w-4" />, view: { name: "invoices" } },
  { key: "operators", label: "Owner Operators", icon: <Users className="h-4 w-4" />, view: { name: "operators" } },
  { key: "fleet", label: "Fleet", icon: <Boxes className="h-4 w-4" />, view: { name: "fleet" } },
  { key: "expenses", label: "Expenses", icon: <Receipt className="h-4 w-4" />, view: { name: "expenses" } },
  { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" />, view: { name: "settings" } },
];

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

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate({ name: "dashboard" })}
            className="flex items-center gap-3 shrink-0"
          >
            <div className="h-9 w-9 rounded-xl bg-neutral-900 flex items-center justify-center">
              <Truck className="h-5 w-5 text-amber-400" />
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <div className="font-bold tracking-tight text-neutral-900 text-[15px]">
                SHABAB EXPRESS
              </div>
              <div className="text-[10px] text-neutral-500 tracking-wide">
                Greensboro, NC · Fleet & Settlement Portal
              </div>
            </div>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => {
              const active = current.name === item.key || (isDetail && item.key === "invoices");
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.view)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-neutral-900 text-white font-medium"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate({ name: "invoice-new" })}
              className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-semibold h-9"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Settlement
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              title="Sign out"
              className="text-neutral-500 hover:text-neutral-900"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex overflow-x-auto gap-1 px-3 pb-2.5 -mt-0.5">
          {NAV.map((item) => {
            const active = current.name === item.key || (isDetail && item.key === "invoices");
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.view)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors ${
                  active
                    ? "bg-neutral-900 text-white font-medium"
                    : "text-neutral-600 bg-neutral-100"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-200 bg-white py-4">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-wrap justify-between gap-2 text-xs text-neutral-400">
          <span>© {new Date().getFullYear()} Shabab Express LLC · Greensboro, North Carolina</span>
          <span>Owner Operator Settlement Portal</span>
        </div>
      </footer>
    </div>
  );
}
