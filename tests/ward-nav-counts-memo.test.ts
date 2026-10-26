/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/**
 * Audit EDR-04: the remembered nav counts were keyed on `service` as given, so a caller that left it
 * out and one that passed null missed each other, and with one slot each evicted the other on every
 * render. Synthetic seed data only.
 */
const state = seedWardFlowState();
const input = {
  movements: state.movements,
  units: state.units,
  referrals: state.referrals,
  bedReleases: state.bedReleases,
  leaveBeds: state.leaveBeds,
  admissions: state.admissions,
  now: NOW_ANCHOR,
  sites: wardSites,
  thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
};

describe("the remembered nav counts (audit EDR-04)", () => {
  it("treats a left-out service and a null service as the same question", () => {
    const left = wardNavCounts(input);
    expect(wardNavCounts({ ...input, service: null })).toBe(left);
  });

  it("keeps the all-services answer while a chosen service is asked for in between", () => {
    const all = wardNavCounts(input);
    const one = wardNavCounts({ ...input, service: "North Metro" });
    expect(wardNavCounts(input)).toBe(all);
    expect(wardNavCounts({ ...input, service: "North Metro" })).toBe(one);
  });
});
