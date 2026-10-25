import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { buildHistoryEntry } from "@/components/ward-management/ward-history";
import {
  callSheetGroups,
  chaseCount,
  commitmentEntriesFor,
  commitmentStatus,
  commitmentsDueBy,
  openCommitmentItems,
  promiseOverdue,
} from "@/components/ward-management/referrals/referral-commitments-model";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/** A seeded referral re-addressed to one named ward, still waiting on that ward's answer. */
function fixture() {
  const seeded = seedWardFlowState();
  const unitId = seeded.units[0]!.id;
  const base = seeded.referrals.find((referral) => referral.id === "RF-005")!;
  const referral: Referral = {
    ...base,
    contactLog: undefined,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId,
          sex: "Male",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
        referredAt: NOW - 60,
      },
    ],
  };
  const state: WardFlowState = {
    ...seeded,
    referrals: seeded.referrals.map((candidate) => (candidate.id === base.id ? referral : candidate)),
  };
  return { state, referralId: base.id, unitId };
}

type Commit = Extract<WardFlowEvent, { type: "RECORD_REFERRAL_COMMITMENT" }>;

const commit = (referralId: string, unitId: string, overrides: Partial<Commit> = {}): Commit => ({
  type: "RECORD_REFERRAL_COMMITMENT",
  role: "coordinator",
  now: NOW,
  referralId,
  unitId,
  step: "response_requested",
  ...overrides,
});

const referralIn = (state: WardFlowState, id: string) => state.referrals.find((candidate) => candidate.id === id)!;
const entriesIn = (state: WardFlowState, id: string, unitId: string) =>
  commitmentEntriesFor(referralIn(state, id).destinations[0]!, unitId);

function run(state: WardFlowState, ...events: WardFlowEvent[]) {
  return events.reduce((current, event) => wardFlowReducer(current, event), state);
}

describe("RECORD_REFERRAL_COMMITMENT", () => {
  it("records each step forward with who recorded it and when, and never answers the referral", () => {
    const f = fixture();
    const after = run(
      f.state,
      commit(f.referralId, f.unitId),
      commit(f.referralId, f.unitId, { role: "ward", actingUnitId: f.unitId, step: "acknowledged", now: NOW + 1 }),
      commit(f.referralId, f.unitId, {
        role: "ward",
        actingUnitId: f.unitId,
        step: "promised",
        promisedFor: NOW + 60,
        now: NOW + 2,
      }),
      commit(f.referralId, f.unitId, { step: undefined, nextCallbackAt: NOW + 30, now: NOW + 3 }),
    );
    expect(after.rejections).toHaveLength(f.state.rejections.length);
    expect(entriesIn(after, f.referralId, f.unitId)).toEqual([
      { unitId: f.unitId, step: "response_requested", at: NOW, by: "Flow coordinator" },
      { unitId: f.unitId, step: "acknowledged", at: NOW + 1, by: "Ward manager" },
      { unitId: f.unitId, step: "promised", promisedFor: NOW + 60, at: NOW + 2, by: "Ward manager" },
      { unitId: f.unitId, nextCallbackAt: NOW + 30, at: NOW + 3, by: "Flow coordinator" },
    ]);
    const arm = referralIn(after, f.referralId).destinations[0]!;
    expect(arm.state).toBe("queued");
    expect(arm.decidedAt).toBeUndefined();
    // Survives the restore fence, and history reads it in plain words.
    // A saved state is plain JSON.
    const stored = JSON.parse(JSON.stringify(after)) as WardFlowState;
    expect(isValidStoredWardFlowState(stored)).toBe(true);
    const withEntry = (entry: Record<string, unknown>) => {
      const copy = JSON.parse(JSON.stringify(after)) as {
        referrals: { id: string; destinations: { commitments?: unknown[] }[] }[];
      };
      copy.referrals.find((referral) => referral.id === f.referralId)!.destinations[0]!.commitments = [entry];
      return copy;
    };
    const base = { unitId: f.unitId, at: NOW, by: "Flow coordinator" };
    expect(isValidStoredWardFlowState(withEntry({ ...base, step: "acknowledged" }))).toBe(true);
    expect(isValidStoredWardFlowState(withEntry({ ...base, step: "maybe" }))).toBe(false);
    expect(isValidStoredWardFlowState(withEntry({ ...base, step: "acknowledged", note: "typed" }))).toBe(false);
    expect(isValidStoredWardFlowState(withEntry({ ...base, step: "acknowledged", promisedFor: NOW }))).toBe(false);
    expect(isValidStoredWardFlowState(withEntry(base))).toBe(false);
    const history = buildHistoryEntry(commit(f.referralId, f.unitId), NOW);
    expect(history.summary).toBe("Response commitment on a referral recorded");
    expect(history.relatedLinks.referralId).toBe(f.referralId);
  });

  it("is not the opened receipt: acknowledging leaves openedAt alone", () => {
    const f = fixture();
    const after = run(
      f.state,
      commit(f.referralId, f.unitId, { role: "ward", actingUnitId: f.unitId, step: "acknowledged" }),
    );
    expect(referralIn(after, f.referralId).destinations[0]!.openedAt).toBeUndefined();
  });

  it.each<[string, Partial<Commit>]>([
    ["a ward acting for another ward", { role: "ward", actingUnitId: "someone-else", step: "acknowledged" }],
    ["a ward asking itself for a response", { role: "ward", actingUnitId: undefined, step: "response_requested" }],
    ["a ward resolving", { role: "ward", step: "resolved" }],
    ["a step off the list", { step: "maybe" as Commit["step"] }],
    ["a promise with no time", { step: "promised" }],
    ["a promise in the past", { step: "promised", promisedFor: NOW - 1 }],
    ["a promised time without the promised step", { step: "acknowledged", promisedFor: NOW + 10 }],
    ["a callback in the past", { step: undefined, nextCallbackAt: NOW - 1 }],
    ["nothing to record", { step: undefined }],
    ["an unknown ward", { unitId: "no-such-ward" }],
  ])("refuses %s", (_name, overrides) => {
    const f = fixture();
    const event = commit(f.referralId, f.unitId, overrides);
    if (overrides.role === "ward" && !("actingUnitId" in overrides)) event.actingUnitId = f.unitId;
    const after = wardFlowReducer(f.state, event);
    expect(after.rejections.length).toBe(f.state.rejections.length + 1);
    expect(referralIn(after, f.referralId).destinations[0]!.commitments).toBeUndefined();
  });

  it("moves forward only, and closes once resolved", () => {
    const f = fixture();
    const acknowledged = run(f.state, commit(f.referralId, f.unitId, { step: "acknowledged" }));
    const back = wardFlowReducer(acknowledged, commit(f.referralId, f.unitId, { step: "response_requested" }));
    expect(back.rejections.length).toBe(acknowledged.rejections.length + 1);
    const resolved = wardFlowReducer(acknowledged, commit(f.referralId, f.unitId, { step: "resolved" }));
    const afterResolved = wardFlowReducer(
      resolved,
      commit(f.referralId, f.unitId, { step: undefined, nextCallbackAt: NOW + 5 }),
    );
    expect(afterResolved.rejections.length).toBe(resolved.rejections.length + 1);
  });

  it("refuses once the ward has answered", () => {
    const f = fixture();
    const answered: WardFlowState = {
      ...f.state,
      referrals: f.state.referrals.map((referral) =>
        referral.id === f.referralId
          ? { ...referral, destinations: [{ ...referral.destinations[0]!, state: "declined" as const }] }
          : referral,
      ),
    };
    const after = wardFlowReducer(answered, commit(f.referralId, f.unitId));
    expect(after.rejections.length).toBe(answered.rejections.length + 1);
  });
});

