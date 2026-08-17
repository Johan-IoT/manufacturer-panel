import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deviceTypeService } from "@/services";
import { toUserMessage } from "@/services/client";
import { DEVICE_CATEGORIES, type DeviceCategory } from "@/types/entities";

export const Route = createFileRoute("/device-types/new")({
  head: () => ({
    meta: [
      { title: "New Device Type | Manufacturer Panel | ConfigGate" },
      { name: "description", content: "Create a new device type with claim rules and RSSI thresholds." },
      { property: "og:title", content: "New Device Type | Manufacturer Panel" },
      { property: "og:description", content: "Create a device type in the Manufacturer Panel." },
    ],
  }),
  component: NewDeviceTypePage,
});

const schema = z.object({
  TypeCode: z.string().trim().min(1, "Type Code is required.").max(32),
  TypeName: z.string().trim().min(1, "Type Name is required.").max(120),
  Description: z.string().trim().min(1, "Description is required.").max(500),
  ManufacturerName: z.string().trim().min(1, "Manufacturer Name is required.").max(120),
  DeviceCategory: z.enum(DEVICE_CATEGORIES as [DeviceCategory, ...DeviceCategory[]]),
  HardwareVersion: z.string().trim().min(1, "Hardware Version is required.").max(32),
  ClaimAllowed: z.boolean(),
  RssiConnectMinimum: z.number().int().min(-120).max(0),
  Active: z.boolean(),
});

function NewDeviceTypePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    TypeCode: "",
    TypeName: "",
    Description: "",
    ManufacturerName: "GSM Systems",
    DeviceCategory: "Telemetry" as DeviceCategory,
    HardwareVersion: "",
    ClaimAllowed: true,
    RssiConnectMinimum: -80,
    Active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () => deviceTypeService.create(form),
    onSuccess: (created) => {
      toast.success("Device type created successfully.");
      void navigate({ to: "/device-types/$typeId", params: { typeId: created.id } });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to create device type. Please try again.")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString() ?? "form";
        next[key] = issue.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate();
  };

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="New Device Type"
        breadcrumbs={[
          { label: "Manufacturer Panel", to: "/" },
          { label: "Device Types", to: "/device-types" },
          { label: "New" },
        ]}
      />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 rounded-lg border border-border bg-surface p-4 shadow-none">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="type-code">Type Code</Label>
            <Input
              id="type-code"
              className="bg-background font-mono"
              value={form.TypeCode}
              onChange={(e) => setField("TypeCode", e.target.value)}
              maxLength={32}
            />
            {errors.TypeCode && <p className="text-xs text-destructive">{errors.TypeCode}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type-name">Type Name</Label>
            <Input id="type-name" className="bg-background" value={form.TypeName} onChange={(e) => setField("TypeName", e.target.value)} maxLength={120} />
            {errors.TypeName && <p className="text-xs text-destructive">{errors.TypeName}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            className="bg-background"
            rows={3}
            value={form.Description}
            onChange={(e) => setField("Description", e.target.value)}
            maxLength={500}
          />
          {errors.Description && <p className="text-xs text-destructive">{errors.Description}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="manufacturer">Manufacturer Name</Label>
            <Input
              id="manufacturer"
              className="bg-background"
              value={form.ManufacturerName}
              onChange={(e) => setField("ManufacturerName", e.target.value)}
              maxLength={120}
            />
            {errors.ManufacturerName && <p className="text-xs text-destructive">{errors.ManufacturerName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Device Category</Label>
            <Select value={form.DeviceCategory} onValueChange={(v) => setField("DeviceCategory", v as DeviceCategory)}>
              <SelectTrigger id="category" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hw-version">Hardware Version</Label>
            <Input
              id="hw-version"
              className="bg-background font-mono"
              value={form.HardwareVersion}
              onChange={(e) => setField("HardwareVersion", e.target.value)}
              maxLength={32}
            />
            {errors.HardwareVersion && <p className="text-xs text-destructive">{errors.HardwareVersion}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rssi">RSSI Connect Minimum (dBm)</Label>
            <Input
              id="rssi"
              type="number"
              className="bg-background tabular-nums"
              value={form.RssiConnectMinimum}
              onChange={(e) => setField("RssiConnectMinimum", Number(e.target.value))}
              min={-120}
              max={0}
            />
            {errors.RssiConnectMinimum && <p className="text-xs text-destructive">{errors.RssiConnectMinimum}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <Switch id="claim-allowed" checked={form.ClaimAllowed} onCheckedChange={(v) => setField("ClaimAllowed", v)} />
            <Label htmlFor="claim-allowed">Claim allowed</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="active" checked={form.Active} onCheckedChange={(v) => setField("Active", v)} />
            <Label htmlFor="active">Active</Label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/device-types" })} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create device type"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
