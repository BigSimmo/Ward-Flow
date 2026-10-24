import { demoNetwork, type DemoNetwork } from "@/components/ward-management/ward-demo-network";
import { mixSexOf } from "@/components/ward-management/ward-eligibility";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";

/**
 * An opt-in fictional network. The retained demonstrations are inputs, never mutated. Public
 * geographic suburbs/regions and the internal service grouping remain; provider, ED and ward
 * identities are fictional. No real reference-pack identity or measured road route is claimed.
 *
 * The 87.3% comparison is historical annual occupancy, not a snapshot distribution or evidence
 * that these people, diagnoses, waits, stays or service capacities represent Western Australia.
 */
export const WA_SYNTHETIC_BENCHMARK = {
  label: "Illustrative WA-like synthetic snapshot",
  referenceOccupancy: 0.873,
  period: "2023–24",
  sourceUrl:
    "https://www.mhc.wa.gov.au/awcontent/Web/Documents/2015-2024/MHAOD-Strategy-2025-2030-Discussion-Paper.pdf",
  sourcePage: 63,
  sourceNote: "Endnote 57: WA Department of Health BedState collection, retrieved September 2024.",
  definitionUrl: "https://www.mhc.wa.gov.au/awcontent/Web/Documents/2025/Annual-Report-2024-25.pdf",
  definitionPage: 128,
  snapshotDefinition: "Public occupied beds; held beds and patients on leave or away in ED are excluded.",
  sourceDefinition: "The 2024–25 report describes BedState occupied beds at midnight, excluding leave.",
  limitation:
    "Illustrative annual-to-snapshot comparison only. The later annual report describes midnight BedState bed-days excluding leave. Exact denominator comparability is not established; this is not population calibration.",
} as const;

const SITE_ALIASES: Readonly<Record<string, string>> = {
  RPH: "Quartz",
  SCGH: "Jasper",
  FSH: "Opal",
  ARM: "Topaz",
  SJGM: "Flint",
  RGH: "Agate",
  KEMH: "Garnet",
  PCH: "Beryl",
  JHC: "Onyx",
  PEEL: "Mica",
  FRE: "Amber",
  BTY: "Zircon",
  GRY: "Basalt",
  ALB: "Calcite",
  BUN: "Feldspar",
  BRM: "Hematite",
  GER: "Dolomite",
  KUN: "Pyrite",
  SJGS: "Tourmaline",
};

function presentOccupancy(network: DemoNetwork) {
  const publicUnits = new Set(
    network.sites.filter((site) => site.service !== "Private").flatMap((site) => site.units.map((unit) => unit.id)),
  );
  const absent = new Set(network.leaveBeds.map((leave) => leave.admissionId));
  const beds = network.sites
    .flatMap((site) => site.units)
    .filter((unit) => publicUnits.has(unit.id))
    .reduce((sum, unit) => sum + unit.beds, 0);
  const present = network.admissions.filter(
    (stay) =>
      publicUnits.has(stay.unitId) &&
      stay.state === "occupied" &&
      !absent.has(stay.id) &&
      stay.awayAtEmergencyDepartmentSince === null,
  ).length;
  return { beds, present, rate: beds === 0 ? 0 : present / beds };
}

/** Report the actual snapshot numerator and denominator, independently of its illustrative target. */
export function waSyntheticOccupancy(network: DemoNetwork) {
  return presentOccupancy(network);
}

