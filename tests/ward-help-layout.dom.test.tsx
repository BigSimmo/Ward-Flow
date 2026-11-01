import { fireEvent, render, screen, within } from "@testing-library/react";
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

describe("search-first Help layout", () => {
  it("has one box for searching and asking, and no second empty Ask box (Josh, 31 Oct 2026)", () => {
    sheet({ view: "glossary", ask: "" });
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getByRole("searchbox", { name: "Search Help" }).getAttribute("placeholder")).toBe(
      "Ask a question or search Help",
    );
    expect(screen.queryByTestId("ward-help-ask-input")).toBeNull();
  });

  it("puts a handed-over question in the one search box, with its best answer open", () => {
    const onShowMe = vi.fn();
    sheet({ view: "screen", ask: "how do I pull a bed", onShowMe });
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("how do I pull a bed");
    const best = screen.getByRole("region", { name: "Best answer" });
    expect(best.textContent).toContain("Pull the bed for a patient");
    fireEvent.click(screen.getByRole("button", { name: "Show me on screen" }));
    expect(onShowMe).toHaveBeenCalledWith("pull-bed");
    // The tabs give way to the answers while words are typed.
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("offers questions to try when the box is focused and empty", () => {
    sheet();
    fireEvent.focus(screen.getByRole("searchbox"));
    const tryAsking = screen.getByRole("region", { name: "Try asking" });
    fireEvent.click(within(tryAsking).getByRole("button", { name: "What does Held up mean?" }));
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("What does Held up mean?");
  });

  it("keeps the tour as one row in How do I…, and all four tabs working", () => {
    const onView = vi.fn();
    const onTour = vi.fn();
    sheet({ onView, onTour });
    fireEvent.click(screen.getByTestId("ward-help-view-tour"));
    expect(onTour).toHaveBeenCalledTimes(1);
    for (const [name, view] of [
      ["Common questions", "questions"],
      ["Reference", "reference"],
      [/What.s new/u, "new"],
    ] as const) {
      fireEvent.click(screen.getByRole("tab", { name }));
      expect(onView).toHaveBeenLastCalledWith(view);
    }
  });
});
