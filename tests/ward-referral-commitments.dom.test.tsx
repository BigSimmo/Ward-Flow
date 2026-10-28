import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { CallSheet } from "@/components/ward-management/coordinator/call-sheet";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import {
  ReferralCommitments,
  WardCommitmentControls,
} from "@/components/ward-management/referrals/referral-commitments-panel";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";

const route = vi.hoisted(() => ({ pathname: "/ward-flow/referrals" }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  usePathname: () => route.pathname,
}));

function inProvider(children: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>);
}

describe("Coordinated call sheet (closing-the-loop package A)", () => {
  it("groups the seeded open requests by ward and shows the recorded facts, with nothing to email", () => {
    inProvider(<CallSheet />);
    const sheet = screen.getByTestId("ward-call-sheet");
    const youth = screen.getByTestId("ward-call-sheet-bty-youth");
    expect(youth).toHaveTextContent("Last contact");
    expect(youth).toHaveTextContent("Call back later");
    expect(youth).toHaveTextContent("4 referrals");
    expect(screen.getByTestId("ward-call-sheet-item-bty-youth-RF-001")).toHaveTextContent("Promise overdue");
    expect(screen.getByTestId("ward-call-sheet-item-bty-youth-RF-001-chases")).toHaveTextContent("Asked 3 times");
    expect(screen.getByTestId("ward-call-sheet-fsh-older-adult")).toBeInTheDocument();
    // Screen and print only: no mail, share or outside link anywhere on the sheet.
    for (const link of within(sheet).queryAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/ward-flow\/referrals\?referral=/);
    }
    expect(sheet.innerHTML).not.toMatch(/mailto:|share/i);
    expect(sheet.textContent).not.toMatch(/suggested|recommended|best|priority score/i);
  });

  it("records one call outcome against every referral linked to the ward", async () => {
    const user = userEvent.setup();
    inProvider(<CallSheet />);
    await user.selectOptions(screen.getByTestId("ward-call-sheet-outcome-bty-youth"), "no_answer");
    await user.selectOptions(screen.getByTestId("ward-call-sheet-callback-bty-youth"), "60");
    await user.click(screen.getByTestId("ward-call-sheet-record-bty-youth"));
    expect(screen.getByTestId("ward-call-sheet-item-bty-youth-RF-001-chases")).toHaveTextContent("Asked 4 times");
    expect(screen.getByTestId("ward-call-sheet-bty-youth")).toHaveTextContent("No answer");
  });
});

describe("Handover carries open promises over (closing-the-loop package A)", () => {
  it("lists the seeded overdue promise and the callback still to come, each linked to its referral", () => {
    inProvider(<HandoverPage />);
    const panel = screen.getByTestId("ward-handover-open-promises");
    const rf001 = within(panel).getByTestId("ward-handover-promise-RF-001");
    expect(rf001).toHaveTextContent("Promise overdue");
    expect(within(rf001).getByRole("link")).toHaveAttribute("href", referralBoardHref("RF-001"));
    expect(within(panel).getByTestId("ward-handover-promise-RF-005")).toHaveTextContent("next callback");
  });
});

const commitmentSeed = seedWardFlowState();
const commitmentWard = commitmentSeed.units[0]!;
function commitmentReferral(): Referral {
  const base = commitmentSeed.referrals.find((referral) => referral.id === "RF-005")!;
  return {
    ...base,
    contactLog: undefined,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: commitmentWard.id,
          sex: "Male",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
        referredAt: NOW_ANCHOR - 60,
      },
    ],
  };
}

