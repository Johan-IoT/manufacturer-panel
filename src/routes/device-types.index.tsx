import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { ActiveBadge, CategoryBadge, DeviceTypeBadge } from "@/components/app/badges";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deviceTypeService } from "@/services";
import { toUserMessage } from "@/services/client";
import { iconTone } from "@/lib/icon-colors";
import { cn } from "@/lib/utils";
import { DEVICE_CATEGORIES, type DeviceType } from "@/types/entities";
import { usePermissions } from "@/lib/auth";

export const Route = createFileRoute("/device-types/")({
  head: () => ({
    meta: [
      { title: "Device Types | Manufacturer Panel | ConfigGate" },
      { name: "description", content: "Manage device types, RSSI thresholds and their BLE profiles." },
      { property: "og:title", content: "Device Types | Manufacturer Panel" },
      { property: "og:description", content: "Device type catalogue for the ConfigGate BLE ecosystem." },
    ],
  }),
  component: DeviceTypesPage,
});

function DeviceTypesPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const query = useQuery({ queryKey: ["device-types"], queryFn: () => deviceTypeService.list() });
  const queryClient = useQueryClient();
  /** Device type waiting for the delete confirmation. */
  const [deleteType, setDeleteType] = useState<DeviceType | null>(null);
  const removeType = useMutation({
    mutationFn: (type: DeviceType) => deviceTypeService.remove(type.id),
    onSuccess: (_result, type) => {
      toast.success(`Device type ${type.TypeCode} deleted.`);
      setDeleteType(null);
      void queryClient.invalidateQueries({ queryKey: ["device-types"] });
      void queryClient.removeQueries({ queryKey: ["device-type", type.id] });
    },
    onError: (error) => {
      setDeleteType(null);
      toast.error(toUserMessage(error, "Unable to delete this device type. Please try again."));
    },
  });

  const columns: Column<DeviceType>[] = [
    { key: "code", header: "Type Code", sortValue: (t) => t.TypeCode, render: (t) => <DeviceTypeBadge code={t.TypeCode} /> },
    { key: "name", header: "Type Name", sortValue: (t) => t.TypeName, render: (t) => t.TypeName },
    { key: "cat", header: "Category", render: (t) => <CategoryBadge category={t.DeviceCategory} /> },
    { key: "hw", header: "Hardware Version", render: (t) => <span className="font-mono text-xs">{t.HardwareVersion}</span> },
    { key: "rssi", header: "RSSI Minimum", render: (t) => <span className="tabular-nums">{t.RssiConnectMinimum} dBm</span> },
    { key: "active", header: "Active", render: (t) => <ActiveBadge active={t.Active} /> },
  ];

  return (
    <>
      <PageHeader
        title="Device Types"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Device Types" }]}
        actions={
          permissions.canManageDeviceTypes ? (
            <Button onClick={() => navigate({ to: "/device-types/new" })}>
              <Plus className="size-4" /> New Device Type
            </Button>
          ) : undefined
        }
      />
      <DataTable
        // Johan: show active types by default; inactive ones via the Active filter.
        initialFilterValues={{ active: "yes" }}
        data={query.data}
        columns={columns}
        rowKey={(t) => t.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Search by code or name"
        searchFields={[(t) => t.TypeCode, (t) => t.TypeName, (t) => t.ManufacturerName]}
        filters={[
          {
            key: "cat",
            label: "Category",
            options: DEVICE_CATEGORIES.map((c) => ({ value: c, label: c })),
            predicate: (t, v) => t.DeviceCategory === v,
          },
          {
            key: "active",
            label: "Active",
            options: [
              { value: "yes", label: "Active" },
              { value: "no", label: "Inactive" },
            ],
            predicate: (t, v) => (v === "yes" ? t.Active : !t.Active),
          },
        ]}
        onRowClick={(t) => navigate({ to: "/device-types/$typeId", params: { typeId: t.id } })}
        emptyTitle="No device types"
        rowActions={(t) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreHorizontal className={cn("size-4", iconTone.muted)} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/device-types/$typeId", params: { typeId: t.id } })}
              >
                Open Device Type
              </DropdownMenuItem>
              {permissions.canManageDeviceTypes && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setDeleteType(t)}
                >
                  <Trash2 className={cn("size-4", iconTone.danger)} /> Delete Device Type
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <ConfirmationDialog
        open={!!deleteType}
        onOpenChange={(open) => !open && setDeleteType(null)}
        title="Delete device type permanently?"
        description={`This permanently deletes ${deleteType?.TypeCode ?? ""} (${deleteType?.TypeName ?? ""}) with its BLE profile and default configuration. A device type that devices still use cannot be deleted; delete those devices first. This cannot be undone.`}
        confirmLabel="Delete Device Type"
        destructive
        loading={removeType.isPending}
        onConfirm={() => deleteType && removeType.mutate(deleteType)}
      />
    </>
  );
}
