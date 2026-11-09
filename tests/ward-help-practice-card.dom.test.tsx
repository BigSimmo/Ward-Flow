import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setPracticeSession } from "@/components/ward-management/demo-reset/ward-practice-session";
import { WardHelpPracticeCard, PRACTICE_SHOW_ME } from "@/components/ward-management/help/ward-help-practice-card";
import { HOW_TO_IDS } from "@/components/ward-management/help/ward-help-howto";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Passes every event on to the real provider, and to `seen`, under an optional shared or demo-off override. */
function Harness({
  seen,
  sharedOn = false,
  demoOff = false,
  children,
}: {
  seen: (event: WardFlowEvent) => void;
  sharedOn?: boolean;
  demoOff?: boolean;
  children: ReactNode;
}) {
  const value = useWardFlow();
  const next = {
    ...value,
    dispatch: (event: WardFlowEvent) => {
      seen(event);
      return value.dispatch(event);
    },
    ...(sharedOn ? { shared: { enabled: true, status: "ready" as const, error: null } } : {}),
    ...(demoOff ? { demoControlsAvailable: false } : {}),
  };
  return <WardFlowOverride value={next}>{children}</WardFlowOverride>;
}

function renderCard(options: { sharedOn?: boolean; demoOff?: boolean; showMeOn?: boolean } = {}) {
  const seen = vi.fn();
  const onShowMe = vi.fn();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness seen={seen} {...options}>
        <WardHelpPracticeCard role="coordinator" onShowMe={onShowMe} showMeOn={options.showMeOn ?? true} />
      </Harness>
    </WardFlowProvider>,
  );
  return { seen, onShowMe };
}

afterEach(() => {
  act(() => setPracticeSession(null));
});

describe("practice inside Help", () => {
  it("maps each practice step to a how-to that exists, and arrival to none", () => {
    for (const id of Object.values(PRACTICE_SHOW_ME)) if (id) expect(HOW_TO_IDS.has(id), id).toBe(true);
    expect(PRACTICE_SHOW_ME.arrive).toBeUndefined();
  });

  it("starts, shows the next step's how and its Show me, and stops", () => {
    const { onShowMe } = renderCard();
    expect(screen.getByText("Six steps, from bed request to arrival.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-help-practice-start"));
    expect(screen.getByTestId("ward-help-practice-steps")).toBeInTheDocument();
    expect(screen.getByText("Waiting for a new bed request.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-help-practice-show-me"));
    expect(onShowMe).toHaveBeenCalledWith("new-referral");
    fireEvent.click(screen.getByTestId("ward-help-practice-stop"));
    expect(screen.getByTestId("ward-help-practice-start")).toBeInTheDocument();
  });

  it("offers no Show me when the Show me switch is off (PR #1299 review)", () => {
    renderCard({ showMeOn: false });
    fireEvent.click(screen.getByTestId("ward-help-practice-start"));
    expect(screen.queryByTestId("ward-help-practice-show-me")).toBeNull();
  });

  it("asks before Reset practice, then reloads the current scenario and starts afresh", () => {
    const { seen } = renderCard();
    fireEvent.click(screen.getByTestId("ward-help-practice-start"));
    fireEvent.click(screen.getByTestId("ward-help-practice-reset"));
    const confirm = screen.getByTestId("ward-help-practice-confirm");
    expect(confirm).toHaveTextContent(
      "Put the demo data back to how it was? This changes the demo data in this browser only. Other devices are not changed. There is no undo.",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("ward-help-practice-confirm")).toBeNull();
    expect(seen).not.toHaveBeenCalledWith(expect.objectContaining({ type: "SET_SCENARIO" }));

    fireEvent.click(screen.getByTestId("ward-help-practice-reset"));
    fireEvent.click(screen.getByTestId("ward-help-practice-confirm-reset"));
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ type: "SET_SCENARIO", role: "demo" }));
    // The reload is a new demo generation, which ends the old session; a fresh one runs instead.
    expect(screen.getByTestId("ward-help-practice-steps")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-help-practice-start")).toBeNull();
  });

  it("disables Reset practice with the existing reason when demo controls are off", () => {
    renderCard({ demoOff: true });
    fireEvent.click(screen.getByTestId("ward-help-practice-start"));
    // Unavailable but still focusable, so a keyboard user can read why (AUD-A11Y-02).
    expect(screen.getByTestId("ward-help-practice-reset")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("ward-help-practice-reset-off")).toHaveTextContent(
      "Demo controls are switched off on the shared workspace. Nothing will change.",
    );
  });

  it("is off in the shared workspace and offers only Start training (feature 47)", () => {
    renderCard({ sharedOn: true });
    expect(screen.getByTestId("ward-help-practice-shared-off")).toHaveTextContent(
      "Practice is off in the shared workspace, where every step is saved for everyone. Start training to practise on synthetic patients that nobody else sees.",
    );
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Start training"]);
    expect(screen.getByTestId("ward-help-training-start")).toBeInTheDocument();
  });
});
