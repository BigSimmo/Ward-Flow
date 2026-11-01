import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardHelpHost } from "@/components/ward-management/help/ward-help-host";

import { shortcutsForDesk } from "@/components/ward-management/help/ward-help-content";

/**
 * P120 (Josh 27 Oct 2026): "?" opens the keyboard shortcuts on any screen. Help redesign (1 Nov 2026):
 * they are a view inside Help, with Back to Help.
 */
describe("keyboard shortcuts in Help", () => {
  afterEach(() => window.localStorage.removeItem("ward-flow-character-shortcuts"));

  async function openKeys() {
    render(<WardHelpHost />);
    fireEvent.keyDown(window, { key: "?" });
    await screen.findByRole("heading", { name: "Keyboard shortcuts" }, { timeout: 3000 });
    return screen.getByTestId("ward-help-sheet");
  }

  it("opens on ? anywhere and lists every shortcut this desk can use", async () => {
    const sheet = await openKeys();
    const titles = [...sheet.querySelectorAll<HTMLElement>("[title]")].map((row) => row.title);
    for (const item of shortcutsForDesk("coordinator")) expect(titles).toContain(item.action);
  });

  it("shows each key's short label in its group, keeping Help's sentence as the hover title (round 2, #1118)", async () => {
    const sheet = await openKeys();
    for (const group of ["Find", "Open", "Move around"]) {
      expect(within(sheet).getByRole("region", { name: group })).toBeTruthy();
    }
    const search = [...sheet.querySelectorAll<HTMLElement>("[title]")].find((row) =>
      row.title.startsWith("Search, from"),
    );
    expect(search?.firstChild?.textContent).toBe("Search");
  });

  it("goes back to Help from the shortcuts", async () => {
    await openKeys();
    fireEvent.click(screen.getByRole("button", { name: "Back to Help" }));
    expect(screen.getByRole("tablist", { name: "Help sections" })).toBeTruthy();
  });

  it("leaves ? alone in a field, when a page took it, or with single-key shortcuts off", async () => {
    render(
      <>
        <input aria-label="field" />
        <WardHelpHost />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText("field"), { key: "?" });
    const taken = new KeyboardEvent("keydown", { key: "?", cancelable: true });
    taken.preventDefault();
    window.dispatchEvent(taken);
    window.localStorage.setItem("ward-flow-character-shortcuts", "off");
    fireEvent.keyDown(window, { key: "?" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await waitFor(() => expect(screen.queryByTestId("ward-help-sheet")).toBeNull());
  });
});
