import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and point it at your " +
      "Postgres database (see README).",
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Reuse one client across hot reloads in dev; in production each serverless
// instance gets its own, which is what the pooled connection string is for.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
