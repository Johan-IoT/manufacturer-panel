import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormModal } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { notificationService } from "@/services";
import { toUserMessage } from "@/services/client";
import {
  EMPTY_NOTIFICATION_MESSAGE,
  NotificationMessageFields,
  deviceNotificationMessage,
  isNotificationMessageValid,
  notificationPayload,
  type NotificationMessage,
} from "./notification-message-fields";

export interface NotificationRecipient {
  id: string;
  name: string;
}

/**
 * Send a notification to fixed recipients (from the user profile), optionally
 * about one device: then it is linked to that device and opens it in the app.
 */
export function SendNotificationDialog({
  open,
  onOpenChange,
  recipients,
  deviceSerialNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: NotificationRecipient[];
  deviceSerialNumber?: string | null | undefined;
}) {
  const queryClient = useQueryClient();
  const initial = () =>
    deviceSerialNumber ? deviceNotificationMessage(deviceSerialNumber) : EMPTY_NOTIFICATION_MESSAGE;
  const [message, setMessage] = useState<NotificationMessage>(initial);

  useEffect(() => {
    if (open) setMessage(initial());
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = useMutation({
    mutationFn: () =>
      notificationService.send({
        recipientUserIds: recipients.map((r) => r.id),
        ...notificationPayload(message),
        deviceSerialNumber: deviceSerialNumber ?? null,
      }),
    onSuccess: () => {
      toast.success("Notification sent successfully.");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(toUserMessage(e, "Unable to send this notification. Please try again.")),
  });

  const to = recipients.map((r) => r.name).join(", ");

  return (
    <FormModal
      open={open}
      onOpenChange={(v) => !send.isPending && onOpenChange(v)}
      title="Send notification"
      description={
        deviceSerialNumber ? `To ${to}, about device ${deviceSerialNumber}.` : `To ${to}.`
      }
      wide
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (isNotificationMessageValid(message) && recipients.length > 0) send.mutate();
        }}
      >
        <NotificationMessageFields value={message} onChange={setMessage} idPrefix="sn" />
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={send.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="success"
            disabled={
              !isNotificationMessageValid(message) || recipients.length === 0 || send.isPending
            }
          >
            {send.isPending && <Loader2 className="size-4 animate-spin" />} Send notification
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
