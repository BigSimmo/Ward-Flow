import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { buildHistoryEntry } from "@/components/ward-management/ward-history";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import {
  currentReferralOwner,
  lastReferralContact,
  minutesAgoLabel,
} from "@/components/ward-management/referrals/referral-owner-and-calls-model";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/** A seeded referral re-addressed to one named ward, still waiting on that ward's answer. */
function fixture() {
  const seeded = seedWardFlowState();
  const unitId = seeded.units[0]!.id;
  const base = seeded.referrals[0]!;
  const referral: Referral = {
    ...base,
    ownerHistory: undefined,
    contactLog: undefined,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId,
          sex: "Female",
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

const referralIn = (state: WardFlowState, id: string) => state.referrals.find((candidate) => candidate.id === id)!;

type Assign = Extract<WardFlowEvent, { type: "ASSIGN_REFERRAL" }>;
type LogCall = Extract<WardFlowEvent, { type: "LOG_REFERRAL_CONTACT" }>;

const assign = (referralId: string, overrides: Partial<Assign> = {}): Assign => ({
  type: "ASSIGN_REFERRAL",
  role: "coordinator",
  now: NOW,
  referralId,
  owner: "coordinator",
  ...overrides,
});

const logCall = (referralId: string, overrides: Partial<LogCall> = {}): LogCall => ({
  type: "LOG_REFERRAL_CONTACT",
  role: "coordinator",
  now: NOW,
  referralId,
  contact: { kind: "referrer" },
  outcome: "no_answer",
  ...overrides,
});

describe("ASSIGN_REFERRAL", () => {
  it("records the owner desk, the time and who assigned it, and leaves the referral unanswered", () => {
    const f = fixture();
    const assigned = wardFlowReducer(f.state, assign(f.referralId, { owner: "ed" }));
    expect(assigned.rejections).toEqual([]);
    const referral = referralIn(assigned, f.referralId);
    expect(referral.ownerHistory).toEqual([{ owner: "ed", at: NOW, by: "Bed coordinator" }]);
    expect(currentReferralOwner(referral)?.owner).toBe("ed");
    expect(referral.destinations[0]!.state).toBe("queued");
    expect(referral.destinations[0]!.decidedAt).toBeUndefined();
  });

  it("appends a reassignment and keeps the earlier owner in the history", () => {
    const f = fixture();
    const first = wardFlowReducer(f.state, assign(f.referralId));
    const second = wardFlowReducer(first, assign(f.referralId, { owner: "community", now: NOW + 10 }));
    expect(second.rejections).toEqual([]);
    expect(referralIn(second, f.referralId).ownerHistory?.map((entry) => entry.owner)).toEqual([
      "coordinator",
      "community",
    ]);
  });

  it("refuses assigning to the desk that already has it", () => {
    const f = fixture();
    const first = wardFlowReducer(f.state, assign(f.referralId));
    const again = wardFlowReducer(first, assign(f.referralId, { now: NOW + 1 }));
    expect(again.rejections).toHaveLength(1);
    expect(referralIn(again, f.referralId).ownerHistory).toHaveLength(1);
  });

  it("lets an ED or community desk take a referral for itself only", () => {
    const f = fixture();
    const taken = wardFlowReducer(f.state, assign(f.referralId, { role: "community", owner: "community" }));
    expect(taken.rejections).toEqual([]);
    expect(referralIn(taken, f.referralId).ownerHistory?.[0]).toEqual({
      owner: "community",
      at: NOW,
      by: "Community service",
    });
    const handedOn = wardFlowReducer(f.state, assign(f.referralId, { role: "ed", owner: "coordinator" }));
    expect(handedOn.rejections).toHaveLength(1);
    expect(handedOn.rejections[0]!.reason).toMatch(/only for its own desk/);
  });

  it("refuses a ward, an owner off the list and a missing referral", () => {
    const f = fixture();
    expect(wardFlowReducer(f.state, assign(f.referralId, { role: "ward" })).rejections).toHaveLength(1);
    const offList = assign(f.referralId, { owner: "ward" as never });
    expect(wardFlowReducer(f.state, offList).rejections).toHaveLength(1);
    expect(wardFlowReducer(f.state, assign("no-such-referral")).rejections).toHaveLength(1);
  });

  it("refuses a time that is not finite, for an assignment and a call alike", () => {
    const f = fixture();
    for (const now of [Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const event of [assign(f.referralId, { now }), logCall(f.referralId, { now })]) {
        const next = wardFlowReducer(f.state, event);
        expect(next.rejections).toHaveLength(1);
        expect(referralIn(next, f.referralId).ownerHistory).toBeUndefined();
        expect(referralIn(next, f.referralId).contactLog).toBeUndefined();
      }
    }
  });

  it("refuses once a destination has accepted", () => {
    const f = fixture();
    const accepted: WardFlowState = {
      ...f.state,
      referrals: f.state.referrals.map((referral) =>
        referral.id === f.referralId
          ? {
              ...referral,
              destinations: referral.destinations.map((arm) => ({
                ...arm,
                state: "accepted" as const,
                acceptedUnitId: f.unitId,
                decidedAt: NOW - 1,
              })),
            }
          : referral,
      ),
    };
    const refused = wardFlowReducer(accepted, assign(f.referralId));
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0]!.reason).toMatch(/accepted/);
  });
});

