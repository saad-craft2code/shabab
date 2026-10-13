import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const ALERT_DAYS = 45;

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const invoices = await db.invoice.findMany({
    include: { loads: true, deductions: true, operator: true },
  });

  let grossYTD = 0;
  let netYTD = 0;
  let outstanding = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let mcFeesYTD = 0;
  let loadsCount = 0;
  const monthly: Record<string, number> = {};

  for (const inv of invoices) {
    const gross = inv.loads.reduce((s, l) => s + l.gross, 0);
    const mcFee = gross * (inv.mcFeePercent / 100);
    const ded = inv.deductions.reduce((s, d) => s + d.amount, 0);
    const net = gross - mcFee - ded;
    loadsCount += inv.loads.length;
    if (inv.status === "PAID") {
      paidCount += 1;
      netYTD += net;
      grossYTD += gross;
      mcFeesYTD += mcFee;
    } else {
      pendingCount += 1;
      outstanding += net;
    }
    const key = new Date(inv.issueDate).toISOString().slice(0, 7);
    monthly[key] = (monthly[key] || 0) + net;
  }

  const operators = await db.ownerOperator.findMany({
    include: { invoices: { include: { loads: true, deductions: true } } },
  });
  const activeOperators = operators.filter((o) => o.status === "ACTIVE").length;

  // last 6 months series
  const months: { key: string; label: string; net: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    months.push({
      key,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
      net: Math.round((monthly[key] || 0) * 100) / 100,
    });
  }

  /* ---------- fleet ---------- */
  const trucks = await db.truck.findMany({
    include: { operator: { select: { id: true, name: true } } },
  });
  const truckCount = trucks.filter((u) => u.type === "TRUCK").length;
  const trailerCount = trucks.filter((u) => u.type === "TRAILER").length;
  const activeUnits = trucks.filter((u) => u.status === "ACTIVE").length;

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + ALERT_DAYS);
  const alerts: {
    kind: string;
    unit: string;
    detail: string;
    date: string;
    daysLeft: number;
  }[] = [];

  const pushAlert = (
    kind: string,
    unit: string,
    detail: string,
    date: Date | null
  ) => {
    if (!date) return;
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / 86400000);
    if (daysLeft <= ALERT_DAYS) {
      alerts.push({ kind, unit, detail, date: date.toISOString(), daysLeft });
    }
  };

  for (const u of trucks) {
    pushAlert("INSURANCE", u.unitNumber, "Insurance expiry", u.insuranceExpiry);
    pushAlert("REGISTRATION", u.unitNumber, "Registration expiry", u.registrationExpiry);
    pushAlert("INSPECTION", u.unitNumber, "Inspection due", u.inspectionDue);
  }
  for (const o of operators) {
    pushAlert("CDL", o.name, "CDL expiry", o.cdlExpiry);
  }
  alerts.sort((a, b) => a.daysLeft - b.daysLeft);

  /* ---------- expenses ---------- */
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const expenses = await db.expense.findMany({
    where: { date: { gte: yearStart } },
    include: { truck: { select: { unitNumber: true } } },
  });
  const monthKey = now.toISOString().slice(0, 7);
  let expensesMonth = 0;
  let expensesYTD = 0;
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    expensesYTD += e.amount;
    if (new Date(e.date).toISOString().slice(0, 7) === monthKey) {
      expensesMonth += e.amount;
    }
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }
  const topCategories = Object.entries(byCategory)
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);

  return NextResponse.json({
    grossYTD: Math.round(grossYTD * 100) / 100,
    netYTD: Math.round(netYTD * 100) / 100,
    outstanding: Math.round(outstanding * 100) / 100,
    mcFeesYTD: Math.round(mcFeesYTD * 100) / 100,
    paidCount,
    pendingCount,
    totalInvoices: invoices.length,
    totalLoads: loadsCount,
    activeOperators,
    totalOperators: operators.length,
    months,
    recentInvoices: invoices
      .sort(
        (a, b) =>
          new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
      )
      .slice(0, 5)
      .map((inv) => {
        const gross = inv.loads.reduce((s, l) => s + l.gross, 0);
        const mcFee = gross * (inv.mcFeePercent / 100);
        const ded = inv.deductions.reduce((s, d) => s + d.amount, 0);
        return {
          id: inv.id,
          number: inv.number,
          operatorName: inv.operator.name,
          issueDate: inv.issueDate,
          status: inv.status,
          gross: Math.round(gross * 100) / 100,
          net: Math.round((gross - mcFee - ded) * 100) / 100,
        };
      }),
    fleet: {
      trucks: truckCount,
      trailers: trailerCount,
      activeUnits,
      totalUnits: trucks.length,
    },
    alerts,
    expensesMonth: Math.round(expensesMonth * 100) / 100,
    expensesYTD: Math.round(expensesYTD * 100) / 100,
    topCategories,
  });
}
