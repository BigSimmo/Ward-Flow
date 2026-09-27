import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  COMMUNITY_DECLINE_REASONS,
  REFERRAL_DECLINE_REASONS,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import { COMMUNITY_DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Ward audit 2026-09-16, fix 4 (referral-match.tsx): a referral addressed only to an ED or a
 * community team rendered the "no bed shortlist" panel with NO decline control at all, although
 * `EVENT_ROLE.DECLINE_REFERRAL` already permits a coordinator to decline on any destination's
 * behalf. Both destinations get a real decline control now:
 *
 *  - an emergency-department destination gets the same decline control the ward branch already
 *    has, offering `REFERRAL_DECLINE_REASONS` — the vocabulary a coordinator gives on the
 *    referral's behalf, not `ed-screen.tsx`'s own narrower inbox UX;
 *  - a community-team destination gets its own control, offering `COMMUNITY_DECLINE_REASONS` —
 *    engine fix, 2026-09-17. Before that fix `DECLINE_REFERRAL`'s `reason` field was typed
 *    `ReferralDeclineReason` only and the reducer's own membership check was not scoped by
 *    destination kind, so a community reason would have been refused outright and a ward reason
 *    would have been wrongly accepted — the wrong-reason-is-worse-than-no-reason failure owner
 *    ruling O-16.6 exists to prevent. Both are fixed at the source now (`reason` widens to
 *    `ReferralDeclineReason | CommunityDeclineReason`; the reducer checks a `community_team`
 *    decline against `COMMUNITY_DECLINE_REASONS` specifically), so this view can offer the real
 *    vocabulary and dispatch honestly.
 */

function EdReferralHarness({ referralId }: { referralId: string }) {
  const { referrals, units, now, dispatch, rejections } = useWardFlow();
  const referral = referrals.find((candidate) => candidate.id === referralId);
  if (!referral) throw new Error(`fixture referral ${referralId} was not found in the seeded state`);
  return <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />;
}

describe("the emergency-department decline control on the 'no bed shortlist' panel", () => {
  it("renders for RF-009 (the seed's ED-only, queued referral) and dispatches a real, accepted decline", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdReferralHarness referralId="RF-009" />
      </WardFlowProvider>,
    );

    // Non-vacuity: this really is the no-bed-shortlist branch, not the ward shortlist.
    expect(screen.getByTestId("ward-referral-match-not-a-bed-question")).toBeInTheDocument();

    const button = screen.getByTestId("ward-referral-match-decline-emergency_department");
    expect(button).toHaveAttribute("aria-disabled", "true");

    const select = screen.getByTestId("ward-referral-match-decline-reason-emergency_department");
    const chosen = REFERRAL_DECLINE_REASONS[REFERRAL_DECLINE_REASONS.length - 1];
    fireEvent.change(select, { target: { value: chosen } });
    expect(select).toHaveValue(chosen);
    expect(button).not.toHaveAttribute("aria-disabled");

    fireEvent.click(button);

    // The reducer genuinely accepted it — no refusal banner, and (because RF-009's ED addressing
    // is no longer "queued") the decline control itself is gone from the re-rendered panel. A
    // dispatch that only looked like it worked would leave the control still sitting there.
    expect(screen.queryByTestId("ward-referral-match-rejection")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-decline-controls-emergency_department")).not.toBeInTheDocument();
  });
});

const BASE_REFERRAL_FIELDS = {
  ageBand: "Adult" as const,
  homeRegion: "Perth Metropolitan" as const,
  suburb: { kind: "named" as const, name: "Armadale" },
  source: "community" as const,
  raisedAt: NOW_ANCHOR - 10,
  urgency: 2 as const,
  originSiteCode: "RPH",
  transportNeeded: false,
  ...FIXTURE_HISTORY,
};

const COMMUNITY_ONLY_REFERRAL: Referral = {
  id: "RF-TEST-COMMUNITY-ONLY",
  ...BASE_REFERRAL_FIELDS,
  destinations: [{ destination: { kind: "community_team", teamName: "Inner City Clinic" }, state: "queued" }],
};

