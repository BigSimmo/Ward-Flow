// Batch 4, outages and pilot control (Josh's approved plan, 10 Nov 2026, D-135):
// item 20 a feature switched off at one site, item 24 downtime pack print times, item 25 catch-up
// after an outage. Synthetic data only.
import { describe, expect, it } from "vitest";

import {
  PACK_OLD_AFTER_MINUTES,
  lastPackPrintPerWard,
  lastPackPrintedAt,
  wardsWithOldPack,
} from "@/components/ward-management/ward-downtime-pack-prints";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { resolveWardFeatureFlags } from "@/components/ward-management/ward-feature-flags";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import {
  bedNotConfirmedSinceOutage,
  bedsNotConfirmedSinceOutage,
  latestOutage,
  mayRecordOutage,
  wardCatchUp,
  wardCaughtUp,
  wardsNotCaughtUp,
} from "@/components/ward-management/ward-outage-catch-up";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import {
  deskSiteCodes,
  featureOffAtSite,
  featuresOffAtSite,
  featuresOffForDesk,
  mayChangeSiteFeatures,
  siteFeatureSwitchRefusal,
} from "@/components/ward-management/ward-site-feature-switches";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const RPH_WARD = "rph-adult-secure";
const RPH_OTHER = "rph-older-adult";
const SCGH_WARD = "scgh-adult-open";
const refused = (before: WardFlowState, after: WardFlowState) => after.rejections.length > before.rejections.length;
const send = (state: WardFlowState, event: Record<string, unknown>) =>
  wardFlowReducer(state, { now: NOW_ANCHOR, ...event } as WardFlowEvent);

