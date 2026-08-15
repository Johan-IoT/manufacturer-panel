import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Pill } from "@/components/app/badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { FormModal } from "@/components/app/dialogs";
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
        description="Messages delivered to app users through the companion mobile app."
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Notifications" }]}
        actions={<Button onClick={() => setOpen(true)}>New notification</Button>}
      />

      {list.isLoading ? (
        <LoadingState label="Loading notifications" />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState title="No notifications yet" description="Send your first notification to app users." />
      ) : (
        <div className="space-y-3">
          {(list.data ?? []).map((n) => (
            <article key={n.id} className="rounded-lg border border-border bg-surface p-4 shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{n.Title}</h2>
                <div className="flex items-center gap-2">
                  <Pill tone="info">{n.NotificationType}</Pill>
                  <span className="font-mono text-xs text-muted-foreground">{formatDateTime(n.CreatedAt)}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{n.Body}</p>
            </article>
          ))}
        </div>
      )}

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Send notification"
        description="This message is delivered to every active app user."
        submitLabel="Send notification"
        loading={send.isPending}
        canSubmit={parsed.success}
        onSubmit={() => send.mutate()}
      >
        <div className="space-y-1.5">
          <Label htmlFor="n-title">Title</Label>
          <Input id="n-title" className="bg-background" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="n-body">Message</Label>
          <Textarea id="n-body" className="bg-background" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
        </div>
      </FormModal>
    </AppShell>
  );
}
