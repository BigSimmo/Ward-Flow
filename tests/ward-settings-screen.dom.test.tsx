import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: these screens render next/link anchors and jsdom cannot
// provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * 🔴 **THE SETTINGS SCREEN, AND ITS ONE RULE: A CONTROL THAT WRITES STATE NOTHING READS IS WORSE
 * THAN A MISSING CONTROL.** It looks like it works and silently does nothing. **For every control on
 * this screen, something must be shown to read what it writes — and the two that cannot yet be wired
 * are ABSENT rather than stubbed.**
 *
 * ⚠️ **A stub is the same defect wearing a promise.** Appearance and the rail toggle need writers
 * that are module-private in `shell/ward-bar.tsx` and `shell/ward-rail.tsx` (Lane A's files); until
 * those are exported, this screen has a hole where they go and says so, rather than a button that
 * moves and changes nothing.
 */

function renderSettings() {
  render(
    <WardFlowProvider>
      <SettingsScreen />
    </WardFlowProvider>,
  );
}

describe("the settings screen", () => {
  it("renders under the name the drawing gives it", () => {
    renderSettings();
    expect(screen.getByTestId("ward-settings-screen")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeInTheDocument();
  });

  /**
   * 🔴 **THE DEFAULT-SERVICE PANEL STATES AN ABSENCE AND MUST NOT GROW A CONTROL.** The bar's
   * Service selector is an unwired seam that nothing persists, so a "default service" setting here
   * would write a preference no load ever reads. ⚠️ **The drawing is right to give it a readout and
   * no control, and this test is what stops a later reader "finishing" it.**
   */
  it("gives the default service a readout and no control at all", () => {
    renderSettings();
    const panel = screen.getByTestId("ward-settings-default-service");

    expect(panel.textContent).toMatch(/not saved/i);
    expect(within(panel).queryAllByRole("button"), "a control appeared on a read-only panel").toHaveLength(0);
    expect(within(panel).queryAllByRole("radio")).toHaveLength(0);
    expect(within(panel).queryAllByRole("combobox")).toHaveLength(0);
  });

  /**
   * 🔴 **THE ANTI-DRIFT TEST, AND IT IS THE ONE THAT EARNS THE HANDOVER PANEL.** The drawing lists
   * the four sections that print, by name. **Typing those four names here would be a second copy of
   * a list that lives in `handover-page.tsx`** — and the first rename would leave this screen
   * confidently describing a sheet that no longer has those sections.
   *
   * ✅ **So the expectation is read out of the REAL Handover screen, rendered in this same test.**
   * Neither side is a fixture. Rename a section on Handover and this reddens.
   */
  it("names exactly the sections the real handover sheet prints, read from that screen", () => {
    const handover = render(
      <WardFlowProvider>
        <HandoverPage />
      </WardFlowProvider>,
    );
    const printedSections = within(handover.container)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent?.trim() ?? "")
      .filter((text) => text.length > 0)
      // ⚠️ **ONE EXCLUSION, NAMED RATHER THAN HAND-PICKED.** "Print" is the panel ABOUT printing —
      // listing it among the things that print on the sheet would be circular. Every other heading
      // is content, including "Sign off", which this test caught arriving from another lane.
      .filter((text) => !text.startsWith("Handover sheet"))
      .filter((text) => text !== "Print");
    handover.unmount();

    expect(
      printedSections.length,
      "the handover screen rendered no sections, so this would be vacuous",
    ).toBeGreaterThan(0);

    renderSettings();
    const panel = screen.getByTestId("ward-settings-handover");
    for (const section of printedSections) {
      expect(panel.textContent, `the settings screen does not name the printed section "${section}"`).toContain(
        section,
      );
    }
  });

  it("links to the real handover route, not to a drawing", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Profile and shift/ }));
    const link = within(screen.getByTestId("ward-settings-handover")).getByRole("link", { name: /handover/i });
    expect(link.getAttribute("href")).toBe("/mockups/ward-flow/handover");
    expect(link.getAttribute("href")).not.toMatch(/\.html$/);
  });

  /**
   * 🔴 **Q-7 PINS THE CLOCK, THE SCENARIO AND RESET TO THE TOOLS DRAWER, AND A SETTINGS SCREEN IS
   * EXACTLY WHERE A LATER READER PUTS THEM BACK.** The drawing correctly omits them. ⚠️ **An absence
   * reads as an oversight**, so the screen carries a note saying they were left out deliberately and
   * where they live — and this test refuses a version that quietly grows them.
   */
  it("offers no demonstration control — no clock, no scenario, no reset", () => {
    renderSettings();
    const screenText = screen.getByTestId("ward-settings-screen").textContent ?? "";

    for (const control of [/advance the clock/i, /\+15/, /\+60/i, /reset the demonstration/i]) {
      expect(screenText, `a demonstration control reached the settings screen: ${control}`).not.toMatch(control);
    }
    // And the absence is explained rather than silent — Q-7 names where they live.
    expect(screenText).toMatch(/tools/i);
  });

  /**
   * 🔴 **THE HOLE CLOSED ON 2026-09-12 AND THE ASSERTION IS INVERTED RATHER THAN DELETED.** This
   * used to require a panel saying appearance and the rail were not on this screen yet. Lane A
   * exported both writers, both controls were built, and **a screen apologising for controls it
   * renders is the stale-copy defect this project keeps finding** — so the test now refuses the
   * panel's return. ⚠️ Deleting the case would have left nothing watching for it.
   */
  it("no longer explains an absence, because there is none", () => {
    renderSettings();
    expect(screen.queryByTestId("ward-settings-not-yet-here")).toBeNull();
    expect(screen.getByTestId("ward-settings-appearance")).toBeInTheDocument();
    expect(screen.getByTestId("ward-settings-rail")).toBeInTheDocument();
  });

  /**
   * ⚠️ **The anti-vacuity case for every "no control" assertion above.** All of them would pass on a
   * screen that rendered nothing at all.
   */
  it("actually renders its panels, so the no-control assertions are not passing over an empty page", () => {
    renderSettings();
    expect(screen.getByTestId("ward-settings-default-service")).toBeInTheDocument();
    expect(screen.getByTestId("ward-settings-handover")).toBeInTheDocument();
    expect((screen.getByTestId("ward-settings-screen").textContent ?? "").length).toBeGreaterThan(200);
  });
});