describe("item 20: switch a feature off at one site", () => {
  const seed = seedWardFlowState();
  const switchOff = (state: WardFlowState, extra: Record<string, unknown> = {}) =>
    send(state, {
      type: "SET_SITE_FEATURE_SWITCH",
      role: "coordinator",
      siteCode: "RPH",
      feature: "help-ask",
      off: true,
      ...extra,
    });

  it("switches the feature off at that one site and leaves every other site alone", () => {
    const state = switchOff(seed);
    expect(refused(seed, state)).toBe(false);
    expect(state.siteFeatureSwitches).toEqual([
      { siteCode: "RPH", feature: "help-ask", at: NOW_ANCHOR, by: "coordinator" },
    ]);
    expect(featureOffAtSite(state.siteFeatureSwitches, "RPH", "help-ask")).toBe(true);
    expect(featureOffAtSite(state.siteFeatureSwitches, "SCGH", "help-ask")).toBe(false);
    expect(featuresOffAtSite(state.siteFeatureSwitches, "FSH")).toEqual([]);
    // Nothing else in the world moved.
    expect(state.units).toBe(seed.units);
    expect(state.movements).toBe(seed.movements);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);

    // Switched back on, the record goes.
    const back = switchOff(state, { off: false });
    expect(refused(state, back)).toBe(false);
    expect(back.siteFeatureSwitches).toEqual([]);
  });

  it("is off for every desk at that site and for no desk elsewhere", () => {
    const state = switchOff(seed);
    const places = wardPlaceLookup(state.units);
    const rphWard: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [RPH_WARD] } };
    const rphSite: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } };
    const scghWard: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [SCGH_WARD] } };
    const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
    expect(featuresOffForDesk(state.siteFeatureSwitches, deskSiteCodes(rphWard, places))).toEqual(["help-ask"]);
    expect(featuresOffForDesk(state.siteFeatureSwitches, deskSiteCodes(rphSite, places))).toEqual(["help-ask"]);
    expect(featuresOffForDesk(state.siteFeatureSwitches, deskSiteCodes(scghWard, places))).toEqual([]);
    expect(deskSiteCodes(statewide, places)).toEqual([]);

    // The flag store's resolution: off at the site whatever the device says; the device cannot change it.
    const flags = resolveWardFeatureFlags({
      environment: "demo",
      server: {},
      device: { "help-ask": true },
      siteOff: ["help-ask"],
    });
    const help = flags.find((flag) => flag.name === "help-ask")!;
    expect(help).toMatchObject({ on: false, source: "site", deviceCanChange: false });
    // A site list naming a protected flag changes nothing.
    const guarded = resolveWardFeatureFlags({
      environment: "demo",
      server: {},
      device: {},
      siteOff: ["role-access", "awol-bed-hold-review"],
    });
    expect(guarded.find((flag) => flag.name === "role-access")?.on).toBe(true);
    expect(guarded.find((flag) => flag.name === "awol-bed-hold-review")?.source).not.toBe("site");
  });

  it("records the access admin as who switched it (D-142), and the stored state still restores", () => {
    const state = switchOff(seed, { byAccessAdmin: true });
    expect(state.siteFeatureSwitches).toEqual([{ siteCode: "RPH", feature: "help-ask", at: NOW_ANCHOR, by: "admin" }]);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
  });

  it("refuses a protected or unlisted feature, an unknown site and a switch that changes nothing", () => {
    for (const feature of ["role-access", "safety-notices", "legal-times", "ruling-guards", "awol-bed-hold-review"]) {
      const state = switchOff(seed, { feature });
      expect(refused(seed, state), feature).toBe(true);
      expect(state.rejections.at(-1)?.reason).toMatch(/can never be switched off/u);
      expect(state.siteFeatureSwitches).toBeUndefined();
    }
    expect(refused(seed, switchOff(seed, { feature: "made-up-flag" }))).toBe(true);
    expect(refused(seed, switchOff(seed, { siteCode: "NOWHERE" }))).toBe(true);
    expect(refused(seed, switchOff(seed, { off: false }))).toBe(true);
    const once = switchOff(seed);
    expect(refused(once, switchOff(once))).toBe(true);
  });

  it("only admins switch: the engine refuses clinical desks, and the access rule names admins only", () => {
    // D-80: the executive takes no workflow action (the access admin's desk sends the coordinator role, D-142).
    for (const role of ["ward", "ed", "bed_manager", "officer", "community", "executive"]) {
      const state = switchOff(seed, { role });
      expect(refused(seed, state), role).toBe(true);
      expect(state.siteFeatureSwitches).toBeUndefined();
    }
    const command = { type: "SET_SITE_FEATURE_SWITCH", siteCode: "RPH" };
    const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
    const serviceCoordinator: WardAccess = { role: "coordinator", scope: { kind: "service", service: "East Metro" } };
    const siteManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } };
    expect(mayChangeSiteFeatures(statewide)).toBe(true);
    expect(mayChangeSiteFeatures(serviceCoordinator)).toBe(false);
    expect(mayChangeSiteFeatures(siteManager)).toBe(false);
    expect(mayChangeSiteFeatures({ role: "executive", scope: { kind: "statewide" } })).toBe(false);
    // D-142 (Josh, 11 Nov 2026) amends D-80 for this one action: the statewide access admin switches.
    expect(mayChangeSiteFeatures({ role: "admin", scope: { kind: "statewide" } })).toBe(true);
    expect(mayChangeSiteFeatures({ role: "admin", scope: { kind: "service", service: "East Metro" } })).toBe(false);
    expect(siteFeatureSwitchRefusal({ role: "admin", scope: { kind: "statewide" } }, command)).toBeNull();
    expect(mayChangeSiteFeatures({ role: "ward", scope: { kind: "ward", unitIds: [RPH_WARD] } })).toBe(false);
    expect(siteFeatureSwitchRefusal(statewide, command)).toBeNull();
    expect(siteFeatureSwitchRefusal(statewide, { type: "SET_SITE_FEATURE_SWITCH" })).not.toBeNull();
    expect(siteFeatureSwitchRefusal(serviceCoordinator, command)).not.toBeNull();
    expect(siteFeatureSwitchRefusal(siteManager, command)).not.toBeNull();
  });
});

