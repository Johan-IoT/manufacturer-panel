import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Cpu, LifeBuoy, Link2, Radar, ShieldCheck, Wrench } from "lucide-react";
import { DeviceStatusPie3D, RegistrationTrendAreaChart } from "@/components/app/dashboard-charts";
import { AsyncPageContent, AnimatedStagger } from "@/components/app/page-layout";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/cards";
import { Pill, RelationshipBadge } from "@/components/app/badges";
import { dashboardService } from "@/services";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard | Manufacturer Panel | ConfigGate" },
      {
        name: "description",
        content: "Operational overview of devices, device types, installers, relationships, support and notifications.",
      },
      { property: "og:title", content: "Dashboard | Manufacturer Panel" },
      { property: "og:description", content: "Operational overview of the ConfigGate BLE device fleet." },
    ],
  }),
  component: DashboardPage,
});

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-none">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DashboardPage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardService.summary(),
  });

  return (
    <AppShell>
      <PageHeader title="Dashboard" breadcrumbs={[{ label: "Manufacturer Panel" }, { label: "Dashboard" }]} />

      <AsyncPageContent
        isLoading={isPending}
        isError={isError}
        onRetry={() => void refetch()}
        loadingLabel="Loading operational summary"
      >
        {() => (
          <div className="space-y-6">
            <AnimatedStagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Devices" value={data!.totalDevices} icon={Cpu} accent current={data!.totalDevices} total={data!.totalDevices} />
              <StatCard label="Active Devices" value={data!.activeDevices} icon={ShieldCheck} current={data!.activeDevices} total={data!.totalDevices} />
              <StatCard label="Device Types" value={data!.deviceTypes} icon={Radar} current={data!.deviceTypes} total={data!.totalDeviceTypes} />
              <StatCard label="Installers" value={data!.installers} icon={Wrench} current={data!.installers} total={data!.totalUsers} />
              <StatCard label="Active Device Relationships" value={data!.activeRelationships} icon={Link2} current={data!.activeRelationships} total={data!.totalRelationships} />
              <StatCard label="Open Support Threads" value={data!.openSupportThreads} icon={LifeBuoy} current={data!.openSupportThreads} total={data!.totalSupportThreads} invert />
              <StatCard label="Unread Notifications" value={data!.pendingNotifications} icon={Bell} current={data!.pendingNotifications} total={data!.totalNotifications} invert />
              <StatCard label="Decommissioned" value={data!.statusBreakdown.find((s) => s.status === "Decommissioned")?.count ?? 0} icon={Cpu} current={data!.statusBreakdown.find((s) => s.status === "Decommissioned")?.count ?? 0} total={data!.totalDevices} invert />
            </AnimatedStagger>

            <AnimatedStagger className="grid gap-4 lg:grid-cols-2">
              <Panel title="Device status">
                <div className="h-64">
                  <DeviceStatusPie3D data={data!.statusBreakdown} />
                </div>
              </Panel>

              <Panel title="Registration trend">
                <div className="h-64">
                  <RegistrationTrendAreaChart data={data!.registrationTrend} />
                </div>
              </Panel>
            </AnimatedStagger>

            <AnimatedStagger className="grid gap-4 lg:grid-cols-2">
              <Panel
                title="Recent device registrations"
                action={
                  <Link to="/devices" className="text-xs text-primary hover:underline">
                    View devices
                  </Link>
                }
              >
                <ul className="space-y-3">
                  {data!.recentRegistrations.map((r) => (
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

              <Panel
                title="Recent ownership claims"
                action={
                  <Link to="/relationships" className="text-xs text-primary hover:underline">
                    Manage relationships
                  </Link>
                }
              >
                <ul className="space-y-3">
                  {data!.recentClaims.map((c) => (
                    <li key={`${c.serial}-${c.at}`} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/devices/$serial"
                          params={{ serial: c.serial }}
                          className="block truncate font-mono text-xs text-foreground hover:text-primary"
                        >
                          {c.serial}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{c.user}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(c.at)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </AnimatedStagger>

            <AnimatedStagger className="grid gap-4 lg:grid-cols-2">
              <Panel title="Devices by type">
                <ul className="space-y-3">
                  {data!.devicesByType.map((entry) => (
                    <li key={entry.typeCode} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-foreground">{entry.typeCode}</p>
                        <p className="truncate text-xs text-muted-foreground">{entry.typeName}</p>
                      </div>
                      <span className="shrink-0 tabular-nums text-sm font-medium">{entry.count}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel
                title="Recent relationship changes"
                action={
                  <Link to="/relationships" className="text-xs text-primary hover:underline">
                    Manage relationships
                  </Link>
                }
              >
                <ul className="space-y-3">
                  {data!.recentRelationshipChanges.map((c, i) => (
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
            </AnimatedStagger>
          </div>
        )}
      </AsyncPageContent>
    </AppShell>
  );
}
