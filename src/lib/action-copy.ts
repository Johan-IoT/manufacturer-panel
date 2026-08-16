import type { DeviceUserLink } from "@/types/entities";

export function revokeAccessCopy(
  link: DeviceUserLink,
  userLabel: string,
  deviceLabel: string,
): {
  title: string;
  description: string;
  confirmLabel: string;
  successToast: string;
} {
  switch (link.LinkType) {
    case "Installer":
      return {
        title: "Revoke installer access?",
        description: `Are you sure you want to revoke this installer's access to ${deviceLabel}?`,
        confirmLabel: "Revoke access",
        successToast: "Installer access revoked successfully.",
      };
    case "Shared":
      return {
        title: "Revoke shared access?",
        description: `Are you sure you want to revoke this shared user's access to ${deviceLabel}?`,
        confirmLabel: "Revoke access",
        successToast: "Shared access revoked successfully.",
      };
    case "Owner":
      return {
        title: "Release ownership?",
        description: `Are you sure you want to release ${userLabel}'s ownership of ${deviceLabel}? The Owner link will be revoked.`,
        confirmLabel: "Release ownership",
        successToast: "Ownership released successfully.",
      };
    default:
      return {
        title: "Revoke access?",
        description: `Are you sure you want to revoke ${userLabel}'s ${link.LinkType.toLowerCase()} access to ${deviceLabel}? The relationship is marked revoked, never deleted.`,
        confirmLabel: "Revoke access",
        successToast: "Access revoked successfully.",
      };
  }
}
