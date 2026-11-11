import { describe, expect, it } from "vitest";

import { actNowAlerts, applyCommand, seedWorld, worldNow, type SharedWorld } from "../backend/ward-flow/engine";
import { actNowNotificationText } from "@/components/ward-management/shell/ward-act-now-notifications";
import { alertsToShow } from "@/components/ward-management/shell/ward-alert-preferences";
import { inboxItemsForRole, taskItems, type TaskSource } from "@/components/ward-management/ward-act-now-items";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * Master audit M44 (10 Nov 2026): alert fatigue. On a busy synthetic day, count alerts per role per
 * shift, and check that bursts, duplicates and contradictory updates never bury urgent work.
 * Offline only: the demo clock is advanced through 24 hours of the synthetic seed. The counts
 * measure the seed, not a real ward, so they are a baseline for when alert rules change. Set
 * M44_REPORT=1 to print the count table (`docs/ward-flow/evidence/2026-11-10-m44-alert-counts.md`).
 */
type PushPayload = { title: string; body: string; url: string; tag: string };
const { freshAlerts, pushPayload } = (await import(new URL("../backend/ward-flow/push.mjs", import.meta.url).href)) as {
  freshAlerts: <T extends { id: string }>(previous: readonly string[], current: readonly T[]) => T[];
  pushPayload: (alerts: readonly unknown[]) => PushPayload;
};

// D-150 (11 Nov 2026): the shared world runs on real Perth time, so the walk starts at 10:42 Perth,
// the seed's own opening minute in the day shift, as the scripted clock did before.
const AT = new Date("2026-10-10T02:42:00Z");
const STEP = 30; // minutes of demo clock per evaluation, about the phone push sweep's grain
const STEPS = 48; // 24 hours
const ROLES: readonly WardChromeRole[] = ["coordinator", "bed_manager", "ed", "ward", "community"];
const SHIFTS = [
  { id: "day", from: 7 * 60, to: 15 * 60 },
  { id: "evening", from: 15 * 60, to: 23 * 60 },
  { id: "night", from: 23 * 60, to: 7 * 60 },
] as const;
const shiftOf = (instant: number) => {
  const minute = ((instant % 1440) + 1440) % 1440;
  return SHIFTS.find((shift) => (shift.from < shift.to ? minute >= shift.from && minute < shift.to : true))!.id;
};

function source(state: WardFlowState): TaskSource {
  return {
    movements: state.movements,
    units: state.units,
    configuration: state.configuration,
    inboxSnoozes: state.inboxSnoozes,
    admissions: state.admissions,
    patients: state.patients,
    referrals: state.referrals,
    supportNotifications: state.supportNotifications,
    plannedAdmissions: state.plannedAdmissions,
    leaveBeds: state.leaveBeds,
  };
}

type Counts = Record<string, { red: number; amber: number; push: number; pushSends: number }>;

/** Walk a busy synthetic day and count what each role would be told, per shift. */
function busyDay() {
  let world: SharedWorld = seedWorld(AT);
  const wardNames = (world.state as WardFlowState).units.map((unit) => unit.name);
  const seen = new Map<WardChromeRole, Set<string>>(ROLES.map((role) => [role, new Set()]));
  let pushSeen: string[] = [];
  // Every role and shift is reported, zero included, so a quiet shift is visible as quiet.
  const counts: Counts = Object.fromEntries(
    [...ROLES, "push" as const].flatMap((role) =>
      SHIFTS.map((shift) => [`${role}/${shift.id}`, { red: 0, amber: 0, push: 0, pushSends: 0 }]),
    ),
  );
  const bump = (key: string, field: keyof Counts[string], by = 1) => {
    counts[key] ??= { red: 0, amber: 0, push: 0, pushSends: 0 };
    counts[key][field] += by;
  };
  const snapshots: { now: number; items: InboxItem[] }[] = [];
  for (let step = 0; step <= STEPS; step++) {
    if (step > 0) {
      const advanced = applyCommand(world, { type: "ADVANCE_CLOCK", role: "demo", now: 0, minutes: STEP }, AT);
      expect(advanced.outcome).toBe("accepted");
      world = advanced.world as SharedWorld;
    }
    const state = world.state as WardFlowState;
    const now = worldNow(world, AT);
    const items = taskItems(source(state), now);
    snapshots.push({ now, items });
    const shift = shiftOf(now);
    for (const role of ROLES) {
      const own = inboxItemsForRole(items, role, role === "ward" ? wardNames : []);
      const before = seen.get(role)!;
      // The first look is the baseline: only rows that arrive after it count as new alerts.
      for (const item of own)
        if (step > 0 && !before.has(item.id)) bump(`${role}/${shift}`, item.tone === "danger" ? "red" : "amber");
      seen.set(role, new Set(own.map((item) => item.id)));
    }
    // Phone push for the whole network (the coordinator's desk): one notification per sweep.
    const alerts = actNowAlerts(world, AT);
    const fresh = step === 0 ? [] : freshAlerts(pushSeen, alerts);
    pushSeen = alerts.map((alert) => alert.id);
    if (fresh.length > 0) {
      bump(`push/${shift}`, "push", fresh.length);
      bump(`push/${shift}`, "pushSends");
    }
  }
  return { counts, snapshots };
}

