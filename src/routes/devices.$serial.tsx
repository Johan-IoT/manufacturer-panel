import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveBadge, DeviceStatus, DeviceTypeBadge } from "@/components/app/badges";
import { RelationshipCard } from "@/components/app/cards";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { ErrorState, LoadingState, EmptyState } from "@/components/app/states";
import { bleProfileService, deviceService, deviceTypeService, relationshipService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDate, formatDateTime, maskValue } from "@/lib/format";
import { usePermissions } from "@/lib/auth";

export const Route = createFileRoute("/devices/$serial")({
  head: () => ({
    meta: [
      { title: "Device detail — Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Hardware, BLE profile reference and device relationships for a single device." },
      { property: "og:title", content: "Device detail — Manufacturer Panel" },
      { property: "og:description", content: "Inspect a single BLE device by serial number." },
    ],
  }),
  component: DeviceDetailPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

function DeviceDetailPage() {
  const { serial } = useParams({ from: "/devices/$serial" });
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const deviceQuery = useQuery({ queryKey: ["device", serial], queryFn: () => deviceService.get(serial) });
  const typesQuery = useQuery({ queryKey: ["device-types"], queryFn: () => deviceTypeService.list() });
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const linksQuery = useQuery({
    queryKey: ["links", "device", serial],
    queryFn: () => relationshipService.listForDevice(serial),
  });
  const type = typesQuery.data?.find((t) => t.id === deviceQuery.data?.DeviceTypeId);
  const profileQuery = useQuery({
    queryKey: ["ble-profile", type?.id],
    queryFn: () => bleProfileService.getForDeviceType(type!.id),
    enabled: !!type,
  });

  const deactivate = useMutation({
    mutationFn: () => deviceService.deactivate(serial),
    onSuccess: () => {
      toast.success("Device deactivated successfully.");
      setConfirmDeactivate(false);
      void queryClient.invalidateQueries({ queryKey: ["device", serial] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to deactivate this device. Please try again.")),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => relationshipService.revoke(id),
    onSuccess: () => {
      toast.success("Access revoked successfully.");
      setRevokeId(null);
      void queryClient.invalidateQueries({ queryKey: ["links", "device", serial] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to update access. Please try again.")),
  });

  if (deviceQuery.isLoading) {
    return (
      <AppShell>
        <div className="rounded-lg border border-border bg-surface">
          <LoadingState label="Loading device" />
        </div>
      </AppShell>
    );
  }

  if (deviceQuery.isError || !deviceQuery.data) {
    return (
      <AppShell>
        <div className="rounded-lg border border-border bg-surface">
          <ErrorState description="This device could not be loaded." onRetry={() => void deviceQuery.refetch()} />
        </div>
      </AppShell>
    );
  }

  const device = deviceQuery.data;
  const userName = (id: string) => {
    const u = usersQuery.data?.find((x) => x.id === id);
    return u ? `${u.FirstName} ${u.LastName}` : "Unknown user";
  };

  return (
    <AppShell>
      <PageHeader
        title={<span className="font-mono">{device.SerialNumber}</span>}
        description={device.DeviceName}
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Devices", to: "/devices" }, { label: device.SerialNumber }]}
        meta={
          <>
            <DeviceStatus status={device.DeviceStatus} />
            <ActiveBadge active={device.Active} />
            {type && <DeviceTypeBadge code={type.TypeCode} name={type.TypeName} />}
          </>
        }
        actions={
          permissions.canDeactivateDevice && device.Active ? (
            <Button variant="outline" onClick={() => setConfirmDeactivate(true)}>
              <Ban className="size-4" /> Deactivate device
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 xl:grid-cols-2">
          <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
            <h2 className="mb-3 text-sm font-semibold">Hardware & firmware</h2>
            <Row label="Firmware Version" value={device.FirmwareVersion} />
            <Row label="Hardware Version" value={device.HardwareVersion} />
            <Row label="Manufactured At" value={formatDate(device.ManufacturedAt)} />
            <Row label="Registered At" value={formatDate(device.RegisteredAt)} />
            <Row label="QR Code Value" value={<span className="font-mono">{maskValue(device.QrCodeValue, 6)}</span>} />
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
            <h2 className="mb-3 text-sm font-semibold">BLE profile (read only)</h2>
            {profileQuery.data ? (
              <>
                <Row label="Profile Name" value={profileQuery.data.ProfileName} />
                <Row label="Published Name" value={profileQuery.data.PublishedName} />
                <Row label="Service UUID" value={<span className="font-mono text-xs">{profileQuery.data.ServiceUuid}</span>} />
                <Row label="Connection Timeout" value={`${profileQuery.data.ConnectionTimeoutMs} ms`} />
                {type && (
                  <div className="pt-3">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/device-types/$typeId" params={{ typeId: type.id }}>
                        Edit on device type
                      </Link>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No BLE profile is configured for this device type.</p>
            )}
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-panel xl:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">Recent activity & diagnostics</h2>
            <Row label="Last BLE Connection" value={formatDateTime(device.LastBleConnectionAt)} />
            <Row label="Last Server Contact" value={formatDateTime(device.LastServerContactAt)} />
            <Row label="Last Known BLE Name (diagnostic)" value={device.LastKnownBleName ?? "—"} />
            <Row
              label="Last Known Android MAC (diagnostic)"
              value={<span className="font-mono">{maskValue(device.LastKnownAndroidMac, 5)}</span>}
            />
          </section>
        </TabsContent>

        <TabsContent value="relationships" className="mt-4 space-y-3">
          {linksQuery.isLoading ? (
            <LoadingState label="Loading relationships" />
          ) : linksQuery.isError ? (
            <ErrorState onRetry={() => void linksQuery.refetch()} />
          ) : (linksQuery.data ?? []).length === 0 ? (
            <EmptyState title="No relationships" description="No user is linked to this device yet." />
          ) : (
            (linksQuery.data ?? []).map((link) => (
              <RelationshipCard
                key={link.id}
                link={link}
                title={userName(link.AppUserId)}
                subtitle={`Granted by ${userName(link.GrantedByUserId)}`}
                action={
                  permissions.canManageRelationships && link.Active ? (
                    <Button variant="outline" size="sm" onClick={() => setRevokeId(link.id)}>
                      Revoke access
                    </Button>
                  ) : undefined
                }
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <ConfirmationDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title="Deactivate this device?"
        description={`Are you sure you want to deactivate ${device.SerialNumber}? History is preserved; the device is never deleted.`}
        confirmLabel="Deactivate device"
        destructive
        loading={deactivate.isPending}
        onConfirm={() => deactivate.mutate()}
      />

      <ConfirmationDialog
        open={!!revokeId}
        onOpenChange={(v) => !v && setRevokeId(null)}
        title="Revoke access?"
        description="Are you sure you want to revoke this user's access to this device? The relationship is marked revoked, never deleted."
        confirmLabel="Revoke access"
        destructive
        loading={revoke.isPending}
        onConfirm={() => revokeId && revoke.mutate(revokeId)}
      />
    </AppShell>
  );
}
