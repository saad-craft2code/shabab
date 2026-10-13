import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let settings = await db.companySettings.findFirst();
  if (!settings) {
    settings = await db.companySettings.create({ data: {} });
  }
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const b = await req.json();
    let settings = await db.companySettings.findFirst();
    if (!settings) {
      settings = await db.companySettings.create({ data: {} });
    }
    const updated = await db.companySettings.update({
      where: { id: settings.id },
      data: {
        name: b.name !== undefined ? String(b.name) : undefined,
        legalName: b.legalName !== undefined ? String(b.legalName) : undefined,
        addressLine: b.addressLine !== undefined ? String(b.addressLine) : undefined,
        city: b.city !== undefined ? String(b.city) : undefined,
        state: b.state !== undefined ? String(b.state) : undefined,
        zip: b.zip !== undefined ? String(b.zip) : undefined,
        phone: b.phone !== undefined ? String(b.phone) : undefined,
        email: b.email !== undefined ? String(b.email) : undefined,
        mcNumber: b.mcNumber !== undefined ? String(b.mcNumber) : undefined,
        dotNumber: b.dotNumber !== undefined ? String(b.dotNumber) : undefined,
        mcFeePercent: b.mcFeePercent !== undefined ? Number(b.mcFeePercent) : undefined,
        paymentTerms: b.paymentTerms !== undefined ? String(b.paymentTerms) : undefined,
      },
    });
    return NextResponse.json({ settings: updated });
  } catch {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