function pendingCommitment() {
  let resolve!: (outcome: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function CommitmentOverride({
  dispatch,
  generation,
  children,
}: {
  dispatch: WardCommandDispatch;
  generation: number;
  children: ReactNode;
}) {
  const flow = useWardFlow();
  return <WardFlowOverride value={{ ...flow, dispatch, worldGeneration: generation }}>{children}</WardFlowOverride>;
}

function commitmentScene(
  dispatch: WardCommandDispatch,
  referral: Referral,
  { generation = 0, ward = false, actingUnitId = commitmentWard.id } = {},
) {
  route.pathname = ward ? `/ward-flow/ward/${commitmentWard.id}` : "/ward-flow/referrals";
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommitmentOverride dispatch={dispatch} generation={generation}>
        {ward ? (
          <WardCommitmentControls
            entry={wardReferralInboxEntries([referral], commitmentWard.id)[0]!}
            unitId={commitmentWard.id}
            actingUnitId={actingUnitId}
            refusal={undefined}
          />
        ) : (
          <ReferralCommitments referral={referral} now={NOW_ANCHOR} />
        )}
      </CommitmentOverride>
    </WardFlowProvider>
  );
}

function chooseCommitment() {
  fireEvent.change(screen.getByLabelText("Step"), { target: { value: "response_requested" } });
  fireEvent.change(screen.getByLabelText("Next callback"), { target: { value: "60" } });
}

describe("commitment save confirmation (WF-028)", () => {
  it("retains coordinator choices while pending, sends once and preserves refused choices with a reason", async () => {
    const held = pendingCommitment();
    const dispatch = vi.fn<WardCommandDispatch>(() => held.promise);
    render(commitmentScene(dispatch, commitmentReferral()));
    chooseCommitment();
    const record = screen.getByRole("button", { name: "Record" });
    fireEvent.click(record);
    fireEvent.click(record);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Step")).toHaveValue("response_requested");
    expect(screen.getByLabelText("Next callback")).toHaveValue("60");
    expect(screen.getByLabelText("Step")).toBeDisabled();
    expect(record).toBeDisabled();
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: "RECORD_REFERRAL_COMMITMENT",
      role: "coordinator",
      unitId: commitmentWard.id,
      step: "response_requested",
      nextCallbackAt: NOW_ANCHOR + 60,
    });
    await act(async () =>
      held.resolve({ commandId: "synthetic-commitment", status: "refused", message: "The ward copy changed." }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The ward copy changed.");
    expect(screen.getByLabelText("Step")).toHaveValue("response_requested");
    expect(screen.getByLabelText("Next callback")).toHaveValue("60");
    expect(record).not.toBeDisabled();
  });

  it.each(["failed", "cancelled", "missing", "throws"] as const)(
    "keeps choices for an unconfirmed %s outcome",
    (kind) => {
      const dispatch = vi.fn<WardCommandDispatch>(() => {
        if (kind === "throws") throw new Error("Synthetic command failure");
        if (kind === "missing") return;
        return { commandId: "synthetic-commitment", status: kind };
      });
      render(commitmentScene(dispatch, commitmentReferral()));
      chooseCommitment();
      fireEvent.click(screen.getByRole("button", { name: "Record" }));
      expect(screen.getByLabelText("Step")).toHaveValue("response_requested");
      expect(screen.getByLabelText("Next callback")).toHaveValue("60");
      expect(screen.getByRole("alert")).toHaveTextContent(SAVE_NOT_CONFIRMED);
    },
  );

  it("clears coordinator choices only after current acceptance", async () => {
    const held = pendingCommitment();
    const dispatch = vi.fn<WardCommandDispatch>(() => held.promise);
    render(commitmentScene(dispatch, commitmentReferral()));
    chooseCommitment();
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    await act(async () =>
      held.resolve({ commandId: "synthetic-commitment", status: "accepted", isCurrent: () => true }),
    );
    expect(screen.getByLabelText("Step")).toHaveValue("");
    expect(screen.getByLabelText("Next callback")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not clear choices for an obsolete accepted outcome", async () => {
    const held = pendingCommitment();
    render(
      commitmentScene(
        vi.fn<WardCommandDispatch>(() => held.promise),
        commitmentReferral(),
      ),
    );
    chooseCommitment();
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    await act(async () =>
      held.resolve({ commandId: "synthetic-commitment", status: "accepted", isCurrent: () => false }),
    );
    expect(screen.getByLabelText("Next callback")).toHaveValue("60");
    expect(screen.getByRole("alert")).toHaveTextContent(SAVE_NOT_CONFIRMED);
  });

  it.each(["record", "world", "desk"] as const)(
    "ignores an earlier completion after the %s changes",
    async (change) => {
      const held = pendingCommitment();
      const dispatch = vi.fn<WardCommandDispatch>(() => held.promise);
      const referral = commitmentReferral();
      const view = render(commitmentScene(dispatch, referral));
      chooseCommitment();
      fireEvent.click(screen.getByRole("button", { name: "Record" }));
      const next = change === "record" ? { ...referral, id: "RF-synthetic-replacement" } : referral;
      const scene = commitmentScene(dispatch, next, { generation: change === "world" ? 1 : 0 });
      if (change === "desk") route.pathname = `/ward-flow/ward/${commitmentWard.id}`;
      view.rerender(scene);
      await act(async () => held.resolve({ commandId: "synthetic-commitment", status: "accepted" }));
      expect(screen.getByLabelText("Next callback")).toHaveValue("60");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("keeps one uncertain command locked until its same-command confirmation accepts", async () => {
    const confirmation = pendingCommitment();
    const dispatch = vi.fn<WardCommandDispatch>(() => ({
      commandId: "synthetic-commitment",
      status: "failed",
      confirmation: confirmation.promise,
    }));
    render(commitmentScene(dispatch, commitmentReferral()));
    chooseCommitment();
    const record = screen.getByRole("button", { name: "Record" });
    fireEvent.click(record);
    fireEvent.click(record);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(record).toBeDisabled();
    expect(screen.getByLabelText("Next callback")).toHaveValue("60");
    await act(async () => confirmation.resolve({ commandId: "synthetic-commitment", status: "accepted" }));
    expect(screen.getByLabelText("Next callback")).toHaveValue("");
    expect(record).not.toBeDisabled();
  });

  it("shares one pending guard between ward promise and acknowledgement and preserves refused time", async () => {
    const held = pendingCommitment();
    const dispatch = vi.fn<WardCommandDispatch>(() => held.promise);
    render(commitmentScene(dispatch, commitmentReferral(), { ward: true }));
    fireEvent.change(screen.getByLabelText("Answer promised by"), { target: { value: "60" } });
    const record = screen.getByRole("button", { name: "Record promise" });
    fireEvent.click(record);
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge, will respond" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Answer promised by")).toHaveValue("60");
    expect(screen.getByLabelText("Answer promised by")).toBeDisabled();
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: "RECORD_REFERRAL_COMMITMENT",
      role: "ward",
      actingUnitId: commitmentWard.id,
      step: "promised",
      promisedFor: NOW_ANCHOR + 60,
    });
    await act(async () =>
      held.resolve({ commandId: "synthetic-commitment", status: "refused", message: "The ward copy changed." }),
    );
    expect(screen.getByLabelText("Answer promised by")).toHaveValue("60");
    expect(screen.getByRole("alert")).toHaveTextContent("The ward copy changed.");
    expect(record).not.toBeDisabled();
  });

  it("clears a ward promise only when accepted, and ignores completion after the acting ward changes", async () => {
    const held = pendingCommitment();
    const dispatch = vi.fn<WardCommandDispatch>(() => held.promise);
    const referral = commitmentReferral();
    const view = render(commitmentScene(dispatch, referral, { ward: true }));
    fireEvent.change(screen.getByLabelText("Answer promised by"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Record promise" }));
    view.rerender(commitmentScene(dispatch, referral, { ward: true, actingUnitId: "synthetic-other-ward" }));
    await act(async () => held.resolve({ commandId: "synthetic-commitment", status: "accepted" }));
    expect(screen.getByLabelText("Answer promised by")).toHaveValue("60");
    dispatch.mockReturnValueOnce({ commandId: "synthetic-new-commitment", status: "accepted" });
    fireEvent.click(screen.getByRole("button", { name: "Record promise" }));
    expect(screen.getByLabelText("Answer promised by")).toHaveValue("");
  });
});
