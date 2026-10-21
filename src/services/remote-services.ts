import type {
  AppUser,
  BleProfile,
  Device,
  DeviceStatus,
  DeviceType,
  DeviceUserLink,
  GlobalRole,
  Session,
  SupportMessage,
  SupportThread,
  SupportThreadStatus,
} from "@/types/entities";
import {
  ApiError,
  apiFetch,
  clone,
  setAccessToken,
  setRefreshToken,
  clearAuthTokens,
  unwrapData,
} from "./client";
import { normalizeUser } from "./user-mapper";

const SESSION_KEY = "gsm.manufacturer.session";

export const authService = {
  async signIn(email: string, password: string): Promise<Session> {
    let payload: {
      status?: string;
      accessToken?: string;
      refreshToken?: string;
      user?: Record<string, unknown>;
    };
    try {
      payload = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // fetch itself failed: server down, no internet or blocked request.
      throw new ApiError("Cannot reach the server.", 0);
    }
    if (payload.status === "verification_required" || !payload.accessToken || !payload.user) {
      throw new ApiError(
        "Login failed. This account is not verified yet. Complete the email and mobile verification in the app first.",
        403,
      );
    }
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
  /** Keeps the stored session in step after the signed-in user edits their own details. */
  updateSessionUser(session: Session, user: AppUser): Session {
    const next: Session = { ...session, user: clone(user) };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    }
    return next;
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
  /** Name and company are saved directly. */
  async updateProfile(
    id: string,
    input: { firstName: string; lastName: string; companyName: string },
  ): Promise<AppUser> {
    return normalizeUser(
      await unwrapData(
        await apiFetch<{ data: AppUser }>(`/users/${id}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      ),
    );
  },
  /** Sends a code to the NEW email (email OTP) or NEW mobile number (SMS OTP). */
  async requestContactChange(id: string, channel: "email" | "mobile", value: string): Promise<void> {
    await apiFetch(`/users/${id}/contact-change`, {
      method: "POST",
      body: JSON.stringify({ channel, value }),
    });
  },
  /** Confirms the code; only then the new email / mobile number is saved. */
  async confirmContactChange(id: string, channel: "email" | "mobile", code: string): Promise<AppUser> {
    return normalizeUser(
      await unwrapData(
        await apiFetch<{ data: AppUser }>(`/users/${id}/contact-change/confirm`, {
          method: "POST",
          body: JSON.stringify({ channel, code }),
        }),
      ),
    );
  },
  /** Manufacturer rights: receive new support messages as notifications. */
  async setSupportNotifications(id: string, optIn: boolean): Promise<AppUser> {
    const data = normalizeUser(
      await unwrapData(
        await apiFetch<{ data: AppUser }>(`/users/${id}/support-notifications`, {
          method: "PATCH",
          body: JSON.stringify({ optIn }),
        }),
      ),
    );
    return clone(data);
  },
  /** Soft delete: blocked and hidden, history kept, owned devices released. */
  async remove(id: string): Promise<AppUser> {
    const data = normalizeUser(
      await unwrapData(await apiFetch<{ data: AppUser }>(`/users/${id}`, { method: "DELETE" })),
    );
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
  async createInstaller(input: {
    email: string;
    firstName: string;
    lastName: string;
    mobileNumber: string;
    password: string;
    companyName?: string | undefined;
  }): Promise<{ user: AppUser; codesSent: { email: boolean; mobile: boolean } }> {
    // The new user must confirm mobile and email: codes are sent to both.
    const payload = await apiFetch<{
      data: AppUser;
      codesSent?: { email: boolean; mobile: boolean };
    }>("/users", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return {
      user: clone(normalizeUser(payload.data)),
      codesSent: payload.codesSent ?? { email: true, mobile: true },
    };
  },
  /** Confirms the email / mobile verification code of a user who is not verified yet. */
  async verifyContact(id: string, channel: "email" | "mobile", code: string): Promise<AppUser> {
    return normalizeUser(
      await unwrapData(
        await apiFetch<{ data: AppUser }>(`/users/${id}/verify`, {
          method: "POST",
          body: JSON.stringify({ channel, code }),
        }),
      ),
    );
  },
  /** Sends the email / mobile verification code again. */
  async resendVerificationCode(id: string, channel: "email" | "mobile"): Promise<void> {
    await apiFetch(`/users/${id}/verify/resend`, {
      method: "POST",
      body: JSON.stringify({ channel }),
    });
  },
};

export const deviceTypeService = {
  async list(): Promise<DeviceType[]> {
    return clone(await unwrapData(await apiFetch<{ data: DeviceType[] }>("/device-types")));
  },
  async get(id: string): Promise<DeviceType> {
    return clone(await unwrapData(await apiFetch<{ data: DeviceType }>(`/device-types/${id}`)));
  },
  /** CopyFromDeviceTypeId copies that type's BLE profile and default configuration. */
  async create(
    input: Omit<DeviceType, "id"> & {
      CopyFromDeviceTypeId?: string | undefined;
      /** BLE profile of the new type (Active is the type's own switch). */
      BleProfile?: Omit<BleProfile, "id" | "DeviceTypeId" | "Active"> | undefined;
    },
  ): Promise<DeviceType> {
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

/** A stored parameter value (server parameter code, label value as the app shows it). */
export interface ConfigParameterValue {
  parameterCode: number;
  value: string | null;
}

export interface DeviceTypeDefaultParameter extends ConfigParameterValue {
  parameterCodeHex: string;
  name: string;
  category: string;
  isSensitive: boolean;
}

export interface DeviceConfigParameter {
  parameterCode: number;
  parameterCodeHex: string;
  category: string;
  knownValue: string | null;
  desiredValue: string | null;
  isSensitive: boolean;
  configVersion: number;
  updatedAt: string;
}

export interface DeviceConfiguration {
  deviceId: string;
  serialNumber: string;
  configVersion: number;
  parameters: DeviceConfigParameter[];
}

/** Default configuration copied to each new device of a type (applies to devices added afterwards). */
export const deviceTypeDefaultConfigService = {
  async get(deviceTypeId: string): Promise<DeviceTypeDefaultParameter[]> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: DeviceTypeDefaultParameter[] }>(
          `/device-types/${deviceTypeId}/default-config`,
        ),
      ),
    );
  },
  async save(
    deviceTypeId: string,
    parameters: ConfigParameterValue[],
  ): Promise<DeviceTypeDefaultParameter[]> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: DeviceTypeDefaultParameter[] }>(
          `/device-types/${deviceTypeId}/default-config`,
          {
            method: "PUT",
            body: JSON.stringify({ parameters }),
          },
        ),
      ),
    );
  },
};

/**
 * Stored device parameters (database only). Edits become the desired values the
 * app writes to the device on its next BLE Write.
 */
export const deviceConfigurationService = {
  async get(serialNumber: string): Promise<DeviceConfiguration> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: DeviceConfiguration }>(
          `/panel/devices/${encodeURIComponent(serialNumber)}/configuration`,
        ),
      ),
    );
  },
  async save(
    serialNumber: string,
    parameters: ConfigParameterValue[],
  ): Promise<DeviceConfiguration> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: DeviceConfiguration }>(
          `/panel/devices/${encodeURIComponent(serialNumber)}/configuration`,
          { method: "PUT", body: JSON.stringify({ parameters }) },
        ),
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
  /** Suspend, Set to Released (reinstate) or Decommission; the server enforces the rules. */
  async changeStatus(
    serialNumber: string,
    action: "suspend" | "reinstate" | "decommission",
  ): Promise<Device> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: Device }>(`/devices/${serialNumber}/${action}`, {
          method: "PATCH",
        }),
      ),
    );
  },
  /** Device Name, Firmware Version and Hardware Version are entered by hand. */
  async updateDetails(
    serialNumber: string,
    patch: Partial<Pick<Device, "DeviceName" | "FirmwareVersion" | "HardwareVersion">>,
  ): Promise<Device> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: Device }>(`/devices/${serialNumber}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      ),
    );
  },
  /** Configuration history: reads, writes and commands logged by the app. */
  async interactions(serialNumber: string): Promise<DeviceInteraction[]> {
    return unwrapData(
      await apiFetch<{ data: DeviceInteraction[] }>(`/panel/devices/${serialNumber}/interactions`),
    );
  },
  async releaseOwnership(serialNumber: string): Promise<void> {
    await apiFetch(`/devices/${serialNumber}/release-ownership`, { method: "DELETE" });
  },
  async register(input: {
    serialNumber: string;
    deviceTypeId: string;
    name?: string | undefined;
    firmwareVersion?: string | undefined;
  }): Promise<void> {
    await apiFetch("/devices/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export const relationshipService = {
  async list(): Promise<DeviceUserLink[]> {
    return clone(await unwrapData(await apiFetch<{ data: DeviceUserLink[] }>("/device-links")));
  },
  async listForDevice(serial: string): Promise<DeviceUserLink[]> {
    return clone(
      await unwrapData(
        await apiFetch<{ data: DeviceUserLink[] }>(`/device-links/device/${serial}`),
      ),
    );
  },
  async listForUser(userId: string): Promise<DeviceUserLink[]> {
    const all = await this.list();
    return all.filter((l) => l.AppUserId === userId);
  },
  async grant(
    input: Omit<DeviceUserLink, "id" | "Active" | "GrantedAt" | "RevokedAt">,
  ): Promise<DeviceUserLink> {
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

export interface DeviceInteraction {
  id: string;
  occurredAt: string;
  uploadedAt: string;
  serialNumber: string;
  appUserId: string;
  appId: string;
  userName: string;
  userEmail: string;
  type: string;
  /** "Success" or "Failed". */
  result: string;
  /** Why it failed, as shown in the app. */
  message: string | null;
  parameterCodes: string[];
  latitude: number | null;
  longitude: number | null;
}

export interface NotificationSettings {
  autoDelete: boolean;
  deleteOlderThanDays: number;
}

export const notificationService = {
  async list(): Promise<unknown> {
    return unwrapData(await apiFetch<{ data: unknown }>("/notifications"));
  },
  async getSettings(): Promise<NotificationSettings> {
    return unwrapData(await apiFetch<{ data: NotificationSettings }>("/notifications/settings"));
  },
  async updateSettings(
    settings: NotificationSettings,
  ): Promise<NotificationSettings & { deleted: number }> {
    return unwrapData(
      await apiFetch<{ data: NotificationSettings & { deleted: number } }>("/notifications/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }),
    );
  },
  async send(input: {
    recipientUserIds: string[];
    title: string;
    body: string;
    notificationType: string;
    priority: string;
    actionType: string;
    actionValue?: string | null;
    /** The notification is about this device. */
    deviceSerialNumber?: string | null;
  }) {
    return apiFetch("/notifications/send", {
      method: "POST",
      body: JSON.stringify({
        recipientUserIds: input.recipientUserIds,
        title: input.title,
        body: input.body,
        notificationType: input.notificationType,
        priority: input.priority,
        actionType: input.actionType,
        actionValue: input.actionValue ?? null,
        deviceSerialNumber: input.deviceSerialNumber ?? null,
      }),
    });
  },
};

export const supportService = {
  async listThreads(): Promise<SupportThread[]> {
    return clone(await unwrapData(await apiFetch<{ data: SupportThread[] }>("/messages/threads")));
  },
  async getThread(id: string): Promise<{ thread: SupportThread; messages: SupportMessage[] }> {
    return unwrapData(
      await apiFetch<{ data: { thread: SupportThread; messages: SupportMessage[] } }>(
        `/messages/threads/${id}`,
      ),
    );
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

/** Johan: Device Summary. Total devices and the count per device status. */
export interface DeviceSummary {
  totalDevices: number;
  byStatus: Record<DeviceStatus, number>;
}

export interface DashboardSummary {
  deviceSummary: DeviceSummary;
  recentRegistrations: { serial: string; name: string; at: string }[];
  recentClaims: { serial: string; user: string; at: string }[];
}

export const dashboardService = {
  async summary(): Promise<DashboardSummary> {
    return unwrapData(await apiFetch<{ data: DashboardSummary }>("/dashboard/summary"));
  },
};
