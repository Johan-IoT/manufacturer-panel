import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bluetooth, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { SerialQrScannerDialog } from "@/components/devices/serial-qr-scanner-dialog";
import { AppShell } from "@/components/app/app-shell";
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
import {
  BleError,
  BleErrors,
  isLeScanSupported,
  isWebBluetoothSupported,
  validateSerialNumber,
} from "@/lib/ble/ble-errors";
import { ParameterCodes } from "@/lib/ble/parameter-codes";
import { webBluetoothService, type DiscoveredBleDevice } from "@/lib/ble/web-bluetooth-service";
import { cn } from "@/lib/utils";
import { bleProfileService, deviceService, deviceTypeService } from "@/services";
import { ApiError, toUserMessage } from "@/services/client";
import type { BleProfile, DeviceType } from "@/types/entities";

export const Route = createFileRoute("/devices/new")({
  head: () => ({
    meta: [
      { title: "Add Device | Manufacturer Panel | ConfigGate" },
      {
        name: "description",
        content: "Register a new BLE device through serial capture and verification.",
      },
      { property: "og:title", content: "Add Device | Manufacturer Panel" },
      { property: "og:description", content: "Manufacturer device registration wizard." },
    ],
  }),
  component: AddDevicePage,
});

type WizardStep =
  "serial" | "deviceType" | "bleScan" | "selectDevice" | "processing" | "register" | "success";

const STEP_LABELS: Record<WizardStep, string> = {
  serial: "Serial Number",
  deviceType: "Device Type",
  bleScan: "BLE Scan",
  selectDevice: "Select Device",
  processing: "BLE Verification",
  register: "Register",
  success: "Complete",
};

const STEP_ORDER: WizardStep[] = [
  "serial",
  "deviceType",
  "bleScan",
  "selectDevice",
  "processing",
  "register",
  "success",
];

