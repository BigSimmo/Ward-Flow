import { describe, expect, it } from "vitest";
import { scopeWorld, type SharedWorld } from "../backend/ward-flow/engine";
import { WARD_BUZZ_MESSAGES } from "@/components/ward-management/ward-flow-events";
import { buzzKeys } from "@/components/ward-management/ward/ward-buzz-keys";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { STATEWIDE_COORDINATOR } from "@/components/ward-management/ward-role-access";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";

const NOW = 10_000;

describe("retained buzz acknowledgement identity (WF-001)", () => {
  it("preserves both acknowledged and unread duplicate keys through rollover and JSON storage", () => {
    let state = seedWardFlowStateAt(NOW);
    const command = {
      type: "SEND_WARD_BUZZ",
      role: "coordinator",
      now: NOW,
      unitId: state.units[0]!.id,
      message: WARD_BUZZ_MESSAGES[0],
    } as const;
    state = wardFlowReducer(state, command);
    expect(state.refreshRequests).toHaveLength(1);
    state = wardFlowReducer(state, command);
    const before = buzzKeys(state.refreshRequests);
    expect(new Set(before).size).toBe(2);
    const acknowledged = new Set([before[0]]);
    for (let i = 0; i < 499; i++) state = wardFlowReducer(state, command);
    expect(state.refreshRequests).toHaveLength(500);
    const after = buzzKeys(JSON.parse(JSON.stringify(state.refreshRequests)));
    expect(after[0]).toBe(before[1]);
    expect(after.filter((key) => !acknowledged.has(key))).toHaveLength(500);
    expect(after.includes(before[0]!)).toBe(false);
    expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const acknowledgedSurvivor = new Set([before[1]]);
    expect(after.filter((key) => acknowledgedSurvivor.has(key))).toEqual([before[1]]);
  });

  it("freezes legacy duplicate identities before either request producer trims them", () => {
    let state = seedWardFlowStateAt(NOW);
    const duplicate = { unitId: state.units[0]!.id, at: NOW, byRole: "coordinator" };
    state = {
      ...state,
      refreshRequests: [duplicate, { ...duplicate }, ...Array.from({ length: 498 }, (_, at) => ({ ...duplicate, at }))],
    };
    const survivor = buzzKeys(state.refreshRequests)[1];
    const next = wardFlowReducer(state, {
      type: "REQUEST_CAPACITY_REFRESH",
      role: "coordinator",
      now: NOW,
      unitId: duplicate.unitId,
    });
    expect(next.refreshRequests).toHaveLength(500);
    expect(buzzKeys(next.refreshRequests)[0]).toBe(survivor);
    expect(buzzKeys(JSON.parse(JSON.stringify(next.refreshRequests)))[0]).toBe(survivor);
  });
});

describe("community criteria at the serialized snapshot boundary (WF-025)", () => {
  it.each([false, true])(
    "redacts typed text, including grant expansion (%s), while preserving ward/coordinator reads",
    (grant) => {
      const state = seedWardFlowStateAt(NOW);
      const admission = state.admissions.find((entry) => entry.patientId !== null)!;
      const team = COMMUNITY_TEAM_PAGES[0]!;
      const referral = {
        ...state.referrals[0]!,
        id: "REF-CRITERIA-REVIEW",
        patientId: admission.patientId!,
        destinations: [
          { destination: { kind: "community_team" as const, teamName: team.name }, state: "accepted" as const },
        ],
      };
      state.referrals.push(referral);
      admission.referralId = referral.id;
      admission.dischargeCriteria = {
        setAt: NOW - 5,
        items: [
          { criterion: "Accommodation confirmed", metAt: NOW - 1 },
          { criterion: "Synthetic private criterion alpha", metAt: NOW - 2, patientSpecific: true },
          { criterion: "Synthetic private criterion beta", metAt: null, patientSpecific: true },
        ],
      };
      const options = {
        now: NOW,
        places: wardPlaceLookup(state.units),
        ...(grant ? { grants: [{ patientId: admission.patientId!, until: NOW + 10 }] } : {}),
      };
      expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
      const community = scopeWardFlowState(
        state,
        { role: "community", scope: { kind: "team", teamName: team.name } },
        options,
      ).state;
      const wire = JSON.stringify({ snapshot: { payload: { state: community } } });
      expect(wire).not.toContain("Synthetic private criterion");
      // This is the same backend projection used for polls and command snapshot refreshes.
      const world: SharedWorld = {
        version: 1,
        state,
        dayZero: "2026-10-18T00:00:00Z",
        startedAt: "2026-10-18T00:00:00Z",
      };
      expect(
        JSON.stringify(
          scopeWorld(
            world,
            { role: "community", scope: { kind: "team", teamName: team.name } },
            new Date("2026-10-18T00:00:00Z"),
          ),
        ),
      ).not.toContain("Synthetic private criterion");
      const received = JSON.parse(wire).snapshot.payload.state;
      expect(isValidSharedWardFlowState(received)).toBe(true);
      expect(received.admissions.find((entry: { id: string }) => entry.id === admission.id).dischargeCriteria).toEqual({
        setAt: NOW - 5,
        items: [
          { criterion: "Accommodation confirmed", metAt: NOW - 1 },
          { criterion: "Patient specific criterion 1", metAt: NOW - 2, patientSpecific: true },
          { criterion: "Patient specific criterion 2", metAt: null, patientSpecific: true },
        ],
      });
      for (const access of [
        STATEWIDE_COORDINATOR,
        { role: "ward", scope: { kind: "ward", unitIds: [admission.unitId] } },
      ] as const) {
        expect(JSON.stringify(scopeWardFlowState(state, access, options).state)).toContain(
          "Synthetic private criterion alpha",
        );
      }
      expect(admission.dischargeCriteria.items[1]!.criterion).toBe("Synthetic private criterion alpha");
    },
  );
});
