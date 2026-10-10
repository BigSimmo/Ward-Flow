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

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { applyAppearance, applyGlare } from "@/components/ward-management/shell/ward-bar";
import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { APP_THEME_COLORS, GLARE_STORAGE_KEY } from "@/lib/theme";

/**
 * 🔴 **THE APPEARANCE CONTROL, AND THE WHOLE REASON IT WAITED: IT MUST WRITE THE STATE THAT ALREADY
 * EXISTS, NOT A SECOND ONE THAT LOOKS LIKE IT.**
 *
 * The approved drawing scripts this control against `localStorage["ward-flow-settings-appearance"]`.
 * The control that is really built and really wired uses the app's one theme preference
 * (`"clinical-kb-theme"`, owned by `src/lib/theme-client.ts`). ⚠️ **Built as scripted, the two would
 * silently diverge — while the drawing's own copy tells the reader "changing it here changes it there
 * too".**
 *
 * 🔴 **AND THE SUBTLER HALF SURVIVES GETTING THE KEY RIGHT.** The one writer ends by dispatching
 * `clinical-kb-theme-change`; a second writer on the correct key that omits that dispatch updates
 * its own screen and leaves the Tools control showing the old value until a reload. **Two controls
 * disagreeing inside one session with the stored value correct underneath.**
 *
 * ✅ **So this suite does not assert "the button wrote something". It asserts THE SAME OWNER — that
 * the value this screen writes is the one the real store reads back, and that the real applier's own
 * effects are what happened.** `tests/ward-one-appearance-key.test.ts` guards the key half by
 * parsing ward source for a second key; this guards the writer half behaviourally.
 */

function renderSettings() {
  render(
    <WardFlowProvider>
      <SettingsScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("radio", { name: /^Display/ }));
}

function themeAttribute(): string | null {
  return document.documentElement.getAttribute("data-theme");
}

afterEach(() => {
  // Leave the document as we found it — this store writes to a real `documentElement` and a real
  // `localStorage`, both shared by every test in this file and every file after it.
  applyAppearance("auto");
  applyGlare(false);
  window.localStorage.clear();
});

