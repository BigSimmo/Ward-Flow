import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.removeItem("ward-flow-character-shortcuts");
  });

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

  it("leaves ? alone in a field, when a page took it, or with single-key shortcuts off", () => {
    vi.useFakeTimers();
    render(
      <>
        <input aria-label="field" />
        <WardHelpHost />
      </>,
    );
    // TE-08: "?" is judged on a zero-delay timer (ward-shortcuts-key.ts), so each press runs that
    // timer on fake time before checking. The last press is the control: it proves the listener is
    // live, so the empty results mean something.
    const press = (target: Window | Element) => {
      fireEvent.keyDown(target, { key: "?" });
      act(() => vi.advanceTimersByTime(0));
    };
    press(screen.getByLabelText("field"));
    expect(screen.queryByTestId("ward-help-sheet")).toBeNull();
    const taken = new KeyboardEvent("keydown", { key: "?", cancelable: true });
    taken.preventDefault();
    window.dispatchEvent(taken);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.queryByTestId("ward-help-sheet")).toBeNull();
    window.localStorage.setItem("ward-flow-character-shortcuts", "off");
    press(window);
    expect(screen.queryByTestId("ward-help-sheet")).toBeNull();
    window.localStorage.removeItem("ward-flow-character-shortcuts");
    press(window);
    expect(screen.getByTestId("ward-help-sheet")).toBeTruthy();
  });
});
