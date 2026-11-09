import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: "Search Help" }).getAttribute("placeholder")).toBe(
      "Ask a question or search Help",
    );
    expect(screen.queryByTestId("ward-help-ask-input")).toBeNull();
  });

  it("puts a handed-over question in the one search box, with its best answer open", () => {
    const onShowMe = vi.fn();
    sheet({ view: "screen", ask: "how do I pull a bed", onShowMe });
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("how do I pull a bed");
    const best = screen.getByRole("region", { name: "Best answer" });
    expect(best.textContent).toContain("Pull the bed for a patient");
    fireEvent.click(screen.getByRole("button", { name: "Show me on screen" }));
    expect(onShowMe).toHaveBeenCalledWith("pull-bed");
    // The tabs give way to the answers while words are typed.
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("offers questions to try when the box is focused and empty", () => {
    sheet();
    // Help opens with the caret in the box on a computer; Try asking shows once the person clicks it.
    fireEvent.pointerDown(screen.getByRole("combobox"));
    fireEvent.focus(screen.getByRole("combobox"));
    const tryAsking = screen.getByRole("region", { name: "Try asking" });
    // Home has its own walk round and questions (5 Nov 2026), which come before the general ones.
    expect(within(tryAsking).getByRole("button", { name: "Show me around Home" })).toBeTruthy();
    fireEvent.click(within(tryAsking).getByRole("button", { name: "How do I place a patient from Home?" }));
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("How do I place a patient from Home?");
  });

  it("keeps Try asking open while Tab moves from the box into it, and closes it once focus leaves", () => {
    sheet();
    const box = screen.getByRole("combobox");
    fireEvent.pointerDown(box);
    fireEvent.focus(box);
    expect(box.getAttribute("aria-controls")).toBeNull();
    const first = within(screen.getByRole("region", { name: "Try asking" })).getAllByRole("button")[0];
    vi.useFakeTimers();
    try {
      fireEvent.blur(box, { relatedTarget: first });
      act(() => {
        first.focus();
        vi.advanceTimersByTime(300);
      });
    } finally {
      vi.useRealTimers();
    }
    expect(screen.getByRole("region", { name: "Try asking" })).toBeTruthy();
    const desk = screen.getByTestId("ward-help-desk-open");
    fireEvent.blur(first, { relatedTarget: desk });
    expect(screen.queryByRole("region", { name: "Try asking" })).toBeNull();
  });

  it("says plainly when nothing in Help matches, with no key hints", () => {
    sheet({ ask: "zzqx" });
    expect(screen.getByTestId("ward-help-found-empty").textContent).toMatch(/No match in Help for .zzqx./u);
    expect(screen.queryByText(/These are the closest/)).toBeNull();
    expect(screen.queryByText("Nothing you type is saved")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("No answers in Help");
    expect(screen.getByRole("combobox").getAttribute("aria-controls")).toBe("ward-help-found");
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
