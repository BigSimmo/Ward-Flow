// tests/ward-ed-home-derivations.test.ts
import { describe, expect, it } from "vitest";

import {
  ED_HOME_SERVICE_BAND_ORDER,
  edHomeSummaries,
  edHomeTotals,
  edOpenSummaries,
  groupByHealthService,
  isDetainedUnderTheAct,
  ofPopulation,
  worstEdSummary,
} from "@/components/ward-management/ed/ed-home-derivations";
import { ED_ACCESS_TARGET_MINUTES, type Movement } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

const NOW = 10_000;

/** The minimum valid `Movement`, overridable per test. Every field a real movement needs and
 *  nothing this file does not touch. */
function movement(overrides: Partial<Movement> & Pick<Movement, "id" | "originEdId">): Movement {
  return {
    openedAt: NOW - 60,
    flaggedUrgent: false,
    urgency: 2,
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
    owner: "Test owner",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

describe("isDetainedUnderTheAct", () => {
  it("counts the two legal statuses that place a person under the Act", () => {
    expect(isDetainedUnderTheAct("Detained awaiting examination")).toBe(true);
    expect(isDetainedUnderTheAct("Involuntary inpatient")).toBe(true);
  });

  it("does not count Voluntary or a not-yet-detained examination referral", () => {
    expect(isDetainedUnderTheAct("Voluntary")).toBe(false);
    expect(isDetainedUnderTheAct("Referred for psychiatric examination")).toBe(false);
  });
});

describe("edHomeSummaries", () => {
  const eds = allEmergencyDepartments();
  const [edA, edB] = eds;

  it("returns exactly one summary per real emergency department — the collection itself, not a hospital walk", () => {
    const summaries = edHomeSummaries([], NOW, ED_ACCESS_TARGET_MINUTES);
    expect(summaries).toHaveLength(eds.length);
    expect(summaries.map((s) => s.ed.id).sort()).toEqual(eds.map((ed) => ed.id).sort());
  });

  it("counts only open movements at the matching department, never a closed one or another department's", () => {
    const movements: Movement[] = [
      movement({ id: "WF-001", originEdId: edA.id }),
      movement({ id: "WF-002", originEdId: edA.id, stage: "arrived" }), // closed by stage
      movement({ id: "WF-003", originEdId: edA.id, closure: { at: NOW, outcome: "arrived", reason: "x" } }), // closed by closure
      movement({ id: "WF-004", originEdId: edB.id }), // a different department
    ];
    const summaries = edHomeSummaries(movements, NOW, ED_ACCESS_TARGET_MINUTES);
    const summaryA = summaries.find((s) => s.ed.id === edA.id);
    const summaryB = summaries.find((s) => s.ed.id === edB.id);
    expect(summaryA?.waiting).toBe(1);
    expect(summaryB?.waiting).toBe(1);
  });

  it("computes the longest wait among a department's own open movements, clamped at zero", () => {
    const movements: Movement[] = [
      movement({ id: "WF-010", originEdId: edA.id, openedAt: NOW - 30 }),
      movement({ id: "WF-011", originEdId: edA.id, openedAt: NOW - 90 }),
      movement({ id: "WF-012", originEdId: edA.id, openedAt: NOW + 500 }), // future openedAt: clamp
    ];
    const summary = edHomeSummaries(movements, NOW, ED_ACCESS_TARGET_MINUTES).find((s) => s.ed.id === edA.id);
    expect(summary?.longestWaitMinutes).toBe(90);
  });

  it("counts detained and past-access-target from the real predicate and the deadline constant", () => {
    const movements: Movement[] = [
      movement({ id: "WF-020", originEdId: edA.id, legalStatus: "Involuntary inpatient" }),
      movement({ id: "WF-022", originEdId: edA.id, openedAt: NOW - ED_ACCESS_TARGET_MINUTES }),
      movement({ id: "WF-023", originEdId: edA.id, openedAt: NOW - (ED_ACCESS_TARGET_MINUTES - 1) }),
    ];
    const summary = edHomeSummaries(movements, NOW, ED_ACCESS_TARGET_MINUTES).find((s) => s.ed.id === edA.id);
    expect(summary?.detained).toBe(1);
    expect(summary?.pastAccessTarget).toBe(1);
  });

  /**
   * Task 6 of the audit-wiring plan, 2026-09-16. `accessTargetMinutes` is a REQUIRED third
   * parameter, not a default read from `ED_ACCESS_TARGET_MINUTES` — this is what proves the
   * function actually reads its argument rather than the module constant, independent of whatever
   * the constant's own value happens to be today.
   */
  it("reads the accessTargetMinutes argument, never a fixed constant", () => {
    const movements: Movement[] = [
      movement({ id: "WF-024", originEdId: edA.id, openedAt: NOW - 720 }),
      movement({ id: "WF-025", originEdId: edA.id, openedAt: NOW - 719 }),
    ];

    const atA720Target = edHomeSummaries(movements, NOW, 720).find((s) => s.ed.id === edA.id);
    expect(atA720Target?.pastAccessTarget, "720 elapsed minutes must count at a 720-minute target").toBe(1);

    const atA1440Target = edHomeSummaries(movements, NOW, 1440).find((s) => s.ed.id === edA.id);
    expect(atA1440Target?.pastAccessTarget, "720 elapsed minutes must not count at a 1440-minute target").toBe(0);
  });

  it("counts the intersection — detained AND past the access target — separately from either alone", () => {
    const movements: Movement[] = [
      // Detained, but not past the target.
      movement({ id: "WF-030", originEdId: edA.id, legalStatus: "Involuntary inpatient", openedAt: NOW - 30 }),
      // Past the target, but not detained.
      movement({
        id: "WF-031",
        originEdId: edA.id,
        legalStatus: "Voluntary",
        openedAt: NOW - ED_ACCESS_TARGET_MINUTES,
      }),
      // Both at once.
      movement({
        id: "WF-032",
        originEdId: edA.id,
        legalStatus: "Detained awaiting examination",
        openedAt: NOW - ED_ACCESS_TARGET_MINUTES,
      }),
    ];
    const summary = edHomeSummaries(movements, NOW, ED_ACCESS_TARGET_MINUTES).find((s) => s.ed.id === edA.id);
    expect(summary?.detained).toBe(2);
    expect(summary?.pastAccessTarget).toBe(2);
    expect(summary?.detainedAndPastAccessTarget).toBe(1);
  });

  /**
   * ⚠️ THIS SCREEN MUST NEVER COUNT "DECLINED BY EVERY WARD" / "NOBODY LOOKING" — corrected
   * ruling, 2026-09-04. A movement authored exactly like WF-009 in the real seed
   * (`referredUnitIds: []`, non-empty `declines`) must not change any figure this module produces,
   * proving the fields are genuinely unread rather than merely unlabelled.
   */
  it("is unaffected by referredUnitIds/declines, however they are set", () => {
    const base = { id: "WF-040" as const, originEdId: edA.id };
    const computedFigures = (s: ReturnType<typeof edHomeSummaries>[number] | undefined) => ({
      waiting: s?.waiting,
      longestWaitMinutes: s?.longestWaitMinutes,
      detained: s?.detained,
      pastAccessTarget: s?.pastAccessTarget,
      detainedAndPastAccessTarget: s?.detainedAndPastAccessTarget,
    });
    const withoutReferralActivity = edHomeSummaries(
      [movement({ ...base, referredUnitIds: [], declines: [] })],
      NOW,
      ED_ACCESS_TARGET_MINUTES,
    ).find((s) => s.ed.id === edA.id);
    const withDeclinesAndNoReferral = edHomeSummaries(
      [movement({ ...base, referredUnitIds: [], declines: [{ unitId: "u1", at: 0, reason: "no_bed" }] })],
      NOW,
      ED_ACCESS_TARGET_MINUTES,
    ).find((s) => s.ed.id === edA.id);
    expect(computedFigures(withDeclinesAndNoReferral)).toEqual(computedFigures(withoutReferralActivity));
  });
});

describe("edOpenSummaries", () => {
  const eds = allEmergencyDepartments();
  const [edA] = eds;

  it("computes waiting/longestWaitMinutes/detained identically to edHomeSummaries, with no target argument at all", () => {
    const movements: Movement[] = [
      movement({ id: "WF-026", originEdId: edA.id, legalStatus: "Involuntary inpatient", openedAt: NOW - 90 }),
      movement({ id: "WF-027", originEdId: edA.id, openedAt: NOW - 30 }),
    ];
    const open = edOpenSummaries(movements, NOW).find((s) => s.ed.id === edA.id);
    const full = edHomeSummaries(movements, NOW, ED_ACCESS_TARGET_MINUTES).find((s) => s.ed.id === edA.id);
    expect(open?.waiting).toBe(full?.waiting);
    expect(open?.longestWaitMinutes).toBe(full?.longestWaitMinutes);
    expect(open?.detained).toBe(full?.detained);
    expect(open?.open).toEqual(full?.open);
  });

  it("never carries pastAccessTarget or detainedAndPastAccessTarget", () => {
    const open = edOpenSummaries([], NOW)[0];
    expect(open && "pastAccessTarget" in open).toBe(false);
    expect(open && "detainedAndPastAccessTarget" in open).toBe(false);
  });
});

describe("edHomeTotals", () => {
  const eds = allEmergencyDepartments();
  const [edA, edB] = eds;

  it("sums waiting, detained and the detained-and-past-target intersection across every department", () => {
    const movements: Movement[] = [
      movement({
        id: "WF-050",
        originEdId: edA.id,
        legalStatus: "Involuntary inpatient",
        openedAt: NOW - ED_ACCESS_TARGET_MINUTES,
      }),
      movement({ id: "WF-051", originEdId: edB.id, legalStatus: "Detained awaiting examination" }),
    ];
    const summaries = edHomeSummaries(movements, NOW, ED_ACCESS_TARGET_MINUTES);
    const totals = edHomeTotals(summaries, NOW);
    expect(totals.waiting).toBe(2);
    expect(totals.detained).toBe(2);
    expect(totals.detainedAndPastAccessTarget).toBe(1);
  });

  it("names the single longest-open movement network-wide, not each department's own maximum", () => {
    const movements: Movement[] = [
      movement({ id: "WF-060", originEdId: edA.id, openedAt: NOW - 30 }),
      movement({ id: "WF-061", originEdId: edB.id, openedAt: NOW - 500 }),
    ];
    const summaries = edHomeSummaries(movements, NOW, ED_ACCESS_TARGET_MINUTES);
    const totals = edHomeTotals(summaries, NOW);
    expect(totals.longestWait?.movement.id).toBe("WF-061");
    expect(totals.longestWait?.waitMinutes).toBe(500);
    expect(totals.longestWait?.summary.ed.id).toBe(edB.id);
  });

  it("lists exactly the departments past their own access target, and no others", () => {
    const movements: Movement[] = [
      movement({ id: "WF-070", originEdId: edA.id, openedAt: NOW - ED_ACCESS_TARGET_MINUTES }),
      movement({ id: "WF-071", originEdId: edB.id, openedAt: NOW - 30 }),
    ];
    const summaries = edHomeSummaries(movements, NOW, ED_ACCESS_TARGET_MINUTES);
    const totals = edHomeTotals(summaries, NOW);
    expect(totals.departmentsPastAccessTarget.map((s) => s.ed.id)).toEqual([edA.id]);
  });
});

describe("worstEdSummary", () => {
  const eds = allEmergencyDepartments();
  const [edA, edB] = eds;

  it("ranks a past-access-target breach above a higher raw waiting count", () => {
    const movements: Movement[] = [
      // edA: one patient, but past the access target.
      movement({ id: "WF-080", originEdId: edA.id, openedAt: NOW - ED_ACCESS_TARGET_MINUTES }),
      // edB: five patients, none past the target.
      movement({ id: "WF-081", originEdId: edB.id, openedAt: NOW - 10 }),
      movement({ id: "WF-082", originEdId: edB.id, openedAt: NOW - 10 }),
      movement({ id: "WF-083", originEdId: edB.id, openedAt: NOW - 10 }),
      movement({ id: "WF-084", originEdId: edB.id, openedAt: NOW - 10 }),
      movement({ id: "WF-085", originEdId: edB.id, openedAt: NOW - 10 }),
    ];
    const summaries = edHomeSummaries(movements, NOW, ED_ACCESS_TARGET_MINUTES);
    expect(worstEdSummary(summaries)?.ed.id).toBe(edA.id);
  });

  it("breaks a tie between two access-target breaches by the number detained, not raw volume", () => {
    const movements: Movement[] = [
      // edA: past target, one detained, five waiting.
      movement({
        id: "WF-090",
        originEdId: edA.id,
        openedAt: NOW - ED_ACCESS_TARGET_MINUTES,
        legalStatus: "Involuntary inpatient",
      }),
      movement({ id: "WF-091", originEdId: edA.id, openedAt: NOW - 10 }),
      movement({ id: "WF-092", originEdId: edA.id, openedAt: NOW - 10 }),
      movement({ id: "WF-093", originEdId: edA.id, openedAt: NOW - 10 }),
      movement({ id: "WF-094", originEdId: edA.id, openedAt: NOW - 10 }),
      // edB: past target, two detained, two waiting.
      movement({
        id: "WF-095",
        originEdId: edB.id,
        openedAt: NOW - ED_ACCESS_TARGET_MINUTES,
        legalStatus: "Involuntary inpatient",
      }),
      movement({ id: "WF-096", originEdId: edB.id, openedAt: NOW - 10, legalStatus: "Detained awaiting examination" }),
    ];
    const summaries = edHomeSummaries(movements, NOW, ED_ACCESS_TARGET_MINUTES);
    expect(worstEdSummary(summaries)?.ed.id).toBe(edB.id);
  });
});

describe("groupByHealthService", () => {
  it("assigns every real department to exactly one of the four bands, East then North then South then CAHS", () => {
    expect(ED_HOME_SERVICE_BAND_ORDER).toEqual(["East Metro", "North Metro", "South Metro", "CAHS"]);
    const summaries = edHomeSummaries([], NOW, ED_ACCESS_TARGET_MINUTES);
    const bands = groupByHealthService(summaries);
    expect(bands.map((band) => band.service)).toEqual(["East Metro", "North Metro", "South Metro", "CAHS"]);
    // Perth Children's is the CAHS band's one department (owner ruling 2026-09-25).
    expect(bands[3].departments.map((summary) => summary.ed.id)).toEqual(["pch-ed"]);
    const totalAcrossBands = bands.reduce((sum, band) => sum + band.departments.length, 0);
    expect(totalAcrossBands).toBe(allEmergencyDepartments().length);
  });
});

describe("ofPopulation", () => {
  it("names the population and pluralises it", () => {
    expect(ofPopulation(8, "department")).toBe("of 8 departments");
    expect(ofPopulation(9, "patient")).toBe("of 9 patients");
  });

  it("keeps the noun singular for exactly one", () => {
    expect(ofPopulation(1, "department")).toBe("of 1 department");
  });
});
