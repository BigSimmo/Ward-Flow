import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardOfflineBanner } from "@/components/ward-management/shell/ward-offline-banner";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { WARD_OFFLINE_SAVED_NOTE } from "@/components/ward-management/ward-offline-copy";
import { ROLE_SCREENS } from "@/components/ward-management/ward-role-access";

// Design audit, 19 October 2026: the fixes that live in logic or markup, one check each.

afterEach(() => vi.restoreAllMocks());

describe("bed meeting TV access (Josh, 19 Oct 2026)", () => {
  it("opens to ward desks, which attend the meeting, and stays closed to ED desks", () => {
    expect(ROLE_SCREENS.ward["bed-meeting"]).toBe("own");
    expect(ROLE_SCREENS.ed["bed-meeting"]).toBeUndefined();
  });
});

describe("offline notice in full screen (DA-07)", () => {
  it("moves inside the element shown full screen, so the TV still says it is offline", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const tv = document.createElement("main");
    document.body.append(tv);
    render(<WardOfflineBanner />);
    expect(tv).not.toContainElement(screen.getByTestId("ward-offline-banner"));
    // jsdom has no Fullscreen API, so the property is defined for this test and removed after.
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => tv });
    try {
      act(() => {
        document.dispatchEvent(new Event("fullscreenchange"));
      });
      expect(tv).toContainElement(screen.getByTestId("ward-offline-banner"));
    } finally {
      Reflect.deleteProperty(document, "fullscreenElement");
      tv.remove();
    }
  });
});

describe("offline note in the local demonstration (DA-35)", () => {
  it("does not suggest a later send that never happens", () => {
    expect(WARD_OFFLINE_SAVED_NOTE).toBe("Saved on this device only.");
    expect(WARD_OFFLINE_SAVED_NOTE).not.toMatch(/sent/i);
  });
});

describe("record document dialog colours (DA-03)", () => {
  it("uses only theme colours that exist in light and dark", () => {
    const source = readFileSync("src/components/ward-management/referrals/upload-forms-modal.tsx", "utf8");
    expect(source).not.toMatch(/var\(--ward-/u);
  });
});

describe("departure confirmation (DA-08)", () => {
  it("shows a second identifier beside the name before the departure is recorded", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="arm-adult-open" requireConfirmation={true} />
      </WardFlowProvider>,
    );
    const leave = screen.getAllByRole("button", { name: "They have left" });
    expect(leave.length, "the seed must offer a departure on this ward").toBeGreaterThan(0);
    fireEvent.click(leave[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTestId("ward-board-confirm-identity").textContent).toMatch(/^Check: .+ · .+/u);
  });

  it("shows the same second identifier on the emergency department transfer confirm", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="arm-adult-open" requireConfirmation={true} />
      </WardFlowProvider>,
    );
    const beds = screen.getByTestId("ward-board-beds");
    const occupied = within(beds)
      .getAllByRole("listitem")
      .filter((tile) => tile.getAttribute("data-bed-kind") === "occupied");
    // Open occupied beds until one offers the ED transfer (one already away at ED does not).
    let away: HTMLElement | null = null;
    for (const tile of occupied) {
      fireEvent.click(within(tile).getByRole("button"));
      away = screen.queryByTestId("ward-board-record-away-submit");
      if (away) break;
    }
    expect(away, "the seed must offer an ED transfer on this ward").not.toBeNull();
    fireEvent.click(away!);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/has gone to an emergency/u)).toBeInTheDocument();
    expect(within(dialog).getByTestId("ward-board-confirm-identity").textContent).toMatch(/^Check: .+ · .+/u);
  });
});
