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
  it("has one box for searching and asking, and no second empty Ask box (Josh, 31 Oct 2026)", () => {
    render(<WardHelpSheet view="glossary" ask="" onView={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-help-search-field").textContent).toContain("Search Help");
    expect(screen.queryByTestId("ward-help-ask-input")).toBeNull();
    expect(screen.queryByText("Ask a question", { selector: "summary" })).toBeNull();
  });

  it("shows a handed-over answer in the Ask box, which stands in for the search field", () => {
    render(<WardHelpSheet view="screen" ask="how do I pull a bed" onView={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-help-ask-answer-pull-bed")).toBeVisible();
    expect(screen.queryByTestId("ward-help-search-field")).toBeNull();
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
  });

  it("keeps the tour as How do I…'s first row and all three sections working", () => {
    const onView = vi.fn();
    render(<WardHelpSheet view="desk" ask="" onView={onView} onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-help-tasks").contains(screen.getByTestId("ward-help-view-tour"))).toBe(true);
    fireEvent.click(screen.getByTestId("ward-help-view-tour"));
    expect(onView).toHaveBeenLastCalledWith("tour");
    for (const view of ["tasks", "glossary", "new"]) {
      fireEvent.click(screen.getByTestId(`ward-help-view-${view}`));
      expect(onView).toHaveBeenLastCalledWith(view);
    }
    expect(screen.queryByTestId("ward-help-view-screen")).toBeNull();
    expect(screen.queryByTestId("ward-help-view-desk")).toBeNull();
  });
});
