import { describe, expect, it } from "vitest";

import { referralIntakeError } from "@/components/ward-management/referrals/referral-submission";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardRequestNeedsInvoluntaryBed } from "@/components/ward-management/ward-eligibility";
import {
  completeSyntheticReferralIntake,
  completeSyntheticReferralIntakes,
  syntheticMovementReferralDossier,
  seededReferralMedicalTarget,
} from "@/components/ward-management/ward-referral-intake-seed";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";

describe("complete synthetic referral form content", () => {
  it("provides a valid deterministic intake for every actual referral in every scenario", () => {
    for (const scenario of WARD_SCENARIOS) {
      const state = seedWardFlowState(scenario);
      expect(state.referrals.length, scenario).toBe(scenario === "standard" || scenario === "scarce" ? 31 : 9);
      const before = structuredClone(state.referrals);
      const completed = completeSyntheticReferralIntakes(state.referrals, { movements: state.movements });
      expect(completed).toHaveLength(before.length);
      expect(completed).toEqual(completeSyntheticReferralIntakes(state.referrals, { movements: state.movements }));
      expect(state.referrals).toEqual(before);
      for (const referral of completed) {
        expect(referralIntakeError(referral.intake!), referral.id).toBeNull();
        expect(referral.intake!.reasonForReferral.length).toBeGreaterThan(20);
        expect(referral.intake!.reasonForReferral).toContain("Risk summary:");
        expect(referral.intake!.legalStatus.length).toBeGreaterThan(0);
        expect(referral.intake!.referrer.email).toMatch(/\.invalid$/);
        expect(referral.intake!.referrer.phone).toBe("08 5550 0156");
        expect(referral.destinations.every((entry) => entry.referredAt !== undefined)).toBe(true);
      }
    }
  });

  it("preserves history, routing, patient links and recorded decisions, including queued absence", () => {
    const source = seedWardFlowState().referrals;
    for (const original of source) {
      const completed = completeSyntheticReferralIntake(original);
      const routingFacts = (referral: typeof original) =>
        Object.fromEntries(Object.entries(referral).filter(([key]) => key !== "intake" && key !== "destinations"));
      expect(routingFacts(completed)).toEqual(routingFacts(original));
      for (const [index, entry] of completed.destinations.entries()) {
        const { referredAt, ...answer } = entry;
        const { referredAt: originalTime, ...originalAnswer } = original.destinations[index]!;
        expect(answer).toEqual(originalAnswer);
        expect(referredAt).toBe(originalTime ?? original.raisedAt);
        if (entry.destination.kind === "psychiatric_ward")
          expect(wardRequestNeedsInvoluntaryBed(completed, entry.destination)).toBe(
            wardRequestNeedsInvoluntaryBed(original, entry.destination),
          );
      }
    }
  });

  it("keeps medical clearance and triage pending and uses only a deterministic proposed review target", () => {
    const source = seedWardFlowState().referrals[0]!;
    const intake = completeSyntheticReferralIntake(source).intake!;
    expect(intake.medicalClearance.cleared).toBe(false);
    expect(intake.triageAndRampCompleted).toBe(false);
    expect(intake.reasonForReferral).toContain("Medical clearance remains unconfirmed");
    expect(intake.medicalClearance.expectedAt).toBe(seededReferralMedicalTarget(source.raisedAt));
    expect(Number.isFinite(Date.parse(intake.medicalClearance.expectedAt!))).toBe(true);
    expect(
      Date.parse(seededReferralMedicalTarget(source.raisedAt + 30)) - Date.parse(intake.medicalClearance.expectedAt!),
    ).toBe(30 * 60_000);
    expect(Date.parse(seededReferralMedicalTarget(0)) - Date.parse(seededReferralMedicalTarget(-120))).toBe(
      120 * 60_000,
    );
  });

  it("keeps the authored transfer, medical review and community stories distinct", () => {
    const referrals = completeSyntheticReferralIntakes(seedWardFlowState().referrals);
    const reason = (id: string) => referrals.find((referral) => referral.id === id)!.intake!.reasonForReferral;
    expect(reason("RF-002")).toContain("medical reason for admission resolved");
    expect(reason("RF-005")).toContain("confusion and reduced food and fluid intake");
    expect(reason("RF-010")).toContain("rather than a psychiatric bed");
    expect(reason("RF-RGHS-01")).toContain("before the later inpatient episode");
    expect(reason("RF-002")).not.toMatch(/self.harm|mania|increased activity/i);
  });

  it("never replaces an existing intake and keeps its supplied content untouched", () => {
    const complete = completeSyntheticReferralIntake(seedWardFlowState().referrals[0]!);
    const existing = {
      ...complete,
      intake: { ...complete.intake!, reasonForReferral: "Existing synthetic submission" },
    };
    expect(completeSyntheticReferralIntake(existing).intake).toBe(existing.intake);
    expect(completeSyntheticReferralIntake(existing).intake!.reasonForReferral).toBe("Existing synthetic submission");
  });

  it("does not name destinations in intake text or create a catchment routing fact", () => {
    const source = seedWardFlowState().referrals[0]!;
    const withSecret = {
      ...source,
      destinations: [
        {
          ...source.destinations[0]!,
          destination: { ...source.destinations[0]!.destination, unitId: "SECRET-OTHER-WARD" },
        },
      ],
    };
    const completed = completeSyntheticReferralIntake(withSecret);
    expect(JSON.stringify(completed.intake)).not.toContain("SECRET-OTHER-WARD");
    expect(completed.intake!.catchment.teamName).toMatch(/^Synthetic catchment team \d+$/);
    expect(completed.suburb).toEqual(source.suburb);
    expect(completed.homeRegion).toBe(source.homeRegion);
    expect(completed.sendingTeamName).toBe(source.sendingTeamName);
    expect(completed.originSiteCode).toBe(source.originSiteCode);
    expect(
      completeSyntheticReferralIntake({ ...source, history: "Different prose without clinical meaning" }).intake,
    ).toEqual(completed.intake);
  });
});