describe("item 24: downtime pack up to date", () => {
  const seed = seedWardFlowState();
  const print = (state: WardFlowState, unitIds: unknown, now = NOW_ANCHOR, role = "coordinator") =>
    send(state, { type: "RECORD_DOWNTIME_PACK_PRINTED", role, now, unitIds });

  it("records only the time of each print per ward, never the pack", () => {
    const state = print(seed, [RPH_WARD, SCGH_WARD]);
    expect(refused(seed, state)).toBe(false);
    expect(state.downtimePackPrints).toEqual([
      { unitId: RPH_WARD, at: NOW_ANCHOR, by: "coordinator" },
      { unitId: SCGH_WARD, at: NOW_ANCHOR, by: "coordinator" },
    ]);
    // The same print seen twice in one minute (Print button and afterprint) records once.
    expect(print(state, [RPH_WARD, SCGH_WARD]).downtimePackPrints).toHaveLength(2);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    // A stored print row carrying anything else (pack content) is refused on restore.
    const carrying = JSON.parse(JSON.stringify(state)) as WardFlowState;
    (carrying.downtimePackPrints![0] as Record<string, unknown>).wards = ["Synthetic person"];
    expect(isValidStoredWardFlowState(carrying)).toBe(false);
  });

  it("gives the last print time per ward and the wards whose pack is older than the signed value", () => {
    expect(PACK_OLD_AFTER_MINUTES).toBe(24 * 60);
    expect(CLINICAL_VALUES.downtimePackOld).toMatchObject({ status: "signed", signedOn: "2026-11-10" });
    let state = print(seed, [RPH_WARD, SCGH_WARD], NOW_ANCHOR - 30 * 60);
    state = print(state, [RPH_WARD], NOW_ANCHOR - 60);
    expect(lastPackPrintedAt(state.downtimePackPrints, RPH_WARD)).toBe(NOW_ANCHOR - 60);
    expect(lastPackPrintedAt(state.downtimePackPrints, RPH_WARD, NOW_ANCHOR - 120)).toBe(NOW_ANCHOR - 30 * 60);
    expect(lastPackPrintPerWard(state.downtimePackPrints, [SCGH_WARD, RPH_OTHER])).toEqual([
      { unitId: SCGH_WARD, lastPrintedAt: NOW_ANCHOR - 30 * 60 },
      { unitId: RPH_OTHER, lastPrintedAt: null },
    ]);
    // Never printed first, then the oldest; the ward printed an hour ago is not old.
    expect(wardsWithOldPack(state.downtimePackPrints, [RPH_WARD, SCGH_WARD, RPH_OTHER], NOW_ANCHOR)).toEqual([
      { unitId: RPH_OTHER, lastPrintedAt: null },
      { unitId: SCGH_WARD, lastPrintedAt: NOW_ANCHOR - 30 * 60 },
    ]);
    // Exactly 24 hours is not yet older than 24 hours.
    const edge = print(seed, [RPH_WARD], NOW_ANCHOR - PACK_OLD_AFTER_MINUTES);
    expect(wardsWithOldPack(edge.downtimePackPrints, [RPH_WARD], NOW_ANCHOR)).toEqual([]);
  });

  it("refuses an empty, repeated or unknown ward list and a desk the event does not permit", () => {
    expect(refused(seed, print(seed, []))).toBe(true);
    expect(refused(seed, print(seed, [RPH_WARD, RPH_WARD]))).toBe(true);
    expect(refused(seed, print(seed, ["no-such-ward"]))).toBe(true);
    expect(refused(seed, print(seed, [RPH_WARD], NOW_ANCHOR, "officer"))).toBe(true);
    expect(refused(seed, print(seed, [RPH_WARD], NOW_ANCHOR, "executive"))).toBe(true);
  });
});