function AddDevicePage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>("serial");
  const [serialNumber, setSerialNumber] = useState("");
  const [serialError, setSerialError] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [bleProfile, setBleProfile] = useState<BleProfile | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredBleDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [processingMessage, setProcessingMessage] = useState("");
  const [deviceIdentity, setDeviceIdentity] = useState<Record<string, string> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pickerMode, setPickerMode] = useState(false);

  const typesQuery = useQuery({
    queryKey: ["device-types"],
    queryFn: () => deviceTypeService.list(),
  });

  const activeTypes = useMemo(
    () => (typesQuery.data ?? []).filter((t) => t.Active),
    [typesQuery.data],
  );

  const selectedType = activeTypes.find((t) => t.id === selectedTypeId) ?? null;
  const selectedDevice = discoveredDevices.find((d) => d.id === selectedDeviceId) ?? null;

  const registerMutation = useMutation({
    mutationFn: () =>
      deviceService.register({
        serialNumber: serialNumber.trim(),
        deviceTypeId: selectedTypeId,
        name: deviceIdentity?.[ParameterCodes.deviceName]?.trim() || serialNumber.trim(),
        firmwareVersion: deviceIdentity?.[ParameterCodes.firmwareVersion]?.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      setStep("success");
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

  useEffect(() => {
    return () => {
      void webBluetoothService.stopScan();
      void webBluetoothService.disconnect();
      webBluetoothService.clearConfiguration();
    };
  }, []);

  if (!permissions.canDeactivateDevice) {
    return (
      <AppShell>
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
      </AppShell>
    );
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  function resetErrors() {
    setErrorMessage(null);
    setSerialError(null);
  }

  function goBack() {
    resetErrors();
    if (step === "deviceType") {
      setStep("serial");
      return;
    }
    if (step === "bleScan") {
      void webBluetoothService.stopScan();
      setScanning(false);
      setStep("deviceType");
      return;
    }
    if (step === "selectDevice") {
      void webBluetoothService.stopScan();
      setScanning(false);
      setDiscoveredDevices([]);
      setSelectedDeviceId("");
      setStep("bleScan");
      return;
    }
    if (step === "register") {
      setStep("selectDevice");
    }
  }

  async function loadBleProfile(type: DeviceType) {
    const profile = await bleProfileService.getForDeviceType(type.id);
    webBluetoothService.configure(profile);
    setBleProfile(profile);
  }

  async function handleSerialNext() {
    resetErrors();
    const validation = validateSerialNumber(serialNumber);
    if (validation) {
      setSerialError(validation);
      return;
    }
    setStep("deviceType");
  }

  async function handleDeviceTypeNext() {
    resetErrors();
    if (!selectedType) {
      setErrorMessage("Select a device type to continue.");
      return;
    }
    try {
      await loadBleProfile(selectedType);
      setStep("bleScan");
    } catch (error) {
      setErrorMessage(toUserMessage(error, BleErrors.profileUnavailable));
    }
  }

  async function handleStartScan() {
    resetErrors();
    if (!isWebBluetoothSupported()) {
      setErrorMessage(BleErrors.unsupported);
      setPickerMode(true);
      return;
    }
    setPickerMode(!isLeScanSupported());
    setScanning(true);
    setDiscoveredDevices([]);
    try {
      if (isLeScanSupported()) {
        await webBluetoothService.startScan(setDiscoveredDevices);
      } else {
        setErrorMessage(BleErrors.scanUnsupported);
      }
    } catch (error) {
      setScanning(false);
      setPickerMode(true);
      setErrorMessage(error instanceof BleError ? error.message : BleErrors.scanUnsupported);
    }
  }

  async function handleBrowserPicker() {
    resetErrors();
    try {
      const device = await webBluetoothService.requestDeviceFromPicker();
      setDiscoveredDevices([device]);
      setSelectedDeviceId(device.id);
      setStep("selectDevice");
    } catch (error) {
      setErrorMessage(error instanceof BleError ? error.message : BleErrors.noDevicesFound);
    }
  }

  function handleScanNext() {
    resetErrors();
    void webBluetoothService.stopScan();
    setScanning(false);
    if (discoveredDevices.length === 0) {
      setErrorMessage(BleErrors.noDevicesFound);
      return;
    }
    setStep("selectDevice");
  }

  async function handleSelectDeviceNext() {
    resetErrors();
    if (!selectedDevice) {
      setErrorMessage("Select a BLE device to continue.");
      return;
    }
    setStep("processing");
    setProcessingMessage("Connecting to device...");

    try {
      await webBluetoothService.connect(selectedDevice);
      setProcessingMessage("Discovering BLE service and characteristics...");
      setProcessingMessage("Activating RX notifications...");
      await webBluetoothService.registerReceive();
      setProcessingMessage("Reading physical serial number...");
      const physicalSerial = await webBluetoothService.readParameter(ParameterCodes.serialNumber);
      if (!physicalSerial.trim()) {
        throw new BleError(BleErrors.serialReadFailed);
      }
      if (physicalSerial.trim() !== serialNumber.trim()) {
        await webBluetoothService.disconnect();
        setErrorMessage(BleErrors.serialMismatch);
        setStep("selectDevice");
        return;
      }
      setProcessingMessage("Reading device information...");
      const identity = await webBluetoothService.readDeviceIdentity();
      await webBluetoothService.disconnect();
      setDeviceIdentity(identity);
      setStep("register");
      setProcessingMessage("");
    } catch (error) {
      await webBluetoothService.disconnect();
      setProcessingMessage("");
      setErrorMessage(error instanceof BleError ? error.message : BleErrors.connectionFailed);
      setStep("selectDevice");
    }
  }

  function handleRegister() {
    resetErrors();
    registerMutation.mutate();
  }

  function handleCancel() {
    void webBluetoothService.stopScan();
    void webBluetoothService.disconnect();
    webBluetoothService.clearConfiguration();
    void navigate({ to: "/devices" });
  }

  return (
    <AppShell>
      <PageHeader
        title="Add Device"
        breadcrumbs={[
          { label: "Manufacturer Panel", to: "/" },
          { label: "Devices", to: "/devices" },
          { label: "Add Device" },
        ]}
        actions={
          step !== "success" ? (
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <StepIndicator currentIndex={stepIndex} />

        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <section className="rounded-lg border border-border bg-surface p-4 shadow-none">
          <h2 className="mb-1 text-sm font-semibold">{STEP_LABELS[step]}</h2>

          {step === "serial" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the device serial number manually or scan the QR code. QR capture does not
                authorize the device.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="serial-number">Serial Number</Label>
                <Input
                  id="serial-number"
                  className="bg-background font-mono"
                  value={serialNumber}
                  onChange={(e) => {
                    setSerialNumber(e.target.value);
                    setSerialError(null);
                  }}
                />
                {serialError && <p className="text-xs text-destructive">{serialError}</p>}
              </div>
              <Button type="button" variant="outline" onClick={() => setQrOpen(true)}>
                <QrCode className="mr-2 size-4" /> Scan QR Code
              </Button>
            </div>
          )}

          {step === "deviceType" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select the device type. Its BLE profile defines service and characteristic UUIDs.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="device-type">Device Type</Label>
                <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                  <SelectTrigger id="device-type" className="bg-background">
                    <SelectValue placeholder="Select a device type" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.TypeName} ({type.TypeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === "bleScan" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan for nearby BLE devices that match the selected device type profile.
              </p>
              {selectedType && (
                <p className="text-xs text-muted-foreground">
                  Type: {selectedType.TypeName} | Prefix: {bleProfile?.PublishedNamePrefix || "—"}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void handleStartScan()} disabled={scanning}>
                  {scanning ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Scanning...
                    </>
                  ) : (
                    <>
                      <Bluetooth className="mr-2 size-4" /> Start BLE Scan
                    </>
                  )}
                </Button>
                {scanning && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void webBluetoothService.stopScan();
                      setScanning(false);
                    }}
                  >
                    Stop Scan
                  </Button>
                )}
              </div>
              {pickerMode && (
                <div className="space-y-2 rounded-md border border-border/70 bg-background/40 p-3">
                  <p className="text-sm text-muted-foreground">
                    BLE scanning is unavailable in this browser. Use the browser device picker
                    instead.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleBrowserPicker()}
                  >
                    Select Device from Browser Picker
                  </Button>
                </div>
              )}
              {discoveredDevices.length > 0 && (
                <ul className="space-y-2">
                  {discoveredDevices.map((device) => (
                    <li
                      key={device.id}
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div className="font-medium">{device.name}</div>
                      <div className="text-xs text-muted-foreground">
                        RSSI: {device.rssi !== 0 ? `${device.rssi} dBm` : "N/A"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === "selectDevice" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select the physical device to connect and verify.
              </p>
              {discoveredDevices.length === 0 ? (
                <Button type="button" variant="outline" onClick={() => void handleBrowserPicker()}>
                  Select Device from Browser Picker
                </Button>
              ) : (
                <div className="space-y-2">
                  {discoveredDevices.map((device) => (
                    <button
                      key={device.id}
                      type="button"
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        selectedDeviceId === device.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40",
                      )}
                      onClick={() => setSelectedDeviceId(device.id)}
                    >
                      <div className="font-medium">{device.name}</div>
                      <div className="text-xs text-muted-foreground">
                        RSSI: {device.rssi !== 0 ? `${device.rssi} dBm` : "N/A"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "processing" && (
            <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {processingMessage || "Processing BLE verification..."}
            </div>
          )}

          {step === "register" && (
            <div className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <InfoRow label="Serial Number" value={serialNumber.trim()} mono />
                <InfoRow label="Device Type" value={selectedType?.TypeName ?? "—"} />
                <InfoRow
                  label="Device Name"
                  value={deviceIdentity?.[ParameterCodes.deviceName]?.trim() || serialNumber.trim()}
                />
                <InfoRow
                  label="Firmware Version"
                  value={deviceIdentity?.[ParameterCodes.firmwareVersion]?.trim() || "—"}
                  mono
                />
                <InfoRow
                  label="Hardware Version"
                  value={selectedType?.HardwareVersion || "—"}
                  mono
                />
              </dl>
              <p className="text-xs text-muted-foreground">
                Physical serial verification succeeded. Registering will create the device record
                and manufacturer link in the backend.
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-foreground">
                Device <span className="font-mono">{serialNumber.trim()}</span> was registered
                successfully.
              </p>
              <Button type="button" onClick={() => void navigate({ to: "/devices" })}>
                Back to Devices
              </Button>
            </div>
          )}
        </section>

        {step !== "success" && step !== "processing" && (
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={step === "serial" ? handleCancel : goBack}
              disabled={registerMutation.isPending}
            >
              <ArrowLeft className="mr-2 size-4" />
              {step === "serial" ? "Cancel" : "Back"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (step === "serial") void handleSerialNext();
                else if (step === "deviceType") void handleDeviceTypeNext();
                else if (step === "bleScan") handleScanNext();
                else if (step === "selectDevice") void handleSelectDeviceNext();
                else if (step === "register") handleRegister();
              }}
              disabled={
                registerMutation.isPending ||
                (step === "serial" && !serialNumber.trim()) ||
                (step === "deviceType" && !selectedTypeId) ||
                (step === "bleScan" && discoveredDevices.length === 0) ||
                (step === "selectDevice" && !selectedDeviceId)
              }
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Registering...
                </>
              ) : step === "register" ? (
                "Register Device"
              ) : step === "selectDevice" ? (
                "Connect and Verify"
              ) : (
                "Next"
              )}
            </Button>
          </div>
        )}
      </div>

      <SerialQrScannerDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        onCapture={(value) => {
          setSerialNumber(value);
          setSerialError(null);
          toast.success("Serial number captured from QR code.");
        }}
      />
    </AppShell>
  );
}

function StepIndicator({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="flex gap-1">
      {STEP_ORDER.slice(0, -1).map((key, index) => (
        <div
          key={key}
          className={cn(
            "h-1 flex-1 rounded-full",
            index <= currentIndex ? "bg-primary" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
