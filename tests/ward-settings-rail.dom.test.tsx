import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { setRailOpenPreference } from "@/components/ward-management/shell/ward-rail";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * 🔴 **THE RAIL TOGGLE — AND THE DRAWING HAS THE STORAGE KEY RIGHT, WHICH IS WHY THIS ONE IS THE
 * MORE INSTRUCTIVE OF THE TWO CONTROLS.**
 *
 * The appearance control was blocked by a wrong key in the drawing's own script. **This one is not:
 * the drawing writes `ward-flow-rail`, which is exactly what `shell/ward-rail.tsx` uses.** ⚠️ **And
 * building it from the drawing's script would STILL have been wrong**, because the key was never the
 * hard part.
 *
 * 🔴 **`setRailOpenPreference` ends by dispatching `ward-flow-rail-change`. A second writer on the
 * correct key that omits that dispatch moves the rail on THIS page and leaves the rail itself showing
 * its old state until a reload** — with the stored value correct underneath and nothing rendering
 * wrong. **Two controls disagreeing inside one session is harder to see than a wrong value, and no
 * key-based guard can catch it.**
 *
 * ✅ **So the assertions below are about the SHARED STORE, not about this screen's own state:** the
 * value is read back through the real key, and the readout follows a change made from anywhere else.
 */

function renderSettings() {
  render(
    <WardFlowProvider>
      <SettingsScreen />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  // Leave the store as found — it is a real `localStorage` shared with every later test.
  setRailOpenPreference(true);
  window.localStorage.clear();
});

describe("the settings screen's rail control", () => {
  it("offers one button, whose words say what pressing it will do", () => {
    setRailOpenPreference(true);
    renderSettings();
    const panel = screen.getByTestId("ward-settings-rail");

    const button = within(panel).getByRole("button");
    expect(button.textContent, "an open rail should offer to close it").toMatch(/close the rail/i);
  });

  it("writes the real rail state, not a second one of its own", () => {
    setRailOpenPreference(true);
    renderSettings();

    fireEvent.click(within(screen.getByTestId("ward-settings-rail")).getByRole("button"));

    expect(window.localStorage.getItem("ward-flow-rail"), "the real key was not written").toBe("closed");
    expect(window.localStorage.getItem("ward-flow-settings-rail"), "a second key was written").toBeNull();
  });

  it("reverses its own offer once the rail is closed", () => {
    setRailOpenPreference(true);
    renderSettings();
    const panel = screen.getByTestId("ward-settings-rail");

    fireEvent.click(within(panel).getByRole("button"));

    expect(within(screen.getByTestId("ward-settings-rail")).getByRole("button").textContent).toMatch(/open the rail/i);
  });

  /**
   * 🔴 **THE ASSERTION NO KEY-BASED GUARD CAN MAKE.** Driven by calling the REAL writer directly —
   * which is what the rail's own control does — so a screen holding its own `useState` shows a stale
   * word here even though its storage is correct.
   */
  it("follows a change made from anywhere else", () => {
    setRailOpenPreference(true);
    renderSettings();
    expect(screen.getByTestId("ward-settings-rail").textContent).toMatch(/open/i);

    // ⚠️ `act` because this write originates OUTSIDE React, exactly as the rail's own control's
    // would from another component tree. It flushes the pending update; it does not weaken the
    // claim, which is that the readout follows the SHARED store rather than local state.
    act(() => setRailOpenPreference(false));

    expect(
      screen.getByTestId("ward-settings-rail").textContent,
      "the readout did not follow a change made outside this screen",
    ).toMatch(/closed/i);
  });

  /**
   * ⚠️ **THE "NOT ON THIS SCREEN YET" PANEL MUST NOW BE GONE ENTIRELY.** Both controls it apologised
   * for exist. 🔴 **A screen explaining the absence of two controls it renders is the stale-copy
   * defect twice over**, and it would read as an unfinished page to anybody who opened it.
   */
  it("no longer carries the panel that explained what was missing", () => {
    renderSettings();
    expect(screen.queryByTestId("ward-settings-not-yet-here")).toBeNull();
  });
});
