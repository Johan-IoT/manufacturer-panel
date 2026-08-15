import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authService } from "@/services";
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
  signIn: (identifier: string, password: string) => Promise<void>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(authService.restore());
    setReady(true);
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const next = await authService.signIn(identifier, password);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    authService.signOut();
    setSession(null);
  }, []);

  const permissions = useMemo<Permissions>(() => {
    if (!session) return noPermissions;
    const isManufacturer = session.user.UserRole === "Manufacturer" && session.user.AccountStatus === "Active";
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
