import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Pill } from "@/components/app/badges";
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
      { title: "Notifications — Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Review sent notifications and broadcast new messages to app users." },
      { property: "og:title", content: "Notifications — Manufacturer Panel" },
      { property: "og:description", content: "Notification history and composer." },
    ],
  }),
  component: NotificationsPage,
});

const schema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(120),
  body: z.string().trim().min(1, "Message is required.").max(1000),
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const list = useQuery({ queryKey: ["notifications"], queryFn: () => notificationService.list() });
  const users = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const parsed = schema.safeParse({ title, body });

  const send = useMutation({
    mutationFn: () =>
      notificationService.send({
        recipientUserIds: (users.data ?? []).map((u) => u.id),
        title: title.trim(),
        body: body.trim(),
      }),
    onSuccess: () => {
      toast.success("Notification sent successfully.");
      setConfirmSend(false);
      setOpen(false);
      setTitle("");
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to send this notification. Please try again.")),
  });

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
                    <Pill tone="info">{row.notification.NotificationType}</Pill>
                    <span className="font-mono text-xs text-muted-foreground">{formatDateTime(row.notification.CreatedAt)}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{row.notification.Body}</p>
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
        description={`This will send "${title.trim()}" to all app users. This action cannot be undone.`}
        confirmLabel="Send notification"
        loading={send.isPending}
        onConfirm={() => send.mutate()}
      />
    </AppShell>
  );
}
