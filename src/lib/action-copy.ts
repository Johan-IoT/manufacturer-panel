import type { DeviceUserLink } from "@/types/entities";

/** Primary action label on relationship cards (list + device detail). */
export function revokeAccessActionLabel(link: DeviceUserLink): string {
  switch (link.LinkType) {
    case "Owner":
      return "Release Device";
    case "Shared":
      return "Revoke shared access";
    case "Installer":
      return "Revoke installer access";
    case "Manufacturer":
      return "Revoke manufacturer access";
    default:
      return "Revoke access";
  }
}

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
        confirmLabel: "Revoke installer access",
        successToast: "Installer access revoked successfully.",
      };
    case "Shared":
      return {
        title: "Revoke shared access?",
        description: `Are you sure you want to revoke this shared user's access to ${deviceLabel}?`,
        confirmLabel: "Revoke shared access",
        successToast: "Shared access revoked successfully.",
      };
    case "Owner":
      return {
        title: "Release device?",
        description: `Releasing a device is normally done by the owner in the app. Are you sure you want to release ${deviceLabel} from ${userLabel}? The owner and all shared users will lose access, and the device can be claimed again.`,
        confirmLabel: "Release Device",
        successToast: "Device released successfully.",
      };
    case "Manufacturer":
      return {
        title: "Revoke manufacturer access?",
        description: `Are you sure you want to revoke ${userLabel}'s manufacturer access to ${deviceLabel}? The relationship is marked revoked, never deleted.`,
        confirmLabel: "Revoke manufacturer access",
        successToast: "Manufacturer access revoked successfully.",
      };
    default:
      return {
        title: "Revoke access?",
        description: `Are you sure you want to revoke ${userLabel}'s access to ${deviceLabel}? The relationship is marked revoked, never deleted.`,
        confirmLabel: "Revoke access",
        successToast: "Access revoked successfully.",
      };
  }
}
