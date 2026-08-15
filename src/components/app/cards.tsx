import { Link } from "@tanstack/react-router";
import { Cpu, Link2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { DeviceStatus, RelationshipBadge, RoleBadge, StatusBadge, Pill } from "./badges";
import { PermissionMatrix } from "./permission-matrix";
import type { AppUser, Device, DeviceUserLink } from "@/types/entities";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean | undefined;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-4 shadow-panel transition-colors hover:border-primary/40",
        accent && "border-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", accent ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tabular-nums text-foreground">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
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
            <RoleBadge role={user.UserRole} />
            <StatusBadge status={user.AccountStatus} />
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{user.Email}</p>
          <p className="text-sm text-muted-foreground">{user.MobileNumber}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={user.EmailVerified ? "success" : "warning"}>
              <ShieldCheck className="size-3" /> Email {user.EmailVerified ? "verified" : "unverified"}
            </Pill>
            <Pill tone={user.MobileVerified ? "success" : "warning"}>
              <ShieldCheck className="size-3" /> Mobile {user.MobileVerified ? "verified" : "unverified"}
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
      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-foreground">{device.SerialNumber}</p>
          <p className="truncate text-sm text-muted-foreground">{device.DeviceName}</p>
        </div>
        <DeviceStatus status={device.DeviceStatus} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Cpu className="size-3.5" /> {typeName} · {device.FirmwareVersion}
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
            <Link2 className="size-3.5 text-muted-foreground" />
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
