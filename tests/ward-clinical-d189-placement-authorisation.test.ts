import { describe, expect, it } from "vitest";

import { authorisationReasonNeeded } from "@/components/ward-management/capacity/planned-admissions-draft";
import { networkServiceGroupTotals } from "@/components/ward-management/capacity/capacity-derivations";
import { hubEntries } from "@/components/ward-management/hub/hub-derivations";
import { findBeds, type BedFinderFilters } from "@/components/ward-management/tools/ward-bed-finder";
import {
  AUTHORISATION_NOT_STATED,
  authorisationBlocksPlacement,
  authorisationLabel,
  unitAuthorisation,
} from "@/components/ward-management/ward-authorisation";
import { demoNetwork, type DemoNetworkVariant } from "@/components/ward-management/ward-demo-network";
import { buildActionInbox, destinationNoLongerLawful } from "@/components/ward-management/ward-derivations";
import {
  eligibility,
  involuntaryBedNeededForLegalStatus,
  referralEligibility,
  wardAddressing,
} from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { applyHardCasesOverlay } from "@/components/ward-management/ward-hard-cases-demo";
import {
  heldUnitAuthorisationGap,
  heldUnitAuthorisationRefusal,
} from "@/components/ward-management/ward-held-legal-check";
import { causeOf } from "@/components/ward-management/delays/delays-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS, MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { LegalStatus, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * D-189 items 6, 8(a) and 9(a) (Josh, 13 Nov 2026): until Q42 is signed, every ward reads "not
 * stated" for authorisation and the invented `authorised` flag steers no placement path. This is the
 * ruling's agreement test: for every unit the app can show (the real network, every demo network and
 * the hard-case units), the label and every placement path agree, so no path refuses or warns
 * because of the flag.
 */

const NOW = NOW_ANCHOR;
const VARIANTS: readonly DemoNetworkVariant[] = ["demo", "surge", "quiet", "winter", "ed-crisis"];
const NEEDS_THE_BED: readonly LegalStatus[] = [
  "Involuntary inpatient",
  "Detained awaiting examination",
  "Referred for psychiatric examination",
];

function everyUnit(): Unit[] {
  const seen = new Map<string, Unit>();
  const add = (label: string, units: readonly Unit[]) => {
    for (const unit of units) seen.set(`${label}:${unit.id}`, unit);
  };
  add("network", allUnits());
  for (const variant of VARIANTS)
    add(
      variant,
      demoNetwork(variant).sites.flatMap((site) => site.units),
    );
  add("hard-cases", applyHardCasesOverlay(seedWardFlowState(), NOW).units);
  return [...seen.values()];
}

const UNITS = everyUnit();
const SEED = seedWardFlowState();
const OPEN_MOVEMENT = SEED.movements.find((movement) => movement.closure === undefined)!;

/** An open movement accepted at this unit, with a status that needs an involuntary-capable bed. */
function acceptedAt(unit: Unit, legalStatus: LegalStatus | undefined): Movement {
  return {
    ...OPEN_MOVEMENT,
    legalStatus: legalStatus as LegalStatus,
    acceptedUnitId: unit.id,
    statusChanges: [{ ...(OPEN_MOVEMENT.statusChanges[0] ?? {}), at: NOW - 10 } as Movement["statusChanges"][number]],
    overrides: [],
  };
}

/** A seeded ward request whose recorded legal status needs an involuntary-capable bed. */
const REQUEST = (() => {
  for (const referral of SEED.referrals) {
    const addressing = wardAddressing(referral);
    if (!addressing) continue;
    const withStatus = {
      ...referral,
      intake: { ...(referral.intake ?? {}), legalStatus: "Involuntary inpatient" },
    } as unknown as Referral;
    return { referral: withStatus, ward: { ...addressing.destination, involuntaryBedNeeded: true } };
  }
  throw new Error("the seed has no ward request");
})();