describe("M44: alert fatigue on a busy synthetic day", () => {
  const { counts, snapshots } = busyDay();

  it("counts alerts per role per shift (the report), and the day is busy enough to mean something", () => {
    if (process.env.M44_REPORT === "1") console.log(JSON.stringify(counts, null, 2));
    const total = Object.values(counts).reduce((sum, row) => sum + row.red + row.amber, 0);
    expect(total).toBeGreaterThan(5);
    expect(Object.keys(counts)).toHaveLength((ROLES.length + 1) * SHIFTS.length);
    // The seed opens in the day shift and raises few new rows later: this measures the seed.
    expect(counts["coordinator/day"]!.red).toBeGreaterThan(0);
  });

  it("a phone push is one grouped notification per sweep, never one per alert", () => {
    for (const [key, row] of Object.entries(counts))
      if (key.startsWith("push/")) expect(row.pushSends).toBeLessThanOrEqual(STEPS + 1);
  });

  it("duplicates: a row is listed once at a time, so the same thing is never announced twice at once", () => {
    for (const { now, items } of snapshots) {
      const ids = items.map((item) => item.id);
      expect(new Set(ids).size, `minute ${now}`).toBe(ids.length);
    }
    // An alert that stays active is announced once, however many sweeps see it.
    const alert = { id: "same", site: "Royal Perth Hospital" };
    expect(freshAlerts([], [alert, alert])).toHaveLength(1);
    expect(freshAlerts(["same"], [alert])).toHaveLength(0);
  });

  it("contradictory updates: one bed request is never both act now and calm for the same reason at once", () => {
    for (const { now, items } of snapshots) {
      const tones = new Map<string, Set<string>>();
      for (const item of items) {
        const key = item.id;
        const set = tones.get(key) ?? new Set();
        set.add(item.tone);
        tones.set(key, set);
      }
      for (const [id, set] of tones) expect(set.size, `${id} at ${now}`).toBe(1);
    }
  });
});

const row = (id: string, tone: InboxItem["tone"]): InboxItem =>
  ({
    id,
    movementId: `m-${id}`,
    title: `Alert ${id}`,
    detail: "",
    owner: "Bed coordinator",
    tone,
    actions: [],
  }) as unknown as InboxItem;

describe("M44: a burst never buries urgent work", () => {
  const burst = [...Array.from({ length: 40 }, (_, index) => row(`amber-${index}`, "warning")), row("red-1", "danger")];
  const quiet = { on: true, start: 22 * 60, end: 7 * 60 };

  it("the act-now alert gets its own notification, apart from 40 due-soon rows arriving with it", () => {
    const shown = alertsToShow(burst, { dueSoon: true, staffRequests: false, quiet: { ...quiet, on: false } }, 12 * 60);
    expect(shown.actNow.map((item) => item.id)).toEqual(["red-1"]);
    expect(shown.dueSoon).toHaveLength(40);
    expect(actNowNotificationText(shown.actNow, "act-now")).toEqual({
      title: "Ward Flow: act now",
      body: "Alert red-1. Synthetic demo data.",
    });
  });

  it("quiet hours hold the due-soon burst but never the act-now alert", () => {
    const shown = alertsToShow(burst, { dueSoon: true, staffRequests: false, quiet }, 2 * 60);
    expect(shown.actNow).toHaveLength(1);
    expect(shown.dueSoon).toEqual([]);
    expect(shown.held).toBe(40);
  });

  it("phone push carries act now only for the coordinator: an amber or job burst cannot dilute it", () => {
    const jobs = Array.from({ length: 30 }, (_, index) => ({
      id: `job:${index}`,
      site: "Peel Health Campus",
      kind: "job",
    }));
    const red = { id: "red-1", site: "Royal Perth Hospital", kind: "act-now" };
    const coordinator = pushPayload([red]);
    expect(coordinator.title).toBe("Ward Flow: 1 new act now item");
    // The server gives each desk one kind (engine `scopedActNowAlerts`); mixed kinds read as act now.
    expect(pushPayload([...jobs, red]).tag).toBe("ward-flow-act-now");
    expect(pushPayload(jobs).tag).toBe("ward-flow-jobs");
  });
});
