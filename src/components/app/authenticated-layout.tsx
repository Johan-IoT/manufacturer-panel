import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/app/app-shell";

/** Keeps shell (sidebar/header) mounted across in-app navigation. */
export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/login") {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
