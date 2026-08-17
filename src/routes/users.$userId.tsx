import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { CapabilityBadges, StatusBadge, Pill } from "@/components/app/badges";
import { RelationshipCard } from "@/components/app/cards";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { EmptyState } from "@/components/app/states";
import { AnimatedStagger, AsyncPageContent } from "@/components/app/page-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { relationshipService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDateTime } from "@/lib/format";
import { usePermissions } from "@/lib/auth";
import type { AccountStatus } from "@/types/entities";
import { cn } from "@/lib/utils";
import { iconTone } from "@/lib/icon-colors";

export const Route = createFileRoute("/users/$userId")({
  head: () => ({
    meta: [
      { title: "User detail | Manufacturer Panel | ConfigGate" },
      { name: "description", content: "Account details and device relationships for a single app user." },
      { property: "og:title", content: "User detail | Manufacturer Panel" },
      { property: "og:description", content: "App user account and linked devices." },
    ],
  }),
  component: UserDetailPage,
});

type PendingAction = { type: "status"; status: AccountStatus } | null;

function UserDetailPage() {
  const { userId } = useParams({ from: "/users/$userId" });
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const userQuery = useQuery({ queryKey: ["user", userId], queryFn: () => userService.get(userId) });
  const linksQuery = useQuery({ queryKey: ["links", "user", userId], queryFn: () => relationshipService.listForUser(userId) });

  const invalidateUser = () => {
    void queryClient.invalidateQueries({ queryKey: ["user", userId] });
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const setStatus = useMutation({
    mutationFn: (status: AccountStatus) => userService.setAccountStatus(userId, status),
    onSuccess: (user) => {
      toast.success(`Account status updated to ${user.AccountStatus}.`);
      setPendingAction(null);
      invalidateUser();
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to update account status. Please try again.")),
  });

  const updateCapabilities = useMutation({
    mutationFn: (capabilities: { IsManufacturer?: boolean; IsInstaller?: boolean }) =>
      userService.updateCapabilities(userId, capabilities),
    onSuccess: () => {
      toast.success("Capabilities updated successfully.");
      invalidateUser();
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to update capabilities. Please try again.")),
  });

  const user = userQuery.data;
  const canManage = permissions.canManageUsers;

  const statusConfirmCopy = (status: AccountStatus) => {
    switch (status) {
      case "Active":
        return {
          title: "Approve this account?",
          description: "This will activate the account and allow the user to sign in.",
          confirmLabel: "Approve account",
        };
      case "Suspended":
        return {
          title: "Suspend this account?",
          description: "The user will be blocked from signing in until the account is reactivated.",
          confirmLabel: "Suspend account",
        };
      case "Disabled":
        return {
          title: "Disable this account?",
          description: "This permanently blocks the account. Use suspend if access should be temporary.",
          confirmLabel: "Disable account",
        };
      default:
        return { title: "Update account status?", description: "Confirm this account status change.", confirmLabel: "Confirm" };
    }
  };

  return (
    <AppShell>
      <AsyncPageContent
        isLoading={userQuery.isLoading}
        isError={userQuery.isError || !userQuery.data}
        onRetry={() => void userQuery.refetch()}
        loadingLabel="Loading user"
        errorTitle="Unable to load user"
      >
        {user && (
          <>
            <PageHeader
              title={`${user.FirstName} ${user.LastName}`}
              breadcrumbs={[
                { label: "Manufacturer Panel", to: "/" },
                { label: "App Users", to: "/users" },
                { label: user.FirstName },
              ]}
              meta={
                <>
                  <CapabilityBadges user={user} />
                  <StatusBadge status={user.AccountStatus} />
                </>
              }
              actions={
                canManage ? (
                  <div className="flex flex-wrap gap-2">
                    {user.AccountStatus === "Pending" && (
                      <Button variant="success" size="sm" onClick={() => setPendingAction({ type: "status", status: "Active" })}>
                        Approve
                      </Button>
                    )}
                    {user.AccountStatus === "Active" && (
                      <Button variant="outline" size="sm" onClick={() => setPendingAction({ type: "status", status: "Suspended" })}>
                        Suspend
                      </Button>
                    )}
                    {user.AccountStatus !== "Disabled" && (
                      <Button variant="destructiveOutline" size="sm" onClick={() => setPendingAction({ type: "status", status: "Disabled" })}>
                        Disable
                      </Button>
                    )}
                    {(user.AccountStatus === "Suspended" || user.AccountStatus === "Disabled") && (
                      <Button variant="outline" size="sm" onClick={() => setPendingAction({ type: "status", status: "Active" })}>
                        Reactivate
                      </Button>
                    )}
                  </div>
                ) : undefined
              }
            />

            <section className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-none">
              <h2 className="mb-4 text-sm font-semibold">Account details</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="mt-0.5 text-sm">{user.Email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Mobile number</dt>
                  <dd className="mt-0.5 text-sm">{user.MobileNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last login</dt>
                  <dd className="mt-0.5 text-sm">{formatDateTime(user.LastLoginAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Member since</dt>
                  <dd className="mt-0.5 text-sm">{formatDateTime(user.CreatedAt)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill tone={user.EmailVerified ? "success" : "warning"}>
                  <ShieldCheck className={cn("size-3", user.EmailVerified ? iconTone.success : iconTone.warning)} />
                  Email {user.EmailVerified ? "verified" : "unverified"}
                </Pill>
                <Pill tone={user.MobileVerified ? "success" : "warning"}>
                  <ShieldCheck className={cn("size-3", user.MobileVerified ? iconTone.success : iconTone.warning)} />
                  Mobile {user.MobileVerified ? "verified" : "unverified"}
                </Pill>
              </div>
            </section>

            {canManage && (
              <section className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-none">
                <h2 className="mb-4 text-sm font-semibold">Capabilities</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor="manufacturer-cap">Manufacturer capability</Label>
                      <p className="text-xs text-muted-foreground">Grants access to the Manufacturer Panel.</p>
                    </div>
                    <Switch
                      id="manufacturer-cap"
                      checked={user.IsManufacturer}
                      disabled={updateCapabilities.isPending}
                      onCheckedChange={(checked) =>
                        updateCapabilities.mutate({
                          IsManufacturer: checked,
                          IsInstaller: user.IsInstaller,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor="installer-cap">Installer capability</Label>
                      <p className="text-xs text-muted-foreground">Allows field provisioning and device linking.</p>
                    </div>
                    <Switch
                      id="installer-cap"
                      checked={user.IsInstaller}
                      disabled={updateCapabilities.isPending}
                      onCheckedChange={(checked) =>
                        updateCapabilities.mutate({
                          IsManufacturer: user.IsManufacturer,
                          IsInstaller: checked,
                        })
                      }
                    />
                  </div>
                </div>
              </section>
            )}

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

      <ConfirmationDialog
        open={!!pendingAction}
        onOpenChange={(v) => !v && setPendingAction(null)}
        title={pendingAction ? statusConfirmCopy(pendingAction.status).title : "Confirm"}
        description={pendingAction ? statusConfirmCopy(pendingAction.status).description : ""}
        confirmLabel={pendingAction ? statusConfirmCopy(pendingAction.status).confirmLabel : "Confirm"}
        destructive={pendingAction?.status === "Disabled" || pendingAction?.status === "Suspended"}
        loading={setStatus.isPending}
        onConfirm={() => pendingAction && setStatus.mutate(pendingAction.status)}
      />
    </AppShell>
  );
}
