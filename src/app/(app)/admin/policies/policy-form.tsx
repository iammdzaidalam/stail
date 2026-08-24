"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { hmToMinutes, minutesToLabel } from "@/lib/time";
import { updatePolicy, type PolicyState } from "./actions";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? "Saving…" : "Save policy"}
    </Button>
  );
}

export function PolicyForm({
  policy,
}: {
  policy: {
    workStart: string;
    workEnd: string;
    graceMinutes: number;
    halfDayThresholdHours: number;
    fullDayHours: number;
    weekendDays: string;
  };
}) {
  const [state, formAction] = useActionState<PolicyState, FormData>(updatePolicy, {});
  const [workStart, setWorkStart] = useState(policy.workStart);
  const [grace, setGrace] = useState(policy.graceMinutes);

  const weekendSet = new Set(
    policy.weekendDays.split(",").map((s) => Number(s.trim())),
  );

  // Live example computed from the values currently in the form.
  const startMins = /^\d{2}:\d{2}$/.test(workStart) ? hmToMinutes(workStart) : null;
  const graceOk = Number.isFinite(grace) && grace >= 0;
  const example =
    startMins !== null && graceOk
      ? `Clock-in at ${minutesToLabel(startMins + Math.max(0, Math.min(grace, 120)) - 3)} → Present · ${minutesToLabel(startMins + Math.max(0, Math.min(grace, 120)) + 10)} → Late`
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Work start"
          htmlFor="pl-start"
          hint="Official start of the workday (IST)."
        >
          <Input
            id="pl-start"
            name="workStart"
            type="time"
            required
            value={workStart}
            onChange={(e) => setWorkStart(e.target.value)}
          />
        </Field>
        <Field label="Work end" htmlFor="pl-end" hint="Official end of the workday (IST).">
          <Input id="pl-end" name="workEnd" type="time" required defaultValue={policy.workEnd} />
        </Field>
      </div>

      <Field
        label="Grace period (minutes)"
        htmlFor="pl-grace"
        hint={example ? `0–120. ${example}` : "0–120 minutes after work start before a clock-in counts as late."}
      >
        <Input
          id="pl-grace"
          name="graceMinutes"
          type="number"
          min={0}
          max={120}
          step={1}
          required
          value={Number.isFinite(grace) ? grace : ""}
          onChange={(e) => setGrace(e.target.valueAsNumber)}
          className="sm:max-w-48"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Half-day threshold (hours)"
          htmlFor="pl-half"
          hint="Working less than this marks the day as a half day."
        >
          <Input
            id="pl-half"
            name="halfDayThresholdHours"
            type="number"
            min={1}
            max={12}
            step={0.5}
            required
            defaultValue={policy.halfDayThresholdHours}
          />
        </Field>
        <Field
          label="Full-day hours"
          htmlFor="pl-full"
          hint="Expected working hours in a complete day."
        >
          <Input
            id="pl-full"
            name="fullDayHours"
            type="number"
            min={1}
            max={16}
            step={0.5}
            required
            defaultValue={policy.fullDayHours}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Weekend days
        </span>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, i) => (
            <label
              key={label}
              className="cursor-pointer select-none rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition hover:border-line-strong has-checked:border-ink has-checked:bg-ink has-checked:text-bg"
            >
              <input
                type="checkbox"
                name="weekend"
                value={i}
                defaultChecked={weekendSet.has(i)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-faint">
          Checked days count as weekend — no attendance is expected on them.
        </p>
      </div>

      {state.error && (
        <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p className="rounded-xl bg-good/10 px-4 py-3 text-sm text-good" role="status">
          Policy saved. Changes apply from the next clock-in.
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <SubmitButton />
        <p className="text-xs text-ink-faint">
          Changes apply from the next clock-in — past days are never recalculated.
        </p>
      </div>
    </form>
  );
}
