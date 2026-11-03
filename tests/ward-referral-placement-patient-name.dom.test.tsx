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
 *
 * Home drawer polish (Josh, 3 Nov 2026): the name now sits in the drawer's header, not a Patient
 * fact, so these read it from the pinned Decide button's accessible name, which uses the same label.
 */
function openReferral(referralId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CoordinatorScreen />
    </WardFlowProvider>,
  );
  // Home flow (Q340, Q345, 3 Nov 2026): referrals are listed only under the default "Needs you"
  // list, in its "Referrals to decide" group, which shows a few rows then "Show N more".
  const decide = screen.getByRole("region", { name: "Referrals to decide" });
  const more = within(decide).queryByRole("button", { name: /^Show \d+ more/u });
  if (more) fireEvent.click(more);
  const row = decide.querySelector<HTMLElement>(`[data-referral-id="${referralId}"]`);
  if (!row) throw new Error(`${referralId} is not listed under Referrals to decide`);
  fireEvent.click(within(row).getByRole("button", { name: /^Open referral for / }));
  return screen.getByTestId("ward-referral-placement-decide").getAttribute("aria-label") ?? "";
}

describe("Command referral placement panel names the patient", () => {
  it("shows the linked patient's name, not the record id (RF-RD06, linked to PT-RD06)", () => {
    const label = openReferral("RF-RD06");
    expect(label).toMatch(/Vallowen/);
    expect(label).not.toMatch(/PT-/);
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
      const label = openReferral("RF-001");
      expect(label).toBe("Decide referral for Not recorded");
      expect(label).not.toMatch(/PT-|Name not recorded/);
    } finally {
      live.patientId = saved;
    }
  });
});
