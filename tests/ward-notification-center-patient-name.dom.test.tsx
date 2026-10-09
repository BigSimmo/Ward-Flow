import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { WardNotificationCenter } from "@/components/ward-management/ward/ward-notification-center";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Notice } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Live walkthrough code-read, 25 September 2026: the ward's Tasks & Buzzes panel resolved names with
 * movements only, so every patient read "Unknown Patient". Inside the provider it now resolves
 * against the patient and referral records like the rest of the ward screen.
 */
describe("ward Tasks & Buzzes names linked patients", () => {
  it("shows a linked patient's name on an overdue-arrival task", () => {
    const seed = seedWardFlowState();
    const linked = seed.movements.find((movement) => movement.patientId && movement.acceptedUnitId)!;
    const patient = seed.patients.find((candidate) => candidate.id === linked.patientId)!;
    expect(patient, "a seeded movement linked to a patient record").toBeDefined();
    const overdue: Movement = {
      ...linked,
      stage: "pulled",
      closure: undefined,
      arrivalDetails: {
        estimatedArrivalAt: NOW_ANCHOR - 120,
        recordedAt: NOW_ANCHOR - 180,
        mode: "mental_health_transport",
        recordedBy: "coordinator",
      },
    };
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardNotificationCenter
          unitId={linked.acceptedUnitId!}
          unitName="Test ward"
          now={NOW_ANCHOR}
          movements={[overdue]}
          notices={[]}
          refreshRequests={[]}
        />
      </WardFlowProvider>,
    );
    expect(screen.getAllByText(new RegExp(patient.familyName)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Unknown Patient/)).not.toBeInTheDocument();
  });
});

// D-39: a notice names the patient by UMRN, including a journey linked only through a referral.
describe("ward notices name the patient by UMRN", () => {
  it("swaps a referral-linked journey number for its UMRN", () => {
    const seed = seedWardFlowState();
    const linked = seed.movements.find(
      (movement) =>
        resolveSubjectPatient(movement, { patients: seed.patients, movements: seed.movements }).umrn ===
          "UMRN not recorded" && resolveSubjectPatient(movement, seed).umrn !== "UMRN not recorded",
    )!;
    expect(linked, "the seed holds a referral-linked journey").toBeDefined();
    const notice: Notice = {
      id: "NT-UMRN",
      raisedAt: NOW_ANCHOR - 10,
      to: { role: "ward", placeId: "ward-alpha" },
      about: { unitId: "ward-alpha" },
      kind: "referral_accepted_ward",
      sentence: `Transport for ${linked.id} was cancelled.`,
    };
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardNotificationCenter
          unitId="ward-alpha"
          unitName="Test ward"
          now={NOW_ANCHOR}
          movements={seed.movements}
          notices={[notice]}
          refreshRequests={[]}
        />
      </WardFlowProvider>,
    );
    const umrn = resolveSubjectPatient(linked, seed).umrn;
    expect(screen.getByText(`Transport for ${umrn} was cancelled.`)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(linked.id))).not.toBeInTheDocument();
  });
});
