import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Eye, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActiveBadge, DeviceStatus, DeviceTypeBadge } from "@/components/app/badges";
import { ConfirmationDialog, SideDrawer } from "@/components/app/dialogs";
import { deviceService, deviceTypeService } from "@/services";
import { toUserMessage } from "@/services/client";
import { DEVICE_STATUSES, type Device } from "@/types/entities";
import { formatDate, formatDateTime, maskValue } from "@/lib/format";
import { usePermissions } from "@/lib/auth";

export const Route = createFileRoute("/devices/")({
  head: () => ({
    meta: [
      { title: "Devices — Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Search, filter and inspect every manufactured BLE device by serial number." },
      { property: "og:title", content: "Devices — Manufacturer Panel" },
      { property: "og:description", content: "Device fleet management for the GSM Systems BLE ecosystem." },
    ],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [quickView, setQuickView] = useState<Device | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Device | null>(null);

  const devicesQuery = useQuery({ queryKey: ["devices"], queryFn: () => deviceService.list() });
  const typesQuery = useQuery({ queryKey: ["device-types"], queryFn: () => deviceTypeService.list() });

  const typeOf = (id: string) => typesQuery.data?.find((t) => t.id === id);

  const deactivate = useMutation({
    mutationFn: (serial: string) => deviceService.deactivate(serial),
    onSuccess: () => {
      toast.success("Device deactivated successfully.");
      setToDeactivate(null);
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error) => toast.error(toUserMessage(error, "Unable to deactivate this device. Please try again.")),
  });

  const columns: Column<Device>[] = [
    {
      key: "serial",
      header: "Serial Number",
      sortValue: (d) => d.SerialNumber,
      render: (d) => <span className="font-mono text-xs text-foreground">{d.SerialNumber}</span>,
    },
    {
      key: "name",
      header: "Device Name",
      sortValue: (d) => d.DeviceName,
      render: (d) => <span className="text-sm text-foreground">{d.DeviceName}</span>,
    },
    {
      key: "type",
      header: "Device Type",
      sortValue: (d) => typeOf(d.DeviceTypeId)?.TypeName ?? "",
      render: (d) => {
        const t = typeOf(d.DeviceTypeId);
        return t ? <DeviceTypeBadge code={t.TypeCode} name={t.TypeName} /> : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      sortValue: (d) => d.DeviceStatus,
      render: (d) => <DeviceStatus status={d.DeviceStatus} />,
    },
    { key: "fw", header: "Firmware", render: (d) => <span className="font-mono text-xs">{d.FirmwareVersion}</span> },
    {
      key: "contact",
      header: "Last Server Contact",
      sortValue: (d) => d.LastServerContactAt ?? "",
      render: (d) => <span className="text-xs text-muted-foreground">{formatDateTime(d.LastServerContactAt)}</span>,
    },
    { key: "active", header: "Active", render: (d) => <ActiveBadge active={d.Active} /> },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Devices"
        description="Serial Number is the single authoritative identity for every device. BLE names and MAC addresses are diagnostic only."
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Devices" }]}
      />

      <DataTable
        data={devicesQuery.data}
        columns={columns}
        rowKey={(d) => d.SerialNumber}
        isLoading={devicesQuery.isLoading || typesQuery.isLoading}
        isError={devicesQuery.isError}
        onRetry={() => void devicesQuery.refetch()}
        searchPlaceholder="Search by serial, name or type"
        searchFields={[
          (d) => d.SerialNumber,
          (d) => d.DeviceName,
          (d) => typeOf(d.DeviceTypeId)?.TypeName ?? "",
        ]}
        filters={[
          {
            key: "type",
            label: "Device Type",
            options: (typesQuery.data ?? []).map((t) => ({ value: t.id, label: t.TypeName })),
            predicate: (d, v) => d.DeviceTypeId === v,
          },
          {
            key: "status",
            label: "Status",
            options: DEVICE_STATUSES.map((s) => ({ value: s, label: s })),
            predicate: (d, v) => d.DeviceStatus === v,
          },
          {
            key: "active",
            label: "Active",
            options: [
              { value: "yes", label: "Active" },
              { value: "no", label: "Inactive" },
            ],
            predicate: (d, v) => (v === "yes" ? d.Active : !d.Active),
          },
        ]}
        onRowClick={(d) => navigate({ to: "/devices/$serial", params: { serial: d.SerialNumber } })}
        emptyTitle="No devices registered"
        emptyDescription="Devices appear here once they are manufactured and registered through the backend."
        rowActions={(d) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setQuickView(d)}>
                <Eye className="size-4" /> Quick view
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/devices/$serial", params: { serial: d.SerialNumber } })}
              >
                Open device
              </DropdownMenuItem>
              {permissions.canDeactivateDevice && d.Active && (
                <DropdownMenuItem variant="destructive" onSelect={() => setToDeactivate(d)}>
                  <Ban className="size-4" /> Deactivate device
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <SideDrawer
        open={!!quickView}
        onOpenChange={(v) => !v && setQuickView(null)}
        title={quickView?.SerialNumber ?? "Device"}
        description="Quick inspection. Open the device for relationships and full detail."
      >
        {quickView && (
          <dl className="space-y-3 py-4 text-sm">
            {[
              ["Device Name", quickView.DeviceName],
              ["Device Type", typeOf(quickView.DeviceTypeId)?.TypeName ?? "—"],
              ["Status", quickView.DeviceStatus],
              ["Firmware Version", quickView.FirmwareVersion],
              ["Hardware Version", quickView.HardwareVersion],
              ["Manufactured At", formatDate(quickView.ManufacturedAt)],
              ["Registered At", formatDate(quickView.RegisteredAt)],
              ["Last BLE Connection", formatDateTime(quickView.LastBleConnectionAt)],
              ["Last Server Contact", formatDateTime(quickView.LastServerContactAt)],
              ["QR Code Value", maskValue(quickView.QrCodeValue, 6)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right text-foreground">{value}</dd>
              </div>
            ))}
            <Button
              className="mt-2 w-full"
              onClick={() => {
                const serial = quickView.SerialNumber;
                setQuickView(null);
                navigate({ to: "/devices/$serial", params: { serial } });
              }}
            >
              Open device detail
            </Button>
          </dl>
        )}
      </SideDrawer>

      <ConfirmationDialog
        open={!!toDeactivate}
        onOpenChange={(v) => !v && setToDeactivate(null)}
        title="Deactivate this device?"
        description={`Are you sure you want to deactivate ${toDeactivate?.SerialNumber ?? ""}? Device history is preserved; the device is never deleted.`}
        confirmLabel="Deactivate device"
        destructive
        loading={deactivate.isPending}
        onConfirm={() => toDeactivate && deactivate.mutate(toDeactivate.SerialNumber)}
      />
    </AppShell>
  );
}
