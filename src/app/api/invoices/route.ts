import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const operatorId = searchParams.get("operatorId") || "";
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const invoices = await db.invoice.findMany({
    orderBy: { issueDate: "desc" },
    include: {
      operator: true,
      loads: true,
      deductions: true,
    },
  });

  let filtered = invoices;
  if (status && status !== "ALL") {
    filtered = filtered.filter((inv) => inv.status === status);
  }
  if (operatorId && operatorId !== "ALL") {
    filtered = filtered.filter((inv) => inv.operatorId === operatorId);
  }
  if (q) {
    filtered = filtered.filter(
      (inv) =>
        inv.number.toLowerCase().includes(q) ||
        inv.operator.name.toLowerCase().includes(q) ||
        inv.loads.some((l) => l.loadNumber.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({ invoices: filtered });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const b = await req.json();
    const operatorId = String(b.operatorId || "");
    const operator = await db.ownerOperator.findUnique({
      where: { id: operatorId },
    });
    if (!operator) {
      return NextResponse.json(
        { error: "Please select a valid owner-operator." },
        { status: 400 }
      );
    }
    const loads = Array.isArray(b.loads) ? b.loads : [];
    if (loads.length === 0) {
      return NextResponse.json(
        { error: "Add at least one load to the settlement." },
        { status: 400 }
      );
    }

    // Generate sequential invoice number SE-YYYY-#### based on max existing
    const year = new Date().getFullYear();
    const all = await db.invoice.findMany({ select: { number: true } });
    let maxSeq = 0;
    for (const inv of all) {
      const m = inv.number.match(/^SE-(\d{4})-(\d+)$/);
      if (m) {
        const seq = parseInt(m[2], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }
    const number = `SE-${year}-${String(maxSeq + 1).padStart(4, "0")}`;

    const mcFeePercent =
      b.mcFeePercent !== undefined && b.mcFeePercent !== null && b.mcFeePercent !== ""
        ? Number(b.mcFeePercent)
        : operator.mcFeePercent;

    const invoice = await db.invoice.create({
      data: {
        number,
        issueDate: b.issueDate ? new Date(b.issueDate) : new Date(),
        periodStart: b.periodStart ? new Date(b.periodStart) : null,
        periodEnd: b.periodEnd ? new Date(b.periodEnd) : null,
        operatorId,
        mcFeePercent,
        status: "PENDING",
        notes: b.notes ? String(b.notes) : null,
        loads: {
          create: loads.map(
            (
              l: {
                loadNumber?: string;
                date?: string;
                pickup?: string;
                delivery?: string;
                miles?: number | string;
                rateType?: string;
                rate?: number | string;
              },
              i: number
            ) => {
              const miles = Number(l.miles) || 0;
              const rateType = l.rateType === "PER_MILE" ? "PER_MILE" : "FLAT";
              const rate = Number(l.rate) || 0;
              const gross =
                rateType === "PER_MILE"
                  ? Math.round(miles * rate * 100) / 100
                  : Math.round(rate * 100) / 100;
              return {
                loadNumber: String(l.loadNumber || "").trim() || `LOAD-${i + 1}`,
                date: l.date ? new Date(l.date) : new Date(),
                pickup: String(l.pickup || "").trim(),
                delivery: String(l.delivery || "").trim(),
                miles,
                rateType,
                rate,
                gross,
                sortOrder: i,
              };
            }
          ),
        },
        deductions: {
          create: (Array.isArray(b.deductions) ? b.deductions : [])
            .filter(
              (d: { label?: string; amount?: number | string }) =>
                String(d.label || "").trim() && Number(d.amount)
            )
            .map(
              (
                d: { label?: string; amount?: number | string },
                i: number
              ) => ({
                label: String(d.label).trim(),
                amount: Math.round(Number(d.amount) * 100) / 100,
                sortOrder: i,
              })
            ),
        },
      },
      include: { operator: true, loads: true, deductions: true },
    });
    return NextResponse.json({ invoice });
  } catch (e) {
    console.error("Invoice create error:", e);
    return NextResponse.json({ error: "Create failed." }, { status: 500 });
  }
}
