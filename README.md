# Manufacturer Panel

PROJECT SPECIFICATION

Manufacturer Panel, Web Frontend for the GSM Systems BLE Device Configuration Ecosystem

Build a premium, modern, production quality web application called Manufacturer Panel. Use this name consistently everywhere in the UI, navigation, and headings. Never call it Admin Panel, Super Admin Panel, or a generic Dashboard.

This is the web control layer of the same system that powers a companion Flutter mobile application. It is not a standalone product. It manages the authoritative server side data (AppUsers, Devices, Device Types, BLE Profiles, device relationships, notifications, support messages) that the mobile app later synchronizes into its own local cache. The backend REST API and MySQL database are authoritative; nothing in this panel should behave as though it owns data independently of that backend.

0. Scope Reconciliation, Read Before Building Anything

Earlier drafts of the underlying database specification included several subsystems that were later explicitly removed from the finalized project scope during client discussion. Build only what is listed in this prompt. Specifically:

No dynamic parameter/protocol dictionary editor. The mobile app uses a fixed, agreed BLE communication protocol for this version, not a database driven dynamic parameter system. Do not build screens for creating, editing, or reordering ParameterDefinition, ParameterEnumOption, or DeviceTypeParameter records. These stay behind the API layer, unused by any UI in this version.

No BLE profile version history or multiple profile version management. Each Device Type has exactly one active BLE profile (service UUID, TX/RX characteristic UUIDs, published name, timeouts). Build a simple single profile editor per Device Type. Do not build a profile version list, version comparison, or "add new profile version" flow.

No support queue automation or rule based routing. Support is a simple V1 flow: a list of support threads, each with a message history, that a Manufacturer can view and reply to. Do not build SupportQueue, SupportQueueMember, routing rules, routing conditions, routing actions, or routing logs. These were explicitly deferred.

Everything else described below is in scope.

Do not add anything not described in this prompt: no billing, payments, subscriptions, CRM, marketing tools, analytics beyond the KPIs listed in Section 4, inventory beyond the Device model, chatbots, AI features, workflow builders, generic rule engines, advanced reporting/export systems, invitation systems, firmware update management, or remote BLE control from the web. If a screenshot, prior draft, or database table suggests something outside this list, do not build it. Leave the corresponding API call behind a service interface, unused, rather than guessing at a UI for it.

1. Product Identity and Design Direction

Visual direction: sophisticated, minimal, technical, premium, clean, trustworthy, enterprise grade industrial IoT control center. Avoid a generic Bootstrap admin look, excessive gradients, excessive rounded corners, cartoon icons, oversized headings, clutter, heavy shadows, or unnecessary animation. The panel should communicate precision, reliability, security, and operational control, the same visual language a premium telemetry/IoT fleet management product would use.

Layout: desktop first enterprise layout. Persistent left sidebar for navigation with icons and labels. Top header/bar for search, account menu, and notifications. Main content area center. Contextual drawers on the right for quick inspection (see Section 11). Support responsive behavior down to tablet width without ever trying to look like a mobile app inside a browser.

2. Core Data Model, Match Terminology Exactly

Use these entity names consistently in code, types, and (in a user friendly form) in the UI labels. Do not rename concepts into different business language.

AppUser: FirstName, LastName, Email, MobileNumber, UserRole (Manufacturer, Installer, DeviceUser), AccountStatus (Pending, Active, Suspended, Disabled), EmailVerified, MobileVerified, LastLoginAt, CreatedAt, UpdatedAt.

DeviceUserLink: Device, AppUser, LinkType (Manufacturer, Installer, Owner, Shared), CanView, CanConfigure, CanControl, CanShare, Active, GrantedByUserId, GrantedAt, RevokedAt.

DeviceType: TypeCode, TypeName, Description, ManufacturerName, DeviceCategory (Telemetry, UtilityMonitoring, WaterProtection, LPGMonitoring, AccessControl, TemperatureMonitoring, Other), HardwareVersion, ClaimAllowed, RssiConnectMinimum, Active.

