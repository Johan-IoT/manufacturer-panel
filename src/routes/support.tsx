import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { ThreadStatusBadge } from "@/components/app/badges";
import { FormModal } from "@/components/app/dialogs";
import { ConversationChat } from "@/components/support/conversation-chat";
import { SupportOptInSwitch } from "@/components/support/support-opt-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { relationshipService, supportService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { useAuth, usePermissions } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { AppUser, SupportThreadStatus } from "@/types/entities";
import {
  threadConversations,
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

const NO_DEVICE = "__none__";

function fullName(u: AppUser): string {
  return `${u.FirstName} ${u.LastName}`.trim() || u.Email;
}

function SupportPage() {
  const { session } = useAuth();
  const permissions = usePermissions();
  const statusFilter = Route.useSearch().status;
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  /** The chat panel can be closed; clicking a chat opens it again. */
  const [panelClosed, setPanelClosed] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const threads = useQuery({
    queryKey: ["support"],
    queryFn: () => supportService.listThreads(),
    // New chats and messages from the app appear without a reload.
    refetchInterval: 15_000,
  });
  const users = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });

  // Johan (22 Oct): every chat (header) is its own row, same as the app.
  const conversations = useMemo(() => threadConversations(threads.data ?? []), [threads.data]);

  const selected = panelClosed
    ? null
    : (conversations.find((c) => c.primaryThreadId === activeThreadId) ??
      conversations.find((c) => !statusFilter || c.status === statusFilter) ??
      null);

  const userOf = (id: string) => users.data?.find((u) => u.id === id);
  const me = session ? userOf(session.user.id) : undefined;
  const userName = (c: UserConversation) => {
    const u = userOf(c.userId);
    return u ? fullName(u) : c.threads[0]?.OpenedByName || null;
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
        <div className="min-w-0 max-w-xs">
          <p className="truncate text-sm text-foreground">
            {c.threads[0]?.Subject || "Support request"}
          </p>
          {c.threads[0]?.LastMessage && (
            <p className="truncate text-xs text-muted-foreground">{c.threads[0].LastMessage}</p>
          )}
        </div>
      ),
    },
    {
      key: "user",
      header: "App User",
      sortValue: (c) => (userName(c) ?? "").toLowerCase(),
      render: (c) => (
        <span className="text-sm text-foreground">{userName(c) ?? "Unknown user"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (c) => c.status,
      render: (c) => <ThreadStatusBadge status={c.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Support"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Support" }]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {me?.IsManufacturer ? (
              <SupportOptInSwitch user={me} label="Notify me of new messages" compact />
            ) : null}
            {permissions.canReplySupport && (
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="mr-2 size-4" />
                New message
              </Button>
            )}
          </div>
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
          rowKey={(c) => c.primaryThreadId}
          isLoading={threads.isLoading}
          isError={threads.isError}
          onRetry={() => void threads.refetch()}
          searchPlaceholder="Search by title, message or user"
          searchFields={[
            (c) => c.threads[0]?.Subject ?? "",
            (c) => c.threads[0]?.LastMessage ?? "",
            (c) => userName(c) ?? "",
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
            setActiveThreadId(c.primaryThreadId);
            setPanelClosed(false);
          }}
          isRowSelected={(c) => c.primaryThreadId === selected?.primaryThreadId}
          emptyTitle="No support conversations"
        />

        {selected ? (
          <ConversationChat
            key={selected.primaryThreadId}
            conversation={selected}
            appUser={userOf(selected.userId)}
            currentUserId={session?.user.id}
            canReply={permissions.canReplySupport}
            onClose={() => setPanelClosed(true)}
          />
        ) : null}
      </div>

      <NewSupportChatDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        users={users.data ?? []}
        onCreated={(threadId) => {
          setActiveThreadId(threadId);
          setPanelClosed(false);
        }}
      />
    </>
  );
}

/**
 * Johan (22 Oct): a Manufacturer starts a support chat with an app user. Same
 * fields as in the app: App User, Device (optional), Header and Message.
 */
function NewSupportChatDialog({
  open,
  onOpenChange,
  users,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: AppUser[];
  onCreated: (threadId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [appUserId, setAppUserId] = useState("");
  const [device, setDevice] = useState(NO_DEVICE);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const links = useQuery({
    queryKey: ["links"],
    queryFn: () => relationshipService.list(),
    enabled: open,
  });

  const activeUsers = useMemo(
    () =>
      users
        .filter((u) => u.AccountStatus === "Active")
        .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [users],
  );
  const query = userSearch.trim().toLowerCase();
  const matchingUsers = activeUsers.filter(
    (u) =>
      !query ||
      fullName(u).toLowerCase().includes(query) ||
      u.Email.toLowerCase().includes(query) ||
      (u.AppId ?? "").toLowerCase().includes(query) ||
      u.id === appUserId,
  );
  const userDevices = [
    ...new Set(
      (links.data ?? [])
        .filter((l) => l.Active && l.AppUserId === appUserId)
        .map((l) => l.DeviceSerialNumber),
    ),
  ].sort();

  const reset = () => {
    setUserSearch("");
    setAppUserId("");
    setDevice(NO_DEVICE);
    setSubject("");
    setMessage("");
  };

  const create = useMutation({
    mutationFn: () =>
      supportService.createThread({
        appUserId,
        subject: subject.trim(),
        message: message.trim(),
        deviceSerialNumber: device === NO_DEVICE ? null : device,
      }),
    onSuccess: (result) => {
      toast.success("Support message sent.");
      void queryClient.invalidateQueries({ queryKey: ["support"] });
      onOpenChange(false);
      reset();
      if (result.threadId) onCreated(String(result.threadId));
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to send this message. Please try again.")),
  });

  const canSend = !!appUserId && !!subject.trim() && !!message.trim() && !create.isPending;

  return (
    <FormModal open={open} onOpenChange={onOpenChange} title="New support message">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="support-user">App User</Label>
          <Input
            placeholder="Search by name, email or App ID"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          <Select
            value={appUserId}
            onValueChange={(v) => {
              setAppUserId(v);
              setDevice(NO_DEVICE);
            }}
          >
            <SelectTrigger id="support-user" className="bg-background">
              <SelectValue placeholder="Select the app user" />
            </SelectTrigger>
            <SelectContent>
              {matchingUsers.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No user found</div>
              ) : (
                matchingUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {fullName(u)}
                    {u.AppId ? ` (${u.AppId})` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="support-device">Device (optional)</Label>
          <Select value={device} onValueChange={setDevice} disabled={!appUserId}>
            <SelectTrigger id="support-device" className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DEVICE}>None</SelectItem>
              {userDevices.map((serial) => (
                <SelectItem key={serial} value={serial}>
                  {serial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="support-subject">Header</Label>
          <Input
            id="support-subject"
            placeholder="e.g. Firmware update"
            value={subject}
            maxLength={200}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="support-message">Message</Label>
          <Textarea
            id="support-message"
            rows={4}
            placeholder="Type your message"
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
          Cancel
        </Button>
        <Button onClick={() => create.mutate()} disabled={!canSend}>
          {create.isPending ? "Sending..." : "Send"}
        </Button>
      </div>
    </FormModal>
  );
}
