/**
 * Notification counts for the dashboard. Same rules as the Notifications
 * screen cards "Unread in app" and "Push pending or failed".
 */
export type NotificationRowLike = {
  userNotification: { IsRead: boolean };
  deliveries: Array<{ DeliveryStatus: string }>;
};

/** Push delivery not completed: still waiting, failed or expired. */
export const PUSH_NOT_DELIVERED_STATUSES = [
  "Queued",
  "Sending",
  "Failed",
  "Invalid Token",
  "Expired",
];

export function notificationStats(rows: NotificationRowLike[]): {
  unread: number;
  notDelivered: number;
} {
  let unread = 0;
  let notDelivered = 0;
  for (const row of rows) {
    if (!row.userNotification.IsRead) unread += 1;
    for (const d of row.deliveries) {
      if (PUSH_NOT_DELIVERED_STATUSES.includes(d.DeliveryStatus)) notDelivered += 1;
    }
  }
  return { unread, notDelivered };
}
