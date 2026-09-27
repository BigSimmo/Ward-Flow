import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as tests/ward-screen-refusal-surface.dom.test.tsx and
// tests/ward-override-control.dom.test.tsx.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { ReferralDraft } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { markBroomeForensicForThisFile } from "./helpers/ward-made-up-forensic-ward";

// The 09:30 morning-rollup overdue banner (added 22 Sept) is itself role="alert" and is always on
// at NOW_ANCHOR (10:42). These tests count REFUSAL alerts, so the banner is left out of the count.
const refusalAlerts = () =>
  screen
    .queryAllByRole("alert")
    .filter((el) => el.getAttribute("data-testid") !== "ward-morning-rollup-overdue-banner");

/**
 * ITEM 10, OWNER ANSWERS 17 SEPTEMBER 2026 — THE DOM PROOF OWED BY the reducer-and-model commit
 * `a083b9fc85`. That commit proved the state-transition property at the reducer level
 * (`tests/ward-acuity-override-num.test.ts`); this file proves the new UI actually renders it —
 * the tick shown only for the acuity refusal, the submit gated on both facts, and the override
 * register saying so in the owner's own words.
 *
 * ⚠️ **THE FIXTURE IS RAISED FROM SCRATCH, NEVER HUNTED FROM THE SEED.** `RAISE_REFERRAL` is the
 * only event that creates a movement (`ward-flow-reducer.ts`'s own comment), and its `draft` gives
 * this file a `highAcuity: true, specialling: false, cohort: "Older adult", security: "Open"`
 * movement with none of the seed's coincidental overlaps to search for — the SAME technique
 * `tests/ward-acuity-override-num.test.ts` used to reach `HIGH_ACUITY_STAFFING_REFUSAL` at the
 * reducer, driven here through real dispatches instead of a hand-built `WardFlowState`.
 *
 * `nextReferralId` (`ward-flow-reducer.ts`) assigns "WF-9" + the sequence number, and a fresh seed's
 * `referralSequence` starts at 0, so the first and second `RAISE_REFERRAL` in this file are
 * predictably `WF-901` and `WF-902` — pinned as constants rather than read back from the DOM, so a
 * refused `RAISE_REFERRAL` (the fixture failing to build at all) shows up as "WF-902 never
 * appears" instead of silently re-reading WF-901 under a different name.
 *
 * `fre-older-adult` is authored with exactly one high-acuity place
 * (`ward-sites.ts`), so the first pull exhausts it and the second is refused on acuity alone —
 * `CONFIRM_CAPACITY` raises its allocatable count first so that refusal is never "no bed", the
 * same precondition `tests/ward-acuity-override-num.test.ts`'s own bench states.
 */

const UNIT_ID = "fre-older-adult";
const ED_ID = "rph-ed";
const NOW = NOW_ANCHOR;

const FIRST_ID = "WF-901";
const SECOND_ID = "WF-902";

const HIGH_ACUITY_DRAFT: ReferralDraft = {
  cohort: "Older adult",
  security: "Open",
  sex: "Female",
  gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
  specialling: false,
  highAcuity: true,
  legalStatus: "Voluntary",
  urgency: 2,
  legalFormCode: null,
};

function RaiseHighAcuityMovement({ testId }: { testId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => dispatch({ type: "RAISE_REFERRAL", role: "ed", now, edId: ED_ID, draft: HIGH_ACUITY_DRAFT })}
    >
      raise a high-acuity movement
    </button>
  );
}

function ConfirmCapacity({ unitId, value }: { unitId: string; value: number }) {
  const { dispatch, now, units } = useWardFlow();
  // Since fda2ad1dcc (23 Sept) the reducer refuses a capacity update that does not name the revision
  // it was made against; send it the way the ward screen does, or the raise is silently refused.
  const expectedRevision = units.find((unit) => unit.id === unitId)?.allocatable.revision ?? 0;
  return (
    <button
      type="button"
      data-testid="confirm-capacity"
      onClick={() =>
        dispatch({ type: "CONFIRM_CAPACITY", role: "ward", now, unitId, actingUnitId: unitId, value, expectedRevision })
      }
    >
      confirm capacity
    </button>
  );
}

