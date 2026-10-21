// Domain entity types: names mirror the authoritative backend schema exactly.

export type AccountStatus = "Pending" | "Active" | "Suspended" | "Disabled";

export type GlobalRole = "Manufacturer" | "Installer";

export interface AppUser {
  id: string;
  /** AppId shown in the app and used to share a device, e.g. APP-001247. */
  AppId: string;
  FirstName: string;
  LastName: string;
  Email: string;
  MobileNumber: string;
  CompanyName: string;
  /** Global roles assigned by a Manufacturer (supports multiple). */
  globalRoles: GlobalRole[];
  IsManufacturer: boolean;
  IsInstaller: boolean;
  /** Manufacturer rights: receive new support messages as notifications. */
  SupportNotificationsOptIn: boolean;
  AccountStatus: AccountStatus;
  EmailVerified: boolean;
  MobileVerified: boolean;
  LastLoginAt: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export type LinkType = "Manufacturer" | "Installer" | "Owner" | "Shared";

export interface DeviceUserLink {
  id: string;
  DeviceSerialNumber: string;
  AppUserId: string;
  LinkType: LinkType;
  CanView: boolean;
  CanConfigure: boolean;
  CanControl: boolean;
  CanShare: boolean;
  Active: boolean;
  GrantedByUserId: string;
  GrantedAt: string;
  RevokedAt: string | null;
}

export type DeviceCategory =
  | "Telemetry"
  | "UtilityMonitoring"
  | "WaterProtection"
  | "LPGMonitoring"
  | "AccessControl"
  | "TemperatureMonitoring"
  | "Other";

export const DEVICE_CATEGORIES: DeviceCategory[] = [
  "Telemetry",
  "UtilityMonitoring",
  "WaterProtection",
  "LPGMonitoring",
  "AccessControl",
  "TemperatureMonitoring",
  "Other",
];

export interface DeviceType {
  id: string;
  TypeCode: string;
  TypeName: string;
  Description: string;
  ManufacturerName: string;
  DeviceCategory: DeviceCategory;
  HardwareVersion: string;
  /** Prefix in front of the serial on the device QR (e.g. "DK"); empty when none. */
  QrSerialPrefix: string;
  RssiConnectMinimum: number;
  Active: boolean;
}

export interface BleProfile {
  id: string;
  DeviceTypeId: string;
  ProfileName: string;
  PublishedName: string;
  PublishedNamePrefix: string;
  ServiceUuid: string;
  TxCharacteristicUuid: string;
  RxCharacteristicUuid: string;
  RxUsesNotification: boolean;
  WriteWithResponse: boolean;
  MaximumPacketSize: number;
  ConnectionTimeoutMs: number;
  CommandTimeoutMs: number;
  IdleDisconnectMs: number;
  SerialReadRequired: boolean;
  Active: boolean;
}

export type DeviceStatus =
  | "Manufactured"
  | "Registered"
  | "Claimed"
  | "Released"
  | "Suspended"
  | "Decommissioned";

export const DEVICE_STATUSES: DeviceStatus[] = [
  "Manufactured",
  "Registered",
  "Claimed",
  "Released",
  "Suspended",
  "Decommissioned",
];

export interface Device {
  SerialNumber: string;
  DeviceTypeId: string;
  BleProfileId: string;
  DeviceName: string;
  FirmwareVersion: string;
  HardwareVersion: string;
  ManufacturedAt: string;
  RegisteredAt: string | null;
  RegisteredByUserId: string | null;
  DeviceStatus: DeviceStatus;
  LastKnownBleName: string | null;
  LastKnownAndroidMac: string | null;
  LastKnownLatitude: number | string | null;
  LastKnownLongitude: number | string | null;
  LastGpsCapturedAt: string | null;
  QrCodeValue: string;
  LastBleConnectionAt: string | null;
  LastServerContactAt: string | null;
  Active: boolean;
  /** Has an active Owner relationship. */
  IsClaimed: boolean;
}

export type DeliveryStatus =
  | "Queued"
  | "Sending"
  | "Sent"
  | "Delivered"
  | "Failed"
  | "Invalid Token"
  | "Expired";

export type NotificationType =
  | "General"
  | "DeviceStatus"
  | "DeviceAlarm"
  | "Configuration"
  | "Authorization"
  | "DeviceShared"
  | "SupportMessage"
  | "SupportStatus"
  | "Security"
  | "System";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "General",
  "DeviceStatus",
  "DeviceAlarm",
  "Configuration",
  "Authorization",
  "DeviceShared",
  "SupportMessage",
  "SupportStatus",
  "Security",
  "System",
];

export type NotificationPriority = "Low" | "Normal" | "High" | "Critical";

export const NOTIFICATION_PRIORITIES: NotificationPriority[] = [
  "Low",
  "Normal",
  "High",
  "Critical",
];

export type NotificationActionType =
  | "None"
  | "OpenDevice"
  | "OpenConfiguration"
  | "OpenSupportThread"
  | "OpenMessages"
  | "OpenUrl";

export const NOTIFICATION_ACTION_TYPES: NotificationActionType[] = [
  "None",
  "OpenDevice",
  "OpenConfiguration",
  "OpenSupportThread",
  "OpenMessages",
  "OpenUrl",
];

export interface Notification {
  id: string;
  Title: string;
  Body: string;
  NotificationType: NotificationType;
  Priority: NotificationPriority;
  ActionType: NotificationActionType;
  ActionValue: string | null;
  CreatedAt: string;
  /** Set when the notification is about a device. */
  DeviceSerialNumber?: string | null | undefined;
  /** Name of the Manufacturer who sent it. */
  SentBy?: string | null | undefined;
}

export interface UserNotification {
  id: string;
  NotificationId: string;
  RecipientUserId: string;
  IsRead: boolean;
  ReadAt: string | null;
}

export interface PushNotificationDelivery {
  id: string;
  UserNotificationId: string;
  InstallationLabel: string;
  DeliveryStatus: DeliveryStatus;
  UpdatedAt: string;
}

export type SupportThreadStatus = "Open" | "In Progress" | "Resolved" | "Closed";

export interface SupportThread {
  id: string;
  Subject: string;
  Status: SupportThreadStatus;
  OpenedByUserId: string;
  LinkedDeviceSerialNumber: string | null;
  CreatedAt: string;
  LastMessageAt: string;
}

export interface SupportMessage {
  id: string;
  ThreadId: string;
  AuthorUserId: string;
  Body: string;
  SentAt: string;
}

export interface Session {
  user: AppUser;
  issuedAt: string;
}
