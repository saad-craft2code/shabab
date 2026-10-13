"use client";

import { useEffect, useState } from "react";
import { api, type Stats } from "@/lib/api";
import { formatUSD, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Users,
  FileText,
  Wallet,
  CircleDollarSign,
  ArrowRight,
  Boxes,
  Receipt,
  TriangleAlert,
  ShieldCheck,
  Stamp,
  ClipboardCheck,
  IdCard,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Navigate } from "@/lib/view";

export default function DashboardView({ navigate }: { navigate: Navigate }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/stats")
      .then((d) => setStats(d as Stats))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-6 text-sm text-red-700">{error}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Dashboard
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Owner-operator settlements at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate({ name: "invoice-new" })}
            className="bg-neutral-900 hover:bg-neutral-800 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Settlement
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ name: "operators" })}
            className="border-neutral-300"
          >
            <Users className="h-4 w-4 mr-1.5" /> Add Operator
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Outstanding Balance"
          value={stats ? formatUSD(stats.outstanding) : null}
          sub={stats ? `${stats.pendingCount} pending settlement(s)` : ""}
          accent="text-amber-600 bg-amber-100"
        />
        <StatCard
          icon={<CircleDollarSign className="h-4 w-4" />}
          label="Net Paid Out"
          value={stats ? formatUSD(stats.netYTD) : null}
          sub={stats ? `${stats.paidCount} paid settlement(s)` : ""}
          accent="text-emerald-700 bg-emerald-100"
        />
        <StatCard
          icon={<Boxes className="h-4 w-4" />}
          label="Fleet Active Units"
          value={stats ? `${stats.fleet.activeUnits}/${stats.fleet.totalUnits}` : null}
          sub={stats ? `${stats.fleet.trucks} trucks · ${stats.fleet.trailers} trailers` : ""}
          accent="text-neutral-700 bg-neutral-200"
        />
        <StatCard
          icon={<Receipt className="h-4 w-4" />}
          label="Fleet Expenses (month)"
          value={stats ? formatUSD(stats.expensesMonth) : null}
          sub={stats ? `${formatUSD(stats.expensesYTD)} YTD` : ""}
          accent="text-neutral-700 bg-neutral-200"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold text-neutral-800">
              Net Payouts — Last 6 Months
            </CardTitle>
            {stats && (
              <span className="text-[11px] text-neutral-400 tnum">
                gross {formatUSD(stats.grossYTD)} · MC fees {formatUSD(stats.mcFeesYTD)}
              </span>
            )}
          </CardHeader>
          <CardContent className="h-64">
            {stats ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#737373" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                    width={52}
                  />
                  <Tooltip
                    formatter={(v) => [formatUSD(Number(v)), "Net Paid"]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e5e5e5",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="net" fill="#18181b" radius={[6, 6, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </CardContent>
        </Card>

        {/* Recent settlements */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold text-neutral-800">
              Recent Settlements
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-500 h-8"
              onClick={() => navigate({ name: "invoices" })}
            >
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {!stats &&
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full mb-2" />
              ))}
            {stats &&
              stats.recentInvoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => navigate({ name: "invoice-detail", id: inv.id })}
                  className="w-full flex items-center justify-between gap-3 px-2 py-2.5 rounded-lg hover:bg-neutral-100 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                      {inv.number}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-semibold ${
                          inv.status === "PAID"
                            ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                            : "border-amber-200 text-amber-700 bg-amber-50"
                        }`}
                      >
                        {inv.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {inv.operatorName} · {formatDate(inv.issueDate)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tnum text-neutral-900">
                      {formatUSD(inv.net)}
                    </div>
                    <div className="text-[11px] text-neutral-400 tnum">
                      gross {formatUSD(inv.gross)}
                    </div>
                  </div>
                </button>
              ))}
            {stats && stats.recentInvoices.length === 0 && (
              <div className="py-10 text-center text-sm text-neutral-400">
                <FileText className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
                No settlements yet. Create your first one!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fleet alerts */}
      <Card className="border-neutral-200">
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold text-neutral-800 flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-500" />
            Fleet &amp; Compliance Alerts
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-neutral-500 h-8"
            onClick={() => navigate({ name: "fleet" })}
          >
            Open Fleet <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {!stats && <Skeleton className="h-16 w-full" />}
          {stats && stats.alerts.length === 0 && (
            <div className="py-4 text-sm text-neutral-400 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              All clear — insurance, registration, inspections &amp; CDLs current for 45+ days.
            </div>
          )}
          {stats && stats.alerts.length > 0 && (
            <div className="space-y-1">
              {stats.alerts.slice(0, 6).map((a, i) => {
                const overdue = a.daysLeft < 0;
                return (
                  <button
                    key={i}
                    onClick={() => navigate({ name: "fleet" })}
                    className="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-neutral-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                          overdue ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                        }`}
                      >
                        {a.kind === "INSURANCE" ? (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        ) : a.kind === "REGISTRATION" ? (
                          <Stamp className="h-3.5 w-3.5" />
                        ) : a.kind === "CDL" ? (
                          <IdCard className="h-3.5 w-3.5" />
                        ) : (
                          <ClipboardCheck className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-neutral-900 truncate">
                          {a.unit} · {a.detail}
                        </div>
                        <div className="text-[11px] text-neutral-400">{formatDate(a.date)}</div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] px-1.5 py-0 font-semibold ${
                        overdue
                          ? "border-red-200 text-red-600 bg-red-50"
                          : a.daysLeft <= 15
                            ? "border-amber-200 text-amber-700 bg-amber-50"
                            : "border-neutral-200 text-neutral-500 bg-neutral-50"
                      }`}
                    >
                      {overdue ? "OVERDUE" : `${a.daysLeft}d left`}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
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
  sub: string;
  accent: string;
}) {
  return (
    <Card className="border-neutral-200">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent}`}>
            {icon}
          </div>
          <span className="text-xs font-medium text-neutral-500 tracking-wide">
            {label}
          </span>
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 tnum">
          {value === null ? <Skeleton className="h-8 w-28" /> : value}
        </div>
        <div className="text-xs text-neutral-400 mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}
