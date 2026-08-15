import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { ActiveBadge, CategoryBadge, DeviceTypeBadge } from "@/components/app/badges";
import { BleProfileEditor } from "@/components/app/ble-profile-editor";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { AsyncPageContent } from "@/components/app/page-layout";
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
  const [pendingPatch, setPendingPatch] = useState<Record<string, unknown> | null>(null);

  const typeQuery = useQuery({ queryKey: ["device-type", typeId], queryFn: () => deviceTypeService.get(typeId) });
  const profileQuery = useQuery({ queryKey: ["ble-profile", typeId], queryFn: () => bleProfileService.getForDeviceType(typeId) });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => bleProfileService.update(profileQuery.data!.id, patch),
    onSuccess: () => {
      toast.success("BLE profile saved successfully.");
      setPendingPatch(null);
      void queryClient.invalidateQueries({ queryKey: ["ble-profile", typeId] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to save the BLE profile. Please try again.")),
  });

  return (
    <AppShell>
      <AsyncPageContent
        isLoading={typeQuery.isLoading}
        isError={typeQuery.isError || !typeQuery.data}
        onRetry={() => void typeQuery.refetch()}
        loadingLabel="Loading device type"
        errorTitle="Unable to load device type"
      >
        {typeQuery.data && (
          <>
            <PageHeader
              title={typeQuery.data.TypeName}
              breadcrumbs={[
                { label: "Manufacturer Panel", to: "/" },
                { label: "Device Types", to: "/device-types" },
                { label: typeQuery.data.TypeCode },
              ]}
              meta={
                <>
                  <DeviceTypeBadge code={typeQuery.data.TypeCode} />
                  <CategoryBadge category={typeQuery.data.DeviceCategory} />
                  <ActiveBadge active={typeQuery.data.Active} />
                </>
              }
            />

            <section className="rounded-lg border border-border bg-surface p-4 shadow-none">
              <h2 className="mb-4 text-sm font-semibold">BLE profile</h2>
              <AsyncPageContent
                isLoading={profileQuery.isLoading}
                isError={profileQuery.isError || !profileQuery.data}
                onRetry={() => void profileQuery.refetch()}
                loadingLabel="Loading BLE profile"
                errorTitle="Unable to load BLE profile"
                shellClassName="border-0 bg-transparent"
              >
                {profileQuery.data && (
                  <BleProfileEditor
                    profile={profileQuery.data}
                    canEdit={permissions.canEditBleProfile}
                    saving={save.isPending}
                    onSave={(patch) => setPendingPatch(patch)}
                  />
                )}
              </AsyncPageContent>
            </section>

            <ConfirmationDialog
              open={!!pendingPatch}
              onOpenChange={(v) => !v && setPendingPatch(null)}
              title="Save BLE profile changes?"
              description="Updated connection rules apply to all devices of this type on their next connection."
              confirmLabel="Save changes"
              loading={save.isPending}
              onConfirm={() => pendingPatch && save.mutate(pendingPatch)}
            />
          </>
        )}
      </AsyncPageContent>
    </AppShell>
  );
}
