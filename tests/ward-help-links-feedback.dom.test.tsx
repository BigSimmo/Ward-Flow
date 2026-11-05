import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Help upgrades (Josh, 2 Nov 2026): a link that opens Help at one job ("#help=<id>", a fixed id and
 * nothing typed), Copy link on each answer, "Was this helpful?" counted on this device by id only and
 * shown in the Settings usage card, better questions to try, and Shortcuts for a tablet with a
 * keyboard. No help is added to the screens themselves.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const navigation = vi.hoisted(() => ({ push: vi.fn(), pathname: "/ward-flow/discharges" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

const phone = vi.hoisted(() => ({ on: false }));
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.on,
}));

const copy = vi.hoisted(() => ({ text: "", fail: false }));
vi.mock("@/components/ward-management/ward-clipboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-clipboard")>()),
  copyTextToClipboard: async (text: string) => {
    if (copy.fail) throw new Error("no clipboard");
    copy.text = text;
  },
}));

import { helpLinkHref, helpLinkTask } from "@/components/ward-management/help/ward-help-events";
import {
  HELP_FEEDBACK_STORAGE_KEY,
  parseHelpFeedback,
  recordHelpFeedback,
} from "@/components/ward-management/help/ward-help-feedback";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardHelpHost } from "@/components/ward-management/help/ward-help-host";
import { HOW_TO_IDS } from "@/components/ward-management/help/ward-help-howto";
import { SCREEN_HELP } from "@/components/ward-management/help/ward-help-content";
import { HelpTasks } from "@/components/ward-management/help/ward-help-jobs";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import { HELP_USED_STORAGE_KEY } from "@/components/ward-management/help/ward-help-usage";
import { WardHelpUsageCard } from "@/components/ward-management/help/ward-help-usage-card";
import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  delete (window as typeof window & { __wardFlowConfirmNavigation?: unknown }).__wardFlowConfirmNavigation;
  navigation.push.mockReset();
  navigation.pathname = "/ward-flow/discharges";
  phone.on = false;
  copy.text = "";
  copy.fail = false;
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  installMatchMediaStub(false);
});

function renderTasks() {
  return render(
    <HelpTasks
      role="coordinator"
      home="/ward-flow"
      pathname="/ward-flow/discharges"
      screen={undefined}
      onClose={vi.fn()}
      onShowMe={vi.fn()}
      onTour={vi.fn()}
      onSearch={vi.fn()}
      openTask="clear-held-up-discharge"
      screenName={() => "Discharges"}
      showMeOn
    />,
  );
}

describe("Help links", () => {
  it("reads only a fixed how-to id from the address", () => {
    expect(helpLinkTask("#help=pull-bed")).toBe("pull-bed");
    expect(helpLinkTask("#help=Pull a bed")).toBeUndefined();
    expect(helpLinkTask("#help=")).toBeUndefined();
    expect(helpLinkTask("#rules")).toBeUndefined();
    expect(helpLinkTask("#help=pull-bed&q=smith")).toBeUndefined();
    expect(helpLinkHref("https://example.test", "/ward-flow/settings#rules", "theme")).toBe(
      "https://example.test/ward-flow/settings#help=theme",
    );
  });

  it("opens How to at the linked job, then takes the link off the address", async () => {
    window.history.replaceState(null, "", "/ward-flow/discharges#help=clear-held-up-discharge");
    render(<WardHelpHost />);
    const answer = await screen.findByTestId("ward-help-task-answer-clear-held-up-discharge", {}, { timeout: 3000 });
    expect(within(answer).getByRole("button", { expanded: true })).toBeTruthy();
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/ward-flow/discharges");
  });

  it("copies a link to the open job, through the safe clipboard", async () => {
    renderTasks();
    fireEvent.click(screen.getByTestId("ward-help-copy-link"));
    // The button says so where it was pressed, and a polite live line announces it.
    await screen.findByRole("button", { name: "Link copied" });
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe("Link copied");
    expect(copy.text).toBe(`${window.location.origin}/ward-flow/discharges#help=clear-held-up-discharge`);
  });

  it("says so when the link could not be copied", async () => {
    copy.fail = true;
    renderTasks();
    fireEvent.click(screen.getByTestId("ward-help-copy-link"));
    await screen.findByText("Could not copy the link");
  });
});

