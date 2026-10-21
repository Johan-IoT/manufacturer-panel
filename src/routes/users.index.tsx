import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { CapabilityBadges, StatusBadge } from "@/components/app/badges";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { userService } from "@/services";
import { toUserMessage } from "@/services/client";
import type { AppUser } from "@/types/entities";
import { useAuth, usePermissions } from "@/lib/auth";
import { formatDate, initials, relativeTime } from "@/lib/format";

const NO_COMPANY = "__none__";

/** Rights filter: Manufacturer / Installer rights, or a plain app user. */
const RIGHTS_OPTIONS = [
  { value: "manufacturer", label: "Manufacturer" },
  { value: "installer", label: "Installer" },
  { value: "app-user", label: "App user only" },
];

function hasRights(u: AppUser, value: string): boolean {
  if (value === "manufacturer") return u.IsManufacturer;
  if (value === "installer") return u.IsInstaller;
  return !u.IsManufacturer && !u.IsInstaller;
}

/** Digits only, so "+27 82 123" and "2782123" both match a cellphone search. */
function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export const Route = createFileRoute("/users/")({
  head: () => ({
    meta: [
      { title: "App Users | Manufacturer Panel | ConfigGate" },
      {
        name: "description",
        content: "Browse app user accounts, capabilities and account status across the ecosystem.",
      },
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
  /** Deleted users (Disabled) are hidden unless asked for. */
  const [showDeleted, setShowDeleted] = useState(false);
  const query = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const visibleUsers = useMemo(
    () =>
      query.data
        ? showDeleted
          ? query.data
          : query.data.filter((u) => u.AccountStatus !== "Disabled")
        : undefined,
    [query.data, showDeleted],
  );

  const deleteUser = useMutation({
    mutationFn: (id: string) => userService.remove(id),
    onSuccess: () => {
      toast.success("User deleted. Their devices were released.");
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["links"] });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to delete this user. Please try again.")),
  });

  const companyOptions = useMemo(() => {
    const names = new Set<string>();
    let hasNone = false;
    for (const u of query.data ?? []) {
      const company = u.CompanyName?.trim();
      if (company) names.add(company);
      else hasNone = true;
    }
    const options = [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
    return hasNone ? [...options, { value: NO_COMPANY, label: "No company" }] : options;
  }, [query.data]);

  const columns: Column<AppUser>[] = [
    {
      key: "name",
      header: "User",
      sortValue: (u) => `${u.FirstName} ${u.LastName}`.toLowerCase(),
      render: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(u.FirstName, u.LastName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {`${u.FirstName} ${u.LastName}`.trim()}
            </p>
            <p className="truncate text-xs text-muted-foreground">{u.Email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "appId",
      header: "App ID",
      sortValue: (u) => Number(u.id) || 0,
      render: (u) => (
        <span className="font-mono text-xs text-foreground">{u.AppId || "-"}</span>
      ),
    },
    {
      key: "mobile",
      header: "Cellphone",
      render: (u) => (
        <span className="font-mono text-xs text-foreground">{u.MobileNumber || "-"}</span>
      ),
    },
    {
      key: "company",
      header: "Company",
      sortValue: (u) => (u.CompanyName ?? "").toLowerCase(),
      render: (u) =>
        u.CompanyName ? (
          <span className="text-sm text-foreground">{u.CompanyName}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "capabilities",
      header: "Rights",
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          <CapabilityBadges user={u} />
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (u) => u.AccountStatus,
      render: (u) => <StatusBadge status={u.AccountStatus} />,
    },
    {
      key: "lastLogin",
      header: "Last Login",
      sortValue: (u) => u.LastLoginAt ?? "",
      render: (u) => (
        <span className="text-xs text-muted-foreground" title={formatDate(u.LastLoginAt)}>
          {u.LastLoginAt ? relativeTime(u.LastLoginAt) : "Never"}
        </span>
      ),
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
        data={visibleUsers}
        toolbarExtra={
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
              aria-label="Show deleted users"
            />
            Show deleted
          </label>
        }
        columns={columns}
        rowKey={(u) => u.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        searchPlaceholder="Search by name, email, cellphone or App ID"
        searchFields={[
          (u) => `${u.FirstName} ${u.LastName}`,
          (u) => u.AppId ?? "",
          (u) => u.Email ?? "",
          (u) => u.MobileNumber ?? "",
          (u) => digits(u.MobileNumber),
        ]}
        filters={[
          {
            key: "rights",
            label: "Rights",
            options: RIGHTS_OPTIONS,
            predicate: hasRights,
          },
          {
            key: "company",
            label: "Company",
            options: companyOptions,
            predicate: (u, v) =>
              v === NO_COMPANY ? !u.CompanyName?.trim() : u.CompanyName?.trim() === v,
          },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "Active", label: "Active" },
              { value: "Suspended", label: "Suspended" },
              { value: "Pending", label: "Pending" },
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
        description={`Delete ${toDelete ? `${toDelete.FirstName} ${toDelete.LastName}` : "this user"}? They can no longer sign in and are hidden from this list. Their owned devices are released and all their shares end. History is kept.`}
        confirmLabel="Delete user"
        destructive
        loading={deleteUser.isPending}
        onConfirm={() => toDelete && deleteUser.mutate(toDelete.id)}
      />
    </>
  );
}