const ED_AND_COMMUNITY_REFERRAL: Referral = {
  id: "RF-TEST-ED-AND-COMMUNITY",
  ...BASE_REFERRAL_FIELDS,
  destinations: [
    { destination: { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" }, state: "queued" },
    { destination: { kind: "community_team", teamName: "Inner City Clinic" }, state: "queued" },
  ],
};

/** Same shape as `COMMUNITY_ONLY_REFERRAL`, but `gp`-sourced — the "not a bed question" branch's
 *  own specimen for RB1's GP non-contact notice (see `ward-referral-match-suburb.dom.test.tsx`
 *  for the same notice's bed-shortlist-branch specimen). */
const GP_COMMUNITY_REFERRAL: Referral = {
  id: "RF-TEST-GP-COMMUNITY",
  ...BASE_REFERRAL_FIELDS,
  source: "gp",
  destinations: [{ destination: { kind: "community_team", teamName: "Inner City Clinic" }, state: "queued" }],
};

function LocalReferralHarness({ referral, units }: { referral: Referral; units: Unit[] }) {
  const { now, dispatch, rejections } = useWardFlow();
  return <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />;
}

function renderLocal(referral: Referral) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <LocalReferralHarness referral={referral} units={allUnits()} />
    </WardFlowProvider>,
  );
}

describe("a queued community-team destination gets a real decline control (engine fix, 2026-09-17)", () => {
  it("renders the real community vocabulary, blocked until a reason is chosen — and a click while blocked is a no-op", () => {
    renderLocal(COMMUNITY_ONLY_REFERRAL);

    const select = screen.getByTestId("ward-referral-match-decline-reason-community_team");
    const button = screen.getByTestId("ward-referral-match-decline-community_team");

    // The real community vocabulary, never the ward's — offering `REFERRAL_DECLINE_REASONS` here
    // would misuse it and now be refused outright by the reducer's own destination-kind check.
    for (const reason of COMMUNITY_DECLINE_REASONS) {
      expect(within(select).getByRole("option", { name: COMMUNITY_DECLINE_REASON_LABELS[reason] })).toBeInTheDocument();
    }
    expect(button).toHaveAttribute("aria-disabled", "true");

    // The no-reason branch: nothing is chosen, so a click must be a no-op — guarded both by
    // `aria-disabled` (never native `disabled`, so the control stays screen-reader-discoverable)
    // and by `handleCommunityDecline`'s own belt-and-braces check.
    fireEvent.click(button);
    expect(screen.queryByTestId("ward-referral-match-rejection")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decline-controls-community_team")).toBeInTheDocument();
  });

  it("still renders the ED decline control for a referral addressed to both, alongside the community control", () => {
    renderLocal(ED_AND_COMMUNITY_REFERRAL);

    expect(screen.getByTestId("ward-referral-match-decline-controls-emergency_department")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decline-controls-community_team")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-decline-unavailable-community_team")).not.toBeInTheDocument();
  });
});

/**
 * RB1, item 25, owner answer 25 (2026-09-17): *"GP referrals: the GP is told by phone or letter
 * for now; add 'GP' as a referral source."* The "not a bed question" branch's own proof that the
 * notice shows here too, not only on the bed-shortlist branch.
 */
describe("ReferralMatchView's GP non-contact notice, on the 'no bed shortlist' branch", () => {
  it("shows the exact sentence for a gp-sourced referral", () => {
    renderLocal(GP_COMMUNITY_REFERRAL);
    expect(screen.getByTestId("ward-referral-match-gp-source-notice")).toHaveTextContent(
      "This system does not contact the GP. Tell them by phone or letter.",
    );
  });

  it("renders nothing for a non-gp source", () => {
    renderLocal(COMMUNITY_ONLY_REFERRAL);
    expect(screen.queryByTestId("ward-referral-match-gp-source-notice")).not.toBeInTheDocument();
  });
});

/**
 * ⚠️ **THE CHOSEN-REASON BRANCH, PROVEN AGAINST A REFERRAL THE LIVE REDUCER ACTUALLY HOLDS.** The
 * two tests above use `COMMUNITY_ONLY_REFERRAL`/`ED_AND_COMMUNITY_REFERRAL` as display props the
 * live `dispatch` cannot see (`LocalReferralHarness` never puts them in `state.referrals`), which
 * is enough to prove the control renders and stays gated, but cannot prove a click actually
 * declines anything — the same reason `EdReferralHarness` above raises RF-009 through the real
 * reducer rather than asserting against a hand-built object. This harness does the same: it raises
 * a fresh, real, community-only referral through `RECEIVE_REFERRAL` and feeds the result — not a
 * static literal — into `ReferralMatchView`.
 */