describe("commitment selectors", () => {
  it("shows a promise overdue from the recorded time alone", () => {
    const status = commitmentStatus([
      { unitId: "u", step: "promised", promisedFor: NOW + 10, at: NOW, by: "Ward manager" },
    ]);
    expect(promiseOverdue(status, NOW + 10)).toBe(false);
    expect(promiseOverdue(status, NOW + 11)).toBe(true);
  });

  it("counts every call to the ward and every response request as one ask", () => {
    const seeded = seedWardFlowState();
    const rf001 = seeded.referrals.find((referral) => referral.id === "RF-001")!;
    expect(chaseCount(rf001, "bty-youth")).toBe(3);
    expect(chaseCount(rf001, "fsh-older-adult")).toBe(0);
  });

  it("groups the seeded open commitments by ward, in recorded order, with the overdue promise", () => {
    const seeded = seedWardFlowState();
    const groups = callSheetGroups(seeded.referrals, seeded.units);
    const youth = groups.find((group) => group.unitId === "bty-youth")!;
    expect(youth.items.map((item) => item.referral.id)).toEqual(["RF-001"]);
    expect(youth.lastCall?.outcome).toBe("call_back");
    expect(youth.nextCallbackAt).toBe(NOW + 20);
    expect(promiseOverdue(youth.items[0]!.status, NOW)).toBe(true);
    expect(groups.some((group) => group.unitId === "fsh-older-adult")).toBe(true);
    // Recorded order inside a group: the seed order, never re-sorted.
    const ids = openCommitmentItems(seeded.referrals).map((item) => item.referral.id);
    expect(ids).toEqual(
      [...ids].sort(
        (a, b) => seeded.referrals.findIndex((r) => r.id === a) - seeded.referrals.findIndex((r) => r.id === b),
      ),
    );
  });

  it("carries over to handover only what is overdue or falls before the end of the next shift", () => {
    const seeded = seedWardFlowState();
    expect(commitmentsDueBy(seeded.referrals, NOW + 30).map((item) => item.referral.id)).toEqual(["RF-001"]);
    expect(commitmentsDueBy(seeded.referrals, NOW + 60).map((item) => item.referral.id)).toEqual(["RF-001", "RF-005"]);
  });
});