describe("LOG_REFERRAL_CONTACT", () => {
  it("logs who was rung, what they said, when and by which desk, without answering the ward's copy", () => {
    const f = fixture();
    const logged = wardFlowReducer(
      f.state,
      logCall(f.referralId, { contact: { kind: "psychiatric_ward", unitId: f.unitId }, outcome: "said_yes" }),
    );
    expect(logged.rejections).toEqual([]);
    const referral = referralIn(logged, f.referralId);
    expect(referral.contactLog).toEqual([
      { contact: { kind: "psychiatric_ward", unitId: f.unitId }, outcome: "said_yes", at: NOW, by: "Bed coordinator" },
    ]);
    // "Said yes" on the phone is not an acceptance: the ward's copy still waits for its answer.
    expect(referral.destinations[0]!.state).toBe("queued");
    expect(referral.destinations[0]!.decidedAt).toBeUndefined();
  });

  it("keeps every call in order and reports the latest", () => {
    const f = fixture();
    const team = COMMUNITY_TEAM_PAGES[0]!;
    let state = wardFlowReducer(f.state, logCall(f.referralId));
    state = wardFlowReducer(
      state,
      logCall(f.referralId, {
        role: "ed",
        now: NOW + 20,
        contact: { kind: "community_team", teamId: team.id },
        outcome: "call_back",
      }),
    );
    expect(state.rejections).toEqual([]);
    const referral = referralIn(state, f.referralId);
    expect(referral.contactLog).toHaveLength(2);
    expect(lastReferralContact(referral)).toEqual({
      contact: { kind: "community_team", teamId: team.id },
      outcome: "call_back",
      at: NOW + 20,
      by: "ED clinician",
    });
  });

  it("refuses an unknown ward or team, an off-list outcome, a malformed contact and a ward desk", () => {
    const f = fixture();
    const refusals = [
      logCall(f.referralId, { contact: { kind: "psychiatric_ward", unitId: "no-such-ward" } }),
      logCall(f.referralId, { contact: { kind: "community_team", teamId: "no-such-team" } }),
      logCall(f.referralId, { outcome: "promised a bed" as never }),
      logCall(f.referralId, { contact: { kind: "police" } as never }),
      logCall(f.referralId, { contact: null as never }),
      logCall(f.referralId, { role: "ward" }),
    ];
    for (const event of refusals) {
      const after = wardFlowReducer(f.state, event);
      expect(after.rejections, JSON.stringify(event)).toHaveLength(1);
      expect(referralIn(after, f.referralId).contactLog).toBeUndefined();
    }
  });

  it("stores only the checked contact fields", () => {
    const f = fixture();
    const logged = wardFlowReducer(
      f.state,
      logCall(f.referralId, { contact: { kind: "referrer", note: "typed text" } as never }),
    );
    expect(logged.rejections).toEqual([]);
    expect(referralIn(logged, f.referralId).contactLog?.[0]!.contact).toEqual({ kind: "referrer" });
  });

  it("refuses once the referrer has withdrawn every copy", () => {
    const f = fixture();
    const withdrawn: WardFlowState = {
      ...f.state,
      referrals: f.state.referrals.map((referral) =>
        referral.id === f.referralId
          ? { ...referral, destinations: referral.destinations.map((arm) => ({ ...arm, withdrawnAt: NOW - 1 })) }
          : referral,
      ),
    };
    const refused = wardFlowReducer(withdrawn, logCall(f.referralId));
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0]!.reason).toMatch(/withdrawn/);
  });
});