// D-209 item 9 (Josh, 14 Nov 2026): the Chief Psychiatrist's Register of Authorised Hospitals, 7 Sep
// 2026, matched by hospital and service type. Typed here apart from the source file on purpose.
const REGISTER_ON = new Set([
  "rph-adult-secure",
  "scgh-adult-open",
  "fsh-adult-secure",
  "arm-adult-open",
  "sjgm-adult-open",
  "rgh-adult-secure",
  "fre-adult-open",
  "fre-older-adult",
  "bty-adult-secure",
  "bty-older-adult",
  "bty-youth",
  "gry-adult-secure",
  "alb-adult-open",
  "bun-adult-open",
  "brm-adult-secure",
  "ger-adult-open",
]);
const REGISTER_OFF = new Set(["sjgs-adult-open", "sjgs-adult-secure"]);
const expectedLabel = (id: string) =>
  REGISTER_ON.has(id)
    ? "Involuntary admissions: authorised for the hospital (Chief Psychiatrist register, 7 Sep 2026), ward not checked"
    : REGISTER_OFF.has(id)
      ? "Involuntary admissions: not on the authorised register (7 Sep 2026)"
      : "Involuntary admissions: not stated";

describe("D-189 item 8(a), D-209 item 9: every unit reads the register, and the switch never steers", () => {
  it("covers the real network, every demo network and the hard cases, including the flagged wards", () => {
    expect(UNITS.length).toBeGreaterThan(allUnits().length);
    // The sample data still carries wards flagged false, so this test is not vacuous.
    expect(UNITS.some((unit) => unit.authorised === false)).toBe(true);
    expect(UNITS.some((unit) => unit.id === "sjgs-adult-open")).toBe(true);
    expect(UNITS.some((unit) => unit.id === "sjgs-adult-secure")).toBe(true);
  });

  it.each(UNITS.map((unit) => [unit.id, unit] as const))("%s: label and switch agree", (_id, unit) => {
    expect(unitAuthorisation(unit)).toBe(
      REGISTER_ON.has(unit.id) ? "on_register" : REGISTER_OFF.has(unit.id) ? "not_on_register" : "not_stated",
    );
    expect(authorisationLabel(unit)).toBe(expectedLabel(unit.id));
    expect(AUTHORISATION_NOT_STATED).toBe("Not stated");
    expect(authorisationBlocksPlacement(unit)).toBe(false);
  });
});

