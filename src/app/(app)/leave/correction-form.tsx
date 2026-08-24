"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { requestCorrection, type CorrectionFormState } from "./actions";

export function CorrectionForm({
  defaultDate,
  minDate,
  maxDate,
}: {
  defaultDate: string;
  minDate: string;
  maxDate: string;
}) {
  const [state, formAction, pending] = useActionState<CorrectionFormState, FormData>(
    requestCorrection,
    {},
  );
  const v = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Date"
        htmlFor="correction-date"
        hint="Past days only, up to 30 days back."
      >
        <Input
          id="correction-date"
          type="date"
          name="date"
          min={minDate}
          max={maxDate}
          defaultValue={v.date ?? defaultDate}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Clock-in" htmlFor="correction-in">
          <Input
            id="correction-in"
            type="time"
            name="clockIn"
            defaultValue={v.clockIn ?? ""}
          />
        </Field>
        <Field label="Clock-out" htmlFor="correction-out">
          <Input
            id="correction-out"
            type="time"
            name="clockOut"
            defaultValue={v.clockOut ?? ""}
          />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-ink-faint">
        Fill at least one — leave the other empty to keep what is recorded.
      </p>

      <Field label="Reason" htmlFor="correction-reason">
        <Textarea
          id="correction-reason"
          name="reason"
          defaultValue={v.reason ?? ""}
          placeholder="What happened? e.g. forgot to clock out after the standup"
          maxLength={2000}
          required
        />
      </Field>

      {state.error && <p className="text-xs text-bad">{state.error}</p>}
      {state.ok && (
        <p className="text-xs text-good">
          Correction sent for review — you can track it in the list.
        </p>
      )}

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Submitting…" : "Request correction"}
      </Button>
    </form>
  );
}
