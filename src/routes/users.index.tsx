import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { CapabilityBadges, StatusBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { userService } from "@/services";
import type { AppUser } from "@/types/entities";
import { usePermissions } from "@/lib/auth";

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
  const query = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });

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
    <AppShell>
      <PageHeader
        title="App Users"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "App Users" }]}
        actions={
          permissions.canManageUsers ? (
            <Button onClick={() => navigate({ to: "/users/new" })}>
              <Plus className="mr-2 size-4" /> Create Installer
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
      />
    </AppShell>
  );
}
