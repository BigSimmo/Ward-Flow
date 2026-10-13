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
import { ToastProvider } from "@/components/wf";

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
 * Site review (12 Oct 2026): Preview controls are no longer `aria-disabled`. Each works like any
 * other control and says it is not wired when pressed (D-16), so nothing reads as refused.
 */

const NOT_WIRED = "Not wired in this prototype.";

// dispatch/escalate/enforce/block/statutory claims and MHA section references: the shape of every
// false operational claim the retired controls carried before D4/D5.
const FORBIDDEN_CLAIM = /dispatch|escalat|enforc|block|statutory|section \d/i;

const TABS = [/^Rules/, /^Alerts/, /^Display/, /^Profile and shift/, /^Data and about/];

function renderSettings() {
  render(
    <ToastProvider>
      <WardFlowProvider>
        <SettingsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

describe("settings screen: every Preview control says it is not wired", () => {
  // Site review (12 Oct 2026): the coordinator is never shown a greyed or refused control. A Preview
  // control works like any other (D-16): it is not aria-disabled, and pressing it says
  // "<name> is not wired in this prototype." The only aria-disabled controls left are a wired
  // stepper at its bound and Phone alerts, whose row says why (tests/ward-phone-push.dom.test.tsx).
  it.each(TABS.map((name) => ({ name })))("$name: no Preview control is greyed", ({ name }) => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name }));
    const pane = screen.getByRole("main").querySelector<HTMLElement>("[data-pane]:not([hidden])");
    expect(pane, "the chosen tab's pane did not show").not.toBeNull();
    const greyed = Array.from(pane!.querySelectorAll<HTMLElement>('[aria-disabled="true"], [disabled]')).filter(
      (control) =>
        !/^(Increase|Decrease) /.test(control.getAttribute("aria-label") ?? "") &&
        !control.closest("[data-setting='phone-alerts']") &&
        // A form's own submit waits for its field, and says so beside it.
        control.getAttribute("type") !== "submit",
    );
    expect(greyed.map((control) => control.outerHTML.slice(0, 100))).toEqual([]);
  });

  it("still marks Preview settings with the D4 sentence, so the suite above is not vacuous", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Alerts/ }));
    const pane = screen.getByRole("main").querySelector("[data-pane]:not([hidden])")!;
    expect(pane.textContent).toContain(NOT_WIRED);
  });

  it("pressing a Preview control says it is not wired and changes nothing", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Display/ }));
    const row = screen.getByText("Text size").closest<HTMLElement>("[data-setting]")!;
    const option = within(row)
      .getAllByRole("radio")
      .find((radio) => radio.getAttribute("aria-checked") === "false")!;
    expect(option).not.toHaveAttribute("aria-disabled");
    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Text size is not wired in this prototype.");
  });

  // Audit settings-14 (13 Oct 2026): a protection that is not running never reads as On.
  it.each([
    { tab: /^Display/, name: "Initials only on shared screens" },
    { tab: /^Display/, name: "Clear session on close" },
    { tab: /^Alerts/, name: "Flash on urgent" },
    { tab: /^Alerts/, name: "Summary at shift start" },
  ])("shows the Preview switch $name as Off", ({ tab, name }) => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: tab }));
    expect(screen.getByRole("switch", { name })).toHaveAttribute("aria-checked", "false");
  });

  // Audit settings-26: Snooze is not wired, so it carries the Preview tag.
  it("tags Snooze 15m as Preview", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Alerts/ }));
    const snooze = screen.getByRole("main").querySelector<HTMLElement>('[data-setting="snooze"]')!;
    expect(snooze).toHaveTextContent("Preview");
  });

  it("shows Lock after idle and Buzz again as Off while they are Preview", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Display/ }));
    const lock = screen.getByText("Lock after idle").closest<HTMLElement>("[data-setting]")!;
    expect(within(lock).getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /^Alerts/ }));
    const again = screen.getByText("Buzz again if not seen").closest<HTMLElement>("[data-setting]")!;
    expect(within(again).getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true");
  });

  // Audit settings-17 (Josh, 13 Oct 2026): one hold length, the Pull hold. No second Preview timer.
  it("keeps one bed hold rule: Pull hold, with no separate Bed hold expires row", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Rules/ }));
    expect(screen.getByText("Pull hold")).toBeInTheDocument();
    expect(screen.queryByText("Bed hold expires")).not.toBeInTheDocument();
    expect(SETTINGS_SEARCH_ENTRIES.some((entry) => entry.label === "Bed hold expires")).toBe(false);
  });

  it("wires Row density: Compact sets dense rows on the page and Comfortable clears them", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Display/ }));
    const row = screen.getByTestId("ward-settings-density");
    fireEvent.click(within(row).getByRole("radio", { name: "Compact" }));
    expect(within(row).getByRole("radio", { name: "Compact" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(row).getByRole("radio", { name: "Comfortable" }));
    expect(within(row).getByRole("radio", { name: "Comfortable" })).toHaveAttribute("aria-checked", "true");
    window.localStorage.removeItem("ward-flow-row-density");
  });

  it("shows no build notes: no 'Fixed in code', 'Read by' or 'Needs Save'", () => {
    renderSettings();
    const text = screen.getByRole("main").textContent ?? "";
    expect(text).not.toMatch(/Fixed in code|Read by|Needs Save/u);
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

  it("are not aria-disabled", () => {
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
      <ToastProvider>
        <WardFlowProvider>
          <SettingsScreen />
          <Probe />
        </WardFlowProvider>
      </ToastProvider>,
    );

    const before = screen.getByTestId("probe-ed-target").textContent;
    fireEvent.click(screen.getByRole("radio", { name: /^Rules/ }));
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "ED access target" }), { key: "Home" });
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: /^Save \d+ changes?$/ }));
    expect(screen.getByTestId("probe-ed-target").textContent).toBe("720");
  });
});
