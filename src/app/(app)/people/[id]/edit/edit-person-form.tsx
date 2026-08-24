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
import { updatePerson, type UpdatePersonState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function EditPersonForm({
  person,
  teams,
  managers,
  roleLocked,
}: {
  person: {
    id: string;
    role: string;
    title: string | null;
    teamId: string | null;
    managerId: string | null;
    employmentType: string;
    status: string;
  };
  teams: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  roleLocked: boolean;
}) {
  const [state, formAction] = useActionState<UpdatePersonState, FormData>(
    updatePerson,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={person.id} />
      {roleLocked && <input type="hidden" name="role" value={person.role} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Role"
          htmlFor="ep-role"
          hint={
            roleLocked
              ? "Only the founder can change the founder's role."
              : "Controls what they can see and approve."
          }
        >
          <Select
            id="ep-role"
            name={roleLocked ? undefined : "role"}
            defaultValue={person.role}
            disabled={roleLocked}
            required
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Job title" htmlFor="ep-title">
          <Input
            id="ep-title"
            name="title"
            maxLength={120}
            defaultValue={person.title ?? ""}
            placeholder="e.g. Product Designer"
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Team" htmlFor="ep-team">
          <Select id="ep-team" name="teamId" defaultValue={person.teamId ?? ""}>
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reports to" htmlFor="ep-manager">
          <Select id="ep-manager" name="managerId" defaultValue={person.managerId ?? ""}>
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
        <Field label="Employment type" htmlFor="ep-type">
          <Select id="ep-type" name="employmentType" defaultValue={person.employmentType} required>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Status"
          htmlFor="ep-status"
          hint="Exited people can no longer sign in."
        >
          <Select id="ep-status" name="status" defaultValue={person.status} required>
            <option value="ACTIVE">Active</option>
            <option value="EXITED">Exited</option>
          </Select>
        </Field>
      </div>

      {state.error && (
        <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <SubmitButton />
        <p className="text-xs text-ink-faint">Changes are recorded in the audit log.</p>
      </div>
    </form>
  );
}