describe("item 25: catch-up after an outage", () => {
  const seed = seedWardFlowState();
  // Every seeded ward confirmed its beds before NOW_ANCHOR - 5, so this outage ends after all of them.
  const FROM = NOW_ANCHOR - 120;
  const TO = NOW_ANCHOR - 5;
  const outage = (state: WardFlowState, extra: Record<string, unknown> = {}) =>
    send(state, { type: "RECORD_OUTAGE_WINDOW", role: "coordinator", from: FROM, to: TO, ...extra });
  const confirm = (state: WardFlowState, unitId: string, role = "ward", now = NOW_ANCHOR) => {
    const unit = state.units.find((candidate) => candidate.id === unitId)!;
    return send(state, {
      type: "CONFIRM_CAPACITY",
      role,
      now,
      unitId,
      actingUnitId: unitId,
      value: unit.allocatable.value,
      expectedRevision: unit.allocatable.revision ?? 0,
    });
  };
  const unitOf = (state: WardFlowState, id: string) => state.units.find((unit) => unit.id === id)!;

  it("guesses nothing: with no recorded outage no ward is asked to catch up and no bed is flagged", () => {
    expect(seed.outageWindows).toBeUndefined();
    expect(latestOutage(seed.outageWindows, NOW_ANCHOR)).toBeNull();
    expect(wardsNotCaughtUp(seed.units, seed.outageWindows, NOW_ANCHOR)).toEqual([]);
    expect(wardCatchUp(unitOf(seed, RPH_WARD), seed, NOW_ANCHOR)).toBeNull();
    expect(bedsNotConfirmedSinceOutage(unitOf(seed, RPH_WARD), null)).toEqual([]);
  });

  it("refuses a window with a time left out, an end before the start or an end still to come", () => {
    expect(refused(seed, outage(seed, { from: undefined }))).toBe(true);
    expect(refused(seed, outage(seed, { to: undefined }))).toBe(true);
    expect(refused(seed, outage(seed, { from: "02:00" }))).toBe(true);
    expect(refused(seed, outage(seed, { from: TO, to: FROM }))).toBe(true);
    expect(refused(seed, outage(seed, { to: NOW_ANCHOR + 1 }))).toBe(true);
    expect(refused(seed, outage(seed, { role: "ward" }))).toBe(true);
    const once = outage(seed);
    expect(refused(once, outage(once))).toBe(true);
  });

  it("records the typed window only, and changes no bed figure or confirmation", () => {
    const state = outage(seed);
    expect(refused(seed, state)).toBe(false);
    expect(state.outageWindows).toEqual([
      { id: "OUT-1", from: FROM, to: TO, recordedAt: NOW_ANCHOR, by: "coordinator" },
    ]);
    expect(state.units).toBe(seed.units);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
  });

  it("keeps every bed not confirmed since the outage until the ward confirms with Beds still correct", () => {
    const down = outage(seed);
    const window = latestOutage(down.outageWindows, NOW_ANCHOR)!;
    const before = unitOf(down, RPH_WARD);
    expect(wardCaughtUp(before, window)).toBe(false);
    expect(bedsNotConfirmedSinceOutage(before, window)).toHaveLength(before.beds);
    expect(bedNotConfirmedSinceOutage(before, 1, window)).toBe(true);
    expect(wardsNotCaughtUp(down.units, down.outageWindows, NOW_ANCHOR)).toContain(RPH_WARD);

    const confirmed = confirm(down, RPH_WARD);
    expect(refused(down, confirmed)).toBe(false);
    const after = unitOf(confirmed, RPH_WARD);
    expect(wardCaughtUp(after, window)).toBe(true);
    expect(bedsNotConfirmedSinceOutage(after, window)).toEqual([]);
    expect(bedNotConfirmedSinceOutage(after, 1, window)).toBe(false);
    const still = wardsNotCaughtUp(confirmed.units, confirmed.outageWindows, NOW_ANCHOR);
    expect(still).not.toContain(RPH_WARD);
    // Another ward is untouched by this ward's confirmation.
    expect(still).toContain(SCGH_WARD);
  });

  it("does not count a confirmation made before the outage ended, or one by another desk", () => {
    // The ward confirmed during the outage (before it ended); the coordinator records the window after.
    const early = confirm(seed, RPH_WARD, "ward", TO - 1);
    expect(refused(seed, early)).toBe(false);
    const down = outage(early);
    expect(wardsNotCaughtUp(down.units, down.outageWindows, NOW_ANCHOR)).toContain(RPH_WARD);
    // The coordinator confirming the ward's beds is not the ward's own confirmation.
    const byCoordinator = confirm(down, RPH_WARD, "coordinator");
    expect(refused(down, byCoordinator)).toBe(false);
    expect(wardsNotCaughtUp(byCoordinator.units, byCoordinator.outageWindows, NOW_ANCHOR)).toContain(RPH_WARD);
    // A confirmation exactly at the outage end counts.
    const atEnd = confirm(outage(seed), RPH_WARD, "ward", TO);
    expect(wardsNotCaughtUp(atEnd.units, atEnd.outageWindows, NOW_ANCHOR)).not.toContain(RPH_WARD);
  });

  it("names the ward's last pack print before the outage ended in its catch-up prompt", () => {
    let state = send(seed, {
      type: "RECORD_DOWNTIME_PACK_PRINTED",
      role: "ward",
      now: FROM - 30,
      unitIds: [RPH_WARD],
    });
    state = outage(state);
    const prompt = wardCatchUp(unitOf(state, RPH_WARD), state, NOW_ANCHOR)!;
    expect(prompt).toMatchObject({ unitId: RPH_WARD, caughtUp: false, lastPackPrintedAt: FROM - 30 });
    expect(prompt.outage).toMatchObject({ from: FROM, to: TO });
    // A ward that never printed says so, rather than borrowing another ward's time.
    expect(wardCatchUp(unitOf(state, SCGH_WARD), state, NOW_ANCHOR)?.lastPackPrintedAt).toBeNull();
  });
});

