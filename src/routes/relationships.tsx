import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { RelationshipCard } from "@/components/app/cards";
import { ConfirmationDialog, FormModal } from "@/components/app/dialogs";
import { EmptyState } from "@/components/app/states";
import { AnimatedStagger, AsyncPageContent } from "@/components/app/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { relationshipService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { useAuth, usePermissions } from "@/lib/auth";
import { revokeAccessCopy } from "@/lib/action-copy";
import type { DeviceUserLink, LinkType } from "@/types/entities";

export const Route = createFileRoute("/relationships")({
  head: () => ({
    meta: [
      { title: "Relationships | Manufacturer Panel | ConfigGate" },
      { name: "description", content: "Review, grant and revoke device-to-user relationships across the fleet." },
      { property: "og:title", content: "Relationships | Manufacturer Panel" },
      { property: "og:description", content: "Device ownership and installer access management." },
    ],
  }),
  component: RelationshipsPage,
});

const LINK_TYPES: LinkType[] = ["Manufacturer", "Installer", "Owner", "Shared"];

function RelationshipsPage() {
  const { session } = useAuth();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [revokeLink, setRevokeLink] = useState<DeviceUserLink | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [confirmGrant, setConfirmGrant] = useState(false);
  const [grantForm, setGrantForm] = useState({
    DeviceSerialNumber: "",
    AppUserId: "",
    LinkType: "Installer" as LinkType,
    CanView: true,
    CanConfigure: true,
    CanControl: true,
    CanShare: false,
  });

  const links = useQuery({ queryKey: ["links"], queryFn: () => relationshipService.list() });
  const users = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });

  const revoke = useMutation({
    mutationFn: (link: DeviceUserLink) => relationshipService.revoke(link.id),
    onSuccess: (_data, link) => {
      toast.success(revokeAccessCopy(link, userName(link.AppUserId), link.DeviceSerialNumber).successToast);
      setRevokeLink(null);
      void queryClient.invalidateQueries({ queryKey: ["links"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to revoke access. Please try again.")),
  });

  const grant = useMutation({
    mutationFn: () =>
      relationshipService.grant({
        ...grantForm,
        GrantedByUserId: session!.user.id,
      }),
    onSuccess: () => {
      toast.success("Access granted successfully.");
      setConfirmGrant(false);
      setGrantOpen(false);
      setGrantForm({
        DeviceSerialNumber: "",
        AppUserId: "",
        LinkType: "Installer",
        CanView: true,
        CanConfigure: true,
        CanControl: true,
        CanShare: false,
      });
      void queryClient.invalidateQueries({ queryKey: ["links"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to grant access. Please try again.")),
  });

  const userName = (id: string) => {
    const u = users.data?.find((x) => x.id === id);
    return u ? `${u.FirstName} ${u.LastName}` : "Unknown user";
  };

  const term = search.trim().toLowerCase();
  const rows = (links.data ?? []).filter(
    (l) => !term || l.DeviceSerialNumber.toLowerCase().includes(term) || userName(l.AppUserId).toLowerCase().includes(term),
  );

  const canSubmitGrant = grantForm.DeviceSerialNumber.trim() && grantForm.AppUserId;

  return (
    <AppShell>
      <PageHeader
        title="Relationships"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Relationships" }]}
        actions={
          permissions.canManageRelationships ? (
            <Button onClick={() => setGrantOpen(true)}>
              <Plus className="size-4" /> Grant access
            </Button>
          ) : undefined
        }
      />
      <Input
        placeholder="Search by serial number or user"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm bg-surface"
      />
      <AsyncPageContent
        isLoading={links.isLoading}
        isError={links.isError}
        onRetry={() => void links.refetch()}
        loadingLabel="Loading relationships"
      >
        {rows.length === 0 ? (
          <EmptyState title="No relationships found" />
        ) : (
          <AnimatedStagger className="grid gap-3 xl:grid-cols-2">
            {rows.map((link) => (
              <RelationshipCard
                key={link.id}
                link={link}
                title={userName(link.AppUserId)}
                subtitle={link.DeviceSerialNumber}
                action={
                  permissions.canManageRelationships && link.Active ? (
                    <Button variant="destructiveOutline" size="sm" onClick={() => setRevokeLink(link)}>
                      Revoke access
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </AnimatedStagger>
        )}
      </AsyncPageContent>

      <ConfirmationDialog
        open={!!revokeLink}
        onOpenChange={(v) => !v && setRevokeLink(null)}
        title={revokeLink ? revokeAccessCopy(revokeLink, userName(revokeLink.AppUserId), revokeLink.DeviceSerialNumber).title : "Revoke access?"}
        description={
          revokeLink
            ? revokeAccessCopy(revokeLink, userName(revokeLink.AppUserId), revokeLink.DeviceSerialNumber).description
            : ""
        }
        confirmLabel={revokeLink ? revokeAccessCopy(revokeLink, userName(revokeLink.AppUserId), revokeLink.DeviceSerialNumber).confirmLabel : "Revoke access"}
        destructive
        loading={revoke.isPending}
        onConfirm={() => revokeLink && revoke.mutate(revokeLink)}
      />

      <FormModal open={grantOpen} onOpenChange={setGrantOpen} title="Grant access" wide>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="grant-serial">Device serial number</Label>
            <Input
              id="grant-serial"
              className="bg-background font-mono"
              value={grantForm.DeviceSerialNumber}
              onChange={(e) => setGrantForm({ ...grantForm, DeviceSerialNumber: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grant-user">App user</Label>
            <Select value={grantForm.AppUserId} onValueChange={(v) => setGrantForm({ ...grantForm, AppUserId: v })}>
              <SelectTrigger id="grant-user" className="bg-background">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {(users.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.FirstName} {u.LastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grant-type">Link type</Label>
            <Select value={grantForm.LinkType} onValueChange={(v) => setGrantForm({ ...grantForm, LinkType: v as LinkType })}>
              <SelectTrigger id="grant-type" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["CanView", "CanConfigure", "CanControl", "CanShare"] as const).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <Switch
                  id={`grant-${key}`}
                  checked={grantForm[key]}
                  onCheckedChange={(v) => setGrantForm({ ...grantForm, [key]: v })}
                />
                <Label htmlFor={`grant-${key}`} className="text-xs">
                  {key.replace("Can", "")}
                </Label>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setGrantOpen(false)} disabled={grant.isPending}>
              Cancel
            </Button>
            <Button disabled={!canSubmitGrant || grant.isPending} onClick={() => setConfirmGrant(true)}>
              Grant access
            </Button>
          </div>
        </div>
      </FormModal>

      <ConfirmationDialog
        open={confirmGrant}
        onOpenChange={setConfirmGrant}
        title="Grant device access?"
        description={`Grant ${grantForm.LinkType} access to ${userName(grantForm.AppUserId)} for ${grantForm.DeviceSerialNumber.trim()}.`}
        confirmLabel="Grant access"
        loading={grant.isPending}
        onConfirm={() => grant.mutate()}
      />
    </AppShell>
  );
}
