import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Pill, ThreadStatusBadge } from "@/components/app/badges";
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
import type { SupportMessage, SupportThread, SupportThreadStatus } from "@/types/entities";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support | Manufacturer Panel | ConfigGate" },
      { name: "description", content: "Read support threads from app users and reply manually." },
      { property: "og:title", content: "Support | Manufacturer Panel" },
      { property: "og:description", content: "Manual support inbox for the ConfigGate BLE ecosystem." },
    ],
  }),
  component: SupportPage,
});

const THREAD_STATUSES: SupportThreadStatus[] = ["Open", "In Progress", "Resolved", "Closed"];

type UserConversation = {
  userId: string;
  threads: SupportThread[];
  primaryThreadId: string;
  lastMessageAt: string;
  status: SupportThreadStatus;
};

function groupThreadsByUser(threads: SupportThread[]): UserConversation[] {
  const byUser = new Map<string, SupportThread[]>();
  for (const thread of threads) {
    const list = byUser.get(thread.OpenedByUserId) ?? [];
    list.push(thread);
    byUser.set(thread.OpenedByUserId, list);
  }

  return [...byUser.entries()]
    .map(([userId, userThreads]) => {
      const sorted = [...userThreads].sort(
        (a, b) => new Date(b.LastMessageAt).getTime() - new Date(a.LastMessageAt).getTime(),
      );
      const primary = sorted[0]!;
      return {
        userId,
        threads: sorted,
        primaryThreadId: primary.id,
        lastMessageAt: primary.LastMessageAt,
        status: primary.Status,
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

function SupportPage() {
  const { session } = useAuth();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [confirmReply, setConfirmReply] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<SupportThreadStatus | null>(null);

  const threads = useQuery({ queryKey: ["support"], queryFn: () => supportService.listThreads() });
  const users = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });

  const conversations = useMemo(
    () => groupThreadsByUser(threads.data ?? []),
    [threads.data],
  );

  const selectedUserId = activeUserId ?? conversations[0]?.userId ?? null;
  const selectedConversation = conversations.find((c) => c.userId === selectedUserId) ?? null;
  const primaryThreadId = selectedConversation?.primaryThreadId ?? null;

  const threadDetails = useQueries({
    queries: (selectedConversation?.threads ?? []).map((thread) => ({
      queryKey: ["support", thread.id],
      queryFn: () => supportService.getThread(thread.id),
    })),
  });

  const mergedMessages = useMemo(() => {
    const messages: SupportMessage[] = [];
    for (const query of threadDetails) {
      if (query.data?.messages) {
        messages.push(...query.data.messages);
      }
    }
    return messages.sort(
      (a, b) => new Date(a.SentAt).getTime() - new Date(b.SentAt).getTime(),
    );
  }, [threadDetails]);

  const detailLoading = threadDetails.some((q) => q.isPending);
  const detailError = threadDetails.some((q) => q.isError);

  const userLabel = (id: string) => {
    const u = users.data?.find((x) => x.id === id);
    if (!u) return "Unknown user";
    return `${u.FirstName} ${u.LastName}`.trim();
  };

  const userEmail = (id: string) => users.data?.find((x) => x.id === id)?.Email ?? "";

  const send = useMutation({
    mutationFn: () => supportService.reply(primaryThreadId!, session!.user.id, reply.trim()),
    onSuccess: () => {
      toast.success("Reply sent successfully.");
      setConfirmReply(false);
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to send this reply. Please try again.")),
  });

  const setStatus = useMutation({
    mutationFn: (status: SupportThreadStatus) => supportService.setStatus(primaryThreadId!, status),
    onSuccess: (thread) => {
      toast.success(`Conversation status updated to ${thread.Status}.`);
      setPendingStatus(null);
      void queryClient.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to update status. Please try again.")),
  });

  const currentStatus = selectedConversation?.status;

  return (
    <>
      <PageHeader
        title="Support"
        description="One inbox row per app user. Older duplicate threads are merged in the timeline."
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Support" }]}
      />

      <AsyncPageContent
        isLoading={threads.isLoading}
        isError={threads.isError}
        onRetry={() => void threads.refetch()}
        loadingLabel="Loading support conversations"
      >
        {conversations.length === 0 ? (
          <EmptyState title="No support conversations" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <AnimatedStagger className="space-y-2">
              {conversations.map((conversation) => (
                <button
                  key={conversation.userId}
                  type="button"
                  onClick={() => setActiveUserId(conversation.userId)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    conversation.userId === selectedUserId
                      ? "border-primary bg-surface"
                      : "border-border bg-surface hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{userLabel(conversation.userId)}</span>
                    <ThreadStatusBadge status={conversation.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {userEmail(conversation.userId) || "App user"} · {formatDateTime(conversation.lastMessageAt)}
                  </p>
                  {conversation.threads.length > 1 && (
                    <p className="mt-1.5">
                      <Pill tone="neutral">{conversation.threads.length} threads merged</Pill>
                    </p>
                  )}
                </button>
              ))}
            </AnimatedStagger>

            <section className="rounded-lg border border-border bg-surface p-4 shadow-none">
              <AsyncPageContent
                isLoading={detailLoading}
                isError={detailError}
                onRetry={() => {
                  for (const query of threadDetails) {
                    void query.refetch();
                  }
                }}
                loadingLabel="Loading conversation"
                shellClassName="border-0 bg-transparent"
              >
                {() =>
                  selectedConversation && (
                    <AnimatedContent>
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                        <div className="min-w-0">
                          <h2 className="text-sm font-semibold">{userLabel(selectedConversation.userId)}</h2>
                          {userEmail(selectedConversation.userId) && (
                            <p className="text-xs text-muted-foreground">{userEmail(selectedConversation.userId)}</p>
                          )}
                          {selectedConversation.threads.length > 1 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Showing messages from {selectedConversation.threads.length} threads. New replies go to
                              the latest active thread.
                            </p>
                          )}
                        </div>
                        {permissions.canReplySupport && currentStatus && (
                          <div className="flex items-center gap-2">
                            <Label htmlFor="thread-status" className="sr-only">
                              Conversation status
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
                      <div className="mt-4 max-h-[min(52vh,520px)] space-y-3 overflow-y-auto pr-1">
                        {mergedMessages.map((m) => {
                          const isAppUser = m.AuthorUserId === selectedConversation.userId;
                          const authorName = userLabel(m.AuthorUserId);
                          const authorLabel =
                            isAppUser ? authorName : authorName === "Unknown user" ? "Support" : authorName;
                          return (
                            <div
                              key={`${m.ThreadId}-${m.id}`}
                              className={`rounded-md border p-3 ${
                                isAppUser
                                  ? "border-border/70 bg-background"
                                  : "border-primary/20 bg-primary/5"
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span>{authorLabel}</span>
                                <span className="font-mono">{formatDateTime(m.SentAt)}</span>
                              </div>
                              <p className="mt-2 text-sm whitespace-pre-wrap">{m.Body}</p>
                            </div>
                          );
                        })}
                      </div>
                      {permissions.canReplySupport && (
                        <div className="mt-4 space-y-2 border-t border-border pt-4">
                          <Textarea
                            rows={3}
                            className="bg-background"
                            placeholder="Write a reply…"
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            maxLength={1000}
                          />
                          <div className="flex justify-end">
                            <Button
                              disabled={!reply.trim() || send.isPending || !primaryThreadId}
                              onClick={() => setConfirmReply(true)}
                            >
                              {send.isPending ? "Sending…" : "Send reply"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </AnimatedContent>
                  )
                }
              </AsyncPageContent>
            </section>
          </div>
        )}
      </AsyncPageContent>

      <ConfirmationDialog
        open={confirmReply}
        onOpenChange={setConfirmReply}
        title="Send support reply?"
        description={`Your reply will be sent to ${selectedConversation ? userLabel(selectedConversation.userId) : "this user"}.`}
        confirmLabel="Send reply"
        loading={send.isPending}
        onConfirm={() => send.mutate()}
      />

      <ConfirmationDialog
        open={!!pendingStatus}
        onOpenChange={(v) => !v && setPendingStatus(null)}
        title="Change conversation status?"
        description={`Update status to ${pendingStatus ?? ""} on the user's latest thread.`}
        confirmLabel="Update status"
        loading={setStatus.isPending}
        onConfirm={() => pendingStatus && setStatus.mutate(pendingStatus)}
      />
    </>
  );
}
