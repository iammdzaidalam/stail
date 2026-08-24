# STAIL Workforce OS

Internal attendance, daily task reporting, and workforce intelligence platform
for **STAIL** (ShivTrinetrix AI Labs Private Limited).

> One login. One attendance system. One task layer. One reporting system.
> One source of truth for the organization.

The core daily loop: **Login → Clock In → Plan → Work → Update Tasks →
End-of-Day Report → Clock Out**, with team dashboards for leads, an approvals
inbox, and an organization-wide intelligence view for leadership.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`)
- **TypeScript**, **Tailwind CSS v4** (token-driven light/dark theme)
- **Prisma 7** + SQLite (via `better-sqlite3` driver adapter) — swap the
  datasource for Postgres when deploying
- Custom JWT session auth (`jose`, httpOnly cookies, bcrypt password hashing)
- Full RBAC: Intern / Employee / Team Lead / Manager / HR / Founder

## Getting started

```bash
npm install
npx prisma db push      # create prisma/dev.db
npm run db:seed         # seed the demo organization
npm run dev
```

Open http://localhost:3000 and log in with a demo account (password for all:
`stail123`):

| Role      | Email                  |
| --------- | ---------------------- |
| Founder   | shivansh@stail.co.in   |
| HR        | priya@stail.co.in      |
| Manager   | arjun@stail.co.in      |
| Team Lead | rohan@stail.co.in      |
| Employee  | ayush@stail.co.in      |
| Intern    | sahil@stail.co.in      |

The seed creates 22 people across 5 teams and 6 projects with ~5 weeks of
attendance history, daily plans/reports, tasks, leaves, and correction
requests. Re-run `npm run db:seed` anytime to reset.

## Key areas

| Route             | Who            | What                                                    |
| ----------------- | -------------- | ------------------------------------------------------- |
| `/dashboard`      | everyone       | Clock in/out, breaks, today's plan, tasks, report nudge |
| `/attendance`     | everyone       | Personal attendance history & monthly stats             |
| `/tasks`          | everyone       | Task list, detail, comments; team scope for leads       |
| `/reports`        | everyone       | End-of-day report, history, auto weekly summary         |
| `/leave`          | everyone       | Leave requests, attendance corrections, holidays        |
| `/team`, `/team/live`, `/team/reports` | leads+ | Team overview, live workforce board, report review |
| `/approvals`      | leads+         | Approve/reject leave & corrections (audit-logged)       |
| `/org`            | managers+      | STAIL at a Glance: cross-team & project intelligence    |
| `/projects`       | everyone       | Project workload dashboards                             |
| `/people`         | managers+      | Directory, profiles; HR manages people                  |
| `/admin/*`        | HR/Founder     | Attendance policy, holidays, audit log                  |
| `/api/export/*`   | managers+      | CSV exports (attendance, tasks)                         |

## Conventions

See [DESIGN.md](./DESIGN.md) for the design system, component inventory,
RBAC rules, and data conventions (IST date keys, server-generated timestamps).

## Security notes

- Sessions are signed JWTs in httpOnly `SameSite=Lax` cookies; every page and
  server action re-derives the user server-side.
- Clock in/out timestamps are always server-generated.
- Login attempts are throttled; sensitive admin/approval mutations are written
  to the audit log with before/after values.
- Set a fresh `SESSION_SECRET` (`openssl rand -hex 32`) outside local dev.
