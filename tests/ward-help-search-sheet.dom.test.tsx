import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Site } from "@/components/ward-management/ward-model";
import type { WardTourRole } from "@/components/ward-management/help/ward-help-store";

const live = vi.hoisted(() => ({
  role: "bed_manager" as WardTourRole,
  sites: undefined as readonly Site[] | undefined,
}));

/**
 * Help's one search box (redesign round 2, 1 Nov 2026): the answers replace the panel's body while
 * words are typed; the arrow keys move, Enter opens and Escape clears.
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

vi.mock("@/components/ward-management/help/ward-help-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/help/ward-help-store")>()),
  useTourRole: () => live.role,
}));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardNetwork: () => ({ ...actual.useWardNetwork(), ...(live.sites ? { sites: live.sites } : {}) }),
  };
});

import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import type { HelpView } from "@/components/ward-management/help/ward-help-events";
import { findInHelp, foundRows, HelpFindResults } from "@/components/ward-management/help/ward-help-find";
import { glossaryForSites } from "@/components/ward-management/help/ward-help-content";
import { canShowTask } from "@/components/ward-management/help/ward-help-jobs";
import { HOW_TOS } from "@/components/ward-management/help/ward-help-howto";

beforeEach(() => {
  live.role = "bed_manager";
  live.sites = undefined;
});

function sheet(props: Partial<Parameters<typeof WardHelpSheet>[0]> = {}) {
  return render(
    <WardHelpSheet view="screen" onView={vi.fn()} onClose={vi.fn()} onTour={vi.fn()} onShowMe={vi.fn()} {...props} />,
  );
}

function type(words: string) {
  const field = screen.getByRole("searchbox", { name: "Search Help" });
  fireEvent.change(field, { target: { value: words } });
  return field;
}

describe("Help sheet search field", () => {
  it.each(["???", "how do I", "unfindablezxqvbnm"])("offers recovery for a search with no answers: %s", (query) => {
    const onView = vi.fn();
    sheet({ onView });
    const field = type(query);
    expect(screen.getByRole("status").textContent).toContain("No Help answers found. Try a task or screen name");
    expect(screen.queryByText(/These are the closest/)).toBeNull();
    expect(field.hasAttribute("aria-activedescendant")).toBe(false);
    for (const key of ["ArrowDown", "ArrowUp", "Enter"]) fireEvent.keyDown(field, { key });
    expect(onView).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "what does pull expired mean" } });
    expect(screen.getByRole("region", { name: "Best answer" }).textContent).toContain("Pull expired");
    expect(document.getElementById(field.getAttribute("aria-activedescendant") ?? "")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((field as HTMLInputElement).value).toBe("");
    expect(field.hasAttribute("aria-activedescendant")).toBe(false);
    expect(screen.getByRole("region", { name: "Try asking" })).toBeTruthy();
  });

  it("keeps suggestions after Clear refocuses the field before a pending blur settles", () => {
    vi.useFakeTimers();
    try {
      sheet();
      const field = type("handover");
      field.focus();
      const clear = screen.getByRole("button", { name: "Clear search" });
      clear.focus();
      fireEvent.click(clear);
      expect(document.activeElement).toBe(field);
      act(() => vi.advanceTimersByTime(150));
      expect(screen.getByRole("region", { name: "Try asking" })).toBeTruthy();
      expect(document.activeElement).toBe(field);

      const shortcuts = screen.getByTestId("ward-help-shortcuts");
      shortcuts.focus();
      field.focus();
      act(() => vi.advanceTimersByTime(150));
      expect(screen.getByRole("region", { name: "Try asking" })).toBeTruthy();

      shortcuts.focus();
      act(() => vi.advanceTimersByTime(150));
      expect(screen.queryByRole("region", { name: "Try asking" })).toBeNull();
      expect(document.activeElement).toBe(shortcuts);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    { change: "reordered", codes: ["AX0", "AXA", "AXB", "AXC"] },
    { change: "removed", codes: ["AXA"] },
  ])("keeps a valid keyboard selection when a live directory answer is $change", ({ change, codes }) => {
    const sites = (codes: string[]): Site[] =>
      codes.map((code) => ({ code, name: "Synthetic testcampus", service: "South Metro", units: [] }));
    const query = "testcampus";
    live.sites = sites(["AXA", "AXB", "AXC"]);
    const before = foundRows(findInHelp(query, live.role, glossaryForSites(live.sites)));
    const beforeIndex = before.findIndex((row) => row.key === "term:AXC");
    expect(beforeIndex).toBeGreaterThan(0);
    const props = { view: "screen" as const, onView: vi.fn(), onClose: vi.fn(), onTour: vi.fn(), onShowMe: vi.fn() };
    const view = sheet(props);
    const field = type(query);
    field.focus();
    for (let step = 0; step < beforeIndex; step += 1) fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(document.getElementById(field.getAttribute("aria-activedescendant") ?? "")?.textContent).toContain("AXC");

    live.sites = sites(codes);
    const after = foundRows(findInHelp(query, live.role, glossaryForSites(live.sites)));
    const index = change === "removed" ? 0 : after.findIndex((row) => row.key === "term:AXC");
    if (change === "reordered") {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).not.toBe(beforeIndex);
    } else {
      expect(after.some((row) => row.key === "term:AXC")).toBe(false);
      expect(after.length).toBeLessThan(before.length);
      expect(after[0].key).toBe("term:AXA");
    }
    view.rerender(<WardHelpSheet {...props} />);

    expect(field.getAttribute("aria-activedescendant")).toBe(`ward-help-found-${index}`);
    const active = document.getElementById(field.getAttribute("aria-activedescendant") ?? "");
    expect(active?.textContent).toContain(after[index].title);
    expect(active?.getAttribute("data-active")).toBe("");
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onView).toHaveBeenCalledWith("reference");
    expect((field as HTMLInputElement).value).toBe("");
  });

  it("opens the same selected task after a desk change reorders answers", () => {
    const props = { view: "screen" as const, onView: vi.fn(), onClose: vi.fn(), onTour: vi.fn(), onShowMe: vi.fn() };
    const view = sheet(props);
    const field = type("handover");
    const selected = () => document.getElementById(field.getAttribute("aria-activedescendant") ?? "");
    // Make an explicit keyboard selection even when the intended task is initially the best answer.
    fireEvent.keyDown(field, { key: "ArrowDown" });
    fireEvent.keyDown(field, { key: "ArrowUp" });
    for (let step = 0; step < 20 && !selected()?.textContent?.includes("Print the handover sheet"); step += 1) {
      fireEvent.keyDown(field, { key: "ArrowDown" });
    }
    expect(selected()?.textContent).toContain("Print the handover sheet");
    const before = field.getAttribute("aria-activedescendant");

    live.role = "ward";
    view.rerender(<WardHelpSheet {...props} />);

    expect(field.getAttribute("aria-activedescendant")).not.toBe(before);
    expect(selected()?.textContent).toContain("Print the handover sheet");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onView).toHaveBeenCalledWith("tasks");
    expect(screen.getByRole("button", { name: /Print the handover sheet/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it.each(["Enter", "ArrowDown", "ArrowUp", "Escape"])(
    "leaves %s to text composition without navigating or closing Help",
    (key) => {
      const onView = vi.fn();
      const onClose = vi.fn();
      sheet({ onView, onClose });
      const field = type("what does pull expired mean");
      const active = field.getAttribute("aria-activedescendant");
      const heard = vi.fn();
      window.addEventListener("keydown", heard);
      try {
        const event = new KeyboardEvent("keydown", { key, isComposing: true, bubbles: true, cancelable: true });
        fireEvent(field, event);
        expect(event.defaultPrevented).toBe(false);
        expect(heard).not.toHaveBeenCalled();
        expect((field as HTMLInputElement).value).toBe("what does pull expired mean");
        expect(field.getAttribute("aria-activedescendant")).toBe(active);
        expect(onView).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(field, { key: "Enter" });
        expect(onView).toHaveBeenCalledWith("reference");
      } finally {
        window.removeEventListener("keydown", heard);
      }
    },
  );

  it("also protects composition reported through the legacy 229 key code", () => {
    const onView = vi.fn();
    sheet({ onView });
    const field = type("what does pull expired mean");
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(onView).not.toHaveBeenCalled();
    expect((field as HTMLInputElement).value).toBe("what does pull expired mean");
  });
  it("scrolls the active result into view without moving focus out of the search box", () => {
    sheet();
    const field = type("handover");
    field.focus();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    scroll.mockClear();
    fireEvent.keyDown(field, { key: "ArrowDown" });
    const active = document.getElementById(field.getAttribute("aria-activedescendant") ?? "");
    expect(active).not.toBeNull();
    expect(scroll).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
    expect(scroll.mock.contexts).toContain(active);
    expect(document.activeElement).toBe(field);
    scroll.mockClear();
    fireEvent.keyDown(field, { key: "Escape" });
    expect(scroll).not.toHaveBeenCalled();
  });
  it("Escape clears only the words, keeping the Help sheet open", () => {
    const onClose = vi.fn();
    sheet({ onClose });
    const field = type("pull a bed");
    expect(screen.queryByRole("tablist")).toBeNull();
    const outsideKey = vi.fn();
    window.addEventListener("keydown", outsideKey);
    try {
      fireEvent.keyDown(field, { key: "Escape" });
      expect(outsideKey).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", outsideKey);
    }
    expect((field as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("tablist", { name: "Help sections" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("mends a small typo and says what it searched for, with a way back to the typed words", () => {
    sheet();
    type("book trasnport");
    expect(screen.getByText(/Showing results for/).parentElement?.textContent).toMatch(/book transport/i);
    fireEvent.click(screen.getByRole("button", { name: /Search only/ }));
    expect(screen.queryByText(/Showing results for/)).toBeNull();
  });

  it.each(["pointer", "Enter"])("closes the Help sheet when a Settings answer is opened with %s", (method) => {
    function Host() {
      const [open, setOpen] = useState(true);
      return open ? (
        <WardHelpSheet
          view="screen"
          onView={vi.fn()}
          onClose={() => setOpen(false)}
          onTour={vi.fn()}
          onShowMe={vi.fn()}
        />
      ) : null;
    }
    render(<Host />);
    const field = type("high contrast");
    // The best answer is the guide, read in place; the Settings row below it opens Settings.
    const best = screen.getByRole("region", { name: "Best answer" });
    expect(best.textContent).toMatch(/Stronger edges/);
    expect(within(best).queryByRole("button")).toBeNull();
    const row = within(screen.getByRole("region", { name: "Screens" })).getByRole("button", { name: /^High contrast/ });
    if (method === "pointer") fireEvent.click(row);
    else {
      const active = () => document.getElementById(field.getAttribute("aria-activedescendant") ?? "");
      for (let step = 0; step < 20 && active()?.textContent !== row.textContent; step += 1) {
        fireEvent.keyDown(field, { key: "ArrowDown" });
      }
      expect(active()?.textContent).toBe(row.textContent);
      fireEvent.keyDown(field, { key: "Enter" });
    }
    expect(screen.queryByTestId("ward-help-sheet")).toBeNull();
  });

  it("opens Reference at a glossary word the search found", () => {
    const onView = vi.fn<(view: HelpView) => void>();
    sheet({ onView });
    const field = type("what does pull expired mean");
    expect(screen.getByRole("region", { name: "Best answer" }).textContent).toContain("Pull expired");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onView).toHaveBeenCalledWith("reference");
    expect((field as HTMLInputElement).value).toBe("");
  });
});

describe("Help result walkthrough availability", () => {
  it.each([
    { phone: false, enabled: false, advertised: false },
    { phone: true, enabled: true, advertised: false },
    { phone: false, enabled: true, advertised: true },
  ])("advertises printing only when the device and feature permit it: %j", ({ phone, enabled, advertised }) => {
    const task = HOW_TOS.find((task) => task.id === "print-handover")!;
    const onShowMe = vi.fn();
    render(
      <HelpFindResults
        found={{
          kind: "results",
          closest: false,
          groups: [
            {
              name: "Jobs",
              rows: [
                {
                  key: "howto:print-handover",
                  group: "Guides",
                  title: task.title,
                  detail: task.answer,
                  howToId: task.id,
                },
              ],
            },
          ],
        }}
        query="print"
        role="bed_manager"
        active={0}
        onChoose={vi.fn()}
        onShowMe={onShowMe}
        canShow={(id) => id === task.id && canShowTask(task, "bed_manager", "/ward-flow", phone, enabled)}
        onUseTyped={vi.fn()}
      />,
    );
    expect(Boolean(screen.queryByLabelText("Has Show me"))).toBe(advertised);
    expect(onShowMe).not.toHaveBeenCalled();
  });
});
