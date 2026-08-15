import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { RelationshipCard } from "@/components/app/cards";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { relationshipService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { usePermissions } from "@/lib/auth";

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
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const links = useQuery({ queryKey: ["links"], queryFn: () => relationshipService.list() });
  const users = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });

  const revoke = useMutation({
    mutationFn: (id: string) => relationshipService.revoke(id),
    onSuccess: () => {
      toast.success("Access revoked successfully.");
      setRevokeId(null);
      void queryClient.invalidateQueries({ queryKey: ["links"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to update access. Please try again.")),
  });

  const userName = (id: string) => {
    const u = users.data?.find((x) => x.id === id);
    return u ? `${u.FirstName} ${u.LastName}` : "Unknown user";
  };

  const term = search.trim().toLowerCase();
  const rows = (links.data ?? []).filter(
    (l) => !term || l.SerialNumber.toLowerCase().includes(term) || userName(l.AppUserId).toLowerCase().includes(term),
  );

  return (
    <AppShell>
      <PageHeader
        title="Relationships"
        description="Every link between a device and a user. Revoking preserves history — relationships are never deleted."
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Relationships" }]}
      />
      <Input
        placeholder="Search by serial number or user"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm bg-surface"
      />
      {links.isLoading ? (
        <LoadingState label="Loading relationships" />
      ) : links.isError ? (
        <ErrorState onRetry={() => void links.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No relationships found" description="Try a different search term." />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((link) => (
            <RelationshipCard
              key={link.id}
              link={link}
              title={userName(link.AppUserId)}
              subtitle={link.SerialNumber}
              action={
                permissions.canManageRelationships && link.Active ? (
                  <Button variant="outline" size="sm" onClick={() => setRevokeId(link.id)}>
                    Revoke access
                  </Button>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <ConfirmationDialog
        open={!!revokeId}
        onOpenChange={(v) => !v && setRevokeId(null)}
        title="Revoke access?"
        description="Are you sure you want to revoke this relationship? The record is retained and marked revoked."
        confirmLabel="Revoke access"
        destructive
        loading={revoke.isPending}
        onConfirm={() => revokeId && revoke.mutate(revokeId)}
      />
    </AppShell>
  );
}
