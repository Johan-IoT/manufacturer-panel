import type { SupportThread, SupportThreadStatus } from "@/types/entities";

/** The 4 support states shown on the dashboard and used by the Support filter. */
export const SUPPORT_STATES: SupportThreadStatus[] = ["Open", "In Progress", "Resolved", "Closed"];

export type UserConversation = {
  userId: string;
  threads: SupportThread[];
  primaryThreadId: string;
  lastMessageAt: string;
  status: SupportThreadStatus;
};

/** Compact date and time for the Support table and chat, e.g. "Oct 20, 12:00 PM". */
export function formatShortDateTime(value: string | null | undefined): string {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A cancelled thread counts as Closed (the panel has 4 states). */
export function supportState(status: string): SupportThreadStatus {
  if (status === "Cancelled") return "Closed";
  return (SUPPORT_STATES as string[]).includes(status) ? (status as SupportThreadStatus) : "Open";
}

export function isSupportState(value: unknown): value is SupportThreadStatus {
  return typeof value === "string" && (SUPPORT_STATES as string[]).includes(value);
}

/** One conversation per app user; its state is the latest thread's state. */
export function groupThreadsByUser(threads: SupportThread[]): UserConversation[] {
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
        status: supportState(primary.Status),
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

/** Conversation count per support state (same grouping as the Support screen). */
export function countSupportStates(threads: SupportThread[]): Record<SupportThreadStatus, number> {
  const counts: Record<SupportThreadStatus, number> = {
    Open: 0,
    "In Progress": 0,
    Resolved: 0,
    Closed: 0,
  };
  for (const conversation of groupThreadsByUser(threads)) {
    counts[conversation.status] += 1;
  }
  return counts;
}
