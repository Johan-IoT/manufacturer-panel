import { PermissionBadge, type PermissionKey } from "./badges";
import type { DeviceUserLink } from "@/types/entities";

const KEYS: PermissionKey[] = ["CanView", "CanConfigure", "CanControl", "CanShare"];

export function PermissionMatrix({ link }: { link: Pick<DeviceUserLink, "CanView" | "CanConfigure" | "CanControl" | "CanShare"> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {KEYS.map((k) => (
        <PermissionBadge key={k} permission={k} granted={link[k]} />
      ))}
    </div>
  );
}
