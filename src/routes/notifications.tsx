import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Bell, Send } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DeliveryStatusBadge, Pill, ReadStateBadge } from "@/components/app/badges";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormModal, ConfirmationDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { notificationService, userService } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDateTime } from "@/lib/format";
import {
  NOTIFICATION_ACTION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
  type DeliveryStatus,
  type Notification,
  type NotificationActionType,
  type NotificationPriority,
  type NotificationType,
  type PushNotificationDelivery,
} from "@/types/entities";

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

type SentNotificationRow = {
  userNotification: {
    id: string;
    NotificationId: string;
    RecipientUserId: string;
    IsRead: boolean;
    ReadAt: string | null;
  };
  notification: Notification;
  recipient: { FirstName: string; LastName: string; Email: string } | null;
  deliveries: PushNotificationDelivery[];
};

type NotificationCampaign = {
  id: string;
  notification: Notification;
  sends: SentNotificationRow[];
};

const schema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(120),
    body: z.string().trim().min(1, "Message is required.").max(1000),
    recipientUserIds: z.array(z.string()).min(1, "Select at least one recipient."),
    notificationType: z.enum(NOTIFICATION_TYPES as [NotificationType, ...NotificationType[]]),
    priority: z.enum(NOTIFICATION_PRIORITIES as [NotificationPriority, ...NotificationPriority[]]),
    actionType: z.enum(NOTIFICATION_ACTION_TYPES as [NotificationActionType, ...NotificationActionType[]]),
    actionValue: z.string().trim().max(500),
  })
  .superRefine((value, ctx) => {
    const needsValue =
      value.actionType !== "None" && value.actionType !== "OpenMessages";
    if (needsValue && !value.actionValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actionValue"],
        message: "Action value is required for the selected action.",
      });
    }
  });

function actionValueHint(actionType: NotificationActionType): string {
  switch (actionType) {
    case "OpenDevice":
    case "OpenConfiguration":
      return "Enter device serial number.";
    case "OpenSupportThread":
      return "Enter support thread id.";
    case "OpenMessages":
      return "Optional. Leave blank or enter a message context.";
    case "OpenUrl":
      return "Enter full URL, for example https://example.com";
    default:
      return "Not required when action is None.";
  }
}

function formatAction(notification: Notification): string | null {
  if (notification.ActionType === "None") return null;
  if (notification.ActionValue) {
    return `${notification.ActionType}: ${notification.ActionValue}`;
  }
  return notification.ActionType;
}

