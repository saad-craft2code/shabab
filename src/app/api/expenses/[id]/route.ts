import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const b = await req.json();
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const expense = await db.expense.update({
      where: { id },
      data: {
        date: b.date !== undefined ? new Date(String(b.date)) : undefined,
        category: b.category !== undefined ? String(b.category) : undefined,
        description:
          b.description !== undefined ? String(b.description).trim() : undefined,
        amount:
          b.amount !== undefined ? Math.round(Number(b.amount) * 100) / 100 : undefined,
        truckId:
          b.truckId !== undefined ? (b.truckId ? String(b.truckId) : null) : undefined,
      },
      include: { truck: { select: { id: true, unitNumber: true, type: true } } },
    });
    return NextResponse.json({ expense });
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
  const existing = await db.expense.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
