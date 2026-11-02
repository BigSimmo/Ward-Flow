import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Ask help (26 Oct 2026): a question handed to Help is answered from the app's own help, offers
 * Show me only for the desk's own jobs, and keeps the typed question out of browser storage. The
 * stand-alone Ask box was retired on 2 Nov 2026 (Josh approved); these cases cover the Help sheet.
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

import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import { CLINICAL_REPLY } from "@/components/ward-management/help/ward-help-search-index";

function renderSheet(ask: string | undefined, onShowMe = vi.fn()) {
  return render(
    <WardHelpSheet
      view="screen"
      ask={ask}
      showMeOn
      onView={vi.fn()}
      onClose={vi.fn()}
      onTour={vi.fn()}
      onShowMe={onShowMe}
    />,
  );
}

function helpField() {
  return screen.getByRole("searchbox", { name: "Search Help" });
}

describe("Ask help in the Help sheet", () => {
  it.each([
    "what dose should I give",
    "should I discharge transport",
    "medication dark mode",
    "Is this patient safe to transfer?",
  ])("shows only the approved reply for a clinical question: %s", (query) => {
    renderSheet(query);
    const reply = screen.getByRole("status");
    expect(reply.textContent).toBe(CLINICAL_REPLY);
    // The reply is the only thing announced: no answer count speaks over it.
    expect(screen.getAllByRole("status")).toEqual([reply]);
    expect(screen.queryByRole("region", { name: "Best answer" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Words" })).toBeNull();
    expect(screen.queryByText(/These are the closest/)).toBeNull();
  });

  it("offers the closest topics in the live region when nothing matches every word", () => {
    renderSheet("bed giraffe elephant");
    const note = screen.getByText("Nothing matches every word. These are the closest.");
    expect(note).toBeTruthy();
    // A short count is announced, not every row at each key press.
    const summary = screen.getByRole("status");
    expect(summary.textContent).toMatch(/^[1-9]\d* answers?$/);
    expect(screen.queryByRole("region", { name: "Best answer" })).toBeNull();
    fireEvent.change(helpField(), { target: { value: "dark mode" } });
    expect(screen.queryByText(/These are the closest/)).toBeNull();
    expect(screen.getByRole("region", { name: "Best answer" }).textContent).toMatch(/Theme|dark/i);
  });

  it("returns to ordinary results after a clinical question is replaced", () => {
    renderSheet("what dose should I give");
    fireEvent.change(helpField(), { target: { value: "pull a bed" } });
    expect(screen.queryByText(CLINICAL_REPLY)).toBeNull();
    expect(screen.getByRole("region", { name: "Best answer" }).textContent).toContain("Pull the bed for a patient");
  });

  it("opens on the tabs with an empty box when nothing is handed over", () => {
    renderSheet(undefined);
    expect((helpField() as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("tablist", { name: "Help sections" })).toBeTruthy();
  });

  it("answers a handed-over question with its steps, Show me and a way into How do I…", () => {
    const onShowMe = vi.fn();
    renderSheet("how do I pull a bed", onShowMe);
    const best = screen.getByRole("region", { name: "Best answer" });
    expect(within(best).getAllByText(/press Pull the bed/).length).toBeGreaterThan(0);
    expect(within(best).getByRole("list", { name: "Steps" })).toBeTruthy();
    fireEvent.click(within(best).getByRole("button", { name: "Show me on screen" }));
    expect(onShowMe).toHaveBeenCalledWith("pull-bed");
    fireEvent.click(within(best).getByRole("button", { name: /Open in How to/ }));
    expect(screen.getByTestId("ward-help-task-answer-pull-bed")).toBeTruthy();
  });

  it("never writes words typed in Help's search to storage or URL history", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    renderSheet(undefined);
    fireEvent.change(helpField(), { target: { value: "bed qzxvwk qzxvwl" } });
    fireEvent.keyDown(helpField(), { key: "Enter" });
    expect(JSON.stringify([...write.mock.calls, ...push.mock.calls, ...replace.mock.calls])).not.toMatch(
      /qzxvwk|qzxvwl/,
    );
  });
});
