import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/**
 * Audit follow-up, 13 October 2026: switching the patient in Placement reset every other draft on
 * the shortlist but kept the non-binary placement reason and its "checked with the ward" tick, so
 * one patient's recorded justification could be submitted for the next. WF-012 is the seeded
 * `Non-binary` movement and `rph-adult-secure` the unit `ward-shortlist-gender-placement.dom.test.tsx`
 * already uses for this gate.
 */
const MOVEMENT_ID = "WF-012";
const UNIT_ID = "rph-adult-secure";
const REASON = GENDER_PLACEMENT_REASONS[0];
const OTHER = seedWardFlowState().movements.find((movement) => isOpen(movement) && movement.id !== MOVEMENT_ID);

function Harness({ selectedId }: { selectedId: string }) {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const movement = movements.find((candidate) => candidate.id === selectedId);
  return (
    <ShortlistPanel
      movement={movement}
      now={now}
      units={units}
      bedReleases={bedReleases}
      leaveBeds={leaveBeds}
      admissions={wardAdmissions}
      referrals={referrals}
      selectedUnitId={selectedUnitId}
      onSelectUnit={setSelectedUnitId}
      dispatch={dispatch}
      parallelReferralCap={configuration.parallelReferralCap}
    />
  );
}

const tree = (selectedId: string) => (
  <WardFlowProvider initialNow={NOW_ANCHOR}>
    <Harness selectedId={selectedId} />
  </WardFlowProvider>
);

describe("ShortlistPanel: the gender placement answer belongs to one patient", () => {
  it("has a second open movement to switch to, or the assertion below is vacuous", () => {
    expect(OTHER).toBeDefined();
  });

  it("clears the reason and the tick when the patient changes", () => {
    const { rerender } = render(tree(MOVEMENT_ID));
    fireEvent.click(screen.getByTestId(`ward-shortlist-candidate-${UNIT_ID}`));
    fireEvent.change(screen.getByTestId("ward-shortlist-gender-placement-reason"), { target: { value: REASON } });
    fireEvent.click(screen.getByTestId("ward-shortlist-gender-placement-checked"));
    expect((screen.getByTestId("ward-shortlist-gender-placement-reason") as HTMLSelectElement).value).toBe(REASON);

    rerender(tree(OTHER!.id));
    rerender(tree(MOVEMENT_ID));
    if (!screen.queryByTestId("ward-shortlist-gender-placement-form")) {
      fireEvent.click(screen.getByTestId(`ward-shortlist-candidate-${UNIT_ID}`));
    }

    expect((screen.getByTestId("ward-shortlist-gender-placement-reason") as HTMLSelectElement).value).toBe("");
    expect((screen.getByTestId("ward-shortlist-gender-placement-checked") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId("ward-shortlist-gender-placement-submit") as HTMLButtonElement).disabled).toBe(true);
  });
});
