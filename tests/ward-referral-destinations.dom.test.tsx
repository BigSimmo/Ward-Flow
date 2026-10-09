import { describe, expect, it } from "vitest";

import {
  destinationOptions,
  suburbOptions,
  type DestinationOption,
} from "@/components/ward-management/referrals/referral-destination-options";
import { CONTESTED_SUBURBS, lookupCatchment } from "@/components/ward-management/ward-catchment";
import {
  COHORTS,
  HOME_REGIONS,
  PARALLEL_REFERRAL_CAP,
  REFERRAL_DESTINATION_KINDS,
  SEXES,
  URGENCY_LEVELS,
  type Referral,
  type Unit,
  type WardReferralDestination,
} from "@/components/ward-management/ward-model";
import { referrals as seededReferrals } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
/**
 * THE REFERRAL DESTINATION PICKER — what a referring clinician is shown at the moment of choosing.
 *
 * Spec Part 7, "What the referrer IS shown" (`docs/ward-flow-referral-destination-spec.md`), and
 * FD-21: several destinations chosen in ONE act, up to `PARALLEL_REFERRAL_CAP`.
 *
 * Every test here pins a property the owner named in words, not an implementation detail:
 *
 *   - an option the catchment table cannot place is GREYED, never removed and never disabled;
 *   - a ward with no free bed is still offered;
 *   - a decline removes nothing from the list;
 *   - two of the same kind cannot be raised, and a double selection is never silently collapsed;
 *   - there is no free-text input anywhere on this screen;
 *   - a contested catchment is said, and never chosen for the clinician.
 *
 * NON-VACUITY runs through the file: every list assertion first pins that the list is non-empty
 * and carries the count the fixture implies, so a picker built over an empty array — the way this
 * whole family of tests passes while showing the clinician nothing — cannot read as green.
 */

const WARD_NEED: WardReferralDestination = {
  kind: "psychiatric_ward",
  sex: SEXES[0],
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
  highAcuityNursingNeeded: false,
};

/** A suburb the source table places with exactly one team, chosen FROM the table rather than
 *  written down here: a hand-picked spelling rots the day the table is re-extracted. */
function reviewedSuburb(): string {
  const found = suburbOptions().find((suburb) => lookupCatchment(suburb).state === "reviewed");
  expect(found, "no suburb in the source table resolves to a reviewed catchment").toBeDefined();
  return found as string;
}

/** One of the five cross-document contradictions, read from the data that records them. */
function contestedSuburb(): string {
  expect(CONTESTED_SUBURBS.length, "no contested suburbs are recorded").toBeGreaterThan(0);
  return CONTESTED_SUBURBS[0].suburb;
}

function optionsFor(overrides: Partial<Parameters<typeof destinationOptions>[0]> = {}): DestinationOption[] {
  return destinationOptions({
    suburb: null,
    ward: WARD_NEED,
    ageBand: COHORTS[0],
    units: allUnits(),
    referrals: seededReferrals,
    now: NOW_ANCHOR,
    ...overrides,
  });
}

function optionFor(kind: (typeof REFERRAL_DESTINATION_KINDS)[number], overrides = {}): DestinationOption {
  const found = optionsFor(overrides).find((option) => option.kind === kind);
  expect(found, `no option was built for ${kind}`).toBeDefined();
  return found as DestinationOption;
}

describe("Referral destinations — the option list itself", () => {
  it("offers exactly one option per destination kind, and never more than the parallel cap", () => {
    const options = optionsFor();

    // Non-vacuity first: an empty list would satisfy every "no option does X" assertion below.
    expect(options.length, "the picker offered no destinations at all").toBeGreaterThan(0);
    expect(options).toHaveLength(REFERRAL_DESTINATION_KINDS.length);
    // The count the fixture implies, written out rather than derived, so a kind quietly dropped
    // from the model is a decision somebody takes here rather than a number that moves on its own.
    expect(options).toHaveLength(3);
    expect(options.map((option) => option.kind).sort()).toEqual([...REFERRAL_DESTINATION_KINDS].sort());

    // THE CAP, enforced where it can actually be enforced. One option per kind means the screen
    // cannot offer more than there are kinds; this is what makes that safe rather than lucky.
    expect(REFERRAL_DESTINATION_KINDS.length).toBeLessThanOrEqual(PARALLEL_REFERRAL_CAP);
  });

  it("orders by catchment, then by name", () => {
    expect(optionsFor({ suburb: reviewedSuburb() }).map((option) => option.label)).toEqual([
      "Community team",
      "Emergency department",
      "Psychiatric ward",
    ]);
  });

  it("carries no rank, score, weight or percentage on any option", () => {
    for (const option of optionsFor({ suburb: reviewedSuburb() })) {
      expect(Object.keys(option)).not.toContain("score");
      expect(Object.keys(option)).not.toContain("rank");
      expect(Object.keys(option)).not.toContain("weight");
      for (const sentence of [option.catchment.sentence, ...option.figures, ...option.reasons]) {
        expect(sentence, `${option.kind} shows a percentage: ${sentence}`).not.toMatch(/%/);
        expect(sentence, `${option.kind} shows a rank or score: ${sentence}`).not.toMatch(/\b(score|rank|rating)\b/i);
      }
    }
  });
});

