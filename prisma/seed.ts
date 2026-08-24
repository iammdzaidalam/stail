/**
 * Production bootstrap.
 *
 * Creates the default attendance policy and the Super Admin root account from
 * environment variables — nothing else. Everyone else joins by registering at
 * /register and being approved by an admin.
 *
 * Required env (put them in .env, never commit real values):
 *   SUPER_ADMIN_EMAIL     e.g. admin@example.com
 *   SUPER_ADMIN_PASSWORD  min 8 chars — change it after first login
 *   SUPER_ADMIN_NAME      optional display name
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — see .env.example.");
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

  if (!email || !password) {
    throw new Error(
      "Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env before seeding " +
        "(see .env.example).",
    );
  }
  if (password.length < 8) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
  }

  await db.policy.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Never overwrite the password of an existing account; just make sure the
    // root account is active and privileged.
    if (existing.role !== "SUPER_ADMIN" || existing.status !== "ACTIVE") {
      await db.user.update({
        where: { id: existing.id },
        data: { role: "SUPER_ADMIN", status: "ACTIVE" },
      });
      console.log(`Promoted existing account ${email} to active Super Admin.`);
    } else {
      console.log(`Super Admin ${email} already exists — nothing to do.`);
    }
    return;
  }

  await db.user.create({
    data: {
      employeeCode: "STL-001",
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role: "SUPER_ADMIN",
      title: "Super Admin",
      employmentType: "FULL_TIME",
      status: "ACTIVE",
      joiningDate: new Date(),
      avatarHue: 260,
    },
  });
  console.log(`Created Super Admin ${email}. Policy defaults are in place.`);
  console.log("Everyone else registers at /register and waits for approval.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
