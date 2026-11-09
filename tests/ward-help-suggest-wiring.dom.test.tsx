import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Help's suggestions as you type, wired into the Help sheet (Josh, 2 Nov 2026): the field is a
 * combobox, the top suggestion fills in as ghost text, Tab or → takes it, the arrow keys move through
 * the suggestions and then the answers, and nothing typed is stored or put in the address.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

const desk = vi.hoisted(() => ({ role: "bed_manager" as string }));
vi.mock("@/components/ward-management/help/ward-help-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/help/ward-help-store")>()),
  useTourRole: () => desk.role,
}));

import { CLINICAL_REPLY } from "@/components/ward-management/help/ward-help-search-index";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";

afterEach(() => {
  desk.role = "bed_manager";
  vi.restoreAllMocks();
});

function sheet(props: Partial<Parameters<typeof WardHelpSheet>[0]> = {}) {
  const handlers = { onView: vi.fn(), onClose: vi.fn(), onShowMe: vi.fn() };
  render(<WardHelpSheet view="tasks" onTour={vi.fn()} {...handlers} {...props} />);
  const field = screen.getByRole("combobox", { name: "Search Help" }) as HTMLInputElement;
  fireEvent.focus(field);
  return { field, ...handlers };
}

function type(field: HTMLInputElement, words: string) {
  fireEvent.change(field, { target: { value: words } });
  field.setSelectionRange(words.length, words.length);
}

const list = () => screen.queryByRole("listbox", { name: "Suggestions" });
const options = () => screen.getAllByRole("option").map((option) => option.textContent ?? "");

