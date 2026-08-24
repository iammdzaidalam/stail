"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { HOLIDAY_TYPES, type HolidayType } from "@/lib/definitions";

export type HolidayState = { error?: string; ok?: boolean };

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export async function addHoliday(
  _prev: HolidayState,
  formData: FormData,
): Promise<HolidayState> {
  const actor = await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);

  const date = String(formData.get("date") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const type = String(formData.get("type") ?? "");

  if (!DATE_RE.test(date)) return { error: "Choose a valid date (YYYY-MM-DD)." };
  if (!name) return { error: "Give the holiday a name." };
  if (!HOLIDAY_TYPES.includes(type as HolidayType)) {
    return { error: "Choose a valid holiday type." };
  }

  const existing = await db.holiday.findUnique({ where: { date } });
  if (existing) {
    return { error: `${existing.name} is already marked on that date.` };
  }

  const created = await db.holiday.create({ data: { date, name, type } });

  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "holiday.create",
    entity: "Holiday",
    entityId: created.id,
    after: { date, name, type },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Plain form action for the inline delete button. */
export async function deleteHoliday(formData: FormData): Promise<void> {
  const actor = await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);

  const id = String(formData.get("id") ?? "");
  const holiday = await db.holiday.findUnique({ where: { id } });
  if (!holiday) return;

  await db.holiday.delete({ where: { id } });

  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "holiday.delete",
    entity: "Holiday",
    entityId: holiday.id,
    before: { date: holiday.date, name: holiday.name, type: holiday.type },
  });

  revalidatePath("/", "layout");
}
