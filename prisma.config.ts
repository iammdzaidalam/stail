import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations run over a direct (unpooled) connection — pgbouncer-style poolers
// do not handle multi-statement DDL transactions reliably. The app itself uses
// the pooled DATABASE_URL via the driver adapter in src/lib/db.ts.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("Set DATABASE_URL (and DIRECT_URL in production) — see .env.example.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
