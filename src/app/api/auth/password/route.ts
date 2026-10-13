import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, hashPassword, verifyCredentials } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const current = String(body.currentPassword || "");
    const next = String(body.newPassword || "");
    if (next.length < 4) {
      return NextResponse.json(
        { error: "New password must be at least 4 characters." },
        { status: 400 }
      );
    }
    const ok = await verifyCredentials(user, current);
    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 }
      );
    }
    await db.user.update({
      where: { username: user },
      data: { password: hashPassword(next) },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
