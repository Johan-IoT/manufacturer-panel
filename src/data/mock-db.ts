// Structured mock dataset standing in for the authoritative backend.
// Only the service layer reads this module — never UI components.

import type {
  AppUser,
  BleProfile,
  Device,
  DeviceType,
  DeviceUserLink,
  Notification,
  PushNotificationDelivery,
  SupportMessage,
  SupportThread,
  UserNotification,
} from "@/types/entities";

const iso = (daysAgo: number, hour = 9) => {
  const d = new Date(Date.UTC(2026, 6, 28, hour, 15, 0));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};

export const users: AppUser[] = [
  {
    id: "u-001",
    FirstName: "Aparna",
    LastName: "Rao",
    Email: "aparna.rao@gsmsystems.io",
    MobileNumber: "+91 98450 11223",
    UserRole: "Manufacturer",
    AccountStatus: "Active",
    EmailVerified: true,
    MobileVerified: true,
    LastLoginAt: iso(0, 7),
    CreatedAt: iso(420),
    UpdatedAt: iso(2),
  },
  {
    id: "u-002",
    FirstName: "Daniel",
    LastName: "Okafor",
    Email: "d.okafor@fieldops.example",
    MobileNumber: "+44 7700 900321",
    UserRole: "Installer",
    AccountStatus: "Active",
    EmailVerified: true,
    MobileVerified: true,
    LastLoginAt: iso(1, 11),
    CreatedAt: iso(240),
    UpdatedAt: iso(6),
  },
  {
    id: "u-003",
    FirstName: "Meera",
    LastName: "Iyer",
    Email: "meera.iyer@fieldops.example",
    MobileNumber: "+91 99001 44556",
    UserRole: "Installer",
    AccountStatus: "Active",
    EmailVerified: true,
    MobileVerified: false,
    LastLoginAt: iso(3, 15),
    CreatedAt: iso(180),
    UpdatedAt: iso(9),
  },
  {
    id: "u-004",
    FirstName: "Tomás",
    LastName: "Ferreira",
    Email: "tomas.ferreira@fieldops.example",
    MobileNumber: "+351 912 445 118",
    UserRole: "Installer",
    AccountStatus: "Suspended",
    EmailVerified: true,
    MobileVerified: true,
    LastLoginAt: iso(31, 8),
    CreatedAt: iso(300),
    UpdatedAt: iso(20),
  },
  {
    id: "u-005",
    FirstName: "Hana",
    LastName: "Yildiz",
    Email: "hana.yildiz@example.com",
    MobileNumber: "+90 532 118 4477",
    UserRole: "DeviceUser",
    AccountStatus: "Active",
    EmailVerified: true,
    MobileVerified: true,
    LastLoginAt: iso(2, 19),
    CreatedAt: iso(120),
    UpdatedAt: iso(4),
  },
  {
    id: "u-006",
    FirstName: "Peter",
    LastName: "Lindqvist",
    Email: "p.lindqvist@example.com",
    MobileNumber: "+46 70 918 2244",
    UserRole: "DeviceUser",
    AccountStatus: "Pending",
    EmailVerified: false,
    MobileVerified: false,
    LastLoginAt: null,
    CreatedAt: iso(5),
    UpdatedAt: iso(5),
  },
  {
    id: "u-007",
    FirstName: "Salma",
    LastName: "Haddad",
    Email: "salma.haddad@example.com",
    MobileNumber: "+971 50 774 3390",
    UserRole: "DeviceUser",
    AccountStatus: "Active",
    EmailVerified: true,
    MobileVerified: true,
    LastLoginAt: iso(8, 13),
    CreatedAt: iso(96),
    UpdatedAt: iso(8),
  },
  {
    id: "u-008",
    FirstName: "Grant",
    LastName: "Wills",
    Email: "grant.wills@example.com",
    MobileNumber: "+1 415 555 0182",
    UserRole: "DeviceUser",
    AccountStatus: "Disabled",
    EmailVerified: true,
    MobileVerified: false,
    LastLoginAt: iso(64, 10),
    CreatedAt: iso(210),
    UpdatedAt: iso(40),
  },
];

