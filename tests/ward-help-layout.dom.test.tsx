import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import { CLINICAL_REPLY } from "@/components/ward-management/help/ward-help-search-index";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

describe("search-first Help layout", () => {
  it("keeps the optional empty Ask box inside Reference and makes it reachable", () => {
    render(<WardHelpSheet view="glossary" ask="" onView={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByTestId("ward-help-ask-input");
    expect(input).not.toBeVisible();
    fireEvent.click(screen.getByText("Reference", { selector: "summary" }));
    fireEvent.click(screen.getByText("Ask a question", { selector: "summary" }));
    expect(input).toBeVisible();
    fireEvent.change(input, { target: { value: "what dose should I give" } });
    expect(screen.getByTestId("ward-help-ask-clinical").textContent).toBe(CLINICAL_REPLY);
  });

  it("shows a handed-over answer immediately without opening Reference", () => {
    render(<WardHelpSheet view="screen" ask="how do I pull a bed" onView={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-help-ask-answer-pull-bed")).toBeVisible();
    expect(screen.getByTestId("ward-help-reference")).not.toHaveAttribute("open");
  });

  it("keeps the tour and all four sections working from the compact controls", () => {
    const onView = vi.fn();
    render(<WardHelpSheet view="desk" ask="" onView={onView} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ward-help-view-tour"));
    expect(onView).toHaveBeenLastCalledWith("tour");
    for (const view of ["desk", "screen", "glossary", "new"]) {
      fireEvent.click(screen.getByTestId(`ward-help-view-${view}`));
      expect(onView).toHaveBeenLastCalledWith(view);
    }
  });
});
