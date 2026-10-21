import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { CapabilityBadges, StatusBadge, Pill } from "@/components/app/badges";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { EditUserDialog } from "@/components/users/edit-user-dialog";
import { VerifyContacts } from "@/components/users/verify-contacts";
import { UserDevices } from "@/components/users/user-devices";
import { SupportOptInSwitch } from "@/components/support/support-opt-in";
import { SendNotificationDialog } from "@/components/notifications/send-notification-dialog";
import { AsyncPageContent } from "@/components/app/page-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDateTime } from "@/lib/format";
import { useAuth, usePermissions } from "@/lib/auth";
import type { AccountStatus, AppUser } from "@/types/entities";
import { cn } from "@/lib/utils";
import { iconTone } from "@/lib/icon-colors";

export const Route = createFileRoute("/users/$userId")({
  head: () => ({
    meta: [
      { title: "User detail | Manufacturer Panel | ConfigGate" },
      {
        name: "description",
        content: "Account details and device relationships for a single app user.",
      },
      { property: "og:title", content: "User detail | Manufacturer Panel" },
      { property: "og:description", content: "App user account and linked devices." },
    ],
  }),
  component: UserDetailPage,
});

type PendingAction = { type: "status"; status: AccountStatus } | { type: "delete" } | null;

function UserDetailPage() {
  const { userId } = useParams({ from: "/users/$userId" });
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const { session, updateSessionUser } = useAuth();

  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => userService.get(userId),
  });

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
    onError: (e) =>
      toast.error(toUserMessage(e, "Unable to update account status. Please try again.")),
  });

  const deleteUser = useMutation({
    mutationFn: () => userService.remove(userId),
    onSuccess: () => {
      toast.success("User deleted. Their devices were released.");
      setPendingAction(null);
      invalidateUser();
      void queryClient.invalidateQueries({ queryKey: ["links"] });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to delete this user. Please try again.")),
  });

  const updateCapabilities = useMutation({
    mutationFn: (capabilities: { IsManufacturer?: boolean; IsInstaller?: boolean }) =>
      userService.updateCapabilities(userId, capabilities),
    onSuccess: () => {
      toast.success("Capabilities updated successfully.");
      invalidateUser();
    },
    onError: (e) =>
      toast.error(toUserMessage(e, "Unable to update capabilities. Please try again.")),
  });

  const user = userQuery.data;
  const canManage = permissions.canManageUsers;
  const isSelf = session?.user.id === userId;

  const confirmCopy = (action: NonNullable<PendingAction>) => {
    if (action.type === "delete") {
      return {
        title: "Delete this user?",
        description:
          "The user can no longer sign in and is hidden from the Users list. Their owned devices are released, and all their shares end. History is kept.",
        confirmLabel: "Delete user",
      };
    }
    return statusConfirmCopy(action.status);
  };

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
          description:
            "This permanently blocks the account. Use suspend if access should be temporary.",
          confirmLabel: "Disable account",
        };
      default:
        return {
          title: "Update account status?",
          description: "Confirm this account status change.",
          confirmLabel: "Confirm",
        };
    }
  };

  return (
    <>
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
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                      <Pencil className="mr-2 size-4" /> Edit
                    </Button>
                    {user.AccountStatus === "Pending" && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => setPendingAction({ type: "status", status: "Active" })}
                      >
                        Approve
                      </Button>
                    )}
                    {user.AccountStatus === "Active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingAction({ type: "status", status: "Suspended" })}
                      >
                        Suspend
                      </Button>
                    )}
                    {(user.AccountStatus === "Suspended" || user.AccountStatus === "Disabled") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingAction({ type: "status", status: "Active" })}
                      >
                        Reactivate
                      </Button>
                    )}
                    {user.AccountStatus !== "Disabled" && (
                      <Button variant="outline" size="sm" onClick={() => setNotifyOpen(true)}>
                        <Bell className="mr-2 size-4" /> Send Notification
                      </Button>
                    )}
                    {user.AccountStatus !== "Disabled" && !isSelf && (
                      <Button
                        variant="destructiveOutline"
                        size="sm"
                        onClick={() => setPendingAction({ type: "delete" })}
                      >
                        <Trash2 className="mr-2 size-4" /> Delete
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
                  <dt className="text-xs text-muted-foreground">Company</dt>
                  <dd className="mt-0.5 text-sm">{user.CompanyName || "Not set"}</dd>
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
                  <ShieldCheck
                    className={cn(
                      "size-3",
                      user.EmailVerified ? iconTone.success : iconTone.warning,
                    )}
                  />
                  Email {user.EmailVerified ? "verified" : "unverified"}
                </Pill>
                <Pill tone={user.MobileVerified ? "success" : "warning"}>
                  <ShieldCheck
                    className={cn(
                      "size-3",
                      user.MobileVerified ? iconTone.success : iconTone.warning,
                    )}
                  />
                  Mobile {user.MobileVerified ? "verified" : "unverified"}
                </Pill>
              </div>
            </section>

            {canManage && (!user.EmailVerified || !user.MobileVerified) && (
              <section className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-none">
                <h2 className="mb-1 text-sm font-semibold">Verification</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  This user cannot sign in until the email and mobile number are confirmed with the
                  codes sent to them.
                </p>
                <VerifyContacts
                  user={user}
                  onVerified={(saved: AppUser) => {
                    queryClient.setQueryData(["user", userId], saved);
                    invalidateUser();
                  }}
                />
              </section>
            )}

            {canManage && (
              <section className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-none">
                <h2 className="mb-4 text-sm font-semibold">Capabilities</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor="manufacturer-cap">Manufacturer capability</Label>
                      <p className="text-xs text-muted-foreground">
                        Grants access to the Manufacturer Panel.
                      </p>
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
                      <p className="text-xs text-muted-foreground">
                        Allows field provisioning and device linking.
                      </p>
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
                  {user.IsManufacturer && <SupportOptInSwitch user={user} />}
                </div>
              </section>
            )}

            <UserDevices user={user} canManage={canManage} />
          </>
        )}
      </AsyncPageContent>

      {user && canManage && (
        <EditUserDialog
          user={user}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={(saved: AppUser) => {
            queryClient.setQueryData(["user", userId], saved);
            invalidateUser();
            // Keeps the header in step when admins edit their own details.
            updateSessionUser(saved);
          }}
        />
      )}

      <ConfirmationDialog
        open={!!pendingAction}
        onOpenChange={(v) => !v && setPendingAction(null)}
        title={pendingAction ? confirmCopy(pendingAction).title : "Confirm"}
        description={pendingAction ? confirmCopy(pendingAction).description : ""}
        confirmLabel={pendingAction ? confirmCopy(pendingAction).confirmLabel : "Confirm"}
        destructive={
          pendingAction?.type === "delete" ||
          (pendingAction?.type === "status" && pendingAction.status === "Suspended")
        }
        loading={setStatus.isPending || deleteUser.isPending}
        onConfirm={() => {
          if (!pendingAction) return;
          if (pendingAction.type === "delete") deleteUser.mutate();
          else setStatus.mutate(pendingAction.status);
        }}
      />

      {user && (
        <SendNotificationDialog
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
          recipients={[{ id: user.id, name: `${user.FirstName} ${user.LastName}`.trim() }]}
        />
      )}
    </>
  );
}