export const deviceTypes: DeviceType[] = [
  {
    id: "dt-001",
    TypeCode: "GSM-TLM-100",
    TypeName: "Telemetry Gateway 100",
    Description: "Multi-channel BLE telemetry gateway for industrial sites.",
    ManufacturerName: "GSM Systems",
    DeviceCategory: "Telemetry",
    HardwareVersion: "HW-1.4",
    ClaimAllowed: true,
    RssiConnectMinimum: -82,
    Active: true,
  },
  {
    id: "dt-002",
    TypeCode: "GSM-UTM-220",
    TypeName: "Utility Meter Bridge 220",
    Description: "Pulse and Modbus utility meter bridge with BLE provisioning.",
    ManufacturerName: "GSM Systems",
    DeviceCategory: "UtilityMonitoring",
    HardwareVersion: "HW-2.1",
    ClaimAllowed: true,
    RssiConnectMinimum: -78,
    Active: true,
  },
  {
    id: "dt-003",
    TypeCode: "GSM-WPR-310",
    TypeName: "Water Protection Node 310",
    Description: "Leak detection and shut-off valve controller.",
    ManufacturerName: "GSM Systems",
    DeviceCategory: "WaterProtection",
    HardwareVersion: "HW-3.0",
    ClaimAllowed: false,
    RssiConnectMinimum: -75,
    Active: true,
  },
  {
    id: "dt-004",
    TypeCode: "GSM-LPG-410",
    TypeName: "LPG Monitor 410",
    Description: "LPG level and leak monitoring unit for commercial tanks.",
    ManufacturerName: "GSM Systems",
    DeviceCategory: "LPGMonitoring",
    HardwareVersion: "HW-1.1",
    ClaimAllowed: true,
    RssiConnectMinimum: -80,
    Active: true,
  },
  {
    id: "dt-005",
    TypeCode: "GSM-ACS-520",
    TypeName: "Access Controller 520",
    Description: "BLE access control head unit for restricted enclosures.",
    ManufacturerName: "GSM Systems",
    DeviceCategory: "AccessControl",
    HardwareVersion: "HW-0.9",
    ClaimAllowed: false,
    RssiConnectMinimum: -70,
    Active: false,
  },
  {
    id: "dt-006",
    TypeCode: "GSM-TMP-610",
    TypeName: "Cold Chain Probe 610",
    Description: "Temperature monitoring probe for cold chain assets.",
    ManufacturerName: "GSM Systems",
    DeviceCategory: "TemperatureMonitoring",
    HardwareVersion: "HW-1.2",
    ClaimAllowed: true,
    RssiConnectMinimum: -85,
    Active: true,
  },
];

export const bleProfiles: BleProfile[] = deviceTypes.map((t, i) => ({
  id: `bp-00${i + 1}`,
  DeviceTypeId: t.id,
  ProfileName: `${t.TypeCode} Standard Profile`,
  PublishedName: `${t.TypeCode}`,
  PublishedNamePrefix: t.TypeCode.split("-")[1] ?? "GSM",
  ServiceUuid: `0000fe${40 + i}-0000-1000-8000-00805f9b34fb`,
  TxCharacteristicUuid: `0000ff${10 + i}-0000-1000-8000-00805f9b34fb`,
  RxCharacteristicUuid: `0000ff${20 + i}-0000-1000-8000-00805f9b34fb`,
  RxUsesNotification: true,
  WriteWithResponse: i % 2 === 0,
  MaximumPacketSize: 180 + i * 8,
  ConnectionTimeoutMs: 10000,
  CommandTimeoutMs: 4000,
  IdleDisconnectMs: 60000,
  SerialReadRequired: true,
  Active: t.Active,
}));

const statuses: Device["DeviceStatus"][] = [
  "Active",
  "Claimed",
  "Registered",
  "Manufactured",
  "Active",
  "Suspended",
  "Active",
  "Decommissioned",
];

