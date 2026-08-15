import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Pill } from "@/components/app/badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supportService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Manufacturer Panel | GSM Systems" },
      { name: "description", content: "Read support threads from app users and reply manually." },
      { property: "og:title", content: "Support — Manufacturer Panel" },
      { property: "og:description", content: "Manual support inbox for the GSM Systems BLE ecosystem." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

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
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["support", selectedId] });
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to send this reply. Please try again.")),
  });

  return (
    <AppShell>
      <PageHeader
        title="Support"
        description="Threads raised from the mobile app. Replies are written manually by the manufacturer team."
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Support" }]}
      />

      {threads.isLoading ? (
        <LoadingState label="Loading support threads" />
      ) : threads.isError ? (
        <ErrorState onRetry={() => void threads.refetch()} />
      ) : (threads.data ?? []).length === 0 ? (
        <EmptyState title="No support threads" description="Support requests from app users will appear here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {(threads.data ?? []).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  t.id === selectedId ? "border-primary/60 bg-surface" : "border-border bg-surface/60 hover:bg-surface"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{t.Subject}</span>
                  <Pill tone={t.Status === "Open" ? "warning" : t.Status === "Resolved" ? "success" : "neutral"}>{t.Status}</Pill>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {userName(t.OpenedByUserId)} · {formatDateTime(t.LastMessageAt)}
                </p>
              </button>
            ))}
          </div>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-panel">
            {detail.isLoading || !detail.data ? (
              <LoadingState label="Loading thread" />
            ) : (
              <>
                <h2 className="text-sm font-semibold">{detail.data.thread.Subject}</h2>
                <div className="mt-4 space-y-3">
                  {detail.data.messages.map((m) => (
                    <div key={m.id} className="rounded-md border border-border/70 bg-background p-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{userName(m.AuthorUserId)}</span>
                        <span className="font-mono">{formatDateTime(m.SentAt)}</span>
                      </div>
                      <p className="mt-2 text-sm">{m.Body}</p>
                    </div>
                  ))}
                </div>
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
                    <Button disabled={!reply.trim() || send.isPending} onClick={() => send.mutate()}>
                      {send.isPending ? "Sending…" : "Send reply"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
