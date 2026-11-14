import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { authorisationLabel } from "@/components/ward-management/ward-authorisation";
import { describe, expect, it } from "vitest";

import { WardReferralDetailDrawer } from "@/components/ward-management/ward/ward-referral-detail";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Go question 3 (Josh, 13 Nov 2026): the full referral's "To check" group adds "Involuntary
 * admissions: not stated" when the person's recorded status needs an involuntary-capable bed, and
 * not otherwise.
 */
const state = seedWardFlowState();
const unit = state.units[0];
const base = state.movements.find((movement) => movement.closure === undefined)!;

function toCheckGroup(movement: Movement) {
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
  return screen.getByTestId("ward-referral-fit-to-check");
}

describe("go question 3: authorisation in the To check group", () => {
  it("shows the label for a status that needs an involuntary-capable bed", () => {
    const group = toCheckGroup({ ...base, legalStatus: "Involuntary inpatient" });
    // D-209 item 9: the ward's label from the Chief Psychiatrist's register.
    expect(within(group).getByTestId("ward-referral-fit-to-check-authorisation")).toHaveTextContent(
      authorisationLabel(unit),
    );
    expect(authorisationLabel(unit)).toMatch(/^Involuntary admissions: /u);
  });

  it("shows nothing extra for a voluntary status", () => {
    const group = toCheckGroup({ ...base, legalStatus: "Voluntary" });
    expect(within(group).queryByTestId("ward-referral-fit-to-check-authorisation")).not.toBeInTheDocument();
  });
});
