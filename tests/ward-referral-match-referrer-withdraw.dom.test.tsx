import { fireEvent, render, screen } from "@testing-library/react";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import { DecidedSection } from "@/components/ward-management/referrals/referral-board-sections";
import { referralPresentationLists } from "@/components/ward-management/ward-partial-view-presenters";

const sender = vi.hoisted(() => ({
  summary: undefined as SenderReferralPartialView | null | undefined,
  role: "coordinator" as "coordinator" | "ward" | "bed_manager",
  unitId: "",
  phone: false,
}));
vi.mock("@/components/wf", async (original) => ({
  ...(await original<typeof import("@/components/wf")>()),
  useIsPhone: () => sender.phone,
}));
vi.mock("@/components/ward-management/ward-sender-presentation", () => ({
  useSenderPresentation: () => ({ required: sender.summary !== undefined, referralFor: () => sender.summary }),
}));
vi.mock("@/components/ward-management/ward-role-gate", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-role-gate")>()),
  useRouteRole: () => sender.role,
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({
    role: sender.role,
    scope: sender.role === "coordinator" ? { kind: "statewide" } : { kind: "ward", unitIds: [sender.unitId] },
  }),
}));
afterEach(() => {
  sender.summary = undefined;
  sender.role = "coordinator";
  sender.unitId = "";
  sender.phone = false;
});

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowProvider, WardFlowOverride } from "@/components/ward-management/ward-flow-provider";
import { referralSenderRole } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  decidedWaitLabel,
  outcomeDetail,
  outcomeLabel,
  referralJourneyStages,
} from "@/components/ward-management/referrals/referral-board-model";
import { referralTimeline } from "@/components/ward-management/referrals/referral-board-parts";
import type { SenderReferralPartialView } from "@/components/ward-management/ward-partial-view-contract";

function BoardRecord({ referral }: { referral: Referral }) {
  const value = useWardFlow();
  return (
    <WardFlowOverride value={{ ...value, referrals: [referral], movements: [] }}>
      <ReferralBoard />
    </WardFlowOverride>
  );
}