describe("honest context for actual synthetic ward offers", () => {
  it("covers recorded offers in every scenario with full contact, risk, legal and document context", () => {
    let checked = 0;
    for (const scenario of WARD_SCENARIOS) {
      const state = seedWardFlowState(scenario);
      for (const movement of state.movements) {
        const dossier = syntheticMovementReferralDossier(movement);
        const hasOffer =
          movement.referredUnitIds.length > 0 ||
          !!movement.acceptedUnitId ||
          movement.declines.length > 0 ||
          movement.withdrawnReferrals.length > 0;
        expect(!!dossier, movement.id).toBe(hasOffer);
        if (!dossier) continue;
        checked++;
        expect(dossier.reasonForReferral.length).toBeGreaterThan(20);
        expect(dossier.risk.length).toBeGreaterThan(0);
        expect(dossier.legal[0]!.detail).toBe(movement.legalStatus);
        expect(dossier.referrer.email).toMatch(/\.invalid$/);
        expect(dossier.documents.length).toBeGreaterThanOrEqual(3);
        for (const document of dossier.documents) {
          expect(document.title).toMatch(/^Synthetic /);
          expect(document.addedAfterMinutes).toBeGreaterThanOrEqual(0);
          expect(document.addedAfterMinutes).toBeLessThanOrEqual(NOW_ANCHOR - movement.openedAt);
        }
        for (const destination of [...movement.referredUnitIds, movement.acceptedUnitId].filter(Boolean))
          expect(JSON.stringify(dossier)).not.toContain(destination!);
        expect(syntheticMovementReferralDossier(shiftInstants(movement, 400))).toEqual(dossier);
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("does not invent a ward offer or a primary referral when the link is absent", () => {
    const movement = seedWardFlowState().movements[0]!;
    for (const referralAbsence of [undefined, { reason: "none_raised", at: NOW_ANCHOR - 30 }] as const) {
      const withoutOffer = {
        ...movement,
        referralId: undefined,
        referralAbsence,
        referredUnitIds: [],
        acceptedUnitId: undefined,
        declines: [],
        withdrawnReferrals: [],
      };
      expect(syntheticMovementReferralDossier(withoutOffer)).toBeUndefined();
      const sent = { ...withoutOffer, referredUnitIds: ["synthetic-offer"] };
      expect(syntheticMovementReferralDossier(sent)).toBeDefined();
      expect(sent.referralId).toBeUndefined();
      expect(sent.referralAbsence).toBe(referralAbsence);
    }
  });

  it("preserves an explicitly pending medical review without manufacturing clearance", () => {
    const movement = {
      ...seedWardFlowState().movements[0]!,
      referredUnitIds: ["synthetic-offer"],
      medicalClearance: { cleared: false, at: NOW_ANCHOR - 5 },
    };
    const dossier = syntheticMovementReferralDossier(movement)!;
    expect(dossier.medicalClearance.clearedAfterMinutes).toBeUndefined();
    expect(dossier.medicalClearance.checks.every((check) => check.status === "pending")).toBe(true);
  });
});