function LiveCommunityHarness() {
  const { referrals, units, now, dispatch, rejections } = useWardFlow();
  const created = referrals.find(
    (referral) =>
      referral.destinations.length === 1 &&
      referral.destinations[0].destination.kind === "community_team" &&
      referral.destinations[0].destination.teamName === "Inner City Clinic" &&
      referral.raisedAt === now,
  );
  return (
    <>
      <button
        type="button"
        data-testid="seed-community-referral-btn"
        onClick={() =>
          dispatch({
            type: "RECEIVE_REFERRAL",
            role: "community",
            now,
            ageBand: "Adult",
            destinations: [{ kind: "community_team", teamName: "Inner City Clinic" }],
            homeRegion: "Perth Metropolitan",
            suburb: { kind: "named", name: "Armadale" },
            source: "community",
            urgency: 2,
            originSiteCode: "RPH",
            transportNeeded: false,
            ...FIXTURE_HISTORY,
          })
        }
      >
        Seed
      </button>
      {created ? (
        <ReferralMatchView referral={created} units={units} now={now} dispatch={dispatch} rejections={rejections} />
      ) : null}
    </>
  );
}

describe("choosing a community reason and confirming dispatches a real DECLINE_REFERRAL", () => {
  it("the reducer genuinely accepts it, and the control leaves the panel once the community addressing is no longer queued", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LiveCommunityHarness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("seed-community-referral-btn"));

    const select = screen.getByTestId("ward-referral-match-decline-reason-community_team");
    const button = screen.getByTestId("ward-referral-match-decline-community_team");
    expect(button).toHaveAttribute("aria-disabled", "true");

    const chosen = COMMUNITY_DECLINE_REASONS[0];
    fireEvent.change(select, { target: { value: chosen } });
    expect(select).toHaveValue(chosen);
    expect(button).not.toHaveAttribute("aria-disabled");

    fireEvent.click(button);

    // The reducer genuinely accepted it — no refusal banner, and (because the community
    // addressing is no longer "queued") the decline control itself is gone from the re-rendered
    // panel. A dispatch that only looked like it worked would leave the control still sitting
    // there, exactly as `EdReferralHarness`'s own sibling test above proves for the ED control.
    expect(screen.queryByTestId("ward-referral-match-rejection")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-decline-controls-community_team")).not.toBeInTheDocument();
  });
});

/**
 * RB5 (item 16, 2026-09-17) — "a community team may accept, for follow-up only". Same harness and
 * the same live-reducer discipline as the decline proof immediately above: `LiveCommunityHarness`
 * raises a fresh, real, community-only referral through `RECEIVE_REFERRAL` and feeds the result —
 * never a static literal — into `ReferralMatchView`, so a click here is a real dispatch the
 * reducer can genuinely refuse, not merely a prop this view was handed.
 */
describe("clicking Accept referral dispatches a real ACCEPT_REFERRAL for the community destination", () => {
  it("the reducer genuinely accepts it, and the referral itself reads decided once the community addressing is accepted", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LiveCommunityHarness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("seed-community-referral-btn"));

    const acceptButton = screen.getByTestId("ward-referral-match-accept-community_team");
    // No reason and no unit gate this control, unlike decline beside it -- so unlike that button
    // this one is never `aria-disabled`.
    expect(acceptButton).not.toHaveAttribute("aria-disabled");

    fireEvent.click(acceptButton);

    // The reducer genuinely accepted it — no refusal banner, and (because the community addressing
    // is no longer "queued") BOTH the accept and decline controls leave the re-rendered panel. A
    // dispatch that only looked like it worked would leave them still sitting there.
    expect(screen.queryByTestId("ward-referral-match-rejection")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-accept-controls-community_team")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-decline-controls-community_team")).not.toBeInTheDocument();
  });
});
