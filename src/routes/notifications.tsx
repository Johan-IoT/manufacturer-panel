import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { DeliveryStatusBadge, Pill, ReadStateBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { AnimatedStagger, AsyncPageContent } from "@/components/app/page-layout";
import { FormModal, ConfirmationDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notificationService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications | Manufacturer Panel | ConfigGate" },
      { name: "description", content: "Review sent notifications and broadcast new messages to app users." },
      { property: "og:title", content: "Notifications | Manufacturer Panel" },
      { property: "og:description", content: "Notification history and composer." },
    ],
  }),
  component: NotificationsPage,
});

const schema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(120),
  body: z.string().trim().min(1, "Message is required.").max(1000),
  recipientUserIds: z.array(z.string()).min(1, "Select at least one recipient."),
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);

  const list = useQuery({ queryKey: ["notifications"], queryFn: () => notificationService.list() });
  const users = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const activeUsers = useMemo(
    () => (users.data ?? []).filter((user) => user.AccountStatus === "Active"),
    [users.data],
  );
  const parsed = schema.safeParse({
    title,
    body,
    recipientUserIds: selectedRecipientIds,
  });

  const toggleRecipient = (userId: string) => {
    setSelectedRecipientIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  const send = useMutation({
    mutationFn: () =>
      notificationService.send({
        recipientUserIds: selectedRecipientIds,
        title: title.trim(),
        body: body.trim(),
      }),
    onSuccess: () => {
      toast.success("Notification sent successfully.");
      setConfirmSend(false);
      setOpen(false);
      setTitle("");
      setBody("");
      setSelectedRecipientIds([]);
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to send this notification. Please try again.")),
  });

  const recipientSummary = useMemo(() => {
    if (selectedRecipientIds.length === 0) return "No recipients selected";
    if (selectedRecipientIds.length === 1) {
      const user = activeUsers.find((entry) => entry.id === selectedRecipientIds[0]);
      return user ? `${user.FirstName} ${user.LastName}` : "1 recipient";
    }
    return `${selectedRecipientIds.length} recipients`;
  }, [activeUsers, selectedRecipientIds]);

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Notifications" }]}
        actions={<Button onClick={() => setOpen(true)}>New notification</Button>}
      />

      <AsyncPageContent
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        loadingLabel="Loading notifications"
      >
        {(list.data ?? []).length === 0 ? (
          <EmptyState title="No notifications yet" />
        ) : (
          <AnimatedStagger className="space-y-3">
            {(list.data ?? []).map((row) => (
              <article key={row.userNotification.id} className="rounded-lg border border-border bg-surface p-4 shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{row.notification.Title}</h2>
                  <div className="flex items-center gap-2">
                    <ReadStateBadge isRead={row.userNotification.IsRead} />
                    <Pill tone="info">{row.notification.NotificationType}</Pill>
                    <span className="font-mono text-xs text-muted-foreground">{formatDateTime(row.notification.CreatedAt)}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{row.notification.Body}</p>
                {row.recipient && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Recipient: {row.recipient.FirstName} {row.recipient.LastName}
                    {row.recipient.Email ? ` (${row.recipient.Email})` : ""}
                  </p>
                )}
                {row.deliveries.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.deliveries.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-2 py-1">
                        <span className="text-xs text-muted-foreground">{d.InstallationLabel}</span>
                        <DeliveryStatusBadge status={d.DeliveryStatus} />
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </AnimatedStagger>
        )}
      </AsyncPageContent>

      <FormModal open={open} onOpenChange={setOpen} title="Send notification">
        <div className="space-y-1.5">
          <Label htmlFor="n-title">Title</Label>
          <Input id="n-title" className="bg-background" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="n-body">Message</Label>
          <Textarea id="n-body" className="bg-background" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
        </div>
        <div className="space-y-2">
          <Label>Select recipients</Label>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3">
            {activeUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active users available.</p>
            ) : (
              activeUsers.map((user) => (
                <label key={user.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedRecipientIds.includes(user.id)}
                    onChange={() => toggleRecipient(user.id)}
                  />
                  <span>
                    {user.FirstName} {user.LastName}
                    <span className="text-muted-foreground"> ({user.Email})</span>
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">{recipientSummary}</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={send.isPending}>
            Cancel
          </Button>
          <Button onClick={() => setConfirmSend(true)} disabled={!parsed.success || send.isPending} variant="success">
            {send.isPending ? "Sending…" : "Send notification"}
          </Button>
        </div>
      </FormModal>

      <ConfirmationDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Send notification?"
        description={`This will send "${title.trim()}" to ${recipientSummary}. This action cannot be undone.`}
        confirmLabel="Send notification"
        loading={send.isPending}
        onConfirm={() => send.mutate()}
      />
    </AppShell>
  );
}
