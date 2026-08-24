"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from "@/lib/definitions";
import { applyLeave, type LeaveFormState } from "./actions";

export function LeaveForm({
  today,
  minStart,
}: {
  today: string;
  minStart: string;
}) {
  const [state, formAction, pending] = useActionState<LeaveFormState, FormData>(
    applyLeave,
    {},
  );
  const v = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Leave type" htmlFor="leave-type">
        <Select id="leave-type" name="type" defaultValue={v.type ?? "CASUAL"} required>
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>
              {LEAVE_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor="leave-start">
          <Input
            id="leave-start"
            type="date"
            name="startDate"
            min={minStart}
            defaultValue={v.startDate ?? today}
            required
          />
        </Field>
        <Field label="To" htmlFor="leave-end">
          <Input
            id="leave-end"
            type="date"
            name="endDate"
            min={minStart}
            defaultValue={v.endDate ?? today}
            required
          />
        </Field>
      </div>

      <Field
        label="Reason"
        htmlFor="leave-reason"
        hint="Sick leave can be backdated up to 3 days."
      >
        <Textarea
          id="leave-reason"
          name="reason"
          defaultValue={v.reason ?? ""}
          placeholder="A short note for your approver"
          maxLength={2000}
          required
        />
      </Field>

      {state.error && <p className="text-xs text-bad">{state.error}</p>}
      {state.ok && (
        <p className="text-xs text-good">
          Request submitted — the decision will show up in your history.
        </p>
      )}

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
