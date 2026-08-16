import { Link } from "@tanstack/react-router";
import { Cpu, Link2, ShieldCheck, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { iconTone, statAccent, statIconTone, statWell } from "@/lib/icon-colors";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { DeviceStatus, RelationshipBadge, StatusBadge, Pill, CapabilityBadges } from "./badges";
import { PermissionMatrix } from "./permission-matrix";
import type { AppUser, Device, DeviceUserLink } from "@/types/entities";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = false,
  iconClassName,
  current,
  total,
  invert = false,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean | undefined;
  iconClassName?: string | undefined;
  current?: number | undefined;
  total?: number | undefined;
  invert?: boolean | undefined;
}) {
  const iconColor = iconClassName ?? statIconTone[label] ?? (accent ? iconTone.primary : iconTone.muted);
  const well = statWell[label] ?? "bg-muted text-foreground";
  const stripe = statAccent[label] ?? "border-l-primary";
  const max = total && total > 0 ? total : 0;
  const amount = current ?? Number(value);
  const share = max > 0 ? Math.round(((Number.isFinite(amount) ? amount : 0) / max) * 100) : 0;
  const positive = invert ? share === 0 : share >= 50;
  const Arrow = share === 0 && invert ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  const arrowTone = positive ? "text-success" : "text-destructive";

  return (
    <div
      className={cn(
        "group rounded-lg border border-border border-l-[4px] bg-surface px-3 py-2.5 shadow-none transition-colors hover:bg-accent",
        stripe,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className={cn("inline-flex size-7 items-center justify-center rounded-md", well)}>
          <Icon className={cn("size-3.5", iconColor)} />
        </span>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</div>
        <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums", arrowTone)}>
          <Arrow className="size-3.5" />
          {share}%
        </span>
      </div>
    </div>
  );
}

export function UserAvatar({ user, size = "md" }: { user: Pick<AppUser, "FirstName" | "LastName">; size?: "sm" | "md" | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised font-medium text-foreground",
        size === "sm" ? "size-7 text-[11px]" : "size-9 text-xs",
      )}
      aria-hidden
    >
      {initials(user.FirstName, user.LastName)}
    </span>
  );
}

export function UserCard({ user }: { user: AppUser }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-foreground">
              {user.FirstName} {user.LastName}
            </p>
            <CapabilityBadges user={user} />
            <StatusBadge status={user.AccountStatus} />
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{user.Email}</p>
          <p className="text-sm text-muted-foreground">{user.MobileNumber}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={user.EmailVerified ? "success" : "warning"}>
              <ShieldCheck className={cn("size-3", user.EmailVerified ? iconTone.success : iconTone.warning)} /> Email{" "}
              {user.EmailVerified ? "verified" : "unverified"}
            </Pill>
            <Pill tone={user.MobileVerified ? "success" : "warning"}>
              <ShieldCheck className={cn("size-3", user.MobileVerified ? iconTone.success : iconTone.warning)} /> Mobile{" "}
              {user.MobileVerified ? "verified" : "unverified"}
            </Pill>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Last login {formatDateTime(user.LastLoginAt)}</p>
        </div>
      </div>
    </div>
  );
}

export function DeviceCard({ device, typeName }: { device: Device; typeName: string }) {
  return (
    <Link
      to="/devices/$serial"
      params={{ serial: device.SerialNumber }}
      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-foreground">{device.SerialNumber}</p>
          <p className="truncate text-sm text-muted-foreground">{device.DeviceName}</p>
        </div>
        <DeviceStatus status={device.DeviceStatus} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Cpu className={cn("size-3.5", iconTone.info)} /> {typeName} · {device.FirmwareVersion}
      </div>
    </Link>
  );
}

export function RelationshipCard({
  link,
  title,
  subtitle,
  action,
}: {
  link: DeviceUserLink;
  title: string;
  subtitle?: string | undefined;
  action?: React.ReactNode | undefined;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link2 className={cn("size-3.5", iconTone.success)} />
            <p className="truncate font-medium text-foreground">{title}</p>
            <RelationshipBadge linkType={link.LinkType} />
            <Pill tone={link.Active ? "success" : "neutral"} dot>
              {link.Active ? "Active" : "Revoked"}
            </Pill>
          </div>
          {subtitle && <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-2">
            <PermissionMatrix link={link} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Granted {formatDate(link.GrantedAt)}
            {link.RevokedAt ? ` · Revoked ${formatDate(link.RevokedAt)}` : ""}
          </p>
        </div>
        {action}
      </div>
    </div>
  );
}
