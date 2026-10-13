import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function sanitize(msg: string): string {
  return msg.replace(/postgre(s|sql)?:\/\/[^\s"']+/gi, "[redacted-url]");
}

/**
 * Deployment diagnostic — reports connection health only (no sensitive data).
 * Safe to keep; reveals booleans + sanitized error text.
 */
export async function GET() {
  const authSecretSet = Boolean(process.env.AUTH_SECRET);
  const postgresUrlSet = Boolean(
    process.env.POSTGRES_URL || process.env.DATABASE_URL
  );

  try {
    const users = await db.user.findMany({ select: { username: true } });
    return NextResponse.json({
      service: "shabab-express",
      status: "healthy",
      db: "connected",
      authSecretSet,
      postgresUrlSet,
      userSeeded: users.some((u) => u.username === "sultan"),
    });
  } catch (e) {
    return NextResponse.json(
      {
        service: "shabab-express",
        status: "unhealthy",
        db: "error",
        authSecretSet,
        postgresUrlSet,
        detail: sanitize(e instanceof Error ? e.message : "unknown error"),
      },
      { status: 500 }
    );
  }
}
