import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * How do I… (Josh, 30 Oct 2026; redesign round 2, 1 Nov 2026): Help shows this screen's own jobs as
 * Show me tiles, the tour as one row, then the desk's common tasks in fixed groups with topic chips.
 * Each opens to its answer with Show me, which walks the real screen. Grouping only, never ranking,
 * and only this desk's own tasks.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow/handover" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
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

import { HOW_TO_TOPICS, HOW_TOS } from "@/components/ward-management/help/ward-help-howto";
import { HelpTasks } from "@/components/ward-management/help/ward-help-jobs";
import { SCREEN_HELP } from "@/components/ward-management/help/ward-help-content";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import { tasksForDesk } from "@/components/ward-management/help/ward-help-task-list";

afterEach(() => {
  route.pathname = "/ward-flow/handover";
  phone.on = false;
});

const HANDOVER = { ...SCREEN_HELP.handover, id: "handover" };

function renderTasks(props: Partial<Parameters<typeof HelpTasks>[0]> = {}) {
  const view = render(
    <HelpTasks
      role="coordinator"
      home="/ward-flow"
      pathname={route.pathname}
      screen={route.pathname === "/ward-flow/handover" ? HANDOVER : undefined}
      onClose={vi.fn()}
      onShowMe={vi.fn()}
      onTour={vi.fn()}
      onSearch={vi.fn()}
      screenName={(href) => (href === "/ward-flow/movements" ? "Movements" : "that screen")}
      showMeOn
      {...props}
    />,
  );
  // The list shows its first jobs, then "Show n more".
  const more = screen.queryByRole("button", { name: /^Show \d+ more/ });
  if (more) fireEvent.click(more);
  return view;
}

function open(row: HTMLElement, name: RegExp) {
  fireEvent.click(within(row).getByRole("button", { name }));
}

