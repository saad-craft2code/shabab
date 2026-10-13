import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

/**
 * BOOTSTRAP SEED — creates only the essentials. NO dummy/demo data.
 * Safe to re-run at any time (idempotent).
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
  if (!USERNAME || !PASSWORD) {
    throw new Error("Set SEED_USERNAME and SEED_PASSWORD env vars before seeding.");
  }
  console.log("Bootstrapping Shabab Express (Neon PostgreSQL)...");

  // 1. Login user (real credentials, no demo account)
  await db.user.upsert({
    where: { username: USERNAME },
    update: { password: hashPassword(PASSWORD) },
    create: { username: USERNAME, password: hashPassword(PASSWORD) },
  });
  console.log(`✓ Login → ${USERNAME} / ${PASSWORD}`);

  // 2. Company settings — real SHABAB EXPRESS LLC details
  const settings = await db.companySettings.findFirst();
  if (!settings) {
    await db.companySettings.create({
      data: {
        name: "Shabab Express",
        legalName: "SHABAB EXPRESS LLC",
        addressLine: "400 Montrose Dr Apt F",
        city: "Greensboro",
        state: "NC",
        zip: "27407-1272",
        phone: "(336) 420-9974",
        email: "sultanshah2k21@gmail.com",
        mcNumber: "MC 1820180",
        dotNumber: "DOT 4574766",
        mcFeePercent: 10,
        paymentTerms:
          "Net 7 days from settlement date. Payment via direct deposit, Zelle, or company check.",
      },
    });
    console.log("✓ Company settings (Greensboro, NC · MC 1820180 · DOT 4574766)");
  } else {
    console.log("✓ Company settings already present");
  }

  console.log("Done. No sample data created — the app starts clean.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
