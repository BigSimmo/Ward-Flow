import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason as every sibling settings dom suite: this screen renders next/link anchors and
// jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// The desk drawer ("Go to a desk") asks for the router, which jsdom cannot mount either.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/ward-flow/settings",
  useSearchParams: () => new URLSearchParams(),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { findSettings, SETTINGS_SEARCH_ENTRIES } from "@/components/ward-management/settings/settings-search-index";
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
 *
 * Overall review, 20 Oct 2026 (Josh accepted): "hide every not-wired button in the pilot build, so
 * nothing on screen pretends to work." D-72 then deleted the Preview settings outright; the last
 * suite below renders the screen as each build to prove none of them comes back.
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

  // D-72 (build or delete each unfinished control, defaulting to delete): every Preview setting was
  // deleted, so no tab carries a Preview tag or the D4 sentence, and the cases above check wired
  // controls only.
  it.each(TABS.map((name) => ({ name })))("$name: shows no Preview control and no D4 sentence", ({ name }) => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name }));
    const pane = screen.getByRole("main").querySelector<HTMLElement>("[data-pane]:not([hidden])")!;
    expect(pane.textContent).not.toContain(NOT_WIRED);
    expect(pane.textContent).not.toMatch(/\bPreview\b/u);
  });

  // Audit settings-17 (Josh, 13 Oct 2026): one hold length, the Pull time limit (D-81, was Pull hold). No second Preview timer.
  it("keeps one bed hold rule: Pull time limit, with no separate Bed hold expires row", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Rules/ }));
    expect(screen.getByText("Pull time limit")).toBeInTheDocument();
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
  const WIRED_STEPPERS = ["ED access target", "Pull time limit", "Parallel referral enquiry limit"];

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

/**
 * D-72 (build or delete each unfinished control, defaulting to delete): the Preview settings that
 * used to show only in a local development build were deleted. Each case renders the screen as a
 * named build (`NEXT_PUBLIC_WARD_ENVIRONMENT`), a development build included, so none of them can
 * come back behind the build switch.
 */
describe("settings screen: deleted Preview controls stay out of every build", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // The Preview rows the find index used to name.
  const DELETED_TARGETS = [
    "surge-ends",
    "occupancy",
    "tier-one",
    "ward-silent",
    "flash",
    "buzz-again",
    "quiet-hours",
    "shift-summary",
    "snooze",
    "notifications",
    "live-lists",
    "timer-seconds",
    "wallboard",
    "text-size",
    "touch",
    "initials",
    "lock-idle",
    "clear-on-close",
    "opens-on",
    "my-shift",
    "covering",
    "handover-sections",
    "handover-reminder",
    "handover-open",
  ];
  // Cards whose every row was Preview: Live data and boards, Notifications, Privacy, Handover, More thresholds.
  const DELETED_CARDS = ["live-title", "notify-title", "privacy-title", "handover-title", "more-title"];

  function settingTargets(): Set<string> {
    const main = screen.getByRole("main");
    return new Set(
      Array.from(main.querySelectorAll<HTMLElement>("[data-setting]")).map((el) => el.dataset.setting ?? ""),
    );
  }

  it.each(["production", "demo", "development"] as const)("a %s build renders no Preview row, card or tag", (build) => {
    vi.stubEnv("NEXT_PUBLIC_WARD_ENVIRONMENT", build);
    renderSettings();
    const main = screen.getByRole("main");
    const targets = settingTargets();

    expect(DELETED_TARGETS.filter((id) => targets.has(id))).toEqual([]);
    expect(DELETED_CARDS.filter((id) => main.querySelector(`#${id}`))).toEqual([]);
    expect(main.textContent).not.toContain(NOT_WIRED);
    expect(main.textContent).not.toMatch(/\bPreview\b/);

    // Wired settings stay, so the absences above are not a blank screen.
    for (const id of ["buzz", "theme", "decision-targets", "role", "pull-hold"]) {
      expect(targets.has(id), `wired setting "${id}" is missing`).toBe(true);
    }
  });

  it("find a setting offers no deleted row, and every result it offers is on screen", () => {
    expect(SETTINGS_SEARCH_ENTRIES.filter((entry) => DELETED_TARGETS.includes(entry.id))).toEqual([]);
    expect(findSettings("quiet hours")).toEqual([]);
    expect(findSettings("surge ends")).toEqual([]);
    expect(findSettings("handover").map((entry) => entry.id)).toEqual([]);

    renderSettings();
    const targets = settingTargets();
    const offered = SETTINGS_SEARCH_ENTRIES.filter(
      (entry) => entry.tab !== "access" && findSettings(entry.label, SETTINGS_SEARCH_ENTRIES.length).includes(entry),
    );
    expect(offered.length).toBeGreaterThan(0);
    // D-91: Go to a desk is an action, not a row. Choosing it opens the desk drawer (the case below).
    const rows = offered.filter((entry) => entry.id !== "go-to-desk");
    expect(rows.filter((entry) => !targets.has(entry.id)).map((entry) => entry.id)).toEqual([]);
  });

  it.each(["production", "development"] as const)(
    "the desk drawer offers no desk that has no screen yet (%s)",
    (build) => {
      vi.stubEnv("NEXT_PUBLIC_WARD_ENVIRONMENT", build);
      renderSettings();
      // D-91 (Josh, 31 Oct 2026): Settings opens Go to a desk from Find a setting, not a button of its own.
      fireEvent.change(screen.getByRole("combobox", { name: "Find a setting" }), {
        target: { value: "workstation" },
      });
      fireEvent.click(screen.getByRole("option", { name: /Go to a desk/ }));
      const drawer = screen.getByRole("dialog", { name: "Go to a desk" });
      expect(within(drawer).queryByRole("button", { name: /Bed manager/ })).toBeNull();
      expect(within(drawer).queryByRole("button", { name: /Executive/ })).toBeNull();
    },
  );
});
