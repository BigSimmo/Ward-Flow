import { describe, expect, it } from "vitest";

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import {
  bedKindGaps,
  bedKindTotals,
  combinedKindGap,
  type BedKindGap,
} from "@/components/ward-management/capacity/capacity-derivations";
import { heldUpReleases } from "@/components/ward-management/capacity/capacity-held-up";
import { groupDischarges } from "@/components/ward-management/discharges/discharge-board-model";
import { GROUP_TITLES } from "@/components/ward-management/discharges/discharge-release-actions";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import {
  DEFAULT_DUE_SOON_THRESHOLDS,
  MINUTES_PER_DAY,
  dueSoonThresholdsOf,
} from "@/components/ward-management/ward-clock";
import {
  BED_RELEASE_BLOCKED_FIGURE_LABEL,
  BED_RELEASES_HELD_UP_ANY_DATE_LABEL,
} from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  HELD_UP_ANY_DATE_LABEL,
  HELD_UP_BY_TOMORROW_LABEL,
  heldUpDueByTomorrow,
  isHeldUpDueByTomorrow,
} from "@/components/ward-management/ward-held-up";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { WARD_SCENARIOS, scenarioWardNetwork } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { wardFlowReleaseGroup } from "@/components/ward-management/ward/ward-home-tab-model";

/**
 * Fix package W (Josh, 13 Nov 2026, D-191 items 5 and 6; F-105, A14-11). Synthetic data only.
 * Item 5: "held up" is one count, due by tomorrow (overdue, today, tomorrow), on Capacity, Ward,
 * TV, the sheet, Home and the menu; Discharges keeps its own "any date" group and says so.
 * Item 6: "short" adds each bed kind's shortfall and never takes off a spare bed of another kind.
 */
const NOW = NOW_ANCHOR;
const unit = allUnits()[0]!;

