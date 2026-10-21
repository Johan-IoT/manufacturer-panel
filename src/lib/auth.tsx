import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authService } from "@/services";
import {
  getAccessToken,
  getLastRefreshFailure,
  isBlockedAccount,
  onUnauthorized,
  sessionEndedMessage,
  tryRefreshAccessToken,
} from "@/services/client";
import type { AppUser, Session } from "@/types/entities";

/** Centralized authorization. Convenience layer only; the backend is authoritative. */
export interface Permissions {
  canViewDevices: boolean;
  canDeactivateDevice: boolean;
  /** Edit stored device parameters (database only; the app writes them over BLE). */
  canEditDeviceConfiguration: boolean;
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
  /** Why the panel signed the user out (shown on the login screen), null after a normal sign out. */
  signOutMessage: string | null;
  /** Refreshes the header after the signed-in user's own details change. */
  updateSessionUser: (user: AppUser) => void;
}

const noPermissions: Permissions = {
  canViewDevices: false,
  canDeactivateDevice: false,
  canEditDeviceConfiguration: false,
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
  const [signOutMessage, setSignOutMessage] = useState<string | null>(null);

  useEffect(() => {
    return onUnauthorized((message) => {
      authService.signOut();
      setSession(null);
      setSignOutMessage(message);
      queryClient.clear();
      // One toast even when several requests fail at the same time.
      toast.error(message, { id: "session-ended" });
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
            const failure = getLastRefreshFailure();
            // Only explain a blocked account; an old session just shows the login screen.
            if (isBlockedAccount(failure)) {
              setSignOutMessage(sessionEndedMessage(failure));
            }
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
    setSignOutMessage(null);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    authService.signOut();
    setSignOutMessage(null);
    setSession(null);
  }, []);

  const updateSessionUser = useCallback((user: AppUser) => {
    setSession((current) =>
      current && current.user.id === user.id ? authService.updateSessionUser(current, user) : current,
    );
  }, []);

  const permissions = useMemo<Permissions>(() => {
    if (!session) return noPermissions;
    const isManufacturer = session.user.IsManufacturer && session.user.AccountStatus === "Active";
    return {
      canViewDevices: true,
      canDeactivateDevice: isManufacturer,
      canEditDeviceConfiguration: isManufacturer,
      canManageDeviceTypes: isManufacturer,
      canEditBleProfile: isManufacturer,
      canManageRelationships: isManufacturer,
      canManageUsers: isManufacturer,
      canSendNotifications: isManufacturer,
      canReplySupport: isManufacturer,
    };
  }, [session]);

  const value = useMemo(
    () => ({ session, ready, permissions, signIn, signOut, signOutMessage, updateSessionUser }),
    [session, ready, permissions, signIn, signOut, signOutMessage, updateSessionUser],
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
