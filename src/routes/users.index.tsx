import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { CapabilityBadges, StatusBadge } from "@/components/app/badges";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { userService } from "@/services";
import { toUserMessage } from "@/services/client";
import type { AppUser } from "@/types/entities";
import { useAuth, usePermissions } from "@/lib/auth";

export const Route = createFileRoute("/users/")({
  head: () => ({
    meta: [
      { title: "App Users | Manufacturer Panel | ConfigGate" },
      { name: "description", content: "Browse app user accounts, capabilities and account status across the ecosystem." },
      { property: "og:title", content: "App Users | Manufacturer Panel" },
      { property: "og:description", content: "User directory for the ConfigGate BLE ecosystem." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<AppUser | null>(null);
  const query = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });

  const disableUser = useMutation({
    mutationFn: (id: string) => userService.setAccountStatus(id, "Disabled"),
    onSuccess: () => {
      toast.success("User account disabled.");
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to disable user. Please try again.")),
  });

  const columns: Column<AppUser>[] = [
    { key: "name", header: "Name", sortValue: (u) => u.LastName, render: (u) => `${u.FirstName} ${u.LastName}` },
    { key: "capabilities", header: "Capabilities", render: (u) => <CapabilityBadges user={u} /> },
    {
      key: "status",
      header: "Account Status",
      render: (u) => <StatusBadge status={u.AccountStatus} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="App Users"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "App Users" }]}
        actions={
          permissions.canManageUsers ? (
            <Button onClick={() => navigate({ to: "/users/new" })}>
              <Plus className="mr-2 size-4" /> Create User
            </Button>
          ) : undefined
        }
      />
      <DataTable
        data={query.data}
        columns={columns}
        rowKey={(u) => u.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Search by name"
        searchFields={[(u) => u.FirstName, (u) => u.LastName]}
        filters={[
          {
            key: "status",
            label: "Account Status",
            options: [
              { value: "Active", label: "Active" },
              { value: "Pending", label: "Pending" },
              { value: "Suspended", label: "Suspended" },
              { value: "Disabled", label: "Disabled" },
            ],
            predicate: (u, v) => u.AccountStatus === v,
          },
        ]}
        onRowClick={(u) => navigate({ to: "/users/$userId", params: { userId: u.id } })}
        emptyTitle="No users"
        rowActions={
          permissions.canManageUsers
            ? (u) => {
                const isSelf = session?.user.id === u.id;
                const isDisabled = u.AccountStatus === "Disabled";
                if (isSelf || isDisabled) return null;
                return (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${u.FirstName} ${u.LastName}`}
                    className="text-destructive hover:bg-destructive/15 hover:text-destructive focus-visible:text-destructive"
                    onClick={() => setToDelete(u)}
                  >
                    <Trash2 className="size-4 text-destructive" strokeWidth={2.25} />
                  </Button>
                );
              }
            : undefined
        }
      />

      <ConfirmationDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this user?"
        description={`Disable ${toDelete ? `${toDelete.FirstName} ${toDelete.LastName}` : "this user"}? They will be blocked from signing in. Account history is preserved; the user is not removed from the database.`}
        confirmLabel="Delete user"
        destructive
        loading={disableUser.isPending}
        onConfirm={() => toDelete && disableUser.mutate(toDelete.id)}
      />
    </>
  );
}