function addPresentStays(network: DemoNetwork): void {
  const initial = presentOccupancy(network);
  const target = Math.round(initial.beds * WA_SYNTHETIC_BENCHMARK.referenceOccupancy);
  let added = 0;
  for (const site of network.sites) {
    if (site.service === "Private") continue;
    for (const unit of site.units) {
      const here = network.admissions.filter((stay) => stay.unitId === unit.id);
      const donor = here.find((stay) => stay.state === "occupied");
      const patient = network.patients.find((person) => person.id === donor?.patientId);
      if (!donor || !patient) continue;
      let available = unit.beds - here.length;
      let lockedAvailable = unit.lockedBeds - here.filter((stay) => stay.bedKind === "locked").length;
      let openAvailable = unit.beds - unit.lockedBeds - here.filter((stay) => stay.bedKind === "open").length;
      while (initial.present + added < target && available > 0) {
        added += 1;
        const patientId = `PT-WS-EXTRA-${String(added).padStart(4, "0")}` as const;
        network.patients.push({ ...structuredClone(patient), id: patientId, umrn: `UM${790000 + added}` });
        const locked = openAvailable <= 0 && lockedAvailable > 0;
        network.admissions.push({
          ...structuredClone(donor),
          id: `AD-WS-EXTRA-${String(added).padStart(4, "0")}`,
          patientId,
          referralId: null,
          movementId: null,
          observation: GENERAL_OBSERVATION,
          highAcuity: false,
          bedKind: locked ? "locked" : "open",
          pulledAt: NOW_ANCHOR - (added + 1) * 1440 - 60,
          arrivedAt: NOW_ANCHOR - (added + 1) * 1440,
          expectedDischargeAt: null,
          dischargeDateMoves: 0,
          dischargeDateSetAt: null,
          dischargeDateSetBy: null,
          dischargeConfirmedAt: null,
          dischargeConfirmedBy: null,
          awayAtEmergencyDepartmentSince: null,
        });
        available -= 1;
        if (locked) lockedAvailable -= 1;
        else openAvailable -= 1;
      }
    }
  }
  if (initial.present + added !== target) throw new Error("Illustrative occupancy target exceeds compatible free beds");
  for (const unit of network.sites.flatMap((site) => site.units)) {
    const here = network.admissions.filter((stay) => stay.unitId === unit.id);
    const occupied = here.filter((stay) => stay.state === "occupied");
    const pulled = here.filter((stay) => stay.state === "pulled");
    unit.empty.value = unit.beds - occupied.length;
    unit.allocatable.value = unit.empty.value - pulled.length;
    unit.held = pulled.length;
    unit.allocatableLocked = Math.min(
      unit.allocatable.value,
      Math.max(0, unit.lockedBeds - here.filter((stay) => stay.bedKind === "locked").length),
    );
    unit.sexMix = {
      Female: occupied.filter((stay) => mixSexOf(stay.gender, stay.sex) === "Female").length,
      Male: occupied.filter((stay) => mixSexOf(stay.gender, stay.sex) === "Male").length,
    };
  }
}

function buildNetwork(): DemoNetwork {
  const source = structuredClone(demoNetwork("demo"));
  const ids = new Map<string, string>();
  const labels = new Map<string, string>();
  for (const site of source.sites) {
    const alias = SITE_ALIASES[site.code];
    if (!alias) throw new Error(`Missing fictional site alias for ${site.code}`);
    const code = `SYN-${alias.toUpperCase()}`;
    ids.set(site.code, code);
    labels.set(site.name, `Fictional ${alias} Hospital`);
    if (site.emergencyDepartment) {
      ids.set(site.emergencyDepartment.id, `syn-${alias.toLowerCase()}-ed`);
      labels.set(site.emergencyDepartment.name, `Fictional ${alias} Emergency Department`);
    }
    for (const [index, unit] of site.units.entries()) {
      ids.set(unit.id, `syn-${alias.toLowerCase()}-ward-${index + 1}`);
      labels.set(unit.name, `Fictional ${alias} ${unit.cohort} Ward ${index + 1}`);
    }
  }
  // All record identities and their references receive one deterministic, exact-value mapping.
  for (const [records, prefix] of [
    [source.patients, "PT"],
    [source.admissions, "AD"],
    [source.movements, "WF"],
    [source.referrals, "RF"],
    [source.bedReleases, "WR"],
    [source.leaveBeds, "WL"],
  ] as const)
    records.forEach((record, index) => ids.set(record.id, `${prefix}-WS-${String(index + 1).padStart(4, "0")}`));
  source.movements.forEach((movement, index) => {
    if (movement.transport) ids.set(movement.transport.id, `TR-WS-${String(index + 1).padStart(4, "0")}`);
  });
  const substitutions = [...labels].sort(([a], [b]) => b.length - a.length);
  function fictionalise(value: unknown): unknown {
    if (typeof value === "string") {
      const exact = ids.get(value);
      if (exact) return exact;
      let result = value;
      for (const [original, alias] of substitutions) result = result.replaceAll(original, alias);
      return result.replace("asked for Bentley.", "asked for Fictional Zircon Hospital.");
    }
    if (Array.isArray(value)) return value.map(fictionalise);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !["referenceSiteId", "referenceEdId", "referenceUnitId"].includes(key))
          .map(([key, item]) => [key, fictionalise(item)]),
      );
    return value;
  }
  const network = fictionalise(source) as DemoNetwork;
  addPresentStays(network);
  return network;
}

let built: DemoNetwork | undefined;

/** Stable cached fixture, matching demoNetwork's copy-before-change convention. */
export function waSyntheticNetwork(): DemoNetwork {
  return (built ??= buildNetwork());
}