/**
 * 🔴 **THE THRESHOLDS PANEL — and the state column is the thing to test, because it is the thing
 * that could quietly stop being true.** Owner-ruled 2026-09-12: publish the one threshold the app
 * really has, add a state per row, and do NOT add the two the drawing lists and the app lacks.
 */
describe("the settings screen's thresholds panel", () => {
  it("renders a row for each published threshold and no others", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Data and about/ }));
    const panel = screen.getByTestId("ward-settings-thresholds");
    expect(within(panel).getAllByRole("row").length, "no rows rendered").toBeGreaterThan(1);
    expect(within(panel).queryByTestId("ward-settings-threshold-ed-access-target")).toBeInTheDocument();
    expect(within(panel).queryByTestId("ward-settings-threshold-legal-form-deadline")).toBeInTheDocument();
  });

  /**
   * 🔴 **THE TWO THE OWNER DECLINED MUST NOT APPEAR, ASSERTED BY THEIR NUMBERS.** A row count says
   * something is missing; a value says WHICH — and these two numbers are the whole reason he was
   * asked.
   */
  it("publishes neither of the two thresholds the owner declined to adopt", () => {
    renderSettings();
    const text = screen.getByTestId("ward-settings-thresholds").textContent ?? "";
    expect(text, "a threshold the owner did not adopt is on the page").not.toMatch(/\b200\b/);
    expect(text, "a threshold the owner did not adopt is on the page").not.toMatch(/\b120\b/);
  });

  /**
   * ⚠️ **THE STATE IS RENDERED IN WORDS A COORDINATOR READS, NOT AS THE INTERNAL TOKEN.** And the
   * row that reaches nobody must say so plainly — that is the whole reason the column exists: a
   * working safeguard and an absent one are indistinguishable from the screen otherwise.
   */
  it("says in words that the legal-form deadline currently reaches nobody", () => {
    renderSettings();
    const row = screen.getByTestId("ward-settings-threshold-legal-form-deadline");
    expect(row.textContent).toMatch(/nothing reaches it|reaches nobody|no one reaches/i);
    expect(row.textContent, "the internal token leaked to the screen").not.toMatch(/nothing-reaches-it/);
  });

  it("says figures here change only through the Rules tab, because the ED row there genuinely can, and carries no button of its own", () => {
    renderSettings();
    // Task 9 of the audit-wiring plan, 2026-09-16: "Nothing here can be changed from this
    // screen" went false the day the ED access target row above this table became a real
    // control writing the same figure this table reads — so the panel now says where a change
    // actually happens and that it is recorded, rather than claiming nothing can change at all.
    // Workspaces rebuild (8 Oct 2026): the editable rules moved to their own tab.
    expect(screen.getByTestId("ward-settings-thresholds").textContent).toMatch(
      /change only through the Rules tab, and every change is recorded/i,
    );
    expect(within(screen.getByTestId("ward-settings-thresholds")).queryAllByRole("button")).toHaveLength(0);
  });
});