describe("Referral destinations — catchment, said rather than guessed", () => {
  it("names the team the source table places this suburb with, and suggests that option", () => {
    const suburb = reviewedSuburb();
    const option = optionFor("community_team", { suburb });

    expect(option.catchment.placedBySourceTable).toBe(true);
    expect(option.catchment.outsideTheTable).toBe(false);
    expect(option.catchment.sentence).toContain(suburb);
    expect(option.suggested).toBe(true);
    expect(option.reasons.join(" ")).toMatch(/serves this patient's suburb/i);
  });

  it("says a contested catchment is contested, carries both readings, and suggests nothing", () => {
    const option = optionFor("community_team", { suburb: contestedSuburb() });

    expect(option.catchment.placedBySourceTable).toBe(false);
    expect(option.catchment.outsideTheTable).toBe(true);
    // Both readings, each attributed — spec Part 5. A sentence naming one team would be the
    // silent routing that Part 5 refuses.
    const readings = CONTESTED_SUBURBS[0].answers;
    expect(readings.length, "the contested fixture carries fewer than two readings").toBeGreaterThan(1);
    for (const reading of readings) {
      expect(option.catchment.sentence).toContain(reading.clinics.join(" or "));
    }
    // NOT auto-selected: a contested suburb does not route.
    expect(option.suggested).toBe(false);
  });

  it("says so when the suburb is not in the source table, and does not suggest a team", () => {
    const option = optionFor("community_team", { suburb: "Nowhere In The Table" });

    expect(option.catchment.placedBySourceTable).toBe(false);
    expect(option.catchment.outsideTheTable).toBe(true);
    expect(option.suggested).toBe(false);
  });

  it("claims no catchment at all when no suburb has been chosen", () => {
    const option = optionFor("community_team", { suburb: null });

    expect(option.catchment.placedBySourceTable).toBe(false);
    // Nothing is known, so nothing is outside anything: an unanswered question is not a deviation.
    expect(option.catchment.outsideTheTable).toBe(false);
    expect(option.suggested).toBe(false);
  });

  it("says plainly that a ward and an emergency department have no catchment in these sources", () => {
    const suburb = reviewedSuburb();
    for (const kind of ["psychiatric_ward", "emergency_department"] as const) {
      const option = optionFor(kind, { suburb });
      expect(option.catchment.placedBySourceTable).toBe(false);
      expect(option.catchment.outsideTheTable).toBe(false);
      expect(option.catchment.sentence).toMatch(/approved-hospital column is not seeded/i);
    }
  });
});

describe("Referral destinations — nothing is removed from the list", () => {
  it("still offers a psychiatric ward when no unit in the network has a free bed", () => {
    const noBeds: Unit[] = allUnits().map((unit) => ({
      ...unit,
      empty: { ...unit.empty, value: 0 },
      allocatable: { ...unit.allocatable, value: 0 },
    }));
    expect(noBeds.length, "the network fixture holds no units at all").toBeGreaterThan(0);

    const option = optionFor("psychiatric_ward", { units: noBeds });

    expect(option.figures.join(" ")).toContain(`0 of ${noBeds.length}`);
    // Offered anyway — the owner's rule. A ward with no bed today is still the right place to ask.
    expect(option.reasons.join(" ")).toMatch(/still offered/i);
  });

  it("still offers a psychiatric ward when a ward has already declined a referral", () => {
    const declined: Referral[] = [
      {
        id: "RF-declined-probe",
        destinations: [
          { destination: WARD_NEED, state: "declined", decidedAt: NOW_ANCHOR, declineReason: "no_suitable_bed" },
        ],
        ageBand: COHORTS[0],
        homeRegion: HOME_REGIONS[0],
        suburb: { kind: "named", name: "Armadale" },
        source: "community",
        raisedAt: NOW_ANCHOR - 60,
        urgency: URGENCY_LEVELS[0],
        originSiteCode: wardSites[0].code,
        transportNeeded: false,
        ...FIXTURE_HISTORY,
      },
    ];

    const options = destinationOptions({
      suburb: null,
      ward: WARD_NEED,
      ageBand: COHORTS[0],
      units: allUnits(),
      referrals: declined,
      now: NOW_ANCHOR,
    });

    expect(options.map((option) => option.kind)).toContain("psychiatric_ward");
    expect(options).toHaveLength(REFERRAL_DESTINATION_KINDS.length);
  });
});

/*
 * The on-screen half of this file ("on the screen", "carries the person through", "refuses at load
 * for a patientId naming nobody") rendered the full-page intake form, retired on 8 Oct 2026. The
 * referral slide-out (`referrals/ward-referral-drawer.tsx`) is now the one place a referral is
 * written; those owner properties (no destination chosen for the clinician, the ward + community
 * refusal, greyed-not-removed options, no free text outside the history, the patient link's read
 * half, and refusing an unknown patientId) belong to the slide-out's own suite. The option-list
 * half above is the shared engine and stands unchanged.
 */