describe("history wording", () => {
  it("names both events in plain words, joined to the referral and the desk, never a person", () => {
    const f = fixture();
    const assigned = buildHistoryEntry(assign(f.referralId), NOW);
    expect(assigned.summary).toBe("Referral assigned to a desk");
    expect(assigned.who).toBe("Bed coordinator");
    expect(assigned.relatedLinks.referralId).toBe(f.referralId);
    const called = buildHistoryEntry(logCall(f.referralId), NOW);
    expect(called.summary).toBe("Call about a referral logged");
    expect(called.relatedLinks.referralId).toBe(f.referralId);
  });
});

describe("minutesAgoLabel", () => {
  it("reads as minutes, then hours and minutes", () => {
    expect(minutesAgoLabel(NOW, NOW)).toBe("just now");
    expect(minutesAgoLabel(NOW - 40, NOW)).toBe("40 min ago");
    expect(minutesAgoLabel(NOW - 125, NOW)).toBe("2h 05m ago");
  });
});

describe("saved owner and call records", () => {
  const saved = (edit: (referral: Record<string, unknown>) => Record<string, unknown>) => {
    const f = fixture();
    const state = wardFlowReducer(
      wardFlowReducer(f.state, assign(f.referralId)),
      logCall(f.referralId, { contact: { kind: "psychiatric_ward", unitId: f.unitId } }),
    );
    // A saved state is plain JSON, so it is edited as JSON.
    const stored = JSON.parse(JSON.stringify(state)) as { referrals: Record<string, unknown>[] };
    stored.referrals = stored.referrals.map((referral) => (referral.id === f.referralId ? edit(referral) : referral));
    return stored;
  };

  it("restores a listed owner and a listed call", () => {
    expect(isValidStoredWardFlowState(saved((referral) => referral))).toBe(true);
  });

  it("refuses an owner or outcome off the list, a typed field and a non-numeric time", () => {
    expect(
      isValidStoredWardFlowState(
        saved((referral) => ({
          ...referral,
          ownerHistory: [{ owner: "Dr Someone", at: NOW, by: "Bed coordinator" }],
        })),
      ),
    ).toBe(false);
    expect(
      isValidStoredWardFlowState(
        saved((referral) => ({
          ...referral,
          contactLog: [{ contact: { kind: "referrer" }, outcome: "typed", at: NOW, by: "Bed coordinator" }],
        })),
      ),
    ).toBe(false);
    expect(
      isValidStoredWardFlowState(
        saved((referral) => ({
          ...referral,
          contactLog: [
            { contact: { kind: "referrer" }, outcome: "no_answer", at: NOW, by: "Bed coordinator", note: "typed" },
          ],
        })),
      ),
    ).toBe(false);
    expect(
      isValidStoredWardFlowState(
        saved((referral) => ({ ...referral, ownerHistory: [{ owner: "ed", at: "soon", by: "Bed coordinator" }] })),
      ),
    ).toBe(false);
  });
});
