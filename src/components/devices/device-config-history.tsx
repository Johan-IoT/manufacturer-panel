import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Pill } from "@/components/app/badges";
import { DataTable, type Column } from "@/components/app/data-table";
import { deviceService, type DeviceInteraction } from "@/services";
import { formatDateTime } from "@/lib/format";

/** Readable labels for the interaction types the app logs. */
const TYPE_LABELS: Record<string, string> = {
  ReadAll: "Read All",
  ReadSelected: "Read Selected",
  ReadCategory: "Read Category",
  WriteAll: "Write All",
  WriteSelected: "Write Selected",
  WriteCategory: "Write Category",
  Command: "Command",
  SaveToCache: "Save to Cache",
};

const typeLabel = (type: string) => TYPE_LABELS[type] ?? type;

/**
 * Configuration history (Johan, 20 Oct): who read from or wrote to this device,
 * when, where and how. Logged by the app and uploaded when it has a connection.
 */
export function DeviceConfigHistory({ serial }: { serial: string }) {
  const query = useQuery({
    queryKey: ["device-interactions", serial],
    queryFn: () => deviceService.interactions(serial),
  });
  const rows = query.data ?? [];
  const users = [...new Map(rows.map((r) => [r.appUserId, r])).values()];
  const types = [...new Set(rows.map((r) => r.type))];

  const columns: Column<DeviceInteraction>[] = [
    {
      key: "at",
      header: "Date / Time",
      sortValue: (r) => r.occurredAt,
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(r.occurredAt)}
        </span>
      ),
    },
    {
      key: "user",
      header: "App User",
      sortValue: (r) => r.userName.toLowerCase(),
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{r.userName || r.userEmail}</p>
          <p className="font-mono text-xs text-muted-foreground">{r.appId}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Interaction",
      sortValue: (r) => r.type,
      render: (r) => (
        <Pill
          tone={r.type.startsWith("Write") ? "warning" : r.type === "Command" ? "primary" : "info"}
        >
          {typeLabel(r.type)}
        </Pill>
      ),
    },
    {
      key: "result",
      header: "Result",
      sortValue: (r) => r.result,
      render: (r) =>
        r.result === "Failed" ? (
          <span title={r.message ?? undefined}>
            <Pill tone="danger">Failed</Pill>
          </span>
        ) : (
          <Pill tone="success">Success</Pill>
        ),
    },
    {
      key: "params",
      header: "Parameters",
      render: (r) => (
        <span className="text-xs text-muted-foreground" title={r.parameterCodes.join(", ")}>
          {r.parameterCodes.length > 0 ? `${r.parameterCodes.length}` : "-"}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (r) =>
        r.latitude != null && r.longitude != null ? (
          <a
            href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
  ];

  return (
    <DataTable
      data={query.data}
      columns={columns}
      rowKey={(r) => r.id}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      searchPlaceholder="Search user or AppId"
      searchFields={[(r) => r.userName, (r) => r.userEmail, (r) => r.appId]}
      filters={[
        {
          key: "type",
          label: "Interaction",
          options: types.map((t) => ({ value: t, label: typeLabel(t) })),
          predicate: (r, v) => r.type === v,
        },
        {
          key: "result",
          label: "Result",
          options: [
            { value: "Success", label: "Success" },
            { value: "Failed", label: "Failed" },
          ],
          predicate: (r, v) => r.result === v,
        },
        {
          key: "user",
          label: "App User",
          options: users.map((u) => ({ value: u.appUserId, label: u.userName || u.appId })),
          predicate: (r, v) => r.appUserId === v,
        },
      ]}
      emptyTitle="No reads or writes have been logged for this device yet"
    />
  );
}
