import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const operators = await db.ownerOperator.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { invoices: { select: { id: true, status: true } } },
  });
  return NextResponse.json({ operators });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const b = await req.json();
    if (!String(b.name || "").trim()) {
      return NextResponse.json(
        { error: "Operator name is required." },
        { status: 400 }
      );
    }
    const operator = await db.ownerOperator.create({
      data: {
        name: String(b.name).trim(),
        phone: b.phone ? String(b.phone) : null,
        email: b.email ? String(b.email) : null,
        address: b.address ? String(b.address) : null,
        city: b.city ? String(b.city) : null,
        state: b.state ? String(b.state) : null,
        zip: b.zip ? String(b.zip) : null,
        truckNumber: b.truckNumber ? String(b.truckNumber) : null,
        trailerNumber: b.trailerNumber ? String(b.trailerNumber) : null,
        cdlNumber: b.cdlNumber ? String(b.cdlNumber) : null,
        cdlState: b.cdlState ? String(b.cdlState) : null,
        cdlExpiry: b.cdlExpiry ? new Date(String(b.cdlExpiry)) : null,
        mcFeePercent:
          b.mcFeePercent === undefined || b.mcFeePercent === null || b.mcFeePercent === ""
            ? 10
            : Number(b.mcFeePercent),
        status: b.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        notes: b.notes ? String(b.notes) : null,
      },
    });
    return NextResponse.json({ operator });
  } catch {
    return NextResponse.json({ error: "Create failed." }, { status: 500 });
  }
}
