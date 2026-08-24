"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  ROLES,
  ROLE_LABELS,
} from "@/lib/definitions";
import { createPerson, type CreatePersonState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? "Creating…" : "Create person"}
    </Button>
  );
}

export function NewPersonForm({
  teams,
  managers,
  today,
}: {
  teams: { id: string; name: string }[];
  managers: { id: string; name: string; role: string }[];
  today: string;
}) {
  const [state, formAction] = useActionState<CreatePersonState, FormData>(
    createPerson,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="np-name">
          <Input id="np-name" name="name" required maxLength={120} placeholder="e.g. Ananya Iyer" />
        </Field>
        <Field label="Work email" htmlFor="np-email">
          <Input
            id="np-email"
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder="name@stail.ai"
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Temporary password"
          htmlFor="np-password"
          hint="Minimum 8 characters — share it privately; they can change it later."
        >
          <Input
            id="np-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Job title" htmlFor="np-title">
          <Input id="np-title" name="title" maxLength={120} placeholder="e.g. Product Designer" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Role" htmlFor="np-role" hint="Controls what they can see and approve.">
          <Select id="np-role" name="role" defaultValue="EMPLOYEE" required>
            {ROLES.filter((r) => r !== "SUPER_ADMIN").map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Employment type" htmlFor="np-type">
          <Select id="np-type" name="employmentType" defaultValue="FULL_TIME" required>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Team" htmlFor="np-team">
          <Select id="np-team" name="teamId" defaultValue="">
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reports to" htmlFor="np-manager">
          <Select id="np-manager" name="managerId" defaultValue="">
            <option value="">No manager</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Joining date" htmlFor="np-joined">
          <Input id="np-joined" name="joiningDate" type="date" defaultValue={today} required />
        </Field>
      </div>

      {state.error && (
        <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <SubmitButton />
        <p className="text-xs text-ink-faint">
          An employee code is assigned automatically on creation.
        </p>
      </div>
    </form>
  );
}
