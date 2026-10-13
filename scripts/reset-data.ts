import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

/**
 * RESET SCRIPT — removes ALL dummy/demo data and sets real login credentials.
 * Keeps: CompanySettings (real SHABAB EXPRESS LLC details).
 * Deletes: all invoices + loads + deductions, owner operators, trucks, expenses.
 * Replaces the old dummy user (wpasweo) with the real one.
 *
 * Real login credentials come from SEED_USERNAME / SEED_PASSWORD env vars.
 */

const db = new PrismaClient({
  datasourceUrl: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});
const SECRET = process.env.AUTH_SECRET || "shabab-express-secret-2026";

const REAL_USERNAME = process.env.SEED_USERNAME;
const REAL_PASSWORD = process.env.SEED_PASSWORD;

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(`${SECRET}:${password}`).digest("hex");
}

async function main() {
  if (!REAL_USERNAME || !REAL_PASSWORD) {
    throw new Error("Set SEED_USERNAME and SEED_PASSWORD env vars before running reset.");
  }
  console.log("Resetting Shabab Express data (Neon PostgreSQL)...");

  // ---- 1. Delete all business data (FK-safe order) ----
  const ded = await db.deduction.deleteMany({});
  const loads = await db.load.deleteMany({});
  const inv = await db.invoice.deleteMany({});
  const exp = await db.expense.deleteMany({});
  const trucks = await db.truck.deleteMany({});
  const ops = await db.ownerOperator.deleteMany({});
  console.log(
    `✓ Deleted: ${inv.count} invoices, ${loads.count} loads, ${ded.count} deductions, ` +
      `${ops.count} owner-operators, ${trucks.count} fleet units, ${exp.count} expenses`
  );

  // ---- 2. Remove old dummy user, create the real login ----
  const removed = await db.user.deleteMany({ where: { username: "wpasweo" } });
  if (removed.count) console.log("✓ Removed dummy user: wpasweo");

  await db.user.upsert({
    where: { username: REAL_USERNAME },
    update: { password: hashPassword(REAL_PASSWORD) },
    create: { username: REAL_USERNAME, password: hashPassword(REAL_PASSWORD) },
  });
  console.log(`✓ Login ready → username: ${REAL_USERNAME} / password: ${REAL_PASSWORD}`);

  // Remove any other stray users (only sultan should exist)
  const strays = await db.user.deleteMany({ where: { username: { not: REAL_USERNAME } } });
  if (strays.count) console.log(`✓ Removed ${strays.count} extra user(s)`);

  // ---- 3. Company settings sanity check (keep real details) ----
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
    console.log("✓ Recreated company settings");
  } else {
    console.log("✓ Company settings intact (SHABAB EXPRESS LLC)");
  }

  // ---- 4. Final counts ----
  const [u, o, i, t, e] = await Promise.all([
    db.user.count(),
    db.ownerOperator.count(),
    db.invoice.count(),
    db.truck.count(),
    db.expense.count(),
  ]);
  console.log(`Final state → users: ${u}, operators: ${o}, invoices: ${i}, fleet: ${t}, expenses: ${e}`);
  console.log("Reset complete. Database is clean and ready for real data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
