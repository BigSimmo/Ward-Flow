import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { journeySentByKind } from "@/components/ward-management/ward-journey-sender";
import type { Referral } from "@/components/ward-management/ward-model";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Role access plan v2 (D-80), PR 4c: a ward or team amends only a journey it sent. */
describe("the sender's own journey tools (D-80)", () => {
  const seed = seedWardFlowState();
  const places = wardPlaceLookup(seed.units);
  const options = { now: NOW_ANCHOR, places };
  const [sending, receiving] = seed.units;
  const sendingWard: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [sending!.id] } };
  const receivingWard: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [receiving!.id] } };
  const team = "Synthetic Community Team";
  const ownTeam: WardAccess = { role: "community", scope: { kind: "team", teamName: team } };
  const otherTeam: WardAccess = { role: "community", scope: { kind: "team", teamName: "Another Synthetic Team" } };
  const base = seed.referrals[0]!;
  const wardSent = { ...base, id: "REF-D80-WARD", source: "psychiatric_ward", originUnitId: sending!.id } as Referral;
  const teamSent = { ...base, id: "REF-D80-TEAM", source: "community", sendingTeamName: team } as Referral;
  const edSent = { ...base, id: "REF-D80-ED", source: "ed_medical" } as Referral;
  const open = seed.movements.find((movement) => !movement.closure)!;
  const journey = (id: `WF-${string}`, referralId: string) => ({
    ...open,
    id,
    referralId,
    sourceAdmissionId: undefined,
  });
  const state: WardFlowState = {
    ...seed,
    referrals: [wardSent, teamSent, edSent, ...seed.referrals],
    movements: [
      journey("WF-D80-WARD", wardSent.id),
      journey("WF-D80-TEAM", teamSent.id),
      journey("WF-D80-ED", edSent.id),
      ...seed.movements,
    ],
  };
  const urgency = (role: "ward" | "community", movementId: string) =>
    ({ type: "CHANGE_URGENCY", role, now: NOW_ANCHOR, movementId, urgency: 1, reason: "reassessed" }) as const;

  it("gives wards and teams the referrer's journey tools, and the team its own handover", () => {
    for (const type of [
      "CHANGE_URGENCY",
      "CHANGE_LEGAL_STATUS",
      "RECORD_LEGAL_FORM_RECEIVED",
      "CORRECT_LEGAL_FORM_RECEIPT",
    ] as const) {
      expect(EVENT_ROLE[type], type).toEqual(expect.arrayContaining(["ward", "community"]));
    }
    expect(EVENT_ROLE.HANDOVER_READY).toContain("community");
    expect(EVENT_ROLE.HANDOVER_READY).not.toContain("ward");
    expect(EVENT_ROLE.FLAG_MOVEMENT_URGENT).toEqual(["coordinator", "ed"]);
  });

  it("refuses in the reducer a journey another kind of desk sent", () => {
    expect(journeySentByKind(state.referrals, state.movements[0]!, "ward")).toBe(true);
    expect(journeySentByKind(state.referrals, state.movements[2]!, "ward")).toBe(false);
    expect(journeySentByKind(state.referrals, state.movements[1]!, "community")).toBe(true);
    expect(journeySentByKind(state.referrals, state.movements[0]!, "community")).toBe(false);
    expect(journeySentByKind(state.referrals, state.movements[2]!, "ed")).toBe(true);
    const refused = (event: Parameters<typeof wardFlowReducer>[1]) =>
      wardFlowReducer(state, event).rejections.length - state.rejections.length;
    expect(refused(urgency("ward", "WF-D80-ED"))).toBe(1);
    expect(refused(urgency("community", "WF-D80-WARD"))).toBe(1);
    expect(
      refused({ type: "RECORD_LEGAL_FORM_RECEIVED", role: "ward", now: NOW_ANCHOR, movementId: "WF-D80-ED" }),
    ).toBe(1);
    expect(refused({ type: "HANDOVER_READY", role: "community", now: NOW_ANCHOR, movementId: "WF-D80-ED" })).toBe(1);
  });

  it("refuses on the server a journey another ward or team sent", () => {
    expect(commandScopeRefusal(state, sendingWard, urgency("ward", "WF-D80-WARD"), options)).toBeNull();
    expect(commandScopeRefusal(state, receivingWard, urgency("ward", "WF-D80-WARD"), options)).not.toBeNull();
    expect(commandScopeRefusal(state, ownTeam, urgency("community", "WF-D80-TEAM"), options)).toBeNull();
    expect(commandScopeRefusal(state, otherTeam, urgency("community", "WF-D80-TEAM"), options)).not.toBeNull();
    const ready = { type: "HANDOVER_READY", role: "community", movementId: "WF-D80-TEAM" };
    expect(commandScopeRefusal(state, ownTeam, ready, options)).toBeNull();
    expect(commandScopeRefusal(state, otherTeam, ready, options)).not.toBeNull();
  });
});
