import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { ActiveBadge, CategoryBadge, DeviceTypeBadge, Pill } from "@/components/app/badges";
import { BleProfileEditor } from "@/components/app/ble-profile-editor";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { AsyncPageContent } from "@/components/app/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bleProfileService, deviceTypeService } from "@/services";
import { toUserMessage } from "@/services/client";
import { usePermissions } from "@/lib/auth";
import { DEVICE_CATEGORIES, type DeviceCategory, type DeviceType } from "@/types/entities";

export const Route = createFileRoute("/device-types/$typeId")({
  head: () => ({
    meta: [
      { title: "Device Type | Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Edit device type settings and its single active BLE profile." },
      { property: "og:title", content: "Device Type | Manufacturer Panel" },
      { property: "og:description", content: "Device type and BLE profile configuration." },
    ],
  }),
  component: DeviceTypeDetailPage,
});

function DeviceTypeDetailPage() {
  const { typeId } = useParams({ from: "/device-types/$typeId" });
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [pendingBlePatch, setPendingBlePatch] = useState<Record<string, unknown> | null>(null);
  const [metadata, setMetadata] = useState<DeviceType | null>(null);
  const [confirmMetadata, setConfirmMetadata] = useState(false);

  const typeQuery = useQuery({ queryKey: ["device-type", typeId], queryFn: () => deviceTypeService.get(typeId) });
  const profileQuery = useQuery({ queryKey: ["ble-profile", typeId], queryFn: () => bleProfileService.getForDeviceType(typeId) });

  useEffect(() => {
    if (typeQuery.data) setMetadata(typeQuery.data);
  }, [typeQuery.data]);

  const saveBle = useMutation({
    mutationFn: (patch: Record<string, unknown>) => bleProfileService.update(profileQuery.data!.id, patch),
    onSuccess: () => {
      toast.success("BLE profile saved successfully.");
      setPendingBlePatch(null);
      void queryClient.invalidateQueries({ queryKey: ["ble-profile", typeId] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to save the BLE profile. Please try again.")),
  });

  const saveMetadata = useMutation({
    mutationFn: () =>
      deviceTypeService.update(typeId, {
        TypeName: metadata!.TypeName,
        Description: metadata!.Description,
        ManufacturerName: metadata!.ManufacturerName,
        DeviceCategory: metadata!.DeviceCategory,
        HardwareVersion: metadata!.HardwareVersion,
        ClaimAllowed: metadata!.ClaimAllowed,
        RssiConnectMinimum: metadata!.RssiConnectMinimum,
        Active: metadata!.Active,
      }),
    onSuccess: () => {
      toast.success("Device type metadata saved successfully.");
      setConfirmMetadata(false);
      void queryClient.invalidateQueries({ queryKey: ["device-type", typeId] });
      void queryClient.invalidateQueries({ queryKey: ["device-types"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to save device type metadata. Please try again.")),
  });

  const metadataDirty =
    metadata &&
    typeQuery.data &&
    (metadata.TypeName !== typeQuery.data.TypeName ||
      metadata.Description !== typeQuery.data.Description ||
      metadata.ManufacturerName !== typeQuery.data.ManufacturerName ||
      metadata.DeviceCategory !== typeQuery.data.DeviceCategory ||
      metadata.HardwareVersion !== typeQuery.data.HardwareVersion ||
      metadata.ClaimAllowed !== typeQuery.data.ClaimAllowed ||
      metadata.RssiConnectMinimum !== typeQuery.data.RssiConnectMinimum ||
      metadata.Active !== typeQuery.data.Active);

  return (
    <AppShell>
      <AsyncPageContent
        isLoading={typeQuery.isLoading}
        isError={typeQuery.isError || !typeQuery.data}
        onRetry={() => void typeQuery.refetch()}
        loadingLabel="Loading device type"
        errorTitle="Unable to load device type"
      >
        {typeQuery.data && metadata && (
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

            <section className="mb-4 rounded-lg border border-border bg-surface p-4 shadow-none">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Device type metadata</h2>
                {permissions.canManageDeviceTypes && metadataDirty && (
                  <Button size="sm" onClick={() => setConfirmMetadata(true)} disabled={saveMetadata.isPending}>
                    Save metadata
                  </Button>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="meta-name">Type Name</Label>
                  <Input
                    id="meta-name"
                    className="bg-background"
                    value={metadata.TypeName}
                    disabled={!permissions.canManageDeviceTypes}
                    onChange={(e) => setMetadata({ ...metadata, TypeName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meta-manufacturer">Manufacturer Name</Label>
                  <Input
                    id="meta-manufacturer"
                    className="bg-background"
                    value={metadata.ManufacturerName}
                    disabled={!permissions.canManageDeviceTypes}
                    onChange={(e) => setMetadata({ ...metadata, ManufacturerName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <Label htmlFor="meta-description">Description</Label>
                  <Textarea
                    id="meta-description"
                    className="bg-background"
                    rows={2}
                    value={metadata.Description}
                    disabled={!permissions.canManageDeviceTypes}
                    onChange={(e) => setMetadata({ ...metadata, Description: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meta-category">Device Category</Label>
                  <Select
                    value={metadata.DeviceCategory}
                    disabled={!permissions.canManageDeviceTypes}
                    onValueChange={(v) => setMetadata({ ...metadata, DeviceCategory: v as DeviceCategory })}
                  >
                    <SelectTrigger id="meta-category" className="bg-background">
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
                <div className="space-y-1.5">
                  <Label htmlFor="meta-hw">Hardware Version</Label>
                  <Input
                    id="meta-hw"
                    className="bg-background font-mono"
                    value={metadata.HardwareVersion}
                    disabled={!permissions.canManageDeviceTypes}
                    onChange={(e) => setMetadata({ ...metadata, HardwareVersion: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meta-rssi">RSSI Connect Minimum (dBm)</Label>
                  <Input
                    id="meta-rssi"
                    type="number"
                    className="bg-background tabular-nums"
                    value={metadata.RssiConnectMinimum}
                    disabled={!permissions.canManageDeviceTypes}
                    min={-120}
                    max={0}
                    onChange={(e) => setMetadata({ ...metadata, RssiConnectMinimum: Number(e.target.value) })}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-6 lg:col-span-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="meta-claim"
                      checked={metadata.ClaimAllowed}
                      disabled={!permissions.canManageDeviceTypes}
                      onCheckedChange={(v) => setMetadata({ ...metadata, ClaimAllowed: v })}
                    />
                    <Label htmlFor="meta-claim">Claim allowed</Label>
                    <Pill tone={metadata.ClaimAllowed ? "success" : "neutral"}>
                      {metadata.ClaimAllowed ? "Allowed" : "Not allowed"}
                    </Pill>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      id="meta-active"
                      checked={metadata.Active}
                      disabled={!permissions.canManageDeviceTypes}
                      onCheckedChange={(v) => setMetadata({ ...metadata, Active: v })}
                    />
                    <Label htmlFor="meta-active">Active</Label>
                  </div>
                </div>
              </div>
            </section>

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
                    saving={saveBle.isPending}
                    onSave={(patch) => setPendingBlePatch(patch)}
                  />
                )}
              </AsyncPageContent>
            </section>

            <ConfirmationDialog
              open={!!pendingBlePatch}
              onOpenChange={(v) => !v && setPendingBlePatch(null)}
              title="Save BLE profile changes?"
              description="Updated connection rules apply to all devices of this type on their next connection."
              confirmLabel="Save changes"
              loading={saveBle.isPending}
              onConfirm={() => pendingBlePatch && saveBle.mutate(pendingBlePatch)}
            />

            <ConfirmationDialog
              open={confirmMetadata}
              onOpenChange={setConfirmMetadata}
              title="Save device type metadata?"
              description="Updated claim rules and RSSI thresholds apply to all devices of this type."
              confirmLabel="Save metadata"
              loading={saveMetadata.isPending}
              onConfirm={() => saveMetadata.mutate()}
            />
          </>
        )}
      </AsyncPageContent>
    </AppShell>
  );
}
