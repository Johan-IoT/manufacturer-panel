import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  NOTIFICATION_ACTION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
  type NotificationActionType,
  type NotificationPriority,
  type NotificationType,
} from "@/types/entities";

/** Title, Message, Notification Type, Priority and Action of a notification. */
export interface NotificationMessage {
  title: string;
  body: string;
  notificationType: NotificationType;
  priority: NotificationPriority;
  actionType: NotificationActionType;
  actionValue: string;
}

export const EMPTY_NOTIFICATION_MESSAGE: NotificationMessage = {
  title: "",
  body: "",
  notificationType: "General",
  priority: "Normal",
  actionType: "None",
  actionValue: "",
};

/** A message about a device opens that device in the app by default. */
export function deviceNotificationMessage(serialNumber: string): NotificationMessage {
  return {
    ...EMPTY_NOTIFICATION_MESSAGE,
    notificationType: "DeviceStatus",
    actionType: "OpenDevice",
    actionValue: serialNumber,
  };
}

const messageSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(120),
    body: z.string().trim().min(1, "Message is required.").max(1000),
    actionType: z.string(),
    actionValue: z.string().trim().max(500),
  })
  .superRefine((value, ctx) => {
    const needsValue = value.actionType !== "None" && value.actionType !== "OpenMessages";
    if (needsValue && !value.actionValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actionValue"],
        message: "Action value is required for the selected action.",
      });
    }
  });

export function isNotificationMessageValid(message: NotificationMessage): boolean {
  return messageSchema.safeParse(message).success;
}

/** The payload fields the send API expects for this message. */
export function notificationPayload(message: NotificationMessage) {
  return {
    title: message.title.trim(),
    body: message.body.trim(),
    notificationType: message.notificationType,
    priority: message.priority,
    actionType: message.actionType,
    actionValue: message.actionType === "None" ? null : message.actionValue.trim(),
  };
}

function actionValueHint(actionType: NotificationActionType): string {
  switch (actionType) {
    case "OpenDevice":
    case "OpenConfiguration":
      return "Enter device serial number.";
    case "OpenSupportThread":
      return "Enter support thread id.";
    case "OpenMessages":
      return "Optional. Leave blank or enter a message context.";
    case "OpenUrl":
      return "Enter full URL, for example https://example.com";
    default:
      return "Not required when action is None.";
  }
}

export function NotificationMessageFields({
  value,
  onChange,
  idPrefix = "n",
}: {
  value: NotificationMessage;
  onChange: (value: NotificationMessage) => void;
  idPrefix?: string | undefined;
}) {
  const set = <K extends keyof NotificationMessage>(key: K, next: NotificationMessage[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          className="bg-background"
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={120}
          placeholder="Short headline shown on the phone"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-body`}>Message</Label>
        <Textarea
          id={`${idPrefix}-body`}
          className="bg-background"
          rows={4}
          value={value.body}
          onChange={(e) => set("body", e.target.value)}
          maxLength={1000}
          placeholder="Full message"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-type`}>Notification type</Label>
          <Select
            value={value.notificationType}
            onValueChange={(v) => set("notificationType", v as NotificationType)}
          >
            <SelectTrigger id={`${idPrefix}-type`} className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-priority`}>Priority</Label>
          <Select
            value={value.priority}
            onValueChange={(v) => set("priority", v as NotificationPriority)}
          >
            <SelectTrigger id={`${idPrefix}-priority`} className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_PRIORITIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-action-type`}>Action type</Label>
          <Select
            value={value.actionType}
            onValueChange={(v) => {
              const next = v as NotificationActionType;
              onChange({
                ...value,
                actionType: next,
                actionValue: next === "None" ? "" : value.actionValue,
              });
            }}
          >
            <SelectTrigger id={`${idPrefix}-action-type`} className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_ACTION_TYPES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {value.actionType !== "None" && value.actionType !== "OpenMessages" && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-action-value`}>Action value</Label>
          <Input
            id={`${idPrefix}-action-value`}
            className="bg-background"
            value={value.actionValue}
            onChange={(e) => set("actionValue", e.target.value)}
            maxLength={500}
            placeholder={actionValueHint(value.actionType)}
          />
        </div>
      )}
    </div>
  );
}
