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
  const operator = await db.ownerOperator.findUnique({
    where: { id },
    include: {
      invoices: {
        orderBy: { issueDate: "desc" },
        include: { loads: true, deductions: true },
      },
    },
  });
  if (!operator) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ operator });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const b = await req.json();
    const existing = await db.ownerOperator.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const operator = await db.ownerOperator.update({
      where: { id },
      data: {
        name: b.name !== undefined ? String(b.name).trim() : undefined,
        phone: b.phone !== undefined ? (b.phone ? String(b.phone) : null) : undefined,
        email: b.email !== undefined ? (b.email ? String(b.email) : null) : undefined,
        address: b.address !== undefined ? (b.address ? String(b.address) : null) : undefined,
        city: b.city !== undefined ? (b.city ? String(b.city) : null) : undefined,
        state: b.state !== undefined ? (b.state ? String(b.state) : null) : undefined,
        zip: b.zip !== undefined ? (b.zip ? String(b.zip) : null) : undefined,
        truckNumber:
          b.truckNumber !== undefined
            ? b.truckNumber
              ? String(b.truckNumber)
              : null
            : undefined,
        trailerNumber:
          b.trailerNumber !== undefined
            ? b.trailerNumber
              ? String(b.trailerNumber)
              : null
            : undefined,
        cdlNumber:
          b.cdlNumber !== undefined
            ? b.cdlNumber
              ? String(b.cdlNumber)
              : null
            : undefined,
        cdlState:
          b.cdlState !== undefined
            ? b.cdlState
              ? String(b.cdlState)
              : null
            : undefined,
        cdlExpiry:
          b.cdlExpiry !== undefined
            ? b.cdlExpiry
              ? new Date(String(b.cdlExpiry))
              : null
            : undefined,
        mcFeePercent:
          b.mcFeePercent !== undefined ? Number(b.mcFeePercent) : undefined,
        status: b.status !== undefined ? (b.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") : undefined,
        notes: b.notes !== undefined ? (b.notes ? String(b.notes) : null) : undefined,
      },
    });
    return NextResponse.json({ operator });
  } catch {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await db.ownerOperator.findUnique({
    where: { id },
    include: { _count: { select: { invoices: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing._count.invoices > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${existing._count.invoices} invoice(s) exist for this operator. Set them to INACTIVE instead.`,
      },
      { status: 400 }
    );
  }
  await db.ownerOperator.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
