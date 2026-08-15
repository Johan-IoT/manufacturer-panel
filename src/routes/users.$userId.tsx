import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Pill } from "@/components/app/badges";
import { RelationshipCard } from "@/components/app/cards";
import { EmptyState } from "@/components/app/states";
import { AnimatedStagger, AsyncPageContent } from "@/components/app/page-layout";
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

  return (
    <AppShell>
      <AsyncPageContent
        isLoading={userQuery.isLoading}
        isError={userQuery.isError || !userQuery.data}
        onRetry={() => void userQuery.refetch()}
        loadingLabel="Loading user"
        errorTitle="Unable to load user"
      >
        {userQuery.data && (
          <>
            <PageHeader
              title={`${userQuery.data.FirstName} ${userQuery.data.LastName}`}
              breadcrumbs={[
                { label: "Manufacturer Panel", to: "/" },
                { label: "App Users", to: "/users" },
                { label: userQuery.data.FirstName },
              ]}
              meta={
                <>
                  <Pill tone="info">{userQuery.data.UserRole}</Pill>
                  <Pill tone={userQuery.data.AccountStatus === "Active" ? "success" : "warning"}>{userQuery.data.AccountStatus}</Pill>
                </>
              }
            />

            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Device relationships</h2>
              <AsyncPageContent
                isLoading={linksQuery.isLoading}
                isError={linksQuery.isError}
                onRetry={() => void linksQuery.refetch()}
                loadingLabel="Loading relationships"
                shellClassName="border-0 bg-transparent"
              >
                {(linksQuery.data ?? []).length === 0 ? (
                  <EmptyState title="No devices linked" />
                ) : (
                  <AnimatedStagger className="grid gap-3 xl:grid-cols-2">
                    {(linksQuery.data ?? []).map((link) => (
                      <RelationshipCard key={link.id} link={link} title={link.DeviceSerialNumber} subtitle={link.LinkType} />
                    ))}
                  </AnimatedStagger>
                )}
              </AsyncPageContent>
            </section>
          </>
        )}
      </AsyncPageContent>
    </AppShell>
  );
}
