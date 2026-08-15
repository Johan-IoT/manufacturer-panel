import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { RelationshipCard } from "@/components/app/cards";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { EmptyState } from "@/components/app/states";
import { AnimatedStagger, AsyncPageContent } from "@/components/app/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { relationshipService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { usePermissions } from "@/lib/auth";
import { revokeAccessCopy } from "@/lib/action-copy";
import type { DeviceUserLink } from "@/types/entities";

export const Route = createFileRoute("/relationships")({
  head: () => ({
    meta: [
      { title: "Relationships — Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Review and revoke device-to-user relationships across the fleet." },
      { property: "og:title", content: "Relationships — Manufacturer Panel" },
      { property: "og:description", content: "Device ownership and installer access management." },
    ],
  }),
  component: RelationshipsPage,
});

function RelationshipsPage() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [revokeLink, setRevokeLink] = useState<DeviceUserLink | null>(null);

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

  const userName = (id: string) => {
    const u = users.data?.find((x) => x.id === id);
    return u ? `${u.FirstName} ${u.LastName}` : "Unknown user";
  };

  const term = search.trim().toLowerCase();
  const rows = (links.data ?? []).filter(
    (l) => !term || l.DeviceSerialNumber.toLowerCase().includes(term) || userName(l.AppUserId).toLowerCase().includes(term),
  );

  return (
    <AppShell>
      <PageHeader
        title="Relationships"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Relationships" }]}
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
    </AppShell>
  );
}
