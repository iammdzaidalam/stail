import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { MANAGERIAL_ROLES } from "@/lib/definitions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EditPersonForm } from "./edit-person-form";

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);
  const { id } = await params;

  const person = await db.user.findUnique({ where: { id } });
  if (!person) notFound();

  const [teams, managers] = await Promise.all([
    db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: {
        role: { in: [...MANAGERIAL_ROLES] },
        status: "ACTIVE",
        NOT: { id: person.id },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const roleLocked = person.role === "SUPER_ADMIN" && viewer.id !== person.id;

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={person.name} hue={person.avatarHue} size="lg" />
            {person.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-faint">{person.employeeCode}</span>
            <StatusBadge status={person.status} />
          </span>
        }
        actions={
          <Link
            href={`/people/${person.id}`}
            className={buttonClass({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="size-4" />
            Back to profile
          </Link>
        }
      />

      <Card className="max-w-3xl p-6 md:p-8">
        <EditPersonForm
          person={{
            id: person.id,
            role: person.role,
            title: person.title,
            teamId: person.teamId,
            managerId: person.managerId,
            employmentType: person.employmentType,
            status: person.status,
          }}
          teams={teams}
          managers={managers}
          roleLocked={roleLocked}
        />
      </Card>
    </div>
  );
}
