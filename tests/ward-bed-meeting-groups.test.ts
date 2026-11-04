import { describe, expect, it } from "vitest";

import { bedMeetingAgenda } from "@/components/ward-management/bed-meeting/bed-meeting-agenda";
import {
  agendaGroupFilterWords,
  agendaGroupOptions,
  agendaGroupsOf,
  inAgendaGroups,
  referralInAgendaGroups,
} from "@/components/ward-management/bed-meeting/bed-meeting-groups";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** B1 extended (Josh, 4 Nov 2026): the agenda narrows to any group, never guessing one. */
const seed = seedWardFlowState();
const context = { units: seed.units, movements: seed.movements };
const items = bedMeetingAgenda(
  { movements: seed.movements, admissions: seed.admissions, bedReleases: seed.bedReleases, units: seed.units },
  NOW_ANCHOR,
  Number.POSITIVE_INFINITY,
).flatMap((section) => section.items);

describe("bed meeting agenda groups", () => {
  it("offers only the groups somebody on the agenda holds, each person counted once", () => {
    const options = agendaGroupOptions(items, context);
    const people = new Set(items.map((item) => item.subject.id)).size;
    const tierTotal = options.tier.reduce((sum, option) => sum + option.count, 0);
    expect(tierTotal).toBeLessThanOrEqual(people);
    expect(options.tier.map((option) => option.label)).toEqual(
      [...options.tier].sort((a, b) => Number(a.value) - Number(b.value)).map((option) => option.label),
    );
    for (const option of options.ward) expect(option.count).toBeGreaterThan(0);
    // The busiest wards first.
    const counts = options.ward.map((option) => option.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("combines groups across facets and adds values within one", () => {
    const tier1 = items.filter((item) => inAgendaGroups(item, { tier: new Set(["1"]) }, context));
    const tier12 = items.filter((item) => inAgendaGroups(item, { tier: new Set(["1", "2"]) }, context));
    expect(tier12.length).toBeGreaterThanOrEqual(tier1.length);
    const both = items.filter((item) =>
      inAgendaGroups(item, { tier: new Set(["1"]), legal: new Set(["Involuntary inpatient"]) }, context),
    );
    for (const item of both) {
      const groups = agendaGroupsOf(item, context);
      expect(groups.tier).toBe("1");
      expect(groups.legal).toBe("Involuntary inpatient");
    }
    expect(both.length).toBeLessThanOrEqual(tier1.length);
  });

  it("leaves out a person with nothing recorded for a filtered facet, and filters nothing when empty", () => {
    const stay = items.find(
      (item) => item.subject.kind === "admission" && agendaGroupsOf(item, context).tier === undefined,
    );
    if (stay) expect(inAgendaGroups(stay, { tier: new Set(["1", "2", "3"]) }, context)).toBe(false);
    expect(items.every((item) => inAgendaGroups(item, {}, context))).toBe(true);
    expect(items.every((item) => inAgendaGroups(item, { tier: new Set() }, context))).toBe(true);
  });

  it("keeps a referral by tier only, and says the filter in words", () => {
    const referral = seed.referrals[0]!;
    expect(referralInAgendaGroups(referral, { tier: new Set([String(referral.urgency)]) })).toBe(true);
    expect(referralInAgendaGroups(referral, { age: new Set(["Adult"]) })).toBe(false);
    expect(
      agendaGroupFilterWords({ tier: new Set(["1"]), legal: new Set(["Involuntary inpatient"]) }, seed.units),
    ).toBe("Tier 1, Involuntary");
  });
});
