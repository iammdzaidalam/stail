"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createProject, type ProjectFormState } from "./actions";

const COLORS = [
  { hue: 80, name: "Lime" },
  { hue: 150, name: "Green" },
  { hue: 200, name: "Blue" },
  { hue: 230, name: "Indigo" },
  { hue: 260, name: "Violet" },
  { hue: 320, name: "Magenta" },
  { hue: 30, name: "Orange" },
  { hue: 0, name: "Red" },
];

export function ProjectForm({
  teams,
}: {
  teams: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ProjectFormState, FormData>(
    createProject,
    {},
  );
  const [hue, setHue] = useState(80);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
        <Field label="Project name" htmlFor="pr-name">
          <Input
            id="pr-name"
            name="name"
            required
            maxLength={100}
            placeholder="STAIL RankOS"
          />
        </Field>
        <Field label="Code" htmlFor="pr-code" hint="Short tag, e.g. RNK">
          <Input
            id="pr-code"
            name="code"
            required
            maxLength={6}
            placeholder="RNK"
            className="uppercase"
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="pr-desc">
        <Textarea
          id="pr-desc"
          name="description"
          maxLength={500}
          placeholder="What is this project about?"
          className="min-h-20"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Owning team" htmlFor="pr-team">
          <Select id="pr-team" name="teamId" defaultValue="">
            <option value="">No team — org-wide</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Color">
          <input type="hidden" name="hue" value={hue} />
          <div className="flex flex-wrap items-center gap-2 pt-1.5">
            {COLORS.map((c) => (
              <button
                key={c.hue}
                type="button"
                aria-label={c.name}
                aria-pressed={hue === c.hue}
                onClick={() => setHue(c.hue)}
                className={cn(
                  "size-7 rounded-full transition",
                  hue === c.hue
                    ? "ring-2 ring-ink ring-offset-2 ring-offset-surface"
                    : "hover:scale-110",
                )}
                style={{ backgroundColor: `hsl(${c.hue} 60% 50%)` }}
              />
            ))}
          </div>
        </Field>
      </div>

      {state.error && <p className="text-xs text-bad">{state.error}</p>}
      <div>
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
