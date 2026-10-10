import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * RB3, item 19 — the "Record outcome" control on the ED board, and the "For discharge" chip it
 * feeds. WF-002 (`fsh-ed`, open, not collected, no legal form) is the target: `RECORD_ED_OUTCOME`
 * carries no form/examination gate, so this movement needs no special setup to exercise it.
 */
const ED_ID = "fsh-ed";

function renderEd() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={ED_ID} />
    </WardFlowProvider>,
  );
}

describe("recording an ED outcome from the board", () => {
  it("opens the outcome panel, records 'for discharge', and moves the patient into that chip", () => {
    renderEd();

    // Before recording, WF-002 is not counted under "For discharge".
    const beforeChip = screen.getByRole("button", { name: /For discharge/ });
    const beforeCount = beforeChip.textContent ?? "";

    fireEvent.click(screen.getByTestId("ward-ed-outcome-toggle-WF-002"));
    expect(screen.getByTestId("ward-ed-outcome-form-WF-002")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-ed-outcome-discharge-WF-002"));

    // The panel closes, and the row now offers "Left the department" instead of the earlier
    // examine/outcome/handover group — the same swap RECORD_LEFT_DEPARTMENT's own row already
    // makes once `edOutcome` is set.
    expect(screen.queryByTestId("ward-ed-outcome-form-WF-002")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-ed-mark-left-WF-002")).toBeInTheDocument();

    // The row stays on the board (it is not removed) and the discharge chip count grew by one.
    expect(screen.getByTestId("ward-ed-patient-WF-002")).toBeInTheDocument();
    const afterChip = screen.getByRole("button", { name: /For discharge/ });
    expect(afterChip.textContent).not.toBe(beforeCount);
  });

  it("removes the patient from the board once 'Left the department' is recorded", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-outcome-toggle-WF-002"));
    fireEvent.click(screen.getByTestId("ward-ed-outcome-community-WF-002"));
    expect(screen.getByTestId("ward-ed-patient-WF-002")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-ed-mark-left-WF-002"));
    expect(screen.queryByTestId("ward-ed-patient-WF-002")).not.toBeInTheDocument();
  });
});

/**
 * P1-4 / P3-3 (Ward Lead audit, 2026-09-17). WF-004 (`sjgm-ed`, `stage: "pulled"`, accepted at
 * `bty-adult-secure`) is the seeded movement `tests/ward-ed-outcomes.test.ts` already uses to
 * prove the bed-release half of `RECORD_ED_OUTCOME`'s unwind; here it proves the board no longer
 * shows it as still going anywhere once an outcome is recorded.
 */
describe("recording an ED outcome clears the outbox row and the gender control", () => {
  it("drops WF-004 out of 'Still to be moved' and hides its gender control once an outcome is recorded", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="sjgm-ed" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Still to be moved/ }));
    expect(screen.getByTestId("ward-ed-outbox-row-WF-004")).toBeInTheDocument();
    // Open while the movement is still live — RECORD_MOVEMENT_GENDER would otherwise be offered
    // on a row the reducer always refuses it for once closed.
    expect(screen.getByTestId("ward-ed-record-gender-WF-004")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-ed-outcome-toggle-WF-004"));
    // Owner answer 1 (second round, 2026-09-17): WF-004 is on a legal form with no examination
    // recorded, so "For discharge" is now correctly disabled here — "For community follow-up"
    // carries no such gate and proves the identical P1-4 unwind this test exists for.
    fireEvent.click(screen.getByTestId("ward-ed-outcome-community-WF-004"));

    expect(
      screen.queryByTestId("ward-ed-outbox-row-WF-004"),
      "P1-4: acceptedUnitId is cleared on outcome, so this row must leave 'still to be moved'",
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("ward-ed-record-gender-WF-004"),
      "P3-3: the gender control must not be offered on a closed row",
    ).not.toBeInTheDocument();
    // The informational label stays — only the editable control is withdrawn.
    expect(screen.getByTestId("ward-ed-gender-WF-004")).toBeInTheDocument();
  });
});

/**
 * P2-5 (Ward Lead audit, 2026-09-17). No internal event name in user-facing text. WF-006
 * (`rgh-ed`, `stage: "moving"`, `transport.collectedAt` set, still open) is the seeded movement
 * `tests/ward-ed-outcomes.test.ts` already uses to prove `RECORD_ED_OUTCOME`'s own refusal after
 * collection — the same fixture reaches both blocked-reason strings here, so this actually renders
 * the text rather than merely failing to find a control that was never going to show it.
 */
describe("the collected-patient blocked reasons name no internal event", () => {
  it('tells the ED to ask the coordinator to use "Stop transport" instead of naming STOP_TRANSPORT, on both the outcome and the community-referral control', () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rgh-ed" />
      </WardFlowProvider>,
    );

    const outcomeToggle = screen.getByTestId("ward-ed-outcome-toggle-WF-006");
    expect(outcomeToggle).toHaveAttribute("aria-disabled", "true");
    expect(outcomeToggle.title).toContain(
      'Ask the coordinator to stop the journey, using the "Stop transport" control on the console',
    );
    expect(outcomeToggle.title).not.toContain("STOP_TRANSPORT");

    const cmhtToggle = screen.getByTestId("ed-refer-cmht-WF-006");
    expect(cmhtToggle).toHaveAttribute("aria-disabled", "true");
    expect(cmhtToggle.title).toContain(
      'Ask the coordinator to stop the journey, using the "Stop transport" control on the console',
    );
    expect(cmhtToggle.title).not.toContain("STOP_TRANSPORT");

    expect(document.body.textContent).not.toContain("STOP_TRANSPORT");
  });
});

