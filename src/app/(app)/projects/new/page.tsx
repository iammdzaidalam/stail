import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { ProjectForm } from "./project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requireUser(["MANAGER", "HR", "FOUNDER", "SUPER_ADMIN"]);
  const teams = await db.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Company"
        title="New project"
        description="Projects group tasks and show up in workload intelligence across the org."
        actions={
          <Link href="/projects" className={buttonClass({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-4" /> All projects
          </Link>
        }
      />
      <Card className="max-w-2xl p-6 md:p-8">
        <ProjectForm teams={teams} />
      </Card>
    </div>
  );
}
