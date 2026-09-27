import { render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { markBroomeForensicForThisFile } from "./helpers/ward-made-up-forensic-ward";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * D7 on the match screen: a forensic ward is never offered, and the screen says so by name rather
 * than leaving the ward silently absent. This used to be checked by the built-app referral journey
 * (`tests/ui-ward-referrals.spec.ts`) on Broome, which owner ruling 1A (25 Sept 2026) made
 * non-forensic, so the sample network has no forensic ward to show there. It is checked here on the
 * made-up forensic ward instead, which only a test in this process can put in.
 */
markBroomeForensicForThisFile();

const FORENSIC_UNIT_ID = "brm-adult-secure";
/** The id the reducer gives the first `RECEIVE_REFERRAL` raised in a fresh provider. */
const REFERRAL_ID = "RF-901";

function SeedAdultReferral() {
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
          gender: "Female",
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

describe("ReferralMatchView: a forensic ward is named and never offered", () => {
  it("shows the forensic reason for the made-up forensic ward and gives it no accept control", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SeedAdultReferral />
        <MatchHarness />
      </WardFlowProvider>,
    );
    const unit = allUnits().find((candidate) => candidate.id === FORENSIC_UNIT_ID);
    expect(unit?.forensic, "the made-up forensic ward is not in place, so this test proves nothing").toBe(true);
    expect(screen.getByTestId(`ward-referral-match-reason-${FORENSIC_UNIT_ID}`)).toHaveTextContent(
      `${unit!.name} is a forensic ward and is never offered as a destination`,
    );
    expect(screen.queryByTestId(`ward-referral-match-accept-${FORENSIC_UNIT_ID}`)).toBeNull();
  });
});
