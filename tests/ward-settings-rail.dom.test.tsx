import { act, render, screen } from "@testing-library/react";
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
import { setRailOpenPreference } from "@/components/ward-management/shell/ward-rail-preferences";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider } from "@/components/wf";

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
    <ToastProvider>
      <WardFlowProvider>
        <SettingsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

afterEach(() => {
  // Leave the store as found — it is a real `localStorage` shared with every later test.
  setRailOpenPreference(true);
  window.localStorage.clear();
});

describe("the settings screen's rail control", () => {
  // Audit two #68 (r10): the Sidebar row (Full or Compact) left Settings; the rail's own control is the
  // only door. The four cases that drove the Settings row went with it, replaced by these two, which
  // keep the shared-store claim: Settings must not carry a second writer or a stale readout.
  it("no longer offers a Sidebar row, so nothing on this screen can write a second rail state", () => {
    setRailOpenPreference(true);
    renderSettings();
    expect(screen.queryByTestId("ward-settings-rail")).toBeNull();
    expect(screen.queryByTestId("ward-settings-rail-now")).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Sidebar" })).toBeNull();
  });

  it("leaves the shared rail state alone, and a change made elsewhere still stands", () => {
    setRailOpenPreference(false);
    renderSettings();
    expect(window.localStorage.getItem("ward-flow-rail"), "opening Settings changed the rail").toBe("closed");
    expect(window.localStorage.getItem("ward-flow-settings-rail"), "a second key was written").toBeNull();
    // ⚠️ `act` because this write originates OUTSIDE React, as the rail's own control's would.
    act(() => setRailOpenPreference(true));
    expect(screen.queryByTestId("ward-settings-rail-now")).toBeNull();
    expect(window.localStorage.getItem("ward-flow-settings-rail")).toBeNull();
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
