import { accessPlaceLabel } from "@/components/ward-management/shell/ward-access-labels";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { ACCESS_ADMIN_PERSONA, DESK_PERSONAS } from "@/components/ward-management/shell/ward-desk-personas";
import { ACCESS_ROLE_LABELS, accessIsWholeNetwork } from "@/components/ward-management/ward-role-access";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import { SETTINGS_DEMO_PROFILE, type WorkspaceProfile } from "./settings-profile";

export type DeskProfile = Pick<WorkspaceProfile, "name" | "initials" | "role" | "location">;

/**
 * The person and desk Settings names in its profile band. The statewide coordinator keeps the demo
 * profile. Every other desk is named as the rail and the access banner name it (#788: Settings said
 * "Bed coordinator, Perth Central Desk, Dr S. Chen" to every role).
 */
export function useSettingsDeskProfile(): DeskProfile {
  const access = useEffectiveWardAccess();
  const { units } = useWardFlowSelect("units");
  if (accessIsWholeNetwork(access)) return SETTINGS_DEMO_PROFILE;
  const persona = access.role === "admin" ? ACCESS_ADMIN_PERSONA : DESK_PERSONAS[access.role];
  const role = ACCESS_ROLE_LABELS[access.role];
  const named = persona.name !== role && persona.role !== "Demo desk";
  return {
    name: named ? persona.name : role,
    initials: persona.initials,
    role,
    location: accessPlaceLabel(access, units),
  };
}
