import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/** Help search (variant A) in the Help sheet: the field opens the centred search box. */

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

describe("Help sheet search field", () => {
  it("closes the parent Help sheet when a search result opens its destination", () => {
    function Host() {
      const [open, setOpen] = useState(true);
      return open ? (
        <WardHelpSheet view="screen" ask={undefined} onView={vi.fn()} onClose={() => setOpen(false)} />
      ) : null;
    }
    render(<Host />);
    fireEvent.click(screen.getByTestId("ward-help-search-field"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "dark mode" } });
    fireEvent.click(screen.getByTestId("ward-help-search-result-setting:theme"));
    expect(screen.queryByTestId("ward-help-sheet")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Search Help" })).toBeNull();
  });

  it("Escape closes only search and returns focus to the Help sheet", async () => {
    const onClose = vi.fn();
    render(<WardHelpSheet view="screen" ask={undefined} onView={vi.fn()} onClose={onClose} />);
    const field = screen.getByTestId("ward-help-search-field");
    fireEvent.click(field);
    const outsideKey = vi.fn();
    window.addEventListener("keydown", outsideKey);
    try {
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
      expect(outsideKey).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", outsideKey);
    }
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is in the sheet and opens the search box with the desk's suggestions", () => {
    render(<WardHelpSheet view="screen" ask={undefined} onView={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ward-help-search-field"));
    expect(screen.getByRole("dialog", { name: "Search Help" })).toBeTruthy();
    expect(screen.getByText("Suggested for Bed manager")).toBeTruthy();
  });
});
