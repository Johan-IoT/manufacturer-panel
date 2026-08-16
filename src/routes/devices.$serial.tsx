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
import { EmptyState } from "@/components/app/states";
import { AnimatedContent, AnimatedStagger, AsyncPageContent } from "@/components/app/page-layout";
import { bleProfileService, deviceService, deviceTypeService, relationshipService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDate, formatDateTime, maskValue } from "@/lib/format";
import { usePermissions } from "@/lib/auth";
import { revokeAccessCopy } from "@/lib/action-copy";
import type { DeviceUserLink } from "@/types/entities";

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
  const [revokeLink, setRevokeLink] = useState<DeviceUserLink | null>(null);

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
    mutationFn: (link: DeviceUserLink) => relationshipService.revoke(link.id),
    onSuccess: (_data, link) => {
      toast.success(revokeAccessCopy(link, userName(link.AppUserId), deviceQuery.data?.SerialNumber ?? link.DeviceSerialNumber).successToast);
      setRevokeLink(null);
      void queryClient.invalidateQueries({ queryKey: ["links", "device", serial] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to revoke access. Please try again.")),
  });

  if (deviceQuery.isLoading) {
    return (
      <AppShell>
        <AsyncPageContent isLoading isError={false} loadingLabel="Loading device">
          {null}
        </AsyncPageContent>
      </AppShell>
    );
  }

  if (deviceQuery.isError || !deviceQuery.data) {
    return (
      <AppShell>
        <AsyncPageContent
          isLoading={false}
          isError
          errorTitle="Unable to load device"
          onRetry={() => void deviceQuery.refetch()}
        >
          {null}
        </AsyncPageContent>
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
            <Button variant="destructiveOutline" onClick={() => setConfirmDeactivate(true)}>
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
          <section className="rounded-lg border border-border bg-surface p-4 shadow-none">
            <h2 className="mb-3 text-sm font-semibold">Hardware & firmware</h2>
            <Row label="Firmware Version" value={device.FirmwareVersion} />
            <Row label="Hardware Version" value={device.HardwareVersion} />
            <Row label="Manufactured At" value={formatDate(device.ManufacturedAt)} />
            <Row label="Registered At" value={formatDate(device.RegisteredAt)} />
            <Row label="QR Code Value" value={<span className="font-mono">{maskValue(device.QrCodeValue, 6)}</span>} />
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

          <section className="rounded-lg border border-border bg-surface p-4 shadow-none xl:col-span-2">
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
                          {link.LinkType === "Owner" ? "Release ownership" : "Revoke access"}
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
        loading={revoke.isPending}
        onConfirm={() => revokeLink && revoke.mutate(revokeLink)}
      />
    </AppShell>
  );
}
