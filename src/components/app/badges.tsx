import { cn } from "@/lib/utils";
import { humanCategory } from "@/lib/format";
import { Eye, Settings2, Radio, Share2, Check, X } from "lucide-react";
import type { AccountStatus, DeviceStatus as DeviceStatusType, LinkType, UserRole } from "@/types/entities";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/12 text-warning border-warning/30",
  danger: "bg-destructive/12 text-destructive border-destructive/30",
  info: "bg-info/12 text-info border-info/30",
  primary: "bg-primary/12 text-primary border-primary/30",
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
      {isRead ? <Check className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
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
        granted ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground/60",
      )}
    >
      <Icon className="size-3" />
      {label}
      {!granted && <X className="size-2.5" />}
    </span>
  );
}
