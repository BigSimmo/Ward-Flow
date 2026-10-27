import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KEYBOARD_SHORTCUTS } from "@/components/ward-management/help/ward-help-content";
import { setCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { WardShortcutKey } from "@/components/ward-management/shell/ward-shortcut-key";

async function press(target: Element, init: KeyboardEventInit = {}) {
  await act(async () => {
    fireEvent.keyDown(target, { key: "?", ...init });
    await new Promise((r) => setTimeout(r, 0));
  });
}

afterEach(() => setCharacterShortcutsEnabled(true));

describe("P13 shortcut sheet", () => {
  it("opens on ? and lists exactly the Help shortcuts", async () => {
    render(<WardShortcutKey />);
    await press(document.body);
    const sheet = await screen.findByTestId("ward-shortcut-sheet");
    const keys = within(sheet)
      .getAllByRole("term")
      .map((el) => el.textContent);
    expect(keys).toEqual(KEYBOARD_SHORTCUTS.map((s) => s.keys));
    expect(
      within(sheet)
        .getAllByRole("definition")
        .map((el) => el.textContent),
    ).toEqual(KEYBOARD_SHORTCUTS.map((s) => s.action));
  });

  it("ignores ? while typing in a field", async () => {
    render(
      <>
        <input aria-label="note" />
        <WardShortcutKey />
      </>,
    );
    await press(screen.getByLabelText("note"));
    expect(screen.queryByTestId("ward-shortcut-sheet")).toBeNull();
  });

  it("leaves a page that handles ? itself alone", async () => {
    const own = (e: KeyboardEvent) => e.key === "?" && e.preventDefault();
    window.addEventListener("keydown", own);
    render(<WardShortcutKey />);
    await press(document.body);
    window.removeEventListener("keydown", own);
    expect(screen.queryByTestId("ward-shortcut-sheet")).toBeNull();
  });

  it("does nothing when single-key shortcuts are off in Settings", async () => {
    setCharacterShortcutsEnabled(false);
    render(<WardShortcutKey />);
    await press(document.body);
    expect(screen.queryByTestId("ward-shortcut-sheet")).toBeNull();
  });
});