function ReferMovementToUnit({ movementId, unitId }: { movementId: string; unitId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid={`refer-${movementId}`}
      onClick={() => dispatch({ type: "REFER_TO_UNITS", role: "coordinator", now, movementId, unitIds: [unitId] })}
    >
      refer {movementId}
    </button>
  );
}

/**
 * The second, unrelated refusal WF-009 into Mabu Liyan / Broome Mental Health Unit already reliably produces —
 * `tests/ward-override-control.dom.test.tsx` established this exact pair fails ONLY `forensic`, a
 * `SUITABILITY_GATES` member the ward screen already shows a reason control for. Reused rather than
 * re-derived: the point of this second harness is a refusal the screen answers WITHOUT the tick,
 * and this pair is already proven to reach one.
 */
function ReferWF009ToBrmAdultSecureWithReason() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "REFER_TO_UNITS",
          role: "coordinator",
          now,
          movementId: "WF-009",
          unitIds: ["brm-adult-secure"],
          overrideReason: "Clinical urgency outweighs the mismatch",
        })
      }
    >
      refer WF-009 to Mabu Liyan / Broome Mental Health Unit, with a reason
    </button>
  );
}


// Broome is not forensic (owner ruling 2026-09-25); these screens test the forensic gate on a
// made-up forensic Broome for this file only.
markBroomeForensicForThisFile();

