import { DEVICE_STATUSES, type DeviceStatus } from "@/types/entities";

/**
 * Device status lifecycle (Johan, 20 Oct), enforced by the server:
 * - Manufactured: added in the Manufacturer Panel
 * - Registered: first BLE serial confirmation by the app
 * - Claimed: has an Owner
 * - Released: the Owner was released
 * - Suspended: stolen / lost / stopped; nobody can claim or configure it, and a
 *   Manufacturer can set it back to Released
 * - Decommissioned: taken out of service (only from Released)
 */
export type DeviceStatusAction = "suspend" | "reinstate" | "decommission";

export function isDeviceStatus(value: unknown): value is DeviceStatus {
  return typeof value === "string" && (DEVICE_STATUSES as string[]).includes(value);
}

export function canSuspend(status: DeviceStatus): boolean {
  return status !== "Suspended" && status !== "Decommissioned";
}

export function canReinstate(status: DeviceStatus): boolean {
  return status === "Suspended";
}

export function canDecommission(status: DeviceStatus): boolean {
  return status === "Released";
}

export const DEVICE_STATUS_ACTION_COPY: Record<
  DeviceStatusAction,
  {
    menuLabel: string;
    title: string;
    description: (serial: string) => string;
    confirmLabel: string;
    successToast: string;
    errorToast: string;
    destructive: boolean;
  }
> = {
  suspend: {
    menuLabel: "Suspend",
    title: "Suspend this device?",
    description: (serial) =>
      `Use this when ${serial} is stolen, lost or stopped. While suspended nobody can claim, configure or share it. You can set it back to Released later.`,
    confirmLabel: "Suspend device",
    successToast: "Device suspended successfully.",
    errorToast: "Unable to suspend this device. Please try again.",
    destructive: true,
  },
  reinstate: {
    menuLabel: "Set to Released",
    title: "Set this device back to Released?",
    description: (serial) =>
      `${serial} becomes Released. The previous owner and all shared users lose access, and the device can be claimed again.`,
    confirmLabel: "Set to Released",
    successToast: "Device set to Released successfully.",
    errorToast: "Unable to set this device to Released. Please try again.",
    destructive: false,
  },
  decommission: {
    menuLabel: "Decommission",
    title: "Decommission this device?",
    description: (serial) =>
      `Are you sure you want to decommission ${serial}? It is taken out of service for good. History is preserved; the device is never deleted.`,
    confirmLabel: "Decommission device",
    successToast: "Device decommissioned successfully.",
    errorToast: "Unable to decommission this device. Please try again.",
    destructive: true,
  },
};
