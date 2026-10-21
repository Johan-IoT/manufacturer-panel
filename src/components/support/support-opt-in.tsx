import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { userService } from "@/services";
import { toUserMessage } from "@/services/client";
import type { AppUser } from "@/types/entities";

/**
 * Johan (20 Oct): users with Manufacturer rights can opt in to receive each new
 * support message as a notification (in the app, with push).
 */
export function SupportOptInSwitch({
  user,
  label = "Receive support messages as notifications",
  compact = false,
}: {
  user: AppUser;
  label?: string | undefined;
  compact?: boolean | undefined;
}) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (optIn: boolean) => userService.setSupportNotifications(user.id, optIn),
    onSuccess: (saved) => {
      toast.success(
        saved.SupportNotificationsOptIn
          ? "Support messages will be sent as notifications."
          : "Support notifications turned off.",
      );
      queryClient.setQueryData(["user", user.id], saved);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) =>
      toast.error(toUserMessage(e, "Unable to update this setting. Please try again.")),
  });

  const id = `support-opt-in-${user.id}`;
  const control = (
    <Switch
      id={id}
      checked={user.SupportNotificationsOptIn}
      disabled={save.isPending || !user.IsManufacturer}
      onCheckedChange={(v) => save.mutate(v)}
    />
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {control}
        <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
          {label}
        </Label>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">
          Each new message from an app user arrives as a notification.
        </p>
      </div>
      {control}
    </div>
  );
}
