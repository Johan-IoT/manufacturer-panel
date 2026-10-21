import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormModal } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deviceService } from "@/services";
import { toUserMessage } from "@/services/client";
import type { Device } from "@/types/entities";

/** Device Name is at most 31 characters (Johan, 19 Oct). */
const DEVICE_NAME_MAX = 31;

type DeviceDetails = Pick<Device, "DeviceName" | "FirmwareVersion" | "HardwareVersion">;

const FIELDS: { key: keyof DeviceDetails; label: string; max: number; mono?: boolean }[] = [
  { key: "DeviceName", label: "Device Name", max: DEVICE_NAME_MAX },
  { key: "FirmwareVersion", label: "Firmware Version", max: 50, mono: true },
  { key: "HardwareVersion", label: "Hardware Version", max: 50, mono: true },
];

/**
 * Edit the device details entered by hand. Serial number, device type, status
 * and the BLE / GPS diagnostics are not editable. Only changed fields are sent.
 */
export function EditDeviceDialog({
  device,
  open,
  onOpenChange,
}: {
  device: Device;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const initial = (): DeviceDetails => ({
    DeviceName: device.DeviceName ?? "",
    FirmwareVersion: device.FirmwareVersion ?? "",
    HardwareVersion: device.HardwareVersion ?? "",
  });
  const [values, setValues] = useState<DeviceDetails>(initial);

  useEffect(() => {
    if (open) setValues(initial());
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const changes = FIELDS.reduce<Partial<DeviceDetails>>((acc, { key }) => {
    const next = values[key].trim();
    if (next !== (device[key] ?? "").trim()) acc[key] = next;
    return acc;
  }, {});
  const hasChanges = Object.keys(changes).length > 0;

  const save = useMutation({
    mutationFn: () => deviceService.updateDetails(device.SerialNumber, changes),
    onSuccess: () => {
      toast.success("Device details saved successfully.");
      void queryClient.invalidateQueries({ queryKey: ["device", device.SerialNumber] });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(toUserMessage(e, "Unable to save the device details. Please try again.")),
  });

  return (
    <FormModal
      open={open}
      onOpenChange={(v) => !save.isPending && onOpenChange(v)}
      title="Edit device details"
      description={`Serial number ${device.SerialNumber}. Leave Device Name empty to use the serial number.`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (hasChanges) save.mutate();
        }}
      >
        {FIELDS.map(({ key, label, max, mono }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`device-${key}`}>{label}</Label>
            <Input
              id={`device-${key}`}
              className={mono ? "bg-background font-mono" : "bg-background"}
              value={values[key]}
              maxLength={max}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            />
            {key === "DeviceName" && (
              <p className="text-xs text-muted-foreground">
                {values.DeviceName.length}/{DEVICE_NAME_MAX} characters
              </p>
            )}
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!hasChanges || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
