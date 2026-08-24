"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getPolicy } from "@/lib/attendance";
import { logAudit } from "@/lib/audit";
import { hmToMinutes } from "@/lib/time";

export type PolicyState = { error?: string; ok?: boolean };

const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function updatePolicy(
  _prev: PolicyState,
  formData: FormData,
): Promise<PolicyState> {
  const actor = await requireUser(["HR", "FOUNDER"]);

  const workStart = String(formData.get("workStart") ?? "");
  const workEnd = String(formData.get("workEnd") ?? "");
  const graceRaw = String(formData.get("graceMinutes") ?? "").trim();
  const halfRaw = String(formData.get("halfDayThresholdHours") ?? "").trim();
  const fullRaw = String(formData.get("fullDayHours") ?? "").trim();
  const graceMinutes = graceRaw === "" ? NaN : Number(graceRaw);
  const halfDayThresholdHours = halfRaw === "" ? NaN : Number(halfRaw);
  const fullDayHours = fullRaw === "" ? NaN : Number(fullRaw);
  const weekendDays = formData
    .getAll("weekend")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);

  if (!HM_RE.test(workStart) || !HM_RE.test(workEnd)) {
    return { error: "Work hours must be valid HH:mm times." };
  }
  if (hmToMinutes(workStart) >= hmToMinutes(workEnd)) {
    return { error: "Work start must be before work end." };
  }
  if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 120) {
    return { error: "Grace period must be a whole number between 0 and 120 minutes." };
  }
  if (
    !Number.isFinite(halfDayThresholdHours) ||
    halfDayThresholdHours < 1 ||
    halfDayThresholdHours > 12
  ) {
    return { error: "Half-day threshold must be between 1 and 12 hours." };
  }
  if (!Number.isFinite(fullDayHours) || fullDayHours < 1 || fullDayHours > 16) {
    return { error: "Full-day hours must be between 1 and 16." };
  }
  if (halfDayThresholdHours >= fullDayHours) {
    return { error: "Half-day threshold must be lower than full-day hours." };
  }
  const uniqueWeekend = [...new Set(weekendDays)];
  if (uniqueWeekend.length >= 7) {
    return { error: "At least one day of the week must be a working day." };
  }

  const before = await getPolicy();
  const after = {
    workStart,
    workEnd,
    graceMinutes,
    halfDayThresholdHours,
    fullDayHours,
    weekendDays: uniqueWeekend.join(","),
  };

  await db.policy.update({ where: { id: "default" }, data: after });

  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "policy.update",
    entity: "Policy",
    entityId: "default",
    before: {
      workStart: before.workStart,
      workEnd: before.workEnd,
      graceMinutes: before.graceMinutes,
      halfDayThresholdHours: before.halfDayThresholdHours,
      fullDayHours: before.fullDayHours,
      weekendDays: before.weekendDays,
    },
    after,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
