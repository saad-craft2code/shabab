import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prefer the Neon Postgres URL (POSTGRES_URL) over any inherited legacy env var.
const databaseUrl =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || undefined

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
