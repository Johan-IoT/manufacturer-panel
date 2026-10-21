import type { DeviceType } from "@/types/entities";

/**
 * The device QR holds only the serial with its device type's prefix in front
 * (Johan, 19 Oct: Diesel Keypad = DK<SerialNumber>). Removes the prefix and
 * returns the device type it belongs to when one matches.
 * - With a type already selected, only that type's prefix is removed.
 * - Otherwise the longest matching prefix of the given types wins.
 */
export function parseScannedSerial(
  scanned: string,
  types: Pick<DeviceType, "id" | "TypeName" | "QrSerialPrefix">[],
  selectedType?: Pick<DeviceType, "id" | "TypeName" | "QrSerialPrefix"> | null,
): { serial: string; deviceType: Pick<DeviceType, "id" | "TypeName" | "QrSerialPrefix"> | null } {
  const value = scanned.trim();
  const upper = value.toUpperCase();
  const candidates = selectedType ? [selectedType] : types;
  let match: (typeof candidates)[number] | null = null;
  for (const type of candidates) {
    const prefix = (type.QrSerialPrefix ?? "").trim().toUpperCase();
    if (!prefix || !upper.startsWith(prefix) || upper.length <= prefix.length) continue;
    if (!match || prefix.length > (match.QrSerialPrefix ?? "").length) match = type;
  }
  if (!match) return { serial: value, deviceType: null };
  return { serial: value.slice((match.QrSerialPrefix ?? "").trim().length), deviceType: match };
}
