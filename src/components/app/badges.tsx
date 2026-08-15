import { cn } from "@/lib/utils";
import { humanCategory } from "@/lib/format";
import { iconTone, permissionIconTone } from "@/lib/icon-colors";
import { Eye, Settings2, Radio, Share2, Check, X } from "lucide-react";
import type { AccountStatus, DeviceStatus as DeviceStatusType, LinkType, UserRole } from "@/types/entities";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)] border-[var(--tone-success-border)]",
  warning: "bg-[var(--tone-warning-bg)] text-[var(--tone-warning-fg)] border-[var(--tone-warning-border)]",
  danger: "bg-[var(--tone-danger-bg)] text-[var(--tone-danger-fg)] border-[var(--tone-danger-border)]",
  info: "bg-[var(--tone-info-bg)] text-[var(--tone-info-fg)] border-[var(--tone-info-border)]",
  primary: "bg-[var(--tone-primary-bg)] text-[var(--tone-primary-fg)] border-[var(--tone-primary-border)]",
};

export function Pill({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: React.ReactNode;
  tone?: Tone | undefined;
  className?: string | undefined;
  dot?: boolean | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const deviceStatusTone: Record<DeviceStatusType, Tone> = {
  Manufactured: "neutral",
  Registered: "info",
  Claimed: "primary",
  Active: "success",
  Suspended: "warning",
  Decommissioned: "danger",
};

export function DeviceStatus({ status }: { status: DeviceStatusType }) {
  return (
    <Pill tone={deviceStatusTone[status]} dot>
      {status}
    </Pill>
  );
}

const accountStatusTone: Record<AccountStatus, Tone> = {
  Pending: "warning",
  Active: "success",
  Suspended: "warning",
  Disabled: "danger",
};

export function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <Pill tone={accountStatusTone[status]} dot className={status === "Suspended" ? "border-dashed" : undefined}>
      {status}
    </Pill>
  );
}

const roleTone: Record<UserRole, Tone> = {
  Manufacturer: "primary",
  Installer: "info",
  DeviceUser: "neutral",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return <Pill tone={roleTone[role]}>{role === "DeviceUser" ? "Device User" : role}</Pill>;
}

const linkTone: Record<LinkType, Tone> = {
  Manufacturer: "primary",
  Installer: "info",
  Owner: "success",
  Shared: "neutral",
};

export function RelationshipBadge({ linkType }: { linkType: LinkType }) {
  return <Pill tone={linkTone[linkType]}>{linkType}</Pill>;
}

export function DeviceTypeBadge({ code, name }: { code: string; name?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded-md border border-border bg-surface-raised px-2 py-0.5 font-mono text-xs text-foreground">
        {code}
      </span>
      {name && <span className="truncate text-sm text-muted-foreground">{name}</span>}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return <Pill tone="neutral">{humanCategory(category)}</Pill>;
}

export function ThreadStatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "Open" ? "warning" : status === "In Progress" ? "info" : status === "Resolved" ? "success" : "neutral";
  return <Pill tone={tone} dot>{status}</Pill>;
}

export function DeliveryStatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "Delivered"
      ? "success"
      : status === "Sent" || status === "Sending"
        ? "info"
        : status === "Queued"
          ? "neutral"
          : status === "Expired"
            ? "warning"
            : "danger";
  return <Pill tone={tone}>{status}</Pill>;
}

export function ReadStateBadge({ isRead }: { isRead: boolean }) {
  return (
    <Pill tone={isRead ? "neutral" : "primary"}>
      {isRead ? <Check className={cn("size-3", iconTone.success)} /> : <span className="size-1.5 rounded-full bg-current" />}
      {isRead ? "Read" : "Unread"}
    </Pill>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Pill tone={active ? "success" : "neutral"} dot>
      {active ? "Active" : "Inactive"}
    </Pill>
  );
}

const permissionIcons = {
  CanView: { icon: Eye, label: "View" },
  CanConfigure: { icon: Settings2, label: "Configure" },
  CanControl: { icon: Radio, label: "Control" },
  CanShare: { icon: Share2, label: "Share" },
} as const;

export type PermissionKey = keyof typeof permissionIcons;

export function PermissionBadge({ permission, granted }: { permission: PermissionKey; granted: boolean }) {
  const { icon: Icon, label } = permissionIcons[permission];
  return (
    <span
      title={`${label}: ${granted ? "granted" : "not granted"}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        granted ? "border-[var(--tone-primary-border)] bg-[var(--tone-primary-bg)] text-[var(--tone-primary-fg)]" : "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon className={cn("size-3", granted ? permissionIconTone[permission] : iconTone.muted)} />
      {label}
      {!granted && <X className={cn("size-2.5", iconTone.danger)} />}
    </span>
  );
}
