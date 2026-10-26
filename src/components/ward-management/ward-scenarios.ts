import { demoNetwork, type DemoNetwork, type DemoNetworkVariant } from "@/components/ward-management/ward-demo-network";
import { waSyntheticNetwork } from "./ward-wa-synthetic-network";
import type { EmergencyDepartment, Site, Unit } from "@/components/ward-management/ward-model";
import {
  activateWardNetwork,
  STANDARD_WARD_SITES,
  type WardNetwork,
  wardNetworkOf,
} from "@/components/ward-management/ward-sites";

export type WardScenario =
  "standard" | "scarce" | "emhs-demo" | "emhs-surge" | "quiet-day" | "winter-surge" | "ed-crisis" | "wa-synthetic";
export const WARD_SCENARIOS: readonly WardScenario[] = [
  "standard",
  "scarce",
  "emhs-demo",
  "emhs-surge",
  "quiet-day",
  "winter-surge",
  "ed-crisis",
  "wa-synthetic",
] as const;

/** The one-tap demo reset choices (Josh, 15 Oct 2026). */
export const DEMO_RESET_SCENARIOS = [
  "quiet-day",
  "winter-surge",
  "ed-crisis",
] as const satisfies readonly WardScenario[];

export const scenarioLabels: Record<WardScenario, string> = {
  // Overall review (20 Oct 2026): its clock starts at 10:42, in the day shift, so it is called a
  // day on screen. The id and the code comments that say "standard night" are unchanged.
  standard: "Standard day",
  scarce: "Scarce beds",
  "emhs-demo": "EMHS demo",
  "emhs-surge": "EMHS surge",
  "quiet-day": "Quiet day",
  "winter-surge": "Winter surge",
  "ed-crisis": "ED crisis",
  "wa-synthetic": "Fictional WA-like network",
};

export const scenarioDescriptions: Record<WardScenario, string> = {
  standard: "The standard day with its usual wards and patients.",
  scarce: "The standard day with few beds ready and no extra observation staff.",
  "emhs-demo": "A typical East Metro day with most beds full and some ED waits.",
  "emhs-surge": "A busy East Metro day with fuller wards and longer ED waits.",
  "quiet-day": "Beds free across the network and short ED waits.",
  "winter-surge": "Every ward full or nearly full and more people waiting in ED.",
  "ed-crisis": "Busy wards and many people waiting in East Metro EDs, some for over two days.",
  "wa-synthetic":
    "Invented services and records, with an illustrative historical occupancy comparison. Not population calibration.",
};

/** The network variant each demonstration scenario loads. The standard and scarce nights have none. */
const SCENARIO_VARIANT: Partial<Record<WardScenario, DemoNetworkVariant>> = {
  "emhs-demo": "demo",
  "emhs-surge": "surge",
  "quiet-day": "quiet",
  "winter-surge": "winter",
  "ed-crisis": "ed-crisis",
};

/**
 * The prepared demonstration states (owner rulings 2026-09-25, and the one-tap resets of
 * 15 Oct 2026): their own wards and their own linked patients (`ward-demo-network.ts`).
 * `undefined` for the standard and scarce nights, which keep the standard network and its seed.
 */
export function scenarioNetwork(scenario: WardScenario): DemoNetwork | undefined {
  if (scenario === "wa-synthetic") return waSyntheticNetwork();
  const variant = SCENARIO_VARIANT[scenario];
  return variant ? demoNetwork(variant) : undefined;
}

/**
 * Points every ward lookup at the scenario's network. The provider calls this for the scenario on
 * screen; tests of a demonstration scenario call it and put the standard network back after.
 */
export function activateScenarioNetwork(scenario: WardScenario): void {
  activateWardNetwork(scenarioNetwork(scenario)?.sites ?? STANDARD_WARD_SITES);
}

/** The scenario's wards, as an input a screen passes on (`useWardNetwork()`). */
export function scenarioWardNetwork(scenario: WardScenario): WardNetwork {
  return wardNetworkOf(scenarioNetwork(scenario)?.sites ?? STANDARD_WARD_SITES);
}

/**
 * The emergency departments of one world's own network. The engine checks an event's `edId`
 * against these rather than the module-wide active network, which only a browser provider switches:
 * the shared server never does, so a wa-synthetic world there accepted a department from another
 * network and then failed its own save check (stress test 25 Oct 2026, CS2-20).
 */
export function scenarioEmergencyDepartments(scenario: WardScenario): EmergencyDepartment[] {
  return scenarioWardNetwork(scenario).sites.flatMap((site) =>
    site.emergencyDepartment ? [site.emergencyDepartment] : [],
  );
}

/**
 * Whether a site code belongs to one world's own network: the list its save check reads (audit
 * CS3-21, the same kind of fix as CS2-20). Home service returns and repatriations check this, not
 * the module-wide active network, so an accepted step never makes the world unsaveable.
 */
export function scenarioHasSite(scenario: WardScenario, siteCode: string): boolean {
  return scenarioSite(scenario, siteCode) !== undefined;
}

/** One site of a world's own network, by code (audit CS3-21). */
export function scenarioSite(scenario: WardScenario, siteCode: string): Site | undefined {
  return scenarioWardNetwork(scenario).sites.find((site) => site.code === siteCode);
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
    // clamped to `unit.empty.value` — a unit with zero physically empty beds (e.g.
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
      // the standard night's `allocatableLocked` is a count of the unit's own allocatable
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
