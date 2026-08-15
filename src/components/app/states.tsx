import { AlertTriangle, Inbox, Loader2, RefreshCw, SearchX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { iconTone } from "@/lib/icon-colors";

export function LoadingState({ rows = 6, label = "Loading data" }: { rows?: number | undefined; label?: string | undefined }) {
  return (
    <div className="space-y-3 p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className={cn("size-4 animate-spin", iconTone.primary)} />
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
  action,
  tone = "muted",
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode | undefined;
  tone?: "muted" | "danger" | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-lg border",
          tone === "danger"
            ? "border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-destructive"
            : "border-border bg-surface-raised text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {action}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  action,
}: {
  title?: string | undefined;
  action?: React.ReactNode | undefined;
}) {
  return <Shell icon={<Inbox className={cn("size-5", iconTone.muted)} />} title={title} action={action} />;
}

export function NoResultsState({ onClear }: { onClear?: (() => void) | undefined }) {
  return (
    <Shell
      icon={<SearchX className={cn("size-5", iconTone.warning)} />}
      title="No matching results"
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
  title = "Unable to load",
  onRetry,
}: {
  title?: string | undefined;
  onRetry?: (() => void) | undefined;
}) {
  return (
    <Shell
      tone="danger"
      icon={<AlertTriangle className={cn("size-5", iconTone.danger)} />}
      title={title}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className={cn("size-3.5", iconTone.primary)} /> Try again
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
      icon={<ShieldAlert className={cn("size-5", iconTone.danger)} />}
      title="Access restricted"
    />
  );
}
