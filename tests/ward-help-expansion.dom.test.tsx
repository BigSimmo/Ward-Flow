import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardHelpGlossary } from "../src/components/ward-management/help-content/ward-help-glossary-view";
import { WardHelpReference } from "../src/components/ward-management/help-content/ward-help-reference-view";
import { GLOSSARY } from "../src/components/ward-management/help/ward-help-content";
import { ROLE_SCREENS, screenForPath } from "../src/components/ward-management/ward-role-access";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
describe("Help glossary and compact Reference", () => {
  it("lists every word with no filter of its own, Help's one search box finds them", () => {
    render(<WardHelpGlossary termsSource={GLOSSARY} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Group" })).toBeNull();
    expect(screen.getByText("NIC")).toBeTruthy();
  });
  it("follows related terms to the word itself without saving anything or changing the address", () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    const before = location.href;
    render(<WardHelpGlossary termsSource={GLOSSARY} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Held up" })[0]!);
    expect(document.activeElement?.textContent).toBe("Held up");
    expect(screen.getAllByText("A discharge or move that is delayed. It is not a bed state.").length).toBeGreaterThan(
      0,
    );
    expect(set).not.toHaveBeenCalled();
    expect(location.href).toBe(before);
  });
  it("uses only a supplied public glossary, including active directory codes", () => {
    render(<WardHelpGlossary termsSource={[{ term: "TEST-SITE", meaning: "Synthetic released site" }]} />);
    expect(screen.getByText("TEST-SITE")).toBeTruthy();
    expect(screen.queryByText("RPH")).toBeNull();
  });
  it("puts your role first and never links a screen your desk cannot open", () => {
    render(<WardHelpReference role="executive" onClose={vi.fn()} />);
    const roles = screen.getByTestId("ward-help-roles");
    expect(roles.firstElementChild?.textContent).toContain("Executive · Your desk");
    expect(roles.firstElementChild?.hasAttribute("open")).toBe(true);
    for (const anchor of roles.querySelectorAll<HTMLAnchorElement>('a[href^="/ward-flow"]')) {
      const id = screenForPath(anchor.getAttribute("href")!)?.screen;
      expect(id && ROLE_SCREENS.executive[id]).toBeTruthy();
    }
    expect(screen.getByText("Interactions")).toBeTruthy();
    expect(screen.getByText("Show me highlights a control on the screen.")).toBeTruthy();
    // The keys live in the shortcuts sheet only, filtered by desk (Josh, 31 Oct 2026).
    expect(screen.queryByTestId("ward-help-reference-shortcuts")).toBeNull();
    expect(within(roles).getAllByRole("link", { hidden: true, name: "Printable desk guide (A4)" })).toHaveLength(9);
  });
});
