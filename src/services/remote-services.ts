import type {
  AppUser,
  BleProfile,
  Device,
  DeviceType,
  DeviceUserLink,
  GlobalRole,
  Session,
  SupportMessage,
  SupportThread,
  SupportThreadStatus,
} from "@/types/entities";
import { ApiError, apiFetch, clone, setAccessToken, setRefreshToken, clearAuthTokens, unwrapData } from "./client";
import { normalizeUser } from "./user-mapper";

const SESSION_KEY = "gsm.manufacturer.session";

export const authService = {
  async signIn(email: string, password: string): Promise<Session> {
    const payload = await apiFetch<{
      accessToken: string;
      refreshToken?: string;
      user: Record<string, unknown>;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const user = normalizeUser(payload.user);
    if (!user.IsManufacturer) {
      throw new ApiError("This panel is restricted to Manufacturer accounts.", 403);
    }
    if (user.AccountStatus !== "Active") {
      throw new ApiError(
        `This account is ${user.AccountStatus.toLowerCase()}. Contact ConfigGate support.`,
        403,
      );
    }
    setAccessToken(payload.accessToken);
    if (payload.refreshToken) setRefreshToken(payload.refreshToken);
    const session: Session = { user: clone(user), issuedAt: new Date().toISOString() };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return session;
  },
  restore(): Session | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as Session;
      session.user = normalizeUser(session.user);
      return session;
    } catch {
      return null;
    }
  },
  signOut() {
    clearAuthTokens();
    if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
  },
};

export const userService = {
  async list(): Promise<AppUser[]> {
    const data = await unwrapData(await apiFetch<{ data: AppUser[] }>("/users"));
    return data.map(normalizeUser);
  },
  async get(id: string): Promise<AppUser> {
    const data = normalizeUser(await unwrapData(await apiFetch<{ data: AppUser }>(`/users/${id}`)));
    return clone(data);
  },
  async setAccountStatus(id: string, status: AppUser["AccountStatus"]): Promise<AppUser> {
    const data = normalizeUser(
      await unwrapData(
        await apiFetch<{ data: AppUser }>(`/users/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ AccountStatus: status }),
        }),
      ),
    );
    return clone(data);
  },
  async updateCapabilities(
    id: string,
    capabilities: { IsManufacturer?: boolean; IsInstaller?: boolean },
  ): Promise<AppUser> {
    const roles: GlobalRole[] = [];
    if (capabilities.IsManufacturer) roles.push("Manufacturer");
    if (capabilities.IsInstaller) roles.push("Installer");
    const data = normalizeUser(
      await unwrapData(
        await apiFetch<{ data: AppUser }>(`/users/${id}/roles`, {
          method: "PATCH",
          body: JSON.stringify({ roles }),
        }),
      ),
    );
    return clone(data);
  },
  /** Preferred API for role assignment using role list. */
  async setUserRoles(id: string, roles: GlobalRole[]): Promise<AppUser> {
    const data = normalizeUser(
      await unwrapData(
        await apiFetch<{ data: AppUser }>(`/users/${id}/roles`, {
          method: "PATCH",
          body: JSON.stringify({ roles }),
        }),
      ),
    );
    return clone(data);
  },
};

export const deviceTypeService = {
  async list(): Promise<DeviceType[]> {
    return clone(await unwrapData(await apiFetch<{ data: DeviceType[] }>("/device-types")));
  },
  async get(id: string): Promise<DeviceType> {
    return clone(await unwrapData(await apiFetch<{ data: DeviceType }>(`/device-types/${id}`)));
  },
  async create(input: Omit<DeviceType, "id">): Promise<DeviceType> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: DeviceType }>("/device-types", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      ),
    );
  },
  async update(id: string, patch: Partial<DeviceType>): Promise<DeviceType> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: DeviceType }>(`/device-types/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      ),
    );
  },
};

export const bleProfileService = {
  async getForDeviceType(deviceTypeId: string): Promise<BleProfile> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: BleProfile }>(`/device-types/${deviceTypeId}/ble-profile`),
      ),
    );
  },
  async update(id: string, patch: Partial<BleProfile>): Promise<BleProfile> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: BleProfile }>(`/ble-profiles/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      ),
    );
  },
};

export const deviceService = {
  async list(): Promise<Device[]> {
    return clone(await unwrapData(await apiFetch<{ data: Device[] }>("/devices")));
  },
  async get(serialNumber: string): Promise<Device> {
    return clone(await unwrapData(await apiFetch<{ data: Device }>(`/devices/${serialNumber}`)));
  },
  async listByDeviceType(deviceTypeId: string): Promise<Device[]> {
    const all = await this.list();
    return all.filter((d) => d.DeviceTypeId === deviceTypeId);
  },
  async deactivate(serialNumber: string): Promise<Device> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: Device }>(`/devices/${serialNumber}/deactivate`, { method: "PATCH" }),
      ),
    );
  },
};

export const relationshipService = {
  async list(): Promise<DeviceUserLink[]> {
    return clone(await unwrapData(await apiFetch<{ data: DeviceUserLink[] }>("/device-links")));
  },
  async listForDevice(serial: string): Promise<DeviceUserLink[]> {
    return clone(
      await unwrapData(await apiFetch<{ data: DeviceUserLink[] }>(`/device-links/device/${serial}`)),
    );
  },
  async listForUser(userId: string): Promise<DeviceUserLink[]> {
    const all = await this.list();
    return all.filter((l) => l.AppUserId === userId);
  },
  async grant(input: Omit<DeviceUserLink, "id" | "Active" | "GrantedAt" | "RevokedAt">): Promise<DeviceUserLink> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: DeviceUserLink }>("/device-links/grant", {
          method: "POST",
          body: JSON.stringify({
            deviceSerialNumber: input.DeviceSerialNumber,
            appUserId: input.AppUserId,
            linkType: input.LinkType,
            canView: input.CanView,
            canConfigure: input.CanConfigure,
            canControl: input.CanControl,
            canShare: input.CanShare,
          }),
        }),
      ),
    );
  },
  async revoke(linkId: string): Promise<void> {
    await apiFetch(`/device-user-links/${linkId}/revoke`, { method: "DELETE" });
  },
};

export const notificationService = {
  async list() {
    return unwrapData(await apiFetch("/notifications"));
  },
  async send(input: { recipientUserIds: string[]; title: string; body: string }) {
    return apiFetch("/notifications/send", {
      method: "POST",
      body: JSON.stringify({
        recipientUserIds: input.recipientUserIds,
        title: input.title,
        body: input.body,
      }),
    });
  },
};

export const supportService = {
  async listThreads(): Promise<SupportThread[]> {
    return clone(await unwrapData(await apiFetch<{ data: SupportThread[] }>("/messages/threads")));
  },
  async getThread(id: string) {
    return unwrapData(await apiFetch(`/messages/threads/${id}`));
  },
  async reply(threadId: string, authorUserId: string, body: string): Promise<SupportMessage> {
    return unwrapData(
      await apiFetch(`/messages/threads/${threadId}/reply`, {
        method: "POST",
        body: JSON.stringify({ body, authorUserId }),
      }),
    );
  },
  async setStatus(threadId: string, status: SupportThreadStatus): Promise<SupportThread> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: SupportThread }>(`/messages/threads/${threadId}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      ),
    );
  },
};

export const dashboardService = {
  async summary() {
    return unwrapData(await apiFetch("/dashboard/summary"));
  },
};
