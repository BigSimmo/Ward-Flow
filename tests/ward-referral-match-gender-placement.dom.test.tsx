import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";

import { GENDER_PLACEMENT_REASONS, GENDER_PLACEMENT_REFUSAL } from "@/components/ward-management/ward-change-reasons";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Ward Lead follow-up, 2026-09-17: the same T12 dead end `shortlist-panel.tsx`'s own DOM test
 * closes on the movement path (WF-012) has a front-door twin here — a coordinator accepting a
 * `Non-binary` REFERRAL got the same generic refusal with no way through.
 *
 * There is no seeded `Non-binary` REFERRAL fixture to drive this from — WF-012 is a `Movement`,
 * and a referral is a separate front-door object that never becomes one until accepted (see
 * `ReferralMatchView`'s own doc comment on `ward`) — so this file raises one through the real
 * reducer instead, the identical technique `tests/ward-non-binary-placement.test.ts`'s own
 * `nonBinaryReferralState()` uses at the engine level and `SeedReferredMovement` uses in
 * `tests/ward-coordinator-suburb.dom.test.tsx`, rather than a hand-built state object.
 * `rph-adult-secure` is the same real, Undesignated, non-forensic Adult Secure unit both of those
 * files use, chosen so the refusal below is genuinely about the gender-placement gate and not
 * some other eligibility gate.
 */
const UNIT_ID = "rph-adult-secure";
const REASON = GENDER_PLACEMENT_REASONS[0];
/** The id the reducer's `nextFrontDoorReferralId` gives the first `RECEIVE_REFERRAL` raised
 *  against a freshly seeded state — see `ward-flow-reducer.ts`, and the identical comment on
 *  `RAISED_REFERRAL_ID` in `tests/ward-coordinator-suburb.dom.test.tsx`. */
const REFERRAL_ID = "RF-901";

/** Raises one Non-binary ward referral through the real reducer, once, on mount. */
function SeedNonBinaryReferral() {
  const { now, dispatch } = useWardFlow();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ageBand: "Adult",
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Non-binary",
          secureBedNeeded: true,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
  }, [now, dispatch]);
  return null;
}

/** Mirrors `MatchHarness` in `tests/ward-referral-match-suburb.dom.test.tsx`: the provider
 *  supplies `now`/`dispatch`/`rejections`, and the referral itself is read fresh off the real
 *  `referrals` state rather than a hand-built object, so an accepted placement really updates it. */
function MatchHarness() {
  const { referrals, now, dispatch, rejections } = useWardFlow();
  const referral = referrals.find((candidate) => candidate.id === REFERRAL_ID);
  if (!referral) return null;
  return (
    <ReferralMatchView referral={referral} units={allUnits()} now={now} dispatch={dispatch} rejections={rejections} />
  );
}

function renderNonBinaryReferral() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SeedNonBinaryReferral />
      <MatchHarness />
    </WardFlowProvider>,
  );
}

describe("ReferralMatchView: a non-binary placement explains itself, then succeeds once answered", () => {
  it("without a reason or the tick, no plain Accept button exists and the refusal's own words render", () => {
    renderNonBinaryReferral();

    // A canary on the seed itself, so a broken harness reads as an obvious setup failure rather
    // than a false negative on the assertions below.
    expect(
      screen.getByTestId(`ward-referral-match-accepts-${UNIT_ID}`),
      "the seeded referral never reached an accepting row for rph-adult-secure, so this test proves nothing",
    ).toBeInTheDocument();

    // The plain "Accept at X" button must not exist at all while the placement is unanswered —
    // never present-but-disabled, which the movement path's `ward-shortlist-refer` uses instead
    // because that button also serves every OTHER kind of referral. This screen's ordinary accept
    // control is per-unit and per-row, so the gender-placement form replaces it outright here.
    expect(screen.queryByTestId(`ward-referral-match-accept-${UNIT_ID}`)).toBeNull();

    const form = screen.getByTestId(`ward-referral-match-gender-placement-form-${UNIT_ID}`);
    expect(form).toBeTruthy();
    expect(screen.getByTestId(`ward-referral-match-gender-placement-guidance-${UNIT_ID}`).textContent).toContain(
      "Check with the ward first",
    );
    expect(screen.getByTestId(`ward-referral-match-gender-placement-refusal-${UNIT_ID}`).textContent).toBe(
      GENDER_PLACEMENT_REFUSAL,
    );

    const submit = screen.getByTestId(`ward-referral-match-gender-placement-submit-${UNIT_ID}`);
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("with a reason chosen and the tick checked, the acceptance succeeds", () => {
    renderNonBinaryReferral();

    fireEvent.change(screen.getByTestId(`ward-referral-match-gender-placement-reason-${UNIT_ID}`), {
      target: { value: REASON },
    });
    fireEvent.click(screen.getByTestId(`ward-referral-match-gender-placement-checked-${UNIT_ID}`));

    const submit = screen.getByTestId(`ward-referral-match-gender-placement-submit-${UNIT_ID}`);
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);

    // The real reducer accepted it: this view now shows the referral as decided, never a locally
    // claimed success — `ward-referral-match-decided` only renders once `ward.state !== "queued"`.
    expect(screen.getByTestId("ward-referral-match-decided").textContent).toContain("Accepted at Dabakarn");
  });

  it("the tier-1 card offers no plain accept either; its button opens the same form instead", () => {
    renderNonBinaryReferral();

    // No plain "Accept at X" for this unit anywhere on the screen: the tier-1 card used to send
    // one straight to the reducer, which could only refuse it with GENDER_PLACEMENT_REFUSAL.
    expect(screen.queryByRole("button", { name: "Accept at Dabakarn" })).toBeNull();

    const check = screen.getByTestId(`ward-referral-match-tier-1-gender-placement-${UNIT_ID}`);
    expect(check.textContent).toBe("Check placement at Dabakarn");
    fireEvent.click(check);

    const reason = screen.getByTestId(`ward-referral-match-gender-placement-reason-${UNIT_ID}`);
    expect(reason).toHaveFocus();
    expect((reason.closest("details") as HTMLDetailsElement).open).toBe(true);
    // Nothing was dispatched: the referral is still undecided until the form is answered.
    expect(screen.queryByTestId("ward-referral-match-decided")).toBeNull();
  });
});
