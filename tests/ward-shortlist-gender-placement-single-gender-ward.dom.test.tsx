import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { GENDER_PLACEMENT_REASONS, GENDER_PLACEMENT_REFUSAL } from "@/components/ward-management/ward-change-reasons";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/**
 * Owner reversal, item 2, second round, 17 September 2026: *"No. they actually can. make smallest
 * possible fix to enable this."* Until this file, a single-gender ward failing ONLY
 * `gender_designation` for a Non-binary movement was filtered into the shortlist's own
 * `unavailable` bucket (`shortlistCandidates`, `ward-derivations.ts`) and could never be selected,
 * so the gender-placement form `tests/ward-shortlist-gender-placement.dom.test.tsx` already proves
 * for an Undesignated ward could never be reached for a designated one — a dead end on screen even
 * though `tests/ward-non-binary-single-gender-ward-placement.test.ts` proves the engine allows it.
 *
 * `WF-012` (`ward-movements.ts`) is the same real seeded `Non-binary` movement that file drives;
 * `fsh-adult-secure` is the network's one Male-only ward, otherwise fully eligible for it (real
 * capacity, authorised, non-forensic — see that unit's own comment in `ward-sites.ts`), so a
 * refusal here is genuinely about the gender-placement gate and nothing else.
 */
const MOVEMENT_ID = "WF-012";
const UNIT_ID = "fsh-adult-secure";
const REASON = GENDER_PLACEMENT_REASONS[0];

function ShortlistHarness() {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const movement = movements.find((candidate) => candidate.id === MOVEMENT_ID);
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

function renderShortlist() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ShortlistHarness />
    </WardFlowProvider>,
  );
}

describe("ShortlistPanel: a single-gender ward offers the non-binary placement form instead of hiding as unavailable (WF-012)", () => {
  it("FSH Adult Secure is offered with the gender-placement form, and submitting succeeds", () => {
    renderShortlist();

    // The canary: if this ward had been filtered into the `unavailable` bucket, its candidate row
    // would not exist at all and every assertion below would fail for the wrong reason.
    const row = screen.getByTestId(`ward-shortlist-candidate-${UNIT_ID}`);
    fireEvent.click(row);

    expect(screen.getByTestId("ward-shortlist-gender-placement-form")).toBeTruthy();
    expect(screen.getByTestId("ward-shortlist-gender-placement-refusal").textContent).toBe(GENDER_PLACEMENT_REFUSAL);

    fireEvent.change(screen.getByTestId("ward-shortlist-gender-placement-reason"), {
      target: { value: REASON },
    });
    fireEvent.click(screen.getByTestId("ward-shortlist-gender-placement-checked"));

    const submit = screen.getByTestId("ward-shortlist-gender-placement-submit");
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);

    // The real reducer's gender_designation gate now passes: the unit shows as a live referral,
    // never a locally-claimed success.
    const updatedRow = screen.getByTestId(`ward-shortlist-candidate-${UNIT_ID}`);
    expect(updatedRow.getAttribute("data-live")).toBe("true");
    expect(updatedRow.textContent).toContain("Referred");
    expect(screen.queryByTestId("ward-shortlist-gender-placement-form")).toBeNull();
  });
});
