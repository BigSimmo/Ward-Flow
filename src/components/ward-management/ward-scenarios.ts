import { demoNetwork, type DemoNetwork, type DemoNetworkVariant } from "@/components/ward-management/ward-demo-network";
import type { Unit } from "@/components/ward-management/ward-model";
import { activateWardNetwork, STANDARD_WARD_SITES } from "@/components/ward-management/ward-sites";

export type WardScenario = "standard" | "scarce" | "emhs-demo" | "emhs-surge";
export const WARD_SCENARIOS: readonly WardScenario[] = ["standard", "scarce", "emhs-demo", "emhs-surge"] as const;

export const scenarioLabels: Record<WardScenario, string> = {
  standard: "Standard night",
  scarce: "Scarce beds",
  "emhs-demo": "EMHS demo",
  "emhs-surge": "EMHS surge",
};

/**
 * The two prepared demonstration states (owner rulings 2026-09-25): their own wards and their own
 * linked patients (`ward-demo-network.ts`). `undefined` for the standard and scarce nights, which
 * keep the standard network and its seed.
 */
export function scenarioNetwork(scenario: WardScenario): DemoNetwork | undefined {
  const variant: DemoNetworkVariant | undefined =
    scenario === "emhs-demo" ? "demo" : scenario === "emhs-surge" ? "surge" : undefined;
  return variant ? demoNetwork(variant) : undefined;
}

/**
 * Points every ward lookup at the scenario's network. The provider calls this for the scenario on
 * screen; tests of a demonstration scenario call it and put the standard network back after.
 */
export function activateScenarioNetwork(scenario: WardScenario): void {
  activateWardNetwork(scenarioNetwork(scenario)?.sites ?? STANDARD_WARD_SITES);
}

/**
 * The scarce night differs from the standard night in OPERATIONAL NUMBERS ONLY. It carries the
 * same units, the same patients and the same identities; what changes is how many beds a ward
 * can actually allocate and how much one-to-one observation it can staff. Nothing here is a
 * clinical, legal or patient-level difference, and nothing here may become one.
 */
export function scenarioUnits(scenario: WardScenario): Unit[] {
  const network = scenarioNetwork(scenario);
  if (network) return structuredClone(network.sites.flatMap((site) => site.units));
  const units = structuredClone(STANDARD_WARD_SITES.flatMap((site) => site.units));
  if (scenario === "standard") return units;
  return units.map((unit, index) => {
    // Every third unit keeps a single allocatable bed; the rest have none. A single bed still
    // fails the sex_mix gate unless the ward already holds same-sex occupants, which is exactly
    // the squeeze a real scarce night produces.
    //
    // WF-26: clamped to `unit.empty.value` — a unit with zero physically empty beds (e.g.
    // `gry-older-adult`) must never be handed an allocatable bed that does not exist, regardless
    // of where its index falls in the every-third pattern above.
    //
    // 2026-09-25: also clamped to the unit's STANDARD `allocatable`, so the scarce night can never
    // offer a bed the standard night does not (it is the standard night with fewer beds). Broome,
    // which confirms no ready bed since the owner's ruling that it is not forensic, would otherwise
    // have gained one here.
    const allocatable = Math.min(index % 3 === 0 ? 1 : 0, unit.empty.value, unit.allocatable.value);
    return {
      ...unit,
      allocatable: { ...unit.allocatable, value: allocatable },
      // WF-26: the standard night's `allocatableLocked` is a count of the unit's own allocatable
      // beds that are locked, so it can never legitimately exceed `allocatable` — but this map
      // used to leave it untouched while zeroing `allocatable` above, which left units like
      // `fsh-adult-secure` and `rgh-adult-secure` advertising locked beds their own total said did
      // not exist. Clamped down, never up: a unit whose standard `allocatableLocked` was already
      // below the new `allocatable` keeps its real figure.
      allocatableLocked: Math.min(unit.allocatableLocked, allocatable),
      speciallingCapacity: 0,
      highAcuityCapacity: 0,
    };
  });
}
