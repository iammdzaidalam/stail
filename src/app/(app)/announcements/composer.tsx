"use client";

import { useActionState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { postAnnouncement, type AnnouncementState } from "./actions";

export function AnnouncementComposer() {
  const [state, formAction, pending] = useActionState<AnnouncementState, FormData>(
    postAnnouncement,
    {},
  );

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2.5">
        <Megaphone className="size-4 text-ink-faint" />
        <h2 className="text-base font-semibold tracking-tight">
          Post an announcement
        </h2>
      </div>
      {/* key resets the form after a successful post */}
      <form action={formAction} key={state.ok ? "posted" : "editing"} className="flex flex-col gap-4">
        <Field label="Title" htmlFor="announcement-title">
          <Input
            id="announcement-title"
            name="title"
            maxLength={140}
            placeholder="Realty OS client demo on Friday"
            required
          />
        </Field>
        <Field
          label="Announcement"
          htmlFor="announcement-body"
          hint="Everyone sees this — on their dashboard, in notifications, and here."
        >
          <Textarea
            id="announcement-body"
            name="body"
            maxLength={4000}
            placeholder="What does the team need to know?"
            required
          />
        </Field>
        {state.error && <p className="text-xs text-bad">{state.error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? "Posting…" : "Post announcement"}
          </Button>
          {state.ok && (
            <p className="text-xs text-good">Posted — it&apos;s live for everyone.</p>
          )}
        </div>
      </form>
    </Card>
  );
}
