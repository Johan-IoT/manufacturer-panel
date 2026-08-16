import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { ActiveBadge, CategoryBadge, DeviceTypeBadge, Pill } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { deviceTypeService } from "@/services";
import { DEVICE_CATEGORIES, type DeviceType } from "@/types/entities";
import { usePermissions } from "@/lib/auth";

export const Route = createFileRoute("/device-types/")({
  head: () => ({
    meta: [
      { title: "Device Types | Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Manage device types, claim rules, RSSI thresholds and their single active BLE profile." },
      { property: "og:title", content: "Device Types | Manufacturer Panel" },
      { property: "og:description", content: "Device type catalogue for the GSM Systems BLE ecosystem." },
    ],
  }),
  component: DeviceTypesPage,
});

function DeviceTypesPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const query = useQuery({ queryKey: ["device-types"], queryFn: () => deviceTypeService.list() });

  const columns: Column<DeviceType>[] = [
    { key: "code", header: "Type Code", sortValue: (t) => t.TypeCode, render: (t) => <DeviceTypeBadge code={t.TypeCode} /> },
    { key: "name", header: "Type Name", sortValue: (t) => t.TypeName, render: (t) => t.TypeName },
    { key: "cat", header: "Category", render: (t) => <CategoryBadge category={t.DeviceCategory} /> },
    { key: "hw", header: "Hardware Version", render: (t) => <span className="font-mono text-xs">{t.HardwareVersion}</span> },
    {
      key: "claim",
      header: "Claim Allowed",
      render: (t) => <Pill tone={t.ClaimAllowed ? "success" : "neutral"}>{t.ClaimAllowed ? "Allowed" : "Not allowed"}</Pill>,
    },
    { key: "rssi", header: "RSSI Minimum", render: (t) => <span className="tabular-nums">{t.RssiConnectMinimum} dBm</span> },
    { key: "active", header: "Active", render: (t) => <ActiveBadge active={t.Active} /> },
  ];

  return (
    <AppShell>
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
      />
    </AppShell>
  );
}
