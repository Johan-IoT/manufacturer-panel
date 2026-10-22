import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ExternalLink, Pencil, ShieldOff, Undo2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceStatus, DeviceTypeBadge } from "@/components/app/badges";
import { RelationshipCard } from "@/components/app/cards";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { EmptyState } from "@/components/app/states";
import { DeviceConfigurationPanel } from "@/components/devices/device-configuration-panel";
import { useDeviceStatusAction } from "@/components/devices/device-status-action";
import { EditDeviceDialog } from "@/components/devices/edit-device-dialog";
import { DeviceConfigHistory } from "@/components/devices/device-config-history";
import { AnimatedContent, AnimatedStagger, AsyncPageContent } from "@/components/app/page-layout";
import { bleProfileService, deviceService, deviceTypeService, relationshipService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDate, formatDateTime, maskValue } from "@/lib/format";
import { usePermissions } from "@/lib/auth";
import { revokeAccessActionLabel, revokeAccessCopy } from "@/lib/action-copy";
import {
  DEVICE_STATUS_ACTION_COPY,
  canDecommission,
  canReinstate,
  canSuspend,
} from "@/lib/device-state";
import type { DeviceUserLink } from "@/types/entities";

export const Route = createFileRoute("/devices/$serial")({
  head: () => ({
    meta: [
      { title: "Device detail | Manufacturer Panel | ConfigGate" },
      { name: "description", content: "Hardware, BLE profile reference and device relationships for a single device." },
      { property: "og:title", content: "Device detail | Manufacturer Panel" },
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

function formatCoordinate(value: number | string | null | undefined): string {
  if (value == null || value === "") return "-";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(6);
}

function mapsUrl(latitude: number | string, longitude: number | string): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function hasKnownLocation(device: {
  LastKnownLatitude: number | string | null;
  LastKnownLongitude: number | string | null;
}): boolean {
  return device.LastKnownLatitude != null && device.LastKnownLongitude != null;
}

function DeviceDetailPage() {
  const { serial } = useParams({ from: "/devices/$serial" });
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const statusAction = useDeviceStatusAction();
  const [revokeLink, setRevokeLink] = useState<DeviceUserLink | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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

  const revoke = useMutation({
    mutationFn: (link: DeviceUserLink) => relationshipService.revoke(link.id),
    onSuccess: (_data, link) => {
      toast.success(revokeAccessCopy(link, userName(link.AppUserId), deviceQuery.data?.SerialNumber ?? link.DeviceSerialNumber).successToast);
      setRevokeLink(null);
      void queryClient.invalidateQueries({ queryKey: ["links", "device", serial] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to revoke access. Please try again.")),
  });

  const releaseOwnership = useMutation({
    mutationFn: () => deviceService.releaseOwnership(serial),
    onSuccess: () => {
      toast.success("Device released successfully.");
      setRevokeLink(null);
      void queryClient.invalidateQueries({ queryKey: ["device", serial] });
      void queryClient.invalidateQueries({ queryKey: ["links", "device", serial] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to release ownership. Please try again.")),
  });


  if (deviceQuery.isLoading) {
    return (
      <>
        <AsyncPageContent isLoading isError={false} loadingLabel="Loading device">
          {null}
        </AsyncPageContent>
      </>
    );
  }

  if (deviceQuery.isError || !deviceQuery.data) {
    return (
      <>
        <AsyncPageContent
          isLoading={false}
          isError
          errorTitle="Unable to load device"
          onRetry={() => void deviceQuery.refetch()}
        >
          {null}
        </AsyncPageContent>
      </>
    );
  }

  const device = deviceQuery.data;
  const ownerLink = (linksQuery.data ?? []).find((l) => l.LinkType === "Owner" && l.Active) ?? null;
  const userName = (id: string) => {
    const u = usersQuery.data?.find((x) => x.id === id);
    return u ? `${u.FirstName} ${u.LastName}` : "Unknown user";
  };
  const owner = ownerLink ? usersQuery.data?.find((u) => u.id === ownerLink.AppUserId) : undefined;

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{device.SerialNumber}</span>}
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Devices", to: "/devices" }, { label: device.SerialNumber }]}
        meta={
          <>
            <DeviceStatus status={device.DeviceStatus} />
            {type && <DeviceTypeBadge code={type.TypeCode} name={type.TypeName} />}
          </>
        }
        actions={
          permissions.canDeactivateDevice && device.DeviceStatus !== "Decommissioned" ? (
            <div className="flex flex-wrap gap-2">
              {permissions.canManageRelationships && ownerLink && device.DeviceStatus !== "Suspended" && (
                <Button variant="outline" onClick={() => setRevokeLink(ownerLink)}>
                  <Unlink className="size-4" /> Release Device
                </Button>
              )}
              {canReinstate(device.DeviceStatus) && (
                <Button variant="outline" onClick={() => statusAction.request("reinstate", device.SerialNumber)}>
                  <Undo2 className="size-4" /> {DEVICE_STATUS_ACTION_COPY.reinstate.menuLabel}
                </Button>
              )}
              {canSuspend(device.DeviceStatus) && (
                <Button variant="outline" onClick={() => statusAction.request("suspend", device.SerialNumber)}>
                  <ShieldOff className="size-4" /> {DEVICE_STATUS_ACTION_COPY.suspend.menuLabel}
                </Button>
              )}
              {canDecommission(device.DeviceStatus) && (
                <Button
                  variant="destructiveOutline"
                  onClick={() => statusAction.request("decommission", device.SerialNumber)}
                >
                  <Archive className="size-4" /> {DEVICE_STATUS_ACTION_COPY.decommission.menuLabel}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="history">Config History</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="mt-4">
          <DeviceConfigurationPanel serial={device.SerialNumber} canEdit={permissions.canEditDeviceConfiguration} />
        </TabsContent>

        <TabsContent value="overview" className="mt-4 grid gap-4 xl:grid-cols-2">
          <section className="rounded-lg border border-border bg-surface p-4 shadow-none">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Device details</h2>
              {permissions.canEditDeviceConfiguration && (
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              )}
            </div>
            <Row label="Device Name" value={device.DeviceName || device.SerialNumber} />
            <Row label="Firmware Version" value={<span className="font-mono">{device.FirmwareVersion || "Not set"}</span>} />
            <Row label="Hardware Version" value={<span className="font-mono">{device.HardwareVersion || "Not set"}</span>} />
            <Row label="Manufactured At" value={formatDate(device.ManufacturedAt)} />
            <Row label="Registered At" value={formatDate(device.RegisteredAt)} />
            <Row label="QR Code Value" value={<span className="font-mono">{maskValue(device.QrCodeValue, 6)}</span>} />
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-none">
            <h2 className="mb-3 text-sm font-semibold">Owner</h2>
            {ownerLink ? (
              <>
                <Row
                  label="Name"
                  value={
                    owner ? (
                      <Link
                        to="/users/$userId"
                        params={{ userId: owner.id }}
                        className="hover:underline"
                      >
                        {userName(owner.id)}
                      </Link>
                    ) : (
                      "Unknown user"
                    )
                  }
                />
                <Row
                  label="App ID"
                  value={<span className="font-mono">{owner?.AppId || "-"}</span>}
                />
                <Row label="Email" value={owner?.Email || "-"} />
                <Row label="Mobile" value={owner?.MobileNumber || "-"} />
                <Row label="Company" value={owner?.CompanyName || "-"} />
                <Row label="Owner Since" value={formatDate(ownerLink.GrantedAt)} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">This device has no owner yet.</p>
            )}
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-none">
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
              <EmptyState title="No BLE profile" />
            )}
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-none">
            <h2 className="mb-3 text-sm font-semibold">Latest known location</h2>
            <Row label="Latitude" value={formatCoordinate(device.LastKnownLatitude)} />
            <Row label="Longitude" value={formatCoordinate(device.LastKnownLongitude)} />
            <Row label="Captured At" value={formatDateTime(device.LastGpsCapturedAt)} />
            {hasKnownLocation(device) ? (
              <div className="pt-3">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={mapsUrl(device.LastKnownLatitude!, device.LastKnownLongitude!)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" /> Verify location
                  </a>
                </Button>
              </div>
            ) : (
              <p className="pt-2 text-sm text-muted-foreground">
                No GPS location has been recorded for this device yet.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-none xl:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">Recent activity & diagnostics</h2>
            <Row label="Last BLE Connection" value={formatDateTime(device.LastBleConnectionAt)} />
            <Row label="Last Server Contact" value={formatDateTime(device.LastServerContactAt)} />
            <Row label="Last Known BLE Name (diagnostic)" value={device.LastKnownBleName ?? "-"} />
            <Row
              label="Last Known Android MAC (diagnostic)"
              value={<span className="font-mono">{maskValue(device.LastKnownAndroidMac, 5)}</span>}
            />
          </section>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <DeviceConfigHistory serial={device.SerialNumber} />
        </TabsContent>

        <TabsContent value="relationships" className="mt-4 space-y-3">
          <AsyncPageContent
            isLoading={linksQuery.isLoading}
            isError={linksQuery.isError}
            onRetry={() => void linksQuery.refetch()}
            loadingLabel="Loading relationships"
            shellClassName="border-0 bg-transparent"
          >
            {(linksQuery.data ?? []).length === 0 ? (
              <EmptyState title="No relationships" />
            ) : (
              <AnimatedStagger className="space-y-3">
                {(linksQuery.data ?? []).map((link) => (
                  <RelationshipCard
                    key={link.id}
                    link={link}
                    title={userName(link.AppUserId)}
                    subtitle={`Granted by ${userName(link.GrantedByUserId)}`}
                    action={
                      permissions.canManageRelationships && link.Active ? (
                        <Button variant="destructiveOutline" size="sm" onClick={() => setRevokeLink(link)}>
                          {revokeAccessActionLabel(link)}
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </AnimatedStagger>
            )}
          </AsyncPageContent>
        </TabsContent>
      </Tabs>

      {statusAction.dialog}

      <EditDeviceDialog device={device} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmationDialog
        open={!!revokeLink}
        onOpenChange={(v) => !v && setRevokeLink(null)}
        title={
          revokeLink
            ? revokeAccessCopy(revokeLink, userName(revokeLink.AppUserId), device.SerialNumber).title
            : "Revoke access?"
        }
        description={
          revokeLink
            ? revokeAccessCopy(revokeLink, userName(revokeLink.AppUserId), device.SerialNumber).description
            : ""
        }
        confirmLabel={
          revokeLink
            ? revokeAccessCopy(revokeLink, userName(revokeLink.AppUserId), device.SerialNumber).confirmLabel
            : "Revoke access"
        }
        destructive
        loading={revoke.isPending || releaseOwnership.isPending}
        onConfirm={() => {
          if (!revokeLink) return;
          if (revokeLink.LinkType === "Owner") {
            releaseOwnership.mutate();
            return;
          }
          revoke.mutate(revokeLink);
        }}
      />
    </>
  );
}
