import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authService } from "@/services";
import {
  getAccessToken,
  onUnauthorized,
  tryRefreshAccessToken,
} from "@/services/client";
import type { Session } from "@/types/entities";

/** Centralized authorization. Convenience layer only — the backend is authoritative. */
export interface Permissions {
  canViewDevices: boolean;
  canDeactivateDevice: boolean;
  canManageDeviceTypes: boolean;
  canEditBleProfile: boolean;
  canManageRelationships: boolean;
  canManageUsers: boolean;
  canSendNotifications: boolean;
  canReplySupport: boolean;
}

interface AuthContextValue {
  session: Session | null;
  ready: boolean;
  permissions: Permissions;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const noPermissions: Permissions = {
  canViewDevices: false,
  canDeactivateDevice: false,
  canManageDeviceTypes: false,
  canEditBleProfile: false,
  canManageRelationships: false,
  canManageUsers: false,
  canSendNotifications: false,
  canReplySupport: false,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return onUnauthorized(() => {
      authService.signOut();
      setSession(null);
      queryClient.clear();
      toast.error("Your session has expired. Please sign in again.");
    });
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const restored = authService.restore();
      if (!restored) {
        if (!cancelled) setReady(true);
        return;
      }
      if (!getAccessToken()) {
        const refreshed = await tryRefreshAccessToken();
        if (!refreshed) {
          authService.signOut();
          if (!cancelled) {
            setSession(null);
            setReady(true);
          }
          return;
        }
      }
      if (!cancelled) {
        setSession(restored);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await authService.signIn(email, password);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    authService.signOut();
    setSession(null);
  }, []);

  const permissions = useMemo<Permissions>(() => {
    if (!session) return noPermissions;
    const isManufacturer = session.user.IsManufacturer && session.user.AccountStatus === "Active";
    return {
      canViewDevices: true,
      canDeactivateDevice: isManufacturer,
      canManageDeviceTypes: isManufacturer,
      canEditBleProfile: isManufacturer,
      canManageRelationships: isManufacturer,
      canManageUsers: isManufacturer,
      canSendNotifications: isManufacturer,
      canReplySupport: isManufacturer,
    };
  }, [session]);

  const value = useMemo(
    () => ({ session, ready, permissions, signIn, signOut }),
    [session, ready, permissions, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function usePermissions(): Permissions {
  return useAuth().permissions;
}