describe("Was this helpful?", () => {
  it("keeps known ids and whole counts only", () => {
    const known = new Set(["pull-bed", "theme"]);
    const parsed = parseHelpFeedback("pull-bed:2:1,unknown:1:0,theme:x:1,theme:0:0,smith jones:1:1", known);
    expect([...parsed]).toEqual([["pull-bed", { yes: 2, no: 1 }]]);
  });

  it("counts a yes or no by id on this device and thanks the person", () => {
    renderTasks();
    // The status line is in the page before the vote, so its words are announced when they arrive.
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    fireEvent.click(screen.getByTestId("ward-help-helpful-no"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toMatch(/Counted on this device only/);
    // Yes and No give way to the thanks, and focus moves on to Copy link rather than being lost.
    expect(document.activeElement).toBe(screen.getByTestId("ward-help-copy-link"));
    expect(window.localStorage.getItem(HELP_FEEDBACK_STORAGE_KEY)).toBe("clear-held-up-discharge:0:1");
  });

  it("shows the counts in the Settings usage card, and Clear forgets both", () => {
    window.localStorage.setItem(HELP_USED_STORAGE_KEY, "pull-bed:3");
    recordHelpFeedback("pull-bed", true, HOW_TO_IDS);
    recordHelpFeedback("pull-bed", false, HOW_TO_IDS);
    render(<WardHelpUsageCard />);
    expect(screen.getByTestId("ward-settings-help-usage-helpful").textContent).toBe("Helpful 1, not helpful 1");
    act(() => fireEvent.click(screen.getByTestId("ward-settings-help-usage-clear")));
    expect(window.localStorage.getItem(HELP_FEEDBACK_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(HELP_USED_STORAGE_KEY)).toBeNull();
  });
});

describe("Help sheet upgrades", () => {
  function sheet() {
    return render(
      <WardHelpSheet view="tasks" showMeOn onView={vi.fn()} onClose={vi.fn()} onTour={vi.fn()} onShowMe={vi.fn()} />,
    );
  }

  it("suggests this screen's walk round and the desk's most used jobs first", async () => {
    window.localStorage.setItem(HELP_USED_STORAGE_KEY, "theme:9,clear-held-up-discharge:4");
    sheet();
    fireEvent.focus(screen.getByRole("combobox", { name: "Search Help" }));
    await waitFor(() => expect(screen.getByText("Show me around Discharges")).toBeTruthy());
    const tries = screen.getAllByRole("button").map((button) => button.textContent ?? "");
    expect(tries.some((text) => /How do I use dark mode/i.test(text))).toBe(true);
    expect(tries.some((text) => /How do I clear a held-up discharge/i.test(text))).toBe(true);
  });

  it("offers Shortcuts on a phone-sized screen only when a keyboard or trackpad is there", () => {
    phone.on = true;
    const first = sheet();
    expect(screen.queryByTestId("ward-help-shortcuts")).toBeNull();
    first.unmount();
    installMatchMediaStub(true);
    sheet();
    expect(screen.getByTestId("ward-help-shortcuts")).toBeTruthy();
  });
});

describe("printable guides from Help", () => {
  it("links this screen's one-page guide from the On this screen card", () => {
    render(
      <HelpTasks
        role="coordinator"
        home="/ward-flow"
        pathname="/ward-flow/discharges"
        screen={{ ...SCREEN_HELP.discharges, id: "discharges" }}
        onClose={vi.fn()}
        onShowMe={vi.fn()}
        onTour={vi.fn()}
        onSearch={vi.fn()}
        screenName={() => "Discharges"}
        showMeOn
      />,
    );
    expect(screen.getByTestId("ward-help-screen-print").getAttribute("href")).toBe("/help/screens/discharges.html");
  });

  it("links the desk's A4 guide from Your desk", () => {
    render(
      <WardHelpSheet view="desk" showMeOn onView={vi.fn()} onClose={vi.fn()} onTour={vi.fn()} onShowMe={vi.fn()} />,
    );
    expect(screen.getByTestId("ward-help-desk-print").getAttribute("href")).toMatch(/^\/help\/[a-z_]+\.html$/);
  });
});

describe("Help Show me dirty-work continuity", () => {
  it.each([false, true])("retains the selected Help answer while navigation is pending (leave=%s)", async (leave) => {
    setWardFeatureFlagOnDevice("help-ask", true);
    let resume: (() => void) | undefined;
    const confirm = vi.fn((proceed?: () => void) => {
      resume = proceed;
      return false;
    });
    (window as typeof window & { __wardFlowConfirmNavigation?: typeof confirm }).__wardFlowConfirmNavigation = confirm;
    render(<WardHelpHost />);
    act(() =>
      window.dispatchEvent(new CustomEvent("ward-flow-open-help", { detail: { view: "tasks", task: "theme" } })),
    );
    const answer = await screen.findByTestId("ward-help-task-answer-theme");
    fireEvent.click(within(answer).getByTestId("ward-help-task-show-me"));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(within(answer).getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(screen.queryByTestId("ward-show-me-card")).toBeNull();
    expect(navigation.push).not.toHaveBeenCalled();
    if (leave) {
      act(() => resume!());
      await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/ward-flow/settings#display"));
      expect(confirm).toHaveBeenCalledTimes(1);
    }
  });
});

it("closes Help for a harmless same-page Settings fragment without a dirty-work prompt", () => {
  navigation.pathname = "/ward-flow/settings";
  const confirm = vi.fn(() => false);
  (window as typeof window & { __wardFlowConfirmNavigation?: typeof confirm }).__wardFlowConfirmNavigation = confirm;
  const onClose = vi.fn();
  render(<WardHelpSheet view="screen" onView={vi.fn()} onClose={onClose} onTour={vi.fn()} onShowMe={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Search Help" }), { target: { value: "high contrast" } });
  fireEvent.click(
    within(screen.getByRole("region", { name: "Screens" })).getByRole("button", { name: /^High contrast/ }),
  );
  expect(confirm).not.toHaveBeenCalled();
  expect(navigation.push).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});
