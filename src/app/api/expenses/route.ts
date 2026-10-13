import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expenses = await db.expense.findMany({
    orderBy: { date: "desc" },
    include: { truck: { select: { id: true, unitNumber: true, type: true } } },
  });
  return NextResponse.json({ expenses });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const b = await req.json();
    const amount = Number(b.amount);
    if (!String(b.description || "").trim()) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number." },
        { status: 400 }
      );
    }
    const expense = await db.expense.create({
      data: {
        date: b.date ? new Date(String(b.date)) : new Date(),
        category: b.category ? String(b.category) : "OTHER",
        description: String(b.description).trim(),
        amount: Math.round(amount * 100) / 100,
        truckId: b.truckId ? String(b.truckId) : null,
      },
      include: { truck: { select: { id: true, unitNumber: true, type: true } } },
    });
    return NextResponse.json({ expense });
  } catch {
    return NextResponse.json({ error: "Create failed." }, { status: 500 });
  }
}
