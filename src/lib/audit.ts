import { db } from "./db";

export async function logAudit(opts: {
  actor: { id: string; name: string } | null;
  action: string; // e.g. "attendance.correction.approve"
  entity: string; // e.g. "CorrectionRequest"
  entityId?: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: opts.actor?.id ?? null,
        actorName: opts.actor?.name ?? "system",
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId ?? null,
        before: opts.before === undefined ? null : JSON.stringify(opts.before),
        after: opts.after === undefined ? null : JSON.stringify(opts.after),
      },
    });
  } catch (err) {
    // Auditing must never break the primary action.
    console.error("audit log failed", err);
  }
}
