import { requireUser } from "@/lib/session";
import { getPolicy, weekendDaySet } from "@/lib/attendance";
import { hmToMinutes, minutesToLabel } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { Card, PanelCard } from "@/components/ui/card";
import { PolicyForm } from "./policy-form";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function PanelStat({
  label,
  value,
  sub,
  compact,
}: {
  label: string;
  value: string;
  sub?: string;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">{label}</p>
      <p
        className={
          compact
            ? "mt-2.5 text-lg font-semibold tracking-tight tabular-nums md:text-xl"
            : "mt-2 text-2xl font-semibold tracking-tighter tabular-nums md:text-3xl"
        }
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

export default async function PoliciesPage() {
  await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);
  const policy = await getPolicy();

  const weekend = [...weekendDaySet(policy)].sort((a, b) => a - b);
  const weekendLabel =
    weekend.length > 0 ? weekend.map((d) => DAY_LABELS[d]).join(" · ") : "None";
  const lateAfter = minutesToLabel(hmToMinutes(policy.workStart) + policy.graceMinutes);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Attendance policy"
        description="The single org-wide policy that decides late marks, half days and weekends. Changes apply from the next clock-in."
      />

      <PanelCard className="mb-6 p-6 md:p-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <PanelStat
            label="Workday"
            value={`${minutesToLabel(hmToMinutes(policy.workStart))} – ${minutesToLabel(hmToMinutes(policy.workEnd))}`}
            sub="official hours, IST"
            compact
          />
          <PanelStat
            label="Late after"
            value={lateAfter}
            sub={`${policy.graceMinutes} min grace on ${minutesToLabel(hmToMinutes(policy.workStart))}`}
            compact
          />
          <PanelStat
            label="Full day"
            value={`${policy.fullDayHours}h`}
            sub={`half day under ${policy.halfDayThresholdHours}h`}
          />
          <PanelStat label="Weekend" value={weekendLabel} sub="no attendance expected" compact />
        </div>
      </PanelCard>

      <Card className="max-w-3xl p-6 md:p-8">
        <PolicyForm
          policy={{
            workStart: policy.workStart,
            workEnd: policy.workEnd,
            graceMinutes: policy.graceMinutes,
            halfDayThresholdHours: policy.halfDayThresholdHours,
            fullDayHours: policy.fullDayHours,
            weekendDays: policy.weekendDays,
          }}
        />
      </Card>
    </div>
  );
}
