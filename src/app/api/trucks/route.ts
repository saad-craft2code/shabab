import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const trucks = await db.truck.findMany({
    orderBy: [{ type: "asc" }, { unitNumber: "asc" }],
    include: {
      operator: { select: { id: true, name: true } },
      expenses: { select: { id: true, amount: true } },
    },
  });
  return NextResponse.json({ trucks });
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const b = await req.json();
    if (!String(b.unitNumber || "").trim()) {
      return NextResponse.json(
        { error: "Unit number is required." },
        { status: 400 }
      );
    }
    const truck = await db.truck.create({
      data: {
        unitNumber: String(b.unitNumber).trim(),
        type: b.type === "TRAILER" ? "TRAILER" : "TRUCK",
        make: b.make ? String(b.make) : null,
        model: b.model ? String(b.model) : null,
        year: b.year ? Number(b.year) : null,
        vin: b.vin ? String(b.vin) : null,
        plateNumber: b.plateNumber ? String(b.plateNumber) : null,
        plateState: b.plateState ? String(b.plateState) : null,
        insuranceProvider: b.insuranceProvider ? String(b.insuranceProvider) : null,
        insuranceExpiry: parseDate(b.insuranceExpiry),
        registrationExpiry: parseDate(b.registrationExpiry),
        inspectionDue: parseDate(b.inspectionDue),
        status: ["ACTIVE", "MAINTENANCE", "INACTIVE"].includes(b.status)
          ? b.status
          : "ACTIVE",
        notes: b.notes ? String(b.notes) : null,
        operatorId: b.operatorId ? String(b.operatorId) : null,
      },
      include: { operator: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ truck });
  } catch {
    return NextResponse.json({ error: "Create failed." }, { status: 500 });
  }
}
