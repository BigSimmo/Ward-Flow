import { afterEach, describe, expect, it } from "vitest";
import { referralIntakeError } from "@/components/ward-management/referrals/referral-submission";
import { seedWardFlowState, seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { seededReferralDossier } from "@/components/ward-management/ward-referral-dossier-seed";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { activateScenarioNetwork, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { checkSyntheticPayload } from "@/lib/synthetic-data-guard";

afterEach(() => activateScenarioNetwork("standard"));

describe("referral context at the real seed boundary", () => {
  it("includes valid reason, risk, legal, source, destination, sent time and attributed decisions on every actual referral", () => {
    let checked = 0;
    for (const scenario of WARD_SCENARIOS) {
      activateScenarioNetwork(scenario);
      const state = seedWardFlowState(scenario);
      for (const referral of state.referrals) {
        checked += 1;
        expect(referral.intake, `${scenario}/${referral.id}`).toBeDefined();
        expect(referralIntakeError(referral.intake!), referral.id).toBeNull();
        expect(referral.intake!.reasonForReferral.trim().length).toBeGreaterThan(20);
        expect(Array.isArray(referral.intake!.riskFlags)).toBe(true);
        expect(referral.intake!.legalStatus.trim()).not.toBe("");
        expect(referral.source).not.toBe("");
        expect(Number.isFinite(referral.raisedAt)).toBe(true);
        expect(referral.destinations.length).toBeGreaterThan(0);
        for (const arm of referral.destinations) {
          expect(arm.referredAt, referral.id).toBeGreaterThanOrEqual(referral.raisedAt);
          if (arm.state === "accepted" || arm.state === "declined") {
            expect(arm.decidedAt, referral.id).toBeGreaterThanOrEqual(arm.referredAt!);
            expect(arm.decidedBy?.trim(), referral.id).toBeTruthy();
          }
        }
      }
      expect(state).toEqual(seedWardFlowState(scenario));
      // Recovery validates decoded JSON; optional undefined properties are omitted by storage.
      expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state))), scenario).toBe(true);
      expect(
        isValidStoredWardFlowState(JSON.parse(JSON.stringify(seedWardFlowStateAt(300, scenario)))),
        `${scenario} shifted`,
      ).toBe(true);
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("gives each recorded ward offer a dossier while preserving honest no-offer cases", () => {
    let sent = 0;
    let absent = 0;
    for (const scenario of WARD_SCENARIOS) {
      activateScenarioNetwork(scenario);
      for (const movement of seedWardFlowState(scenario).movements) {
        const hasOffer =
          movement.referredUnitIds.length > 0 ||
          !!movement.acceptedUnitId ||
          movement.declines.length > 0 ||
          movement.withdrawnReferrals.length > 0;
        const dossier = seededReferralDossier(movement.id, movement);
        if (hasOffer) {
          sent += 1;
          expect(dossier, movement.id).toBeDefined();
          expect(dossier!.risk.length, movement.id).toBeGreaterThan(0);
          expect(dossier!.legal.length, movement.id).toBeGreaterThan(0);
          expect(dossier!.documents.length, movement.id).toBeGreaterThan(0);
          expect(checkSyntheticPayload(dossier), movement.id).toEqual({ safe: true });
        } else if (movement.referralAbsence?.reason === "none_raised") {
          absent += 1;
          expect(dossier, movement.id).toBeUndefined();
        }
      }
    }
    expect(sent).toBeGreaterThan(100);
    expect(absent).toBeGreaterThan(0);
  });

  it("does not invent seed clinical content for a newly created offered journey", () => {
    const movement = {
      ...seedWardFlowState().movements[0]!,
      id: "WF-NEW-SYNTHETIC" as const,
      referredUnitIds: ["new-ward"],
    };
    expect(seededReferralDossier(movement.id, movement)).toBeUndefined();
  });

  it("does not give an authored dossier to a different patient reusing its journey ID", () => {
    const movement = seedWardFlowState().movements.find((entry) => entry.id === "WF-002")!;
    expect(seededReferralDossier(movement.id, movement)).toBeDefined();
    expect(seededReferralDossier(movement.id, { ...movement, patientId: "PT-NEW-SYNTHETIC" })).toBeUndefined();
  });
});
