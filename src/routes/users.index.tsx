import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { Pill } from "@/components/app/badges";
import { userService } from "@/services";
import type { AppUser } from "@/types/entities";

export const Route = createFileRoute("/users/")({
  head: () => ({
    meta: [
      { title: "App Users — Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Browse app user accounts, roles and account status across the ecosystem." },
      { property: "og:title", content: "App Users — Manufacturer Panel" },
      { property: "og:description", content: "User directory for the GSM Systems BLE ecosystem." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });

  const columns: Column<AppUser>[] = [
    { key: "name", header: "Name", sortValue: (u) => u.LastName, render: (u) => `${u.FirstName} ${u.LastName}` },
    { key: "role", header: "Role", render: (u) => <Pill tone="info">{u.UserRole}</Pill> },
    {
      key: "status",
      header: "Account Status",
      render: (u) => <Pill tone={u.AccountStatus === "Active" ? "success" : u.AccountStatus === "Suspended" ? "warning" : "danger"}>{u.AccountStatus}</Pill>,
    },
  ];

  return (
    <AppShell>
      <PageHeader title="App Users" breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "App Users" }]} />
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
