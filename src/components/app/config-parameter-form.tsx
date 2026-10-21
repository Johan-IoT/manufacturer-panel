import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Configuration fields exactly as Johan's ConfigGate_Tabs sheet and the app's
 * Configure screen (same labels, same dropdown values). Codes are the server
 * (MySQL) parameter codes. The browser only edits stored values; the app does
 * Connect / Read / Write over BLE.
 */
export const CONFIG_TABS = ["Modem", "Network", "WAN", "Server", "Device"] as const;
export type ConfigTab = (typeof CONFIG_TABS)[number];

type FieldKind = "text" | "password" | "ip" | "port" | "enum";

export interface ConfigFieldDef {
  code: number;
  label: string;
  tab: ConfigTab;
  kind: FieldKind;
  options?: string[];
  /** Max UTF-8 bytes on the device (STRING32 = 31, STRING64 = 63). */
  maxBytes?: number;
  placeholder?: string;
}

export const CONFIG_FIELDS: ConfigFieldDef[] = [
  { code: 0x20, label: "APN", tab: "Modem", kind: "text", maxBytes: 31, placeholder: "Enter APN" },
  {
    code: 0x21,
    label: "APN Username",
    tab: "Modem",
    kind: "text",
    maxBytes: 31,
    placeholder: "Enter APN username",
  },
  {
    code: 0x22,
    label: "APN Password",
    tab: "Modem",
    kind: "password",
    maxBytes: 31,
    placeholder: "Enter APN password",
  },
  { code: 0x49, label: "Wireless Mode", tab: "Network", kind: "enum", options: ["AP", "STA"] },
  {
    code: 0x4c,
    label: "AP SSID",
    tab: "Network",
    kind: "text",
    maxBytes: 31,
    placeholder: "Enter AP SSID",
  },
  {
    code: 0x4d,
    label: "AP Password",
    tab: "Network",
    kind: "password",
    maxBytes: 31,
    placeholder: "Enter AP password",
  },
  { code: 0x52, label: "Hide AP", tab: "Network", kind: "enum", options: ["Don't Hide", "Hide"] },
  { code: 0x4e, label: "LAN IP", tab: "Network", kind: "ip", placeholder: "e.g. 10.10.100.254" },
  {
    code: 0x4f,
    label: "LAN Subnet",
    tab: "Network",
    kind: "ip",
    placeholder: "e.g. 255.255.255.0",
  },
  {
    code: 0x41,
    label: "STA SSID",
    tab: "WAN",
    kind: "text",
    maxBytes: 31,
    placeholder: "Enter Wi-Fi network name",
  },
  {
    code: 0x42,
    label: "STA Password",
    tab: "WAN",
    kind: "password",
    maxBytes: 31,
    placeholder: "Enter Wi-Fi password",
  },
  { code: 0x40, label: "WAN Type", tab: "WAN", kind: "enum", options: ["Static", "DHCP"] },
  { code: 0x44, label: "WAN IP", tab: "WAN", kind: "ip", placeholder: "Enter WAN IP" },
  { code: 0x45, label: "WAN Subnet", tab: "WAN", kind: "ip", placeholder: "Enter WAN subnet" },
  { code: 0x46, label: "WAN Gateway", tab: "WAN", kind: "ip", placeholder: "Enter WAN gateway" },
  {
    code: 0x72,
    label: "Server IP/Domain Name",
    tab: "Server",
    kind: "text",
    maxBytes: 63,
    placeholder: "e.g. iot.cellcop.co.za",
  },
  { code: 0x73, label: "Server Port", tab: "Server", kind: "port", placeholder: "0 to 65535" },
  { code: 0x7b, label: "Local Port", tab: "Server", kind: "port", placeholder: "0 to 65535" },
  {
    code: 0x4a,
    label: "Web Username",
    tab: "Device",
    kind: "text",
    maxBytes: 31,
    placeholder: "Enter web username",
  },
  {
    code: 0x53,
    label: "Web Password",
    tab: "Device",
    kind: "password",
    maxBytes: 31,
    placeholder: "Enter web password",
  },
  {
    code: 0x55,
    label: "Device Name",
    tab: "Device",
    kind: "text",
    maxBytes: 31,
    placeholder: "Enter device name",
  },
];

