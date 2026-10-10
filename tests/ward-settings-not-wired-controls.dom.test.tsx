import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling settings dom suite: this screen renders next/link anchors and
// jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { SETTINGS_SEARCH_ENTRIES } from "@/components/ward-management/settings/settings-search-index";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * Per owner decision D4 (docs/ward-flow/plans/2026-09-16-drawings-new-look-with-rules.md), a
 * control the engine cannot back is kept visible but says exactly "Not wired in this prototype."
 * Per D5, Mental Health Act section numbers, the word "statutory" and invented time limits do not
 * appear in prototype copy.
 *
 * History: nine clinical controls (Form 4A warning, Text all services, Clearance bed buffer, Bay and
 * gender rules, Specialling limit, Form 1A before involuntary, Escort before transport, Authorised bed
 * check, Chief Psychiatrist audit) carried this label from 16 September 2026. The Workspaces rebuild
 * (8 Oct 2026, Josh: "remove anything unnecessary") retired them with the old page. The new page has
 * its own Preview settings, and this suite now holds every one of them to the same rule.
 *
 * Each Preview control is `aria-disabled` (not natively `disabled`) so it stays keyboard-reachable,
 * matching `ignoreUnavailableActivation`'s rationale in src/components/primitive-recipes/recipes.ts:
 * a `disabled` control drops out of the tab order and a screen-reader user moving by Tab never
 * reaches the reason.
 */

const NOT_WIRED = "Not wired in this prototype.";

// dispatch/escalate/enforce/block/statutory claims and MHA section references: the shape of every
// false operational claim the retired controls carried before D4/D5.
const FORBIDDEN_CLAIM = /dispatch|escalat|enforc|block|statutory|section \d/i;

const TABS = [/^Rules/, /^Alerts/, /^Display/, /^Profile and shift/, /^Data and about/];

function renderSettings() {
  render(
    <WardFlowProvider>
      <SettingsScreen />
    </WardFlowProvider>,
  );
}

describe("settings screen: every Preview control says it is not wired", () => {
  it.each(TABS.map((name) => ({ name })))(
    "$name: each aria-disabled control sits in a setting that carries the D4 sentence, and none is natively disabled",
    ({ name }) => {
      renderSettings();
      fireEvent.click(screen.getByRole("radio", { name }));
      const pane = screen.getByRole("main").querySelector<HTMLElement>("[data-pane]:not([hidden])");
      expect(pane, "the chosen tab's pane did not show").not.toBeNull();

      // A wired stepper's button at its bound is aria-disabled too; that is a limit, not Preview.
      // Phone alerts (feature 4) is wired but needs the shared Azure workspace: its row says why
      // it is unavailable instead (tests/ward-phone-push.dom.test.tsx holds it to that).
      const unavailable = Array.from(pane!.querySelectorAll<HTMLElement>('[aria-disabled="true"]')).filter(
        (control) =>
          !/^(Increase|Decrease) /.test(control.getAttribute("aria-label") ?? "") &&
          !control.closest("[data-setting='phone-alerts']"),
      );
      for (const control of unavailable) {
        const setting = control.closest<HTMLElement>("[data-setting]");
        expect(setting, `${control.outerHTML.slice(0, 80)} sits outside any setting`).not.toBeNull();
        expect(setting!.textContent).toContain(NOT_WIRED);
        expect(control.hasAttribute("disabled")).toBe(false);
      }
    },
  );

  it("shows at least one Preview control, so the suite above is not vacuous", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Alerts/ }));
    const pane = screen.getByRole("main").querySelector("[data-pane]:not([hidden])");
    expect(pane!.querySelectorAll('[aria-disabled="true"]').length).toBeGreaterThan(3);
  });

  it("pressing a Preview control says it is not wired and changes nothing", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Display/ }));
    const row = screen.getByText("Text size").closest<HTMLElement>("[data-setting]")!;
    const option = within(row)
      .getAllByRole("radio")
      .find((radio) => radio.getAttribute("aria-checked") === "false")!;
    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("status")).toHaveTextContent(`Text size: ${NOT_WIRED}`);
  });

  it("keeps Mental Health Act section numbers and statutory claims out of the find index", () => {
    expect(SETTINGS_SEARCH_ENTRIES.length).toBeGreaterThan(0);
    for (const entry of SETTINGS_SEARCH_ENTRIES) {
      expect(`${entry.label} ${entry.keywords}`).not.toMatch(FORBIDDEN_CLAIM);
      expect(`${entry.label} ${entry.keywords}`).not.toMatch(/\bs\d{2}\b/i);
    }
  });
});

/**
 * Task 9 of the audit-wiring plan, 2026-09-16: the mirror of the suite above. Where Preview
 * controls must say they do nothing, these three must say — and prove — that they do.
 */
describe("settings screen — the three controls Task 9 actually wired", () => {
  // v10: each wired rule is one stepper (no slider), named by what it sets.
  const WIRED_STEPPERS = ["ED access target", "Pulled bed hold duration", "Parallel referral enquiry limit"];

  it("are not aria-disabled, unlike the Preview controls", () => {
    renderSettings();
    // An earlier case leaves another tab in the address; the rules live on Rules.
    fireEvent.click(screen.getByRole("radio", { name: /^Rules/ }));
    for (const name of WIRED_STEPPERS) {
      const control = screen.getByRole("spinbutton", { name });
      expect(control).not.toHaveAttribute("aria-disabled");
    }
  });

  it("changing the ED access target stepper dispatches nothing until Save is pressed", () => {
    function Probe() {
      const { configuration } = useWardFlow();
      return <span data-testid="probe-ed-target">{configuration.edAccessTargetMinutes}</span>;
    }
    render(
      <WardFlowProvider>
        <SettingsScreen />
        <Probe />
      </WardFlowProvider>,
    );

    const before = screen.getByTestId("probe-ed-target").textContent;
    fireEvent.click(screen.getByRole("radio", { name: /^Rules/ }));
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "ED access target" }), { key: "Home" });
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: /^Save \d+ changes?$/ }));
    expect(screen.getByTestId("probe-ed-target").textContent).toBe("720");
  });
});
