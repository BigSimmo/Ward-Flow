import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * 28 day readmission on the referral queue (PR #159 review): the prior stay AD-LEFT-01 links to
 * its person only through RF-010, which is no longer queued. The board must build its index from
 * every referral, or that stay resolves to nobody and the new referral goes unflagged.
 */

const seed = seedWardFlowState();
const priorReferral = seed.referrals.find((referral) => referral.id === "RF-010")!;

function Receive() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() => {
        dispatch({
          type: "RECEIVE_REFERRAL",
          role: "community",
          now,
          ageBand: "Adult",
          patientId: priorReferral.patientId,
          destinations: [
            {
              kind: "psychiatric_ward",
              sex: "Female",
              secureBedNeeded: false,
              involuntaryBedNeeded: false,
              highAcuityNursingNeeded: false,
            },
          ],
          homeRegion: "Perth Metropolitan",
          suburb: { kind: "named", name: "Armadale" },
          source: "community",
          urgency: 2,
          originSiteCode: "SCGH",
          transportNeeded: false,
          ...FIXTURE_HISTORY,
        });
      }}
    >
      receive referral
    </button>
  );
}

function Newest() {
  const { referrals, rejections } = useWardFlow();
  return (
    <p data-testid="newest">
      {referrals.at(-1)?.id}|{rejections.map((rejection) => rejection.reason).join(";")}
    </p>
  );
}

describe("28 day readmission flag on the referral queue", () => {
  it("flags a new referral whose prior stay's referral has left the queue", () => {
    expect(priorReferral.patientId, "RF-010 must name its person for this case").toBeDefined();
    expect(referralQueueOrder(seed.referrals).map((referral) => referral.id)).not.toContain("RF-010");

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Receive />
        <ReferralBoard />
        <Newest />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "receive referral" }));
    const [id, rejections] = (screen.getByTestId("newest").textContent ?? "").split("|");
    expect(rejections, "RECEIVE_REFERRAL was refused").toBe("");
    const row = screen.getByTestId(`ward-referral-board-row-${id}`);

    const flag = within(row).getByTestId(`ward-referral-board-readmission-${id}`);
    expect(flag).toHaveTextContent("28d readmission");
    fireEvent.click(within(flag).getByRole("button"));
    expect(flag).toHaveTextContent(/Discharged \d{1,2} \w{3} from /);
  });
});
