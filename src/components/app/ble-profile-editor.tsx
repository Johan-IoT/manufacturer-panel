import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BleProfile } from "@/types/entities";

const uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Enter a valid UUID.");

export const bleProfileSchema = z.object({
  ProfileName: z.string().trim().min(1, "Profile Name is required.").max(120),
  PublishedName: z.string().trim().min(1, "Published Name is required.").max(60),
  PublishedNamePrefix: z.string().trim().min(1, "Published Name Prefix is required.").max(20),
  ServiceUuid: uuid,
  TxCharacteristicUuid: uuid,
  RxCharacteristicUuid: uuid,
  MaximumPacketSize: z.number().int().min(20, "Must be at least 20.").max(512, "Must be 512 or less."),
  ConnectionTimeoutMs: z.number().int().min(1000).max(120000),
  CommandTimeoutMs: z.number().int().min(500).max(60000),
  IdleDisconnectMs: z.number().int().min(1000).max(600000),
});

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
  const [form, setForm] = useState<BleProfile>(profile);
  const parsed = bleProfileSchema.safeParse(form);
  const errorFor = (field: string) =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;

  const text = (key: keyof BleProfile, label: string, mono = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        disabled={!canEdit}
        className={mono ? "bg-background font-mono text-xs" : "bg-background"}
        value={String(form[key] ?? "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        aria-invalid={!!errorFor(key)}
      />
      {errorFor(key) && <p className="text-xs text-destructive">{errorFor(key)}</p>}
    </div>
  );

  const numeric = (key: keyof BleProfile, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        disabled={!canEdit}
        className="bg-background"
        value={Number(form[key] ?? 0)}
        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
        aria-invalid={!!errorFor(key)}
      />
      {errorFor(key) && <p className="text-xs text-destructive">{errorFor(key)}</p>}
    </div>
  );

  const toggle = (key: keyof BleProfile, label: string) => (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <Label htmlFor={key} className="text-sm font-normal">
        {label}
      </Label>
      <Switch
        id={key}
        disabled={!canEdit}
        checked={Boolean(form[key])}
        onCheckedChange={(v) => setForm({ ...form, [key]: v })}
      />
    </div>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed.success) onSave(form);
      }}
    >
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
      <div className="grid gap-3 md:grid-cols-2">
        {toggle("RxUsesNotification", "RX Uses Notification")}
        {toggle("WriteWithResponse", "Write With Response")}
        {toggle("SerialReadRequired", "Serial Read Required")}
        {toggle("Active", "Active")}
      </div>
      {canEdit && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setForm(profile)} disabled={saving}>
            Reset
          </Button>
          <Button type="submit" disabled={!parsed.success || saving}>
            {saving ? "Saving…" : "Save BLE profile"}
          </Button>
        </div>
      )}
    </form>
  );
}
