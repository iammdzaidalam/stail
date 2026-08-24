# STAIL Workforce OS — Design & Engineering Conventions

Internal attendance + daily reporting + workforce intelligence platform for
STAIL (ShivTrinetrix AI Labs). Next.js 16 App Router, TypeScript, Tailwind v4,
Prisma 7 + SQLite, custom JWT session auth. All company time is IST.

## Aesthetic (follow strictly)

Inspiration: Golden Suisse dark minimal login; Salesforce/HubSpot-style redesigns
with warm off-white canvases, near-black feature panels, lime accent.

- **Canvas** `bg-bg` (warm off-white; near-black in dark mode). Cards `Card`
  (white surface, `rounded-3xl`, hairline border). Signature move: mix in ONE
  dark `PanelCard` (or one `bg-accent` card) per view as the hero/feature card.
- **Accent** lime `bg-accent text-accent-ink` — use sparingly: one primary CTA,
  active states, one stat tile, "Working" live dots. Never large accent areas.
- **Type**: Geist. Page titles via `PageHeader` (32px semibold tracking-tight).
  Micro-labels: tiny uppercase `CardLabel` / `text-[11px] uppercase
  tracking-[0.14em] text-ink-faint`. Big numbers: `text-3xl md:text-4xl
  font-semibold tracking-tighter tabular-nums`.
- **Shape**: pills everywhere (`rounded-full` buttons/badges/tabs), cards
  `rounded-3xl`, inputs `rounded-xl`.
- Data-rich, calm, enterprise. No gradients, no shadows heavier than
  `shadow-sm`, no emoji in UI, no horizontal page scroll (wide tables live
  inside `TableWrap` which scrolls internally).
- Dark mode is automatic **if you only use token colors** (`bg`, `surface`,
  `surface-2`, `ink`, `ink-soft`, `ink-faint`, `line`, `line-strong`, `panel`,
  `panel-ink`, `panel-soft`, `panel-line`, `accent`, `accent-ink`, `good`,
  `warn`, `bad`). Never hardcode hex colors. On `PanelCard`, use
  `text-panel-ink`, `opacity-60`, and `border-panel-line` for internal lines.
- Simple charts only, hand-built: `ProgressBar`, `SegmentBar`, or CSS bar
  columns (`flex items-end gap-1` + accent bars with height %). Bars scale
  linearly from zero; label values; single-series = accent or ink only.

## Component inventory (import these — do not restyle ad hoc)

- `@/components/ui/button` → `Button` (`variant`: primary | accent | outline |
  ghost | danger; `size`: sm | md | lg | icon), `buttonClass()` for `<Link>`s.
- `@/components/ui/card` → `Card`, `PanelCard`, `CardLabel`.
- `@/components/ui/badge` → `Badge` (tones), `StatusBadge` (pass any status
  string: attendance, live, task, priority, request, ACTIVE/EXITED…).
- `@/components/ui/avatar` → `Avatar` (name + hue), `AvatarStack`.
- `@/components/ui/stat` → `StatCard` (label, value, sub, tone: surface |
  panel | accent).
- `@/components/ui/input` → `Input`, `Textarea`, `Select`, `Label`, `Field`.
- `@/components/ui/table` → `TableWrap`, `Table`, `Th`, `Td`, `Tr`.
- `@/components/ui/progress` → `ProgressBar`, `SegmentBar`.
- `@/components/ui/tabs` → `LinkTabs` (server-friendly link pills; compute
  `active` from current searchParams/pathname).
- `@/components/ui/empty` → `EmptyState`.
- `@/components/ui/page-header` → `PageHeader`, `SectionTitle`.
- `@/components/ui/spark` → `Spark` (brand star glyph).
- Icons: `lucide-react` (size-4 default).

## Library (always use these — never reimplement)

- `@/lib/db` → `db` (PrismaClient). Models: User, Team, Project, Attendance,
  Break, Task, TaskComment, DailyPlan, DailyReport, Leave, Holiday, Policy,
  CorrectionRequest, AuditLog, Announcement (see `prisma/schema.prisma`).
- `@/lib/definitions` → role/status constants, labels, types.
- `@/lib/session` → `requireUser(roles?)` (redirects; returns user with
  `.team`), `getCurrentUser()`.
- `@/lib/rbac` → `isManagerial`, `isOrg`, `isAdmin`, `visibleTeamIds(user)`
  (`"ALL"` | ids), `teamScopeWhere(user)`, `canViewUser(viewer, targetId)`.
