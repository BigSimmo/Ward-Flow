import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardHelpSearch } from "@/components/ward-management/help/ward-help-search";

/** Help search (variant A): a field in the Help sheet that opens a centred search box. */

function openSearch() {
  render(<WardHelpSearch role="bed_manager" home="/ward-flow" />);
  fireEvent.click(screen.getByTestId("ward-help-search-field"));
  return screen.getByRole("combobox", { name: "Search Help" });
}

describe("WardHelpSearch", () => {
  it("opens a dialog with suggestions for the desk, focused on the box", () => {
    const input = openSearch();
    expect(screen.getByRole("dialog", { name: "Search Help" })).toBeTruthy();
    expect(document.activeElement).toBe(input);
    expect(screen.getByText("Suggested for Bed manager")).toBeTruthy();
  });

  it("shows grouped results and the approved clinical reply", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "pull a bed" } });
    expect(screen.getByText("Guides")).toBeTruthy();
    fireEvent.change(input, { target: { value: "what dose should I give" } });
    expect(screen.getByTestId("ward-help-search-clinical").textContent).toContain(
      "Help covers how to use Ward Flow, not clinical decisions.",
    );
  });

  it("moves with arrows, closes with Esc and returns focus", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "bed" } });
    const first = input.getAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).not.toBe(first);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("ward-help-search-field"));
  });

  it("joins the shared modal stack while open", () => {
    openSearch();
    expect(hasOpenSheet()).toBe(true);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(hasOpenSheet()).toBe(false);
  });

  it("never writes typed words to storage", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "unique-typed-words" } });
    const stored = [...Array(localStorage.length).keys()].map((i) => localStorage.getItem(localStorage.key(i) ?? ""));
    expect(stored.join(" ")).not.toContain("unique-typed-words");
  });
});
