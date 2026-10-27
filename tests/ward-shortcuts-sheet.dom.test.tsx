import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardHelpHost } from "@/components/ward-management/help/ward-help-host";
import { KEYBOARD_SHORTCUTS } from "@/components/ward-management/help/ward-help-content";

/** P120 (Josh 27 Oct 2026): "?" opens a keyboard shortcuts sheet on any screen. */
describe("keyboard shortcuts sheet", () => {
  afterEach(() => window.localStorage.removeItem("ward-flow-character-shortcuts"));

  it("opens on ? anywhere and lists every shortcut", async () => {
    render(<WardHelpHost />);
    fireEvent.keyDown(window, { key: "?" });
    const list = await screen.findByTestId("ward-shortcuts-list", {}, { timeout: 3000 });
    for (const item of KEYBOARD_SHORTCUTS) expect(list.textContent).toContain(item.action);
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
    await waitFor(() => expect(screen.queryByTestId("ward-shortcuts-list")).toBeNull());
  });
});
