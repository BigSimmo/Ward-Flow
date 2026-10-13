import { fireEvent, screen } from "@testing-library/react";

import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { FIXTURE_HISTORY } from "./ward-referral-history";

/**
 * Option B (Josh, 13 Oct 2026): the ED's "Raise referral" now opens the one referral slide-out, so
 * the inline ED form is reached only through an inbox referral's "Raise into a movement". These
 * suites test that form's own fields, so they reach it the way a clinician now does: a referral
 * addressed to this department arrives, and its inbox row's raise button opens the form.
 *
 * The referral names no ward arm, so nothing on the form is prefilled from it (the gender prefill
 * is proved separately in `ward-ed-raise-from-referral-gender-prefill.dom.test.tsx`).
 */
export function EdInboxReferralFixture({ edId }: { edId: string }) {
  const flow = useWardFlow();
  const { dispatch, now } = flow;
  return (
    <>
      <button
        type="button"
        hidden
        data-testid="fixture-ed-inbox-referral"
        onClick={() =>
          dispatch({
            type: "RECEIVE_REFERRAL",
            role: "community",
            now,
            ageBand: "Adult",
            destinations: [{ kind: "emergency_department", edId, purpose: "psychiatric_review" }],
            homeRegion: "Perth Metropolitan",
            suburb: { kind: "named", name: "Armadale" },
            source: "community",
            urgency: 2,
            originSiteCode: "SCGH",
            transportNeeded: false,
            ...FIXTURE_HISTORY,
          } as never)
        }
      />
      <button
        type="button"
        hidden
        data-testid="fixture-ed-inbox-arrived"
        onClick={() => {
          const referralId = flow.referrals.at(-1)?.id;
          if (referralId) dispatch({ type: "RECORD_ARRIVED_IN_DEPARTMENT", role: "ed", now, referralId });
        }}
      />
    </>
  );
}

/** Receives a referral into this department and opens "Raise into a movement" for it. */
export function openRaiseIntoMovementForm() {
  fireEvent.click(screen.getByTestId("fixture-ed-inbox-referral"));
  fireEvent.click(screen.getByTestId("fixture-ed-inbox-arrived"));
  const raise = screen.getAllByTestId(/^ward-ed-inbox-raise-/u).at(-1);
  if (!raise) throw new Error("the received referral offers no Raise into a movement");
  fireEvent.click(raise);
}
