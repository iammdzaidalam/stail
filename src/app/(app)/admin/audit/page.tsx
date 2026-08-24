import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText, Search } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { dateKey, fmtDateShort, fmtTime, todayIST } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { Input, Select } from "@/components/ui/input";
import { Button, buttonClass } from "@/components/ui/button";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function auditHref(params: { action?: string; entity?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.action) sp.set("action", params.action);
  if (params.entity) sp.set("entity", params.entity);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/admin/audit?${qs}` : "/admin/audit";
}

function JsonCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-ink-faint">—</span>;
  let pretty = value;
  try {
    pretty = JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    // keep raw text when it isn't JSON
  }
  return (
    <details className="group max-w-xs">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="block truncate font-mono text-[11px] text-ink-soft underline-offset-2 group-open:hidden hover:underline">
          {value}
        </span>
        <span className="hidden text-[10px] font-medium uppercase tracking-wide text-ink-faint group-open:block hover:text-ink">
          Collapse
        </span>
      </summary>
      <pre className="mt-1 max-h-56 max-w-xs overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-2/60 p-2.5 font-mono text-[11px] leading-relaxed text-ink-soft">
        {pretty}
      </pre>
    </details>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const actionQ = first(sp.action).trim().slice(0, 100);
  const entityQ = first(sp.entity);
  const pageQ = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);

  const entities = (
    await db.auditLog.findMany({
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    })
  ).map((e) => e.entity);
  const entity = entities.includes(entityQ) ? entityQ : "";

  const where: Prisma.AuditLogWhereInput = {
    ...(actionQ
      ? { action: { contains: actionQ, mode: "insensitive" as const } }
      : {}),
    ...(entity ? { entity } : {}),
  };

  // Midnight IST today, as a UTC timestamp.
  const [y, m, d] = todayIST().split("-").map(Number);
  const istMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0) - 330 * 60000);

  const [total, filtered, todayCount] = await Promise.all([
    db.auditLog.count(),
    db.auditLog.count({ where }),
    db.auditLog.count({ where: { createdAt: { gte: istMidnight } } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered / PAGE_SIZE));
  const page = Math.min(pageQ, totalPages);

  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const hasFilter = Boolean(actionQ || entity);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        description="Every sensitive change — who did what, when, and what it looked like before."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="panel" label="Total events" value={total} sub="since the beginning" />
        <StatCard label="Today" value={todayCount} sub="events so far" />
        <StatCard label="Matching" value={filtered} sub={hasFilter ? "current filters" : "no filters applied"} />
        <StatCard label="Entities" value={entities.length} sub="record types touched" />
      </div>

      <form
        action="/admin/audit"
        method="GET"
        className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center"
      >
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            type="search"
            name="action"
            defaultValue={actionQ}
            placeholder="Filter by action, e.g. people."
            className="pl-10"
            aria-label="Filter by action"
          />
        </div>
        <Select
          name="entity"
          defaultValue={entity}
          className="w-full sm:w-44"
          aria-label="Filter by entity"
        >
          <option value="">All entities</option>
          {entities.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="outline" size="sm">
            Apply
          </Button>
          {hasFilter && (
            <Link href="/admin/audit" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Clear
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-6" />}
          title="No audit events match"
          hint={hasFilter ? "Try a broader action filter or a different entity." : "Sensitive changes will appear here as they happen."}
        />
      ) : (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Before</Th>
                  <Th />
                  <Th>After</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td className="whitespace-nowrap tabular-nums">
                      <span className="font-medium">{fmtDateShort(dateKey(r.createdAt))}</span>
                      <span className="ml-2 text-xs text-ink-faint">{fmtTime(r.createdAt)}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">{r.actorName}</Td>
                    <Td>
                      <span className="font-mono text-xs">{r.action}</span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="text-sm">{r.entity}</span>
                      {r.entityId && (
                        <span
                          title={r.entityId}
                          className="ml-2 inline-block max-w-24 truncate align-middle font-mono text-[11px] text-ink-faint"
                        >
                          {r.entityId}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <JsonCell value={r.before} />
                    </Td>
                    <Td className="px-0 text-ink-faint">→</Td>
                    <Td>
                      <JsonCell value={r.after} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs tabular-nums text-ink-faint">
              Page {page} of {totalPages} · {filtered} events
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={auditHref({ action: actionQ, entity, page: page - 1 })}
                aria-disabled={page <= 1}
                className={cn(
                  buttonClass({ variant: "outline", size: "sm" }),
                  page <= 1 && "pointer-events-none opacity-40",
                )}
              >
                <ChevronLeft className="size-4" />
                Prev
              </Link>
              <Link
                href={auditHref({ action: actionQ, entity, page: page + 1 })}
                aria-disabled={page >= totalPages}
                className={cn(
                  buttonClass({ variant: "outline", size: "sm" }),
                  page >= totalPages && "pointer-events-none opacity-40",
                )}
              >
                Next
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
