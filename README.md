# STAIL Workforce OS

Internal attendance, daily task reporting, and workforce intelligence platform
for **STAIL** (ShivTrinetrix AI Labs Private Limited).

> One login. One attendance system. One task layer. One reporting system.
> One source of truth for the organization.

The core daily loop: **Register → Approval → Clock In → Plan → Work → Update
Tasks → End-of-Day Report → Clock Out**, with team dashboards for leads, an
approvals inbox, and an organization-wide intelligence view for leadership.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`)
- **TypeScript**, **Tailwind CSS v4** (token-driven light/dark theme)
- **Prisma 7** + SQLite (via `better-sqlite3` driver adapter) — swap the
  datasource for Postgres when deploying
- Custom JWT session auth (`jose`, httpOnly cookies, bcrypt password hashing)
- Full RBAC: Intern / Employee / Team Lead / Manager / HR / Founder /
  Super Admin

## Getting started

```bash
npm install
cp .env.example .env    # then fill in real values (see below)
npx prisma db push      # create prisma/dev.db
npm run db:seed         # create the default policy + the Super Admin account
npm run dev
```

Set these in `.env` before seeding (never commit real values):

| Variable               | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `SESSION_SECRET`       | JWT signing secret — `openssl rand -hex 32`        |
| `SUPER_ADMIN_EMAIL`    | Email of the root account created by `db:seed`     |
| `SUPER_ADMIN_PASSWORD` | Its initial password — rotate after first login    |
| `SUPER_ADMIN_NAME`     | Display name for the root account (optional)       |

## How access works (production model)

1. **People register themselves** at `/register` (name, email, password).
   The account is created as **Pending** and cannot sign in yet.
2. **An admin approves** the registration at `/admin/registrations`, assigning
   a role and (optionally) a team. Declined registrations can be deleted to
   free the email again.
3. **Admins run the org**: HR, Founder and the Super Admin have identical
   administrative powers — people, teams, registrations, policies, holidays,
   announcements, audit log, exports. The Super Admin account itself is
   protected: only the Super Admin can edit it or grant the Super Admin role.

There is no demo data. (`npm run db:seed-demo` exists for local development
only — it wipes the database, generates a fictional org, and re-creates the
Super Admin from env.)

## Key areas

| Route             | Who            | What                                                    |
| ----------------- | -------------- | ------------------------------------------------------- |
| `/register`       | public         | Self-registration (pending until approved)              |
| `/dashboard`      | everyone       | Clock in/out, breaks, today's plan, tasks, report nudge |
| `/attendance`     | everyone       | Personal attendance history & monthly stats             |
| `/tasks`          | everyone       | Task list, detail, comments; team scope for leads       |
| `/reports`        | everyone       | End-of-day report, history, auto weekly summary         |
| `/leave`          | everyone       | Leave requests, attendance corrections, holidays        |
| `/announcements`  | everyone       | Company announcements (admins post)                     |
| `/team`, `/team/live`, `/team/reports` | leads+ | Team overview, live workforce board, report review |
| `/approvals`      | leads+         | Approve/reject leave & corrections (audit-logged)       |
| `/org`            | managers+      | STAIL at a Glance: cross-team & project intelligence    |
| `/projects`       | everyone       | Project workload dashboards (managers+ create)          |
| `/people`         | managers+      | Directory, profiles; admins manage people               |
| `/admin/*`        | admins         | Registrations, teams, policy, holidays, audit log       |
| `/api/export/*`   | managers+      | CSV exports (attendance, tasks)                         |

## Conventions

See [DESIGN.md](./DESIGN.md) for the design system, component inventory,
RBAC rules, and data conventions (IST date keys, server-generated timestamps).

## Security notes

- Sessions are signed JWTs in httpOnly `SameSite=Lax` cookies; every page and
  server action re-derives the user server-side. Only **Active** accounts can
  sign in — pending, declined and exited accounts are locked out.
- Clock in/out timestamps are always server-generated.
- Login attempts are throttled; sensitive admin/approval mutations are written
  to the audit log with before/after values.
- Rotate `SESSION_SECRET` and the Super Admin password for production, and
  move to Postgres before deploying (SQLite is for local/single-node use).