/**
 * D5 (owner decision, recorded 2026-09-16): no Mental Health Act section number, no invented
 * form code, and no use of the word "statutory" anywhere on this screen's rendered text. Applied
 * whole-screen rather than row-by-row, because a sentence naming any of these can land anywhere
 * on the page — the roles matrix, a KPI card, a domain description, the reset modal — not only
 * inside a single control's own description.
 */
describe("D5 — no MHA section numbers, invented form codes, or the word 'statutory'", () => {
  it("carries no /section \\d/, no 'Form 3A', no 'Form 5A', and no /statutory/ anywhere on the screen", () => {
    renderSettings();
    const text = screen.getByTestId("ward-settings-screen").textContent ?? "";
    expect(text).not.toMatch(/section\s*\d/i);
    expect(text).not.toMatch(/form 3a/i);
    expect(text).not.toMatch(/form 5a/i);
    expect(text).not.toMatch(/statutory/i);
  });
});

/**
 * Elevations: touch envelopes, focus-visible and the informational note. Since the Workspaces
 * rebuild (8 Oct 2026) the switches, steppers and segmented controls are the shared wf primitives,
 * which carry their own focus rings and sizes; this screen's CSS owns only its own extras.
 */
describe("settings screen elevations: touch envelopes, focus-visible, and the reference note", () => {
  const cssPath = path.join(process.cwd(), "src", "components", "ward-management", "settings", "settings.module.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  it("gives the small reset icon a press area that reaches the tap envelope", () => {
    expect(cssContent).toMatch(/\.resetButton\s*\{[^}]*position:\s*relative;/);
    expect(cssContent).toMatch(/\.resetButton::after\s*\{[^}]*inset:\s*-10px;/);
  });

  it("draws a 2px focus ring on every control this screen styles itself", () => {
    for (const selector of ["resetButton", "rangeInput", "saveLink", "tableWrap"]) {
      expect(cssContent, `.${selector} has no focus ring`).toMatch(
        new RegExp(`\\.${selector}:focus-visible\\s*\\{[^}]*outline:\\s*2px solid var\\(--wf-focus-ring\\);`),
      );
    }
  });

  it("renders the reference note with its tone, saying where figures change", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Data and about/ }));
    const callout = screen.getByTestId("ward-settings-thresholds").querySelector('[data-tone="accent"]');
    expect(callout).toBeInTheDocument();
    expect(callout?.textContent).toContain("Figures here change only through the Rules tab");
  });
});

describe("accessibility switches when browser storage refuses writes", () => {
  it("still turns reduced motion on for this session", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    try {
      renderSettings();
      fireEvent.click(screen.getByRole("radio", { name: /^Display/ }));
      const control = screen.getByRole("switch", { name: /Reduce motion/ });
      expect(control).toHaveAttribute("aria-checked", "false");
      fireEvent.click(control);
      expect(screen.getByRole("switch", { name: /Reduce motion/ })).toHaveAttribute("aria-checked", "true");
      expect(document.documentElement).toHaveAttribute("data-reduced-motion", "true");
      fireEvent.click(screen.getByRole("switch", { name: /Reduce motion/ }));
    } finally {
      setItem.mockRestore();
    }
  });
});
