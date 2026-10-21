import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormModal } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { notificationService } from "@/services";
import { toUserMessage } from "@/services/client";

const MAX_DAYS = 3650;

/** Notification settings (Johan, 20 Oct): Auto Delete Y/N and Delete Older Than (days). */
export function NotificationSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["notification-settings"],
    queryFn: () => notificationService.getSettings(),
    enabled: open,
  });
  const [autoDelete, setAutoDelete] = useState(false);
  const [days, setDays] = useState("90");

  useEffect(() => {
    if (open && settingsQuery.data) {
      setAutoDelete(settingsQuery.data.autoDelete);
      setDays(String(settingsQuery.data.deleteOlderThanDays));
    }
  }, [open, settingsQuery.data]);

  const daysNumber = Number(days);
  const daysValid = Number.isInteger(daysNumber) && daysNumber >= 1 && daysNumber <= MAX_DAYS;

  const save = useMutation({
    mutationFn: () =>
      notificationService.updateSettings({ autoDelete, deleteOlderThanDays: daysNumber }),
    onSuccess: (saved) => {
      toast.success(
        saved.deleted > 0
          ? `Settings saved. ${saved.deleted} old notification(s) deleted.`
          : "Notification settings saved successfully.",
      );
      void queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(toUserMessage(e, "Unable to save the settings. Please try again.")),
  });

  return (
    <FormModal
      open={open}
      onOpenChange={(v) => !save.isPending && onOpenChange(v)}
      title="Notification settings"
      description="Old notifications can be deleted automatically, for every user and in this history."
    >
      {settingsQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (daysValid) save.mutate();
          }}
        >
          <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background px-3 py-2">
            <Label htmlFor="auto-delete" className="font-normal">
              Auto Delete Notifications
            </Label>
            <Switch id="auto-delete" checked={autoDelete} onCheckedChange={setAutoDelete} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="older-than">Delete Older Than (days)</Label>
            <Input
              id="older-than"
              type="number"
              min={1}
              max={MAX_DAYS}
              className="bg-background tabular-nums"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-invalid={!daysValid}
            />
            {!daysValid ? (
              <p className="text-xs text-destructive">
                Enter a whole number of days from 1 to {MAX_DAYS}.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {autoDelete
                  ? `Notifications older than ${daysNumber} days are deleted when you save and every 6 hours.`
                  : "Auto Delete is off: notifications are kept."}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!daysValid || save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </div>
        </form>
      )}
    </FormModal>
  );
}
