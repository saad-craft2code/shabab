import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const b = await req.json();
    const existing = await db.truck.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const truck = await db.truck.update({
      where: { id },
      data: {
        unitNumber: b.unitNumber !== undefined ? String(b.unitNumber).trim() : undefined,
        type: b.type !== undefined ? (b.type === "TRAILER" ? "TRAILER" : "TRUCK") : undefined,
        make: b.make !== undefined ? (b.make ? String(b.make) : null) : undefined,
        model: b.model !== undefined ? (b.model ? String(b.model) : null) : undefined,
        year: b.year !== undefined ? (b.year ? Number(b.year) : null) : undefined,
        vin: b.vin !== undefined ? (b.vin ? String(b.vin) : null) : undefined,
        plateNumber:
          b.plateNumber !== undefined ? (b.plateNumber ? String(b.plateNumber) : null) : undefined,
        plateState:
          b.plateState !== undefined ? (b.plateState ? String(b.plateState) : null) : undefined,
        insuranceProvider:
          b.insuranceProvider !== undefined
            ? b.insuranceProvider
              ? String(b.insuranceProvider)
              : null
            : undefined,
        insuranceExpiry: parseDate(b.insuranceExpiry),
        registrationExpiry: parseDate(b.registrationExpiry),
        inspectionDue: parseDate(b.inspectionDue),
        status:
          b.status !== undefined
            ? ["ACTIVE", "MAINTENANCE", "INACTIVE"].includes(b.status)
              ? b.status
              : "ACTIVE"
            : undefined,
        notes: b.notes !== undefined ? (b.notes ? String(b.notes) : null) : undefined,
        operatorId:
          b.operatorId !== undefined ? (b.operatorId ? String(b.operatorId) : null) : undefined,
      },
      include: { operator: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ truck });
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
  const existing = await db.truck.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.truck.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
