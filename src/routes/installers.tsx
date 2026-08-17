import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { Pill } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { relationshipService, userService } from "@/services";
import type { AppUser } from "@/types/entities";
import { usePermissions } from "@/lib/auth";

export const Route = createFileRoute("/installers")({
  head: () => ({
    meta: [
      { title: "Installers | Manufacturer Panel | ConfigGate" },
      { name: "description", content: "Installer accounts and the devices they currently have access to." },
      { property: "og:title", content: "Installers | Manufacturer Panel" },
      { property: "og:description", content: "Installer coverage across the device fleet." },
    ],
  }),
  component: InstallersPage,
});

function InstallersPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const users = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const links = useQuery({ queryKey: ["links"], queryFn: () => relationshipService.list() });

  const installers = (users.data ?? []).filter((u) => u.IsInstaller);
  const deviceCount = (id: string) => (links.data ?? []).filter((l) => l.AppUserId === id && l.Active).length;

  const columns: Column<AppUser>[] = [
    { key: "name", header: "Installer", sortValue: (u) => u.LastName, render: (u) => `${u.FirstName} ${u.LastName}` },
    { key: "status", header: "Account Status", render: (u) => <Pill tone={u.AccountStatus === "Active" ? "success" : "warning"}>{u.AccountStatus}</Pill> },
    {
      key: "devices",
      header: "Active devices",
      sortValue: (u) => deviceCount(u.id),
      render: (u) => <span className="tabular-nums">{deviceCount(u.id)}</span>,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Installers"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Installers" }]}
        actions={
          permissions.canManageUsers ? (
            <Button onClick={() => navigate({ to: "/users/new" })}>
              <Plus className="mr-2 size-4" /> Create Installer
            </Button>
          ) : undefined
        }
      />
      <DataTable
        data={installers}
        columns={columns}
        rowKey={(u) => u.id}
        isLoading={users.isLoading || links.isLoading}
        isError={users.isError}
        onRetry={() => void users.refetch()}
        searchPlaceholder="Search installers"
        searchFields={[(u) => u.FirstName, (u) => u.LastName]}
        onRowClick={(u) => navigate({ to: "/users/$userId", params: { userId: u.id } })}
        emptyTitle="No installers"
      />
    </AppShell>
  );
}
