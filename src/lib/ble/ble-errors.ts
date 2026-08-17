export class BleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BleError";
  }
}

export const BleErrors = {
  unsupported:
    "Web Bluetooth is not supported in this browser. Use Chrome or Edge on desktop over HTTPS or localhost.",
  permissionDenied: "Bluetooth permission was denied. Allow Bluetooth access and try again.",
  disabled: "Bluetooth is disabled. Enable Bluetooth on your computer and try again.",
  unavailable: "Bluetooth is unavailable. Please enable Bluetooth and try again.",
  noDevicesFound: "No BLE devices found. Move closer to the device and try again.",
  connectionFailed: "Unable to connect to the device. Move closer and try again.",
  serviceNotFound: "The expected BLE service was not found on this device.",
  txNotFound: "The TX BLE characteristic was not found on this device.",
  rxNotFound: "The RX BLE characteristic was not found on this device.",
  notificationFailed: "Unable to activate RX notifications on this device.",
  notificationRequired:
    "The selected device type requires BLE notifications on the RX characteristic.",
  commandTimeout: "The device did not respond in time. Please try again.",
  serialReadFailed: "Unable to read the physical serial number from the device.",
  serialMismatch:
    "The connected device does not match the selected serial number. Registration aborted.",
  profileUnavailable: "BLE profile is unavailable for the selected device type.",
  profileNotConfigured: "BLE profile is not configured. Select a device type first.",
  weakSignal: "Signal strength is too weak. Move closer to the device and try again.",
  scanUnsupported:
    "BLE scanning is not available in this browser. Use Chrome on desktop with Web Bluetooth Scanning enabled, or select a device from the browser picker.",
} as const;

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function isLeScanSupported(): boolean {
  return (
    isWebBluetoothSupported() &&
    typeof (navigator.bluetooth as Bluetooth & { requestLEScan?: unknown }).requestLEScan ===
      "function"
  );
}

export function normalizeUuid(uuid: string): string {
  return uuid.trim().toLowerCase();
}

export function matchesAdvertisedName(name: string, prefix: string): boolean {
  const trimmed = prefix.trim();
  if (!trimmed) return true;
  return name.trim().toUpperCase().startsWith(trimmed.toUpperCase());
}

export function validateSerialNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Serial number is required.";
  if (trimmed.length < 3) return "Serial number is too short.";
  return null;
}
