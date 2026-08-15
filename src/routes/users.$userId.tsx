import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Pill } from "@/components/app/badges";
import { RelationshipCard } from "@/components/app/cards";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { relationshipService, userService } from "@/services";

export const Route = createFileRoute("/users/$userId")({
  head: () => ({
    meta: [
      { title: "User detail — Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Account details and device relationships for a single app user." },
      { property: "og:title", content: "User detail — Manufacturer Panel" },
      { property: "og:description", content: "App user account and linked devices." },
    ],
  }),
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = useParams({ from: "/users/$userId" });
  const userQuery = useQuery({ queryKey: ["user", userId], queryFn: () => userService.get(userId) });
  const linksQuery = useQuery({ queryKey: ["links", "user", userId], queryFn: () => relationshipService.listForUser(userId) });

  if (userQuery.isLoading) {
    return (
      <AppShell>
        <LoadingState label="Loading user" />
      </AppShell>
    );
  }
  if (userQuery.isError || !userQuery.data) {
    return (
      <AppShell>
        <ErrorState description="This user could not be loaded." onRetry={() => void userQuery.refetch()} />
      </AppShell>
    );
  }

  const user = userQuery.data;

  return (
    <AppShell>
      <PageHeader
        title={`${user.FirstName} ${user.LastName}`}
        description="Account record and linked devices."
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "App Users", to: "/users" }, { label: user.FirstName }]}
        meta={
          <>
            <Pill tone="info">{user.UserRole}</Pill>
            <Pill tone={user.AccountStatus === "Active" ? "success" : "warning"}>{user.AccountStatus}</Pill>
          </>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Device relationships</h2>
        {linksQuery.isLoading ? (
          <LoadingState label="Loading relationships" />
        ) : linksQuery.isError ? (
          <ErrorState onRetry={() => void linksQuery.refetch()} />
        ) : (linksQuery.data ?? []).length === 0 ? (
          <EmptyState title="No devices linked" description="This user has no device relationships yet." />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {(linksQuery.data ?? []).map((link) => (
              <RelationshipCard key={link.id} link={link} title={link.DeviceSerialNumber} subtitle={link.LinkType} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