describe("Help suggestions as you type", () => {
  it("suggests a job from the first letters and shows the rest faintly in the field", () => {
    const { field } = sheet();
    type(field, "pul");
    expect(list()).not.toBeNull();
    expect(options().some((text) => text.startsWith("Pull the bed for a patient"))).toBe(true);
    expect(options().length).toBeLessThanOrEqual(6);
    expect(screen.getByTestId("help-ghost").textContent).toBe("pull the bed for a patient");
    expect(field.getAttribute("aria-expanded")).toBe("true");
    expect(field.getAttribute("aria-autocomplete")).toBe("both");
    expect(field.getAttribute("aria-controls")).toBe(list()?.id);
    expect(screen.getByTestId("ward-help-suggest-summary").textContent).toBe(
      "Suggestions are listed below the search box",
    );
    // The full answers still show underneath.
    expect(document.getElementById("ward-help-found")).not.toBeNull();
  });

  it("takes the completion with Tab, and with → at the end of the words", () => {
    const { field } = sheet();
    type(field, "pul");
    expect(fireEvent.keyDown(field, { key: "Tab" })).toBe(false);
    expect(field.value).toBe("Pull the bed for a patient");
    type(field, "pul");
    expect(fireEvent.keyDown(field, { key: "ArrowRight" })).toBe(false);
    expect(field.value).toBe("Pull the bed for a patient");
  });

  it("leaves Tab to move focus on when there is nothing to complete", () => {
    const { field } = sheet();
    type(field, "Pull the bed for a patient");
    expect(screen.queryByTestId("help-ghost")).toBeNull();
    // Not prevented: the browser moves focus on as usual, so the field is no keyboard trap.
    expect(fireEvent.keyDown(field, { key: "Tab" })).toBe(true);
    type(field, "zzqx");
    expect(list()).toBeNull();
    expect(fireEvent.keyDown(field, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(field, { key: "Tab", shiftKey: true })).toBe(true);
  });

  it("opens the first suggestion's job in How to with ↓ then Enter", () => {
    desk.role = "coordinator";
    const { field, onView, onShowMe } = sheet();
    type(field, "pul");
    fireEvent.keyDown(field, { key: "ArrowDown" });
    const first = screen.getAllByRole("option")[0];
    expect(first.getAttribute("aria-selected")).toBe("true");
    expect(field.getAttribute("aria-activedescendant")).toBe(first.id);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onView).toHaveBeenCalledWith("tasks");
    expect(onShowMe).not.toHaveBeenCalled();
    expect(field.value).toBe("");
    expect(list()).toBeNull();
    const row = screen.getByTestId("ward-help-task-answer-pull-bed");
    expect(row.querySelector("[aria-expanded]")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("moves on from the last suggestion into the answers underneath", () => {
    const { field } = sheet();
    type(field, "pul");
    const count = screen.getAllByRole("option").length;
    for (let step = 0; step < count; step += 1) fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(field.getAttribute("aria-activedescendant")).toBe(`ward-help-suggest-${count - 1}`);
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(field.getAttribute("aria-activedescendant")).toBe("ward-help-found-0");
    fireEvent.keyDown(field, { key: "ArrowUp" });
    expect(field.getAttribute("aria-activedescendant")).toBe(`ward-help-suggest-${count - 1}`);
  });

  it("starts Show me for a walk round it can play", () => {
    desk.role = "coordinator";
    const { field, onShowMe } = sheet({ showMeOn: true });
    type(field, "show me around dis");
    const index = options().findIndex((text) => /^Show me around Discharges/u.test(text));
    expect(index).toBeGreaterThanOrEqual(0);
    fireEvent.click(screen.getAllByRole("option")[index]);
    expect(onShowMe).toHaveBeenCalledTimes(1);
    expect(list()).toBeNull();
  });

  it("reads a walk round it cannot play as a search, since How to never lists walk rounds (PR #1299 review)", () => {
    desk.role = "coordinator";
    const { field, onShowMe, onView } = sheet({ showMeOn: false });
    type(field, "show me around dis");
    const index = options().findIndex((text) => /^Show me around Discharges/u.test(text));
    expect(index).toBeGreaterThanOrEqual(0);
    fireEvent.click(screen.getAllByRole("option")[index]);
    expect(onShowMe).not.toHaveBeenCalled();
    expect(onView).not.toHaveBeenCalledWith("tasks");
    expect((field as HTMLInputElement).value).toMatch(/^Show me around Discharges/u);
  });

  it("reads another desk's job as a search, since it is not this desk's to follow", () => {
    const { field, onView } = sheet();
    type(field, "pul");
    fireEvent.keyDown(field, { key: "ArrowDown" });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onView).not.toHaveBeenCalled();
    expect(field.value).toBe("Pull the bed for a patient");
    expect(list()).toBeNull();
  });

  it("puts a word suggestion in the field, so its full answer shows", () => {
    const { field } = sheet();
    type(field, "what does hel");
    const index = options().findIndex((text) => /^What does Held up mean\?/u.test(text));
    expect(index).toBeGreaterThanOrEqual(0);
    fireEvent.click(screen.getAllByRole("option")[index]);
    expect(field.value).toBe("What does Held up mean?");
    expect(list()).toBeNull();
    expect(screen.getByRole("region", { name: "Best answer" }).textContent).toMatch(/Held up/u);
  });

  it("hides the suggestions with the first Esc, then clears the words with the next", () => {
    const { field, onClose } = sheet();
    type(field, "pul");
    fireEvent.keyDown(field, { key: "Escape" });
    expect(list()).toBeNull();
    expect(screen.queryByTestId("help-ghost")).toBeNull();
    expect(field.value).toBe("pul");
    expect(field.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(field, { key: "Escape" });
    expect(field.value).toBe("");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hides the suggestions once focus leaves the field", () => {
    vi.useFakeTimers();
    try {
      const { field } = sheet();
      // Help puts the caret in the box as it opens; let that settle, then move focus away for real.
      act(() => vi.advanceTimersByTime(500));
      type(field, "pul");
      act(() => field.blur());
      act(() => vi.advanceTimersByTime(200));
      expect(list()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows no suggestions for a clinical question, only Help's fixed reply", () => {
    const { field } = sheet();
    for (const words of ["what dos", "what dose", "what dose should I give"]) {
      type(field, words);
      expect(list()).toBeNull();
      expect(screen.queryByTestId("help-ghost")).toBeNull();
      expect(field.getAttribute("aria-expanded")).toBe("false");
    }
    expect(screen.getByRole("status").textContent).toBe(CLINICAL_REPLY);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("never writes typed words to storage or the address", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const before = window.location.href;
    const { field } = sheet();
    type(field, "pul");
    fireEvent.keyDown(field, { key: "Tab" });
    type(field, "what does hel");
    fireEvent.keyDown(field, { key: "ArrowDown" });
    fireEvent.keyDown(field, { key: "Enter" });
    const written = write.mock.calls.map((call) => call.join(" ").toLowerCase());
    expect(written.some((text) => /pul|held|what does/u.test(text))).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.href).toBe(before);
  });
});
