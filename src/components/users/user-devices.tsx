import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ExternalLink, Unlink, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { DeviceStatus, DeviceTypeBadge, RelationshipBadge } from "@/components/app/badges";
import { DataTable, type Column } from "@/components/app/data-table";
import { ConfirmationDialog, SideDrawer } from "@/components/app/dialogs";
import {
  SendNotificationDialog,
  type NotificationRecipient,
} from "@/components/notifications/send-notification-dialog";
import { Button } from "@/components/ui/button";
import { deviceService, deviceTypeService, relationshipService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { cn } from "@/lib/utils";
import type { AppUser, Device, DeviceUserLink } from "@/types/entities";

type DeviceRow = { link: DeviceUserLink; device: Device | undefined };
type Selected = { kind: "owned" | "shared"; serial: string; linkId: string } | null;
type Pending =
  | { kind: "release"; serial: string }
  | { kind: "removeShare"; link: DeviceUserLink; userName: string }
  | null;

function fullName(u: AppUser | undefined): string {
  return u ? `${u.FirstName} ${u.LastName}`.trim() : "Unknown user";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

/**
 * User profile (Johan, 20 Oct): devices the user owns (with the users they are
 * shared to) and devices shared to the user (with the owner). From here a
 * Manufacturer can release a device, remove a share and notify about a device.
 */
export function UserDevices({ user, canManage }: { user: AppUser; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Selected>(null);
  /** In the owned-device drawer: the shared user whose details are open. */
  const [openShareId, setOpenShareId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [notify, setNotify] = useState<{
    recipients: NotificationRecipient[];
    serial: string;
  } | null>(null);

  const linksQuery = useQuery({ queryKey: ["links"], queryFn: () => relationshipService.list() });
  const devicesQuery = useQuery({ queryKey: ["devices"], queryFn: () => deviceService.list() });
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const typesQuery = useQuery({
    queryKey: ["device-types"],
    queryFn: () => deviceTypeService.list(),
  });

  const deviceOf = (serial: string) => devicesQuery.data?.find((d) => d.SerialNumber === serial);
  const userOf = (id: string) => usersQuery.data?.find((u) => u.id === id);
  const typeOf = (id: string | undefined) => typesQuery.data?.find((t) => t.id === id);
  const activeLinks = useMemo(
    () => (linksQuery.data ?? []).filter((l) => l.Active),
    [linksQuery.data],
  );
  const linksOfDevice = (serial: string, type: DeviceUserLink["LinkType"]) =>
    activeLinks.filter((l) => l.DeviceSerialNumber === serial && l.LinkType === type);

  const rowsOf = (type: DeviceUserLink["LinkType"]): DeviceRow[] =>
    activeLinks
      .filter((l) => l.AppUserId === user.id && l.LinkType === type)
      .map((link) => ({ link, device: deviceOf(link.DeviceSerialNumber) }));
  const owned = rowsOf("Owner");
  const sharedToUser = rowsOf("Shared");
  const otherLinks = activeLinks.filter(
    (l) => l.AppUserId === user.id && (l.LinkType === "Manufacturer" || l.LinkType === "Installer"),
  );

  const refresh = (serial: string) => {
    void queryClient.invalidateQueries({ queryKey: ["links"] });
    void queryClient.invalidateQueries({ queryKey: ["devices"] });
    void queryClient.invalidateQueries({ queryKey: ["device", serial] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  const release = useMutation({
    mutationFn: (serial: string) => deviceService.releaseOwnership(serial),
    onSuccess: (_d, serial) => {
      toast.success("Device and all its shares released successfully.");
      setPending(null);
      setSelected(null);
      refresh(serial);
    },
    onError: (e) =>
      toast.error(toUserMessage(e, "Unable to release this device. Please try again.")),
  });

  const removeShare = useMutation({
    mutationFn: (link: DeviceUserLink) => relationshipService.revoke(link.id),
    onSuccess: (_d, link) => {
      toast.success("Share removed successfully.");
      setPending(null);
      setOpenShareId(null);
      if (link.AppUserId === user.id) setSelected(null);
      refresh(link.DeviceSerialNumber);
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to remove this share. Please try again.")),
  });

  const deviceColumns = (withOwner: boolean): Column<DeviceRow>[] => [
    {
      key: "serial",
      header: "Serial Number",
      sortValue: (r) => r.link.DeviceSerialNumber,
      render: (r) => <span className="font-mono text-xs">{r.link.DeviceSerialNumber}</span>,
    },
    {
      key: "name",
      header: "Device Name",
      render: (r) => <span className="text-sm">{r.device?.DeviceName || "-"}</span>,
    },
    {
      key: "type",
      header: "Device Type",
      render: (r) => {
        const t = typeOf(r.device?.DeviceTypeId);
        return t ? <DeviceTypeBadge code={t.TypeCode} name={t.TypeName} /> : <span>-</span>;
      },
    },
    withOwner
      ? {
          key: "owner",
          header: "Owner",
          render: (r) => {
            const owner = linksOfDevice(r.link.DeviceSerialNumber, "Owner")[0];
            return (
              <span className="text-sm">
                {owner ? fullName(userOf(owner.AppUserId)) : "No owner"}
              </span>
            );
          },
        }
      : {
          key: "shares",
          header: "Shared With",
          render: (r) => {
            const n = linksOfDevice(r.link.DeviceSerialNumber, "Shared").length;
            return (
              <span className="text-sm tabular-nums">
                {n === 0 ? "Nobody" : `${n} user${n === 1 ? "" : "s"}`}
              </span>
            );
          },
        },
    {
      key: "status",
      header: "Status",
      render: (r) => (r.device ? <DeviceStatus status={r.device.DeviceStatus} /> : <span>-</span>),
    },
  ];

  const loading = linksQuery.isLoading || devicesQuery.isLoading;
  const selectedDevice = selected ? deviceOf(selected.serial) : undefined;
  const selectedType = typeOf(selectedDevice?.DeviceTypeId);
  const suspended = selectedDevice?.DeviceStatus === "Suspended";

  return (
    <>
      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold">Owned devices</h2>
        <DataTable
          data={owned}
          columns={deviceColumns(false)}
          rowKey={(r) => r.link.id}
          isLoading={loading}
          isError={linksQuery.isError || devicesQuery.isError}
          onRetry={() => {
            void linksQuery.refetch();
            void devicesQuery.refetch();
          }}
          pageSize={5}
          onRowClick={(r) => {
            setOpenShareId(null);
            setSelected({ kind: "owned", serial: r.link.DeviceSerialNumber, linkId: r.link.id });
          }}
          emptyTitle="This user does not own any devices"
        />
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold">Devices shared with this user</h2>
        <DataTable
          data={sharedToUser}
          columns={deviceColumns(true)}
          rowKey={(r) => r.link.id}
          isLoading={loading}
          isError={linksQuery.isError || devicesQuery.isError}
          onRetry={() => void linksQuery.refetch()}
          pageSize={5}
          onRowClick={(r) =>
            setSelected({ kind: "shared", serial: r.link.DeviceSerialNumber, linkId: r.link.id })
          }
          emptyTitle="No devices are shared with this user"
        />
      </section>

      {otherLinks.length > 0 && (
        <section className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Other device links</h2>
          <div className="flex flex-wrap gap-2">
            {otherLinks.map((l) => (
              <Link
                key={l.id}
                to="/devices/$serial"
                params={{ serial: l.DeviceSerialNumber }}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent/40"
              >
                <span className="font-mono text-xs">{l.DeviceSerialNumber}</span>
                <RelationshipBadge linkType={l.LinkType} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <SideDrawer
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title={selected?.serial ?? "Device"}
        description={selected?.kind === "owned" ? "Owned by this user" : "Shared with this user"}
      >
        {selected && (
          <div className="space-y-6 py-4">
            <div>
              <Field label="Device Name" value={selectedDevice?.DeviceName || "-"} />
              <Field label="Device Type" value={selectedType?.TypeName ?? "-"} />
              <Field
                label="Status"
                value={selectedDevice ? <DeviceStatus status={selectedDevice.DeviceStatus} /> : "-"}
              />
              <Field
                label="Firmware Version"
                value={selectedDevice?.FirmwareVersion || "Not set"}
              />
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link to="/devices/$serial" params={{ serial: selected.serial }}>
                  <ExternalLink className="size-4" /> Open device
                </Link>
              </Button>
            </div>

            {selected.kind === "owned" ? (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Shared with</h3>
                  {linksOfDevice(selected.serial, "Shared").length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      This device is not shared with anyone.
                    </p>
                  ) : (
                    linksOfDevice(selected.serial, "Shared").map((share) => {
                      const sharedUser = userOf(share.AppUserId);
                      const isOpen = openShareId === share.id;
                      return (
                        <div
                          key={share.id}
                          className="rounded-md border border-border bg-background"
                        >
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                              isOpen && "border-b border-border",
                            )}
                            onClick={() => setOpenShareId(isOpen ? null : share.id)}
                            aria-expanded={isOpen}
                          >
                            <span className="font-medium">{fullName(sharedUser)}</span>
                            <span className="text-xs text-muted-foreground">
                              {sharedUser?.Email}
                            </span>
                          </button>
                          {isOpen && (
                            <div className="space-y-3 px-3 py-3">
                              <div>
                                <Field label="Email" value={sharedUser?.Email ?? "-"} />
                                <Field label="Cellphone" value={sharedUser?.MobileNumber || "-"} />
                                <Field label="Company" value={sharedUser?.CompanyName || "-"} />
                              </div>
                              {canManage && (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="destructiveOutline"
                                    onClick={() =>
                                      setPending({
                                        kind: "removeShare",
                                        link: share,
                                        userName: fullName(sharedUser),
                                      })
                                    }
                                  >
                                    <UserMinus className="size-4" /> Remove share
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setNotify({
                                        recipients: [
                                          { id: share.AppUserId, name: fullName(sharedUser) },
                                        ],
                                        serial: selected.serial,
                                      })
                                    }
                                  >
                                    <Bell className="size-4" /> Send notification
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                {canManage && (
                  <div className="border-t border-border pt-4">
                    <Button
                      variant="destructiveOutline"
                      disabled={suspended}
                      title={
                        suspended
                          ? "Suspended: set it back to Released on the device page."
                          : undefined
                      }
                      onClick={() => setPending({ kind: "release", serial: selected.serial })}
                    >
                      <Unlink className="size-4" /> Release device and all shares
                    </Button>
                  </div>
                )}
              </>
            ) : (
              (() => {
                const ownerLink = linksOfDevice(selected.serial, "Owner")[0];
                const owner = ownerLink ? userOf(ownerLink.AppUserId) : undefined;
                const myShare = activeLinks.find((l) => l.id === selected.linkId);
                return (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">Owner</h3>
                      {ownerLink ? (
                        <div>
                          <Field label="Name" value={fullName(owner)} />
                          <Field label="Email" value={owner?.Email ?? "-"} />
                          <Field label="Cellphone" value={owner?.MobileNumber || "-"} />
                          <Field label="Company" value={owner?.CompanyName || "-"} />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">This device has no owner.</p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                        {myShare && (
                          <Button
                            variant="destructiveOutline"
                            onClick={() =>
                              setPending({
                                kind: "removeShare",
                                link: myShare,
                                userName: fullName(user),
                              })
                            }
                          >
                            <UserMinus className="size-4" /> Remove share
                          </Button>
                        )}
                        {ownerLink && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setNotify({
                                recipients: [{ id: ownerLink.AppUserId, name: fullName(owner) }],
                                serial: selected.serial,
                              })
                            }
                          >
                            <Bell className="size-4" /> Notify owner
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}
      </SideDrawer>

      <ConfirmationDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending?.kind === "release" ? "Release this device?" : "Remove this share?"}
        description={
          pending?.kind === "release"
            ? `Are you sure you want to release ${pending.serial} from ${fullName(user)}? The owner and all shared users lose access, and the device can be claimed again.`
            : pending
              ? `${pending.userName} loses access to ${pending.link.DeviceSerialNumber}.`
              : ""
        }
        confirmLabel={pending?.kind === "release" ? "Release device" : "Remove share"}
        destructive
        loading={release.isPending || removeShare.isPending}
        onConfirm={() => {
          if (pending?.kind === "release") release.mutate(pending.serial);
          else if (pending?.kind === "removeShare") removeShare.mutate(pending.link);
        }}
      />

      <SendNotificationDialog
        open={!!notify}
        onOpenChange={(v) => !v && setNotify(null)}
        recipients={notify?.recipients ?? []}
        deviceSerialNumber={notify?.serial}
      />
    </>
  );
}