describe("item 25: review follow-ups (11 Nov 2026, D-142)", () => {
  const seed = seedWardFlowState();
  const FROM = NOW_ANCHOR - 120;
  const TO = NOW_ANCHOR - 5;
  const confirm = (state: WardFlowState, unitId: string, role: string, now: number) => {
    const unit = state.units.find((candidate) => candidate.id === unitId)!;
    return send(state, {
      type: "CONFIRM_CAPACITY",
      role,
      now,
      unitId,
      actingUnitId: unitId,
      value: unit.allocatable.value,
      expectedRevision: unit.allocatable.revision ?? 0,
    });
  };

  it("lets a corrected outage replace the earlier one, even when the end moves earlier", () => {
    let state = send(seed, {
      type: "RECORD_OUTAGE_WINDOW",
      role: "coordinator",
      now: NOW_ANCHOR - 2,
      from: FROM,
      to: TO,
    });
    state = send(state, { type: "RECORD_OUTAGE_WINDOW", role: "coordinator", from: FROM, to: TO - 30 });
    expect(state.outageWindows).toHaveLength(2);
    expect(latestOutage(state.outageWindows, NOW_ANCHOR)?.to).toBe(TO - 30);
    // A ward that confirmed between the corrected and the original end is now caught up.
    const confirmed = confirm(state, RPH_WARD, "ward", TO - 10);
    expect(wardsNotCaughtUp(confirmed.units, confirmed.outageWindows, NOW_ANCHOR)).not.toContain(RPH_WARD);
  });

  it("keeps the ward's own confirm when another desk confirms after it", () => {
    let state = send(seed, { type: "RECORD_OUTAGE_WINDOW", role: "coordinator", from: FROM, to: TO });
    state = confirm(state, RPH_WARD, "ward", TO + 1);
    expect(wardsNotCaughtUp(state.units, state.outageWindows, NOW_ANCHOR)).not.toContain(RPH_WARD);
    const byCoordinator = confirm(state, RPH_WARD, "coordinator", TO + 2);
    expect(refused(state, byCoordinator)).toBe(false);
    expect(wardsNotCaughtUp(byCoordinator.units, byCoordinator.outageWindows, NOW_ANCHOR)).not.toContain(RPH_WARD);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(byCoordinator)))).toBe(true);
  });

  it("lets only the statewide coordinator record an outage, which is network-wide", () => {
    expect(mayRecordOutage({ role: "coordinator", scope: { kind: "statewide" } })).toBe(true);
    expect(mayRecordOutage({ role: "coordinator", scope: { kind: "service", service: "East Metro" } })).toBe(false);
    expect(mayRecordOutage({ role: "admin", scope: { kind: "statewide" } })).toBe(false);
    expect(mayRecordOutage({ role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } })).toBe(false);
  });
});
