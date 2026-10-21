import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  BadgeCheck,
  Cpu,
  Factory,
  Plus,
  ShieldOff,
  Tag,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { AsyncPageContent, AnimatedStagger } from "@/components/app/page-layout";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/cards";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { dashboardService, notificationService, supportService } from "@/services";
import { relativeTime } from "@/lib/format";
import { usePermissions } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { DeviceStatus } from "@/types/entities";
import { notificationStats, type NotificationRowLike } from "@/lib/notification-stats";
import { countSupportStates, SUPPORT_STATES } from "@/lib/support-stats";

/** Device Summary cards: one per device status, each opens the filtered Devices list. */
const STATUS_CARDS: { status: DeviceStatus; icon: LucideIcon }[] = [
  { status: "Manufactured", icon: Factory },
  { status: "Registered", icon: Tag },
  { status: "Claimed", icon: BadgeCheck },
  { status: "Released", icon: Undo2 },
  { status: "Suspended", icon: ShieldOff },
  { status: "Decommissioned", icon: Archive },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard | Manufacturer Panel | ConfigGate" },
      {
        name: "description",
        content:
          "Device summary by device type, unread notifications, support states and recent device registrations and claims.",
      },
      { property: "og:title", content: "Dashboard | Manufacturer Panel" },
      {
        property: "og:description",
        content: "Operational overview of the ConfigGate BLE device fleet.",
      },
    ],
  }),
  component: DashboardPage,
});

function Panel({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface shadow-none", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** A small labelled count used as a quick link. `alert` highlights a non-zero value. */
function MiniStat({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  const highlight = alert && value > 0;
  return (
    <span
      className={cn(
        "flex h-full flex-col gap-1 rounded-md border px-3 py-2.5 transition-colors hover:bg-accent",
        highlight ? "border-warning/40 bg-[var(--tone-warning-bg)]" : "border-border",
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-display text-xl font-semibold tabular-nums",
          highlight ? "text-[var(--tone-warning-fg)]" : "text-foreground",
        )}
      >
        {value}
      </span>
    </span>
  );
}

function DashboardPage() {
  const permissions = usePermissions();
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardService.summary(),
  });
  // Same queries (and cache) as the Notifications and Support screens, so the
  // dashboard counts always match what those screens show after the click.
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await notificationService.list()) as NotificationRowLike[],
  });
  const supportQuery = useQuery({
    queryKey: ["support"],
    queryFn: () => supportService.listThreads(),
  });

  const summary = summaryQuery.data?.deviceSummary;
  const notifications = notificationStats(notificationsQuery.data ?? []);
  const supportCounts = countSupportStates(supportQuery.data ?? []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        breadcrumbs={[{ label: "Manufacturer Panel" }, { label: "Dashboard" }]}
        actions={
          permissions.canManageDeviceTypes || permissions.canDeactivateDevice ? (
            <div className="flex flex-wrap gap-2">
              {permissions.canManageDeviceTypes && (
                <Button variant="outline" asChild>
                  <Link to="/device-types/new">
                    <Plus className="mr-2 size-4" /> Add Device Type
                  </Link>
                </Button>
              )}
              {permissions.canDeactivateDevice && (
                <Button asChild>
                  <Link to="/devices/new">
                    <Plus className="mr-2 size-4" /> Add Device
                  </Link>
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <AsyncPageContent
        isLoading={summaryQuery.isPending}
        isError={summaryQuery.isError || (!summaryQuery.isPending && !summary)}
        onRetry={() => void summaryQuery.refetch()}
        loadingLabel="Loading dashboard"
      >
        {() => (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Device Summary</h2>
              <AnimatedStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
                <Link to="/devices" className="block rounded-lg">
                  <StatCard label="Total Devices" value={summary!.totalDevices} icon={Cpu} accent />
                </Link>
                {STATUS_CARDS.map(({ status, icon }) => (
                  <Link key={status} to="/devices" search={{ status }} className="block rounded-lg">
                    <StatCard label={status} value={summary!.byStatus[status] ?? 0} icon={icon} />
                  </Link>
                ))}
              </AnimatedStagger>
            </div>

            <AnimatedStagger className="grid gap-4 lg:grid-cols-5">
              <Panel
                title="Notifications"
                className="lg:col-span-2"
                action={
                  <Link to="/notifications" className="text-xs text-primary hover:underline">
                    View all
                  </Link>
                }
              >
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/notifications" search={{ view: "unread" }} className="block">
                    <MiniStat label="Unread" value={notifications.unread} />
                  </Link>
                  <Link to="/notifications" search={{ view: "push" }} className="block">
                    <MiniStat label="Not delivered" value={notifications.notDelivered} alert />
                  </Link>
                </div>
              </Panel>

              <Panel
                title="Support"
                className="lg:col-span-3"
                action={
                  <Link to="/support" className="text-xs text-primary hover:underline">
                    View all
                  </Link>
                }
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {SUPPORT_STATES.map((state) => (
                    <Link key={state} to="/support" search={{ status: state }} className="block">
                      <MiniStat
                        label={state}
                        value={supportCounts[state]}
                        alert={state === "Open" || state === "In Progress"}
                      />
                    </Link>
                  ))}
                </div>
              </Panel>
            </AnimatedStagger>

            <AnimatedStagger className="grid gap-4 lg:grid-cols-2">
              <Panel
                title="Recent Device Registrations"
                action={
                  <Link to="/devices" className="text-xs text-primary hover:underline">
                    View devices
                  </Link>
                }
              >
                {summaryQuery.data!.recentRegistrations.length === 0 ? (
                  <EmptyState title="No devices registered yet" />
                ) : (
                  <ul className="space-y-3">
                    {summaryQuery.data!.recentRegistrations.map((r) => (
                      <li key={r.serial}>
                        {/* Whole row opens that device's detail page. */}
                        <Link
                          to="/devices/$serial"
                          params={{ serial: r.serial }}
                          className="group -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1 hover:bg-muted"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs text-foreground group-hover:text-primary">
                              {r.serial}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{r.name}</p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {relativeTime(r.at)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="Recent Device Claims"
                action={
                  <Link
                    to="/devices"
                    search={{ status: "Claimed" }}
                    className="text-xs text-primary hover:underline"
                  >
                    View claimed devices
                  </Link>
                }
              >
                {summaryQuery.data!.recentClaims.length === 0 ? (
                  <EmptyState title="No devices claimed yet" />
                ) : (
                  <ul className="space-y-3">
                    {summaryQuery.data!.recentClaims.map((c) => (
                      <li key={`${c.serial}-${c.at}`}>
                        {/* Whole row opens that device's detail page. */}
                        <Link
                          to="/devices/$serial"
                          params={{ serial: c.serial }}
                          className="group -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1 hover:bg-muted"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs text-foreground group-hover:text-primary">
                              {c.serial}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{c.user}</p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {relativeTime(c.at)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </AnimatedStagger>
          </div>
        )}
      </AsyncPageContent>
    </>
  );
}
