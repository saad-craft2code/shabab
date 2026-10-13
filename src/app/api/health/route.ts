import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function sanitize(msg: string): string {
  return msg.replace(/postgre(s|sql)?:\/\/[^\s"']+/gi, "[redacted-url]");
}

/** Shape diagnostics for the raw env value — never exposes host/password. */
function urlShape(raw: string | undefined) {
  if (!raw) return null;
  const trimmed = raw.trim();
  return {
    length: raw.length,
    // first chars up to "://" reveal protocol typos / stray quotes; safe to show
    prefix: raw.slice(0, Math.min(16, raw.indexOf(":") + 4 || 16)),
    hasQuotes: /^["'`]|["'`]$/.test(raw),
    hasSpaces: /\s/.test(raw),
    looksValid: /^postgre(s|sql):\/\/\S+$/i.test(trimmed),
  };
}

/**
 * Deployment diagnostic — reports connection health only (no sensitive data).
 */
export async function GET() {
  const authSecretSet = Boolean(process.env.AUTH_SECRET);
  const rawUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const postgresUrlSet = Boolean(rawUrl);

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
        urlShape: urlShape(rawUrl),
        detail: sanitize(e instanceof Error ? e.message : "unknown error"),
      },
      { status: 500 }
    );
  }
}