export type ConfigValues = Record<number, string>;

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Same rules the app applies before a BLE write. Empty values are allowed (not set). */
export function validateConfigValues(values: ConfigValues): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const field of CONFIG_FIELDS) {
    const value = (values[field.code] ?? "").trim();
    if (!value) continue;
    if (field.kind === "ip" && !IPV4.test(value)) {
      errors[field.code] = "Enter a valid IPv4 address.";
    } else if (field.kind === "port") {
      const port = Number(value);
      if (!/^\d+$/.test(value) || port < 0 || port > 65535)
        errors[field.code] = "Enter a port from 0 to 65535.";
    } else if (field.kind === "enum" && field.options && !field.options.includes(value)) {
      errors[field.code] = `Choose ${field.options.join(" or ")}.`;
    } else if (field.maxBytes && new TextEncoder().encode(value).length > field.maxBytes) {
      errors[field.code] = `Maximum ${field.maxBytes} characters.`;
    }
  }
  return errors;
}

function PasswordInput(props: {
  id: string;
  value: string;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  invalid?: boolean | undefined;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={props.id}
        type={visible ? "text" : "password"}
        autoComplete="off"
        className="bg-background pr-10"
        value={props.value}
        disabled={props.disabled}
        placeholder={props.placeholder}
        aria-invalid={props.invalid}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  );
}

export function ConfigParameterForm({
  idPrefix,
  values,
  errors = {},
  disabled,
  onChange,
  renderFieldMeta,
}: {
  idPrefix: string;
  values: ConfigValues;
  errors?: Record<number, string> | undefined;
  disabled?: boolean | undefined;
  onChange: (code: number, value: string) => void;
  /** Optional line under each field (e.g. what the device last reported). */
  renderFieldMeta?: ((field: ConfigFieldDef) => ReactNode) | undefined;
}) {
  return (
    <Tabs defaultValue={CONFIG_TABS[0]}>
      <TabsList>
        {CONFIG_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>
      {CONFIG_TABS.map((tab) => (
        <TabsContent key={tab} value={tab} className="mt-4 grid gap-4 lg:grid-cols-2">
          {CONFIG_FIELDS.filter((f) => f.tab === tab).map((field) => {
            const id = `${idPrefix}-${field.code.toString(16)}`;
            const value = values[field.code] ?? "";
            const error = errors[field.code];
            return (
              <div key={field.code} className="space-y-1.5">
                <Label htmlFor={id}>{field.label}</Label>
                {field.kind === "enum" ? (
                  <Select
                    value={value}
                    disabled={!!disabled}
                    onValueChange={(v) => onChange(field.code, v)}
                  >
                    <SelectTrigger id={id} className="bg-background" aria-invalid={!!error}>
                      <SelectValue placeholder={`Select ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options!.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.kind === "password" ? (
                  <PasswordInput
                    id={id}
                    value={value}
                    disabled={!!disabled}
                    placeholder={field.placeholder}
                    invalid={!!error}
                    onChange={(v) => onChange(field.code, v)}
                  />
                ) : (
                  <Input
                    id={id}
                    className={field.kind === "text" ? "bg-background" : "bg-background font-mono"}
                    inputMode={field.kind === "port" ? "numeric" : undefined}
                    value={value}
                    disabled={!!disabled}
                    placeholder={field.placeholder}
                    aria-invalid={!!error}
                    onChange={(e) => onChange(field.code, e.target.value)}
                  />
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
                {renderFieldMeta?.(field)}
              </div>
            );
          })}
        </TabsContent>
      ))}
    </Tabs>
  );
}
