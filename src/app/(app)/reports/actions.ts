"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { todayIST } from "@/lib/time";

export type ReportActionState = { error?: string; ok?: boolean };

const MAX_LEN = 2000;

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Upsert the current user's daily report for todayIST(). The date is fixed
 * server-side — arbitrary dates are never accepted from the client. The
 * original submittedAt is preserved on updates.
 */
export async function submitReport(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();
  const date = todayIST();

  const accomplishments = clean(formData.get("accomplishments"));
  const pending = clean(formData.get("pending"));
  const blockers = clean(formData.get("blockers"));
  const tomorrowPlan = clean(formData.get("tomorrowPlan"));
  const notes = clean(formData.get("notes"));

  if (!accomplishments) {
    return { error: "Please describe what you accomplished today — it’s required." };
  }
  const fields: [string, string][] = [
    ["Accomplishments", accomplishments],
    ["Pending", pending],
    ["Blockers", blockers],
    ["Tomorrow’s plan", tomorrowPlan],
    ["Notes", notes],
  ];
  for (const [label, value] of fields) {
    if (value.length > MAX_LEN) {
      return { error: `${label} is too long (max ${MAX_LEN} characters).` };
    }
  }

  const existing = await db.dailyReport.findUnique({
    where: { userId_date: { userId: user.id, date } },
  });

  const data = {
    accomplishments,
    pending: pending || null,
    blockers: blockers || null,
    tomorrowPlan: tomorrowPlan || null,
    notes: notes || null,
  };

  const saved = await db.dailyReport.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, ...data }, // submittedAt defaults to now()
    update: data, // submittedAt untouched — first submit time is kept
  });

  await logAudit({
    actor: { id: user.id, name: user.name },
    action: existing ? "report.update" : "report.submit",
    entity: "DailyReport",
    entityId: saved.id,
    before: existing
      ? {
          accomplishments: existing.accomplishments,
          pending: existing.pending,
          blockers: existing.blockers,
          tomorrowPlan: existing.tomorrowPlan,
          notes: existing.notes,
        }
      : undefined,
    after: data,
  });

  revalidatePath("/", "layout");
  redirect("/reports");
}
