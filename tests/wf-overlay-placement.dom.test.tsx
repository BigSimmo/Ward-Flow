/** @vitest-environment jsdom */

import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog, Menu, Popover } from "@/components/wf";
import { OverlayPortal, OverlayScope } from "@/components/wf/overlay-root";
import { overlayOpener } from "@/components/wf/sheet-focus";

/*
 * Popups audit, 21 Oct 2026: portalled overlays lost the Ward tokens, long menus and popovers ran off
 * the window, and Safari returned focus to nowhere because a tapped button is never focused.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function rect(top: number, height: number, left = 100, width = 200): DOMRect {
  return {
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("OverlayScope", () => {
  it("puts the area's token class on every portalled overlay while mounted", () => {
    const { unmount } = render(
      <>
        <OverlayScope className="tokens-under-test" />
        <OverlayPortal layer="toast">
          <p>Saved</p>
        </OverlayPortal>
      </>,
    );
    expect(screen.getByText("Saved").closest("[data-overlay-layer]")).toHaveClass("tokens-under-test");
    unmount();
  });

  it("leaves overlays bare when no area declares a scope", () => {
    render(
      <OverlayPortal layer="toast">
        <p>Bare</p>
      </OverlayPortal>,
    );
    expect(screen.getByText("Bare").closest("[data-overlay-layer]")?.getAttribute("class")).toBeNull();
  });
});

describe("menu and popover placement", () => {
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: `w${index}`,
    label: `Ward ${index}`,
    onSelect: () => {},
  }));

  it("caps a long menu to the room below its trigger and scrolls inside it", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("role") === "menu") return rect(140, 760);
      return rect(100, 34);
    });
    render(
      <Menu
        label="Change ward"
        items={items}
        trigger={(props) => (
          <button type="button" {...props}>
            Change ward
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change ward" }));
    const menu = screen.getByRole("menu", { name: "Change ward" });
    expect(menu.style.overflowY).toBe("auto");
    expect(parseFloat(menu.style.maxHeight)).toBeLessThanOrEqual(800 - 134);
    expect(menu.style.bottom).toBe("");
  });

  it("opens a popover above a trigger near the bottom of the window", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("role") === "dialog") return rect(760, 300);
      return rect(720, 34);
    });
    render(
      <Popover
        label="Keyboard shortcuts"
        trigger={(props) => (
          <button type="button" {...props}>
            Shortcuts
          </button>
        )}
      >
        {() => <p>J and K step through patients</p>}
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Shortcuts" }));
    const panel = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(panel.style.bottom).toBe("calc(100% + 6px)");
    expect(panel.style.top).toBe("auto");
  });

  it("refits an open menu when the window is resized", () => {
    let height = 800;
    vi.spyOn(window, "innerHeight", "get").mockImplementation(() => height);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("role") === "menu") return rect(140, 300);
      return rect(100, 34);
    });
    render(
      <Menu
        label="Change ward"
        items={items}
        trigger={(props) => (
          <button type="button" {...props}>
            Change ward
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change ward" }));
    const menu = screen.getByRole("menu", { name: "Change ward" });
    expect(menu.style.maxHeight).toBe("");
    height = 360;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(menu.style.overflowY).toBe("auto");
    expect(parseFloat(menu.style.maxHeight)).toBeLessThanOrEqual(360 - 134);
    height = 800;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(menu.style.maxHeight).toBe("");
  });

  it("slides a panel back inside the right edge", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1280);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("role") === "menu") return rect(140, 200, 1100, 300);
      return rect(100, 34, 1100, 100);
    });
    render(
      <Menu
        label="More"
        items={items.slice(0, 3)}
        trigger={(props) => (
          <button type="button" {...props}>
            More
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("menu", { name: "More" }).style.translate).toBe("-128px 0");
  });
});

describe("focus return after a tap in Safari", () => {
  it("names the last pressed control when the tap did not focus it", () => {
    render(
      <button type="button" data-testid="opener">
        Activity
      </button>,
    );
    const opener = screen.getByTestId("opener");
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.pointerDown(opener);
    expect(document.activeElement).toBe(document.body);
    expect(overlayOpener()).toBe(opener);
  });

  it("returns focus to the tapped control when the dialog closes", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open notes
          </button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Notes">
            <p>Synthetic note</p>
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open notes" });
    (document.activeElement as HTMLElement | null)?.blur();
    // Safari: the press reaches the button but focus stays on <body>.
    fireEvent.pointerDown(opener);
    fireEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Notes" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByRole("dialog", { name: "Notes" })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
