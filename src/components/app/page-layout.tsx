import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ErrorState, LoadingState } from "./states";

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("animate-page-enter", className)}>{children}</div>;
}

export function AnimatedContent({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className?: string;
  delay?: number | undefined;
}) {
  return (
    <div
      className={cn("animate-content-enter", className)}
      style={delay != null ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export function AnimatedStagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("animate-stagger-children", className)}>{children}</div>;
}

export function AsyncPageContent({
  isLoading,
  isError,
  onRetry,
  loadingLabel = "Loading data",
  errorTitle = "Unable to load",
  shellClassName,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry?: (() => void) | undefined;
  loadingLabel?: string | undefined;
  errorTitle?: string | undefined;
  shellClassName?: string | undefined;
  children: ReactNode | (() => ReactNode);
}) {
  const renderChildren = () => (typeof children === "function" ? children() : children);

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border border-border bg-surface animate-content-enter", shellClassName)}>
        <LoadingState label={loadingLabel} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("rounded-lg border border-border bg-surface animate-content-enter", shellClassName)}>
        <ErrorState title={errorTitle} onRetry={onRetry} />
      </div>
    );
  }

  return <AnimatedContent>{renderChildren()}</AnimatedContent>;
}