BleProfile (single active profile per Device Type): ProfileName, PublishedName, PublishedNamePrefix, ServiceUuid, TxCharacteristicUuid, RxCharacteristicUuid, RxUsesNotification, WriteWithResponse, MaximumPacketSize, ConnectionTimeoutMs, CommandTimeoutMs, IdleDisconnectMs, SerialReadRequired, Active.

Device: SerialNumber (the one authoritative physical identity, never BLE name, MAC address, or iOS identifier), DeviceType, BleProfile, DeviceName, FirmwareVersion, HardwareVersion, ManufacturedAt, RegisteredAt, RegisteredByUserId, DeviceStatus (Manufactured, Registered, Claimed, Active, Suspended, Decommissioned), LastKnownBleName (diagnostic only), LastKnownAndroidMac (diagnostic only), QrCodeValue, LastBleConnectionAt, LastServerContactAt, Active.

Notification / UserNotification / PushNotificationDelivery: Notification content and type, per recipient read state, per installation delivery state (Queued, Sending, Sent, Delivered, Failed, Invalid Token, Expired). Keep delivery status and read status visually and conceptually separate.

SupportThread / SupportMessage: simple thread with subject, status (Open, In Progress, Resolved, Closed), opened by user, optional linked device, and a chronological message list.

3. Roles, Never Confuse These Two Layers

Global AppUser role (one of): Manufacturer, Installer, DeviceUser. This is who the person is in the system.

Device level relationship (per device, independent of global role): Manufacturer, Installer, Owner, Shared, carried on DeviceUserLink with CanView, CanConfigure, CanControl, CanShare flags. This is what the person can do on one specific device.

A user can be Owner of one device and Installer on another simultaneously. Never present these two concepts as the same thing anywhere in the UI. Authorization rules to respect visually and in confirmation flows: maximum one active Owner per device, multiple Shared/Installer/Manufacturer links can coexist, a Manufacturer manages Installer links, and claiming only creates an Owner link when no active Owner currently exists and the Device Type allows claiming. The backend enforces these rules; the panel must never present an action that would visibly contradict them (for example, offering to add a second Owner to a device that already has one).

4. Dashboard

A premium operational overview using only real, defined data. KPI cards: Total Devices, Active Devices, Device Types, Installers, Active Device Relationships, Open Support Threads, Unread/Pending Notifications. Below the KPI row, a recent activity summary (recent device registrations, recent claims, recent relationship changes) and a support/notification snapshot. Do not invent metrics that have no backing entity. Use charts only where they communicate something meaningful, for example a simple device status breakdown, not decorative charts.

5. Devices

List

Enterprise data table with search (by serial, name, type), filters (Device Type, Status, Active/Inactive), sorting, pagination, sticky header, row hover, status badges, device type badges, and a row action menu. Loading, empty, and error states required. Clicking a row opens the Device Detail page or a quick inspection drawer (see Section 11).

Detail

