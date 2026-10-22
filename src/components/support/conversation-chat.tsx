import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { ThreadStatusBadge } from "@/components/app/badges";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { AsyncPageContent } from "@/components/app/page-layout";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supportService } from "@/services";
import { toUserMessage } from "@/services/client";
import { initials } from "@/lib/format";
import { formatShortDateTime } from "@/lib/support-stats";
import { SUPPORT_STATES, type UserConversation } from "@/lib/support-stats";
import { cn } from "@/lib/utils";
import type { AppUser, SupportMessage, SupportThreadStatus } from "@/types/entities";

/** New messages from the app show up without reloading the page. */
const LIVE_REFRESH_MS = 15_000;

function ChatBubble({
  message,
  fromAppUser,
  label,
}: {
  message: SupportMessage;
  fromAppUser: boolean;
  /** Who sent it; shown once for messages in a row from the same sender. */
  label: string | null;
}) {
  return (
    <div className={cn("flex w-full", fromAppUser ? "justify-start" : "justify-end")}>
      <div
        className={cn("flex max-w-[80%] flex-col gap-1", fromAppUser ? "items-start" : "items-end")}
      >
        {label && <span className="px-1 text-xs font-medium text-muted-foreground">{label}</span>}
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            fromAppUser
              ? "rounded-bl-sm border border-border bg-background text-foreground"
              : "rounded-br-sm bg-primary text-primary-foreground",
          )}
        >
          {message.Body}
        </div>
        <span className="px-1 text-[10px] text-muted-foreground">
          {formatShortDateTime(message.SentAt)}
        </span>
      </div>
    </div>
  );
}

/**
 * Support chat as a two-way conversation: the app user's messages on the left,
 * Manufacturer replies on the right, each labelled with who sent it (the
 * Manufacturer's name and AppId, or "You"). Replies and status go to this chat.
 */
export function ConversationChat({
  conversation,
  appUser,
  currentUserId,
  canReply,
  onClose,
}: {
  conversation: UserConversation;
  appUser: AppUser | undefined;
  currentUserId: string | undefined;
  canReply: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [pendingStatus, setPendingStatus] = useState<SupportThreadStatus | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadId = conversation.primaryThreadId;
  const appUserName = appUser ? `${appUser.FirstName} ${appUser.LastName}`.trim() : "App user";
  const title = conversation.threads[0]?.Subject || "Support request";

  const threadDetails = useQueries({
    queries: conversation.threads.map((thread) => ({
      queryKey: ["support", thread.id],
      queryFn: () => supportService.getThread(thread.id),
      refetchInterval: LIVE_REFRESH_MS,
    })),
  });

  const messages = useMemo(() => {
    const all: SupportMessage[] = [];
    for (const query of threadDetails) all.push(...(query.data?.messages ?? []));
    return all.sort((a, b) => new Date(a.SentAt).getTime() - new Date(b.SentAt).getTime());
  }, [threadDetails]);

  // Keep the latest message in view, like a chat.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversation.userId]);

  const send = useMutation({
    mutationFn: (body: string) => supportService.reply(threadId, currentUserId!, body),
    onSuccess: () => {
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to send this reply. Please try again.")),
  });

  const setStatus = useMutation({
    mutationFn: (status: SupportThreadStatus) => supportService.setStatus(threadId, status),
    onSuccess: (thread) => {
      toast.success(`Conversation status updated to ${thread.Status}.`);
      setPendingStatus(null);
      void queryClient.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to update status. Please try again.")),
  });

  /** Older servers do not send SenderType: fall back to who wrote it. */
  const isFromAppUser = (m: SupportMessage) =>
    m.SenderType ? m.SenderType === "User" : m.AuthorUserId === conversation.userId;
  const senderLabel = (m: SupportMessage, fromAppUser: boolean): string => {
    if (m.AuthorUserId === currentUserId) return "You";
    if (fromAppUser) return appUserName;
    const name = m.SenderName?.trim() || "Support";
    return m.SenderAppId ? `${name} · ${m.SenderAppId}` : name;
  };

  const submit = () => {
    const body = reply.trim();
    if (!body || send.isPending || !currentUserId) return;
    send.mutate(body);
  };

  return (
    <section className="flex h-[min(78vh,760px)] min-h-[480px] flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {appUser ? initials(appUser.FirstName, appUser.LastName) : "?"}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{appUserName}</h2>
            <p className="truncate text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canReply ? (
            <>
              <Label htmlFor="thread-status" className="sr-only">
                Conversation status
              </Label>
              <Select
                value={conversation.status}
                onValueChange={(v) => setPendingStatus(v as SupportThreadStatus)}
              >
                <SelectTrigger id="thread-status" className="h-8 w-36 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <ThreadStatusBadge status={conversation.status} />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Close conversation"
            title="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4">
        <AsyncPageContent
          isLoading={threadDetails.some((q) => q.isPending)}
          isError={threadDetails.some((q) => q.isError)}
          onRetry={() => threadDetails.forEach((q) => void q.refetch())}
          loadingLabel="Loading conversation"
          shellClassName="border-0 bg-transparent"
        >
          {() =>
            messages.length === 0 ? (
              <EmptyState title="No messages yet" />
            ) : (
              messages.map((m, index) => {
                const fromAppUser = isFromAppUser(m);
                const sender = senderLabel(m, fromAppUser);
                const previous = index > 0 ? messages[index - 1] : undefined;
                const sameAsPrevious =
                  previous !== undefined &&
                  isFromAppUser(previous) === fromAppUser &&
                  senderLabel(previous, fromAppUser) === sender;
                return (
                  <ChatBubble
                    key={`${m.ThreadId}-${m.id}`}
                    message={m}
                    fromAppUser={fromAppUser}
                    label={sameAsPrevious ? null : sender}
                  />
                );
              })
            )
          }
        </AsyncPageContent>
      </div>

      {canReply && (
        <form
          className="flex items-end gap-2 border-t border-border bg-surface px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Textarea
            rows={1}
            className="max-h-32 min-h-10 resize-none bg-background"
            placeholder="Type a reply (Shift+Enter for a new line)"
            value={reply}
            maxLength={1000}
            aria-label="Reply"
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="size-10 shrink-0"
            aria-label="Send reply"
            disabled={!reply.trim() || send.isPending || !currentUserId}
          >
            <SendHorizontal className="size-4" />
          </Button>
        </form>
      )}

      <ConfirmationDialog
        open={!!pendingStatus}
        onOpenChange={(v) => !v && setPendingStatus(null)}
        title="Change conversation status?"
        description={`Update the status of this chat to ${pendingStatus ?? ""}.`}
        confirmLabel="Update status"
        loading={setStatus.isPending}
        onConfirm={() => pendingStatus && setStatus.mutate(pendingStatus)}
      />
    </section>
  );
}
