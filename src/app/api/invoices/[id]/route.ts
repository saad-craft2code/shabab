import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { operator: true, loads: { orderBy: { sortOrder: "asc" } }, deductions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ invoice });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const b = await req.json();
    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Status-only update (mark as paid / reopen)
    const statusOnly =
      b.status !== undefined &&
      b.operatorId === undefined &&
      b.loads === undefined &&
      b.deductions === undefined;

    if (statusOnly) {
      const status = b.status === "PAID" ? "PAID" : "PENDING";
      const invoice = await db.invoice.update({
        where: { id },
        data: {
          status,
          paidDate: status === "PAID" ? (b.paidDate ? new Date(b.paidDate) : new Date()) : null,
          paymentMethod:
            status === "PAID" && b.paymentMethod ? String(b.paymentMethod) : null,
          paymentRef:
            status === "PAID" && b.paymentRef ? String(b.paymentRef) : null,
        },
        include: { operator: true, loads: true, deductions: true },
      });
      return NextResponse.json({ invoice });
    }

    // Full update
    const operatorId = b.operatorId ? String(b.operatorId) : existing.operatorId;
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
    await db.load.deleteMany({ where: { invoiceId: id } });
    await db.deduction.deleteMany({ where: { invoiceId: id } });

    const invoice = await db.invoice.update({
      where: { id },
      data: {
        issueDate: b.issueDate ? new Date(b.issueDate) : undefined,
        periodStart: b.periodStart ? new Date(b.periodStart) : null,
        periodEnd: b.periodEnd ? new Date(b.periodEnd) : null,
        operatorId,
        mcFeePercent:
          b.mcFeePercent !== undefined && b.mcFeePercent !== null && b.mcFeePercent !== ""
            ? Number(b.mcFeePercent)
            : operator.mcFeePercent,
        notes: b.notes !== undefined ? (b.notes ? String(b.notes) : null) : undefined,
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
      include: { operator: true, loads: { orderBy: { sortOrder: "asc" } }, deductions: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ invoice });
  } catch (e) {
    console.error("Invoice update error:", e);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await db.invoice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.invoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
