import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { AsyncPageContent } from "@/components/app/page-layout";
import {
  CONFIG_FIELDS,
  ConfigParameterForm,
  validateConfigValues,
  type ConfigValues,
} from "@/components/app/config-parameter-form";
import { deviceTypeDefaultConfigService } from "@/services";
import { toUserMessage } from "@/services/client";

/**
 * Default parameters of a device type. They are copied to each new device of
 * this type when it is added; existing devices keep their own values.
 */
export function DeviceTypeDefaultConfigSection({
  deviceTypeId,
  canEdit,
}: {
  deviceTypeId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ConfigValues>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [confirm, setConfirm] = useState(false);

  const query = useQuery({
    queryKey: ["device-type-default-config", deviceTypeId],
    queryFn: () => deviceTypeDefaultConfigService.get(deviceTypeId),
  });

  const stored = useMemo(() => {
    const map: ConfigValues = {};
    for (const p of query.data ?? []) map[p.parameterCode] = p.value ?? "";
    return map;
  }, [query.data]);

  useEffect(() => {
    setValues(stored);
    setErrors({});
  }, [stored]);

  const dirty = CONFIG_FIELDS.some((f) => (values[f.code] ?? "") !== (stored[f.code] ?? ""));

  const save = useMutation({
    mutationFn: () => {
      // Keep stored defaults this form does not show, then apply the edited fields.
      const shown = new Set(CONFIG_FIELDS.map((f) => f.code));
      const parameters = (query.data ?? [])
        .filter((p) => !shown.has(p.parameterCode) && p.value != null && p.value !== "")
        .map((p) => ({ parameterCode: p.parameterCode, value: p.value }));
      for (const field of CONFIG_FIELDS) {
        const value = (values[field.code] ?? "").trim();
        if (value) parameters.push({ parameterCode: field.code, value });
      }
      return deviceTypeDefaultConfigService.save(deviceTypeId, parameters);
    },
    onSuccess: () => {
      toast.success("Default configuration saved successfully.");
      setConfirm(false);
      void queryClient.invalidateQueries({
        queryKey: ["device-type-default-config", deviceTypeId],
      });
    },
    onError: (e) =>
      toast.error(toUserMessage(e, "Unable to save the default configuration. Please try again.")),
  });

  const requestSave = () => {
    const found = validateConfigValues(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please correct the highlighted values.");
      return;
    }
    setConfirm(true);
  };

  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-4 shadow-none">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Default configuration</h2>
        {canEdit && dirty && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setValues(stored)}
              disabled={save.isPending}
            >
              Discard
            </Button>
            <Button size="sm" onClick={requestSave} disabled={save.isPending}>
              Save defaults
            </Button>
          </div>
        )}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Copied to each new device of this type when it is added. Existing devices keep their own
        values.
      </p>
      <AsyncPageContent
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        loadingLabel="Loading default configuration"
        errorTitle="Unable to load default configuration"
        shellClassName="border-0 bg-transparent"
      >
        <ConfigParameterForm
          idPrefix="default"
          values={values}
          errors={errors}
          disabled={!canEdit}
          onChange={(code, value) => {
            setValues((prev) => ({ ...prev, [code]: value }));
            setErrors((prev) => {
              if (!(code in prev)) return prev;
              const next = { ...prev };
              delete next[code];
              return next;
            });
          }}
        />
      </AsyncPageContent>

      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Save default configuration?"
        description="New devices of this type will start with these values. Existing devices are not changed."
        confirmLabel="Save defaults"
        loading={save.isPending}
        onConfirm={() => save.mutate()}
      />
    </section>
  );
}
