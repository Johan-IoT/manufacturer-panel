import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { ThreadStatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/states";
import { AnimatedContent, AnimatedStagger, AsyncPageContent } from "@/components/app/page-layout";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supportService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDateTime } from "@/lib/format";
import { useAuth, usePermissions } from "@/lib/auth";
import type { SupportThreadStatus } from "@/types/entities";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support | Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Read support threads from app users and reply manually." },
      { property: "og:title", content: "Support | Manufacturer Panel" },
      { property: "og:description", content: "Manual support inbox for the GSM Systems BLE ecosystem." },
    ],
  }),
  component: SupportPage,
});

const THREAD_STATUSES: SupportThreadStatus[] = ["Open", "In Progress", "Resolved", "Closed"];

function SupportPage() {
  const { session } = useAuth();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [confirmReply, setConfirmReply] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<SupportThreadStatus | null>(null);

  const threads = useQuery({ queryKey: ["support"], queryFn: () => supportService.listThreads() });
  const users = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const selectedId = activeId ?? threads.data?.[0]?.id ?? null;
  const detail = useQuery({
    queryKey: ["support", selectedId],
    queryFn: () => supportService.getThread(selectedId!),
    enabled: !!selectedId,
  });

  const userName = (id: string) => {
    const u = users.data?.find((x) => x.id === id);
    return u ? `${u.FirstName} ${u.LastName}` : "Unknown user";
  };

  const send = useMutation({
    mutationFn: () => supportService.reply(selectedId!, session!.user.id, reply.trim()),
    onSuccess: () => {
      toast.success("Reply sent successfully.");
      setConfirmReply(false);
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["support", selectedId] });
      void queryClient.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to send this reply. Please try again.")),
  });

  const setStatus = useMutation({
    mutationFn: (status: SupportThreadStatus) => supportService.setStatus(selectedId!, status),
    onSuccess: (thread) => {
      toast.success(`Thread status updated to ${thread.Status}.`);
      setPendingStatus(null);
      void queryClient.invalidateQueries({ queryKey: ["support", selectedId] });
      void queryClient.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to update thread status. Please try again.")),
  });

  const currentStatus = detail.data?.thread.Status;

  return (
    <AppShell>
      <PageHeader
        title="Support"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Support" }]}
      />

      <AsyncPageContent
        isLoading={threads.isLoading}
        isError={threads.isError}
        onRetry={() => void threads.refetch()}
        loadingLabel="Loading support threads"
      >
        {(threads.data ?? []).length === 0 ? (
          <EmptyState title="No support threads" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <AnimatedStagger className="space-y-2">
              {(threads.data ?? []).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    t.id === selectedId ? "border-primary bg-surface" : "border-border bg-surface hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{t.Subject}</span>
                    <ThreadStatusBadge status={t.Status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {userName(t.OpenedByUserId)} · {formatDateTime(t.LastMessageAt)}
                  </p>
                </button>
              ))}
            </AnimatedStagger>

            <section className="rounded-lg border border-border bg-surface p-4 shadow-none">
              <AsyncPageContent
                isLoading={detail.isPending}
                isError={detail.isError}
                onRetry={() => void detail.refetch()}
                loadingLabel="Loading thread"
                shellClassName="border-0 bg-transparent"
              >
                {() => (
                  <AnimatedContent>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="text-sm font-semibold">{detail.data!.thread.Subject}</h2>
                      {permissions.canReplySupport && currentStatus && (
                        <div className="flex items-center gap-2">
                          <Label htmlFor="thread-status" className="sr-only">
                            Thread status
                          </Label>
                          <Select
                            value={currentStatus}
                            onValueChange={(v) => setPendingStatus(v as SupportThreadStatus)}
                          >
                            <SelectTrigger id="thread-status" className="h-8 w-40 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {THREAD_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 space-y-3">
                      {detail.data!.messages.map((m) => (
                        <div key={m.id} className="rounded-md border border-border/70 bg-background p-3">
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>{userName(m.AuthorUserId)}</span>
                            <span className="font-mono">{formatDateTime(m.SentAt)}</span>
                          </div>
                          <p className="mt-2 text-sm">{m.Body}</p>
                        </div>
                      ))}
                    </div>
                    {permissions.canReplySupport && (
                      <div className="mt-4 space-y-2">
                        <Textarea
                          rows={3}
                          className="bg-background"
                          placeholder="Write a reply…"
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          maxLength={1000}
                        />
                        <div className="flex justify-end">
                          <Button disabled={!reply.trim() || send.isPending} onClick={() => setConfirmReply(true)}>
                            {send.isPending ? "Sending…" : "Send reply"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </AnimatedContent>
                )}
              </AsyncPageContent>
            </section>
          </div>
        )}
      </AsyncPageContent>

      <ConfirmationDialog
        open={confirmReply}
        onOpenChange={setConfirmReply}
        title="Send support reply?"
        description="Your reply will be sent to the user in this thread."
        confirmLabel="Send reply"
        loading={send.isPending}
        onConfirm={() => send.mutate()}
      />

      <ConfirmationDialog
        open={!!pendingStatus}
        onOpenChange={(v) => !v && setPendingStatus(null)}
        title="Change thread status?"
        description={`Update this thread status to ${pendingStatus ?? ""}.`}
        confirmLabel="Update status"
        loading={setStatus.isPending}
        onConfirm={() => pendingStatus && setStatus.mutate(pendingStatus)}
      />
    </AppShell>
  );
}
