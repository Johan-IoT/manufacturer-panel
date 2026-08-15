// Service layer. UI components must import from here (via repositories/hooks),
// never from src/data or any transport module directly.

import * as db from "@/data/mock-db";
import { ApiError, clone, latency } from "./client";
import type {
  AppUser,
  BleProfile,
  DeliveryStatus,
  Device,
  DeviceType,
  DeviceUserLink,
  LinkType,
  Notification,
  PushNotificationDelivery,
  Session,
  SupportMessage,
  SupportThread,
  SupportThreadStatus,
  UserNotification,
} from "@/types/entities";

// In-memory mutable store seeded from the mock dataset.
const store = {
  users: clone(db.users),
  deviceTypes: clone(db.deviceTypes),
  bleProfiles: clone(db.bleProfiles),
  devices: clone(db.devices),
  links: clone(db.deviceUserLinks),
  notifications: clone(db.notifications),
  userNotifications: clone(db.userNotifications),
  deliveries: clone(db.pushDeliveries),
  threads: clone(db.supportThreads),
  messages: clone(db.supportMessages),
};

const SESSION_KEY = "gsm.manufacturer.session";

export const authService = {
  async signIn(identifier: string, password: string): Promise<Session> {
    await latency(500);
    const user = store.users.find(
      (u) =>
        u.Email.toLowerCase() === identifier.trim().toLowerCase() ||
        u.MobileNumber.replace(/\s/g, "") === identifier.replace(/\s/g, ""),
    );
    if (!user || password.length < 6) {
      throw new ApiError("Incorrect email/mobile number or password.", 401);
    }
    if (user.UserRole !== "Manufacturer") {
      throw new ApiError("This panel is restricted to Manufacturer accounts.", 403);
    }
    if (user.AccountStatus !== "Active") {
      throw new ApiError(`This account is ${user.AccountStatus.toLowerCase()}. Contact GSM Systems support.`, 403);
    }
    user.LastLoginAt = new Date().toISOString();
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
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  signOut() {
    if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
  },
};

export const userService = {
  async list(): Promise<AppUser[]> {
    await latency();
    return clone(store.users);
  },
  async get(id: string): Promise<AppUser> {
    await latency();
    const user = store.users.find((u) => u.id === id);
    if (!user) throw new ApiError("This user could not be found.", 404);
    return clone(user);
  },
  async setAccountStatus(id: string, status: AppUser["AccountStatus"]): Promise<AppUser> {
    await latency(360);
    const user = store.users.find((u) => u.id === id);
    if (!user) throw new ApiError("This user could not be found.", 404);
    user.AccountStatus = status;
    user.UpdatedAt = new Date().toISOString();
    return clone(user);
  },
};

export const deviceTypeService = {
  async list(): Promise<DeviceType[]> {
    await latency();
    return clone(store.deviceTypes);
  },
  async get(id: string): Promise<DeviceType> {
    await latency();
    const t = store.deviceTypes.find((d) => d.id === id);
    if (!t) throw new ApiError("This device type could not be found.", 404);
    return clone(t);
  },
  async create(input: Omit<DeviceType, "id">): Promise<DeviceType> {
    await latency(400);
    if (store.deviceTypes.some((t) => t.TypeCode.toLowerCase() === input.TypeCode.toLowerCase())) {
      throw new ApiError("A device type with this Type Code already exists.", 409);
    }
    const created: DeviceType = { ...input, id: `dt-${Date.now()}` };
    store.deviceTypes.push(created);
    store.bleProfiles.push({
      id: `bp-${Date.now()}`,
      DeviceTypeId: created.id,
      ProfileName: `${created.TypeCode} Standard Profile`,
      PublishedName: created.TypeCode,
      PublishedNamePrefix: created.TypeCode.split("-")[1] ?? "GSM",
      ServiceUuid: "0000fe00-0000-1000-8000-00805f9b34fb",
      TxCharacteristicUuid: "0000ff01-0000-1000-8000-00805f9b34fb",
      RxCharacteristicUuid: "0000ff02-0000-1000-8000-00805f9b34fb",
      RxUsesNotification: true,
      WriteWithResponse: true,
      MaximumPacketSize: 180,
      ConnectionTimeoutMs: 10000,
      CommandTimeoutMs: 4000,
      IdleDisconnectMs: 60000,
      SerialReadRequired: true,
      Active: true,
    });
    return clone(created);
  },
  async update(id: string, patch: Partial<DeviceType>): Promise<DeviceType> {
    await latency(360);
    const t = store.deviceTypes.find((d) => d.id === id);
    if (!t) throw new ApiError("This device type could not be found.", 404);
    Object.assign(t, patch);
    return clone(t);
  },
};

export const bleProfileService = {
  async getForDeviceType(deviceTypeId: string): Promise<BleProfile> {
    await latency();
    const p = store.bleProfiles.find((b) => b.DeviceTypeId === deviceTypeId);
    if (!p) throw new ApiError("No BLE profile is configured for this device type.", 404);
    return clone(p);
  },
  async update(id: string, patch: Partial<BleProfile>): Promise<BleProfile> {
    await latency(420);
    const p = store.bleProfiles.find((b) => b.id === id);
    if (!p) throw new ApiError("This BLE profile could not be found.", 404);
    Object.assign(p, patch);
    return clone(p);
  },
};

export const deviceService = {
  async list(): Promise<Device[]> {
    await latency();
    return clone(store.devices);
  },
  async get(serialNumber: string): Promise<Device> {
    await latency();
    const d = store.devices.find((x) => x.SerialNumber === serialNumber);
    if (!d) throw new ApiError("This device could not be found.", 404);
    return clone(d);
  },
  async listByDeviceType(deviceTypeId: string): Promise<Device[]> {
    await latency();
    return clone(store.devices.filter((d) => d.DeviceTypeId === deviceTypeId));
  },
  async deactivate(serialNumber: string): Promise<Device> {
    await latency(400);
    const d = store.devices.find((x) => x.SerialNumber === serialNumber);
    if (!d) throw new ApiError("This device could not be found.", 404);
    d.Active = false;
    d.DeviceStatus = "Suspended";
    return clone(d);
  },
};

export const relationshipService = {
  async list(): Promise<DeviceUserLink[]> {
    await latency();
    return clone(store.links);
  },
  async listForDevice(serialNumber: string): Promise<DeviceUserLink[]> {
    await latency();
    return clone(store.links.filter((l) => l.DeviceSerialNumber === serialNumber));
  },
  async listForUser(userId: string): Promise<DeviceUserLink[]> {
    await latency();
    return clone(store.links.filter((l) => l.AppUserId === userId));
  },
  async grant(input: {
    DeviceSerialNumber: string;
    AppUserId: string;
    LinkType: LinkType;
    CanView: boolean;
    CanConfigure: boolean;
    CanControl: boolean;
    CanShare: boolean;
    GrantedByUserId: string;
  }): Promise<DeviceUserLink> {
    await latency(420);
    const device = store.devices.find((d) => d.SerialNumber === input.DeviceSerialNumber);
    if (!device) throw new ApiError("Please enter a valid device serial number.", 404);
    if (input.LinkType === "Owner") {
      const existingOwner = store.links.find(
        (l) => l.DeviceSerialNumber === input.DeviceSerialNumber && l.LinkType === "Owner" && l.Active,
      );
      if (existingOwner) throw new ApiError("This device already has an active Owner.", 409);
    }
    const duplicate = store.links.find(
      (l) =>
        l.DeviceSerialNumber === input.DeviceSerialNumber &&
        l.AppUserId === input.AppUserId &&
        l.LinkType === input.LinkType &&
        l.Active,
    );
    if (duplicate) throw new ApiError("This relationship already exists and is active.", 409);
    const created: DeviceUserLink = {
      id: `l-${Date.now()}`,
      ...input,
      Active: true,
      GrantedAt: new Date().toISOString(),
      RevokedAt: null,
    };
    store.links.push(created);
    return clone(created);
  },
  async revoke(linkId: string): Promise<DeviceUserLink> {
    await latency(400);
    const l = store.links.find((x) => x.id === linkId);
    if (!l) throw new ApiError("This relationship could not be found.", 404);
    l.Active = false;
    l.RevokedAt = new Date().toISOString();
    return clone(l);
  },
};

export interface NotificationRow {
  userNotification: UserNotification;
  notification: Notification;
  recipient: AppUser | undefined;
  deliveries: PushNotificationDelivery[];
}

export const notificationService = {
  async list(): Promise<NotificationRow[]> {
    await latency();
    return clone(
      store.userNotifications.map((un) => ({
        userNotification: un,
        notification: store.notifications.find((n) => n.id === un.NotificationId)!,
        recipient: store.users.find((u) => u.id === un.RecipientUserId),
        deliveries: store.deliveries.filter((d) => d.UserNotificationId === un.id),
      })),
    );
  },
  async send(input: { recipientUserIds: string[]; title: string; body: string }): Promise<void> {
    await latency(480);
    const notification: Notification = {
      id: `n-${Date.now()}`,
      Title: input.title,
      Body: input.body,
      NotificationType: "System",
      CreatedAt: new Date().toISOString(),
    };
    store.notifications.push(notification);
    input.recipientUserIds.forEach((userId, i) => {
      const un: UserNotification = {
        id: `un-${Date.now()}-${i}`,
        NotificationId: notification.id,
        RecipientUserId: userId,
        IsRead: false,
        ReadAt: null,
      };
      store.userNotifications.push(un);
      const status: DeliveryStatus = "Queued";
      store.deliveries.push({
        id: `pd-${Date.now()}-${i}`,
        UserNotificationId: un.id,
        InstallationLabel: "Mobile installation",
        DeliveryStatus: status,
        UpdatedAt: new Date().toISOString(),
      });
    });
  },
};

export const supportService = {
  async listThreads(): Promise<SupportThread[]> {
    await latency();
    return clone(store.threads);
  },
  async getThread(id: string): Promise<{ thread: SupportThread; messages: SupportMessage[] }> {
    await latency();
    const thread = store.threads.find((t) => t.id === id);
    if (!thread) throw new ApiError("This support thread could not be found.", 404);
    return clone({
      thread,
      messages: store.messages
        .filter((m) => m.ThreadId === id)
        .sort((a, b) => a.SentAt.localeCompare(b.SentAt)),
    });
  },
  async reply(threadId: string, authorUserId: string, body: string): Promise<SupportMessage> {
    await latency(380);
    const thread = store.threads.find((t) => t.id === threadId);
    if (!thread) throw new ApiError("This support thread could not be found.", 404);
    const message: SupportMessage = {
      id: `sm-${Date.now()}`,
      ThreadId: threadId,
      AuthorUserId: authorUserId,
      Body: body,
      SentAt: new Date().toISOString(),
    };
    store.messages.push(message);
    thread.LastMessageAt = message.SentAt;
    if (thread.Status === "Open") thread.Status = "In Progress";
    return clone(message);
  },
  async setStatus(threadId: string, status: SupportThreadStatus): Promise<SupportThread> {
    await latency(320);
    const thread = store.threads.find((t) => t.id === threadId);
    if (!thread) throw new ApiError("This support thread could not be found.", 404);
    thread.Status = status;
    return clone(thread);
  },
};

export interface DashboardSummary {
  totalDevices: number;
  activeDevices: number;
  deviceTypes: number;
  installers: number;
  activeRelationships: number;
  openSupportThreads: number;
  pendingNotifications: number;
  statusBreakdown: { status: string; count: number }[];
  recentRegistrations: { serial: string; name: string; at: string }[];
  recentClaims: { serial: string; user: string; at: string }[];
  recentRelationshipChanges: { serial: string; user: string; linkType: string; action: string; at: string }[];
}

export const dashboardService = {
  async summary(): Promise<DashboardSummary> {
    await latency(320);
    const nameOf = (id: string) => {
      const u = store.users.find((x) => x.id === id);
      return u ? `${u.FirstName} ${u.LastName}` : "Unknown user";
    };
    const statusBreakdown = Object.entries(
      store.devices.reduce<Record<string, number>>((acc, d) => {
        acc[d.DeviceStatus] = (acc[d.DeviceStatus] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([status, count]) => ({ status, count }));

    return {
      totalDevices: store.devices.length,
      activeDevices: store.devices.filter((d) => d.DeviceStatus === "Active").length,
      deviceTypes: store.deviceTypes.filter((t) => t.Active).length,
      installers: store.users.filter((u) => u.UserRole === "Installer").length,
      activeRelationships: store.links.filter((l) => l.Active).length,
      openSupportThreads: store.threads.filter((t) => t.Status === "Open" || t.Status === "In Progress").length,
      pendingNotifications: store.userNotifications.filter((n) => !n.IsRead).length,
      statusBreakdown,
      recentRegistrations: store.devices
        .filter((d) => d.RegisteredAt)
        .sort((a, b) => (b.RegisteredAt ?? "").localeCompare(a.RegisteredAt ?? ""))
        .slice(0, 5)
        .map((d) => ({ serial: d.SerialNumber, name: d.DeviceName, at: d.RegisteredAt! })),
      recentClaims: store.links
        .filter((l) => l.LinkType === "Owner")
        .sort((a, b) => b.GrantedAt.localeCompare(a.GrantedAt))
        .slice(0, 5)
        .map((l) => ({ serial: l.DeviceSerialNumber, user: nameOf(l.AppUserId), at: l.GrantedAt })),
      recentRelationshipChanges: store.links
        .slice()
        .sort((a, b) => (b.RevokedAt ?? b.GrantedAt).localeCompare(a.RevokedAt ?? a.GrantedAt))
        .slice(0, 6)
        .map((l) => ({
          serial: l.DeviceSerialNumber,
          user: nameOf(l.AppUserId),
          linkType: l.LinkType,
          action: l.Active ? "Granted" : "Revoked",
          at: l.RevokedAt ?? l.GrantedAt,
        })),
    };
  },
};
