import { describe, expect, it } from "vitest";

import { actNowAlerts, applyCommand, seedWorld, worldNow, type SharedWorld } from "../backend/ward-flow/engine";
import { actNowNotificationText } from "@/components/ward-management/shell/ward-act-now-notifications";
import { taskItems, type TaskSource } from "@/components/ward-management/ward-act-now-items";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * Master audit M21 (10 Nov 2026): alert privacy. A synthetic name marker is fed into every record
 * an alert can be built from, then through every notification builder: the server's phone push
 * (`pushPayload`, all three kinds: act now, transport jobs, team updates) and the open-tab
 * notification words (`actNowNotificationText`, act now and due soon). The test fails if the
 * marker reaches any payload. The service worker's own check of what it shows is pinned in
 * `tests/ward-pwa-worker.test.ts`; the fixed Pull now and staff request words carry no record text.
 */
type PushPayload = { title: string; body: string; url: string; tag: string };
const { pushPayload } = (await import(new URL("../backend/ward-flow/push.mjs", import.meta.url).href)) as {
  pushPayload: (alerts: readonly unknown[]) => PushPayload;
};

// Made-up words that appear in no seed record, so a hit can only come from this test.
const MARKER = "Zyxmarker";
const MARKER_PATTERN = new RegExp(MARKER, "i");

/** Every patient's name fields, and every free-text note anywhere in the state, carry the marker. */
function marked<T>(value: T, key = ""): T {
  if (typeof value === "string")
    return (/name$|note|comment|detail|history|freeText/i.test(key) ? `${MARKER} ${value}` : value) as T;
  if (Array.isArray(value)) return value.map((entry) => marked(entry, key)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, marked(v, k)])) as T;
  return value;
}

function markedWorld(at: Date, minutes: number): SharedWorld {
  let world = seedWorld(at);
  if (minutes > 0) {
    const advanced = applyCommand(world, { type: "ADVANCE_CLOCK", role: "demo", now: 0, minutes }, at);
    expect(advanced.outcome).toBe("accepted");
    world = advanced.world as SharedWorld;
  }
  const state = world.state as WardFlowState;
  // Names on patients only: unit, site and team names are places, which alerts may carry.
  const patients = state.patients.map((patient) => ({
    ...marked(patient),
    givenName: `${MARKER}given`,
    familyName: `${MARKER}family`,
    preferredName: `${MARKER}preferred`,
  }));
  return {
    ...world,
    state: { ...state, patients, movements: marked(state.movements), referrals: marked(state.referrals) },
  } as SharedWorld;
}

const AT = new Date("2026-10-10T10:00:00Z");
// A busy day: the seed as it opens, then after 4, 8 and 12 hours of the demo clock.
const CLOCKS = [0, 240, 480, 720];

describe("M21: a synthetic name marker never reaches a notification", () => {
  it("the marker is really in the records the alerts are built from", () => {
    const state = markedWorld(AT, 0).state as WardFlowState;
    expect(JSON.stringify(state.patients)).toMatch(MARKER_PATTERN);
    expect(JSON.stringify(state.referrals)).toMatch(MARKER_PATTERN);
  });

  it("phone push: every kind the server sends, built from marked records, carries no marker", () => {
    const kinds = new Set<string>();
    for (const minutes of CLOCKS) {
      const world = markedWorld(AT, minutes);
      const alerts = actNowAlerts(world, AT);
      // Even a caller that passes whole rows with the marker in every field cannot leak it.
      const leaky = alerts.map((alert) => ({
        ...alert,
        title: `${MARKER} title`,
        detail: `${MARKER} detail`,
        patientName: `${MARKER} name`,
        umrn: `${MARKER}UMRN`,
      }));
      for (const kind of ["act-now", "job", "community"] as const) {
        const ofKind = leaky.filter((alert) => alert.kind === kind);
        if (ofKind.length === 0) continue;
        kinds.add(kind);
        const payload = pushPayload(ofKind);
        expect(Object.keys(payload).sort()).toEqual(["body", "tag", "title", "url"]);
        expect(JSON.stringify(payload)).not.toMatch(MARKER_PATTERN);
        // One alert alone is the likeliest to be worded about its record.
        expect(JSON.stringify(pushPayload(ofKind.slice(0, 1)))).not.toMatch(MARKER_PATTERN);
      }
    }
    expect(kinds.has("act-now"), "the busy day raises act-now items").toBe(true);
    // The other two builders are fed directly, so every branch is covered whatever the seed raises.
    for (const kind of ["job", "community"])
      expect(
        JSON.stringify(pushPayload([{ id: `${MARKER}-1`, site: "Royal Perth Hospital", kind, detail: MARKER }])),
      ).not.toMatch(MARKER_PATTERN);
  });

  it("open-tab notifications: act now and due soon, one alert or many, carry no marker", () => {
    let checked = 0;
    for (const minutes of CLOCKS) {
      const world = markedWorld(AT, minutes);
      const state = world.state as WardFlowState;
      const source: TaskSource = {
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
      const items = taskItems(source, worldNow(world, AT));
      const red = items.filter((item) => item.tone === "danger");
      const amber = items.filter((item) => item.tone === "warning");
      for (const [list, kind] of [
        [red, "act-now"],
        [amber, "due-soon"],
      ] as const) {
        if (list.length > 0) expect(JSON.stringify(actNowNotificationText(list, kind))).not.toMatch(MARKER_PATTERN);
        // One row alone shows its own title: each title must be free of the marker.
        for (const item of list) {
          expect(JSON.stringify(actNowNotificationText([item], kind)), item.id).not.toMatch(MARKER_PATTERN);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});
