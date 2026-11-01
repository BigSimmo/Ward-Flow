import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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
  useTourRole: () => "bed_manager",
}));

import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import type { HelpView } from "@/components/ward-management/help/ward-help-events";

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
