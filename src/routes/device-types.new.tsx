import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BleProfileFields,
  DEFAULT_BLE_PROFILE_VALUES,
  bleProfileErrors,
  toBleProfileValues,
  type BleProfileValues,
} from "@/components/app/ble-profile-editor";
import { bleProfileService, deviceTypeService } from "@/services";
import { toUserMessage } from "@/services/client";
import { DEVICE_CATEGORIES, type DeviceCategory, type DeviceType } from "@/types/entities";

export const Route = createFileRoute("/device-types/new")({
  head: () => ({
    meta: [
      { title: "New Device Type | Manufacturer Panel | ConfigGate" },
      {
        name: "description",
        content: "Create a new device type, optionally cloned from an existing type.",
      },
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
  QrSerialPrefix: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9]*$/, "Use letters and digits only."),
  RssiConnectMinimum: z.number().int().min(-120).max(0),
  Active: z.boolean(),
});

const EMPTY_FORM = {
  TypeCode: "",
  TypeName: "",
  Description: "",
  ManufacturerName: "GSM Systems",
  DeviceCategory: "Telemetry" as DeviceCategory,
  HardwareVersion: "",
  QrSerialPrefix: "",
  RssiConnectMinimum: -80,
  Active: true,
};

type TypeForm = typeof EMPTY_FORM;

/** Clone: every field from the selected type except Type Code and QR Serial Prefix, which identify a type. */
function formFromType(type: DeviceType): TypeForm {
  return {
    TypeCode: "",
    TypeName: type.TypeName,
    Description: type.Description,
    ManufacturerName: type.ManufacturerName,
    DeviceCategory: type.DeviceCategory,
    HardwareVersion: type.HardwareVersion,
    QrSerialPrefix: "",
    RssiConnectMinimum: type.RssiConnectMinimum,
    Active: true,
  };
}

/** Empty Profile Name / Published Name / Prefix fall back to the Type Code (as the server does). */
function effectiveBle(ble: BleProfileValues, typeCode: string): BleProfileValues {
  const code = typeCode.trim();
  return {
    ...ble,
    ProfileName: ble.ProfileName.trim() || (code ? `${code} Standard Profile` : ""),
    PublishedName: ble.PublishedName.trim() || code,
    PublishedNamePrefix: ble.PublishedNamePrefix.trim() || (code.split("-")[1] ?? code),
  };
}

function NewDeviceTypePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<TypeForm>(EMPTY_FORM);
  const [ble, setBle] = useState<BleProfileValues>(DEFAULT_BLE_PROFILE_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bleSubmitted, setBleSubmitted] = useState(false);
  /** Johan (20 Oct): "Clone an existing type?" Yes fills the form from that type. */
  const [clone, setClone] = useState<"no" | "yes">("no");
  const [copyFromId, setCopyFromId] = useState("");
  const [loadingClone, setLoadingClone] = useState(false);
  const typesQuery = useQuery({
    queryKey: ["device-types"],
    queryFn: () => deviceTypeService.list(),
  });
  const activeTypes = (typesQuery.data ?? []).filter((t) => t.Active);

  const bleToSave = effectiveBle(ble, form.TypeCode);
  const bleErrors = bleSubmitted ? bleProfileErrors(bleToSave) : {};

  const chooseClone = (value: "no" | "yes") => {
    setClone(value);
    if (value === "no") {
      setCopyFromId("");
      setForm(EMPTY_FORM);
      setBle(DEFAULT_BLE_PROFILE_VALUES);
      setErrors({});
    }
  };

  const chooseSource = async (typeId: string) => {
    const source = activeTypes.find((t) => t.id === typeId);
    if (!source) return;
    setCopyFromId(typeId);
    setForm(formFromType(source));
    setErrors({});
    setLoadingClone(true);
    try {
      const profile = await bleProfileService.getForDeviceType(typeId);
      // The profile name follows the new Type Code; everything else is copied.
      setBle({ ...toBleProfileValues(profile), ProfileName: "" });
    } catch (e) {
      setBle(DEFAULT_BLE_PROFILE_VALUES);
      toast.error(
        toUserMessage(e, "Unable to load the BLE profile of that type. Please try again."),
      );
    } finally {
      setLoadingClone(false);
    }
  };

  const create = useMutation({
    mutationFn: () =>
      deviceTypeService.create({
        ...form,
        QrSerialPrefix: form.QrSerialPrefix.trim().toUpperCase(),
        BleProfile: bleToSave,
        // Also copies the selected type's default configuration.
        CopyFromDeviceTypeId: clone === "yes" && copyFromId ? copyFromId : undefined,
      }),
    onSuccess: (created) => {
      toast.success("Device type created successfully.");
      void navigate({ to: "/device-types/$typeId", params: { typeId: created.id } });
    },
    onError: (e) =>
      toast.error(toUserMessage(e, "Unable to create device type. Please try again.")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clone === "yes" && !copyFromId) {
      setErrors({ copyFrom: "Select the device type to clone." });
      return;
    }
    const parsed = schema.safeParse(form);
    const next: Record<string, string> = {};
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString() ?? "form";
        next[key] = issue.message;
      });
    }
    setErrors(next);
    setBleSubmitted(true);
    if (Object.keys(next).length > 0 || Object.keys(bleProfileErrors(bleToSave)).length > 0) return;
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
    <>
      <PageHeader
        title="New Device Type"
        breadcrumbs={[
          { label: "Manufacturer Panel", to: "/" },
          { label: "Device Types", to: "/device-types" },
          { label: "New" },
        ]}
      />

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl space-y-6 rounded-lg border border-border bg-surface p-4 shadow-none"
      >
        <div className="space-y-3">
          <Label>Clone an existing type?</Label>
          <RadioGroup
            value={clone}
            onValueChange={(v) => chooseClone(v as "no" | "yes")}
            className="flex flex-wrap gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="clone-no" value="no" />
              <Label htmlFor="clone-no" className="font-normal">
                No, enter all fields
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="clone-yes" value="yes" />
              <Label htmlFor="clone-yes" className="font-normal">
                Yes, fill from an existing type
              </Label>
            </div>
          </RadioGroup>
          {clone === "yes" && (
            <div className="space-y-1.5">
              <Select value={copyFromId} onValueChange={(v) => void chooseSource(v)}>
                <SelectTrigger
                  id="copy-from"
                  aria-label="Device type to clone"
                  className="bg-background"
                >
                  <SelectValue placeholder="Select the device type to clone" />
                </SelectTrigger>
                <SelectContent>
                  {activeTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.TypeName} ({t.TypeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors["copyFrom"] && (
                <p className="text-xs text-destructive">{errors["copyFrom"]}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Fills the fields, BLE profile and default configuration from that type. Enter a new
                Type Code and QR Serial Prefix; everything else can be changed before saving.
              </p>
            </div>
          )}
        </div>

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
            {errors["TypeCode"] && <p className="text-xs text-destructive">{errors["TypeCode"]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type-name">Type Name</Label>
            <Input
              id="type-name"
              className="bg-background"
              value={form.TypeName}
              onChange={(e) => setField("TypeName", e.target.value)}
              maxLength={120}
            />
            {errors["TypeName"] && <p className="text-xs text-destructive">{errors["TypeName"]}</p>}
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
          {errors["Description"] && (
            <p className="text-xs text-destructive">{errors["Description"]}</p>
          )}
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
            {errors["ManufacturerName"] && (
              <p className="text-xs text-destructive">{errors["ManufacturerName"]}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Device Category</Label>
            <Select
              value={form.DeviceCategory}
              onValueChange={(v) => setField("DeviceCategory", v as DeviceCategory)}
            >
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
            {errors["HardwareVersion"] && (
              <p className="text-xs text-destructive">{errors["HardwareVersion"]}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qr-prefix">QR Serial Prefix</Label>
            <Input
              id="qr-prefix"
              className="bg-background font-mono uppercase"
              value={form.QrSerialPrefix}
              onChange={(e) => setField("QrSerialPrefix", e.target.value)}
              maxLength={20}
              placeholder="e.g. DK"
            />
            <p className="text-xs text-muted-foreground">
              Text in front of the serial on the device QR code.
            </p>
            {errors["QrSerialPrefix"] && (
              <p className="text-xs text-destructive">{errors["QrSerialPrefix"]}</p>
            )}
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
            {errors["RssiConnectMinimum"] && (
              <p className="text-xs text-destructive">{errors["RssiConnectMinimum"]}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Switch
            id="active"
            checked={form.Active}
            onCheckedChange={(v) => setField("Active", v)}
          />
          <Label htmlFor="active">Active</Label>
          <span className="text-xs text-muted-foreground">
            Active types can be selected when adding devices.
          </span>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <h2 className="text-sm font-semibold">BLE profile</h2>
            <p className="text-xs text-muted-foreground">
              Leave Profile Name, Published Name or Prefix empty to use the Type Code.
            </p>
          </div>
          <BleProfileFields
            values={ble}
            onChange={setBle}
            disabled={loadingClone}
            errors={bleErrors}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/device-types" })}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating..." : "Create device type"}
          </Button>
        </div>
      </form>
    </>
  );
}
