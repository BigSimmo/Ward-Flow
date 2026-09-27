import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { referenceEntity } from "../src/components/ward-management/reference/ward-reference-registry";
import { allUnits, wardSites } from "../src/components/ward-management/ward-sites";

/**
 * The demo network borrows real WA ward and hospital NAMES, and nothing else.
 *
 * ⚠️ THE SECOND TEST IS NOT CIRCULAR, WHICH IS THE ONLY REASON IT IS WORTH WRITING. The name is
 * hand-copied into `ward-sites.ts` rather than derived from the registry at runtime, so the two
 * CAN disagree — someone edits a ward's name in the fixture, or the pack is regenerated after a
 * source correction, and this goes red. A fixture that read its name from the registry could never
 * disagree with the registry, and the check would prove nothing at all.
 *
 * ⚠️ AND AN UNMATCHED UNIT IS NOT A FAILURE. The pack records no adult ward at Rockingham, no
 * older-adult ward at Royal Perth, nothing at Kununurra or SJG Subiaco. Those units keep their
 * invented names, and the test asserts only that whatever IS claimed resolves. An honest gap beats
 * a guessed name; a test that demanded full coverage would pressure somebody into inventing the
 * mapping it was meant to verify.
 */
describe("demo wards borrow real WA names", () => {
  it("every referenceUnitId names a ward that exists in the register", () => {
    for (const unit of allUnits()) {
      if (unit.referenceUnitId === undefined) continue;
      expect(referenceEntity(unit.referenceUnitId), `${unit.id} -> ${unit.referenceUnitId}`).not.toBeNull();
    }
  });

  it("a unit pointing at a real ward shows that ward's real name", () => {
    for (const unit of allUnits()) {
      if (unit.referenceUnitId === undefined) continue;
      expect(unit.name, unit.id).toBe(referenceEntity(unit.referenceUnitId)!.name);
    }
  });

  it("every referenceSiteId names a facility that exists in the register", () => {
    for (const site of wardSites) {
      if (site.referenceSiteId === undefined) continue;
      const entity = referenceEntity(site.referenceSiteId);
      expect(entity, `${site.code} -> ${site.referenceSiteId}`).not.toBeNull();
      expect(entity!.kind).toBe("facility");
    }
  });

  it("a unit sits at the hospital its reference ward actually belongs to", () => {
    // Guards the mapping's worst failure: a real ward name attached to the wrong hospital, which
    // reads as perfectly plausible and is simply false.
    for (const unit of allUnits()) {
      if (unit.referenceUnitId === undefined) continue;
      const site = wardSites.find((candidate) => candidate.code === unit.siteCode)!;
      if (site.referenceSiteId === undefined) continue;
      expect(referenceEntity(unit.referenceUnitId)!.facilityId, `${unit.id} at ${site.code}`).toBe(
        site.referenceSiteId,
      );
    }
  });

  it("no two units claim the same real ward", () => {
    const claimed = allUnits()
      .map((unit) => unit.referenceUnitId)
      .filter((id): id is string => id !== undefined);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it("carries the two real public EDs that were missing, with no beds behind them", () => {
    // The pack records twelve EDs, ten public. This network had eight. King Edward (women's) and
    // Perth Children's (paediatric) were the two missing public ones, and neither has an adult
    // mental-health ward -- an ED with no beds is the correct shape for them, not a gap.
    const codes = wardSites.map((site) => site.code);
    expect(codes).toContain("KEMH");
    expect(codes).toContain("PCH");
    for (const code of ["KEMH", "PCH"]) {
      const site = wardSites.find((candidate) => candidate.code === code)!;
      expect(site.emergencyDepartment, `${code} must have an ED`).toBeDefined();
      expect(site.units, `${code} must have no wards`).toHaveLength(0);
    }
  });

  it("every site with no wards still resolves as a real facility", () => {
    // A site carrying only an ED is the one shape where a typo would be invisible: no ward names
    // to look wrong, no beds to count.
    for (const site of wardSites.filter((candidate) => candidate.units.length === 0)) {
      expect(site.referenceSiteId, `${site.code} has no reference facility`).toBeDefined();
      expect(referenceEntity(site.referenceSiteId!)?.kind, site.code).toBe("facility");
    }
  });

  it("still says out loud, in the file itself, that every number is invented", () => {
    // There is no WARD_SITES_ARE_INVENTED constant; the marker is a header comment, so the check
    // has to read the source. Renaming the wards must not quietly make the fixture look sourced.
    const source = readFileSync("src/components/ward-management/ward-sites.ts", "utf8");
    expect(source).toContain("EVERY NUMBER BELOW IS INVENTED");
  });

  it("borrows no number from the register, only names", () => {
    // The registry has no numeric field at all, so this cannot fail by import — it fails if someone
    // hand-types a published figure into the fixture and cites the pack for it in the same breath.
    const source = readFileSync("src/components/ward-management/ward-sites.ts", "utf8");
    expect(source).not.toMatch(/staffed_?[Bb]eds|commissioned_?[Bb]eds|available_?[Bb]eds/);
  });
});
