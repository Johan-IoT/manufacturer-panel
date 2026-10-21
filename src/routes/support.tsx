import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { ConversationChat } from "@/components/support/conversation-chat";
import { SupportOptInSwitch } from "@/components/support/support-opt-in";
import { supportService, userService } from "@/services";
import { useAuth, usePermissions } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { SupportThreadStatus } from "@/types/entities";
import {
  groupThreadsByUser,
  isSupportState,
  formatShortDateTime,
  SUPPORT_STATES,
  type UserConversation,
} from "@/lib/support-stats";

interface SupportSearch {
  status?: SupportThreadStatus | undefined;
}

export const Route = createFileRoute("/support")({
  // Dashboard quick links open Support filtered by state (?status=Open).
  validateSearch: (search: Record<string, unknown>): SupportSearch => ({
    status: isSupportState(search["status"]) ? search["status"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Support | Manufacturer Panel | ConfigGate" },
      { name: "description", content: "Read support threads from app users and reply manually." },
      { property: "og:title", content: "Support | Manufacturer Panel" },
      {
        property: "og:description",
        content: "Manual support inbox for the ConfigGate BLE ecosystem.",
      },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { session } = useAuth();
  const permissions = usePermissions();
  const statusFilter = Route.useSearch().status;
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  /** The chat panel can be closed; clicking a conversation opens it again. */
  const [panelClosed, setPanelClosed] = useState(false);

  const threads = useQuery({
    queryKey: ["support"],
    queryFn: () => supportService.listThreads(),
    // New conversations and messages from the app appear without a reload.
    refetchInterval: 15_000,
  });
  const users = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });

  const conversations = useMemo(() => groupThreadsByUser(threads.data ?? []), [threads.data]);

  const selected = panelClosed
    ? null
    : (conversations.find((c) => c.userId === activeUserId) ??
      conversations.find((c) => !statusFilter || c.status === statusFilter) ??
      null);

  const userOf = (id: string) => users.data?.find((u) => u.id === id);
  const me = session ? userOf(session.user.id) : undefined;
  const userName = (id: string) => {
    const u = userOf(id);
    return u ? `${u.FirstName} ${u.LastName}`.trim() : null;
  };

  const columns: Column<UserConversation>[] = [
    {
      key: "at",
      header: "Date / Time",
      sortValue: (c) => new Date(c.lastMessageAt).getTime(),
      render: (c) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatShortDateTime(c.lastMessageAt)}
        </span>
      ),
    },
    {
      key: "title",
      header: "Title",
      sortValue: (c) => (c.threads[0]?.Subject ?? "").toLowerCase(),
      render: (c) => (
        <span className="line-clamp-2 text-sm text-foreground">
          {c.threads[0]?.Subject || "Support request"}
        </span>
      ),
    },
    {
      key: "user",
      header: "App User",
      sortValue: (c) => (userName(c.userId) ?? "").toLowerCase(),
      render: (c) => (
        <span className="text-sm text-foreground">{userName(c.userId) ?? "Unknown user"}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Support"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Support" }]}
        actions={
          me?.IsManufacturer ? (
            <SupportOptInSwitch user={me} label="Notify me of new messages" compact />
          ) : undefined
        }
      />

      <div
        className={cn(
          "grid items-start gap-4",
          selected && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        )}
      >
        <DataTable
          key={statusFilter ?? "all"}
          data={conversations}
          columns={columns}
          rowKey={(c) => c.userId}
          isLoading={threads.isLoading}
          isError={threads.isError}
          onRetry={() => void threads.refetch()}
          searchPlaceholder="Search by title or user"
          searchFields={[
            (c) => c.threads.map((t) => t.Subject).join(" "),
            (c) => userName(c.userId) ?? "",
            (c) => userOf(c.userId)?.Email ?? "",
          ]}
          filters={[
            {
              key: "status",
              label: "Status",
              options: SUPPORT_STATES.map((s) => ({ value: s, label: s })),
              predicate: (c, v) => c.status === (v as SupportThreadStatus),
            },
          ]}
          initialFilterValues={statusFilter ? { status: statusFilter } : undefined}
          onRowClick={(c) => {
            setActiveUserId(c.userId);
            setPanelClosed(false);
          }}
          isRowSelected={(c) => c.userId === selected?.userId}
          emptyTitle="No support conversations"
        />

        {selected ? (
          <ConversationChat
            key={selected.userId}
            conversation={selected}
            appUser={userOf(selected.userId)}
            currentUserId={session?.user.id}
            canReply={permissions.canReplySupport}
            onClose={() => setPanelClosed(true)}
          />
        ) : null}
      </div>
    </>
  );
}