describe("the ward screen's high-acuity override: the tick", () => {
  it("shows the reason select AND the tick after the acuity refusal, gates submit on both, places the patient, and the register records it", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <RaiseHighAcuityMovement testId="raise-first" />
        <RaiseHighAcuityMovement testId="raise-second" />
        <ConfirmCapacity unitId={UNIT_ID} value={3} />
        <ReferMovementToUnit movementId={FIRST_ID} unitId={UNIT_ID} />
        <ReferMovementToUnit movementId={SECOND_ID} unitId={UNIT_ID} />
        <WardScreen unitId={UNIT_ID} />
      </WardFlowProvider>,
    );

    // Raise and confirm capacity before either referral, so neither pull can be refused on "no bed".
    fireEvent.click(screen.getByTestId("raise-first"));
    fireEvent.click(screen.getByTestId("confirm-capacity"));

    // The FIRST high-acuity patient: refer, accept, pull. Consumes the ward's one high-acuity
    // place cleanly, or nothing below proves anything.
    fireEvent.click(screen.getByTestId(`refer-${FIRST_ID}`));
    expect(screen.getByTestId(`ward-incoming-${FIRST_ID}`)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`ward-accept-${FIRST_ID}`));
    const firstAcceptedRow = screen.getByTestId(`ward-accepted-${FIRST_ID}`);
    const firstPullButton = within(firstAcceptedRow).getByTestId(`ward-pull-${FIRST_ID}`);
    expect(firstPullButton).not.toHaveAttribute("aria-disabled");
    fireEvent.click(firstPullButton);
    expect(
      refusalAlerts(),
      "the first high-acuity pull must succeed, or the second cannot be refused on acuity",
    ).toHaveLength(0);

    // The SECOND high-acuity patient: refer, accept, pull — this pull is the one under test.
    fireEvent.click(screen.getByTestId("raise-second"));
    fireEvent.click(screen.getByTestId(`refer-${SECOND_ID}`));
    expect(screen.getByTestId(`ward-incoming-${SECOND_ID}`)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`ward-accept-${SECOND_ID}`));
    const secondAcceptedRow = screen.getByTestId(`ward-accepted-${SECOND_ID}`);
    const secondPullButton = within(secondAcceptedRow).getByTestId(`ward-pull-${SECOND_ID}`);
    expect(secondPullButton).not.toHaveAttribute("aria-disabled");
    fireEvent.click(secondPullButton);

    // Assertion 1: the acuity refusal shows the reason select AND the tick, and submit is
    // disabled until both are set.
    const alert = within(secondAcceptedRow).getByRole("alert");
    expect(alert).toHaveTextContent(/Pull a bed not recorded/i);
    expect(alert).toHaveTextContent(/high-acuity nursing capacity left/i);
    expect(alert).toHaveTextContent(/nurse unit manager consulted/i);

    const form = within(secondAcceptedRow).getByTestId(`ward-override-form-${SECOND_ID}`);
    const radios = within(form).getAllByTestId(`ward-override-option-${SECOND_ID}`);
    expect(radios).toHaveLength(OVERRIDE_REASONS.length);
    const tick = within(form).getByTestId(`ward-override-num-consulted-${SECOND_ID}`);
    expect(tick).toBeInTheDocument();
    expect(within(form).getByText(/nurse unit manager consulted/i)).toBeInTheDocument();

    const submit = within(form).getByTestId(`ward-override-submit-${SECOND_ID}`);
    expect(submit, "neither field set yet").toBeDisabled();

    fireEvent.click(within(form).getByRole("radio", { name: OVERRIDE_REASONS[0] }));
    expect(submit, "a reason alone must not enable submit — the tick is a second required fact").toBeDisabled();

    fireEvent.click(tick);
    expect(submit, "both fields set").not.toBeDisabled();

    // Assertion 2: submitting both dispatches, the patient is placed, and the register records it.
    fireEvent.click(submit);

    expect(refusalAlerts(), "the placement must go through once both facts are recorded").toHaveLength(0);
    expect(screen.queryByTestId(`ward-override-form-${SECOND_ID}`)).not.toBeInTheDocument();

    const registerLine = screen.getByTestId(`ward-override-num-consulted-${SECOND_ID}`);
    expect(registerLine).toHaveTextContent("High-acuity staffing — nurse unit manager consulted");
  });

  it("shows the reason select but NO tick after a non-acuity refusal", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <ReferWF009ToBrmAdultSecureWithReason />
        <WardScreen unitId="brm-adult-secure" />
      </WardFlowProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "refer WF-009 to Mabu Liyan / Broome Mental Health Unit, with a reason" }),
    );
    expect(screen.getByTestId("ward-incoming-WF-009")).toBeInTheDocument();
    expect(refusalAlerts()).toHaveLength(0);

    // The Accept button dispatches a FRESH ACCEPT_IN_PRINCIPLE with no reason of its own, so the
    // forensic judgement gate is re-evaluated and refused — the same sequence
    // tests/ward-override-control.dom.test.tsx already proves reaches this refusal reliably.
    fireEvent.click(screen.getByTestId("ward-accept-WF-009"));

    const incomingRow = screen.getByTestId("ward-incoming-WF-009");
    const alert = within(incomingRow).getByRole("alert");
    expect(alert).toHaveTextContent(/Accept in principle not recorded/i);
    expect(alert).toHaveTextContent(/forensic/i);
    // The control-defining assertion: this refusal is answerable (the reason form shows), but it
    // is not the acuity refusal, so the tick must not appear beside it.
    expect(alert).not.toHaveTextContent(/high-acuity/i);

    const form = within(incomingRow).getByTestId("ward-override-form-WF-009");
    const radios = within(form).getAllByTestId("ward-override-option-WF-009");
    expect(radios, "a reason control must still be offered for this answerable gate").toHaveLength(
      OVERRIDE_REASONS.length,
    );
    expect(
      screen.queryByTestId("ward-override-num-consulted-WF-009"),
      "the nurse-unit-manager tick must not appear beside a refusal that is not the acuity gate",
    ).not.toBeInTheDocument();
  });
});
