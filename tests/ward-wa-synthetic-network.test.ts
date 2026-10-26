import { describe, expect, it } from "vitest";
import { checkSyntheticPayload } from "@/lib/synthetic-data-guard";

import { demoNetwork } from "@/components/ward-management/ward-demo-network";
import { mixSexOf } from "@/components/ward-management/ward-eligibility";
import { WA_SYNTHETIC_BENCHMARK, waSyntheticNetwork } from "@/components/ward-management/ward-wa-synthetic-network";

describe("the opt-in fictional WA-like network", () => {
  it("keeps every retained demonstration unchanged and builds deterministically", () => {
    const before = JSON.stringify(demoNetwork("demo"));
    const network = waSyntheticNetwork();
    expect(waSyntheticNetwork()).toBe(network);
    expect(JSON.stringify(demoNetwork("demo"))).toBe(before);
    expect(network.sites.reduce((sum, site) => sum + site.units.reduce((count, unit) => count + unit.beds, 0), 0)).toBe(
      313,
    );
    expect(network.patients.length).toBe(demoNetwork("demo").patients.length + 6);
  });

  it("uses fictional service-place identifiers, removes reference pointers and retains geography", () => {
    const network = waSyntheticNetwork();
    for (const site of network.sites) {
      expect(site.code).toMatch(/^SYN-[A-Z]+$/);
      expect(site.name).toMatch(/^Fictional /);
      expect(site.referenceSiteId).toBeUndefined();
      if (site.emergencyDepartment) {
        expect(site.emergencyDepartment.id).toMatch(/^syn-[a-z]+-ed$/);
        expect(site.emergencyDepartment.siteCode).toBe(site.code);
        expect(site.emergencyDepartment.name).toMatch(/^Fictional /);
        expect(site.emergencyDepartment.referenceEdId).toBeUndefined();
      }
      for (const unit of site.units) {
        expect(unit.id).toMatch(/^syn-[a-z]+-ward-\d+$/);
        expect(unit.siteCode).toBe(site.code);
        expect(unit.name).toMatch(/^Fictional /);
        expect(unit.referenceUnitId).toBeUndefined();
      }
    }
    const text = JSON.stringify(network);
    expect(checkSyntheticPayload(network)).toEqual({ safe: true });
    expect(text).not.toMatch(/Royal Perth|Sir Charles Gairdner|Fiona Stanley|St John of God|Dabakarn|dn-bty|dn-rph/);
    expect(
      network.referrals.some((referral) => referral.suburb?.kind === "named" && referral.suburb.name === "Midland"),
    ).toBe(true);
    expect(network.patients.some((patient) => patient.suburb === "Armadale")).toBe(true);
  });

  it("preserves every patient, site, ED, ward and record join after remapping", () => {
    const network = waSyntheticNetwork();
    const sites = new Set(network.sites.map((site) => site.code));
    const units = new Set(network.sites.flatMap((site) => site.units.map((unit) => unit.id)));
    const eds = new Set(
      network.sites.flatMap((site) => (site.emergencyDepartment ? [site.emergencyDepartment.id] : [])),
    );
    const patients = new Set(network.patients.map((patient) => patient.id));
    const admissions = new Map(network.admissions.map((stay) => [stay.id, stay]));
    const movements = new Map(network.movements.map((movement) => [movement.id, movement]));
    const referrals = new Set(network.referrals.map((referral) => referral.id));
    for (const record of [...network.admissions, ...network.movements, ...network.referrals])
      expect(patients.has(record.patientId!)).toBe(true);
    for (const stay of network.admissions) {
      expect(units.has(stay.unitId)).toBe(true);
      if (stay.referralId) expect(referrals.has(stay.referralId)).toBe(true);
      if (stay.movementId) expect(movements.get(stay.movementId)?.patientId).toBe(stay.patientId);
    }
    for (const movement of network.movements) {
      if (movement.originEdId) expect(eds.has(movement.originEdId)).toBe(true);
      if (movement.acceptedUnitId) expect(units.has(movement.acceptedUnitId)).toBe(true);
      for (const unitId of movement.referredUnitIds) expect(units.has(unitId)).toBe(true);
      if (movement.admissionId) {
        expect(admissions.get(movement.admissionId)?.patientId).toBe(movement.patientId);
        expect(admissions.get(movement.admissionId)?.unitId).toBe(movement.acceptedUnitId);
      }
    }
    for (const referral of network.referrals) {
      if (referral.originSiteCode) expect(sites.has(referral.originSiteCode)).toBe(true);
      if (referral.originUnitId) expect(units.has(referral.originUnitId)).toBe(true);
      for (const addressing of referral.destinations) {
        if (addressing.destination.kind === "psychiatric_ward" && addressing.destination.unitId)
          expect(units.has(addressing.destination.unitId)).toBe(true);
        if (addressing.acceptedUnitId) expect(units.has(addressing.acceptedUnitId)).toBe(true);
      }
    }
    for (const record of [...network.bedReleases, ...network.leaveBeds]) {
      expect(admissions.get(record.admissionId)?.unitId).toBe(record.unitId);
      expect(admissions.get(record.admissionId)?.state).toBe("occupied");
    }
    const allIds = [
      ...network.patients,
      ...network.admissions,
      ...network.movements,
      ...network.referrals,
      ...network.bedReleases,
      ...network.leaveBeds,
    ].map((record) => record.id);
    expect(new Set(allIds).size).toBe(allIds.length);
    const used = new Set(
      [...network.admissions, ...network.movements, ...network.referrals].map((record) => record.patientId),
    );
    expect(network.patients.filter((patient) => !used.has(patient.id))).toEqual([]);
  });

  it("derives capacity and sex mix from stays and respects open/locked capacity", () => {
    const network = waSyntheticNetwork();
    for (const unit of network.sites.flatMap((site) => site.units)) {
      const here = network.admissions.filter((stay) => stay.unitId === unit.id);
      const occupied = here.filter((stay) => stay.state === "occupied");
      const pulled = here.filter((stay) => stay.state === "pulled");
      expect(unit.empty.value).toBe(unit.beds - occupied.length);
      expect(unit.allocatable.value).toBe(unit.empty.value - pulled.length);
      expect(unit.allocatable.value).toBeGreaterThanOrEqual(0);
      expect(here.filter((stay) => stay.bedKind === "locked").length).toBeLessThanOrEqual(unit.lockedBeds);
      expect(here.filter((stay) => stay.bedKind === "open").length).toBeLessThanOrEqual(unit.beds - unit.lockedBeds);
      expect(unit.sexMix).toEqual({
        Female: occupied.filter((stay) => mixSexOf(stay.gender, stay.sex) === "Female").length,
        Male: occupied.filter((stay) => mixSexOf(stay.gender, stay.sex) === "Male").length,
      });
      if (unit.sexDesignation === "Female only") expect(here.every((stay) => stay.gender === "Female")).toBe(true);
      if (unit.sexDesignation === "Male only") expect(here.every((stay) => stay.gender === "Male")).toBe(true);
    }
  });

  // The present-bed figure (`waSyntheticOccupancy`) had no reader and was deleted with Josh's
  // approval (production audit EDR-05, 25 Oct 2026); the stays the builder adds are still pinned.
  it("adds only plain synthetic stays to reach its illustrative occupancy", () => {
    const network = waSyntheticNetwork();
    expect(WA_SYNTHETIC_BENCHMARK.limitation).toContain("not population calibration");
    const added = network.admissions.filter((candidate) => candidate.id.startsWith("AD-WS-EXTRA-"));
    expect(added).toHaveLength(6);
    expect(
      added.every(
        (candidate) =>
          candidate.referralId === null && candidate.movementId === null && candidate.expectedDischargeAt === null,
      ),
    ).toBe(true);
  });
});
