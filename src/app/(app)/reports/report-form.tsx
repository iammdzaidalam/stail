"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { submitReport, type ReportActionState } from "./actions";

const initialState: ReportActionState = {};

export type ReportFormDefaults = {
  accomplishments: string;
  pending: string;
  blockers: string;
  tomorrowPlan: string;
  notes: string;
};

export function ReportForm({
  defaults,
  mode,
}: {
  defaults: ReportFormDefaults;
  mode: "create" | "update";
}) {
  const [state, formAction, pending] = useActionState(submitReport, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field
        label="What did you accomplish today?"
        htmlFor="accomplishments"
        hint="One item per line — prefilled from tasks you completed today."
      >
        <Textarea
          id="accomplishments"
          name="accomplishments"
          required
          rows={5}
          maxLength={2000}
          defaultValue={defaults.accomplishments}
          placeholder={"- Shipped the onboarding email flow\n- Reviewed the pricing page copy"}
        />
      </Field>

      <Field
        label="What remains pending?"
        htmlFor="pending"
        hint="Prefilled from your in-progress and blocked tasks."
      >
        <Textarea
          id="pending"
          name="pending"
          rows={3}
          maxLength={2000}
          defaultValue={defaults.pending}
          placeholder="- Carry-over items for tomorrow"
        />
      </Field>

      <Field label="What blocked you?" htmlFor="blockers" hint="Optional.">
        <Textarea
          id="blockers"
          name="blockers"
          rows={2}
          maxLength={2000}
          defaultValue={defaults.blockers}
          placeholder="- Waiting on API access from the platform team"
        />
      </Field>

      <Field label="Tomorrow’s plan" htmlFor="tomorrowPlan">
        <Textarea
          id="tomorrowPlan"
          name="tomorrowPlan"
          rows={3}
          maxLength={2000}
          defaultValue={defaults.tomorrowPlan}
          placeholder="- First priority for tomorrow"
        />
      </Field>

      <Field label="Notes" htmlFor="notes" hint="Optional — anything else worth flagging.">
        <Input
          id="notes"
          name="notes"
          maxLength={2000}
          defaultValue={defaults.notes}
          placeholder="e.g. Leaving early on Friday"
        />
      </Field>

      {state.error && <p className="text-xs text-bad">{state.error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "update"
              ? "Update report"
              : "Submit report"}
        </Button>
        {mode === "update" && (
          <Link
            href="/reports"
            className="text-xs font-medium text-ink-soft underline-offset-4 hover:underline"
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
