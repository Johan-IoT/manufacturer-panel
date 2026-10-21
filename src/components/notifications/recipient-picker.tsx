import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { deviceService, relationshipService, userService } from "@/services";
import type { AppUser } from "@/types/entities";

/** Johan (20 Oct): how the recipients of a new notification are chosen. */
export type RecipientMode =
  "all" | "people" | "company" | "installers" | "device" | "manufacturers";

const MODES: { value: RecipientMode; label: string }[] = [
  { value: "all", label: "All app users" },
  { value: "people", label: "By name, number or email" },
  { value: "company", label: "By company" },
  { value: "installers", label: "Installer rights (by company)" },
  { value: "device", label: "A device: owner and shared users" },
  { value: "manufacturers", label: "Manufacturer rights" },
];

const ALL = "__all__";

export interface RecipientResult {
  recipientIds: string[];
  /** Set when the notification is about one device (device mode). */
  deviceSerialNumber: string | null;
  summary: string;
}

function fullName(u: AppUser): string {
  return `${u.FirstName} ${u.LastName}`.trim();
}

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function RecipientPicker({ onChange }: { onChange: (result: RecipientResult) => void }) {
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });
  const linksQuery = useQuery({ queryKey: ["links"], queryFn: () => relationshipService.list() });
  const devicesQuery = useQuery({ queryKey: ["devices"], queryFn: () => deviceService.list() });

  const [mode, setMode] = useState<RecipientMode>("people");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [installerCompany, setInstallerCompany] = useState(ALL);
  const [appUserId, setAppUserId] = useState(ALL);
  const [deviceSerial, setDeviceSerial] = useState("");
  /** Users unticked from a computed list. */
  const [excluded, setExcluded] = useState<string[]>([]);

  // Notifications only go to active accounts.
  const activeUsers = useMemo(
    () => (usersQuery.data ?? []).filter((u) => u.AccountStatus === "Active"),
    [usersQuery.data],
  );
  const userById = useMemo(() => new Map(activeUsers.map((u) => [u.id, u])), [activeUsers]);
  const companies = useMemo(
    () =>
      [
        ...new Set(activeUsers.map((u) => u.CompanyName?.trim()).filter((c): c is string => !!c)),
      ].sort((a, b) => a.localeCompare(b)),
    [activeUsers],
  );
  const activeLinks = useMemo(
    () => (linksQuery.data ?? []).filter((l) => l.Active),
    [linksQuery.data],
  );
  const ownerLinks = activeLinks.filter((l) => l.LinkType === "Owner");
  const deviceOptions = ownerLinks
    .filter((l) => appUserId === ALL || l.AppUserId === appUserId)
    .map((l) => ({
      serial: l.DeviceSerialNumber,
      name:
        devicesQuery.data?.find((d) => d.SerialNumber === l.DeviceSerialNumber)?.DeviceName ?? "",
      owner: userById.get(l.AppUserId),
    }));
  const owners = [...new Set(ownerLinks.map((l) => l.AppUserId))]
    .map((id) => userById.get(id))
    .filter((u): u is AppUser => !!u);

  const candidates: AppUser[] = useMemo(() => {
    switch (mode) {
      case "all":
        return activeUsers;
      case "company":
        return company ? activeUsers.filter((u) => u.CompanyName?.trim() === company) : [];
      case "installers":
        return activeUsers.filter(
          (u) =>
            u.IsInstaller &&
            (installerCompany === ALL || u.CompanyName?.trim() === installerCompany),
        );
      case "manufacturers":
        return activeUsers.filter((u) => u.IsManufacturer);
      case "device":
        return deviceSerial
          ? activeLinks
              .filter(
                (l) =>
                  l.DeviceSerialNumber === deviceSerial &&
                  (l.LinkType === "Owner" || l.LinkType === "Shared"),
              )
              .map((l) => userById.get(l.AppUserId))
              .filter((u): u is AppUser => !!u)
          : [];
      default:
        return [];
    }
  }, [mode, activeUsers, company, installerCompany, deviceSerial, activeLinks, userById]);

  const peopleList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeUsers;
    const qDigits = digits(q);
    return activeUsers.filter(
      (u) =>
        fullName(u).toLowerCase().includes(q) ||
        u.Email.toLowerCase().includes(q) ||
        (qDigits.length > 0 && digits(u.MobileNumber).includes(qDigits)),
    );
  }, [activeUsers, search]);

  const recipientIds =
    mode === "people"
      ? picked.filter((id) => userById.has(id))
      : candidates.map((u) => u.id).filter((id) => !excluded.includes(id));

  const summary =
    recipientIds.length === 0
      ? "No recipients selected"
      : recipientIds.length === 1
        ? fullName(userById.get(recipientIds[0]!)!)
        : `${recipientIds.length} recipients`;
  const deviceSerialNumber = mode === "device" && deviceSerial ? deviceSerial : null;

  const resultKey = `${recipientIds.join(",")}|${deviceSerialNumber ?? ""}`;
  useEffect(() => {
    onChange({ recipientIds, deviceSerialNumber, summary });
    // Report only when the result changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const changeMode = (next: RecipientMode) => {
    setMode(next);
    setExcluded([]);
  };

  const listed = mode === "people" ? peopleList : candidates;
  const isChecked = (id: string) =>
    mode === "people" ? picked.includes(id) : !excluded.includes(id);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="recipient-mode">Send to</Label>
        <Select value={mode} onValueChange={(v) => changeMode(v as RecipientMode)}>
          <SelectTrigger id="recipient-mode" className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === "people" && (
        <Input
          className="bg-background"
          placeholder="Search by name, cellphone or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {mode === "company" && (
        <Select
          value={company}
          onValueChange={(v) => {
            setCompany(v);
            setExcluded([]);
          }}
        >
          <SelectTrigger aria-label="Company" className="bg-background">
            <SelectValue placeholder="Select a company" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {mode === "installers" && (
        <Select
          value={installerCompany}
          onValueChange={(v) => {
            setInstallerCompany(v);
            setExcluded([]);
          }}
        >
          <SelectTrigger aria-label="Installer company" className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {mode === "device" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="recipient-owner" className="text-xs text-muted-foreground">
              App user (optional)
            </Label>
            <Select
              value={appUserId}
              onValueChange={(v) => {
                setAppUserId(v);
                setDeviceSerial("");
                setExcluded([]);
              }}
            >
              <SelectTrigger id="recipient-owner" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any owner</SelectItem>
                {owners.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {fullName(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipient-device" className="text-xs text-muted-foreground">
              Owned device
            </Label>
            <Select
              value={deviceSerial}
              onValueChange={(v) => {
                setDeviceSerial(v);
                setExcluded([]);
              }}
            >
              <SelectTrigger id="recipient-device" className="bg-background">
                <SelectValue placeholder="Select a device" />
              </SelectTrigger>
              <SelectContent>
                {deviceOptions.map((d) => (
                  <SelectItem key={d.serial} value={d.serial}>
                    {d.serial}
                    {d.name ? ` - ${d.name}` : ""}
                    {d.owner ? ` (${fullName(d.owner)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {summary}
          {deviceSerialNumber ? `, about ${deviceSerialNumber}` : ""}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={listed.length === 0}
            onClick={() =>
              mode === "people"
                ? setPicked((cur) => [...new Set([...cur, ...listed.map((u) => u.id)])])
                : setExcluded([])
            }
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={recipientIds.length === 0}
            onClick={() =>
              mode === "people" ? setPicked([]) : setExcluded(candidates.map((u) => u.id))
            }
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3">
        {listed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {mode === "company" && !company
              ? "Select a company."
              : mode === "device" && !deviceSerial
                ? "Select a device."
                : "No matching active users."}
          </p>
        ) : (
          listed.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isChecked(u.id)}
                onChange={() =>
                  mode === "people"
                    ? setPicked((cur) => toggle(cur, u.id))
                    : setExcluded((cur) => toggle(cur, u.id))
                }
              />
              <span className="min-w-0">
                {fullName(u)}
                <span className="text-muted-foreground">
                  {" "}
                  ({[u.Email, u.MobileNumber, u.CompanyName].filter(Boolean).join(" | ")})
                </span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
