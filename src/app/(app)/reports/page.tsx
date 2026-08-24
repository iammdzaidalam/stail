import { PageHeader } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { requireUser } from "@/lib/session";
import { fmtDateLong, todayIST } from "@/lib/time";
import { HistoryTab } from "./history-tab";
import { TodayTab } from "./today-tab";
import { WeeklyTab } from "./weekly-tab";

const TABS = ["today", "history", "weekly"] as const;
type Tab = (typeof TABS)[number];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const tabParam = typeof sp.tab === "string" ? sp.tab : "today";
  const tab: Tab = (TABS as readonly string[]).includes(tabParam)
    ? (tabParam as Tab)
    : "today";
  const edit = sp.edit === "1";
  const week = typeof sp.week === "string" ? sp.week : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Reporting"
        title="Daily Reports"
        description={`End-of-day and weekly reporting · ${fmtDateLong(todayIST())}`}
      />

      <LinkTabs
        className="mb-6"
        tabs={[
          { href: "/reports", label: "Today", active: tab === "today" },
          {
            href: "/reports?tab=history",
            label: "History",
            active: tab === "history",
          },
          {
            href: "/reports?tab=weekly",
            label: "Weekly",
            active: tab === "weekly",
          },
        ]}
      />

      {tab === "today" && <TodayTab user={user} edit={edit} />}
      {tab === "history" && <HistoryTab user={user} />}
      {tab === "weekly" && <WeeklyTab user={user} week={week} />}
    </div>
  );
}