describe("sender referral presentation from a partial record", () => {
  const source = seedWardFlowState().referrals[0]!;
  const referral = { ...source, destinations: [], triagedAt: source.raisedAt + 5 };
  const summary: SenderReferralPartialView = {
    id: source.id,
    kind: "sender",
    state: "declined",
    withdrawn: false,
    decidedAt: source.raisedAt + 20,
    visibleUntil: null,
    canWithdraw: false,
    informationNeeds: [],
  };
  const queuedSummary = { ...summary, state: "queued" as const, decidedAt: null, canWithdraw: true };
  const queuedSource: Referral = {
    ...source,
    triagedAt: undefined,
    source: "psychiatric_ward",
    originUnitId: seedWardFlowState().units[0].id,
    destinations: [{ ...source.destinations[0]!, state: "queued", withdrawnAt: undefined, decidedAt: undefined }],
    transportNeeded: false,
  };
  const partialQueued: Referral = { ...queuedSource, destinations: [] };
  const board = (row: Referral) => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <BoardRecord referral={row} />
    </WardFlowProvider>
  );
  it("does not classify hidden recipients or announce category zeroes on the desktop", () => {
    sender.summary = queuedSummary;
    sender.role = "ward";
    render(board(partialQueued));
    for (const key of ["ward", "ed", "community", "refused"])
      expect(screen.queryByTestId(`ward-referral-highlight-${key}`)).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-highlight-tier1")).toBeInTheDocument();
    expect(screen.getByTestId(`ward-referral-board-row-${source.id}`)).toBeInTheDocument();
  });
  it("keeps sender rows when a previously selected phone recipient filter becomes unavailable", () => {
    sender.phone = true;
    const view = render(board(queuedSource));
    fireEvent.click(screen.getByTestId("ward-referral-phone-chip-ward"));
    sender.summary = queuedSummary;
    sender.role = "ward";
    view.rerender(board(partialQueued));
    expect(screen.getByTestId(`ward-referral-board-row-${source.id}`)).toBeInTheDocument();
    for (const key of ["ward", "ed", "both", "community", "refused"])
      expect(screen.queryByTestId(`ward-referral-phone-chip-${key}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-highlight-note")).not.toBeInTheDocument();
  });
  it("does not describe hidden phone bed needs as None", () => {
    sender.phone = true;
    sender.summary = queuedSummary;
    sender.role = "ward";
    const view = render(board(partialQueued));
    fireEvent.click(screen.getByTestId(`ward-referral-board-select-${source.id}`));
    expect(screen.getByText("Needs", { selector: "dt" }).parentElement).toHaveTextContent(
      "Destination details are restricted",
    );
    expect(screen.getByText("Needs", { selector: "dt" }).parentElement).not.toHaveTextContent("None");
    sender.summary = null;
    view.rerender(board(partialQueued));
    expect(screen.getByText("Needs", { selector: "dt" }).parentElement).toHaveTextContent(
      "Destination details unavailable",
    );
  });
  it("keeps the settled outcome and decision duration when no destination is visible", () => {
    expect(outcomeLabel(referral, summary)).toBe("Declined");
    expect(decidedWaitLabel(referral, summary)).toBe(
      decidedWaitLabel({
        ...source,
        destinations: [{ ...source.destinations[0]!, state: "declined", decidedAt: summary.decidedAt! }],
      }),
    );
    expect(outcomeDetail(referral, [], summary)).toEqual({ outcome: "Declined", alsoRefused: [], alsoCancelled: [] });
    expect(referralJourneyStages(referral, NOW_ANCHOR, summary)?.some((stage) => stage.now)).toBe(false);
  });
  it("uses one neutral decision event and never destination history for the sender", () => {
    const entries = referralTimeline(source, [], summary);
    expect(entries.filter((entry) => entry.at === summary.decidedAt)).toEqual([
      { at: summary.decidedAt, tone: "closed", text: "Referral declined" },
    ]);
    expect(entries.some((entry) => /refused:|Opened by|asked for:|waitlisted/.test(entry.text))).toBe(false);
    expect(outcomeLabel(referral, null)).toBe("Progress unavailable");
  });
  it("does not turn a follow-up answer into an overall decision while the bed question stays open", () => {
    const queued = { ...summary, state: "queued" as const, canWithdraw: true };
    expect(
      referralTimeline(source, [], queued).some((entry) => /^Referral (declined|accepted|withdrawn)$/.test(entry.text)),
    ).toBe(false);
    expect(outcomeLabel(referral, queued)).toBe("Queued");
  });
  it("groups an empty destination record by its truthful outcome and renders that decision time", () => {
    sender.summary = summary;
    const lists = referralPresentationLists([referral], () => summary);
    expect(lists.queued).toEqual([]);
    expect(lists.decided).toEqual([referral]);
    render(<DecidedSection decided={lists.decided} decidedTotal={1} units={[]} now={NOW_ANCHOR} onSelect={() => {}} />);
    expect(screen.getByTestId(`ward-referral-board-decided-detail-${referral.id}`)).toHaveTextContent("Declined");
    expect(screen.getByTestId(`ward-referral-board-decided-detail-card-${referral.id}`)).toHaveTextContent("Declined");
    expect(screen.queryByText("No decision time recorded")).not.toBeInTheDocument();
  });
  it("preserves the actual primary accepted placement without refusal or cancellation details", () => {
    const arm = source.destinations.find((row) => row.destination.kind === "psychiatric_ward")!;
    const accepted: Referral = {
      ...source,
      destinations: [
        { ...arm, state: "accepted", acceptedUnitId: "own-accepting-unit", decidedAt: source.raisedAt + 10 },
      ],
    };
    expect(
      outcomeDetail(accepted, [{ id: "own-accepting-unit", name: "Accepting ward" } as Unit], {
        ...summary,
        state: "accepted",
      }),
    ).toEqual({ outcome: "Accepting ward", alsoRefused: [], alsoCancelled: [] });
  });
  it.each(["ward", "bed_manager"] as const)("does not expose coordinator decision controls to a %s sender", (role) => {
    sender.summary = { ...summary, state: "queued", decidedAt: null, canWithdraw: true };
    sender.role = role;
    sender.unitId = "sending-unit";
    const dispatch = vi.fn();
    const own: Referral = { ...referral, source: "psychiatric_ward", originUnitId: sender.unitId };
    render(<ReferralMatchView referral={own} units={[]} now={NOW_ANCHOR} dispatch={dispatch} rejections={[]} />);
    expect(screen.getByTestId("ward-referral-sender-progress")).toHaveTextContent("Queued");
    expect(screen.queryByTestId("ward-referral-match-withdraw-recorder")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Accept|^Decline|Ask more wards/ })).not.toBeInTheDocument();
    if (role === "ward") {
      fireEvent.click(screen.getByTestId("ward-referral-match-withdraw"));
      fireEvent.click(screen.getByTestId("ward-referral-match-confirm-withdraw"));
      expect(dispatch).toHaveBeenCalledWith({
        type: "RECORD_REFERRER_WITHDRAWAL",
        role: "ward",
        referralId: own.id,
        actingUnitId: sender.unitId,
        now: NOW_ANCHOR,
      });
    } else expect(screen.queryByTestId("ward-referral-match-withdraw")).not.toBeInTheDocument();
  });
  it("keeps an unavailable sender out of candidate forms and withdrawal controls", () => {
    sender.summary = null;
    render(<ReferralMatchView referral={referral} units={[]} now={NOW_ANCHOR} dispatch={vi.fn()} rejections={[]} />);
    expect(screen.getByTestId("ward-referral-sender-progress")).toHaveTextContent("Progress unavailable");
    expect(screen.queryByTestId("ward-referral-match-withdraw")).not.toBeInTheDocument();
  });
  it.each(["ward", "bed_manager"] as const)(
    "does not lend coordinator withdrawal to a receiving-only %s with no sender summary",
    (role) => {
      sender.role = role;
      sender.unitId = "receiving-unit";
      const receiving: Referral = {
        ...source,
        source: "community",
        destinations: source.destinations.map((arm) => ({
          ...arm,
          state: "queued",
          decidedAt: undefined,
          withdrawnAt: undefined,
          destination:
            arm.destination.kind === "psychiatric_ward"
              ? { ...arm.destination, unitId: sender.unitId }
              : arm.destination,
        })),
      };
      render(<ReferralMatchView referral={receiving} units={[]} now={NOW_ANCHOR} dispatch={vi.fn()} rejections={[]} />);
      expect(screen.queryByTestId("ward-referral-match-withdraw-recorder")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ward-referral-match-withdraw")).not.toBeInTheDocument();
    },
  );
});

/**
 * Owner, 4 October 2026: the community team and the ED may record that they cancelled their own
 * referral, as well as the coordinator. The match view offers the whole-referral withdrawal with a
 * "recorded by" choice of the coordinator or the side that sent this referral.
 */

function Harness({ referralId }: { referralId: string }) {
  const { referrals, units, now, dispatch, rejections } = useWardFlow();
  const referral = referrals.find((candidate) => candidate.id === referralId);
  if (!referral) throw new Error(`fixture referral ${referralId} was not found in the seeded state`);
  return (
    <>
      <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />
      <output data-testid="sender">{referralSenderRole(referral)}</output>
      <output data-testid="recorded-by">
        {referral.destinations.map((addressing) => addressing.withdrawalRecordedBy ?? "").join("|")}
      </output>
    </>
  );
}

function renderReferral(referralId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness referralId={referralId} />
    </WardFlowProvider>,
  );
}

describe("withdrawing a whole referral from the match view", () => {
  it("records the referring side as the recorder when chosen, after a confirm step", () => {
    renderReferral("RF-009");
    const sender = screen.getByTestId("sender").textContent as "ed" | "community";

    fireEvent.change(screen.getByTestId("ward-referral-match-withdraw-recorder"), { target: { value: "sender" } });
    fireEvent.click(screen.getByTestId("ward-referral-match-withdraw"));
    // Nothing is recorded until the confirm step.
    expect(screen.getByTestId("recorded-by").textContent).not.toContain(WARD_FLOW_ROLE_LABELS[sender]);
    fireEvent.click(screen.getByTestId("ward-referral-match-confirm-withdraw"));

    expect(screen.queryByTestId("ward-referral-match-rejection")).not.toBeInTheDocument();
    expect(screen.getByTestId("recorded-by").textContent).toContain(WARD_FLOW_ROLE_LABELS[sender]);
    // Nothing left waiting, so the control is gone.
    expect(screen.queryByTestId("ward-referral-match-withdraw-controls")).not.toBeInTheDocument();
  });

  it("keeps the referral when the confirm step is cancelled", () => {
    renderReferral("RF-009");
    fireEvent.click(screen.getByTestId("ward-referral-match-withdraw"));
    fireEvent.click(screen.getByTestId("ward-referral-match-cancel-withdraw"));
    expect(screen.getByTestId("recorded-by").textContent?.replace(/\|/g, "")).toBe("");
    expect(screen.getByTestId("ward-referral-match-withdraw")).toBeInTheDocument();
  });
});
