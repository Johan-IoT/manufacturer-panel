export const iconTone = {
  primary: "text-primary",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  muted: "text-muted-foreground",
  foreground: "text-foreground",
} as const;

export type IconTone = (typeof iconTone)[keyof typeof iconTone];

export const navIconTone: Record<string, IconTone> = {
  Dashboard: iconTone.primary,
  Devices: iconTone.info,
  "Device Types": iconTone.warning,
  Relationships: iconTone.success,
  Installers: iconTone.foreground,
  Users: iconTone.primary,
  Notifications: iconTone.warning,
  Support: iconTone.danger,
};

export const statIconTone: Record<string, IconTone> = {
  "Total Devices": iconTone.primary,
  "Active Devices": iconTone.success,
  "Device Types": iconTone.warning,
  Installers: iconTone.foreground,
  "Active Device Relationships": iconTone.success,
  "Open Support Threads": iconTone.danger,
  "Unread Notifications": iconTone.warning,
  Decommissioned: iconTone.danger,
};

export const statWell: Record<string, string> = {
  "Total Devices": "bg-[var(--tone-primary-bg)] text-primary",
  "Active Devices": "bg-[var(--tone-success-bg)] text-success",
  "Device Types": "bg-[var(--tone-warning-bg)] text-warning",
  Installers: "bg-muted text-foreground",
  "Active Device Relationships": "bg-[var(--tone-success-bg)] text-success",
  "Open Support Threads": "bg-[var(--tone-danger-bg)] text-destructive",
  "Unread Notifications": "bg-[var(--tone-warning-bg)] text-warning",
  Decommissioned: "bg-[var(--tone-danger-bg)] text-destructive",
};

export const statAccent: Record<string, string> = {
  "Total Devices": "border-l-primary",
  "Active Devices": "border-l-success",
  "Device Types": "border-l-warning",
  Installers: "border-l-foreground",
  "Active Device Relationships": "border-l-success",
  "Open Support Threads": "border-l-destructive",
  "Unread Notifications": "border-l-warning",
  Decommissioned: "border-l-destructive",
};

export const permissionIconTone = {
  CanView: iconTone.info,
  CanConfigure: iconTone.warning,
  CanControl: iconTone.success,
  CanShare: iconTone.primary,
} as const;
