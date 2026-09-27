import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import type { RecordedSex, ReferralGender } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Bed board decision 9A (Josh, 26 September 2026, "go ahead with all recommendations"): the
 * waiting list shows "Coordinator to review" on a queued referral whose ward arm records a gender
 * or sex that is not female or male. It is the R7 rule (Josh, 25 September 2026, option A) the
 * engine already enforces through `genderReviewNeeded`, shown where the coordinator is looking
 * before anyone tries to place the patient. No engine change: the flag reads what is recorded.
 *
 * Every case goes through `RECEIVE_REFERRAL` on the real provider and reads the rendered board,
 * in both the table row and the card, because the two are separate markup and a flag added to
 * only one of them would pass a test that looked at the other.
 */

const FLAG_TEXT = "Coordinator to review: gender or sex not recorded as female or male";

function rowFlag(id: string) {
  return screen.queryByTestId(`ward-referral-board-review-${id}`);
}

function cardFlag(id: string) {
  return screen.queryByTestId(`ward-referral-board-card-review-${id}`);
}

function Receive({ sex, gender }: { sex: RecordedSex; gender?: ReferralGender }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "RECEIVE_REFERRAL",
          role: "community",
          now,
          ageBand: "Adult",
          destinations: [
            {
              kind: "psychiatric_ward",
              sex,
              ...(gender === undefined ? {} : { gender }),
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
        })
      }
    >
      receive referral
    </button>
  );
}

/** Accepts the newest referral into a mixed adult open ward with the coordinator's recorded
 *  review, the one act that writes `referral.genderPlacements`. */
function AcceptWithReview() {
  const { dispatch, now, referrals } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "ACCEPT_REFERRAL",
          role: "coordinator",
          now,
          referralId: referrals.at(-1)!.id,
          destinationKind: "psychiatric_ward",
          unitId: "scgh-adult-open",
          genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
          genderPlacementChecked: true,
        })
      }
    >
      accept with review
    </button>
  );
}

function Probe() {
  const { referrals, rejections } = useWardFlow();
  const newest = referrals.at(-1);
  return (
    <p data-testid="probe">
      {newest?.id ?? "none"}|{newest?.genderPlacements?.length ?? 0}|{rejections.length}
    </p>
  );
}

function probe(): { id: string; placements: number; rejections: number } {
  const [id, placements, rejections] = (screen.getByTestId("probe").textContent ?? "").split("|");
  return { id: id!, placements: Number(placements), rejections: Number(rejections) };
}

function renderWith(sex: RecordedSex, gender?: ReferralGender) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Receive sex={sex} gender={gender} />
      <AcceptWithReview />
      <ReferralBoard />
      <Probe />
    </WardFlowProvider>,
  );
  const before = probe();
  fireEvent.click(screen.getByRole("button", { name: "receive referral" }));
  const after = probe();
  expect(after.rejections, "RECEIVE_REFERRAL was refused, so nothing below is about the flag").toBe(before.rejections);
  expect(after.id, "RECEIVE_REFERRAL did not add a referral").not.toBe(before.id);
  // Anti-vacuity: the new referral must be on the queue, or an absent flag proves nothing.
  expect(screen.getByTestId(`ward-referral-board-row-${after.id}`)).toBeInTheDocument();
  return after.id;
}

function expectFlagged(id: string) {
  expect(rowFlag(id), "the table row is missing the flag").toHaveTextContent(FLAG_TEXT);
  expect(cardFlag(id), "the card is missing the flag").toHaveTextContent(FLAG_TEXT);
}

function expectNotFlagged(id: string) {
  expect(rowFlag(id)).toBeNull();
  expect(cardFlag(id)).toBeNull();
}

describe("Referral board: 'Coordinator to review' flag (bed board 9A, R7)", () => {
  it("shows no flag on any seeded queued referral, all of which record female or male", () => {
    function QueueProbe() {
      const ids = referralQueueOrder(useWardFlow().referrals).map((referral) => referral.id);
      return <p data-testid="queue-probe">{ids.join(",")}</p>;
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
        <QueueProbe />
      </WardFlowProvider>,
    );
    const seededQueue = (screen.getByTestId("queue-probe").textContent ?? "").split(",").filter(Boolean);
    expect(seededQueue.length, "the seed has no queued referral, so this proves nothing").toBeGreaterThan(0);
    for (const id of seededQueue) expectNotFlagged(id);
    expect(screen.queryAllByTestId(/^ward-referral-board-(card-)?review-/)).toHaveLength(0);
  });

  it("flags a referral that records no gender", () => {
    expectFlagged(renderWith("Female"));
  });

  it("flags a non-binary gender even when sex is female", () => {
    expectFlagged(renderWith("Female", "Non-binary"));
  });

  it("flags a sex recorded as another term even when gender is female", () => {
    expectFlagged(renderWith("Another term", "Female"));
  });

  it("does not flag a referral recording female gender and female sex (the control)", () => {
    expectNotFlagged(renderWith("Female", "Female"));
  });

  it("the flag goes once the coordinator records the review and accepts", () => {
    const id = renderWith("Female");
    expectFlagged(id);
    const before = probe();
    fireEvent.click(screen.getByRole("button", { name: "accept with review" }));
    const after = probe();
    expect(after.rejections, "the reviewed acceptance was refused").toBe(before.rejections);
    expect(after.placements, "the acceptance did not record the coordinator's review").toBe(1);
    expectNotFlagged(id);
  });
});