describe("D-189 items 8(a) and 9(a): no placement path refuses or warns because of the flag", () => {
  it.each(UNITS.map((unit) => [unit.id, unit] as const))("%s", (_id, unit) => {
    for (const legalStatus of [...NEEDS_THE_BED, undefined]) {
      // The D-69 rule still says the person needs an involuntary-capable bed...
      expect(involuntaryBedNeededForLegalStatus(legalStatus)).toBe(true);
      const movement = acceptedAt(unit, legalStatus);

      // ...but the fit check's gate passes, is information only and marks the need.
      const gate = eligibility(movement, unit, NOW).gates.find((candidate) => candidate.gate === "authorisation");
      expect(gate).toEqual({
        gate: "authorisation",
        pass: true,
        info: true,
        need: true,
        detail: expectedLabel(unit.id),
        authorisation: unitAuthorisation(unit),
      });

      // Held-bed refusals (handover, transport, collection, arrival, restore pull).
      expect(heldUnitAuthorisationGap(movement, [unit])).toBeUndefined();
      expect(heldUnitAuthorisationRefusal({ units: [unit] }, movement)).toBeNull();
      // Exceptions "no longer lawful" item, the Delays reason and the cockpit notice.
      expect(destinationNoLongerLawful(movement, [unit])).toBeUndefined();
      expect(
        buildActionInbox([movement], NOW, [unit]).filter((item) => item.id.startsWith("destination-unlawful-")),
      ).toEqual([]);
      // The Delays cause is the same as at the same unit with the flag set true.
      const flaggedTrue = { ...unit, authorised: true };
      expect(causeOf(movement, [unit], NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBe(
        causeOf(movement, [flaggedTrue], NOW, DEFAULT_DUE_SOON_THRESHOLDS),
      );
      // The planned-admission reason prompt.
      if (legalStatus !== undefined) expect(authorisationReasonNeeded(legalStatus, unit)).toBe(false);
    }

    // The referral path's legal_status gate.
    const referralGate = referralEligibility(REQUEST.referral, REQUEST.ward, unit, NOW).gates.find(
      (candidate) => candidate.gate === "legal_status",
    );
    expect(referralGate).toMatchObject({ pass: true, info: true, need: true });
  });

  it("the bed finder lists the same wards for Involuntary as for Voluntary, SJGS included", () => {
    const filters = (legalStatus: "voluntary" | "involuntary", cohort: Unit["cohort"]): BedFinderFilters => ({
      cohort,
      bed: "any",
      sex: "any",
      legalStatus,
      home: "any",
    });
    for (const cohort of new Set(UNITS.map((unit) => unit.cohort))) {
      const ids = (legalStatus: "voluntary" | "involuntary") =>
        findBeds(UNITS, SEED.admissions, SEED.bedReleases, filters(legalStatus, cohort), []).map((row) => row.unit.id);
      expect(ids("involuntary")).toEqual(ids("voluntary"));
    }
    const adult = findBeds(allUnits(), SEED.admissions, SEED.bedReleases, filters("involuntary", "Adult"), []).map(
      (row) => row.unit.id,
    );
    expect(adult).toEqual(expect.arrayContaining(["sjgs-adult-open", "sjgs-adult-secure"]));
  });

  it("the engine books a planned admission for an involuntary person on a flagged ward without a reason", () => {
    const flagged = SEED.units.find((unit) => unit.authorised === false && !unit.isClosed && unit.cohort === "Adult");
    expect(flagged, "the seed needs a flagged adult ward").toBeDefined();
    const after = wardFlowReducer(SEED, {
      type: "BOOK_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW,
      initials: "ab",
      sex: flagged!.sexDesignation === "Male only" ? "Male" : "Female",
      gender: flagged!.sexDesignation === "Male only" ? "Male" : "Female",
      reason: "respite",
      unitId: flagged!.id,
      expectedArrivalAt: NOW + MINUTES_PER_DAY,
      expectedStayDays: 7,
      legalStatus: "Involuntary inpatient",
      ageBand: "Adult",
    });
    expect(after.rejections).toEqual([]);
    expect(after.plannedAdmissions.at(-1)?.authorisationOverride).toBeUndefined();
  });

  it("the engine accepts a ward request with no recorded legal status at a flagged ward", () => {
    const flagged = SEED.units.filter((unit) => unit.authorised === false);
    const candidate = SEED.referrals.flatMap((referral) =>
      referral.destinations
        .filter(
          (arm) =>
            arm.destination.kind === "psychiatric_ward" && arm.state === "queued" && arm.withdrawnAt === undefined,
        )
        .flatMap((arm) =>
          flagged
            .filter((unit) => arm.destination.kind === "psychiatric_ward" && arm.destination.unitId === unit.id)
            .map((unit) => ({ referral, unit })),
        ),
    )[0];
    if (!candidate) return; // the seed addresses no live request to a flagged ward; the gate test above covers it
    const unrecorded = { ...candidate.referral, intake: undefined } as Referral;
    const before: WardFlowState = {
      ...SEED,
      referrals: SEED.referrals.map((referral) => (referral.id === unrecorded.id ? unrecorded : referral)),
    };
    const after = wardFlowReducer(before, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: unrecorded.id,
      unitId: candidate.unit.id,
    });
    expect(after.rejections.map((rejection) => rejection.reason).join(" ")).not.toMatch(/legal_status|authoris/iu);
  });

  it("no hub entry or capacity group carries an authorisation fact", () => {
    const entries = hubEntries({
      units: SEED.units,
      sites: [],
      bedReleases: SEED.bedReleases,
      admissions: SEED.admissions,
      namedHolds: [],
      now: NOW,
    });
    expect(entries.some((entry) => "authorised" in entry)).toBe(false);
    expect("authorised" in networkServiceGroupTotals([])).toBe(false);
  });
});
