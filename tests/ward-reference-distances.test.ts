import { describe, expect, it } from "vitest";

import {
  REFERENCE_DISTANCE_CAVEAT,
  REFERENCE_DISTANCE_PAIR_COUNT,
  referenceDistance,
} from "../src/components/ward-management/reference/ward-reference-distances";
import { referenceEntity } from "../src/components/ward-management/reference/ward-reference-registry";
import { TRAVEL_BANDS_ARE_INVENTED } from "../src/components/ward-management/ward-travel-bands";
import { allEmergencyDepartments, wardSites } from "../src/components/ward-management/ward-sites";

/**
 * Real measured road distances between metropolitan EDs and metropolitan hospital sites.
 *
 * 🔴 THE MOST IMPORTANT TEST HERE IS THE ONE ABOUT `TRAVEL_BANDS_ARE_INVENTED`. Ward Flow already
 * has a travel model: `ward-travel-bands.ts` maps a WA HOME REGION to a site, across Kimberley,
 * Pilbara, Mid West and Great Southern, and every value in it is invented on purpose — chosen by
 * list position so no step of the authoring could smuggle in a judgement about real geography.
 *
 * ⚠️ IT WOULD BE VERY EASY, AND WRONG, TO "FILL IT IN" FROM THIS FILE. The two cover different
 * populations: this one is 26 metropolitan entities and contains no regional pair at all. Answering
 * the regional question with a metropolitan measurement would produce a real-looking number that
 * measured something else. `ward-travel-bands.ts` calls flipping its flag a governance act; nothing
 * here earns it, and the test below fails if somebody flips it while this file still cannot support
 * the claim.
 */
describe("measured metropolitan road distances", () => {
  it("does not let the invented regional travel bands be declared measured", () => {
    expect(TRAVEL_BANDS_ARE_INVENTED).toBe(true);
  });

  it("contains no regional pair, which is what makes the rule above hold", () => {
    for (const site of wardSites) {
      if (site.referenceSiteId === undefined) continue;
      if (!/albany|bunbury|broome|geraldton|kalgoorlie/.test(site.referenceSiteId)) continue;
      for (const ed of allEmergencyDepartments()) {
        expect(referenceDistance(ed.referenceEdId, site.referenceSiteId), `${ed.id} -> ${site.code}`).toBeNull();
      }
    }
  });

  it("measures a pair a coordinator would actually look at", () => {
    const rphToScgh = referenceDistance("ed-rph", "scgh");
    expect(rphToScgh).not.toBeNull();
    expect(rphToScgh!.km).toBeGreaterThan(0);
    expect(rphToScgh!.min).toBeGreaterThan(0);
    // Royal Perth to Sir Charles Gairdner is a short city hop, not a country drive. A generous
    // bound: this catches a unit mix-up (metres for kilometres, seconds for minutes), not a
    // disagreement with the router.
    expect(rphToScgh!.km).toBeLessThan(30);
    expect(rphToScgh!.min).toBeLessThan(60);
  });

  it("is directed, so a pair is looked up the way round it was asked", () => {
    expect(referenceDistance("ed-rph", "rph")).not.toBeNull();
    expect(referenceDistance("scgh", "ed-rph")).not.toBeNull();
  });

  it("returns null for an unknown pair rather than a nearest match", () => {
    expect(referenceDistance("ed-rph", "not-a-place")).toBeNull();
    expect(referenceDistance(undefined, "rph")).toBeNull();
    expect(referenceDistance("ed-rph", undefined)).toBeNull();
  });

  it("every tagged ED resolves in the register and has at least one measured route", () => {
    for (const ed of allEmergencyDepartments()) {
      if (ed.referenceEdId === undefined) continue;
      expect(referenceEntity(ed.referenceEdId)?.kind, ed.id).toBe("emergency_department");
      const anyRoute = wardSites.some(
        (site) =>
          site.referenceSiteId !== undefined && referenceDistance(ed.referenceEdId, site.referenceSiteId) !== null,
      );
      expect(anyRoute, `${ed.id} has no measured route to any site`).toBe(true);
    }
  });

  it("says out loud that a route is not a clinical travel time", () => {
    expect(REFERENCE_DISTANCE_CAVEAT).toMatch(/not a clinical travel time/i);
    expect(REFERENCE_DISTANCE_CAVEAT).toMatch(/not live traffic/i);
  });

  it("records a pair count it can report without anyone hard-coding one", () => {
    expect(REFERENCE_DISTANCE_PAIR_COUNT).toBeGreaterThan(0);
  });
});
