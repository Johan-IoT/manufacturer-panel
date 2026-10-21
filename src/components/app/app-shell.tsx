import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Cpu,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Radar,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { iconTone, navIconTone } from "@/lib/icon-colors";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "./cards";
import { PageTransition } from "./page-layout";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/devices", label: "Devices", icon: Cpu, exact: false },
  { to: "/device-types", label: "Device Types", icon: Radar, exact: false },
  { to: "/users", label: "Users", icon: Users, exact: false },
  { to: "/notifications", label: "Notifications", icon: Bell, exact: false },
  { to: "/support", label: "Support", icon: LifeBuoy, exact: false },
] as const;

function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Operations
      </p>
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "border-l-2 border-l-primary bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className={cn("size-4", navIconTone[item.label] ?? iconTone.muted)} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  onSignOut,
  onNavigate,
}: {
  onSignOut: () => void;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <div className="mt-auto border-t border-sidebar-border p-3">
      <Button
        variant="destructiveOutline"
        className="w-full justify-start gap-3"
        onClick={() => {
          onSignOut();
          onNavigate?.();
        }}
      >
        <LogOut className={cn("size-4", iconTone.danger)} />
        Sign out
      </Button>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
      <div className="flex size-8 items-center justify-center rounded-md border border-[var(--tone-primary-border)] bg-[var(--tone-primary-bg)]">
        <Radar className={cn("size-4", iconTone.primary)} />
      </div>
      <div className="leading-tight">
        <p className="font-display text-sm font-semibold tracking-tight text-sidebar-foreground">Manufacturer Panel</p>
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">ConfigGate</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, ready, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login", replace: true });
  }, [ready, session, navigate]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground animate-content-enter">
        Verifying session…
      </div>
    );
  }

  const user = session.user;

  const handleSignOut = () => {
    signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <BrandMark />
        <SidebarNav />
        <SidebarFooter onSignOut={handleSignOut} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-muted" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
            <div className="flex items-center justify-between">
              <BrandMark />
              <Button variant="ghost" size="icon" className="mr-2" onClick={() => setMobileOpen(false)}>
                <X className={cn("size-4", iconTone.foreground)} />
              </Button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter onSignOut={handleSignOut} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className={cn("size-4", iconTone.primary)} />
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild aria-label="Notifications" className="text-warning hover:text-warning">
              <Link to="/notifications">
                <Bell className="size-4 text-warning" />
              </Link>
            </Button>
            <Link
              to="/users/$userId"
              params={{ userId: user.id }}
              aria-label="Open my user details"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
            >
              <UserAvatar user={user} size="sm" />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm text-foreground">
                  {user.FirstName} {user.LastName}
                </span>
                <span className="block text-[11px] text-muted-foreground">{user.Email}</span>
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
