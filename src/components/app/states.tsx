import { AlertTriangle, Inbox, Loader2, RefreshCw, SearchX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LoadingState({ rows = 6, label = "Loading data" }: { rows?: number | undefined; label?: string | undefined }) {
  return (
    <div className="space-y-3 p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full bg-muted/50" />
      ))}
    </div>
  );
}

function Shell({
  icon,
  title,
  description,
  action,
  tone = "muted",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode | undefined;
  tone?: "muted" | "danger" | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-lg border",
          tone === "danger" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-surface-raised text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  description = "There is no data to display for this view.",
  action,
}: {
  title?: string | undefined;
  description?: string | undefined;
  action?: React.ReactNode | undefined;
}) {
  return <Shell icon={<Inbox className="size-5" />} title={title} description={description} action={action} />;
}

export function NoResultsState({ onClear }: { onClear?: (() => void) | undefined }) {
  return (
    <Shell
      icon={<SearchX className="size-5" />}
      title="No matching results"
      description="No records match your current search and filters. Try adjusting them."
      action={
        onClear ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );
}

export function ErrorState({
  description = "Something went wrong while loading this data. Please try again.",
  onRetry,
}: {
  description?: string | undefined;
  onRetry?: (() => void) | undefined;
}) {
  return (
    <Shell
      tone="danger"
      icon={<AlertTriangle className="size-5" />}
      title="Unable to load"
      description={description}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" /> Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export function UnauthorizedState() {
  return (
    <Shell
      tone="danger"
      icon={<ShieldAlert className="size-5" />}
      title="Access restricted"
      description="You do not have permission to view this area of the Manufacturer Panel."
    />
  );
}
