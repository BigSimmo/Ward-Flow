import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * How do I… (Josh, 30 Oct 2026): Help lists the desk's common tasks, this screen's first, then in
 * fixed groups. Each opens to its answer with Show me, which walks the real screen. Grouping only,
 * never ranking, and only this desk's own tasks.
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

import { HOW_TO_TOPICS, HOW_TOS } from "@/components/ward-management/help/ward-help-howto";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import { tasksForDesk, WardHelpTasks } from "@/components/ward-management/help/ward-help-task-list";

afterEach(() => {
  route.pathname = "/ward-flow/handover";
});

function renderTasks(props: Partial<Parameters<typeof WardHelpTasks>[0]> = {}) {
  return render(
    <WardHelpTasks
      role="coordinator"
      home="/ward-flow"
      pathname={route.pathname}
      onClose={vi.fn()}
      showMeOn
      {...props}
    />,
  );
}

describe("How do I… task list", () => {
  it("files every how-to under a known group, and keeps Show me off the two answer-only ones", () => {
    for (const howTo of HOW_TOS) expect(HOW_TO_TOPICS, howTo.id).toContain(howTo.topic);
    const answerOnly = HOW_TOS.filter((howTo) => !howTo.showMe?.length).map((howTo) => howTo.id);
    // Legal times are shown only as typed (D-70) and Undo has no single control to point at.
    expect(answerOnly.toSorted()).toEqual(["mha-times", "undo"]);
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

  it("puts this screen's tasks first, under On this screen, and not again below", () => {
    renderTasks();
    const here = within(screen.getByTestId("ward-help-tasks-here"));
    expect(here.getByTestId("ward-help-task-answer-sign-off-handover")).toBeTruthy();
    expect(here.getByTestId("ward-help-task-answer-print-handover")).toBeTruthy();
    expect(screen.getAllByTestId("ward-help-task-answer-sign-off-handover")).toHaveLength(1);
  });

  it("says so when nothing starts on this screen", () => {
    route.pathname = "/ward-flow/somewhere-else";
    renderTasks({ pathname: route.pathname });
    expect(within(screen.getByTestId("ward-help-tasks-here")).getByText(/No task here starts on this screen/)).toBeTruthy();
  });

  it("opens one answer at a time, with Show me and Go there", () => {
    const show = vi.fn();
    window.addEventListener("ward-flow-open-help", show);
    try {
      renderTasks();
      const row = screen.getByTestId("ward-help-task-answer-pull-bed");
      expect(within(row).getByText("2 steps")).toBeTruthy();
      fireEvent.click(within(row).getByRole("button", { name: /Pull the bed for a patient/ }));
      expect(within(row).getByRole("button", { name: /Pull the bed for a patient/ }).getAttribute("aria-expanded")).toBe(
        "true",
      );
      expect(within(row).getByTestId("ward-help-task-go").getAttribute("href")).toBe("/ward-flow/movements");
      fireEvent.click(within(row).getByTestId("ward-help-task-show-me"));
      expect((show.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ showMe: "pull-bed" });

      const other = screen.getByTestId("ward-help-task-answer-book-transport");
      fireEvent.click(within(other).getByRole("button", { name: /Book transport/ }));
      expect(within(row).queryByTestId("ward-help-task-show-me")).toBeNull();
    } finally {
      window.removeEventListener("ward-flow-open-help", show);
    }
  });

  it("offers no Go there for a task done on this screen", () => {
    renderTasks({ openTask: "sign-off-handover" });
    const row = screen.getByTestId("ward-help-task-answer-sign-off-handover");
    expect(within(row).getByTestId("ward-help-task-show-me")).toBeTruthy();
    expect(within(row).queryByTestId("ward-help-task-go")).toBeNull();
  });

  it("reads as answers only, with no step counts, when Show me is off", () => {
    renderTasks({ showMeOn: false, openTask: "pull-bed" });
    expect(screen.queryByText("2 steps")).toBeNull();
    expect(screen.queryByTestId("ward-help-task-show-me")).toBeNull();
    expect(screen.getByTestId("ward-help-task-go")).toBeTruthy();
  });
});

describe("How do I… in the Help sheet", () => {
  it("is the first section and opens a task handed back from Show me", () => {
    render(
      <WardHelpSheet view="tasks" task="sign-off-handover" showMeOn onView={vi.fn()} onClose={vi.fn()} />,
    );
    const sections = within(screen.getByRole("group", { name: "Help sections" })).getAllByRole("button");
    expect(sections.map((button) => button.textContent)).toEqual([
      "How do I…",
      "This screen",
      "Your desk",
      "Glossary",
      "What's new",
    ]);
    expect(sections[0]?.getAttribute("aria-pressed")).toBe("true");
    const row = screen.getByTestId("ward-help-task-answer-sign-off-handover");
    expect(within(row).getByRole("button", { name: /Hand over to the next shift/ }).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("offers this screen's tasks as Show me on This screen, and Show me beside a desk job", () => {
    const { unmount } = render(<WardHelpSheet view="screen" showMeOn onView={vi.fn()} onClose={vi.fn()} />);
    expect(within(screen.getByTestId("ward-help-screen-tasks")).getByTestId("ward-help-screen-show-me-sign-off-handover"))
      .toBeTruthy();
    unmount();
    render(<WardHelpSheet view="desk" showMeOn onView={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByTestId("ward-help-job-show-me").length).toBeGreaterThan(0);
  });

  it("names the desk and the screen under the title", () => {
    render(<WardHelpSheet view="tasks" showMeOn onView={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-help-context").textContent).toMatch(/· this screen: Handover/);
  });
});
