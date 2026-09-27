import { afterEach, describe, expect, it } from "vitest";

import { demoNetwork, type DemoNetworkVariant } from "@/components/ward-management/ward-demo-network";
import { mixSexOf } from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { REFERRAL_SOURCES } from "@/components/ward-management/ward-model";
import { activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";
import { allUnits, NOW_ANCHOR, STANDARD_WARD_SITES, unitById } from "@/components/ward-management/ward-sites";

/**
 * The EMHS demo and surge scenarios (owner rulings 2026-09-25 10:08). The rule under test is
 * rule 6: no standalone numbers. Every figure is derived from patient or bed records, and every
 * record belongs to a patient who exists.
 */
const VARIANTS: readonly DemoNetworkVariant[] = ["demo", "surge"];
const EMHS_SITES = ["RPH", "BTY", "ARM", "SJGM"];
const EMHS_EDS = ["rph-ed", "arm-ed", "sjgm-ed"];
const END_OF_DAY = 24 * 60 - 1;

function waiting(variant: DemoNetworkVariant) {
  return demoNetwork(variant).movements.filter(
    (movement) => EMHS_EDS.includes(movement.originEdId) && !movement.closure && movement.stage !== "moving",
  );
}

afterEach(() => activateScenarioNetwork("standard"));

describe.each(VARIANTS)("the EMHS %s network", (variant) => {
  const network = demoNetwork(variant);
  const units = network.sites.flatMap((site) => site.units);
  const patientIds = new Set(network.patients.map((patient) => patient.id));

  it("links every admission, movement and referral to a patient who exists", () => {
    const records = [...network.admissions, ...network.movements, ...network.referrals];
    expect(records.filter((record) => !record.patientId || !patientIds.has(record.patientId)).map((r) => r.id)).toEqual(
      [],
    );
  });

  it("has no patient without a record", () => {
    const used = new Set(
      [...network.admissions, ...network.movements, ...network.referrals].map((record) => record.patientId),
    );
    expect(network.patients.filter((patient) => !used.has(patient.id)).map((patient) => patient.id)).toEqual([]);
  });

  it("derives every ward figure from its admissions", () => {
    for (const unit of units) {
      const onWard = network.admissions.filter((admission) => admission.unitId === unit.id);
      const occupied = onWard.filter((admission) => admission.state === "occupied");
      const pulled = onWard.filter((admission) => admission.state === "pulled");
      expect(unit.empty.value, unit.id).toBe(unit.beds - occupied.length);
      expect(unit.allocatable.value, unit.id).toBe(unit.empty.value - pulled.length);
      expect(unit.sexMix, unit.id).toEqual({
        // Counts follow gender, then recorded sex (R7, 2026-09-25): the engine's own `mixSexOf`.
        Female: occupied.filter((admission) => mixSexOf(admission.gender, admission.sex) === "Female").length,
        Male: occupied.filter((admission) => mixSexOf(admission.gender, admission.sex) === "Male").length,
      });
      expect(unit.blocked, unit.id).toBe(0);
      expect(unit.allocatableLocked, unit.id).toBeLessThanOrEqual(unit.allocatable.value);
      expect(onWard.filter((admission) => admission.bedKind === "locked").length, unit.id).toBeLessThanOrEqual(
        unit.lockedBeds,
      );
    }
  });

  it("only places people on a ward their sex designation allows", () => {
    for (const admission of network.admissions) {
      const unit = units.find((candidate) => candidate.id === admission.unitId);
      // R7 (2026-09-25): a single-sex ward is decided by GENDER, as the engine's gender_designation
      // gate does; a gender that is not female or male would need a coordinator's recorded review,
      // which this seed authors for nobody, so it must not appear on a single-sex ward at all.
      if (unit?.sexDesignation === "Female only") expect(admission.gender, admission.id).toBe("Female");
      if (unit?.sexDesignation === "Male only") expect(admission.gender, admission.id).toBe("Male");
    }
  });

  it("keeps the real site names and codes but gives every ward a plain demo label", () => {
    expect(network.sites.map((site) => site.code)).toEqual(STANDARD_WARD_SITES.map((site) => site.code));
    const standardNames = new Set(STANDARD_WARD_SITES.flatMap((site) => site.units.map((unit) => unit.name)));
    expect(units.filter((unit) => standardNames.has(unit.name) || !unit.id.startsWith("dn-"))).toEqual([]);
    expect(units.every((unit) => unit.referenceUnitId === undefined)).toBe(true);
  });

  it("builds East Metro as four sites, eleven wards and 168 beds", () => {
    const emhs = units.filter((unit) => EMHS_SITES.includes(unit.siteCode));
    expect(new Set(emhs.map((unit) => unit.siteCode)).size).toBe(4);
    expect(emhs).toHaveLength(11);
    expect(emhs.reduce((sum, unit) => sum + unit.beds, 0)).toBe(168);
  });

  it("gives every other service smaller example wards", () => {
    const services = new Set(network.sites.filter((site) => site.units.length > 0).map((site) => site.service));
    expect([...services].sort()).toEqual(["East Metro", "North Metro", "Private", "South Metro", "WACHS"]);
  });

  it("covers every referrer kind", () => {
    expect(new Set(network.referrals.map((referral) => referral.source))).toEqual(new Set(REFERRAL_SOURCES));
  });

  it("carries one involuntary transfer in transit with every booking fact", () => {
    const moving = network.movements.filter((movement) => movement.stage === "moving");
    expect(moving).toHaveLength(1);
    expect(moving[0].legalStatus).toBe("Involuntary inpatient");
    expect(moving[0].transport?.cadNumber).toBeTruthy();
    expect(moving[0].transport?.transportLegalStatus).toBe("involuntary");
    expect(moving[0].transport?.estimatedAt).toBeGreaterThan(NOW_ANCHOR);
  });

  it("shows a bed hold about to lapse", () => {
    const pulled = network.movements.filter((movement) => movement.stage === "pulled");
    expect(pulled.some((movement) => (movement.pullExpiresAt ?? Infinity) <= NOW_ANCHOR + 10)).toBe(true);
    for (const movement of pulled) {
      const held = network.admissions.find((admission) => admission.id === movement.admissionId);
      expect(held?.state, movement.id).toBe("pulled");
      expect(held?.patientId, movement.id).toBe(movement.patientId);
    }
  });

  it("shows the sex designation check declining a man referred to the women's ward", () => {
    const declined = network.referrals
      .flatMap((referral) => referral.destinations)
      .filter((to) => to.state === "declined");
    expect(declined.map((to) => to.declineReason)).toEqual(["sex_designation_unavailable"]);
  });

  it("computes no legal deadline and quotes no section number", () => {
    expect(network.movements.filter((movement) => movement.legalForm?.dueAt !== undefined)).toEqual([]);
    expect(JSON.stringify(network)).not.toMatch(/\bs(ection)?\.?\s?\d{2,3}\b/i);
  });

  it("uses obviously synthetic identities", () => {
    expect(network.patients.every((patient) => /^PT-DN-\d{4}$/.test(patient.id))).toBe(true);
    expect(network.patients.every((patient) => /^WF-P-\d{4}$/.test(patient.umrn))).toBe(true);
  });

  it("links every discharge due today to a bed release on the same ward", () => {
    const dueToday = network.admissions.filter(
      (admission) =>
        admission.expectedDischargeAt !== null &&
        admission.expectedDischargeAt > NOW_ANCHOR &&
        admission.expectedDischargeAt <= END_OF_DAY,
    );
    expect(network.bedReleases.map((release) => [release.unitId, release.expectedAt]).sort()).toEqual(
      dueToday.map((admission) => [admission.unitId, admission.expectedDischargeAt]).sort(),
    );
  });

  it("links every leave bed and every bed release to an occupied stay on the same ward", () => {
    for (const record of [...network.leaveBeds, ...network.bedReleases]) {
      const stay = network.admissions.find((admission) => admission.id === record.admissionId);
      expect(stay?.unitId, record.id).toBe(record.unitId);
      expect(stay?.state, record.id).toBe("occupied");
    }
    expect(new Set(network.leaveBeds.map((bed) => bed.admissionId)).size).toBe(network.leaveBeds.length);
  });
});

describe("the demo and surge figures", () => {
  it("demo: about 92% of East Metro beds occupied, 15 waiting in EDs, Armadale 5 with the longest 38 hours", () => {
    const network = demoNetwork("demo");
    const emhs = network.sites.filter((site) => EMHS_SITES.includes(site.code)).flatMap((site) => site.units);
    const occupied = emhs.reduce((sum, unit) => sum + unit.beds - unit.empty.value, 0);
    expect(occupied).toBe(155);
    expect(waiting("demo")).toHaveLength(15);
    const armadale = waiting("demo").filter((movement) => movement.originEdId === "arm-ed");
    expect(armadale).toHaveLength(5);
    expect(Math.max(...armadale.map((movement) => NOW_ANCHOR - movement.openedAt))).toBe(38 * 60);
    expect(network.leaveBeds).toHaveLength(5);
    expect(network.bedReleases).toHaveLength(8);
    expect(network.referrals).toHaveLength(9);
    const emhsWards = new Set(emhs.map((unit) => unit.id));
    const outOfArea = network.admissions.filter(
      (admission) => emhsWards.has(admission.unitId) && admission.homeRegion !== "Perth Metropolitan",
    );
    expect(outOfArea).toHaveLength(3);
  });

  it("surge: more people waiting and fuller wards than the demo", () => {
    expect(waiting("surge").length).toBeGreaterThan(waiting("demo").length);
    const empty = (variant: DemoNetworkVariant) =>
      demoNetwork(variant)
        .sites.flatMap((site) => site.units)
        .reduce((sum, unit) => sum + unit.empty.value, 0);
    expect(empty("surge")).toBeLessThan(empty("demo"));
  });
});

describe("loading a demonstration scenario", () => {
  it("seeds the scenario's own wards and patients, and every ward lookup follows it", () => {
    const state = seedWardFlowState("emhs-demo");
    activateScenarioNetwork(state.scenario);
    expect(state.units.every((unit) => unit.id.startsWith("dn-"))).toBe(true);
    expect(allUnits().map((unit) => unit.id)).toEqual(state.units.map((unit) => unit.id));
    expect(unitById("dn-bty-women")?.name).toBe("Bentley Women's Acute");
    expect(state.patients.length).toBe(demoNetwork("demo").patients.length);
    activateScenarioNetwork("standard");
    expect(unitById("dn-bty-women")).toBeUndefined();
  });

  it("leaves the standard night untouched", () => {
    const state = seedWardFlowState("standard");
    expect(state.units.map((unit) => unit.id)).toEqual(
      STANDARD_WARD_SITES.flatMap((site) => site.units.map((unit) => unit.id)),
    );
  });
});
