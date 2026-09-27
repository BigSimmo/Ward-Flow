import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { referrals } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Live walkthrough, 25 September 2026: Command's "Referral placement" panel showed the raw record
 * id ("PT-RD06") where the Referral board shows the patient's name. The panel now names the patient
 * through the same resolver the board uses, and says "Not recorded" when a referral has no single
 * linked patient — never a record id, and never a guessed name.
 */
function openReferral(referralId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CoordinatorScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("tab", { name: /Referrals/ }));
  fireEvent.click(screen.getByTestId(`ward-referral-row-${referralId}`));
  return within(screen.getByLabelText("Referral placement")).getByTestId("ward-referral-placement-patient");
}

describe("Command referral placement panel names the patient", () => {
  it("shows the linked patient's name, not the record id (RF-RD06, linked to PT-RD06)", () => {
    const fact = openReferral("RF-RD06");
    expect(fact).toHaveTextContent(/Vallowen/);
    expect(fact.textContent).not.toMatch(/PT-/);
  });

  it("says Not recorded for a referral with no linked patient (RF-001, unlinked for this test)", () => {
    // RF-001 names PT-079 since seed-link task T2 (25 Sept 2026): every seeded record now names a
    // real patient, so no seeded referral is unlinked. RF-001's link is removed for this test only,
    // and put back afterwards; the seed copies the referral when the provider mounts.
    const live = referrals.find((referral) => referral.id === "RF-001");
    if (!live) throw new Error("RF-001 is missing from the seed");
    const saved = live.patientId;
    live.patientId = undefined;
    try {
      const fact = openReferral("RF-001");
      expect(fact).toHaveTextContent("Not recorded");
      expect(fact.textContent).not.toMatch(/PT-|Unknown Patient/);
    } finally {
      live.patientId = saved;
    }
  });
});
