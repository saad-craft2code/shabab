import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Sanitize a database URL pasted into hosting dashboards:
 * - trims whitespace/newlines
 * - strips wrapping quotes (single/double/backticks)
 * Vercel stores env values literally, so "postgresql://..." with quotes
 * or trailing whitespace breaks Prisma protocol validation.
 */
function sanitizeDbUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw
  const cleaned = raw
    .trim()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .trim()
  return cleaned || undefined
}

// Prefer the Neon Postgres URL (POSTGRES_URL) over any inherited legacy env var.
const databaseUrl =
  sanitizeDbUrl(process.env.POSTGRES_URL) ||
  sanitizeDbUrl(process.env.DATABASE_URL) ||
  undefined

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
