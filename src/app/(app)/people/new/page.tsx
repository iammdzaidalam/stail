import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { MANAGERIAL_ROLES } from "@/lib/definitions";
import { todayIST } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { NewPersonForm } from "./new-person-form";

export default async function NewPersonPage() {
  await requireUser(["HR", "FOUNDER"]);

  const [teams, managers] = await Promise.all([
    db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { role: { in: [...MANAGERIAL_ROLES] }, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Add person"
        description="Create an account and place them in the org. They can sign in immediately with the temporary password."
        actions={
          <Link href="/people" className={buttonClass({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-4" />
            Back to directory
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="p-6 md:p-8">
          <NewPersonForm teams={teams} managers={managers} today={todayIST()} />
        </Card>

        <PanelCard className="h-fit">
          <CardLabel className="text-panel-ink opacity-60">Onboarding notes</CardLabel>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              Employee codes follow STL-001, STL-002… and are assigned automatically.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              Role decides access: interns and employees see only their own data.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              Every creation is recorded in the audit log.
            </li>
          </ul>
        </PanelCard>
      </div>
    </div>
  );
}
