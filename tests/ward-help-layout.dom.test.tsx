import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

describe("search-first Help layout", () => {
  it("has one box for searching and asking, and no second empty Ask box (redesign, #1118)", () => {
    render(<WardHelpSheet view="glossary" ask="" onView={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-help-search-field").textContent).toContain("Search Help, or ask");
    expect(screen.queryByTestId("ward-help-ask-input")).toBeNull();
    fireEvent.click(screen.getByText("Reference", { selector: "summary" }));
    expect(screen.queryByText("Ask a question", { selector: "summary" })).toBeNull();
  });

  it("shows a handed-over answer immediately without opening Reference", () => {
    render(<WardHelpSheet view="screen" ask="how do I pull a bed" onView={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-help-ask-answer-pull-bed")).toBeVisible();
    expect(screen.getByTestId("ward-help-reference")).not.toHaveAttribute("open");
  });

  it("keeps the tour and all five sections working, with the tour at the foot of the view", () => {
    const onView = vi.fn();
    render(<WardHelpSheet view="desk" ask="" onView={onView} onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-help-end").contains(screen.getByTestId("ward-help-view-tour"))).toBe(true);
    fireEvent.click(screen.getByTestId("ward-help-view-tour"));
    expect(onView).toHaveBeenLastCalledWith("tour");
    for (const view of ["tasks", "desk", "screen", "glossary", "new"]) {
      fireEvent.click(screen.getByTestId(`ward-help-view-${view}`));
      expect(onView).toHaveBeenLastCalledWith(view);
    }
  });
});
