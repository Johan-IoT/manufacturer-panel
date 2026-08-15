import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Cpu, LifeBuoy, Link2, Radar, ShieldCheck, Wrench } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/cards";
import { ErrorState, LoadingState } from "@/components/app/states";
import { Pill, RelationshipBadge } from "@/components/app/badges";
import { dashboardService } from "@/services";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Manufacturer Panel | GSM Systems" },
      {
        name: "description",
        content: "Operational overview of devices, device types, installers, relationships, support and notifications.",
      },
      { property: "og:title", content: "Dashboard — Manufacturer Panel" },
      { property: "og:description", content: "Operational overview of the GSM Systems BLE device fleet." },
    ],
  }),
  component: DashboardPage,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-muted-foreground)",
];

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-panel">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardService.summary(),
  });

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="Operational overview of the GSM Systems BLE device ecosystem. All figures come from the authoritative backend."
        breadcrumbs={[{ label: "Manufacturer Panel" }, { label: "Dashboard" }]}
      />

      {isLoading ? (
        <div className="rounded-lg border border-border bg-surface">
          <LoadingState label="Loading operational summary" />
        </div>
      ) : isError || !data ? (
        <div className="rounded-lg border border-border bg-surface">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Devices" value={data.totalDevices} icon={Cpu} accent />
            <StatCard label="Active Devices" value={data.activeDevices} icon={ShieldCheck} />
            <StatCard label="Device Types" value={data.deviceTypes} icon={Radar} hint="Active types only" />
            <StatCard label="Installers" value={data.installers} icon={Wrench} />
            <StatCard label="Active Device Relationships" value={data.activeRelationships} icon={Link2} />
            <StatCard label="Open Support Threads" value={data.openSupportThreads} icon={LifeBuoy} />
            <StatCard label="Unread Notifications" value={data.pendingNotifications} icon={Bell} />
            <StatCard
              label="Decommissioned"
              value={data.statusBreakdown.find((s) => s.status === "Decommissioned")?.count ?? 0}
              icon={Cpu}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Device status breakdown">
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-44 w-full sm:w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.statusBreakdown}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={44}
                        outerRadius={68}
                        paddingAngle={2}
                        stroke="var(--color-surface)"
                      >
                        {data.statusBreakdown.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-popover)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex-1 space-y-1.5 text-sm">
                  {data.statusBreakdown.map((s, i) => (
                    <li key={s.status} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        {s.status}
                      </span>
                      <span className="tabular-nums text-foreground">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>

            <Panel
              title="Recent device registrations"
              action={
                <Link to="/devices" className="text-xs text-primary hover:underline">
                  View devices
                </Link>
              }
            >
              <ul className="space-y-3">
                {data.recentRegistrations.map((r) => (
                  <li key={r.serial} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/devices/$serial"
                        params={{ serial: r.serial }}
                        className="block truncate font-mono text-xs text-foreground hover:text-primary"
                      >
                        {r.serial}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{r.name}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(r.at)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Recent claims (Owner links)">
              <ul className="space-y-3">
                {data.recentClaims.map((c, i) => (
                  <li key={`${c.serial}-${i}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{c.user}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{c.serial}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(c.at)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Recent relationship changes"
              action={
                <Link to="/relationships" className="text-xs text-primary hover:underline">
                  Manage relationships
                </Link>
              }
            >
              <ul className="space-y-3">
                {data.recentRelationshipChanges.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <RelationshipBadge linkType={c.linkType as never} />
                      <span className="truncate text-sm text-foreground">{c.user}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">{c.serial}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={c.action === "Granted" ? "success" : "danger"}>{c.action}</Pill>
                      <span className="text-xs text-muted-foreground">{relativeTime(c.at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Support & notifications snapshot">
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  to="/support"
                  className="rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-primary/40"
                >
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Support threads needing attention</p>
                  <p className="mt-2 font-display text-2xl text-foreground">{data.openSupportThreads}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Open or in progress</p>
                </Link>
                <Link
                  to="/notifications"
                  className="rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-primary/40"
                >
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Unread user notifications</p>
                  <p className="mt-2 font-display text-2xl text-foreground">{data.pendingNotifications}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Read state is separate from delivery state</p>
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
