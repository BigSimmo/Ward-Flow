// tests/ward-service-scope.test.ts
//
// Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2 (item 44): the service
// chooser's membership rules, as one shared, pure module. This file drives the exported functions
// of `src/components/ward-management/ward-service-scope.ts` directly rather than re-implementing
// the join — a test that copies the rule it is checking guards nothing, the same reasoning
// `tests/ward-handover-filters.test.ts` already gives for driving `movementInHandoverScope`
// straight instead of mirroring it.

import { describe, expect, it } from "vitest";

import {
  edHealthService,
  movementBelongsToService,
  movementHasNoRecordedService,
  movementHealthServices,
  movementIsUrgent,
  movementIsUrgentForServiceSafety,
  noRecordedServiceMovementCount,
  referralBelongsToService,
  referralHasNoRecordedService,
  referralHealthServices,
  SERVICE_SCOPED_SCREENS,
  unitHealthService,
  urgentMovementsOutsideService,
} from "../src/components/ward-management/ward-service-scope";
import {
  movementIsUrgent as handoverMovementIsUrgent,
  urgentMovementsOutsideScope,
} from "../src/components/ward-management/handover/handover-page";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { defaultWardConfiguration } from "../src/components/ward-management/ward-configuration";
import {
  HEALTH_SERVICES,
  HOME_REGIONS,
  type HealthService,
  type Movement,
  type Referral,
} from "../src/components/ward-management/ward-model";

const { movements, units, referrals } = seedWardFlowState();
const openMovements = movements.filter(isOpen);
// R2: `movementIsUrgentForServiceSafety`/`urgentMovementsOutsideService` now take the
// coordinator-configured ED access target as their last argument — the real seed's own
// configuration, `defaultWardConfiguration()` (1440 minutes / 24 hours), the same figure Delays'
// own "Over 24 hours" band and the ED access-target line already read.
const CONFIG = defaultWardConfiguration();

/** A complete, minimal open movement — every required field, nothing optional set unless a test
 *  needs it. Same shape `tests/ward-handover-filters.test.ts`'s own `baseMovement` uses, copied
 *  rather than imported (that helper is private to its file), so a future required field added to
 *  `Movement` fails this file loudly instead of silently omitting it. */