- `@/lib/attendance` → `getPolicy()`, `dayKind(date, policy, holidayMap)`,
  `getHolidayMap()`, `clockInStatus(date, policy)`, `finalDayStatus(base,
  totalMinutes, policy)`, `workedMinutes(att, now?)`, `liveStatus(att)`
  (pass attendance with `breaks` included), `openBreak(breaks)`,
  `attendanceRate(present, workingDays)`.
- `@/lib/time` → `todayIST()`, `dateKey(date)`, `fmtTime`, `fmtDuration`,
  `fmtDateLong/Short/Full`, `fmtWeekday`, `addDays`, `listDates`, `lastNDays`,
  `monthBounds`, `weekBounds`, `dayOfWeek`, `hmToMinutes`, `minutesToLabel`,
  `istMinutesOfDay`, `minutesBetween`, `timeAgo`.
- `@/lib/audit` → `logAudit({actor, action, entity, entityId, before, after})`.
- `@/lib/utils` → `cn`, `initials`, `pct`, `plural`, `toLines`.

## Data conventions

- Calendar days are `"YYYY-MM-DD"` strings in **IST** (`todayIST()`, never
  `new Date().toISOString()`). Timestamps are `Date` (UTC) — always display
  via `fmtTime`/`fmtDuration`.
- To build a UTC Date for an IST wall-clock time on a date key:
  `new Date(Date.UTC(y, m - 1, d, 0, 0) + minutes * 60000 - 330 * 60000)`.
- Weekends/holidays/leave/absent days exist as Attendance rows in history
  (statuses WEEKEND/HOLIDAY/LEAVE/ABSENT). **Today** only has a row once the
  user clocks in (or is on leave) — "no row today on a working day" = Not
  Started; treat it as ABSENT only for past days.
- Daily plan priorities are newline-separated text (`toLines()` to render).

## Security & RBAC (non-negotiable)

- Every page: start with `const user = await requireUser(...)`. Every server
  action: same — re-derive identity server-side; **never** accept a userId
  from the client as "who I am". Validate that target ids (assignee, team,
  person) are permitted via `@/lib/rbac` helpers before reading/writing.
- Roles: INTERN/EMPLOYEE see self only. TEAM_LEAD sees `visibleTeamIds`.
  MANAGER/HR/FOUNDER are org-wide (`isOrg`). Mutating people/policies/
  holidays = `isAdmin` (HR/FOUNDER).
- Timestamps for clock events are **server-generated** (`new Date()`), never
  parsed from the client.
- Sensitive mutations (people admin, policy/holiday changes, approvals,
  corrections, task delete/reassign) must call `logAudit` with before/after.
- Validate enum-ish inputs against the arrays in `@/lib/definitions`
  (`TASK_STATUSES.includes(x)`), trim strings, cap lengths (~2000 chars).

## Next.js 16 patterns

- Server components by default; `"use client"` only for interactivity
  (forms with `useActionState`, intervals, toggles).
- `params`/`searchParams` are **Promises**: `const { id } = await params;`
  types: `{ params: Promise<{ id: string }> }`,
  `{ searchParams: Promise<Record<string, string | string[] | undefined>> }`.
- Server actions: `"use server"` file in the route dir (`actions.ts`),
  signature `(prevState, formData)` for `useActionState` forms, return
  `{ error?: string; ok?: boolean }`. After mutations call
  `revalidatePath("/", "layout")`.
- Forms: native `<form action={...}>`. Small confirm steps > modals. Native
  `<input type="date">` values already match our date keys.
- Never import from another feature's route directory. Shared code lives in
  `@/lib` and `@/components/ui` only (do not edit those — they are frozen).

## File ownership (do not touch files outside your area)

- Frozen shared: `src/lib/*`, `src/components/ui/*`, `src/components/shell/*`,
  `src/app/layout.tsx`, `src/app/globals.css`, `src/app/login/*`,
  `src/app/(app)/layout.tsx`, `prisma/*`, `package.json`, config files.
- Feature areas own their route dirs under `src/app/(app)/<area>/` (pages,
  `actions.ts`, local components) and `src/app/api/<area>/` where assigned.

## Verification

Run `npx tsc --noEmit` and fix every error **in your own files** (other
areas may be mid-build — ignore errors outside your paths). Do not run the
dev server or `next build`; integration happens after all areas land.
