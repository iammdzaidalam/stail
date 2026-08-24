"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { HOLIDAY_TYPES } from "@/lib/definitions";
import { addHoliday, type HolidayState } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  NATIONAL: "National",
  COMPANY: "Company",
  OPTIONAL: "Optional",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      <Plus className="size-4" />
      {pending ? "Adding…" : "Add holiday"}
    </Button>
  );
}

export function HolidayForm() {
  const [state, formAction] = useActionState<HolidayState, FormData>(addHoliday, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="Date" htmlFor="hl-date">
        <Input id="hl-date" name="date" type="date" required />
      </Field>
      <Field label="Name" htmlFor="hl-name">
        <Input id="hl-name" name="name" required maxLength={120} placeholder="e.g. Diwali" />
      </Field>
      <Field
        label="Type"
        htmlFor="hl-type"
        hint="Optional holidays are announced but attendance is still expected."
      >
        <Select id="hl-type" name="type" defaultValue="COMPANY" required>
          {HOLIDAY_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </Select>
      </Field>

      {state.error && (
        <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p className="rounded-xl bg-good/10 px-4 py-3 text-sm text-good" role="status">
          Holiday added to the calendar.
        </p>
      )}

      <div className="border-t border-line pt-5">
        <SubmitButton />
      </div>
    </form>
  );
}
