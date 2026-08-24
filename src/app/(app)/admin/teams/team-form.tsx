"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { createTeam, updateTeam, type TeamFormState } from "./actions";

type PersonOption = { id: string; name: string; title: string | null };

export function TeamForm({
  team,
  people,
}: {
  /** Omit for the create form. */
  team?: {
    id: string;
    name: string;
    department: string;
    leadId: string | null;
    managerId: string | null;
  };
  people: PersonOption[];
}) {
  const action = team ? updateTeam : createTeam;
  const [state, formAction, pending] = useActionState<TeamFormState, FormData>(
    action,
    {},
  );

  return (
    <form
      action={formAction}
      key={!team && state.ok ? "created" : "editing"}
      className="flex flex-col gap-4"
    >
      {team && <input type="hidden" name="id" value={team.id} />}
      <Field label="Team name" htmlFor="team-name">
        <Input
          id="team-name"
          name="name"
          required
          maxLength={80}
          defaultValue={team?.name}
          placeholder="AI Engineering"
        />
      </Field>
      <Field label="Department" htmlFor="team-department">
        <Input
          id="team-department"
          name="department"
          required
          maxLength={80}
          defaultValue={team?.department}
          placeholder="Engineering"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Team lead"
          htmlFor="team-lead"
          hint="Sees the team dashboards and approves requests."
        >
          <Select id="team-lead" name="leadId" defaultValue={team?.leadId ?? ""}>
            <option value="">No lead yet</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.title ? ` — ${p.title}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Manager" htmlFor="team-manager">
          <Select
            id="team-manager"
            name="managerId"
            defaultValue={team?.managerId ?? ""}
          >
            <option value="">No manager yet</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.title ? ` — ${p.title}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {state.error && <p className="text-xs text-bad">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant={team ? "primary" : "accent"} disabled={pending}>
          {pending ? "Saving…" : team ? "Save changes" : "Create team"}
        </Button>
        {state.ok && (
          <p className="text-xs text-good">
            {team ? "Saved." : "Team created."}
          </p>
        )}
      </div>
    </form>
  );
}