function groupSentNotifications(rows: SentNotificationRow[]): NotificationCampaign[] {
  const map = new Map<string, NotificationCampaign>();
  for (const row of rows) {
    const id = row.notification.id;
    const existing = map.get(id);
    if (existing) {
      existing.sends.push(row);
    } else {
      map.set(id, { id, notification: row.notification, sends: [row] });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      new Date(b.notification.CreatedAt).getTime() - new Date(a.notification.CreatedAt).getTime(),
  );
}

function deliverySummary(sends: SentNotificationRow[]): {
  failed: number;
  queued: number;
  inProgress: number;
  sent: number;
  delivered: number;
  expired: number;
  total: number;
} {
  let failed = 0;
  let queued = 0;
  let inProgress = 0;
  let sent = 0;
  let delivered = 0;
  let expired = 0;
  let total = 0;
  for (const row of sends) {
    for (const d of row.deliveries) {
      total += 1;
      switch (d.DeliveryStatus) {
        case "Failed":
        case "Invalid Token":
          failed += 1;
          break;
        case "Queued":
          queued += 1;
          break;
        case "Sending":
          inProgress += 1;
          break;
        case "Sent":
          sent += 1;
          break;
        case "Delivered":
          delivered += 1;
          break;
        case "Expired":
          expired += 1;
          break;
        default:
          break;
      }
    }
  }
  return { failed, queued, inProgress, sent, delivered, expired, total };
}

function priorityTone(priority: NotificationPriority): "neutral" | "info" | "warning" | "danger" {
  switch (priority) {
    case "Critical":
      return "danger";
    case "High":
      return "warning";
    case "Normal":
      return "info";
    default:
      return "neutral";
  }
}

function NotificationsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [detailCampaign, setDetailCampaign] = useState<NotificationCampaign | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [notificationType, setNotificationType] = useState<NotificationType>("General");
  const [priority, setPriority] = useState<NotificationPriority>("Normal");
  const [actionType, setActionType] = useState<NotificationActionType>("None");
  const [actionValue, setActionValue] = useState("");

  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await notificationService.list()) as SentNotificationRow[],
  });
  const users = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const activeUsers = useMemo(
    () => (users.data ?? []).filter((user) => user.AccountStatus === "Active"),
    [users.data],
  );
  const filteredRecipients = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return activeUsers;
    return activeUsers.filter(
      (u) =>
        u.FirstName.toLowerCase().includes(q) ||
        u.LastName.toLowerCase().includes(q) ||
        u.Email.toLowerCase().includes(q),
    );
  }, [activeUsers, recipientSearch]);

  const campaigns = useMemo(
    () => groupSentNotifications(list.data ?? []),
    [list.data],
  );

  const stats = useMemo(() => {
    const rows = list.data ?? [];
    const unread = rows.filter((r) => !r.userNotification.IsRead).length;
    const deliveries = deliverySummary(rows);
    return {
      broadcasts: campaigns.length,
      recipients: rows.length,
      unread,
      deliveryIssues:
        deliveries.failed + deliveries.queued + deliveries.inProgress + deliveries.expired,
    };
  }, [campaigns.length, list.data]);

  const parsed = schema.safeParse({
    title,
    body,
    recipientUserIds: selectedRecipientIds,
    notificationType,
    priority,
    actionType,
    actionValue,
  });

  const resetForm = () => {
    setTitle("");
    setBody("");
    setSelectedRecipientIds([]);
    setRecipientSearch("");
    setNotificationType("General");
    setPriority("Normal");
    setActionType("None");
    setActionValue("");
  };

  const toggleRecipient = (userId: string) => {
    setSelectedRecipientIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const send = useMutation({
    mutationFn: () =>
      notificationService.send({
        recipientUserIds: selectedRecipientIds,
        title: title.trim(),
        body: body.trim(),
        notificationType,
        priority,
        actionType,
        actionValue: actionType === "None" ? null : actionValue.trim(),
      }),
    onSuccess: () => {
      toast.success("Notification sent successfully.");
      setConfirmSend(false);
      setOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => {
      setConfirmSend(false);
      toast.error(toUserMessage(e, "Unable to send this notification. Please try again."));
    },
  });

  const recipientSummary = useMemo(() => {
    if (selectedRecipientIds.length === 0) return "No recipients selected";
    if (selectedRecipientIds.length === 1) {
      const user = activeUsers.find((entry) => entry.id === selectedRecipientIds[0]);
      return user ? `${user.FirstName} ${user.LastName}` : "1 recipient";
    }
    return `${selectedRecipientIds.length} recipients`;
  }, [activeUsers, selectedRecipientIds]);

  const columns: Column<NotificationCampaign>[] = [
    {
      key: "message",
      header: "Message",
      sortValue: (c) => c.notification.CreatedAt,
      render: (c) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate font-medium text-foreground">{c.notification.Title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.notification.Body}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortValue: (c) => c.notification.NotificationType,
      render: (c) => <Pill tone="info">{c.notification.NotificationType}</Pill>,
    },
    {
      key: "priority",
      header: "Priority",
      sortValue: (c) => c.notification.Priority,
      render: (c) => (
        <Pill tone={priorityTone(c.notification.Priority)}>{c.notification.Priority}</Pill>
      ),
    },
    {
      key: "recipients",
      header: "Recipients",
      sortValue: (c) => c.sends.length,
      render: (c) => {
        const read = c.sends.filter((s) => s.userNotification.IsRead).length;
        return (
          <div className="text-sm tabular-nums">
            <span className="font-medium">{c.sends.length}</span>
            <span className="text-muted-foreground"> · {read} read</span>
          </div>
        );
      },
    },
    {
      key: "push",
      header: "Push delivery",
      render: (c) => {
        const summary = deliverySummary(c.sends);
        if (summary.total === 0) {
          return <span className="text-xs text-muted-foreground">No devices</span>;
        }
        if (summary.failed > 0) {
          return <Pill tone="danger">{summary.failed} failed</Pill>;
        }
        if (summary.expired > 0) {
          return <Pill tone="warning">{summary.expired} expired</Pill>;
        }
        if (summary.queued > 0 || summary.inProgress > 0) {
          const pending = summary.queued + summary.inProgress;
          return <Pill tone="neutral">{pending} pending</Pill>;
        }
        if (summary.delivered > 0 && summary.sent === 0) {
          return <Pill tone="success">{summary.delivered} delivered</Pill>;
        }
        if (summary.sent > 0) {
          return <Pill tone="info">{summary.sent} sent</Pill>;
        }
        if (summary.delivered > 0) {
          return <Pill tone="success">{summary.delivered} delivered</Pill>;
        }
        return <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      key: "sent",
      header: "Sent",
      sortValue: (c) => c.notification.CreatedAt,
      className: "whitespace-nowrap text-muted-foreground text-xs",
      render: (c) => formatDateTime(c.notification.CreatedAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Send push and in-app alerts to mobile users. Each row is one message, grouped by send."
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Notifications" }]}
        actions={
          <Button onClick={() => setOpen(true)} variant="success">
            <Send className="mr-2 size-4" />
            New notification
          </Button>
        }
      />

      {!list.isLoading && !list.isError && (list.data?.length ?? 0) > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Messages sent" value={String(stats.broadcasts)} />
          <StatCard label="Recipient deliveries" value={String(stats.recipients)} />
          <StatCard label="Unread in app" value={String(stats.unread)} highlight={stats.unread > 0} />
          <StatCard
            label="Push pending or failed"
            value={String(stats.deliveryIssues)}
            highlight={stats.deliveryIssues > 0}
          />
        </div>
      )}

      <DataTable
        data={campaigns}
        columns={columns}
        rowKey={(c) => c.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        searchPlaceholder="Search title, message, or recipient"
        searchFields={[
          (c) => c.notification.Title,
          (c) => c.notification.Body,
          (c) =>
            c.sends
              .map((s) => `${s.recipient?.FirstName ?? ""} ${s.recipient?.LastName ?? ""} ${s.recipient?.Email ?? ""}`)
              .join(" "),
        ]}
        filters={[
          {
            key: "type",
            label: "Type",
            options: NOTIFICATION_TYPES.map((t) => ({ value: t, label: t })),
            predicate: (c, v) => c.notification.NotificationType === v,
          },
          {
            key: "priority",
            label: "Priority",
            options: NOTIFICATION_PRIORITIES.map((p) => ({ value: p, label: p })),
            predicate: (c, v) => c.notification.Priority === v,
          },
          {
            key: "read",
            label: "Read status",
            options: [
              { value: "unread", label: "Has unread" },
              { value: "all_read", label: "All read" },
            ],
            predicate: (c, v) => {
              const anyUnread = c.sends.some((s) => !s.userNotification.IsRead);
              return v === "unread" ? anyUnread : !anyUnread;
            },
          },
        ]}
        onRowClick={(c) => setDetailCampaign(c)}
        emptyTitle="No notifications yet"
        emptyDescription="Send your first notification to app users with the New notification button."
      />

      <CampaignDetailSheet
        campaign={detailCampaign}
        onOpenChange={(open) => !open && setDetailCampaign(null)}
      />

      <FormModal open={open} onOpenChange={setOpen} title="Send notification">
        <div className="space-y-1.5">
          <Label htmlFor="n-title">Title</Label>
          <Input
            id="n-title"
            className="bg-background"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Short headline shown on the device"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="n-body">Message</Label>
          <Textarea
            id="n-body"
            className="bg-background"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            placeholder="Full message body"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="n-type">Notification type</Label>
            <Select value={notificationType} onValueChange={(value) => setNotificationType(value as NotificationType)}>
              <SelectTrigger id="n-type" className="bg-background">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-priority">Priority</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as NotificationPriority)}>
              <SelectTrigger id="n-priority" className="bg-background">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_PRIORITIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="n-action-type">Action type</Label>
          <Select
            value={actionType}
            onValueChange={(value) => {
              const next = value as NotificationActionType;
              setActionType(next);
              if (next === "None") setActionValue("");
            }}
          >
            <SelectTrigger id="n-action-type" className="bg-background">
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_ACTION_TYPES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {actionType !== "None" && actionType !== "OpenMessages" && (
          <div className="space-y-1.5">
            <Label htmlFor="n-action-value">Action value</Label>
            <Input
              id="n-action-value"
              className="bg-background"
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              maxLength={500}
              placeholder={actionValueHint(actionType)}
            />
          </div>
        )}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Recipients</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecipientIds(activeUsers.map((u) => u.id))}
                disabled={activeUsers.length === 0}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecipientIds([])}
                disabled={selectedRecipientIds.length === 0}
              >
                Clear
              </Button>
            </div>
          </div>
          <Input
            className="bg-background"
            placeholder="Filter by name or email"
            value={recipientSearch}
            onChange={(e) => setRecipientSearch(e.target.value)}
          />
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3">
            {filteredRecipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching active users.</p>
            ) : (
              filteredRecipients.map((user) => (
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
        description={`This will send "${title.trim()}" (${notificationType}, ${priority}) to ${recipientSummary}. This action cannot be undone.`}
        confirmLabel="Send notification"
        loading={send.isPending}
        onConfirm={() => send.mutate()}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 shadow-none">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={
          highlight
            ? "mt-1 text-2xl font-semibold tabular-nums text-[var(--tone-warning-fg)]"
            : "mt-1 text-2xl font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

function CampaignDetailSheet({
  campaign,
  onOpenChange,
}: {
  campaign: NotificationCampaign | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = campaign != null;
  const action = campaign ? formatAction(campaign.notification) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col border-l border-border bg-surface shadow-none sm:max-w-xl">
        {campaign && (
          <>
            <SheetHeader className="border-b border-border pb-4 text-left">
              <SheetTitle className="flex items-start gap-2 pr-8">
                <Bell className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <span>{campaign.notification.Title}</span>
              </SheetTitle>
              <SheetDescription asChild>
                <div className="space-y-2 pt-1">
                  <p className="text-sm text-foreground">{campaign.notification.Body}</p>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="info">{campaign.notification.NotificationType}</Pill>
                    <Pill tone={priorityTone(campaign.notification.Priority)}>
                      {campaign.notification.Priority}
                    </Pill>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sent {formatDateTime(campaign.notification.CreatedAt)}
                  </p>
                  {action && (
                    <p className="text-xs text-muted-foreground">
                      Tap action: {action}
                    </p>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Recipients ({campaign.sends.length})
              </h3>
              <div className="space-y-2">
                {campaign.sends.map((row) => (
                  <div
                    key={row.userNotification.id}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {row.recipient
                            ? `${row.recipient.FirstName} ${row.recipient.LastName}`.trim()
                            : "Unknown user"}
                        </p>
                        {row.recipient?.Email && (
                          <p className="truncate text-xs text-muted-foreground">{row.recipient.Email}</p>
                        )}
                      </div>
                      <ReadStateBadge isRead={row.userNotification.IsRead} />
                    </div>
                    {row.userNotification.ReadAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Read {formatDateTime(row.userNotification.ReadAt)}
                      </p>
                    )}
                    {row.deliveries.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.deliveries.map((d) => (
                          <DeliveryChip key={d.id} delivery={d} />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No registered push devices</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DeliveryChip({ delivery }: { delivery: PushNotificationDelivery }) {
  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/80 bg-muted/40 px-2 py-1">
      <span className="truncate text-[11px] text-muted-foreground">{delivery.InstallationLabel}</span>
      <DeliveryStatusBadge status={delivery.DeliveryStatus as DeliveryStatus} />
    </div>
  );
}
