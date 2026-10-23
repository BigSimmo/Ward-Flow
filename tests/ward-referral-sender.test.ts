import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { referralSentByDesk } from "@/components/ward-management/ward-referral-sender";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Role access plan v2 (D-80): the sender's own tools stay with the desk that sent the referral. */
describe("the sender's own referral tools (D-80)", () => {
  const seed = seedWardFlowState();
  const places = wardPlaceLookup(seed.units);
  const options = { now: NOW_ANCHOR, places };
  const [sending, receiving] = seed.units;
  const sendingWard: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [sending!.id] } };
  const receivingWard: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [receiving!.id] } };
  const sent: Referral = {
    ...seed.referrals[0]!,
    source: "psychiatric_ward",
    originUnitId: sending!.id,
    destinations: [{ destination: { kind: "psychiatric_ward", unitId: receiving!.id }, state: "queued" }],
  } as Referral;
  const state: WardFlowState = { ...seed, referrals: [sent, ...seed.referrals.slice(1)] };

  it("names the sending ward as the sender, never the ward answering it", () => {
    expect(referralSentByDesk(sent, sendingWard, places)).toBe(true);
    expect(referralSentByDesk(sent, receivingWard, places)).toBe(false);
    expect(referralSentByDesk({ ...sent, source: "ed_medical" }, sendingWard, places)).toBe(false);
  });

  it("lets a ward correct and tick off only the referrals it sent", () => {
    expect(EVENT_ROLE.ADD_REFERRAL_CORRECTION).toContain("ward");
    expect(EVENT_ROLE.MARK_REFERRAL_INFORMATION_MET).toContain("ward");
    const correct = { type: "ADD_REFERRAL_CORRECTION", role: "ward", referralId: sent.id, note: "Synthetic note" };
    const tick = {
      type: "MARK_REFERRAL_INFORMATION_MET",
      role: "ward",
      referralId: sent.id,
      wardUnitId: receiving!.id,
      need: "drug_screen",
    };
    for (const command of [correct, tick]) {
      expect(commandScopeRefusal(state, sendingWard, command, options), command.type).toBeNull();
      expect(commandScopeRefusal(state, receivingWard, command, options), command.type).toMatch(/outside/);
    }
  });

  it("keeps urgency, legal status and form receipts to a ward's own sent journeys", () => {
    // The journey is referred to the receiving ward too, so it sits in that ward's own view.
    const movement = { ...state.movements[0]!, referralId: sent.id, referredUnitIds: [receiving!.id] };
    const world: WardFlowState = { ...state, movements: [movement, ...state.movements.slice(1)] };
    for (const type of ["CHANGE_URGENCY", "CHANGE_LEGAL_STATUS", "RECORD_LEGAL_FORM_RECEIVED"] as const) {
      const command = { type, role: "ward", movementId: movement.id };
      expect(commandScopeRefusal(world, sendingWard, command, options), type).toBeNull();
      expect(commandScopeRefusal(world, receivingWard, command, options), type).toMatch(/outside/);
    }
  });

  it("requires every desk to name its own place when it adds a patient (review on PR #606)", () => {
    const edDesk: WardAccess = { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } };
    const add = (registrationScope?: { kind: "ed"; placeId: string }) => ({
      type: "ADD_PATIENT",
      role: "ed",
      givenName: "Synthetic",
      familyName: "Person",
      umrn: "SYN0000001",
      dateOfBirth: "1990-01-01",
      ...(registrationScope ? { registrationScope } : {}),
    });
    expect(commandScopeRefusal(state, edDesk, add(), options)).toMatch(/outside/);
    expect(commandScopeRefusal(state, edDesk, add({ kind: "ed", placeId: "fsh-ed" }), options)).toBeNull();
    expect(commandScopeRefusal(state, edDesk, add({ kind: "ed", placeId: "rph-ed" }), options)).toMatch(/outside/);
    const coordinator: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
    expect(commandScopeRefusal(state, coordinator, { ...add(), role: "coordinator" }, options)).toBeNull();
  });
});
