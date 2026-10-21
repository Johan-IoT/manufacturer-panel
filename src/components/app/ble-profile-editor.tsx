import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BleProfile } from "@/types/entities";

const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Enter a valid UUID.",
  );

export const bleProfileSchema = z.object({
  ProfileName: z.string().trim().min(1, "Profile Name is required.").max(120),
  PublishedName: z.string().trim().min(1, "Published Name is required.").max(60),
  PublishedNamePrefix: z.string().trim().min(1, "Published Name Prefix is required.").max(20),
  ServiceUuid: uuid,
  TxCharacteristicUuid: uuid,
  RxCharacteristicUuid: uuid,
  MaximumPacketSize: z
    .number()
    .int()
    .min(20, "Must be at least 20.")
    .max(512, "Must be 512 or less."),
  ConnectionTimeoutMs: z.number().int().min(1000).max(120000),
  CommandTimeoutMs: z.number().int().min(500).max(60000),
  IdleDisconnectMs: z.number().int().min(1000).max(600000),
});

/** The editable BLE profile values (the type's Active switch is the only Active). */
export type BleProfileValues = Omit<BleProfile, "id" | "DeviceTypeId" | "Active">;

/** Starting values for a new type that is not cloned (same as the server defaults). */
export const DEFAULT_BLE_PROFILE_VALUES: BleProfileValues = {
  ProfileName: "",
  PublishedName: "",
  PublishedNamePrefix: "",
  ServiceUuid: "0000fe00-0000-1000-8000-00805f9b34fb",
  TxCharacteristicUuid: "0000ff01-0000-1000-8000-00805f9b34fb",
  RxCharacteristicUuid: "0000ff02-0000-1000-8000-00805f9b34fb",
  RxUsesNotification: true,
  WriteWithResponse: false,
  MaximumPacketSize: 180,
  ConnectionTimeoutMs: 10000,
  CommandTimeoutMs: 4000,
  IdleDisconnectMs: 3000,
  SerialReadRequired: true,
};

export function toBleProfileValues(profile: BleProfile): BleProfileValues {
  const { id: _id, DeviceTypeId: _type, Active: _active, ...values } = profile;
  return values;
}

export function bleProfileErrors(values: BleProfileValues): Record<string, string> {
  const parsed = bleProfileSchema.safeParse(values);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]?.toString();
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** BLE profile inputs, controlled by the parent form. */
export function BleProfileFields({
  values,
  onChange,
  disabled = false,
  errors,
}: {
  values: BleProfileValues;
  onChange: (values: BleProfileValues) => void;
  disabled?: boolean | undefined;
  errors: Record<string, string>;
}) {
  const set = <K extends keyof BleProfileValues>(key: K, value: BleProfileValues[K]) =>
    onChange({ ...values, [key]: value });

  const text = (key: keyof BleProfileValues, label: string, mono = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        disabled={disabled}
        className={mono ? "bg-background font-mono text-xs" : "bg-background"}
        value={String(values[key] ?? "")}
        onChange={(e) => set(key, e.target.value as never)}
        aria-invalid={!!errors[key]}
      />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  const numeric = (key: keyof BleProfileValues, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        disabled={disabled}
        className="bg-background"
        value={Number(values[key] ?? 0)}
        onChange={(e) => set(key, Number(e.target.value) as never)}
        aria-invalid={!!errors[key]}
      />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  const toggle = (key: keyof BleProfileValues, label: string) => (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <Label htmlFor={key} className="text-sm font-normal">
        {label}
      </Label>
      <Switch
        id={key}
        disabled={disabled}
        checked={Boolean(values[key])}
        onCheckedChange={(v) => set(key, v as never)}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {text("ProfileName", "Profile Name")}
        {text("PublishedName", "Published Name")}
        {text("PublishedNamePrefix", "Published Name Prefix")}
        {text("ServiceUuid", "Service UUID", true)}
        {text("TxCharacteristicUuid", "TX Characteristic UUID", true)}
        {text("RxCharacteristicUuid", "RX Characteristic UUID", true)}
        {numeric("MaximumPacketSize", "Maximum Packet Size")}
        {numeric("ConnectionTimeoutMs", "Connection Timeout (ms)")}
        {numeric("CommandTimeoutMs", "Command Timeout (ms)")}
        {numeric("IdleDisconnectMs", "Idle Disconnect (ms)")}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {toggle("RxUsesNotification", "RX Uses Notification")}
        {toggle("WriteWithResponse", "Write With Response")}
        {toggle("SerialReadRequired", "Serial Read Required")}
      </div>
    </div>
  );
}

/** BLE profile of an existing device type, with Reset / Save. */
export function BleProfileEditor({
  profile,
  canEdit,
  saving,
  onSave,
}: {
  profile: BleProfile;
  canEdit: boolean;
  saving: boolean;
  onSave: (patch: Partial<BleProfile>) => void;
}) {
  const [values, setValues] = useState<BleProfileValues>(() => toBleProfileValues(profile));
  const errors = bleProfileErrors(values);
  const valid = Object.keys(errors).length === 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(values);
      }}
    >
      <BleProfileFields values={values} onChange={setValues} disabled={!canEdit} errors={errors} />
      {canEdit && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setValues(toBleProfileValues(profile))}
            disabled={saving}
          >
            Reset
          </Button>
          <Button type="submit" disabled={!valid || saving} variant="success">
            {saving ? "Saving..." : "Save BLE profile"}
          </Button>
        </div>
      )}
    </form>
  );
}
