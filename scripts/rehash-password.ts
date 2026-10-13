import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

/**
 * Re-hash the login user's password with the CURRENT AUTH_SECRET.
 * Run with: AUTH_SECRET=<secret> bunx tsx scripts/rehash-password.ts
 * Keeps login working after secret rotation (credentials come from env).
 */

const db = new PrismaClient({
  datasourceUrl: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});
const SECRET = process.env.AUTH_SECRET || "shabab-express-secret-2026";
const USERNAME = process.env.SEED_USERNAME;
const PASSWORD = process.env.SEED_PASSWORD;

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(`${SECRET}:${password}`).digest("hex");
}

async function main() {
  if (!process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET env var must be set — refusing to run with fallback.");
  }
  if (!USERNAME || !PASSWORD) {
    throw new Error("Set SEED_USERNAME and SEED_PASSWORD env vars first.");
  }
  const res = await db.user.updateMany({
    where: { username: USERNAME },
    data: { password: hashPassword(PASSWORD) },
  });
  console.log(`✓ Re-hashed password for ${res.count} user(s) with the new AUTH_SECRET`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
