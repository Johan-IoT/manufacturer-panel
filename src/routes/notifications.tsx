import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Send, Settings } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DeliveryStatusBadge, Pill, ReadStateBadge } from "@/components/app/badges";
import { DataTable, type Column } from "@/components/app/data-table";
import { FormModal, ConfirmationDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import {
  EMPTY_NOTIFICATION_MESSAGE,
  NotificationMessageFields,
  isNotificationMessageValid,
  notificationPayload,
  type NotificationMessage,
} from "@/components/notifications/notification-message-fields";
import { NotificationSettingsDialog } from "@/components/notifications/notification-settings-dialog";
import { RecipientPicker, type RecipientResult } from "@/components/notifications/recipient-picker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { notificationService } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDateTime } from "@/lib/format";
import { notificationStats, PUSH_NOT_DELIVERED_STATUSES } from "@/lib/notification-stats";
import {
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
  type DeliveryStatus,
  type Notification,
  type NotificationPriority,
  type PushNotificationDelivery,
} from "@/types/entities";

interface NotificationsSearch {
  /** Dashboard quick links: unread = has unread recipients, push = push not delivered. */
  view?: "unread" | "push" | undefined;
}

export const Route = createFileRoute("/notifications")({
  validateSearch: (search: Record<string, unknown>): NotificationsSearch => ({
    view: search["view"] === "unread" || search["view"] === "push" ? search["view"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Notifications | Manufacturer Panel | ConfigGate" },
      {
        name: "description",
        content: "Review sent notifications and broadcast new messages to app users.",
      },
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
  recipient: { FirstName: string; LastName: string; Email: string; CompanyName?: string } | null;
  deliveries: PushNotificationDelivery[];
};

type NotificationCampaign = {
  id: string;
  notification: Notification;
  sends: SentNotificationRow[];
};

/** History "Period" filter, in days. */
const PERIODS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

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
  const view = Route.useSearch().view;
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [detailCampaign, setDetailCampaign] = useState<NotificationCampaign | null>(null);
  const [message, setMessage] = useState<NotificationMessage>(EMPTY_NOTIFICATION_MESSAGE);
  const [recipients, setRecipients] = useState<RecipientResult>({
    recipientIds: [],
    deviceSerialNumber: null,
    summary: "No recipients selected",
  });
  /** Remounts the recipient picker to clear it after a send. */
  const [pickerKey, setPickerKey] = useState(0);

  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await notificationService.list()) as SentNotificationRow[],
  });
  const campaigns = useMemo(() => groupSentNotifications(list.data ?? []), [list.data]);

  const stats = useMemo(() => {
    const rows = list.data ?? [];
    // Same helper as the dashboard, so both always show the same numbers.
    const counts = notificationStats(rows);
    return {
      broadcasts: campaigns.length,
      recipients: rows.length,
      unread: counts.unread,
      deliveryIssues: counts.notDelivered,
    };
  }, [campaigns.length, list.data]);

  // A notification about a device opens that device in the app, unless an action was chosen.
  const chooseRecipients = (next: RecipientResult) => {
    setRecipients(next);
    const serial = next.deviceSerialNumber;
    if (serial) {
      setMessage((m) =>
        m.actionType === "None" || m.actionType === "OpenDevice"
          ? { ...m, actionType: "OpenDevice", actionValue: serial }
          : m,
      );
    }
  };

  const canSend = isNotificationMessageValid(message) && recipients.recipientIds.length > 0;

  const resetForm = () => {
    setMessage(EMPTY_NOTIFICATION_MESSAGE);
    setPickerKey((k) => k + 1);
  };

  const send = useMutation({
    mutationFn: () =>
      notificationService.send({
        recipientUserIds: recipients.recipientIds,
        ...notificationPayload(message),
        deviceSerialNumber: recipients.deviceSerialNumber,
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
      key: "device",
      header: "Device",
      render: (c) =>
        c.notification.DeviceSerialNumber ? (
          <span className="font-mono text-xs">{c.notification.DeviceSerialNumber}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
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
        return <span className="text-xs text-muted-foreground">-</span>;
      },
    },
    {
      key: "sent",
      header: "Sent",
      sortValue: (c) => c.notification.CreatedAt,
      className: "whitespace-nowrap text-muted-foreground text-xs",
      render: (c) => (
        <div>
          <p>{formatDateTime(c.notification.CreatedAt)}</p>
          {c.notification.SentBy && <p>by {c.notification.SentBy}</p>}
        </div>
      ),
    },
  ];

  const senders = [
    ...new Set(campaigns.map((c) => c.notification.SentBy).filter((n): n is string => !!n)),
  ].sort();
  const companies = [
    ...new Set(
      (list.data ?? [])
        .map((r) => r.recipient?.CompanyName?.trim())
        .filter((n): n is string => !!n),
    ),
  ].sort();

  return (
    <>
      <PageHeader
        title="Notifications"
        breadcrumbs={[{ label: "Manufacturer Panel", to: "/" }, { label: "Notifications" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings className="mr-2 size-4" />
              Settings
            </Button>
            <Button onClick={() => setOpen(true)} variant="success">
              <Send className="mr-2 size-4" />
              New notification
            </Button>
          </div>
        }
      />

      {!list.isLoading && !list.isError && (list.data?.length ?? 0) > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Messages sent" value={String(stats.broadcasts)} />
          <StatCard label="Recipient deliveries" value={String(stats.recipients)} />
          <StatCard
            label="Unread in app"
            value={String(stats.unread)}
            highlight={stats.unread > 0}
          />
          <StatCard
            label="Push pending or failed"
            value={String(stats.deliveryIssues)}
            highlight={stats.deliveryIssues > 0}
          />
        </div>
      )}

      <DataTable
        key={view ?? "all"}
        initialFilterValues={
          view === "unread"
            ? { read: "unread" }
            : view === "push"
              ? { push: "not_delivered" }
              : undefined
        }
        data={campaigns}
        columns={columns}
        rowKey={(c) => c.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        searchPlaceholder="Search title, message, device or recipient"
        searchFields={[
          (c) => c.notification.Title,
          (c) => c.notification.Body,
          (c) => c.notification.DeviceSerialNumber ?? "",
          (c) =>
            c.sends
              .map(
                (s) =>
                  `${s.recipient?.FirstName ?? ""} ${s.recipient?.LastName ?? ""} ${s.recipient?.Email ?? ""}`,
              )
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
            key: "period",
            label: "Period",
            options: PERIODS,
            predicate: (c, v) =>
              Date.now() - new Date(c.notification.CreatedAt).getTime() <=
              Number(v) * 24 * 60 * 60 * 1000,
          },
          {
            key: "sender",
            label: "Sent by",
            options: senders.map((n) => ({ value: n, label: n })),
            predicate: (c, v) => c.notification.SentBy === v,
          },
          {
            key: "company",
            label: "Company",
            options: companies.map((n) => ({ value: n, label: n })),
            predicate: (c, v) => c.sends.some((s) => s.recipient?.CompanyName?.trim() === v),
          },
          {
            key: "device",
            label: "Device",
            options: [
              { value: "yes", label: "About a device" },
              { value: "no", label: "General" },
            ],
            predicate: (c, v) =>
              v === "yes"
                ? !!c.notification.DeviceSerialNumber
                : !c.notification.DeviceSerialNumber,
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
          {
            key: "push",
            label: "Push delivery",
            options: [{ value: "not_delivered", label: "Pending or failed" }],
            predicate: (c) =>
              c.sends.some((s) =>
                s.deliveries.some((d) => PUSH_NOT_DELIVERED_STATUSES.includes(d.DeliveryStatus)),
              ),
          },
        ]}
        onRowClick={(c) => setDetailCampaign(c)}
        emptyTitle="No notifications yet"
      />

      <CampaignDetailSheet
        campaign={detailCampaign}
        onOpenChange={(open) => !open && setDetailCampaign(null)}
      />

      <FormModal open={open} onOpenChange={setOpen} title="Send notification" wide>
        <div className="space-y-5">
          <RecipientPicker key={pickerKey} onChange={chooseRecipients} />
          <div className="border-t border-border pt-4">
            <NotificationMessageFields value={message} onChange={setMessage} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={send.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => setConfirmSend(true)}
            disabled={!canSend || send.isPending}
            variant="success"
          >
            {send.isPending ? "Sending..." : "Send notification"}
          </Button>
        </div>
      </FormModal>

      <NotificationSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <ConfirmationDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Send notification?"
        description={`This will send "${message.title.trim()}" (${message.notificationType}, ${message.priority}) to ${recipients.summary}${recipients.deviceSerialNumber ? `, about ${recipients.deviceSerialNumber}` : ""}. This action cannot be undone.`}
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
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-border bg-surface shadow-none sm:max-w-xl"
      >
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
                  {action && <p className="text-xs text-muted-foreground">Tap action: {action}</p>}
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
                          <p className="truncate text-xs text-muted-foreground">
                            {row.recipient.Email}
                          </p>
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
                      <p className="mt-2 text-xs text-muted-foreground">
                        No registered push devices
                      </p>
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
      <span className="truncate text-[11px] text-muted-foreground">
        {delivery.InstallationLabel}
      </span>
      <DeliveryStatusBadge status={delivery.DeliveryStatus as DeliveryStatus} />
    </div>
  );
}
