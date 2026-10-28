import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { accessIsWholeNetwork } from "@/components/ward-management/ward-role-access";

/** The save check's own sentence for a global settings change (`commandScopeRefusal`); a test keeps the two equal. */
const STATEWIDE_ONLY = "Only the statewide coordinator may change global settings.";

/**
 * Whether this desk may change the coordination rules, and why not. Executive reports never may.
 * P055: the save check also refuses anyone but the statewide coordinator, so say so up front.
 * Split from settings-screen.tsx for its line limit.
 */
export function useConfigurationGate(executive: boolean) {
  const roleGate = useRoleGate()("SET_CONFIGURATION");
  const notStatewide = !accessIsWholeNetwork(useEffectiveWardAccess());
  return executive
    ? { ...roleGate, allowed: false, reason: roleGate.reason ?? "Coordinator only" }
    : roleGate.allowed && notStatewide
      ? { ...roleGate, allowed: false, reason: STATEWIDE_ONLY }
      : roleGate;
}
