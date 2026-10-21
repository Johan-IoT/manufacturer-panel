import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { SerialQrScannerDialog } from "@/components/devices/serial-qr-scanner-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/auth";
import { parseScannedSerial } from "@/lib/qr-serial";
import { deviceService, deviceTypeService } from "@/services";
import { ApiError, toUserMessage } from "@/services/client";

export const Route = createFileRoute("/devices/new")({
  head: () => ({
    meta: [
      { title: "Add Device | Manufacturer Panel | ConfigGate" },
      {
        name: "description",
        content: "Register a new device by serial number (typed or scanned from the QR code).",
      },
      { property: "og:title", content: "Add Device | Manufacturer Panel" },
      { property: "og:description", content: "Manufacturer device registration." },
    ],
  }),
  component: AddDevicePage,
});

/**
 * Johan (19 Oct): the panel adds a device without Bluetooth. Type the serial or
 * scan the QR (prefix + serial), select the device type, fill the details and
 * save. Connecting to the device is done in the app.
 */
function AddDevicePage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const queryClient = useQueryClient();

  const [serialNumber, setSerialNumber] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [registeredSerial, setRegisteredSerial] = useState<string | null>(null);

  const typesQuery = useQuery({
    queryKey: ["device-types"],
    queryFn: () => deviceTypeService.list(),
  });

  const activeTypes = useMemo(
    () => (typesQuery.data ?? []).filter((t) => t.Active),
    [typesQuery.data],
  );
  const selectedType = activeTypes.find((t) => t.id === selectedTypeId) ?? null;

  const registerMutation = useMutation({
    mutationFn: () =>
      deviceService.register({
        serialNumber: serialNumber.trim(),
        deviceTypeId: selectedTypeId,
        name: deviceName.trim() || serialNumber.trim(),
        firmwareVersion: firmwareVersion.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setRegisteredSerial(serialNumber.trim());
      setErrorMessage(null);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setErrorMessage("A device with this serial number is already registered.");
        return;
      }
      setErrorMessage(toUserMessage(error, "Device registration failed. Please try again."));
    },
  });

  if (!permissions.canDeactivateDevice) {
    return (
      <>
        <PageHeader
          title="Add Device"
          breadcrumbs={[
            { label: "Manufacturer Panel", to: "/" },
            { label: "Devices", to: "/devices" },
            { label: "Add Device" },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Only active Manufacturer accounts can register devices.
        </p>
      </>
    );
  }

  function clearError(key: string) {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setErrorMessage(null);
  }

  function handleQrCapture(value: string) {
    const parsed = parseScannedSerial(value, activeTypes, selectedType);
    setSerialNumber(parsed.serial);
    clearError("serial");
    if (parsed.deviceType) {
      setSelectedTypeId(parsed.deviceType.id);
      clearError("type");
      toast.success(`Serial captured. Device type set to ${parsed.deviceType.TypeName}.`);
    } else {
      toast.success("Serial number captured from QR code.");
    }
  }

  function handleRegister() {
    const next: Record<string, string> = {};
    const serial = serialNumber.trim();
    if (!serial) next["serial"] = "Serial number is required.";
    else if (serial.length < 3) next["serial"] = "Serial number is too short.";
    if (!selectedTypeId) next["type"] = "Select a device type.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    registerMutation.mutate();
  }

  function resetForm() {
    setSerialNumber("");
    setDeviceName("");
    setFirmwareVersion("");
    setErrors({});
    setErrorMessage(null);
    setRegisteredSerial(null);
  }

  return (
    <>
      <PageHeader
        title="Add Device"
        breadcrumbs={[
          { label: "Manufacturer Panel", to: "/" },
          { label: "Devices", to: "/devices" },
          { label: "Add Device" },
        ]}
      />

      <div className="mx-auto max-w-2xl space-y-6">
        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {registeredSerial ? (
          <section className="space-y-4 rounded-lg border border-border bg-surface p-4 shadow-none">
            <p className="text-sm text-foreground">
              Device <span className="font-mono">{registeredSerial}</span> was registered
              successfully.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  void navigate({ to: "/devices/$serial", params: { serial: registeredSerial } })
                }
              >
                Open device
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Add another device
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigate({ to: "/devices" })}
              >
                Back to Devices
              </Button>
            </div>
          </section>
        ) : (
          <section className="space-y-5 rounded-lg border border-border bg-surface p-4 shadow-none">
            <p className="text-sm text-muted-foreground">
              Type the serial number or scan the device QR code, select the device type and save.
              Connecting to the device is done in the app.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="serial-number">Serial Number</Label>
              <div className="flex gap-2">
                <Input
                  id="serial-number"
                  className="bg-background font-mono"
                  value={serialNumber}
                  aria-invalid={!!errors["serial"]}
                  onChange={(e) => {
                    setSerialNumber(e.target.value);
                    clearError("serial");
                  }}
                />
                <Button type="button" variant="outline" onClick={() => setQrOpen(true)}>
                  <QrCode className="mr-2 size-4" /> Scan QR
                </Button>
              </div>
              {errors["serial"] && <p className="text-xs text-destructive">{errors["serial"]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="device-type">Device Type</Label>
              <Select
                value={selectedTypeId}
                onValueChange={(v) => {
                  setSelectedTypeId(v);
                  clearError("type");
                }}
              >
                <SelectTrigger
                  id="device-type"
                  className="bg-background"
                  aria-invalid={!!errors["type"]}
                >
                  <SelectValue
                    placeholder={
                      typesQuery.isLoading ? "Loading device types..." : "Select a device type"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {activeTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.TypeName} ({type.TypeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors["type"] && <p className="text-xs text-destructive">{errors["type"]}</p>}
              {selectedType && (
                <p className="text-xs text-muted-foreground">
                  Hardware Version: {selectedType.HardwareVersion || "Not set"}
                  {selectedType.QrSerialPrefix
                    ? ` | QR Serial Prefix: ${selectedType.QrSerialPrefix}`
                    : ""}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="device-name">Device Name (optional)</Label>
                <Input
                  id="device-name"
                  className="bg-background"
                  value={deviceName}
                  maxLength={150}
                  placeholder={serialNumber.trim() || "Defaults to the serial number"}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="firmware-version">Firmware Version (optional)</Label>
                <Input
                  id="firmware-version"
                  className="bg-background font-mono"
                  value={firmwareVersion}
                  maxLength={50}
                  onChange={(e) => setFirmwareVersion(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigate({ to: "/devices" })}
                disabled={registerMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleRegister} disabled={registerMutation.isPending}>
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Registering...
                  </>
                ) : (
                  "Register Device"
                )}
              </Button>
            </div>
          </section>
        )}
      </div>

      <SerialQrScannerDialog open={qrOpen} onOpenChange={setQrOpen} onCapture={handleQrCapture} />
    </>
  );
}
