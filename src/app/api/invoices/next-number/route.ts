import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
  return NextResponse.json({
    number: `SE-${year}-${String(maxSeq + 1).padStart(4, "0")}`,
  });
}
