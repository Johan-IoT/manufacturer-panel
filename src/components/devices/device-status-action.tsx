import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { deviceService } from "@/services";
import { toUserMessage } from "@/services/client";
import { DEVICE_STATUS_ACTION_COPY, type DeviceStatusAction } from "@/lib/device-state";

/**
 * Suspend / Set to Released / Decommission with a confirmation step, shared by the
 * Devices list and the device detail page. Render `dialog` once and call `request`.
 */
export function useDeviceStatusAction() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ action: DeviceStatusAction; serial: string } | null>(
    null,
  );

  const mutation = useMutation({
    mutationFn: ({ action, serial }: { action: DeviceStatusAction; serial: string }) =>
      deviceService.changeStatus(serial, action),
    onSuccess: (_device, { action, serial }) => {
      toast.success(DEVICE_STATUS_ACTION_COPY[action].successToast);
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      void queryClient.invalidateQueries({ queryKey: ["device", serial] });
      void queryClient.invalidateQueries({ queryKey: ["links", "device", serial] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (error, { action }) =>
      toast.error(toUserMessage(error, DEVICE_STATUS_ACTION_COPY[action].errorToast)),
  });

  const copy = pending ? DEVICE_STATUS_ACTION_COPY[pending.action] : null;
  const dialog = (
    <ConfirmationDialog
      open={!!pending}
      onOpenChange={(open) => !open && setPending(null)}
      title={copy?.title ?? ""}
      description={pending && copy ? copy.description(pending.serial) : ""}
      confirmLabel={copy?.confirmLabel}
      destructive={copy?.destructive}
      loading={mutation.isPending}
      onConfirm={() => pending && mutation.mutate(pending)}
    />
  );

  return {
    request: (action: DeviceStatusAction, serial: string) => setPending({ action, serial }),
    dialog,
  };
}
