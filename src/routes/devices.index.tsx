import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Eye, MoreHorizontal, Plus, ShieldOff, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeviceStatus, DeviceTypeBadge } from "@/components/app/badges";
import { ConfirmationDialog, SideDrawer } from "@/components/app/dialogs";
import { useDeviceStatusAction } from "@/components/devices/device-status-action";
import { deviceService, deviceTypeService, relationshipService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import {
  DEVICE_STATUSES,
  type AppUser,
  type Device,
  type DeviceStatus as DeviceStatusValue,
} from "@/types/entities";
import {
  DEVICE_STATUS_ACTION_COPY,
  canDecommission,
  canReinstate,
  canSuspend,
  isDeviceStatus,
} from "@/lib/device-state";
import { formatDate, formatDateTime, maskValue } from "@/lib/format";
import { iconTone } from "@/lib/icon-colors";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/auth";

interface DevicesSearch {
  type?: string | undefined;
  status?: DeviceStatusValue | undefined;
}

export const Route = createFileRoute("/devices/")({
  validateSearch: (search: Record<string, unknown>): DevicesSearch => ({
    type: typeof search["type"] === "string" && search["type"] ? search["type"] : undefined,
    status: isDeviceStatus(search["status"]) ? search["status"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Devices | Manufacturer Panel | ConfigGate" },
      {
        name: "description",
        content: "Search, filter and inspect every manufactured BLE device by serial number.",
      },
      { property: "og:title", content: "Devices | Manufacturer Panel" },
      {
        property: "og:description",
        content: "Device fleet management for the ConfigGate BLE ecosystem.",
      },
    ],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const permissions = usePermissions();
  const [quickView, setQuickView] = useState<Device | null>(null);
  const statusAction = useDeviceStatusAction();
  const queryClient = useQueryClient();
  /** Device waiting for the delete confirmation. */
  const [deleteSerial, setDeleteSerial] = useState<string | null>(null);
  const deleteDevice = useMutation({
    mutationFn: (serial: string) => deviceService.remove(serial),
    onSuccess: (_result, serial) => {
      toast.success(`Device ${serial} deleted.`);
      setDeleteSerial(null);
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      void queryClient.removeQueries({ queryKey: ["device", serial] });
      void queryClient.invalidateQueries({ queryKey: ["links"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (error) =>
      toast.error(toUserMessage(error, "Unable to delete this device. Please try again.")),
  });

  const devicesQuery = useQuery({ queryKey: ["devices"], queryFn: () => deviceService.list() });
  const typesQuery = useQuery({
    queryKey: ["device-types"],
    queryFn: () => deviceTypeService.list(),
  });

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const linksQuery = useQuery({ queryKey: ["links"], queryFn: () => relationshipService.list() });

  const typeOf = (id: string) => typesQuery.data?.find((t) => t.id === id);
  /** The app user holding the active Owner link of a device, if any. */
  const ownerOf = (serial: string): AppUser | undefined => {
    const link = linksQuery.data?.find(
      (l) => l.DeviceSerialNumber === serial && l.LinkType === "Owner" && l.Active,
    );
    return link ? usersQuery.data?.find((u) => u.id === link.AppUserId) : undefined;
  };
  const ownerName = (u: AppUser) => `${u.FirstName} ${u.LastName}`.trim() || u.Email;

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
        return t ? (
          <DeviceTypeBadge code={t.TypeCode} name={t.TypeName} />
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      key: "owner",
      header: "Owner",
      sortValue: (d) => {
        const o = ownerOf(d.SerialNumber);
        return o ? ownerName(o).toLowerCase() : "";
      },
      render: (d) => {
        const o = ownerOf(d.SerialNumber);
        return o ? (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{ownerName(o)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[o.AppId, o.Email].filter(Boolean).join(" · ")}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No owner</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortValue: (d) => d.DeviceStatus,
      render: (d) => <DeviceStatus status={d.DeviceStatus} />,
    },
    {
      key: "fw",
      header: "Firmware",
      render: (d) => <span className="font-mono text-xs">{d.FirmwareVersion}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Devices"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Devices" }]}
        actions={
          permissions.canDeactivateDevice ? (
            <Button onClick={() => navigate({ to: "/devices/new" })}>
              <Plus className="mr-2 size-4" /> Add Device
            </Button>
          ) : undefined
        }
      />

      <DataTable
        key={`${search.type ?? "all"}-${search.status ?? "all"}`}
        initialFilterValues={{
          ...(search.type ? { type: search.type } : {}),
          ...(search.status ? { status: search.status } : {}),
        }}
        data={devicesQuery.data}
        columns={columns}
        rowKey={(d) => d.SerialNumber}
        isLoading={devicesQuery.isLoading || typesQuery.isLoading}
        isError={devicesQuery.isError}
        onRetry={() => void devicesQuery.refetch()}
        searchPlaceholder="Search by serial, name, type or owner"
        searchFields={[
          (d) => d.SerialNumber,
          (d) => d.DeviceName,
          (d) => typeOf(d.DeviceTypeId)?.TypeName ?? "",
          (d) => {
            const o = ownerOf(d.SerialNumber);
            return o ? `${ownerName(o)} ${o.AppId ?? ""} ${o.Email}` : "";
          },
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
        ]}
        onRowClick={(d) => navigate({ to: "/devices/$serial", params: { serial: d.SerialNumber } })}
        emptyTitle="No devices registered"
        rowActions={(d) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreHorizontal className={cn("size-4", iconTone.muted)} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setQuickView(d)}>
                <Eye className={cn("size-4", iconTone.info)} /> Quick View
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  navigate({ to: "/devices/$serial", params: { serial: d.SerialNumber } })
                }
              >
                Open Device
              </DropdownMenuItem>
              {permissions.canDeactivateDevice && canReinstate(d.DeviceStatus) && (
                <DropdownMenuItem
                  onSelect={() => statusAction.request("reinstate", d.SerialNumber)}
                >
                  <Undo2 className={cn("size-4", iconTone.info)} />{" "}
                  {DEVICE_STATUS_ACTION_COPY.reinstate.menuLabel}
                </DropdownMenuItem>
              )}
              {permissions.canDeactivateDevice && canSuspend(d.DeviceStatus) && (
                <DropdownMenuItem onSelect={() => statusAction.request("suspend", d.SerialNumber)}>
                  <ShieldOff className={cn("size-4", iconTone.warning)} />{" "}
                  {DEVICE_STATUS_ACTION_COPY.suspend.menuLabel}
                </DropdownMenuItem>
              )}
              {permissions.canDeactivateDevice && d.DeviceStatus !== "Decommissioned" && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={!canDecommission(d.DeviceStatus)}
                  title={
                    canDecommission(d.DeviceStatus)
                      ? undefined
                      : "Only a Released device can be decommissioned."
                  }
                  onSelect={() => statusAction.request("decommission", d.SerialNumber)}
                >
                  <Archive className={cn("size-4", iconTone.danger)} />{" "}
                  {DEVICE_STATUS_ACTION_COPY.decommission.menuLabel}
                </DropdownMenuItem>
              )}
              {permissions.canDeactivateDevice && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setDeleteSerial(d.SerialNumber)}
                >
                  <Trash2 className={cn("size-4", iconTone.danger)} /> Delete Device
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
      >
        {quickView && (
          <dl className="space-y-3 py-4 text-sm">
            {[
              ["Device Name", quickView.DeviceName],
              ["Device Type", typeOf(quickView.DeviceTypeId)?.TypeName ?? "-"],
              ["Status", quickView.DeviceStatus],
              ...(() => {
                const o = ownerOf(quickView.SerialNumber);
                return o
                  ? [
                      ["Owner", ownerName(o)],
                      ["Owner App ID", o.AppId || "-"],
                      ["Owner Email", o.Email || "-"],
                      ["Owner Mobile", o.MobileNumber || "-"],
                    ]
                  : [["Owner", "No owner"]];
              })(),
              ["Firmware Version", quickView.FirmwareVersion],
              ["Hardware Version", quickView.HardwareVersion],
              ["Manufactured At", formatDate(quickView.ManufacturedAt)],
              ["Registered At", formatDate(quickView.RegisteredAt)],
              ["Last BLE Connection", formatDateTime(quickView.LastBleConnectionAt)],
              ["Last Server Contact", formatDateTime(quickView.LastServerContactAt)],
              ["QR Code Value", maskValue(quickView.QrCodeValue, 6)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-4 border-b border-border/60 pb-2"
              >
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

      {statusAction.dialog}

      <ConfirmationDialog
        open={!!deleteSerial}
        onOpenChange={(open) => !open && setDeleteSerial(null)}
        title="Delete device permanently?"
        description={`This permanently deletes ${deleteSerial ?? ""} and everything stored for it: relationships (owner, shared, installer, manufacturer), configuration and its history, configuration history, GPS locations and notifications about it. Support chats are kept without the device. This cannot be undone.`}
        confirmLabel="Delete Device"
        destructive
        loading={deleteDevice.isPending}
        onConfirm={() => deleteSerial && deleteDevice.mutate(deleteSerial)}
      />
    </>
  );
}
