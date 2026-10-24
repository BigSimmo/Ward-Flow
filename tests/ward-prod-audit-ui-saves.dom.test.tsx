import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/ward-flow/referrals";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardDischargeNotices } from "@/components/ward-management/ward/ward-discharge-notices";
import { ReferralHistoryAndCorrections } from "@/components/ward-management/referrals/referral-history-corrections";
import { ReferralOwnerAndCalls } from "@/components/ward-management/referrals/referral-owner-and-calls-panel";
import { useMarkReferralsOpened } from "@/components/ward-management/referrals/referral-information-needs-lazy";
import type { WardReferralInboxEntry } from "@/components/ward-management/referrals/referral-inbox";

/**
 * Production audit 24 Oct 2026: shared-mode answers on four controls. URE-02 (one "Send notice"
 * per service until it has an answer), URE-05 (a correction or call log keeps its text when the
 * shared answer is not "accepted") and URE-07 (an opened receipt in flight is not sent twice).
 */

afterEach(() => cleanup());

const FAILED: WardCommandOutcome = {
  commandId: "c-1",
  status: "failed",
  message: "Save is not confirmed. Review the board before trying again.",
};

function deferred() {
  let finish!: (outcome: WardCommandOutcome) => void;
  let fail!: (reason?: unknown) => void;
  const promise = new Promise<WardCommandOutcome>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { promise, finish, fail };
}

/** The real board, with commands answered by `dispatch` as the shared workspace would. */
function Shared({ dispatch, children }: { dispatch: WardCommandDispatch; children: ReactNode }) {
  const state = useWardFlow();
  return <WardFlowOverride value={{ ...state, dispatch }}>{children}</WardFlowOverride>;
}

const WARD = seedWardFlowState().units.find((unit) => unit.cohort === "Adult")!;

function Refer() {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      source: "community",
      originSiteCode: "BTY",
      urgency: 2,
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: WARD.id,
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Bentley" },
      transportNeeded: true,
      history: "Synthetic referral.",
    });
  }, [dispatch]);
  return null;
}

function LatestReferral({
  children,
}: {
  children: (referral: ReturnType<typeof useWardFlow>["referrals"][number]) => ReactNode;
}) {
  const { referrals } = useWardFlow();
  const referral = referrals.at(-1);
  return referral ? <>{children(referral)}</> : null;
}

describe("URE-02: Send notice", () => {
  it("sends one notice per tap until the answer arrives, and reports a thrown send", async () => {
    const state = seedWardFlowStateAt(0);
    const release = state.bedReleases.find((candidate) => candidate.state === "expected")!;
    const pending = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => pending.promise);
    const onFailure = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Shared dispatch={dispatch}>
          <WardDischargeNotices
            bedLabel="Bed 1"
            dueSoonHours={null}
            onClose={() => {}}
            recorded={{ release, actingUnitId: release.unitId, onFailure }}
          />
        </Shared>
      </WardFlowProvider>,
    );
    const card = screen.getByTestId("ward-discharge-notices");
    const pharmacy = () => within(card).getAllByRole("button")[0]!;
    fireEvent.click(pharmacy());
    fireEvent.click(pharmacy());
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(pharmacy()).toHaveAttribute("aria-disabled", "true");
    expect(pharmacy()).toHaveTextContent("Sending notice");

    await act(async () => pending.fail(new Error("network")));
    expect(onFailure).toHaveBeenCalledWith("Save is not confirmed. Review the board before trying again.");
    expect(pharmacy()).toHaveTextContent("Send notice");
    fireEvent.click(pharmacy());
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});

describe("URE-05: correction note", () => {
  beforeEach(() => {
    pathname = "/ward-flow/referrals";
  });

  it("keeps the typed correction and says why when the shared answer is failed", async () => {
    const dispatch = vi.fn<WardCommandDispatch>(() => Promise.resolve(FAILED));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Refer />
        <Shared dispatch={dispatch}>
          <LatestReferral>
            {(referral) => <ReferralHistoryAndCorrections referral={referral} now={NOW_ANCHOR} />}
          </LatestReferral>
        </Shared>
      </WardFlowProvider>,
    );
    const note = screen.getByTestId("ward-referral-correction-note") as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: "Synthetic correction." } });
    await act(async () => fireEvent.click(screen.getByTestId("ward-referral-add-correction")));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(note.value).toBe("Synthetic correction.");
    expect(screen.getByTestId("ward-referral-correction-failure")).toHaveTextContent("Save is not confirmed");
  });

  it("clears the note once the correction is accepted", async () => {
    const dispatch = vi.fn<WardCommandDispatch>(() => Promise.resolve({ commandId: "c-2", status: "accepted" }));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Refer />
        <Shared dispatch={dispatch}>
          <LatestReferral>
            {(referral) => <ReferralHistoryAndCorrections referral={referral} now={NOW_ANCHOR} />}
          </LatestReferral>
        </Shared>
      </WardFlowProvider>,
    );
    const note = screen.getByTestId("ward-referral-correction-note") as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: "Synthetic correction." } });
    await act(async () => fireEvent.click(screen.getByTestId("ward-referral-add-correction")));
    expect(note.value).toBe("");
    expect(screen.queryByTestId("ward-referral-correction-failure")).toBeNull();
  });
});

describe("URE-05: call log", () => {
  beforeEach(() => {
    pathname = "/ward-flow/referrals";
  });

  it("keeps who was rung and what they said when the shared answer is cancelled", async () => {
    const dispatch = vi.fn<WardCommandDispatch>(() =>
      Promise.resolve({ commandId: "c-3", status: "cancelled", message: "The shared board is not ready." }),
    );
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Refer />
        <Shared dispatch={dispatch}>
          <LatestReferral>
            {(referral) => <ReferralOwnerAndCalls referral={referral} now={NOW_ANCHOR + 40} />}
          </LatestReferral>
        </Shared>
      </WardFlowProvider>,
    );
    const who = screen.getByRole("combobox", { name: "Who was rung" }) as HTMLSelectElement;
    const said = screen.getByRole("combobox", { name: "What they said" }) as HTMLSelectElement;
    fireEvent.change(who, { target: { value: `ward:${WARD.id}` } });
    fireEvent.change(said, { target: { value: "said_yes" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Log a call" })));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(who.value).toBe(`ward:${WARD.id}`);
    expect(said.value).toBe("said_yes");
    expect(screen.getByRole("alert")).toHaveTextContent("The shared board is not ready.");
  });
});

describe("URE-07: opened receipts", () => {
  beforeEach(() => {
    pathname = `/ward-flow/ward/${WARD.id}`;
  });

  function entry(id: string): WardReferralInboxEntry {
    return { id, state: "queued" } as unknown as WardReferralInboxEntry;
  }

  it("does not send a receipt again while the first is still in flight", () => {
    const dispatch = vi.fn<WardCommandDispatch>(() => new Promise<WardCommandOutcome>(() => {}));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Shared dispatch={dispatch}>{children}</Shared>
      </WardFlowProvider>
    );
    const { rerender } = renderHook(
      ({ entries }: { entries: WardReferralInboxEntry[] }) => useMarkReferralsOpened(entries, WARD.id, WARD.id),
      { wrapper, initialProps: { entries: [entry("RF-A")] } },
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    rerender({ entries: [entry("RF-A"), entry("RF-B")] });
    const opened = dispatch.mock.calls.map(
      ([event]) => (event as Extract<WardFlowEvent, { type: "MARK_REFERRAL_OPENED" }>).referralId,
    );
    expect(opened).toEqual(["RF-A", "RF-B"]);
  });
});