describe("the settings screen's appearance control", () => {
  it("offers the three choices the drawing names", () => {
    renderSettings();
    const panel = screen.getByTestId("ward-settings-appearance");

    for (const name of ["Light", "Dark", "Auto"]) {
      expect(within(panel).getByRole("radio", { name }), `no ${name} control`).toBeInTheDocument();
    }
  });

  /**
   * 🔴 **THE TEST THAT EARNS THE CONTROL.** It reads back through the REAL storage key, not through
   * anything this screen knows about — so a screen that invented its own key passes nothing here.
   */
  it("writes the real appearance state, not a second one of its own", () => {
    renderSettings();
    const panel = screen.getByTestId("ward-settings-appearance");

    fireEvent.click(within(panel).getByRole("radio", { name: "Dark" }));

    expect(window.localStorage.getItem("clinical-kb-theme"), "the real key was not written").toBe("dark");
    expect(window.localStorage.getItem("ward-flow-settings-appearance"), "a second key was written").toBeNull();
    expect(window.localStorage.getItem("ward-flow-appearance"), "the retired ward key was written").toBeNull();
    expect(themeAttribute(), "the theme the whole app branches on did not change").toBe("dark");
    expect(
      document.documentElement.classList.contains("dark"),
      "the legacy layers were left on the other theme (one switch)",
    ).toBe(true);
  });

  it("moves the .dark class with the choice, so both theme layers agree", () => {
    renderSettings();
    const panel = screen.getByTestId("ward-settings-appearance");
    const root = document.documentElement;

    fireEvent.click(within(panel).getByRole("radio", { name: "Dark" }));
    expect(themeAttribute()).toBe("dark");
    expect(root.classList.contains("dark"), ".dark missing with Dark chosen").toBe(true);
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
    act(() => applyAppearance("dark"));
    expect(meta.content, "browser chrome colour drifted from the app theme").toBe(APP_THEME_COLORS.dark);
    meta.remove();

    fireEvent.click(within(panel).getByRole("radio", { name: "Light" }));
    expect(themeAttribute()).toBe("light");
    expect(root.classList.contains("dark"), ".dark left on with Light chosen").toBe(false);
  });

  /**
   * ✅ **ONE APP-WIDE THEME.** The ward used to hand the root back on unmount because its pin was
   * ward-only. With one key for the whole app, a page outside Ward Flow shows the same choice, so
   * unmounting the shell must keep it.
   */
  it("keeps the one app-wide theme when the ward shell unmounts", () => {
    const { unmount } = render(
      <WardFlowProvider>
        <WardRail />
      </WardFlowProvider>,
    );
    act(() => applyAppearance("dark"));
    expect(themeAttribute()).toBe("dark");

    unmount();
    expect(themeAttribute(), "leaving Ward Flow dropped the app-wide theme").toBe("dark");
  });

  /**
   * ⚠️ **AUTO IS AN ABSENCE, NOT A VALUE, AND THE REAL APPLIER KNOWS THAT.** It REMOVES the stored
   * key and the `data-theme` attribute rather than storing the word "auto" — because "follow the
   * system" is the state of having chosen nothing. 🔴 **A re-implementation would almost certainly
   * store `"auto"`, and every screen reading `data-theme` would then see a theme named auto rather
   * than no theme at all.** This is the assertion that catches a copy.
   */
  it("treats Auto as removing the choice, which is what the real applier does", () => {
    renderSettings();
    const panel = screen.getByTestId("ward-settings-appearance");

    fireEvent.click(within(panel).getByRole("radio", { name: "Light" }));
    expect(window.localStorage.getItem("clinical-kb-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark"), "a light pin left .dark on").toBe(false);

    fireEvent.click(within(panel).getByRole("radio", { name: "Auto" }));
    expect(window.localStorage.getItem("clinical-kb-theme"), "auto was stored as a value").toBeNull();
    expect(themeAttribute(), "data-theme survived a return to auto").toBeNull();
  });

  /**
   * 🔴 **THE READOUT MUST FOLLOW THE STORE, INCLUDING WHEN SOMETHING ELSE WRITES IT.** The Tools
   * drawer is the other writer; if this screen rendered from its own `useState` it would show a
   * stale word the moment that one was used. ⚠️ **Driven here by calling the REAL applier directly,
   * which is exactly what the other control does.**
   */
  it("shows the current choice, and follows a change made from anywhere else", () => {
    renderSettings();
    const panel = screen.getByTestId("ward-settings-appearance");
    expect(within(panel).getByRole("radio", { name: "Auto" }).getAttribute("aria-checked")).toBe("true");

    // `act` for the same reason as the rail suite: the write originates outside React.
    act(() => applyAppearance("dark"));

    expect(
      within(screen.getByTestId("ward-settings-appearance"))
        .getByRole("radio", { name: "Dark" })
        .getAttribute("aria-checked"),
      "the readout did not follow the store",
    ).toBe("true");
  });

  /**
   * ⚠️ **The current choice is marked on the control itself, not only in a sentence.** A readout
   * that says "Dark" beside three buttons none of which look chosen is a state a reader has to hold
   * in their head.
   */
  it("marks the chosen option as checked", () => {
    renderSettings();
    const panel = screen.getByTestId("ward-settings-appearance");

    fireEvent.click(within(panel).getByRole("radio", { name: "Dark" }));

    expect(within(panel).getByRole("radio", { name: "Dark" }).getAttribute("aria-checked")).toBe("true");
    expect(within(panel).getByRole("radio", { name: "Light" }).getAttribute("aria-checked")).toBe("false");
  });

  /**
   * 🔴 **THIS CASE WAS VACUOUS FOR ONE COMMIT AND I AM RECORDING THAT RATHER THAN QUIETLY FIXING IT.**
   * It read *"no longer says appearance is missing"* and began `if (notYet === null) return;` — a
   * guard written while the panel still existed for the rail's sake. The moment the rail control
   * landed the panel went, the early return fired on every run, and **the test asserted nothing while
   * reporting green.** ⚠️ **A conditional skip is how a test stops testing without ever going red.**
   */
  it("renders the appearance control and no apology for its absence", () => {
    renderSettings();
    expect(screen.getByTestId("ward-settings-appearance")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-settings-not-yet-here"), "the screen apologises for a control it has").toBeNull();
  });
});

describe("the settings screen's Glare mode switch", () => {
  function glareSwitch() {
    return within(screen.getByTestId("ward-settings-glare")).getByRole("switch", { name: "Glare mode" });
  }

  it("sits beside the theme control with its plain hint", () => {
    renderSettings();
    const row = screen.getByTestId("ward-settings-glare");
    expect(within(row).getAllByText("Glare mode").length, "no visible Glare mode label").toBeGreaterThan(0);
    expect(within(row).getByText("Stronger contrast for bright rooms")).toBeInTheDocument();
    expect(screen.getByTestId("ward-settings-appearance").nextElementSibling).toBe(row);
    expect(glareSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("turns Glare mode on and off through its own key, leaving the theme alone", () => {
    renderSettings();
    fireEvent.click(within(screen.getByTestId("ward-settings-appearance")).getByRole("radio", { name: "Dark" }));

    fireEvent.click(glareSwitch());
    expect(document.documentElement.getAttribute("data-mode"), "Glare did not reach the root").toBe("glare");
    expect(window.localStorage.getItem(GLARE_STORAGE_KEY)).toBe("on");
    expect(glareSwitch().getAttribute("aria-checked")).toBe("true");
    expect(window.localStorage.getItem("clinical-kb-theme"), "Glare changed the theme choice").toBe("dark");

    fireEvent.click(glareSwitch());
    expect(document.documentElement.hasAttribute("data-mode"), "Glare stayed on after off").toBe(false);
    expect(window.localStorage.getItem(GLARE_STORAGE_KEY)).toBeNull();
    expect(glareSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("follows a Glare change made from anywhere else", () => {
    renderSettings();
    act(() => applyGlare(true));
    expect(glareSwitch().getAttribute("aria-checked"), "the switch did not follow the store").toBe("true");
  });
});
