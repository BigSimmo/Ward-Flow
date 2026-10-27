import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/*
 * H-0117 (audit SM2-03): a community team's decline keeps its reason, and its form or sheet stays
 * open, until the decline is accepted, and says why beside the control when it is not. Synthetic
 * seed data only.
 */

type Mode = "failed" | "refused" | "accepted";
const FAILED_SAYS = "Save is not confirmed. Press Retry when you are back online. It will not be saved twice.";
const REFUSED_SAYS = "This record changed while you were looking. Your action was not applied.";
const SAYS: Record<Exclude<Mode, "accepted">, RegExp> = {
  failed: /Save is not confirmed\. Press Retry when you are back online/u,
  refused: /Not recorded: This record changed while you were looking/u,
};
const TEAM = communityTeamById("midland")!;

function outcomeFor(mode: Exclude<Mode, "accepted">): Promise<WardCommandOutcome> {
  return Promise.resolve(
    mode === "failed"
      ? { commandId: "c-1", status: "failed", message: FAILED_SAYS }
      : { commandId: "c-1", status: "refused", message: REFUSED_SAYS },
  );
}

/** The provider's own engine, except that a decline answers as `mode` says. */
function Answering({ mode, calls, children }: { mode: Mode; calls: WardFlowEvent[]; children: ReactNode }) {
  const flow = useWardFlow();
  const dispatch: WardCommandDispatch = (event) => {
    if (event.type !== "DECLINE_REFERRAL") return flow.dispatch(event);
    calls.push(event);
    return mode === "accepted" ? flow.dispatch(event) : outcomeFor(mode);
  };
  return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
}

function ReceiveForTeam() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      hidden
      data-testid="fixture-receive-for-team"
      onClick={() =>
        dispatch({
          type: "RECEIVE_REFERRAL",
          role: "community",
          now,
          ageBand: "Adult",
          destinations: [{ kind: "community_team", teamName: TEAM.name }],
          homeRegion: "Perth Metropolitan",
          suburb: { kind: "unknown", reason: "not_known" },
          source: "community",
          urgency: 2,
          originSiteCode: "SCGH",
          transportNeeded: false,
          history: "",
        })
      }
    />
  );
}

function renderTeam(mode: Mode) {
  const calls: WardFlowEvent[] = [];
  render(
    <ToastProvider>
      <WardFlowProvider>
        <ReceiveForTeam />
        <Answering mode={mode} calls={calls}>
          <CommunityScreen teamId={TEAM.id} />
        </Answering>
      </WardFlowProvider>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByTestId("fixture-receive-for-team"));
  return calls;
}

async function press(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("H-0117 community decline keeps its reason until accepted", () => {
  it.each(["failed", "refused", "accepted"] as const)("desktop waiting list, %s", async (mode) => {
    const calls = renderTeam(mode);
    fireEvent.click(screen.getByRole("tab", { name: /Waiting/u }));
    const panel = screen.getByTestId("ward-community-waiting");
    fireEvent.click(within(panel).getByRole("button", { name: /decline referral/i }));
    fireEvent.change(within(panel).getByRole("combobox"), { target: { value: "outside_the_teams_catchment" } });
    await press(within(panel).getByRole("button", { name: /confirm decline/i }));
    expect(calls).toHaveLength(1);
    if (mode === "accepted") {
      expect(within(panel).getByTestId("ward-community-waiting-empty")).toBeInTheDocument();
      expect(document.querySelector("[data-testid^='ward-community-decline-failure-']")).toBeNull();
      return;
    }
    expect(within(panel).getByRole("combobox")).toHaveValue("outside_the_teams_catchment");
    expect(document.querySelector("[data-testid^='ward-community-decline-failure-']")?.textContent).toMatch(SAYS[mode]);
  });

  it.each(["failed", "refused", "accepted"] as const)("phone sheet, %s", async (mode) => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === WF_PHONE_QUERY,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const calls = renderTeam(mode);
    fireEvent.click(screen.getByRole("radio", { name: /^Waiting/u }));
    fireEvent.click(within(screen.getByTestId("ward-community-phone-list-waiting")).getAllByRole("button")[0]!);
    const sheet = screen.getByTestId("ward-community-phone-referral");
    fireEvent.click(within(sheet).getByRole("button", { name: "Decline" }));
    const reason = within(sheet).getAllByRole("radio")[0]!;
    fireEvent.click(reason);
    await press(within(sheet).getByRole("button", { name: /Decline referral/u }));
    expect(calls).toHaveLength(1);
    if (mode === "accepted") {
      expect(screen.queryByTestId("ward-community-phone-referral")).toBeNull();
      return;
    }
    expect(screen.getByTestId("ward-community-phone-referral")).toBeInTheDocument();
    expect(reason).toBeChecked();
    expect(screen.getByTestId("ward-community-phone-decline-failure").textContent).toMatch(SAYS[mode]);
  });
});
