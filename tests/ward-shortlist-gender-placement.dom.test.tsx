import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { GENDER_PLACEMENT_REASONS, GENDER_PLACEMENT_REFUSAL } from "@/components/ward-management/ward-change-reasons";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/**
 * Ward Lead follow-up, 2026-09-17: T12's engine (`tests/ward-non-binary-placement.test.ts`) refuses
 * a coordinator referring a `Non-binary` patient with no recorded reason — but until this file,
 * `shortlist-panel.tsx` had no on-screen way to answer that refusal. This proves the wiring closes
 * that dead end: `WF-012` (`ward-movements.ts`) is the real seeded `Non-binary` movement at
 * `placement_requested`, driven through the real reducer via `useWardFlow()`, never a hand-built
 * fixture — the same discipline `tests/ward-shortlist.dom.test.tsx`'s own harness holds to.
 *
 * `rph-adult-secure` is a real, Undesignated, non-forensic Adult Secure unit WF-012 is otherwise
 * eligible for (the same unit `tests/ward-non-binary-placement.test.ts` uses as its own `WARD_A`),
 * chosen so the refusal below is genuinely about the gender-placement gate and not some other one.
 */
const MOVEMENT_ID = "WF-012";
const UNIT_ID = "rph-adult-secure";
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

describe("ShortlistPanel: a non-binary placement explains itself, then succeeds once answered (WF-012)", () => {
  it("without a reason or the tick, Refer stays unavailable and the refusal's own words render", () => {
    renderShortlist();

    fireEvent.click(screen.getByTestId(`ward-shortlist-candidate-${UNIT_ID}`));

    const referButton = screen.getByTestId("ward-shortlist-refer");
    expect(referButton.getAttribute("aria-disabled")).toBe("true");
    expect(referButton.getAttribute("title")).toBe(GENDER_PLACEMENT_REFUSAL);

    // The form itself — never a generic refusal — carries the plan's own wording.
    expect(screen.getByTestId("ward-shortlist-gender-placement-form")).toBeTruthy();
    expect(screen.getByTestId("ward-shortlist-gender-placement-guidance").textContent).toContain(
      "Check with the ward first",
    );
    expect(screen.getByTestId("ward-shortlist-gender-placement-refusal").textContent).toBe(GENDER_PLACEMENT_REFUSAL);

    // Clicking Refer itself must not silently succeed while the reason/tick are unanswered.
    fireEvent.click(referButton);
    expect(screen.queryByTestId("ward-shortlist-referred-badge")).toBeNull();

    const submit = screen.getByTestId("ward-shortlist-gender-placement-submit");
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("with a reason chosen and the tick checked, the placement succeeds", () => {
    renderShortlist();

    fireEvent.click(screen.getByTestId(`ward-shortlist-candidate-${UNIT_ID}`));

    fireEvent.change(screen.getByTestId("ward-shortlist-gender-placement-reason"), {
      target: { value: REASON },
    });
    fireEvent.click(screen.getByTestId("ward-shortlist-gender-placement-checked"));

    const submit = screen.getByTestId("ward-shortlist-gender-placement-submit");
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);

    // The placement went through: the real reducer output now shows the unit as a live referral,
    // and the candidate row itself flips to "Referred" — never a locally-claimed success.
    expect(screen.getByTestId("ward-shortlist-referred-badge")).toBeTruthy();
    const row = screen.getByTestId(`ward-shortlist-candidate-${UNIT_ID}`);
    expect(row.getAttribute("data-live")).toBe("true");
    expect(row.textContent).toContain("Referred");

    // The gender-placement form has nothing left to ask now that this unit is covered.
    expect(screen.queryByTestId("ward-shortlist-gender-placement-form")).toBeNull();
  });
});
