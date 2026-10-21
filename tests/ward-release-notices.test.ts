import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { EVENT_HISTORY_TABLE } from "@/components/ward-management/ward-history";
import { EXTRA_TRAVEL_HOLD_MINUTES } from "@/components/ward-management/ward-model";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

/** D-72: the bed hold asked for at acceptance reaches the pull, and only for that acceptance. */
describe("extra-travel bed hold", () => {
  const UNIT = "rph-adult-secure";

  function accepted(extendedHold: boolean): WardFlowState {
    let state = wardFlowReducer(seedWardFlowState(), {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: [UNIT],
    });
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: UNIT,
      actingUnitId: UNIT,
      ...(extendedHold ? { extendedHold: true as const } : {}),
    });
    expect(state.rejections).toHaveLength(0);
    return state;
  }

  function pulled(state: WardFlowState, at: number): WardFlowState {
    const next = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "coordinator",
      now: at,
      movementId: "WF-009",
      unitId: UNIT,
    });
    expect(next.rejections.slice(state.rejections.length)).toEqual([]);
    return next;
  }

  it("holds the bed for the configured time when no extra hold was asked for", () => {
    const state = accepted(false);
    expect(movement(state, "WF-009").extendedHoldAt).toBeUndefined();
    const next = pulled(state, NOW + 5);
    expect(movement(next, "WF-009").pullExpiresAt).toBe(NOW + 5 + state.configuration.pullHoldMinutes);
  });

  it("adds the extra-travel minutes when the accepting ward asked for them", () => {
    const state = accepted(true);
    expect(movement(state, "WF-009").extendedHoldAt).toBe(NOW);
    const next = pulled(state, NOW + 5);
    expect(movement(next, "WF-009").pullExpiresAt).toBe(
      NOW + 5 + state.configuration.pullHoldMinutes + EXTRA_TRAVEL_HOLD_MINUTES,
    );
  });

  it("does not carry the extra hold once the acceptance it belonged to has changed", () => {
    const state = accepted(true);
    const stale: WardFlowState = {
      ...state,
      movements: state.movements.map((item) =>
        item.id === "WF-009" ? { ...item, acceptedAt: (item.acceptedAt ?? NOW) + 1 } : item,
      ),
    };
    const next = pulled(stale, NOW + 5);
    expect(movement(next, "WF-009").pullExpiresAt).toBe(NOW + 5 + state.configuration.pullHoldMinutes);
  });
});

