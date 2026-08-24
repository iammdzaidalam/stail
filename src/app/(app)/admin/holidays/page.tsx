import Link from "next/link";
import { CalendarRange, Check, Trash2, X } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { fmtDateFull, fmtWeekday, keyToDate, todayIST } from "@/lib/time";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { buttonClass } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { HolidayForm } from "./holiday-form";
import { deleteHoliday } from "./actions";


export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const confirmId = typeof sp.confirm === "string" ? sp.confirm : null;

  const holidays = await db.holiday.findMany({ orderBy: { date: "asc" } });
  const today = todayIST();
  const next = holidays.find((h) => h.date >= today);
  const daysToNext = next
    ? Math.round(
        (keyToDate(next.date).getTime() - keyToDate(today).getTime()) / 86400000,
      )
    : null;
  const upcomingCount = holidays.filter((h) => h.date >= today).length;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Holidays"
        description="The company holiday calendar. Holidays are excluded from working days and attendance expectations."
      />

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <PanelCard className="p-6 md:p-8">
            <CardLabel className="text-panel-ink opacity-60">Next holiday</CardLabel>
            {next ? (
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-semibold tracking-tighter md:text-4xl">
                    {next.name}
                  </p>
                  <p className="mt-1.5 text-sm opacity-60">
                    {fmtWeekday(next.date)}, {fmtDateFull(next.date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
                    {daysToNext === 0 ? "Today" : daysToNext}
                  </p>
                  {daysToNext !== 0 && (
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] opacity-60">
                      {daysToNext === 1 ? "day away" : "days away"}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm opacity-60">
                No upcoming holidays on the calendar.
              </p>
            )}
            <p className="mt-5 border-t border-panel-line pt-4 text-xs opacity-60">
              {upcomingCount} upcoming · {holidays.length} total on the calendar
            </p>
          </PanelCard>

          {holidays.length === 0 ? (
            <EmptyState
              icon={<CalendarRange className="size-6" />}
              title="No holidays yet"
              hint="Add the first holiday with the form on the right."
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Holiday</Th>
                    <Th>Type</Th>
                    <Th className="w-12 text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => {
                    const past = h.date < today;
                    return (
                      <Tr key={h.id} className={past ? "opacity-50" : undefined}>
                        <Td className="whitespace-nowrap">
                          <span className="font-medium tabular-nums">
                            {fmtDateFull(h.date)}
                          </span>
                          <span className="ml-2 text-xs text-ink-faint">
                            {fmtWeekday(h.date)}
                          </span>
                        </Td>
                        <Td>
                          <span className="font-medium tracking-tight">{h.name}</span>
                          {next?.id === h.id && (
                            <Badge tone="accent" className="ml-2">
                              Next
                            </Badge>
                          )}
                        </Td>
                        <Td>
                          <StatusBadge status={h.type} />
                        </Td>
                        <Td className="text-right">
                          {confirmId === h.id ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                              <span className="text-xs text-bad">Delete?</span>
                              <form action={deleteHoliday} className="inline-block">
                                <input type="hidden" name="id" value={h.id} />
                                <SubmitButton
                                  variant="danger"
                                  size="sm"
                                  aria-label={`Confirm delete ${h.name}`}
                                >
                                  <Check className="size-3.5" /> Yes
                                </SubmitButton>
                              </form>
                              <Link
                                href="/admin/holidays"
                                aria-label="Cancel delete"
                                className={buttonClass({ variant: "outline", size: "sm" })}
                              >
                                <X className="size-3.5" /> No
                              </Link>
                            </span>
                          ) : (
                            <Link
                              href={`/admin/holidays?confirm=${h.id}`}
                              aria-label={`Delete ${h.name}`}
                              className={buttonClass({
                                variant: "ghost",
                                size: "icon",
                                className: "size-8 text-ink-faint hover:text-bad",
                              })}
                            >
                              <Trash2 className="size-4" />
                            </Link>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </div>

        <Card className="p-6">
          <SectionTitle title="Add holiday" className="mb-5" />
          <HolidayForm />
        </Card>
      </div>
    </div>
  );
}