export const devices: Device[] = Array.from({ length: 28 }, (_, i) => {
  const type = deviceTypes[i % deviceTypes.length];
  const profile = bleProfiles.find((p) => p.DeviceTypeId === type.id)!;
  const status = statuses[i % statuses.length];
  const serial = `GSM-${type.TypeCode.split("-")[1]}-${String(100241 + i * 7)}`;
  return {
    SerialNumber: serial,
    DeviceTypeId: type.id,
    BleProfileId: profile.id,
    DeviceName: `${type.TypeName.split(" ")[0]} Unit ${String(i + 1).padStart(2, "0")}`,
    FirmwareVersion: `FW-${2 + (i % 3)}.${i % 10}.${(i * 3) % 7}`,
    HardwareVersion: type.HardwareVersion,
    ManufacturedAt: iso(200 - i * 4),
    RegisteredAt: status === "Manufactured" ? null : iso(150 - i * 4),
    RegisteredByUserId: status === "Manufactured" ? null : "u-001",
    DeviceStatus: status,
    LastKnownBleName: `${profile.PublishedNamePrefix}-${serial.slice(-4)}`,
    LastKnownAndroidMac: `C4:2F:${(10 + i).toString(16).padStart(2, "0")}:9A:${(30 + i).toString(16)}:B1`.toUpperCase(),
    QrCodeValue: `gsm://d/${serial}`,
    LastBleConnectionAt: status === "Manufactured" ? null : iso(i % 14, 12),
    LastServerContactAt: status === "Manufactured" ? null : iso(i % 9, 16),
    Active: status !== "Decommissioned",
  };
});

const linkOf = (
  id: string,
  serial: string,
  userId: string,
  LinkType: DeviceUserLink["LinkType"],
  active = true,
  daysAgo = 40,
): DeviceUserLink => ({
  id,
  DeviceSerialNumber: serial,
  AppUserId: userId,
  LinkType,
  CanView: true,
  CanConfigure: LinkType !== "Shared",
  CanControl: LinkType === "Owner" || LinkType === "Manufacturer" || LinkType === "Installer",
  CanShare: LinkType === "Owner" || LinkType === "Manufacturer",
  Active: active,
  GrantedByUserId: "u-001",
  GrantedAt: iso(daysAgo),
  RevokedAt: active ? null : iso(Math.max(1, daysAgo - 20)),
});

export const deviceUserLinks: DeviceUserLink[] = devices.flatMap((d, i) => {
  const rows: DeviceUserLink[] = [linkOf(`l-${i}-m`, d.SerialNumber, "u-001", "Manufacturer", true, 120 - i)];
  if (d.DeviceStatus !== "Manufactured") {
    const installer = ["u-002", "u-003", "u-004"][i % 3];
    rows.push(linkOf(`l-${i}-i`, d.SerialNumber, installer, "Installer", i % 7 !== 3, 90 - i));
  }
  if (["Claimed", "Active", "Suspended"].includes(d.DeviceStatus)) {
    const owner = ["u-005", "u-007", "u-008"][i % 3];
    rows.push(linkOf(`l-${i}-o`, d.SerialNumber, owner, "Owner", true, 60 - (i % 40)));
    if (i % 4 === 0) rows.push(linkOf(`l-${i}-s`, d.SerialNumber, "u-006", "Shared", true, 20));
  }
  return rows;
});

export const notifications: Notification[] = [
  {
    id: "n-001",
    Title: "Firmware advisory FW-2.4.1",
    Body: "A firmware advisory has been published for Telemetry Gateway 100 units.",
    NotificationType: "System",
    CreatedAt: iso(1, 9),
  },
  {
    id: "n-002",
    Title: "Device offline for 72 hours",
    Body: "Water Protection Node 310 has not contacted the server for 72 hours.",
    NotificationType: "DeviceAlert",
    CreatedAt: iso(3, 14),
  },
  {
    id: "n-003",
    Title: "Installer access granted",
    Body: "You have been granted Installer access to 3 devices.",
    NotificationType: "Account",
    CreatedAt: iso(6, 10),
  },
  {
    id: "n-004",
    Title: "Support reply received",
    Body: "A manufacturer replied to your support thread.",
    NotificationType: "Support",
    CreatedAt: iso(8, 18),
  },
];

export const userNotifications: UserNotification[] = [
  { id: "un-001", NotificationId: "n-001", RecipientUserId: "u-002", IsRead: false, ReadAt: null },
  { id: "un-002", NotificationId: "n-001", RecipientUserId: "u-003", IsRead: true, ReadAt: iso(1, 12) },
  { id: "un-003", NotificationId: "n-002", RecipientUserId: "u-005", IsRead: false, ReadAt: null },
  { id: "un-004", NotificationId: "n-003", RecipientUserId: "u-004", IsRead: true, ReadAt: iso(5, 9) },
  { id: "un-005", NotificationId: "n-004", RecipientUserId: "u-007", IsRead: false, ReadAt: null },
  { id: "un-006", NotificationId: "n-002", RecipientUserId: "u-002", IsRead: true, ReadAt: iso(2, 8) },
];

