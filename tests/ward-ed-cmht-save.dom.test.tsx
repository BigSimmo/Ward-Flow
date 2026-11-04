import "@testing-library/jest-dom/vitest";
import { act, cleanup, configure, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { chooseEdChoice, edChoiceOptions, edChoiceValue } from "./helpers/ed-raise-into-movement";

// A failed query must still fail, without copying a synthetic record's DOM into test logs.
configure({ getElementError: () => new Error("CMHT save query failed; record-bearing diagnostics suppressed.") });

const ID = "WF-001";
let recordCommunityReferral: WardCommandDispatch;

function ReceiptBoundary({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  const dispatch: WardCommandDispatch = (event) =>
    event.type === "REFER_TO_COMMUNITY_TEAM" ? recordCommunityReferral(event) : value.dispatch(event);
  return (
    <WardFlowOverride
      value={{
        ...value,
        dispatch,
        shared: { enabled: true, status: "ready", error: null },
        // A referring ED does not get the coordinator's event log. Its own receipt must suffice.
        eventLog: [],
      }}
    >
      {children}
    </WardFlowOverride>
  );
}

function openCommunityReferral() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReceiptBoundary>
        <EdScreen edId="arm-ed" />
      </ReceiptBoundary>
    </WardFlowProvider>,
  );
  // Use the real prerequisite control rather than manufacturing an eligible row.
  fireEvent.click(screen.getByTestId(`ward-ed-examine-toggle-${ID}`));
  fireEvent.click(screen.getByRole("radio", { name: "Inpatient treatment order" }));
  fireEvent.click(screen.getByRole("button", { name: "Save outcome" }));
  fireEvent.click(screen.getByTestId(`ed-refer-cmht-${ID}`));
  const team = screen.getByTestId(`ward-ed-cmht-select-${ID}`);
  const chosenTeam = edChoiceOptions(`ward-ed-cmht-select-${ID}`)[0]?.value ?? "";
  expect(chosenTeam).toBeTruthy();
  chooseEdChoice(`ward-ed-cmht-select-${ID}`, chosenTeam);
  fireEvent.click(screen.getByTestId(`ward-ed-cmht-purpose-follow_up-${ID}`));
  return { chosenTeam, team };
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

describe("ED CMHT referral confirmation", () => {
  it("keeps the selected team and purpose while pending and after its command is refused", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    const completion = new Promise<WardCommandOutcome>((answer) => {
      resolve = answer;
    });
    recordCommunityReferral = vi.fn<WardCommandDispatch>(() => completion);
    const { chosenTeam } = openCommunityReferral();
    fireEvent.click(screen.getByTestId(`ward-ed-cmht-confirm-${ID}`));

    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).not.toBeNull();
    expect(edChoiceValue(`ward-ed-cmht-select-${ID}`)).toBe(chosenTeam);
    expect(screen.getByTestId(`ward-ed-cmht-purpose-follow_up-${ID}`)).toBeChecked();
    expect(screen.getByTestId(`ward-ed-cmht-confirm-${ID}`)).toHaveAccessibleDescription("Saving change…");

    await act(async () => {
      resolve({ commandId: "synthetic-cmht-save", status: "refused", message: "Synthetic refusal." });
    });
    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).not.toBeNull();
    expect(edChoiceValue(`ward-ed-cmht-select-${ID}`)).toBe(chosenTeam);
    expect(screen.getByTestId(`ward-ed-cmht-purpose-follow_up-${ID}`)).toBeChecked();
    expect(screen.getByTestId(`ward-ed-cmht-panel-${ID}`)).toHaveTextContent("Not recorded: Synthetic refusal.");
  });
  it("blocks duplicate pending submits and closes only on its accepted receipt", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    recordCommunityReferral = vi.fn<WardCommandDispatch>(
      () =>
        new Promise<WardCommandOutcome>((answer) => {
          resolve = answer;
        }),
    );
    openCommunityReferral();
    const save = screen.getByTestId(`ward-ed-cmht-confirm-${ID}`);
    fireEvent.click(save);
    fireEvent.click(save);
    expect(recordCommunityReferral).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).not.toBeNull();
    await act(async () => {
      resolve({ commandId: "synthetic-save", status: "accepted" });
    });
    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).toBeNull();
  });

  it("keeps a rejected promise's choices available for another attempt", async () => {
    recordCommunityReferral = vi.fn<WardCommandDispatch>(() => Promise.reject(new Error("Synthetic failure")));
    openCommunityReferral();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`ward-ed-cmht-confirm-${ID}`));
    });
    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).not.toBeNull();
    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).toHaveTextContent(/not confirmed/iu);
  });

  it("keeps the form and its choices while held, then closes on the accepted receipt", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    recordCommunityReferral = vi.fn<WardCommandDispatch>(
      () =>
        new Promise<WardCommandOutcome>((answer) => {
          resolve = answer;
        }),
    );
    const { chosenTeam } = openCommunityReferral();
    fireEvent.click(screen.getByTestId(`ward-ed-cmht-confirm-${ID}`));
    // Cancel cannot discard a referral whose outcome is still unknown.
    fireEvent.click(screen.getByTestId(`ward-ed-cmht-cancel-${ID}`));
    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).not.toBeNull();
    expect(edChoiceValue(`ward-ed-cmht-select-${ID}`)).toBe(chosenTeam);
    await act(async () => {
      resolve({ commandId: "synthetic-held-save", status: "accepted" });
    });
    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).toBeNull();
  });

  it("keeps an uncertain command locked until its original-id Retry confirms acceptance", async () => {
    let confirm!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((answer) => {
      confirm = answer;
    });
    recordCommunityReferral = vi.fn<WardCommandDispatch>(() => ({
      commandId: "synthetic-retry",
      status: "failed",
      confirmation,
    }));
    openCommunityReferral();
    fireEvent.click(screen.getByTestId(`ward-ed-cmht-confirm-${ID}`));
    fireEvent.click(screen.getByTestId(`ward-ed-cmht-confirm-${ID}`));
    expect(recordCommunityReferral).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).not.toBeNull();
    await act(async () => {
      confirm({ commandId: "synthetic-retry", status: "accepted" });
    });
    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).toBeNull();
  });

  it("a receipt from an ended workspace cannot close this form", async () => {
    recordCommunityReferral = vi.fn<WardCommandDispatch>(() => ({
      commandId: "synthetic-stale",
      status: "accepted",
      isCurrent: () => false,
    }));
    openCommunityReferral();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`ward-ed-cmht-confirm-${ID}`));
    });
    expect(screen.queryByTestId(`ward-ed-cmht-panel-${ID}`)).not.toBeNull();
  });
});