describe("How do I… task list", () => {
  it("files every how-to under a known group, and keeps Show me off the answer-only ones", () => {
    for (const howTo of HOW_TOS) expect(HOW_TO_TOPICS, howTo.id).toContain(howTo.topic);
    const answerOnly = HOW_TOS.filter((howTo) => !howTo.showMe?.length).map((howTo) => howTo.id);
    // Legal times are shown only as typed (D-70), Undo has no single control to point at, and the
    // paper downtime answer is for logins with no Handover screen to point at.
    expect(answerOnly.toSorted()).toEqual(["downtime-paper", "mha-times", "undo"]);
  });

  it("lists only this desk's own tasks", () => {
    renderTasks({ role: "officer" });
    const listed = screen.getAllByTestId(/^ward-help-task-answer-/).map((row) => row.dataset.testid);
    expect(listed).toEqual(
      expect.arrayContaining(tasksForDesk("officer").map((howTo) => `ward-help-task-answer-${howTo.id}`)),
    );
    expect(listed).toHaveLength(tasksForDesk("officer").length);
    expect(screen.queryByTestId("ward-help-task-answer-pull-bed")).toBeNull();
  });

  it("puts this screen's jobs first, as Show me tiles under On this screen", () => {
    const onShowMe = vi.fn();
    renderTasks({ onShowMe });
    const here = within(screen.getByTestId("ward-help-tasks-here"));
    expect(here.getByText(/On this screen:/)).toBeTruthy();
    fireEvent.click(here.getByRole("button", { name: /Hand over to the next shift/ }));
    expect(onShowMe).toHaveBeenCalledWith("sign-off-handover");
  });

  it("draws no On this screen card on a page Help has nothing for", () => {
    route.pathname = "/ward-flow/somewhere-else";
    renderTasks({ pathname: route.pathname, screen: undefined });
    expect(screen.queryByTestId("ward-help-tasks-here")).toBeNull();
    expect(screen.getByTestId("ward-help-tour-row")).toBeTruthy();
  });

  it("narrows the jobs by topic chip, grouping only", () => {
    renderTasks();
    const chips = within(screen.getByRole("group", { name: "Show jobs about" }));
    fireEvent.click(chips.getByRole("button", { name: /Transport/ }));
    const listed = screen.getAllByTestId(/^ward-help-task-answer-/).map((row) => row.dataset.testid?.slice(22));
    const transport = tasksForDesk("coordinator").filter((howTo) => howTo.topic === "Transport");
    expect(listed).toEqual(transport.map((howTo) => howTo.id));
  });

  it("opens one answer at a time, with its steps, Show me on screen and Go to", () => {
    const onShowMe = vi.fn();
    renderTasks({ onShowMe });
    const row = screen.getByTestId("ward-help-task-answer-pull-bed");
    open(row, /Pull the bed for a patient/);
    expect(
      within(row)
        .getByRole("button", { name: /Pull the bed for a patient/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(within(row).getAllByRole("listitem")).toHaveLength(2);
    expect(within(row).getByTestId("ward-help-task-go").getAttribute("href")).toBe("/ward-flow/movements");
    expect(within(row).getByTestId("ward-help-task-go").textContent).toContain("Go to Movements");
    fireEvent.click(within(row).getByTestId("ward-help-task-show-me"));
    expect(onShowMe).toHaveBeenCalledWith("pull-bed");

    const other = screen.getByTestId("ward-help-task-answer-book-transport");
    open(other, /Book transport/);
    expect(within(row).queryByTestId("ward-help-task-show-me")).toBeNull();
  });

  it("offers no Go to for a task done on this screen", () => {
    renderTasks({ openTask: "sign-off-handover" });
    const row = screen.getByTestId("ward-help-task-answer-sign-off-handover");
    expect(within(row).getByTestId("ward-help-task-show-me")).toBeTruthy();
    expect(within(row).queryByTestId("ward-help-task-go")).toBeNull();
  });

  it("keeps Go to another Settings tab while Help is open on Settings", () => {
    route.pathname = "/ward-flow/settings";
    renderTasks({ openTask: "theme", showMeOn: false, screen: undefined });
    const row = screen.getByTestId("ward-help-task-answer-theme");
    expect(within(row).getByTestId("ward-help-task-go").getAttribute("href")).toBe("/ward-flow/settings#display");
  });

  it("tells a phone that a computer-only task is done on a computer, instead of offering Show me", () => {
    phone.on = true;
    renderTasks({ openTask: "print-handover" });
    const row = screen.getByTestId("ward-help-task-answer-print-handover");
    expect(within(row).getByText("On a computer")).toBeTruthy();
    expect(within(row).getByTestId("ward-help-task-computer-only")).toBeTruthy();
    expect(within(row).queryByTestId("ward-help-task-show-me")).toBeNull();
    // A task the phone does draw keeps its Show me.
    const signOff = screen.getByTestId("ward-help-task-answer-sign-off-handover");
    open(signOff, /Hand over to the next shift/);
    expect(within(signOff).getByTestId("ward-help-task-show-me")).toBeTruthy();
  });

  it("does not list a task on a screen this desk cannot open, and answers it another way", () => {
    renderTasks({ role: "executive", home: "/ward-flow/statistics", screen: undefined });
    expect(screen.queryByTestId("ward-help-task-answer-downtime")).toBeNull();
    const row = screen.getByTestId("ward-help-task-answer-downtime-paper");
    open(row, /./);
    expect(within(row).queryByTestId("ward-help-task-show-me")).toBeNull();
    expect(row.textContent).not.toContain("Handover");
  });

  it("reads as answers only, with no Show me, when Show me is off", () => {
    renderTasks({ showMeOn: false, openTask: "pull-bed" });
    expect(screen.queryByTestId("ward-help-task-show-me")).toBeNull();
    expect(screen.queryByLabelText("Has Show me")).toBeNull();
    expect(screen.getByTestId("ward-help-task-go")).toBeTruthy();
  });
});

function sheet(props: Partial<Parameters<typeof WardHelpSheet>[0]> = {}) {
  return render(
    <WardHelpSheet
      view="tasks"
      showMeOn
      onView={vi.fn()}
      onClose={vi.fn()}
      onTour={vi.fn()}
      onShowMe={vi.fn()}
      {...props}
    />,
  );
}

describe("How do I… in the Help sheet", () => {
  it("is the first of four tabs and opens a task handed back from Show me", () => {
    sheet({ task: "sign-off-handover" });
    const tabs = within(screen.getByRole("tablist", { name: "Help sections" })).getAllByRole("tab");
    // What's new may carry this device's unread count after its name.
    expect(tabs.map((tab) => tab.textContent?.replace(/\d+$/u, ""))).toEqual([
      "How do I…",
      "Common questions",
      "Reference",
      "What\u2019s new",
    ]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    const row = screen.getByTestId("ward-help-task-answer-sign-off-handover");
    expect(
      within(row)
        .getByRole("button", { name: /Hand over to the next shift/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("opens How do I… for the older This screen way in, and Your desk as its own view", () => {
    const { unmount } = sheet({ view: "screen" });
    const tabs = within(screen.getByRole("tablist", { name: "Help sections" })).getAllByRole("tab");
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("ward-help-tasks-here")).toBeTruthy();
    unmount();
    const onView = vi.fn();
    sheet({ view: "desk", onView });
    expect(screen.queryByRole("tablist")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to Help" }));
    expect(onView).toHaveBeenCalledWith("tasks");
  });

  it("names the desk and the screen under the title", () => {
    sheet();
    const sheetEl = screen.getByTestId("ward-help-sheet");
    expect(sheetEl.textContent).toContain("Bed coordinator");
    expect(sheetEl.textContent).toMatch(/You are on Handover/);
  });

  it("opens Your desk and Shortcuts from the foot, each as a view inside Help", () => {
    const onView = vi.fn();
    sheet({ onView });
    fireEvent.click(screen.getByTestId("ward-help-desk-open"));
    expect(onView).toHaveBeenCalledWith("desk");
    fireEvent.click(screen.getByTestId("ward-help-shortcuts"));
    expect(onView).toHaveBeenCalledWith("keys");
  });
});