/** #398: the discharge support notice is a recorded, ward-scoped event. */
describe("SEND_RELEASE_SUPPORT_NOTICE", () => {
  function confirmedRelease() {
    let state = seedWardFlowState();
    let target = state.bedReleases.find((candidate) => candidate.state === "confirmed");
    if (!target) {
      const expected = state.bedReleases.find((candidate) => candidate.state === "expected");
      if (!expected) throw new Error("the seed has no bed release to confirm");
      state = wardFlowReducer(state, {
        type: "CONFIRM_BED_RELEASE",
        role: "ward",
        now: NOW,
        releaseId: expected.id,
        actingUnitId: expected.unitId,
      });
      target = state.bedReleases.find((candidate) => candidate.id === expected.id);
    }
    if (!target || target.state !== "confirmed") throw new Error("no confirmed bed release");
    return { state, release: target };
  }

  function send(
    state: WardFlowState,
    fields: Partial<Extract<WardFlowEvent, { type: "SEND_RELEASE_SUPPORT_NOTICE" }>>,
  ) {
    return wardFlowReducer(state, {
      type: "SEND_RELEASE_SUPPORT_NOTICE",
      role: "ward",
      now: NOW + 1,
      releaseId: "",
      service: "pharmacy",
      actingUnitId: "",
      ...fields,
    });
  }

  it("records the notice on the release and logs it", () => {
    const { state, release } = confirmedRelease();
    const next = send(state, { releaseId: release.id, actingUnitId: release.unitId });
    expect(next.rejections).toHaveLength(state.rejections.length);
    const recorded = next.bedReleases.find((candidate) => candidate.id === release.id);
    expect(recorded?.supportNoticesSent).toEqual([{ service: "pharmacy", at: NOW + 1, by: "ward" }]);
    expect(next.auditEvents.at(-1)).toMatchObject({
      action: "SEND_RELEASE_SUPPORT_NOTICE",
      details: { kind: "bed-release", requested: { action: "SEND_RELEASE_SUPPORT_NOTICE", service: "pharmacy" } },
    });
    expect(EVENT_HISTORY_TABLE.SEND_RELEASE_SUPPORT_NOTICE.plainWording).toBe("Discharge support notice sent");
  });

  it("restores a saved notice and rejects a damaged or repeated one", () => {
    const { state, release } = confirmedRelease();
    // As saved: a JSON round trip drops the undefined fields the reducer leaves.
    const next = JSON.parse(
      JSON.stringify(send(state, { releaseId: release.id, actingUnitId: release.unitId })),
    ) as WardFlowState;
    expect(isValidStoredWardFlowState(next)).toBe(true);
    const damaged = (supportNoticesSent: unknown) => ({
      ...next,
      bedReleases: next.bedReleases.map((candidate) =>
        candidate.id === release.id ? { ...candidate, supportNoticesSent } : candidate,
      ),
    });
    expect(isValidStoredWardFlowState(damaged("bad"))).toBe(false);
    expect(isValidStoredWardFlowState(damaged([{ service: "laundry", at: NOW, by: "ward" }]))).toBe(false);
    const notice = { service: "pharmacy", at: NOW, by: "ward" };
    expect(isValidStoredWardFlowState(damaged([notice, notice]))).toBe(false);
  });

  it("refuses a second notice to the same service in plain words", () => {
    const { state, release } = confirmedRelease();
    const once = send(state, { releaseId: release.id, actingUnitId: release.unitId, service: "cleaning" });
    const twice = send(once, { releaseId: release.id, actingUnitId: release.unitId, service: "cleaning" });
    expect(twice.rejections.at(-1)?.reason).toBe("That service has already been notified.");
  });

  it("refuses another ward sending for this release", () => {
    const { state, release } = confirmedRelease();
    const other = state.units.find((unit) => unit.id !== release.unitId);
    if (!other) throw new Error("the seed has one unit");
    const next = send(state, { releaseId: release.id, actingUnitId: other.id });
    expect(next.rejections.at(-1)?.reason).toMatch(
      /^This discharge belongs to .+\. Only that ward can send its notices\.$/,
    );
  });

  it("refuses when the release is no longer confirmed", () => {
    const { state, release } = confirmedRelease();
    const reverted: WardFlowState = {
      ...state,
      bedReleases: state.bedReleases.map((item) => (item.id === release.id ? { ...item, state: "expected" } : item)),
    };
    const next = send(reverted, { releaseId: release.id, actingUnitId: release.unitId });
    expect(next.rejections.at(-1)?.reason).toBe("This discharge is no longer confirmed, so no notice was sent.");
  });
});

/** D-72: the arrival checklist search and chart are recorded facts on the movement. */
describe("RECORD_ARRIVAL_CHECK", () => {
  it("records and takes back each check, and refuses a repeat", () => {
    const seeded = seedWardFlowState();
    const open = seeded.movements.find((candidate) => candidate.closure === undefined);
    if (!open) throw new Error("the seed has no open movement");
    const record = (state: WardFlowState, check: "contraband_search" | "medication_chart", done: boolean) =>
      wardFlowReducer(state, { type: "RECORD_ARRIVAL_CHECK", role: "ed", now: NOW, movementId: open.id, check, done });

    let state = record(
      {
        ...seeded,
        movements: seeded.movements.map((m) =>
          m.id === open.id ? { ...m, contrabandSearchDone: undefined, medicationChartDone: undefined } : m,
        ),
      },
      "contraband_search",
      true,
    );
    expect(movement(state, open.id).contrabandSearchDone).toBe(true);
    state = record(state, "medication_chart", true);
    expect(movement(state, open.id).medicationChartDone).toBe(true);
    const repeat = record(state, "medication_chart", true);
    expect(repeat.rejections.at(-1)?.reason).toBe("This check is already recorded that way.");
    state = record(state, "contraband_search", false);
    expect(movement(state, open.id).contrabandSearchDone).toBe(false);
  });

  it("is refused for a ward desk", () => {
    const seeded = seedWardFlowState();
    const open = seeded.movements.find((candidate) => candidate.closure === undefined);
    if (!open) throw new Error("the seed has no open movement");
    const next = wardFlowReducer(seeded, {
      type: "RECORD_ARRIVAL_CHECK",
      role: "ward",
      now: NOW,
      movementId: open.id,
      check: "contraband_search",
      done: true,
    });
    expect(next.rejections.length).toBeGreaterThan(seeded.rejections.length);
  });
});
