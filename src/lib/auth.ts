import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SECRET = process.env.AUTH_SECRET || "shabab-express-secret-2026";
const COOKIE_NAME = "se_session";
const SESSION_DAYS = 30;

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(`${SECRET}:${password}`)
    .digest("hex");
}

export function createToken(username: string): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string): string | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    if (sign(payload) !== sig) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return String(data.u);
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(username: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, createToken(username), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Returns user or null; helper used inside every protected API route. */
export async function requireUser() {
  const user = await getSessionUser();
  return user;
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const user = await db.user.findUnique({ where: { username } });
  if (!user) return false;
  return user.password === hashPassword(password);
}
