import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";

import { GENDER_PLACEMENT_REASONS, GENDER_PLACEMENT_REFUSAL } from "@/components/ward-management/ward-change-reasons";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Owner reversal, item 2, second round, 17 September 2026: *"No. they actually can. make smallest
 * possible fix to enable this."* The front-door twin of
 * `tests/ward-shortlist-gender-placement-single-gender-ward.dom.test.tsx`: until this file, a
 * single-gender ward failing ONLY `gender_designation` for a Non-binary referral had
 * `candidateAccepts === false` (`ward-referrals.ts`), so `MatchRow` (`referral-match.tsx`) routed it
 * to the plain decline/override branch and the gender-placement form
 * `tests/ward-referral-match-gender-placement.dom.test.tsx` already proves for an Undesignated ward
 * was never reachable for a designated one.
 *
 * `fsh-adult-secure` is the network's one Male-only ward, otherwise fully eligible for this referral
 * (real capacity, authorised, non-forensic — see that unit's own comment in `ward-sites.ts`), so a
 * refusal here is genuinely about the gender-placement gate and nothing else.
 */
const UNIT_ID = "fsh-adult-secure";
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

describe("ReferralMatchView: a single-gender ward offers the non-binary placement form instead of the decline branch", () => {
  it("FSH Adult Secure carries the gender-placement form, and submitting accepts it", () => {
    renderNonBinaryReferral();

    // The canary: if this ward had `candidateAccepts === false`, this row would render the
    // decline/override branch instead and neither testid below would exist.
    const form = screen.getByTestId(`ward-referral-match-gender-placement-form-${UNIT_ID}`);
    expect(form).toBeTruthy();
    expect(screen.getByTestId(`ward-referral-match-gender-placement-refusal-${UNIT_ID}`).textContent).toBe(
      GENDER_PLACEMENT_REFUSAL,
    );
    // The plain decline row must not also be rendered for this unit.
    expect(screen.queryByTestId(`ward-referral-match-override-${UNIT_ID}`)).toBeNull();

    fireEvent.change(screen.getByTestId(`ward-referral-match-gender-placement-reason-${UNIT_ID}`), {
      target: { value: REASON },
    });
    fireEvent.click(screen.getByTestId(`ward-referral-match-gender-placement-checked-${UNIT_ID}`));

    const submit = screen.getByTestId(`ward-referral-match-gender-placement-submit-${UNIT_ID}`);
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);

    // The real reducer accepted it: this view now shows the referral as decided, never a locally
    // claimed success.
    expect(screen.getByTestId("ward-referral-match-decided").textContent).toContain("Accepted at FSH Adult Secure");
  });
});
