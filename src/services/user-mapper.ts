import type { AccountStatus, AppUser, GlobalRole } from "@/types/entities";

function toPascalStatus(value: unknown): AccountStatus {
  const normalized = String(value ?? "Pending").toLowerCase();
  const map: Record<string, AccountStatus> = {
    pending: "Pending",
    active: "Active",
    suspended: "Suspended",
    disabled: "Disabled",
  };
  return map[normalized] ?? "Pending";
}

function normalizeRoles(raw: Record<string, unknown>): GlobalRole[] {
  const fromArray = raw.globalRoles as unknown;
  if (Array.isArray(fromArray) && fromArray.length > 0) {
    return fromArray.map((role) => {
      const text = String(role);
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() as GlobalRole;
    });
  }
  const roles: GlobalRole[] = [];
  if (raw.IsManufacturer === true || raw.isManufacturerCapability === true) {
    roles.push("Manufacturer");
  }
  if (raw.IsInstaller === true || raw.isInstallerCapability === true) {
    roles.push("Installer");
  }
  return roles;
}

/** Normalizes panel and mobile login/user payloads into panel AppUser shape. */
export function normalizeUser(raw: AppUser | Record<string, unknown>): AppUser {
  const source = raw as Record<string, unknown>;
  const roles = normalizeRoles(source);
  const accountStatus = toPascalStatus(source.AccountStatus ?? source.accountStatus);
  return {
    id: String(source.id ?? ""),
    FirstName: String(source.FirstName ?? source.firstName ?? ""),
    LastName: String(source.LastName ?? source.lastName ?? ""),
    Email: String(source.Email ?? source.email ?? ""),
    MobileNumber: String(source.MobileNumber ?? source.mobile ?? ""),
    globalRoles: roles,
    IsManufacturer: roles.includes("Manufacturer"),
    IsInstaller: roles.includes("Installer"),
    AccountStatus: accountStatus,
    EmailVerified: Boolean(source.EmailVerified ?? source.emailVerified),
    MobileVerified: Boolean(source.MobileVerified ?? source.mobileVerified),
    LastLoginAt: (source.LastLoginAt ?? source.lastLoginAt ?? null) as string | null,
    CreatedAt: String(source.CreatedAt ?? source.createdAt ?? new Date().toISOString()),
    UpdatedAt: String(source.UpdatedAt ?? source.updatedAt ?? new Date().toISOString()),
  };
}
