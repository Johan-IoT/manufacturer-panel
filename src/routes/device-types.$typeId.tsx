import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { ActiveBadge, CategoryBadge, DeviceTypeBadge } from "@/components/app/badges";
import { BleProfileEditor } from "@/components/app/ble-profile-editor";
import { ErrorState, LoadingState } from "@/components/app/states";
import { bleProfileService, deviceTypeService } from "@/services";
import { toUserMessage } from "@/services/client";
import { usePermissions } from "@/lib/auth";

export const Route = createFileRoute("/device-types/$typeId")({
  head: () => ({
    meta: [
      { title: "Device Type — Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Edit device type settings and its single active BLE profile." },
      { property: "og:title", content: "Device Type — Manufacturer Panel" },
      { property: "og:description", content: "Device type and BLE profile configuration." },
    ],
  }),
  component: DeviceTypeDetailPage,
});

function DeviceTypeDetailPage() {
  const { typeId } = useParams({ from: "/device-types/$typeId" });
  const permissions = usePermissions();
  const queryClient = useQueryClient();

  const typeQuery = useQuery({ queryKey: ["device-type", typeId], queryFn: () => deviceTypeService.get(typeId) });
  const profileQuery = useQuery({ queryKey: ["ble-profile", typeId], queryFn: () => bleProfileService.getForDeviceType(typeId) });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => bleProfileService.update(profileQuery.data!.id, patch),
    onSuccess: () => {
      toast.success("BLE profile saved successfully.");
      void queryClient.invalidateQueries({ queryKey: ["ble-profile", typeId] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to save the BLE profile. Please try again.")),
  });

  if (typeQuery.isLoading) {
    return (
      <AppShell>
        <LoadingState label="Loading device type" />
      </AppShell>
    );
  }
  if (typeQuery.isError || !typeQuery.data) {
    return (
      <AppShell>
        <ErrorState description="This device type could not be loaded." onRetry={() => void typeQuery.refetch()} />
      </AppShell>
    );
  }

  const type = typeQuery.data;

  return (
    <AppShell>
      <PageHeader
        title={type.TypeName}
        description={`Hardware ${type.HardwareVersion} · RSSI minimum ${type.RssiConnectMinimum} dBm`}
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Device Types", to: "/device-types" }, { label: type.TypeCode }]}
        meta={
          <>
            <DeviceTypeBadge code={type.TypeCode} />
            <CategoryBadge category={type.DeviceCategory} />
            <ActiveBadge active={type.Active} />
          </>
        }
      />

      <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
        <h2 className="mb-4 text-sm font-semibold">BLE profile</h2>
        {profileQuery.isLoading ? (
          <LoadingState label="Loading BLE profile" />
        ) : profileQuery.isError || !profileQuery.data ? (
          <ErrorState description="No BLE profile could be loaded for this device type." onRetry={() => void profileQuery.refetch()} />
        ) : (
          <BleProfileEditor
            profile={profileQuery.data}
            canEdit={permissions.canEditBleProfile}
            saving={save.isPending}
            onSave={(patch) => save.mutate(patch)}
          />
        )}
      </section>
    </AppShell>
  );
}