function release(id: string, overrides: Partial<BedRelease>): BedRelease {
  return {
    id,
    unitId: unit.id,
    admissionId: `AD-${id}`,
    state: "expected",
    expectedAt: NOW + 60,
    waitingOn: null,
    blocker: BED_RELEASE_BLOCKERS[0],
    blockedBy: "NUM Test Unit",
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
}

describe("D-191 item 5: one held-up definition, due by tomorrow", () => {
  it("counts overdue, today and tomorrow; never later, never discharged, never without a blocker", () => {
    const cases: [BedRelease, boolean][] = [
      [release("overdue", { expectedAt: NOW - 3 * MINUTES_PER_DAY }), true],
      [release("today", {}), true],
      [release("tomorrow", { state: "confirmed", expectedAt: NOW + MINUTES_PER_DAY }), true],
      [release("later", { expectedAt: NOW + 3 * MINUTES_PER_DAY }), false],
      [release("clear", { blocker: null, blockedBy: null }), false],
      [release("gone", { state: "discharged", blocker: null, blockedBy: null }), false],
    ];
    for (const [each, expected] of cases) expect(isHeldUpDueByTomorrow(each, NOW), each.id).toBe(expected);
  });

  const seed = seedWardFlowState();
  const expected = heldUpDueByTomorrow(seed.bedReleases, NOW).length;
  const anyDate = seed.bedReleases.filter((each) => each.state !== "discharged" && each.blocker !== null).length;

  it("the seed holds a held-up release beyond tomorrow, so the windows really differ", () => {
    expect(expected).toBeGreaterThan(0);
    expect(anyDate).toBeGreaterThan(expected);
  });

  it("Capacity, the sheet, the TV, the menu and the ward breakdown give the same count", () => {
    expect(heldUpReleases(seed.bedReleases, NOW).total, "Capacity").toBe(expected);
    const sheet = bedMeetingSheet({
      ...seed,
      now: NOW,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      service: null,
      nameOf: (movement) => movement.id,
      referrals: seed.referrals,
      referralLimitMinutes: seed.configuration.referralDecisionTargetMinutes,
    });
    expect(sheet.discharges.heldUp, "sheet and TV").toBe(expected);
    const perWard = seed.units.reduce(
      (sum, each) => sum + capacityBreakdown(each, seed.bedReleases, seed.leaveBeds, NOW).blockedToday,
      0,
    );
    expect(perWard, "capacityBreakdown().blockedToday").toBe(expected);
    const scenario = WARD_SCENARIOS[0]!;
    const nav = wardNavCounts({
      movements: seed.movements,
      units: seed.units,
      sites: scenarioWardNetwork(scenario).sites,
      referrals: seed.referrals,
      bedReleases: seed.bedReleases,
      leaveBeds: seed.leaveBeds,
      admissions: seed.admissions,
      now: NOW,
      thresholds: dueSoonThresholdsOf(seed.configuration),
    });
    expect(nav.discharges?.value, "menu").toBe(expected);
  });

  it("Ward flow's Held up group is the same releases; a later held-up one sits under Later", () => {
    const open = seed.bedReleases.filter((each) => each.state !== "discharged");
    const held = open.filter((each) => wardFlowReleaseGroup(each, NOW) === "held");
    expect(held.map((each) => each.id).sort()).toEqual(
      heldUpDueByTomorrow(open, NOW)
        .map((each) => each.id)
        .sort(),
    );
    expect(wardFlowReleaseGroup(release("later", { expectedAt: NOW + 3 * MINUTES_PER_DAY }), NOW)).toBe("later");
  });

  it("Discharges keeps every date in its own group, and the labels name each window", () => {
    expect(groupDischarges([...seed.bedReleases], NOW, { heldUpAnyDate: true }).blocked).toHaveLength(anyDate);
    expect(GROUP_TITLES.blocked).toBe(HELD_UP_ANY_DATE_LABEL);
    expect(HELD_UP_ANY_DATE_LABEL).toMatch(/any date$/u);
    expect(BED_RELEASES_HELD_UP_ANY_DATE_LABEL).toMatch(/any date$/u);
    expect(HELD_UP_BY_TOMORROW_LABEL).toMatch(/by tomorrow$/u);
    expect(BED_RELEASE_BLOCKED_FIGURE_LABEL).toMatch(/due by tomorrow$/u);
  });
});

describe("D-191 item 6: short never nets off a spare bed of another kind", () => {
  it("adds the shortfalls and leaves spare beds out while any kind is short", () => {
    expect(combinedKindGap([-3, -2, 0, 4])).toBe(-5);
    expect(combinedKindGap([-1, 0, 0, 1])).toBe(-1);
    expect(combinedKindGap([0, 2, 0, 1])).toBe(3);
    expect(combinedKindGap([0, 0, 0, 0])).toBe(0);
  });

  it("bedKindTotals: a spare youth bed does not reduce the adult shortfall", () => {
    const row = (id: BedKindGap["id"], waiting: number, bedsThatFit: number): BedKindGap => ({
      id,
      need: id,
      who: id,
      waiting,
      bedsThatFit,
      gap: bedsThatFit - waiting,
    });
    const rows = [row("locked_adult", 4, 1), row("open_adult", 2, 2), row("older_adult", 0, 0), row("youth", 0, 2)];
    expect(bedKindTotals(rows)).toEqual({ waiting: 6, bedsThatFit: 5, gap: -3 });
  });

  it("the seed's totals and the forecast's Now figure follow the same rule", () => {
    const seed = seedWardFlowState();
    const rows = bedKindGaps(seed.movements, seed.units, NOW, seed.admissions, seed.referrals, seed.bedReleases);
    expect(bedKindTotals(rows).gap).toBe(combinedKindGap(rows.map((each) => each.gap)));
    const tomorrow = forecastByKind(seed.units, seed.bedReleases, seed.admissions, seed.movements, NOW, 1);
    expect(tomorrow.total.now).toBe(combinedKindGap(tomorrow.kinds.map((kind) => kind.now)));
    expect(tomorrow.total.now).toBe(bedKindTotals(rows).gap);
  });
});
