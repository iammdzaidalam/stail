/**
 * DEV ONLY: seed a realistic demo organization (npm run db:seed-demo).
 * Wipes ALL data first, then re-creates the Super Admin from env so you are
 * never locked out. Do not run against production data.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { addDays, dateKey, dayOfWeek, listDates } from "../src/lib/time";

const adapter = new PrismaBetterSqlite3({
  url: `file:${path.join(process.cwd(), "prisma", "dev.db")}`,
});
const db = new PrismaClient({ adapter });

// ---------- deterministic PRNG ----------
let seedState = 20260824;
function rand(): number {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;

// IST = UTC+5:30 — build a UTC Date for an IST wall-clock time on a date key
function istDate(key: string, minutesOfDay: number): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0) + minutesOfDay * 60000 - 330 * 60000);
}
const hm = (h: number, m: number) => h * 60 + m;

async function main() {
  console.log("Seeding STAIL Workforce OS…");

  // ---------- wipe ----------
  await db.auditLog.deleteMany();
  await db.taskComment.deleteMany();
  await db.task.deleteMany();
  await db.break.deleteMany();
  await db.attendance.deleteMany();
  await db.dailyPlan.deleteMany();
  await db.dailyReport.deleteMany();
  await db.leave.deleteMany();
  await db.correctionRequest.deleteMany();
  await db.announcement.deleteMany();
  await db.project.deleteMany();
  await db.user.updateMany({ data: { teamId: null, managerId: null } });
  await db.team.deleteMany();
  await db.user.deleteMany();
  await db.holiday.deleteMany();
  await db.policy.deleteMany();

  // ---------- policy & holidays ----------
  await db.policy.create({ data: { id: "default" } });

  const holidays = [
    { date: "2026-08-15", name: "Independence Day", type: "NATIONAL" },
    { date: "2026-08-28", name: "Raksha Bandhan", type: "COMPANY" },
    { date: "2026-09-14", name: "Onam", type: "OPTIONAL" },
    { date: "2026-10-02", name: "Gandhi Jayanti", type: "NATIONAL" },
    { date: "2026-11-10", name: "Diwali", type: "NATIONAL" },
    { date: "2026-11-11", name: "Diwali (Day 2)", type: "COMPANY" },
  ];
  await db.holiday.createMany({ data: holidays });
  const holidaySet = new Set(holidays.map((h) => h.date));

  // ---------- teams ----------
  const teamDefs = [
    { name: "AI Engineering", department: "Engineering" },
    { name: "Platform Engineering", department: "Engineering" },
    { name: "Product & Design", department: "Product" },
    { name: "Growth & Sales", department: "Growth" },
    { name: "Operations", department: "Operations" },
  ];
  const teams: Record<string, { id: string }> = {};
  for (const t of teamDefs) teams[t.name] = await db.team.create({ data: t });

  // ---------- users ----------
  const passwordHash = bcrypt.hashSync("stail123", 10);
  type UserDef = {
    name: string;
    email: string;
    role: string;
    title: string;
    team: string | null;
    employmentType?: string;
    joined: string;
    hue: number;
  };
  const userDefs: UserDef[] = [
    { name: "Shivansh Rao", email: "shivansh@stail.co.in", role: "FOUNDER", title: "Founder & CEO", team: null, joined: "2024-01-15", hue: 260 },
    { name: "Priya Menon", email: "priya@stail.co.in", role: "HR", title: "People Operations", team: "Operations", joined: "2024-06-01", hue: 340 },
    { name: "Arjun Mehta", email: "arjun@stail.co.in", role: "MANAGER", title: "Engineering Manager", team: "AI Engineering", joined: "2024-03-10", hue: 210 },
    { name: "Kavya Iyer", email: "kavya@stail.co.in", role: "MANAGER", title: "Product & Growth Manager", team: "Product & Design", joined: "2024-04-22", hue: 25 },
    { name: "Rohan Gupta", email: "rohan@stail.co.in", role: "TEAM_LEAD", title: "AI Engineering Lead", team: "AI Engineering", joined: "2024-08-05", hue: 190 },
    { name: "Nikhil Reddy", email: "nikhil@stail.co.in", role: "TEAM_LEAD", title: "Platform Lead", team: "Platform Engineering", joined: "2024-09-16", hue: 150 },
    { name: "Sneha Kulkarni", email: "sneha@stail.co.in", role: "TEAM_LEAD", title: "Design Lead", team: "Product & Design", joined: "2024-07-01", hue: 310 },
    { name: "Aditya Sharma", email: "aditya@stail.co.in", role: "TEAM_LEAD", title: "Growth Lead", team: "Growth & Sales", joined: "2024-11-03", hue: 45 },
    { name: "Fatima Khan", email: "fatima@stail.co.in", role: "TEAM_LEAD", title: "Operations Lead", team: "Operations", joined: "2025-01-20", hue: 285 },
    { name: "Ayush Verma", email: "ayush@stail.co.in", role: "EMPLOYEE", title: "Full-stack Engineer", team: "AI Engineering", joined: "2025-02-10", hue: 200 },
    { name: "Aditi Nair", email: "aditi@stail.co.in", role: "EMPLOYEE", title: "ML Engineer", team: "AI Engineering", joined: "2025-03-17", hue: 130 },
    { name: "Karan Malhotra", email: "karan@stail.co.in", role: "EMPLOYEE", title: "Backend Engineer", team: "Platform Engineering", joined: "2025-04-01", hue: 230 },
    { name: "Zoya Siddiqui", email: "zoya@stail.co.in", role: "EMPLOYEE", title: "Frontend Engineer", team: "Platform Engineering", joined: "2025-05-12", hue: 355 },
    { name: "Dev Patel", email: "dev@stail.co.in", role: "EMPLOYEE", title: "Product Designer", team: "Product & Design", joined: "2025-01-06", hue: 170 },
    { name: "Ishita Bose", email: "ishita@stail.co.in", role: "EMPLOYEE", title: "Product Analyst", team: "Product & Design", joined: "2025-06-23", hue: 15 },
    { name: "Tanvi Joshi", email: "tanvi@stail.co.in", role: "EMPLOYEE", title: "Growth Marketer", team: "Growth & Sales", joined: "2025-02-24", hue: 60 },
    { name: "Ananya Das", email: "ananya@stail.co.in", role: "EMPLOYEE", title: "Sales Associate", team: "Growth & Sales", joined: "2025-07-14", hue: 300 },
    { name: "Vikram Singh", email: "vikram@stail.co.in", role: "EMPLOYEE", title: "Ops Executive", team: "Operations", joined: "2025-08-04", hue: 110 },
    { name: "Sahil Ansari", email: "sahil@stail.co.in", role: "INTERN", title: "Engineering Intern", team: "AI Engineering", employmentType: "INTERN", joined: "2026-06-01", hue: 240 },
    { name: "Meera Pillai", email: "meera@stail.co.in", role: "INTERN", title: "Design Intern", team: "Product & Design", employmentType: "INTERN", joined: "2026-06-01", hue: 330 },
    { name: "Harsh Vora", email: "harsh@stail.co.in", role: "INTERN", title: "Growth Intern", team: "Growth & Sales", employmentType: "INTERN", joined: "2026-07-01", hue: 90 },
    { name: "Riya Kapoor", email: "riya@stail.co.in", role: "INTERN", title: "Platform Intern", team: "Platform Engineering", employmentType: "INTERN", joined: "2026-07-01", hue: 275 },
  ];

  const users: Record<string, { id: string; role: string; teamName: string | null; name: string }> = {};
  let code = 1;
  for (const u of userDefs) {
    const row = await db.user.create({
      data: {
        employeeCode: `STL-${String(code++).padStart(3, "0")}`,
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        title: u.title,
        employmentType: u.employmentType ?? "FULL_TIME",
        joiningDate: istDate(u.joined, hm(10, 0)),
        avatarHue: u.hue,
        teamId: u.team ? teams[u.team].id : null,
      },
    });
    users[u.email] = { id: row.id, role: u.role, teamName: u.team, name: u.name };
  }

  // manager chains + team leadership
  const founder = users["shivansh@stail.co.in"];
  const managerByTeam: Record<string, string> = {
    "AI Engineering": users["arjun@stail.co.in"].id,
    "Platform Engineering": users["arjun@stail.co.in"].id,
    "Product & Design": users["kavya@stail.co.in"].id,
    "Growth & Sales": users["kavya@stail.co.in"].id,
    Operations: users["kavya@stail.co.in"].id,
  };
  const leadByTeam: Record<string, string> = {
    "AI Engineering": users["rohan@stail.co.in"].id,
    "Platform Engineering": users["nikhil@stail.co.in"].id,
    "Product & Design": users["sneha@stail.co.in"].id,
    "Growth & Sales": users["aditya@stail.co.in"].id,
    Operations: users["fatima@stail.co.in"].id,
  };
  for (const [teamName, team] of Object.entries(teams)) {
    await db.team.update({
      where: { id: team.id },
      data: { leadId: leadByTeam[teamName], managerId: managerByTeam[teamName] },
    });
  }
  for (const u of Object.values(users)) {
    let managerId: string | null = null;
    if (u.role === "MANAGER" || u.role === "HR") managerId = founder.id;
    else if (u.role === "TEAM_LEAD") managerId = u.teamName ? managerByTeam[u.teamName] : founder.id;
    else if (u.role !== "FOUNDER") managerId = u.teamName ? leadByTeam[u.teamName] : founder.id;
    if (managerId && managerId !== u.id)
      await db.user.update({ where: { id: u.id }, data: { managerId } });
  }

  // ---------- projects ----------
  const projectDefs = [
    { name: "STAIL RankOS", code: "RNK", hue: 80, team: "AI Engineering", description: "AI-powered SEO & ranking platform." },
    { name: "STAIL Realty OS", code: "RLT", hue: 200, team: "Platform Engineering", description: "Operating system for real-estate teams." },
    { name: "Trinetrix Carbon", code: "CRB", hue: 150, team: "AI Engineering", description: "Carbon accounting intelligence engine." },
    { name: "Viralitea", code: "VRL", hue: 320, team: "Growth & Sales", description: "Social growth & content analytics product." },
    { name: "Internal Operations", code: "INT", hue: 30, team: "Operations", description: "Internal tooling, IT and office operations." },
    { name: "Client — Acme Retail", code: "CLI", hue: 260, team: "Product & Design", description: "Retail analytics engagement for Acme." },
  ];
  const projects: { id: string; name: string; team: string }[] = [];
  for (const p of projectDefs) {
    const row = await db.project.create({
      data: {
        name: p.name,
        code: p.code,
        hue: p.hue,
        description: p.description,
        teamId: teams[p.team].id,
      },
    });
    projects.push({ id: row.id, name: p.name, team: p.team });
  }
  const projectsForTeam = (teamName: string | null) => {
    const own = projects.filter((p) => p.team === teamName);
    return own.length ? own : projects.filter((p) => p.name === "Internal Operations");
  };

  // ---------- tasks ----------
  const TASK_TEMPLATES: Record<string, string[]> = {
    "STAIL RankOS": [
      "Keyword clustering model v2", "SERP crawler rate-limit handling", "Rank tracking dashboard widgets",
      "Content brief generator prompts", "Backlink graph ingestion", "RankOS onboarding flow polish",
      "Fix duplicate keyword dedupe", "Weekly ranking digest email",
    ],
    "STAIL Realty OS": [
      "Lead assignment API", "Site visit scheduler UI", "WhatsApp lead intake webhook",
      "Broker commission report", "Realty OS listing sync", "Fix login session expiry bug",
      "Property media uploader", "Pipeline kanban drag & drop",
    ],
    "Trinetrix Carbon": [
      "Emission factor database update", "Scope 2 calculation engine", "Carbon report PDF export",
      "Utility bill OCR parsing", "Supplier data import wizard",
    ],
    Viralitea: [
      "Instagram insights connector", "Trend detection pipeline", "Creator outreach CRM list",
      "Campaign performance dashboard", "Short-form hook library",
    ],
    "Internal Operations": [
      "Laptop asset register refresh", "Vendor invoice reconciliation", "Office wifi upgrade",
      "Onboarding checklist automation", "Monthly expense report",
    ],
    "Client — Acme Retail": [
      "Acme store heatmap analysis", "Footfall dashboard mockups", "SKU affinity model",
      "Acme weekly review deck", "POS data pipeline fixes",
    ],
  };
  const STATUS_POOL = ["COMPLETED", "COMPLETED", "COMPLETED", "IN_PROGRESS", "IN_PROGRESS", "TODO", "TODO", "IN_REVIEW", "BLOCKED", "BACKLOG"];
  const PRIORITY_POOL = ["LOW", "MEDIUM", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "CRITICAL"];

  const today = dateKey(new Date());
  const taskTitlesByUser: Record<string, string[]> = {};

  for (const u of Object.values(users)) {
    if (u.role === "FOUNDER") continue;
    const pool = projectsForTeam(u.teamName);
    const n = randInt(4, 8);
    const titles: string[] = [];
    for (let i = 0; i < n; i++) {
      const project = pick(pool);
      const template = pick(TASK_TEMPLATES[project.name]);
      const status = pick(STATUS_POOL);
      const due = addDays(today, randInt(-6, 12));
      const completedOffset = randInt(-20, -1);
      const title = template;
      titles.push(title);
      const creatorId =
        chance(0.6) && u.teamName ? leadByTeam[u.teamName] : chance(0.5) ? (u.teamName ? managerByTeam[u.teamName] : founder.id) : u.id;
      const task = await db.task.create({
        data: {
          title,
          description: chance(0.5)
            ? `Part of ${project.name}. Coordinate with the team and update status as you go.`
            : null,
          assigneeId: u.id,
          creatorId,
          projectId: project.id,
          teamId: u.teamName ? teams[u.teamName].id : null,
          priority: pick(PRIORITY_POOL),
          status,
          dueDate: status === "COMPLETED" ? addDays(today, completedOffset + randInt(0, 4)) : due,
          completedAt: status === "COMPLETED" ? istDate(addDays(today, completedOffset), hm(randInt(14, 19), randInt(0, 59))) : null,
        },
      });
      if (status === "BLOCKED") {
        await db.taskComment.create({
          data: {
            taskId: task.id,
            authorId: u.id,
            body: pick([
              "Blocked — waiting on API credentials from the client.",
              "Blocked on design review, need final specs.",
              "Waiting for staging environment access.",
              "Dependent on the data pipeline fix landing first.",
            ]),
          },
        });
      }
    }
    taskTitlesByUser[u.id] = titles;
  }

  // ---------- leaves (past approved + upcoming pending) ----------
  const leaveWindowStart = addDays(today, -34);
  const leaveDaysByUser: Record<string, Set<string>> = {};
  const allUsers = Object.values(users);
  for (const u of allUsers) {
    leaveDaysByUser[u.id] = new Set();
    if (u.role === "FOUNDER") continue;
    if (chance(0.45)) {
      const start = addDays(leaveWindowStart, randInt(3, 26));
      const len = randInt(1, 2);
      const days = listDates(start, addDays(start, len - 1));
      days.forEach((d) => leaveDaysByUser[u.id].add(d));
      await db.leave.create({
        data: {
          userId: u.id,
          type: pick(["CASUAL", "SICK", "EARNED"]),
          startDate: start,
          endDate: addDays(start, len - 1),
          reason: pick([
            "Family function out of town.",
            "Not feeling well, taking rest.",
            "Personal errand — need the day off.",
            "Travelling home for the weekend.",
          ]),
          status: "APPROVED",
          approverId: u.teamName ? managerByTeam[u.teamName] : founder.id,
          decidedAt: istDate(addDays(start, -2), hm(15, 30)),
        },
      });
    }
  }
  // pending future leave requests
  const pendingLeaveUsers = ["aditi@stail.co.in", "tanvi@stail.co.in", "sahil@stail.co.in"];
  for (const email of pendingLeaveUsers) {
    const start = addDays(today, randInt(3, 10));
    await db.leave.create({
      data: {
        userId: users[email].id,
        type: pick(["CASUAL", "EARNED"]),
        startDate: start,
        endDate: addDays(start, randInt(0, 1)),
        reason: pick([
          "Cousin's wedding — need two days.",
          "Planned family trip.",
          "University convocation ceremony.",
        ]),
        status: "PENDING",
      },
    });
  }

  // ---------- attendance history ----------
  const historyDays = listDates(addDays(today, -34), addDays(today, -1));
  const ACCOMPLISHMENT_VERBS = ["Shipped", "Completed", "Progressed on", "Reviewed", "Debugged", "Finalized"];
  const BLOCKER_TEXTS = [
    "Waiting for API credentials.",
    "Design specs still pending sign-off.",
    "Staging environment was down for two hours.",
    "Need clarification on requirements from the client.",
  ];

  const attendanceRows: {
    userId: string; date: string; clockIn: Date | null; clockOut: Date | null;
    status: string; mode: string; totalMinutes: number | null; breakMinutes: number;
    workSummary: string | null;
  }[] = [];
  const planRows: { userId: string; date: string; priorities: string; deliverables: string | null; submittedAt: Date }[] = [];
  const reportRows: {
    userId: string; date: string; accomplishments: string; pending: string | null;
    blockers: string | null; tomorrowPlan: string | null; submittedAt: Date;
  }[] = [];

  for (const u of allUsers) {
    const myTasks = taskTitlesByUser[u.id] ?? ["planning", "reviews", "hiring"];
    for (const day of historyDays) {
      const dow = dayOfWeek(day);
      if (dow === 0 || dow === 6) {
        attendanceRows.push({ userId: u.id, date: day, clockIn: null, clockOut: null, status: "WEEKEND", mode: "OFFICE", totalMinutes: null, breakMinutes: 0, workSummary: null });
        continue;
      }
      if (holidaySet.has(day)) {
        attendanceRows.push({ userId: u.id, date: day, clockIn: null, clockOut: null, status: "HOLIDAY", mode: "OFFICE", totalMinutes: null, breakMinutes: 0, workSummary: null });
        continue;
      }
      if (leaveDaysByUser[u.id].has(day)) {
        attendanceRows.push({ userId: u.id, date: day, clockIn: null, clockOut: null, status: "LEAVE", mode: "OFFICE", totalMinutes: null, breakMinutes: 0, workSummary: null });
        continue;
      }
      if (chance(0.025)) {
        attendanceRows.push({ userId: u.id, date: day, clockIn: null, clockOut: null, status: "ABSENT", mode: "OFFICE", totalMinutes: null, breakMinutes: 0, workSummary: null });
        continue;
      }

      const late = chance(0.11);
      const inMin = late ? hm(10, randInt(16, 59)) : hm(9, randInt(30, 59)) + (chance(0.5) ? randInt(0, 15) : 0);
      const halfDay = chance(0.02);
      const outMin = halfDay ? hm(14, randInt(0, 45)) : hm(randInt(18, 19), randInt(30, 55));
      const breakMinutes = halfDay ? randInt(0, 20) : randInt(25, 55);
      const total = Math.max(0, outMin - Math.min(inMin, outMin) - breakMinutes);
      const base = inMin <= hm(10, 15) ? "PRESENT" : "LATE";
      const status = total < 4.5 * 60 ? "HALF_DAY" : base;
      const clockIn = istDate(day, inMin);
      const clockOut = istDate(day, outMin);

      attendanceRows.push({
        userId: u.id, date: day, clockIn, clockOut, status,
        mode: chance(0.15) ? "REMOTE" : "OFFICE",
        totalMinutes: total, breakMinutes,
        workSummary: chance(0.6) ? `${pick(ACCOMPLISHMENT_VERBS)} ${pick(myTasks).toLowerCase()}` : null,
      });

      if (u.role !== "FOUNDER") {
        if (chance(0.85)) {
          const prios = Array.from(new Set([pick(myTasks), pick(myTasks), pick(myTasks)])).slice(0, randInt(2, 3));
          planRows.push({
            userId: u.id, date: day,
            priorities: prios.join("\n"),
            deliverables: chance(0.5) ? `Ship: ${prios[0]}` : null,
            submittedAt: istDate(day, inMin + randInt(5, 40)),
          });
        }
        if (chance(0.88) && status !== "HALF_DAY") {
          const done = Array.from(new Set([pick(myTasks), pick(myTasks)]));
          reportRows.push({
            userId: u.id, date: day,
            accomplishments: done.map((t) => `${pick(ACCOMPLISHMENT_VERBS)} ${t.toLowerCase()}`).join("\n"),
            pending: chance(0.5) ? pick(myTasks) : null,
            blockers: chance(0.15) ? pick(BLOCKER_TEXTS) : null,
            tomorrowPlan: chance(0.8) ? pick(myTasks) : null,
            submittedAt: istDate(day, outMin - randInt(5, 25)),
          });
        }
      }
    }
  }

  await db.attendance.createMany({ data: attendanceRows });
  await db.dailyPlan.createMany({ data: planRows });
  await db.dailyReport.createMany({ data: reportRows });

  // ---------- today ----------
  const now = new Date();
  const todayDow = dayOfWeek(today);
  const todayIsWorking = todayDow !== 0 && todayDow !== 6 && !holidaySet.has(today);
  if (todayIsWorking) {
    for (const u of allUsers) {
      const roll = rand();
      if (roll < 0.04) {
        // on leave today
        await db.attendance.create({
          data: { userId: u.id, date: today, status: "LEAVE" },
        });
        await db.leave.create({
          data: {
            userId: u.id, type: "SICK", startDate: today, endDate: today,
            reason: "Down with a fever, taking the day off.",
            status: "APPROVED",
            approverId: u.teamName ? managerByTeam[u.teamName] : founder.id,
            decidedAt: istDate(addDays(today, -1), hm(18, 0)),
          },
        });
        continue;
      }
      if (roll > 0.82) continue; // not clocked in (yet)

      const late = chance(0.12);
      const inMin = late ? hm(10, randInt(16, 50)) : hm(9, randInt(32, 59)) + (chance(0.5) ? randInt(0, 14) : 0);
      const clockIn = istDate(today, inMin);
      if (clockIn > now) continue; // their usual clock-in hasn't arrived yet

      const status = inMin <= hm(10, 15) ? "PRESENT" : "LATE";
      const minutesSinceIn = Math.floor((now.getTime() - clockIn.getTime()) / 60000);
      const onBreak = minutesSinceIn > 90 && chance(0.12);
      const clockedOut = minutesSinceIn > 8.5 * 60 && chance(0.35);
      const breakMinutes = minutesSinceIn > 240 ? randInt(20, 45) : 0;

      const att = await db.attendance.create({
        data: {
          userId: u.id, date: today, clockIn,
          clockOut: clockedOut ? new Date(now.getTime() - randInt(2, 40) * 60000) : null,
          status, mode: chance(0.18) ? "REMOTE" : "OFFICE",
          breakMinutes,
          totalMinutes: clockedOut ? Math.max(0, minutesSinceIn - randInt(2, 40) - breakMinutes) : null,
          clockInIp: "10.0.0." + randInt(2, 250),
          clockInDevice: pick(["Chrome · macOS", "Chrome · Windows", "Safari · iPhone", "Edge · Windows"]),
        },
      });
      if (onBreak && !clockedOut) {
        await db.break.create({
          data: {
            attendanceId: att.id,
            startedAt: new Date(now.getTime() - randInt(5, 35) * 60000),
          },
        });
      }
      if (u.role !== "FOUNDER" && chance(0.8)) {
        const myTasks = taskTitlesByUser[u.id] ?? ["today's priorities"];
        const prios = Array.from(new Set([pick(myTasks), pick(myTasks), pick(myTasks)])).slice(0, randInt(2, 3));
        await db.dailyPlan.create({
          data: {
            userId: u.id, date: today,
            priorities: prios.join("\n"),
            deliverables: chance(0.5) ? `Ship: ${prios[0]}` : null,
            submittedAt: new Date(clockIn.getTime() + randInt(4, 30) * 60000),
          },
        });
      }
    }
  }

  // ---------- corrections ----------
  const pastWorkdays = historyDays.filter((d) => {
    const dow = dayOfWeek(d);
    return dow !== 0 && dow !== 6 && !holidaySet.has(d);
  });
  const correctionDefs = [
    { email: "zoya@stail.co.in", status: "PENDING", reason: "Forgot to clock out before leaving — was in office until 7 PM." },
    { email: "harsh@stail.co.in", status: "PENDING", reason: "Clocked in late because the app wasn't loading on office wifi." },
    { email: "karan@stail.co.in", status: "PENDING", reason: "Worked from home but forgot to clock in; manager was informed." },
    { email: "dev@stail.co.in", status: "APPROVED", reason: "Power cut at home — clocked in from phone an hour late." },
    { email: "ananya@stail.co.in", status: "REJECTED", reason: "Requesting full day for a half day — left early for personal work." },
  ];
  for (const c of correctionDefs) {
    const day = pick(pastWorkdays.slice(-8));
    const decided = c.status !== "PENDING";
    await db.correctionRequest.create({
      data: {
        userId: users[c.email].id,
        date: day,
        requestedClockIn: "09:45",
        requestedClockOut: "19:00",
        reason: c.reason,
        status: c.status,
        reviewerId: decided ? users["priya@stail.co.in"].id : null,
        reviewedAt: decided ? istDate(addDays(day, 1), hm(12, 0)) : null,
        reviewNote: c.status === "REJECTED" ? "Timesheet shows early exit; please apply half-day leave instead." : null,
      },
    });
  }

  // ---------- announcements ----------
  await db.announcement.create({
    data: {
      title: "Realty OS client demo on Friday",
      body: "All hands supporting the Realty OS demo: freeze staging by Thursday 6 PM. Reach out to Nikhil for deploy slots.",
      authorId: founder.id,
      createdAt: istDate(addDays(today, -2), hm(11, 0)),
    },
  });
  await db.announcement.create({
    data: {
      title: "Daily reports now power weekly reviews",
      body: "Your end-of-day reports roll up into the weekly team review automatically. Keep them short and specific — 3 bullets beat 3 paragraphs.",
      authorId: users["priya@stail.co.in"].id,
      createdAt: istDate(addDays(today, -6), hm(16, 30)),
    },
  });

  // ---------- audit trail samples ----------
  await db.auditLog.createMany({
    data: [
      { actorId: users["priya@stail.co.in"].id, actorName: "Priya Menon", action: "policy.update", entity: "Policy", entityId: "default", before: JSON.stringify({ graceMinutes: 10 }), after: JSON.stringify({ graceMinutes: 15 }), createdAt: istDate(addDays(today, -9), hm(14, 12)) },
      { actorId: users["priya@stail.co.in"].id, actorName: "Priya Menon", action: "correction.approve", entity: "CorrectionRequest", createdAt: istDate(addDays(today, -4), hm(12, 3)) },
      { actorId: founder.id, actorName: "Shivansh Rao", action: "announcement.create", entity: "Announcement", createdAt: istDate(addDays(today, -2), hm(11, 0)) },
    ],
  });

  // Re-create the Super Admin root account (wiped above) from env.
  const rootEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const rootPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (rootEmail && rootPassword) {
    await db.user.create({
      data: {
        employeeCode: `STL-${String(code++).padStart(3, "0")}`,
        name: process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin",
        email: rootEmail,
        passwordHash: bcrypt.hashSync(rootPassword, 10),
        role: "SUPER_ADMIN",
        title: "Super Admin",
        status: "ACTIVE",
        joiningDate: istDate("2024-01-01", hm(10, 0)),
        avatarHue: 260,
      },
    });
    console.log(`Restored Super Admin ${rootEmail}.`);
  }

  const counts = {
    users: await db.user.count(),
    teams: await db.team.count(),
    projects: await db.project.count(),
    tasks: await db.task.count(),
    attendance: await db.attendance.count(),
    plans: await db.dailyPlan.count(),
    reports: await db.dailyReport.count(),
    leaves: await db.leave.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
