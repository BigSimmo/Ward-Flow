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
  it("combines group and text filters and clears an empty result", () => {
    render(<WardHelpGlossary termsSource={GLOSSARY} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Group" }), { target: { value: "Beds" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nurse" } });
    expect(screen.getByRole("status").textContent).toContain("No word or code matches");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
    expect(screen.getByText("NIC")).toBeTruthy();
  });
  it("follows related terms without retaining the previous group or saving typed words", () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    const before = location.href;
    render(<WardHelpGlossary termsSource={GLOSSARY} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Beds" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Held bed" } });
    fireEvent.click(screen.getByRole("button", { name: "Held up" }));
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("all");
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("Held up");
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    expect(screen.getByText("A discharge or move that is delayed. It is not a bed state.")).toBeTruthy();
    expect(set.mock.calls.some((args) => args.some((value) => /Held bed|Held up/.test(String(value))))).toBe(false);
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
    const shortcuts = screen.getByTestId("ward-help-reference-shortcuts");
    expect(shortcuts.textContent).toContain("?");
    expect(shortcuts.textContent).not.toContain("Shift+R");
    expect(within(roles).getAllByRole("link", { hidden: true, name: "Printable desk guide (A4)" })).toHaveLength(9);
  });
});
