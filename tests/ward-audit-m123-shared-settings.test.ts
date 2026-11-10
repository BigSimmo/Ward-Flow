// Audit M123: settings that change shared thresholds are controlled and visible. One block per
// setting: its signed range holds, every role but the coordinator is refused, a coordinator who is
// not statewide is refused, and an accepted change writes one audit row naming the old and new
// value. The fourth part: a shared view (TV, print, weekly report) says a non-default value is
// active, in one "Local settings in use" line (fixed 10 Nov 2026; the views' wiring is proved in
// tests/ward-m123-local-settings-note.dom.test.tsx).
import { describe, expect, it } from "vitest";

import { applyCommand, commandRefusal, seedWorld } from "../backend/ward-flow/engine";
import { defaultWardConfiguration, type WardConfiguration } from "@/components/ward-management/ward-configuration";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_RANGE_MINUTES,
  PARALLEL_REFERRAL_CAP_RANGE,
  PULL_HOLD_RANGE_MINUTES,
} from "@/components/ward-management/ward-model";
import {
  DECISION_TARGET_RANGE_MINUTES,
  DUE_SOON_RANGE_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
  FORECAST_ED_RISK_LEAD_RANGE_MINUTES,
  FORECAST_SHORT_ALERT_RANGE_BEDS,
  FORECAST_WORSE_ALERT_RANGE_BEDS,
} from "@/components/ward-management/ward-operational-defaults";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { localSettingsInUse } from "@/components/ward-management/settings/local-settings-note";
import { ruleChanges } from "@/components/ward-management/settings/settings-rule-catalogue";

type Bounds = { readonly min: number; readonly max: number; readonly step: number };
type Key = keyof WardConfiguration;

// The signed ranges, written out per setting. If a range moves, this list is the deliberate edit.
const SETTINGS: Array<{ key: Key; label: string; bounds: Bounds }> = [
  { key: "dueSoonUrgentMinutes", label: "legal warning: due within the hour", bounds: DUE_SOON_URGENT_RANGE_MINUTES },
  { key: "dueSoonMinutes", label: "legal warning: due soon", bounds: DUE_SOON_RANGE_MINUTES },
  { key: "edAccessTargetMinutes", label: "ED access target", bounds: ED_ACCESS_TARGET_RANGE_MINUTES },
  { key: "pullHoldMinutes", label: "pull limit (bed hold)", bounds: PULL_HOLD_RANGE_MINUTES },
  { key: "parallelReferralCap", label: "wards per referral", bounds: PARALLEL_REFERRAL_CAP_RANGE },
  { key: "morningRollupDeadlineMinutes", label: "morning bed numbers time", bounds: MORNING_ROLLUP_TIME_RANGE_MINUTES },
  {
    key: "referralDecisionTargetMinutes",
    label: "decision target: ward answer",
    bounds: DECISION_TARGET_RANGE_MINUTES,
  },
  {
    key: "transferAcceptanceTargetMinutes",
    label: "decision target: bed pulled",
    bounds: DECISION_TARGET_RANGE_MINUTES,
  },
  {
    key: "transportBookedTargetMinutes",
    label: "decision target: transport booked",
    bounds: DECISION_TARGET_RANGE_MINUTES,
  },
  { key: "forecastShortBeds", label: "forecast alert: beds short", bounds: FORECAST_SHORT_ALERT_RANGE_BEDS },
  { key: "forecastEdLeadMinutes", label: "forecast alert: ED lead time", bounds: FORECAST_ED_RISK_LEAD_RANGE_MINUTES },
  { key: "forecastWorseBeds", label: "forecast alert: forecast worse", bounds: FORECAST_WORSE_ALERT_RANGE_BEDS },
];

const NOW = 642;
const at = new Date("2026-10-20T10:00:00Z");
const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const north: WardAccess = { role: "coordinator", scope: { kind: "service", service: "North Metro" } };

/** A valid, non-default value for the key, keeping "due within the hour" earlier than "due soon". */
function changedValue(key: Key, bounds: Bounds, base: WardConfiguration): number {
  const up = base[key] + bounds.step;
  const down = base[key] - bounds.step;
  const candidates = [up, down].filter((value) => value >= bounds.min && value <= bounds.max);
  const fits = candidates.find((value) => {
    const next = { ...base, [key]: value };
    return next.dueSoonUrgentMinutes < next.dueSoonMinutes;
  });
  if (fits === undefined) throw new Error(`no valid non-default value for ${key}`);
  return fits;
}

function set(payload: Record<string, unknown>, role = "coordinator") {
  const before = seedWardFlowState();
  const after = wardFlowReducer(before, { type: "SET_CONFIGURATION", role, now: NOW, payload } as never);
  return { before, after };
}

describe("M123 the list covers every shared setting", () => {
  it("names each configuration key once", () => {
    expect(SETTINGS.map((s) => s.key).sort()).toEqual(Object.keys(defaultWardConfiguration()).sort());
  });
});

describe.each(SETTINGS)("M123 $label ($key)", ({ key, bounds }) => {
  const base = defaultWardConfiguration();

  it("stays within its signed range", () => {
    for (const value of [bounds.min - bounds.step, bounds.max + bounds.step, base[key] + bounds.step / 2]) {
      if (!Number.isInteger(value)) continue; // A half step of 1 is not an integer payload.
      const { before, after } = set({ ...base, [key]: value });
      expect(after.configuration[key], `${key}=${value}`).toBe(before.configuration[key]);
      expect(after.rejections.at(-1)?.reason ?? "").toMatch(new RegExp(key));
    }
    const fine = changedValue(key, bounds, base);
    expect(set({ ...base, [key]: fine }).after.configuration[key]).toBe(fine);
  });

  it("is refused for every role but the coordinator", () => {
    const fine = changedValue(key, bounds, base);
    const others = Object.keys(WARD_FLOW_ROLE_LABELS).filter((role) => role !== "coordinator");
    expect(others.length).toBeGreaterThan(3);
    for (const role of others)
      expect(set({ ...base, [key]: fine }, role).after.configuration[key], role).toBe(base[key]);
  });

  it("is refused for a coordinator who is not statewide", () => {
    const world = seedWorld(at);
    const event = {
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now: NOW,
      payload: { ...world.state.configuration, [key]: changedValue(key, bounds, world.state.configuration) },
    };
    expect(commandRefusal(world, north, event, at)).toBe("Only the statewide coordinator may change global settings.");
    expect(commandRefusal(world, statewide, event, at)).toBeNull();
    expect(applyCommand(world, event, at).outcome).toBe("accepted");
  });

  it("writes one audit row with the old and new value", () => {
    const fine = changedValue(key, bounds, base);
    const { before, after } = set({ ...base, [key]: fine });
    const rows = after.auditEvents.slice(before.auditEvents.length).filter((row) => row.category === "configuration");
    expect(rows).toHaveLength(1);
    const row = rows[0]! as Extract<(typeof rows)[number], { action: "SET_CONFIGURATION" }>;
    expect(row.outcome).toBe("accepted");
    expect(row.details.before?.[key]).toBe(base[key]);
    expect(row.details.after?.[key]).toBe(fine);
  });

  it("shared views (TV, print, weekly report) say when a non-default value is active", () => {
    expect(localSettingsInUse(base)).toBeNull();
    const fine = changedValue(key, bounds, base);
    const changed = { ...base, [key]: fine };
    const moved = ruleChanges(base, changed);
    expect(moved).toHaveLength(1);
    const { entry } = moved[0]!;
    expect(localSettingsInUse(changed)).toBe(`Local settings in use: ${entry.label} ${entry.display(fine)}`);
  });
});