Header with Serial Number (primary identity), Device Name, Device Type, Status badge. Sections for: hardware/firmware information (Firmware Version, Hardware Version, Manufactured At, Registered At), BLE Profile summary (read only reference to the Device Type's single active profile), device relationships (a table of every DeviceUserLink for this device with relationship badge, permission flags, active/revoked state, granted date), and recent activity where the underlying data actually exists (last BLE connection, last server contact). Do not build a configuration value editor here, live device configuration happens through BLE on the mobile app, not through this panel.

Deactivate rather than delete devices, matching the "preserve history" principle of the underlying data model.

6. Device Types

List and detail/edit screens using exactly: Type Code, Type Name, Description, Manufacturer Name, Device Category (the seven defined categories only, do not invent additional categories), Hardware Version, Claim Allowed (toggle), RSSI Connect Minimum (numeric, dBm), Active (toggle, deactivate rather than delete). Each Device Type detail page also shows and allows editing its single BLE Profile (Section 7) inline or in an adjacent tab, and a read only summary of devices of that type.

7. BLE Profile (Per Device Type, Single Profile Only)

A simple editor attached to each Device Type: Profile Name, Published Name, Published Name Prefix, Service UUID, TX Characteristic UUID, RX Characteristic UUID, RX Uses Notification (toggle), Write With Response (toggle), Maximum Packet Size, Connection Timeout (ms), Command Timeout (ms), Idle Disconnect (ms), Serial Read Required (toggle), Active. No version list, no history, no "create new version" action, exactly matching Section 0's exclusion.

8. Device Relationships (DeviceUserLink)

The most important management surface. Present relationships in the context of either a Device (Section 5 detail page) or a User (Section 10 detail page), plus a dedicated Relationships area for direct management. Show relationship badges (Manufacturer, Installer, Owner, Shared) and the four permission flags (View, Configure, Control, Share) clearly, for example as a small permission matrix or icon row, not a raw boolean table. Granting or revoking access requires a confirmation dialog with specific wording, for example: "Revoke installer access? Are you sure you want to revoke this Installer's access to this device?" Never revoke silently. Show Active/Revoked state and the relevant Granted At/Revoked At timestamps.

9. Installer Management

A dedicated Installers list (AppUsers with Installer relationships) showing installer account status, and for each installer, the devices they currently have access to. Support assigning an installer to a device and revoking that access, using the same confirmation pattern as Section 8. Do not build anything here beyond viewing and managing these relationships.

10. Users

List of AppUsers with First Name, Last Name, Email, Mobile Number, User Role, Account Status, Email Verified, Mobile Verified, Last Login, Created At. Filters for Role and Account Status. Detail page per user showing identity, contact info, global role, account status, verification state, and every device relationship that user holds (reusing the relationship display from Section 8). Support the four account statuses (Pending, Active, Suspended, Disabled) with clear visual treatment, a Suspended or Disabled account must never be visually presented as equivalent to Active.

11. Interaction Patterns

Use right side drawers for quick inspection from a table row (device quick view, installer quick view, relationship quick view) rather than always navigating away. Use dedicated full pages or large modal/drawer forms for actual editing. Use tabs where a detail page has multiple logical sections (for example Device Type detail: Overview / BLE Profile / Devices). Smooth, subtle transitions only, never decorative animation that slows down the workflow.

12. Notifications

A Notifications area showing Notification content, recipient, per user read/unread state, and per installation delivery status (Queued, Sending, Sent, Delivered, Failed, Invalid Token, Expired). Keep read state and delivery state visually distinct, they are not the same thing. Read only is acceptable for this version unless a "send notification" composer is clearly supported by the entity model, in which case build a simple composer (recipient, title, message) that creates a Notification record through the API.

13. Support / Messaging

A simple, professional support inbox: list of SupportThreads with subject, status, opener, optional linked device, and last message time. Opening a thread shows the full message history and a reply box for the Manufacturer to respond. No queues, no routing, no automatic assignment, matching Section 0.

14. Authentication and Account Status

Login, session handling, logout, and the same account status handling as Section 10 (Pending/Active/Suspended/Disabled), using only the authentication approach already defined for this system (email/mobile plus password, with verification state). Do not invent SSO, social login, or biometric authentication for this web panel.

15. Design System and Reusable Components

Build one centralized design system: colors, typography, spacing, radius, shadows, icon set, and consistent styles for buttons, inputs, selects, tables, cards, badges, tabs, modals, drawers, toasts, and tooltips. Every screen uses this system, no screen is styled independently.

Build these reusable components, and only these, avoid over engineering: AppShell, Sidebar, TopBar, PageHeader, Breadcrumbs, StatCard, DataTable, TableToolbar, SearchInput, FilterDropdown, StatusBadge, RoleBadge, PermissionBadge, DeviceTypeBadge, EmptyState, LoadingState, ErrorState, ConfirmationDialog, FormModal, SideDrawer, UserAvatar, UserCard, DeviceCard, DeviceStatus, PermissionMatrix, RelationshipCard, NotificationItem, MessageThread, BleProfileEditor, Toast, Tooltip.

One shared DataTable component powers every list screen (Devices, Device Types, Installers, Users, Notifications, Support Threads), do not build separate table implementations per page.

16. Frontend Architecture

Separate cleanly: pages, components, layouts, data models/types (matching Section 2's entity names), an API service layer, a repository/data layer, authentication, centralized authorization, state management, validation, and utilities. Never call the API directly from inside a UI component, always go through the service/repository layer. Where the real backend is not yet available, use structured mock data behind the exact same service interfaces, never scattered inline mock objects, so real API integration later requires no UI changes.

17. Security UX

Respect role based and device level authorization in the UI (hide/disable actions the current Manufacturer cannot perform), but treat this as a convenience layer only, never the actual security boundary, the backend remains authoritative. Require confirmation dialogs for any destructive or authorization changing action (revoke access, deactivate a device or device type). Mask sensitive values wherever they could appear (do not display secrets unnecessarily, prefer write only fields where the underlying data is sensitive). Never expose authentication tokens, raw API errors, stack traces, or internal database identifiers in the UI. Handle expired sessions and unauthorized/forbidden API responses gracefully with clear messaging and a path back to login.

18. Error Handling and States

Every important action needs Loading, Success, and Error states using consistent toast/dialog styling. Example copy: Success: "Installer access granted successfully." Error: "Unable to update installer access. Please try again." Validation: "Please enter a valid device serial number." Authorization: "You do not have permission to perform this action."

Every major page needs Loading, Empty, Error, Unauthorized, and No Search Results states, never a blank page.

19. Forms and Validation

All forms need required field validation, format validation (email, mobile number, RSSI numeric range, UUID format for BLE profile fields), field level error messages, a disabled submit state until valid, and clear loading/success/error feedback. Never allow invalid data to reach the API from the UI.

20. Responsive Behavior

Primary target is desktop (1920px, 1440px, 1280px, 1024px) with the sidebar/topbar/content layout fully usable at each width. Support tablet width gracefully. Tables should remain usable without unnecessary horizontal overflow. This is an enterprise web control panel, not a mobile app rendered in a browser.

21. Execution Order

Work in this order. After each step, verify you have not introduced anything outside this prompt before continuing.

Analyze the existing repository/codebase if any.

Establish application architecture (Section 16).

Establish the design system (Section 15).

Build the global shell: Sidebar, TopBar, routing.

Build Authentication (Section 14).

Build the Dashboard (Section 4).

Build Devices list and detail (Section 5).

Build Device Types and the attached BLE Profile editor (Sections 6 and 7).

Build Device Relationships management (Section 8).

Build Installer management (Section 9).

Build Users list and detail (Section 10).

Build Notifications (Section 12).

Build Support/Messaging (Section 13).

Add centralized authorization checks across every screen (Section 17).

Add validation across every form (Section 19).

Add loading/empty/error states everywhere (Section 18).

Responsive pass (Section 20).

Full UI consistency pass against the design system (Section 15).

Final scope audit (Section 22).

22. Final Scope Audit

Before considering this complete, verify:

Every section in this prompt has a corresponding built screen or component.

No dynamic parameter/protocol dictionary editor exists anywhere.

No BLE profile version history or multi version management exists anywhere.

No support queue, routing rule, or routing automation exists anywhere.

No feature from the excluded list in Section 0's opening paragraph was introduced.

Global AppUser role and device level relationship are never visually or conceptually merged.

Device Serial Number is treated as the only authoritative device identity everywhere it appears.

Sensitive fields are masked wherever they could appear.

Every table uses the shared DataTable component, no duplicated table implementations.

Every screen has Loading, Empty, and Error states.

The API/service layer is the only place UI components touch data, no direct calls from components.


CREATE if faster and also cover everything and complete everything

This project was built with []().

## Build with 

Continue developing this project in the [ editor]().

- **Ship faster**: describe what you want to build and  handles the code.
- **Stay in sync**: every change made in  is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into , ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