/**
 * Ward Lead follow-up (2026-09-17): withdrawing a referral used to remove the patient from this
 * department's own board entirely (the `patients` filter at `ed-screen.tsx` excluded every closed
 * movement except an ED-outcome one) — the department that raised the withdrawal lost sight of it.
 * WF-002 (`fsh-ed`, Voluntary, `referredUnitIds: ["fsh-older-adult"]`, no acceptance) is the
 * pre-acceptance path's own target; `confirmWithdrawReferral` always dispatches `role: "ed"`
 * (`ed-screen.tsx`), so every UI-driven withdrawal is ED-initiated and must stay visible.
 */
/**
 * Owner answer 1 (second round, 2026-09-17): the "For discharge" choice is disabled, with the
 * reason in words, until an examination outcome is recorded for a patient on a legal form.
 * WF-001 (`arm-ed`, Form 1A, no examination recorded) is the seeded, unexamined legal-form target.
 */
describe("the 'For discharge' choice is disabled until examined on a legal form", () => {
  it("disables For discharge with the reason, but not For community follow-up", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId("ward-ed-outcome-toggle-WF-001"));
    const dischargeButton = screen.getByTestId("ward-ed-outcome-discharge-WF-001");
    expect(dischargeButton).toHaveAttribute("aria-disabled", "true");
    expect(dischargeButton.title).toContain("examination outcome");
    expect(screen.getByTestId("ward-ed-outcome-community-WF-001")).not.toHaveAttribute("aria-disabled");

    fireEvent.click(dischargeButton);
    expect(
      screen.getByTestId("ward-ed-outcome-form-WF-001"),
      "the panel must stay open — nothing was recorded",
    ).toBeInTheDocument();
  });
});

describe("an ED-initiated withdrawal stays on the board under its own chip", () => {
  it("keeps WF-002 visible under 'Withdrawn' with its reason, and offers no outcome control", () => {
    renderEd();
    const withdrawnBefore = screen.getByRole("button", { name: /Withdrawn/ }).textContent;

    fireEvent.click(screen.getByTestId("ward-ed-withdraw-referral-toggle-WF-002"));
    fireEvent.click(screen.getByTestId("ward-ed-withdraw-referral-confirm-WF-002"));

    // Still on the board — not removed — and the "Withdrawn" chip count grew by one.
    expect(screen.getByTestId("ward-ed-patient-WF-002")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Withdrawn/ }).textContent).not.toBe(withdrawnBefore);

    // The reason is shown in plain text, and no control that RECORD_ED_OUTCOME (or anything else)
    // would refuse on a closed movement is offered.
    expect(screen.getByTestId("ward-ed-withdrawn-reason-WF-002")).toHaveTextContent(
      "Withdrawn: The referrer withdrew the referral",
    );
    expect(screen.queryByTestId("ward-ed-outcome-toggle-WF-002")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-ed-examine-toggle-WF-002")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-ed-withdraw-referral-toggle-WF-002")).not.toBeInTheDocument();

    // Filtering by "Withdrawn" highlights it; filtering by "Not reviewed" (WF-002 was never examined)
    // must not double-count a closed, withdrawn record. v10 rule 5 (10 Oct 2026): board filters
    // highlight and dim, so the row stays on the board and the filter that excludes it dims it.
    fireEvent.click(screen.getByRole("button", { name: /Withdrawn/ }));
    expect(screen.getByTestId("ward-ed-patient-WF-002")).not.toHaveAttribute("data-dim");

    fireEvent.click(screen.getByRole("button", { name: /Not reviewed/ }));
    expect(screen.getByTestId("ward-ed-patient-WF-002")).toHaveAttribute("data-dim", "true");
  });

  it("does not show a ward name beside the withdrawal once an accepted referral is revoked", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="sjgm-ed" />
      </WardFlowProvider>,
    );
    // WF-004: accepted at `bty-adult-secure`, bed pulled — the post-acceptance WITHDRAW_REFERRAL
    // branch (`role: "ed"` only permitted pre-collection).
    fireEvent.click(screen.getByTestId("ward-ed-withdraw-referral-toggle-WF-004"));
    fireEvent.click(screen.getByTestId("ward-ed-withdraw-referral-confirm-WF-004"));

    expect(screen.getByTestId("ward-ed-withdrawn-reason-WF-004")).toHaveTextContent(
      "Withdrawn: The referrer revoked the accepted referral",
    );
    // `acceptedUnit.name` must not appear as this row's destination beside "Withdrawn: ..." —
    // `WITHDRAW_REFERRAL`'s post-acceptance branch does not clear `acceptedUnitId`, a separate,
    // out-of-scope defect this board must not surface as a same-row contradiction.
    expect(screen.getByTestId("ward-ed-patient-WF-004")).toHaveTextContent("Withdrawn");
    expect(screen.getByTestId("ward-ed-patient-WF-004")).not.toHaveTextContent("BTY Adult Secure");
  });
});