function baseMovement(overrides: Partial<Movement> & { id: string; originEdId: string }): Movement {
  return {
    openedAt: NOW_ANCHOR - 40,
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "Test fixture",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

/** A complete, minimal referral — every required field, nothing optional set unless a test needs
 *  it. `originSiteCode` defaults to RPH (East Metro), the same site `tests/ward-handover-filters
 *  .test.ts`'s own fixture referral uses. */
function baseReferral(overrides: Partial<Referral> & { id: string }): Referral {
  return {
    destinations: [],
    ageBand: "Adult",
    homeRegion: "Perth Metropolitan",
    suburb: { status: "known", suburb: "Test Suburb", region: "Perth Metropolitan" } as unknown as Referral["suburb"],
    source: "community",
    history: "",
    raisedAt: NOW_ANCHOR - 100,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...overrides,
  };
}

describe("unitHealthService / edHealthService — the base rule (§2: a unit or ED belongs to its site's service)", () => {
  it("a real unit's service is its site's own service", () => {
    const rphUnit = units.find((unit) => unit.siteCode === "RPH");
    if (rphUnit === undefined) throw new Error("no RPH unit in the seed — this test's precondition");
    expect(unitHealthService(rphUnit)).toBe("East Metro");

    const privateUnit = units.find((unit) => unit.siteCode === "SJGS");
    if (privateUnit === undefined) throw new Error("no SJGS unit in the seed — this test's precondition");
    expect(unitHealthService(privateUnit)).toBe("Private");
  });

  it("a real ED's service is its site's own service", () => {
    expect(edHealthService("rph-ed")).toBe("East Metro");
    expect(edHealthService("scgh-ed")).toBe("North Metro");
  });

  it("resolves undefined for an ED id that names nothing real — never a guessed service", () => {
    expect(edHealthService("no-such-ed")).toBeUndefined();
  });
});

describe("movementHealthServices / movementBelongsToService (§2: origin ED, accepted ward, every referred ward)", () => {
  it("the origin ED's own service, with no accepted or referred ward", () => {
    const movement = baseMovement({ id: "WF-TEST-ORIGIN-ONLY", originEdId: "rph-ed" });
    expect(movementHealthServices(movement, units)).toEqual(["East Metro"]);
    expect(movementBelongsToService(movement, "East Metro", units)).toBe(true);
    expect(movementBelongsToService(movement, "Private", units)).toBe(false);
  });

  it("an accepted ward's service is included even when it differs from the origin ED's", () => {
    // rph-ed sits at Royal Perth Hospital (East Metro); sjgs-adult-secure sits at St John of God
    // Subiaco (Private) — reached only via the accepted-ward half of the join.
    const movement = baseMovement({
      id: "WF-TEST-ACCEPTED",
      originEdId: "rph-ed",
      acceptedUnitId: "sjgs-adult-secure",
    });
    const memberships = movementHealthServices(movement, units);
    expect(memberships).toContain("East Metro");
    expect(memberships).toContain("Private");
    expect(movementBelongsToService(movement, "Private", units)).toBe(true);
    expect(movementBelongsToService(movement, "South Metro", units)).toBe(false);
  });

  it("EVERY ward this movement was referred to counts, not only an accepted one", () => {
    // MUTATION TARGET: reading only `acceptedUnitId` (dropping `referredUnitIds`) leaves this red
    // — this movement has no accepted ward at all, only a referred one.
    const movement = baseMovement({
      id: "WF-TEST-REFERRED",
      originEdId: "rph-ed",
      referredUnitIds: ["sjgs-adult-secure"],
    });
    expect(movementBelongsToService(movement, "Private", units)).toBe(true);
  });

  it("deduplicates a service reached by more than one part of the join", () => {
    const rphWard = units.find((unit) => unit.siteCode === "RPH");
    if (rphWard === undefined) throw new Error("no RPH unit in the seed — this test's precondition");
    const movement = baseMovement({
      id: "WF-TEST-DEDUP",
      originEdId: "rph-ed",
      acceptedUnitId: rphWard.id,
    });
    expect(movementHealthServices(movement, units)).toEqual(["East Metro"]);
  });
});

describe('an unresolvable movement reads as "no recorded service" and is always shown (§2)', () => {
  const unresolvable = baseMovement({ id: "WF-TEST-UNRESOLVABLE", originEdId: "no-such-ed" });

  it("resolves to no service at all", () => {
    expect(movementHealthServices(unresolvable, units)).toEqual([]);
    expect(movementHasNoRecordedService(unresolvable, units)).toBe(true);
  });

  it("is always shown — belongs to every HealthService, never excluded for lack of data", () => {
    // MUTATION TARGET: returning `false` for the empty-services case (instead of the safe `true`)
    // would silently drop this movement from every scoped list, exactly the failure this rule
    // exists to prevent.
    for (const service of HEALTH_SERVICES) {
      expect(movementBelongsToService(unresolvable, service, units)).toBe(true);
    }
  });

  it("a movement with a real origin but only unresolvable related units is likewise unresolvable via that half", () => {
    const movement = baseMovement({
      id: "WF-TEST-BAD-WARD",
      originEdId: "no-such-ed",
      referredUnitIds: ["no-such-unit"],
    });
    expect(movementHasNoRecordedService(movement, units)).toBe(true);
  });
});

describe("noRecordedServiceMovementCount — one shared population for Delays, Movements and Command (finding 1, 2026-09-17 review)", () => {
  it("counts an open unresolvable movement but excludes a closed one, over the real seed", () => {
    const openUnresolvable = baseMovement({ id: "WF-TEST-COUNT-OPEN", originEdId: "no-such-ed" });
    const closedUnresolvable = baseMovement({ id: "WF-TEST-COUNT-CLOSED", originEdId: "no-such-ed", stage: "arrived" });
    const baseline = noRecordedServiceMovementCount(movements, units);
    // MUTATION TARGET: filtering on the wrong predicate (e.g. always true, or `!isOpen`) would
    // either count the closed fixture too or fail to count the open one.
    expect(noRecordedServiceMovementCount([...movements, openUnresolvable], units)).toBe(baseline + 1);
    expect(noRecordedServiceMovementCount([...movements, closedUnresolvable], units)).toBe(baseline);
    expect(isOpen(closedUnresolvable)).toBe(false);
  });

  it(
    "is unaffected by scoping the population to one service first — proving Delays' previously " +
      "service-scoped `open` and Movements'/Command's whole-network `movements` now agree",
    () => {
      // An unresolvable movement already belongs to every HealthService (§2 "always shown"), so
      // narrowing the input array to one service's membership can never drop it — the exact property
      // that makes it safe for every caller to pass its own whole, unscoped array.
      for (const service of HEALTH_SERVICES) {
        const scoped = movements.filter((movement) => movementBelongsToService(movement, service, units));
        expect(noRecordedServiceMovementCount(scoped, units)).toBe(noRecordedServiceMovementCount(movements, units));
      }
    },
  );

  it("agrees with counting `movementHasNoRecordedService` over the open subset directly, over the real seed", () => {
    const expected = openMovements.filter((movement) => movementHasNoRecordedService(movement, units)).length;
    expect(noRecordedServiceMovementCount(movements, units)).toBe(expected);
  });
});

describe("referralHealthServices / referralBelongsToService (§2: origin site, accepted wards, ED destinations)", () => {
  it("the origin site's own service, with no destinations at all", () => {
    const referral = baseReferral({ id: "WF-TEST-REF-ORIGIN", originSiteCode: "RPH", destinations: [] });
    expect(referralHealthServices(referral, units)).toEqual(["East Metro"]);
  });

  it("an accepted ward's service is included, via the addressing's own acceptedUnitId", () => {
    const referral = baseReferral({
      id: "WF-TEST-REF-ACCEPTED",
      originSiteCode: "RPH",
      destinations: [
        {
          destination: {
            kind: "psychiatric_ward",
            sex: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
          state: "accepted",
          acceptedUnitId: "sjgs-adult-secure",
        },
      ],
    });
    const memberships = referralHealthServices(referral, units);
    expect(memberships).toContain("East Metro");
    expect(memberships).toContain("Private");
  });

  it("a queued psychiatric-ward destination with no acceptedUnitId yet contributes no ward service", () => {
    // MUTATION TARGET: reading a ward service off a destination that has not been accepted (no
    // `acceptedUnitId` to read) would have to invent one — this proves nothing is invented.
    const referral = baseReferral({
      id: "WF-TEST-REF-QUEUED",
      originSiteCode: "RPH",
      destinations: [
        {
          destination: {
            kind: "psychiatric_ward",
            sex: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
          state: "queued",
        },
      ],
    });
    expect(referralHealthServices(referral, units)).toEqual(["East Metro"]);
  });

  it("an ED destination's service is included regardless of that addressing's own state", () => {
    // MUTATION TARGET: gating the ED-destination half on `state === "accepted"` leaves this red —
    // the destination names WHERE the referral was sent, not whether it was accepted, and this
    // addressing is declined.
    const referral = baseReferral({
      id: "WF-TEST-REF-ED-DECLINED",
      originSiteCode: "RPH",
      destinations: [
        {
          destination: { kind: "emergency_department", edId: "scgh-ed", purpose: "bed" },
          state: "declined",
        },
      ],
    });
    const memberships = referralHealthServices(referral, units);
    expect(memberships).toContain("East Metro");
    expect(memberships).toContain("North Metro");
  });

  it('a community-team destination adds nothing (§2: "Community-team destinations add none")', () => {
    const referral = baseReferral({
      id: "WF-TEST-REF-TEAM",
      originSiteCode: "RPH",
      destinations: [{ destination: { kind: "community_team", teamName: "Fixture Community Team" }, state: "queued" }],
    });
    expect(referralHealthServices(referral, units)).toEqual(["East Metro"]);
  });

  it('an unresolvable referral (no origin site, no destinations) reads as "no recorded service" and is always shown', () => {
    const referral = baseReferral({ id: "WF-TEST-REF-UNRESOLVABLE", originSiteCode: "NO-SUCH-SITE", destinations: [] });
    expect(referralHealthServices(referral, units)).toEqual([]);
    expect(referralHasNoRecordedService(referral, units)).toBe(true);
    for (const service of HEALTH_SERVICES) {
      expect(referralBelongsToService(referral, service, units)).toBe(true);
    }
  });
});

describe("NEVER homeRegion — mutation-style (§2 / owner ruling Q-2)", () => {
  it("mutating a seeded referral's homeRegion never changes its computed service membership", () => {
    // MUTATION TARGET: any branch reading `referral.homeRegion` into the membership computation
    // turns this red the moment the mutated copy's region differs from the original's — real
    // seeded referrals here, not a constructed fixture, so this also proves the rule holds against
    // live data, not only a hand-picked case.
    for (const referral of referrals.slice(0, 25)) {
      const before = sortServices(referralHealthServices(referral, units));
      const differentRegion = HOME_REGIONS.find((region) => region !== referral.homeRegion);
      if (differentRegion === undefined) throw new Error("HOME_REGIONS has fewer than two members");
      const mutated: Referral = { ...referral, homeRegion: differentRegion };
      const after = sortServices(referralHealthServices(mutated, units));
      expect(after).toEqual(before);
    }
  });

  it("a constructed referral whose destinations resolve to no service still ignores homeRegion", () => {
    const unresolvable = baseReferral({
      id: "WF-TEST-REGION-A",
      originSiteCode: "NO-SUCH-SITE",
      homeRegion: "Pilbara",
    });
    const sameButKimberley: Referral = { ...unresolvable, id: "WF-TEST-REGION-B", homeRegion: "Kimberley" };
    expect(referralHealthServices(unresolvable, units)).toEqual(referralHealthServices(sameButKimberley, units));
  });
});

function sortServices(services: HealthService[]): HealthService[] {
  return [...services].sort();
}

describe("shown + outside = total, for every referral over the real seed (§3 scope-bar wording)", () => {
  it("holds for every referral", () => {
    for (const service of HEALTH_SERVICES) {
      const shown = referrals.filter((referral) => referralBelongsToService(referral, service, units)).length;
      const outside = referrals.filter((referral) => !referralBelongsToService(referral, service, units)).length;
      expect(shown + outside).toBe(referrals.length);
    }
  });
});

describe("urgent-outside-service names literal movements per HealthService, over the real seed — TEST 8, R2", () => {
  // ⚠️ **THIS REPLACES A SECOND UNFAILABLE TEST, FOUND BY R2's OWN REVIEW.** The mutual-exclusivity
  // pair this used to be ("every urgent-outside movement is NOT a member of the chosen service" /
  // "no member is ever counted urgent-outside") can never fail: `urgentMovementsOutsideService`'s
  // own filter is `!movementBelongsToService(...) && movementIsUrgentForServiceSafety(...)`
  // (`ward-service-scope.ts`), so every element it returns satisfies "not a member" BY
  // CONSTRUCTION of the filter itself, whatever `movementIsUrgentForServiceSafety` computes —
  // wrong, empty, or the whole population. It is a test that the AND operator works, not that the
  // right movements are named. This instead pins the actual SET of ids the real seed produces
  // today, so a regression that drops or adds a movement — including a regression of R2's own
  // fourth condition, the ED-wait-past-access-target one added alongside this test — turns it red.
  // WF-019 (waited ~62h) and WF-020 (~29h) are South Metro in origin and carry no legal form, no
  // escalation and no flag — before R2 neither appeared in ANY service's list; every list below
  // that is not South Metro's own now names both.
  //
  // 2026-09-17 sample-data addition (WF-021..WF-031) adds three more urgent-by-the-shared-
  // definition movements: WF-022 (escalation; belongs to East Metro + WACHS via origin rph-ed and
  // referredUnitIds alb-adult-open), WF-023 (ED wait past the 1,440-minute access target; belongs
  // to North Metro + WACHS via origin scgh-ed and acceptedUnitId bun-adult-open), and WF-030
  // (flaggedUrgent; belongs to East Metro + Private via origin rph-ed and acceptedUnitId
  // sjgs-adult-open). Each is added to every OTHER service's list.
  it("names exactly these movements as urgent-outside each service", () => {
    // WF-RD11 and WF-RD12 (`ward-rulings-demo.ts`'s overlay, appended after seeding) are urgent and
    // outside every service except East Metro — verified against the real seed's
    // `urgentMovementsOutsideService` output directly, not re-derived here.
    const expected: Record<HealthService, string[]> = {
      "North Metro": ["WF-009", "WF-019", "WF-020", "WF-022", "WF-030", "WF-308", "WF-RD11", "WF-RD12"],
      "South Metro": ["WF-018", "WF-022", "WF-023", "WF-030", "WF-308", "WF-RD11", "WF-RD12"],
      "East Metro": ["WF-009", "WF-018", "WF-019", "WF-020", "WF-023"],
      WACHS: ["WF-009", "WF-018", "WF-019", "WF-020", "WF-030", "WF-308", "WF-RD11", "WF-RD12"],
      Private: ["WF-009", "WF-018", "WF-019", "WF-020", "WF-022", "WF-023", "WF-308", "WF-RD11", "WF-RD12"],
      // Perth Children's (CAHS, owner ruling 2026-09-25) has no ward and no movement, so every
      // urgent movement is outside it.
      CAHS: ["WF-009", "WF-018", "WF-019", "WF-020", "WF-022", "WF-023", "WF-030", "WF-308", "WF-RD11", "WF-RD12"],
    };
    for (const service of HEALTH_SERVICES) {
      const actual = urgentMovementsOutsideService(openMovements, service, units, NOW_ANCHOR, CONFIG)
        .map((movement) => movement.id)
        .sort();
      expect(actual, `urgent-outside ${service}`).toEqual(expected[service]);
    }
  });
});

describe("anti-vacuity: each service has at least one open movement outside it (real seed)", () => {
  it("is true for every HealthService", () => {
    for (const service of HEALTH_SERVICES) {
      const hasSomeOutside = openMovements.some((movement) => !movementBelongsToService(movement, service, units));
      expect(hasSomeOutside).toBe(true);
    }
  });
});

describe("the JOIN still agrees with handover-page.tsx after the re-point — unaffected by D-a", () => {
  it("movementBelongsToService names the exact real-seed membership for five landmark movements, across every service — R2", () => {
    // ⚠️ **CORRECTED, R2.** This used to compare `movementBelongsToService` against
    // `movementInHandoverScope`'s own `case "service"` — but that case IS
    // `return movementBelongsToService(movement, scope.id, units);` (handover-page.tsx), the exact
    // re-point this file's own top comment describes. The comparison was the function against
    // itself through one layer of indirection: no mutation to `movementBelongsToService` could ever
    // make the two sides disagree, because both sides ARE the same call. This instead pins real,
    // independently-reasoned membership for five real seed movements already used as landmarks
    // elsewhere in this file and in the DOM service-scope suites: each one's `originEdId` names one
    // real site (`ward-sites.ts`), each site names one real service, and none of the five carries an
    // `acceptedUnitId` or a `referredUnitIds` entry — so origin ED is each one's ONLY membership
    // route, making a single expected service a complete, checkable answer.
    const expectedMembership: Record<string, HealthService> = {
      "WF-009": "South Metro", // peel-ed
      "WF-018": "North Metro", // scgh-ed
      "WF-019": "South Metro", // rgh-ed
      "WF-020": "South Metro", // peel-ed
      "WF-308": "East Metro", // generated (routineMovements index 308)
    };
    for (const [movementId, homeService] of Object.entries(expectedMembership)) {
      const movement = movements.find((candidate) => candidate.id === movementId);
      expect(movement, `${movementId} missing from the seed`).toBeDefined();
      for (const service of HEALTH_SERVICES) {
        expect(
          movementBelongsToService(movement!, service, units),
          `${movementId} vs ${service} (expected home service ${homeService})`,
        ).toBe(service === homeService);
      }
    }
  });

  it("this module's movementIsUrgent agrees with the handover page's own, for every real movement", () => {
    // handover-page.tsx's own `movementIsUrgent` is not re-exported by this module — see
    // ward-service-scope.ts's top comment for why the rule is copied rather than shared. This
    // pins the two copies to the same behaviour rather than assuming it stays true. D-a does NOT
    // touch `movementIsUrgent` — only `movementIsUrgentForServiceSafety`, a separate function — so
    // this parity is unaffected by the change below.
    for (const movement of movements) {
      expect(movementIsUrgent(movement, NOW_ANCHOR)).toBe(handoverMovementIsUrgent(movement, NOW_ANCHOR));
    }
  });
});

describe("D-a widened urgentMovementsOutsideService away from handover-page.tsx's urgentMovementsOutsideScope, deliberately", () => {
  // ⚠️ **BEFORE D-a, `urgentMovementsOutsideService` filtered on `movementIsUrgent` (the narrow,
  // handover-mirroring rule) and this file pinned it byte-for-byte equal to handover's own
  // `urgentMovementsOutsideScope`.** An Opus adversarial review (R1) found that equality was
  // exactly the P1 gap: a movement whose legal form was only RUNNING OUT, not yet breached, or one
  // that had been escalated with no legal form at all, read as not urgent under the narrow rule.
  // Ward Lead's decision D-a widens the definition `urgentMovementsOutsideService` filters on
  // (`movementIsUrgentForServiceSafety`) without touching handover-page.tsx at all, so the two
  // functions now deliberately disagree. The tests below prove the divergence is ADDITIVE ONLY —
  // every movement the narrow rule already caught is still caught — and prove the join itself
  // (tested above) is untouched by the widening.
  it("the OLD narrow rule (movementIsUrgent) still names exactly what handover names, for every service", () => {
    for (const service of HEALTH_SERVICES) {
      const narrowResult = openMovements.filter(
        (movement) => !movementBelongsToService(movement, service, units) && movementIsUrgent(movement, NOW_ANCHOR),
      );
      const handoverResult = urgentMovementsOutsideScope(
        openMovements,
        { kind: "service", id: service },
        units,
        referrals,
        NOW_ANCHOR,
      );
      expect(narrowResult.map((movement) => movement.id).sort()).toEqual(
        handoverResult.map((movement) => movement.id).sort(),
      );
    }
  });

  it("D-a's urgentMovementsOutsideService is a SUPERSET of the narrow rule, for every service — it only ever ADDS movements", () => {
    // MUTATION TARGET: if `movementIsUrgentForServiceSafety` ever regressed to drop the flagged-or-
    // breached case the narrow rule already covered, this goes red — the widening must never narrow.
    for (const service of HEALTH_SERVICES) {
      const narrowIds = new Set(
        openMovements
          .filter(
            (movement) => !movementBelongsToService(movement, service, units) && movementIsUrgent(movement, NOW_ANCHOR),
          )
          .map((movement) => movement.id),
      );
      const wideIds = new Set(
        urgentMovementsOutsideService(openMovements, service, units, NOW_ANCHOR, CONFIG).map((movement) => movement.id),
      );
      for (const id of narrowIds) {
        expect(wideIds.has(id), `${id} was urgent-outside under the narrow rule but D-a's rule dropped it`).toBe(true);
      }
    }
  });
});

describe("movementIsUrgentForServiceSafety — D-a's three conditions plus R2's fourth, each proven independently", () => {
  const rphEd = "rph-ed";

  it("a plain movement — nothing flagged, no legal clock, no escalation — is not urgent (negative control)", () => {
    const movement = baseMovement({ id: "WF-TEST-SAFETY-NONE", originEdId: rphEd });
    expect(movementIsUrgentForServiceSafety(movement, units, NOW_ANCHOR, CONFIG)).toBe(false);
  });

  it("flagged urgent counts, with nothing else present", () => {
    const movement = baseMovement({ id: "WF-TEST-SAFETY-FLAGGED", originEdId: rphEd, flaggedUrgent: true });
    expect(movementIsUrgentForServiceSafety(movement, units, NOW_ANCHOR, CONFIG)).toBe(true);
  });

  it("escalated counts, with no legal form and not flagged", () => {
    const movement = baseMovement({
      id: "WF-TEST-SAFETY-ESCALATED",
      originEdId: rphEd,
      escalation: { at: NOW_ANCHOR - 3, triedUnitIds: [], contact: "State bed coordination desk" },
    });
    expect(movementIsUrgentForServiceSafety(movement, units, NOW_ANCHOR, CONFIG)).toBe(true);
  });

  it("a legal form already BREACHED counts (legal_breached is a SEVERE_CAUSES member)", () => {
    const movement = baseMovement({
      id: "WF-TEST-SAFETY-BREACHED",
      originEdId: rphEd,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR - 10 },
    });
    expect(movementIsUrgentForServiceSafety(movement, units, NOW_ANCHOR, CONFIG)).toBe(true);
  });

  it("a legal form RUNNING OUT but not yet breached counts — the exact P1 gap R1 found (legal_expiring)", () => {
    const movement = baseMovement({
      id: "WF-TEST-SAFETY-EXPIRING",
      originEdId: rphEd,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR + 30 },
    });
    // MUTATION TARGET: the OLD `movementIsUrgent` rule (flagged-or-breached only) reads this exact
    // movement as NOT urgent — this is what proves the widening actually closes the gap.
    expect(movementIsUrgent(movement, NOW_ANCHOR)).toBe(false);
    expect(movementIsUrgentForServiceSafety(movement, units, NOW_ANCHOR, CONFIG)).toBe(true);
  });

  it("a legal form merely DUE (not running out) does not by itself count — the widening is not unbounded", () => {
    const movement = baseMovement({
      id: "WF-TEST-SAFETY-DUE",
      originEdId: rphEd,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR + 150 },
    });
    expect(movementIsUrgentForServiceSafety(movement, units, NOW_ANCHOR, CONFIG)).toBe(false);
  });

  it("R2: waited past the configured ED access target counts, with nothing else present", () => {
    const movement = baseMovement({
      id: "WF-TEST-SAFETY-EDWAIT",
      originEdId: rphEd,
      openedAt: NOW_ANCHOR - CONFIG.edAccessTargetMinutes - 1,
    });
    expect(movementIsUrgentForServiceSafety(movement, units, NOW_ANCHOR, CONFIG)).toBe(true);
  });

  it("R2: waited one minute UNDER the access target does not by itself count — the boundary is exact", () => {
    const movement = baseMovement({
      id: "WF-TEST-SAFETY-EDWAIT-UNDER",
      originEdId: rphEd,
      openedAt: NOW_ANCHOR - CONFIG.edAccessTargetMinutes + 1,
    });
    expect(movementIsUrgentForServiceSafety(movement, units, NOW_ANCHOR, CONFIG)).toBe(false);
  });

  it("R2: a CLOSED movement waited past the access target does not count — never a stale wait", () => {
    const movement = baseMovement({
      id: "WF-TEST-SAFETY-EDWAIT-CLOSED",
      originEdId: rphEd,
      openedAt: NOW_ANCHOR - CONFIG.edAccessTargetMinutes - 1,
      closure: { at: NOW_ANCHOR - 5, outcome: "arrived", reason: "Test fixture closure" },
    });
    expect(movementIsUrgentForServiceSafety(movement, units, NOW_ANCHOR, CONFIG)).toBe(false);
  });

  it("R2's exact catcher: WF-019 (~62h) and WF-020 (~29h), real seed, count via the ED-wait condition alone", () => {
    // Neither carries a legal form, an escalation, or a flag, and neither has been declined by
    // every eligible ward (delayGroups would read them severe if so) — the ED-wait condition is the
    // ONLY one of the four that can be responsible for either reading urgent.
    for (const id of ["WF-019", "WF-020"]) {
      const movement = movements.find((candidate) => candidate.id === id);
      expect(movement, `${id} missing from the seed`).toBeDefined();
      expect(movement!.flaggedUrgent, `${id} must not be flagged or this catcher proves nothing`).toBe(false);
      expect(movement!.escalation, `${id} must carry no escalation or this catcher proves nothing`).toBeUndefined();
      expect(
        movement!.legalForm?.dueAt,
        `${id} must carry no legal deadline or this catcher proves nothing`,
      ).toBeUndefined();
      expect(
        movementIsUrgentForServiceSafety(movement!, units, NOW_ANCHOR, CONFIG),
        `${id} must read urgent via the ED-wait condition`,
      ).toBe(true);
    }
  });
});

describe("SERVICE_SCOPED_SCREENS (D-e)", () => {
  it("names exactly the screens that read the service choice — Capacity, Delays and Movements", () => {
    // R2: Capacity's own service-scoping code (its `service`/`scopedNetworkRows`/`WardServiceScopeBar`
    // read) is now present in THIS worktree — see this constant's own doc comment in
    // ward-service-scope.ts, corrected alongside this test.
    expect([...SERVICE_SCOPED_SCREENS].sort()).toEqual(["Capacity", "Delays", "Movements"]);
  });
});