export const pushDeliveries: PushNotificationDelivery[] = [
  { id: "pd-1", UserNotificationId: "un-001", InstallationLabel: "Android · Pixel 8", DeliveryStatus: "Delivered", UpdatedAt: iso(1, 9) },
  { id: "pd-2", UserNotificationId: "un-002", InstallationLabel: "iOS · iPhone 15", DeliveryStatus: "Sent", UpdatedAt: iso(1, 9) },
  { id: "pd-3", UserNotificationId: "un-003", InstallationLabel: "Android · Galaxy S23", DeliveryStatus: "Failed", UpdatedAt: iso(3, 14) },
  { id: "pd-4", UserNotificationId: "un-004", InstallationLabel: "iOS · iPad Air", DeliveryStatus: "Invalid Token", UpdatedAt: iso(5, 9) },
  { id: "pd-5", UserNotificationId: "un-005", InstallationLabel: "Android · Nothing 2a", DeliveryStatus: "Queued", UpdatedAt: iso(8, 18) },
  { id: "pd-6", UserNotificationId: "un-006", InstallationLabel: "iOS · iPhone 13", DeliveryStatus: "Expired", UpdatedAt: iso(2, 8) },
];

export const supportThreads: SupportThread[] = [
  {
    id: "st-001",
    Subject: "Gateway drops BLE link during configuration",
    Status: "Open",
    OpenedByUserId: "u-002",
    LinkedDeviceSerialNumber: devices[0].SerialNumber,
    CreatedAt: iso(4, 11),
    LastMessageAt: iso(1, 16),
  },
  {
    id: "st-002",
    Subject: "Cannot claim device — claim not allowed",
    Status: "In Progress",
    OpenedByUserId: "u-005",
    LinkedDeviceSerialNumber: devices[2].SerialNumber,
    CreatedAt: iso(9, 10),
    LastMessageAt: iso(2, 9),
  },
  {
    id: "st-003",
    Subject: "Request: transfer ownership of two units",
    Status: "Resolved",
    OpenedByUserId: "u-007",
    LinkedDeviceSerialNumber: null,
    CreatedAt: iso(20, 15),
    LastMessageAt: iso(14, 12),
  },
  {
    id: "st-004",
    Subject: "Installer account suspended unexpectedly",
    Status: "Closed",
    OpenedByUserId: "u-004",
    LinkedDeviceSerialNumber: null,
    CreatedAt: iso(35, 8),
    LastMessageAt: iso(30, 9),
  },
];

export const supportMessages: SupportMessage[] = [
  { id: "sm-1", ThreadId: "st-001", AuthorUserId: "u-002", Body: "The gateway disconnects roughly 20 seconds into configuration. RSSI is around -68 dBm.", SentAt: iso(4, 11) },
  { id: "sm-2", ThreadId: "st-001", AuthorUserId: "u-001", Body: "Thanks Daniel. Please confirm the firmware version on the unit and retry with the app in foreground.", SentAt: iso(3, 9) },
  { id: "sm-3", ThreadId: "st-001", AuthorUserId: "u-002", Body: "Firmware is FW-2.0.0. Same behaviour after retry.", SentAt: iso(1, 16) },
  { id: "sm-4", ThreadId: "st-002", AuthorUserId: "u-005", Body: "The app says claiming is not permitted for this device.", SentAt: iso(9, 10) },
  { id: "sm-5", ThreadId: "st-002", AuthorUserId: "u-001", Body: "That device type has Claim Allowed disabled. An installer must link the device for you.", SentAt: iso(2, 9) },
  { id: "sm-6", ThreadId: "st-003", AuthorUserId: "u-007", Body: "I sold two units and need ownership moved.", SentAt: iso(20, 15) },
  { id: "sm-7", ThreadId: "st-003", AuthorUserId: "u-001", Body: "Ownership links revoked and reissued. Closing as resolved.", SentAt: iso(14, 12) },
  { id: "sm-8", ThreadId: "st-004", AuthorUserId: "u-004", Body: "My installer account shows as suspended.", SentAt: iso(35, 8) },
  { id: "sm-9", ThreadId: "st-004", AuthorUserId: "u-001", Body: "Suspension was raised by compliance review. Closing this thread.", SentAt: iso(30, 9) },
];
