import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie, verifyCredentials } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }
    const ok = await verifyCredentials(username, password);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }
    await setSessionCookie(username);
    return NextResponse.json({ ok: true, username });
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
