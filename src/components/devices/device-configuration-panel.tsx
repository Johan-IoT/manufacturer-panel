import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/app/badges";
import { ConfirmationDialog } from "@/components/app/dialogs";
import { AsyncPageContent } from "@/components/app/page-layout";
import {
  CONFIG_FIELDS,
  ConfigParameterForm,
  validateConfigValues,
  type ConfigValues,
} from "@/components/app/config-parameter-form";
import { deviceConfigurationService, type DeviceConfigParameter } from "@/services";
import { toUserMessage } from "@/services/client";
import { formatDateTime } from "@/lib/format";

/**
 * View and edit the parameters stored in the database for one device (Johan:
 * the browser only views and edits database values; Connect / Read / Write is
 * done by the app). A saved edit becomes the pending value the app writes to
 * the device on its next Write.
 */
export function DeviceConfigurationPanel({
  serial,
  canEdit,
}: {
  serial: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ConfigValues>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [confirm, setConfirm] = useState(false);

  const query = useQuery({
    queryKey: ["device-configuration", serial],
    queryFn: () => deviceConfigurationService.get(serial),
  });

  const byCode = useMemo(() => {
    const map = new Map<number, DeviceConfigParameter>();
    for (const p of query.data?.parameters ?? []) map.set(p.parameterCode, p);
    return map;
  }, [query.data]);

  /** What the form starts from: the pending value if any, else what the device reported. */
  const stored = useMemo(() => {
    const map: ConfigValues = {};
    for (const field of CONFIG_FIELDS) {
      const p = byCode.get(field.code);
      map[field.code] = p?.desiredValue ?? p?.knownValue ?? "";
    }
    return map;
  }, [byCode]);

  useEffect(() => {
    setValues(stored);
    setErrors({});
  }, [stored]);

  const changedCodes = CONFIG_FIELDS.filter(
    (f) => (values[f.code] ?? "") !== (stored[f.code] ?? ""),
  ).map((f) => f.code);
  const pendingCount = CONFIG_FIELDS.filter((f) => {
    const p = byCode.get(f.code);
    return p?.desiredValue != null && p.desiredValue !== p.knownValue;
  }).length;

  const save = useMutation({
    mutationFn: () =>
      deviceConfigurationService.save(
        serial,
        changedCodes.map((code) => ({ parameterCode: code, value: (values[code] ?? "").trim() })),
      ),
    onSuccess: () => {
      toast.success("Configuration saved. The app writes it to the device on its next Write.");
      setConfirm(false);
      void queryClient.invalidateQueries({ queryKey: ["device-configuration", serial] });
    },
    onError: (e) =>
      toast.error(toUserMessage(e, "Unable to save the configuration. Please try again.")),
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
    <section className="rounded-lg border border-border bg-surface p-4 shadow-none">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Stored configuration</h2>
          {query.data && <Pill tone="neutral">Version {query.data.configVersion}</Pill>}
          {pendingCount > 0 && <Pill tone="warning">{pendingCount} pending write</Pill>}
        </div>
        {canEdit && changedCodes.length > 0 && (
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
              Save changes
            </Button>
          </div>
        )}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Database values only. Connect, Read and Write to the device are done in the app.
      </p>
      <AsyncPageContent
        isLoading={query.isLoading}
        isError={query.isError || !query.data}
        onRetry={() => void query.refetch()}
        loadingLabel="Loading configuration"
        errorTitle="Unable to load configuration"
        shellClassName="border-0 bg-transparent"
      >
        <ConfigParameterForm
          idPrefix="device"
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
          renderFieldMeta={(field) => {
            const p = byCode.get(field.code);
            if (!p) return <p className="text-xs text-muted-foreground">Not stored yet</p>;
            const pending = p.desiredValue != null && p.desiredValue !== p.knownValue;
            const reported =
              p.knownValue == null || p.knownValue === ""
                ? "not read yet"
                : field.kind === "password"
                  ? "set"
                  : p.knownValue;
            return (
              <p className="text-xs text-muted-foreground">
                Device reported: {reported}
                {pending ? " (pending write)" : ""} · Updated {formatDateTime(p.updatedAt)}
              </p>
            );
          }}
        />
      </AsyncPageContent>

      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Save configuration changes?"
        description={`${changedCodes.length} value(s) will be stored for ${serial}. The app writes them to the device on its next Write.`}
        confirmLabel="Save changes"
        loading={save.isPending}
        onConfirm={() => save.mutate()}
      />
    </section>
  );
}
