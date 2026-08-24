"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export type AnnouncementState = { error?: string; ok?: boolean };

export async function postAnnouncement(
  _prev: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  const user = await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);

  const title = String(formData.get("title") ?? "").trim().slice(0, 140);
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (!title) return { error: "Give the announcement a title." };
  if (!body) return { error: "Write the announcement itself." };

  const announcement = await db.announcement.create({
    data: { title, body, authorId: user.id },
  });
  await logAudit({
    actor: { id: user.id, name: user.name },
    action: "announcement.create",
    entity: "Announcement",
    entityId: announcement.id,
    after: { title },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  const user = await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) return;

  await db.announcement.delete({ where: { id } });
  await logAudit({
    actor: { id: user.id, name: user.name },
    action: "announcement.delete",
    entity: "Announcement",
    entityId: id,
    before: { title: existing.title },
  });
  revalidatePath("/", "layout");
}
