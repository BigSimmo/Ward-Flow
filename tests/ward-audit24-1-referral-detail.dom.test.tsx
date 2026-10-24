import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardReferralDetailDrawer } from "@/components/ward-management/ward/ward-referral-detail";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { seededReferralDossier } from "@/components/ward-management/ward-referral-dossier-seed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit 24-1 A-03 and A-04: the full referral a ward reads before answering shows recorded facts
 * only. A seeded referral letter's "cleared by" is not a recorded clearance, and an absent legal
 * form or CTO reads as not recorded.
 */
const state = seedWardFlowState();
const unit = state.units[0];

function renderDetail(movement: Movement) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDetailDrawer
        movement={movement}
        unit={unit}
        now={NOW_ANCHOR}
        identity={resolveSubjectPatient(movement, state)}
        onClose={() => {}}
        blocked={undefined}
        onDecline={() => {}}
        onAccept={() => {}}
      />
    </WardFlowProvider>,
  );
  return screen.getByTestId(`ward-referral-detail-${movement.id}`);
}

const unclearedWithLetter = ["WF-013", "WF-002", "WF-010", "WF-017", "WF-022", "WF-027"]
  .map((id) => state.movements.find((movement) => movement.id === id))
  .filter(
    (movement): movement is Movement =>
      movement !== undefined &&
      movement.medicalClearance === undefined &&
      seededReferralDossier(movement.id, movement)?.medicalClearance.clearedBy !== undefined,
  );

describe("Audit 24-1 A-03: medical clearance on the full referral", () => {
  it("has seeded journeys with a letter clearance and no recorded clearance", () => {
    expect(unclearedWithLetter.length).toBeGreaterThan(0);
  });

  it.each(unclearedWithLetter.map((movement) => [movement.id, movement] as const))(
    "%s shows no green chip and no invented time",
    (_id, movement) => {
      const detail = renderDetail(movement);
      expect(within(detail).queryByText("Medically cleared")).not.toBeInTheDocument();
      const section = within(detail).getByRole("region", { name: "Medical clearance" });
      expect(within(section).getByText("Not recorded")).toBeVisible();
      expect(section).not.toHaveTextContent(/Cleared by [^.]*, /);
      expect(section).toHaveTextContent(/Referral letter says\s*Cleared by .+\. Not a recorded clearance\./);
    },
  );

  it("still shows the chip when the engine records a clearance", () => {
    const base = unclearedWithLetter[0];
    const movement: Movement = { ...base, medicalClearance: { cleared: true, at: base.openedAt + 30 } } as Movement;
    const detail = renderDetail(movement);
    // The chip and the timeline entry both read it.
    expect(within(detail).getAllByText("Medically cleared").length).toBeGreaterThan(0);
    const section = within(detail).getByRole("region", { name: "Medical clearance" });
    expect(section).toHaveTextContent(/Status\s*Cleared at /);
  });
});

describe("Audit 24-1 A-04: legal rows use recorded-only wording", () => {
  it("says no form recorded and CTO none recorded", () => {
    const movement = state.movements.find(
      (candidate) =>
        candidate.legalForm === undefined &&
        candidate.patientId !== undefined &&
        state.patients.find((patient) => patient.id === candidate.patientId)?.communityTreatmentOrder === undefined,
    )!;
    expect(movement).toBeDefined();
    const detail = renderDetail(movement);
    const legal = within(detail).getByRole("region", { name: "Legal" });
    expect(legal).toHaveTextContent(`${movement.legalStatus}. No form recorded.`);
    expect(legal).toHaveTextContent(/CTO\s*None recorded/);
    expect(legal).not.toHaveTextContent("No forms in force");
  });
});
