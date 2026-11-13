/** @vitest-environment jsdom */

import { useRef, useState, type ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, useModalFocus, type UseModalFocusOptions } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import { isTopmostSheet, popSheet, pushSheet } from "@/components/wf/sheet-focus";

/*
 * Spec items 5 and 16 (shared design parts, 13 Nov 2026): Escape closes the top layer even from a
 * closed drop-down; a box that would open on a drop-down opens on its heading; a scroll-only dialog
 * body is a named stop; focus returns to the next row, else the heading, when the opener has left
 * the page; and a layer that re-registers keeps its place in the one modal stack.
 */

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
    length: 1,
    item: () => null,
    [Symbol.iterator]: function* () {
      yield {} as DOMRect;
    },
  } as DOMRectList);
});

afterEach(() => {
  vi.restoreAllMocks();
});

type LayerProps = Partial<Omit<UseModalFocusOptions, "open" | "onClose" | "panelRef">> & {
  name: string;
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
};

function Layer({ name, open, onClose, children, ...options }: LayerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { rootRef } = useModalFocus({ open, onClose, panelRef, ...options });
  if (!open) return null;
  return (
    <div ref={rootRef}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={`${name}-title`} tabIndex={-1}>
        <h2 id={`${name}-title`}>{name}</h2>
        {children ?? <button type="button">{name} control</button>}
      </div>
    </div>
  );
}

describe("Escape from a closed drop-down", () => {
  it("closes a useModalFocus layer, a Dialog and a Sheet", () => {
    const onLayer = vi.fn();
    const onDialog = vi.fn();
    const onSheet = vi.fn();
    const { rerender } = render(
      <Layer name="Layer" open onClose={onLayer} focusOnOpen="immediate">
        <select aria-label="Layer choice">
          <option>One</option>
        </select>
      </Layer>,
    );
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Layer choice" }), { key: "Escape" });
    expect(onLayer).toHaveBeenCalledTimes(1);

    rerender(
      <Dialog open onClose={onDialog} title="Dialog">
        <select aria-label="Dialog choice">
          <option>One</option>
        </select>
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Dialog choice" }), { key: "Escape" });
    expect(onDialog).toHaveBeenCalledTimes(1);

    rerender(
      <Sheet open onClose={onSheet} title="Sheet">
        <select aria-label="Sheet choice">
          <option>One</option>
        </select>
      </Sheet>,
    );
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Sheet choice" }), { key: "Escape" });
    expect(onSheet).toHaveBeenCalledTimes(1);
  });

  it("still leaves Escape to a field inside that handled it", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Picker sheet">
        <input aria-label="Search picker" onKeyDown={(event) => event.key === "Escape" && event.preventDefault()} />
      </Sheet>,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("a box that would open on a drop-down", () => {
  it("opens a useModalFocus layer on its heading, and Tab then reaches the drop-down", () => {
    render(
      <Layer name="Record a form" open onClose={() => {}} focusOnOpen="immediate">
        <select aria-label="Movement">
          <option>Choose a movement</option>
        </select>
      </Layer>,
    );
    const heading = screen.getByRole("heading", { name: "Record a form" });
    expect(document.activeElement).toBe(heading);
    expect(heading).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Movement" }));
  });

  it("opens a Sheet whose initial focus is a drop-down on its heading", async () => {
    function Probe() {
      const selectRef = useRef<HTMLSelectElement>(null);
      return (
        <Sheet open onClose={() => {}} title="Record a form" initialFocusRef={selectRef}>
          <select ref={selectRef} aria-label="Movement">
            <option>Choose a movement</option>
          </select>
        </Sheet>
      );
    }
    render(<Probe />);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Record a form" }));
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });
});

describe("a dialog body that only scrolls", () => {
  it("becomes a named stop while it overflows with nothing to focus inside", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
    render(
      <Dialog open onClose={() => {}} title="Bed meeting sheet">
        <p>Long read-only text.</p>
      </Dialog>,
    );
    const body = screen.getByRole("region", { name: "Bed meeting sheet, scroll with arrow keys" });
    expect(body).toHaveAttribute("tabindex", "0");
  });

  it("stays out of the Tab order when it holds a control", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
    render(
      <Dialog open onClose={() => {}} title="Form">
        <button type="button">Inside</button>
      </Dialog>,
    );
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("focus return when the opener has left the page", () => {
  function Rows({ fallbackHeading = true }: { fallbackHeading?: boolean }) {
    const [rows, setRows] = useState(["Ashby", "Cadwaller", "Dunmore"]);
    const [openFor, setOpenFor] = useState<string | null>(null);
    return (
      <section>
        {fallbackHeading ? <h2>Act now</h2> : null}
        <ul>
          {rows.map((name) => (
            <li key={name}>
              <span>{name}</span>
              <button type="button">Details for {name}</button>
              <button type="button" onClick={() => setOpenFor(name)}>
                Pull for {name}
              </button>
            </li>
          ))}
        </ul>
        <Layer name="Pull the bed" open={openFor !== null} onClose={() => setOpenFor(null)} focusOnOpen="immediate">
          <button
            type="button"
            onClick={() => {
              setRows((current) => current.filter((name) => name !== openFor));
              setOpenFor(null);
            }}
          >
            Pull
          </button>
        </Layer>
      </section>
    );
  }

  it("moves to the same control on the next row", () => {
    render(<Rows />);
    const opener = screen.getByRole("button", { name: "Pull for Ashby" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Pull" }));
    expect(screen.queryByRole("button", { name: "Pull for Ashby" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pull for Cadwaller" }));
  });

  it("moves to the section heading when no row is left", () => {
    function Single() {
      const [shown, setShown] = useState(true);
      const [open, setOpen] = useState(false);
      return (
        <section>
          <h2>Accepted, bed not pulled</h2>
          <div>
            {shown ? (
              <button type="button" onClick={() => setOpen(true)}>
                Pull the bed
              </button>
            ) : null}
          </div>
          <Layer name="Pull sheet" open={open} onClose={() => setOpen(false)} focusOnOpen="immediate">
            <button
              type="button"
              onClick={() => {
                setShown(false);
                setOpen(false);
              }}
            >
              Confirm pull
            </button>
          </Layer>
        </section>
      );
    }
    render(<Single />);
    const opener = screen.getByRole("button", { name: "Pull the bed" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Confirm pull" }));
    const heading = screen.getByRole("heading", { name: "Accepted, bed not pulled" });
    expect(document.activeElement).toBe(heading);
    expect(heading).toHaveAttribute("tabindex", "-1");
    act(() => heading.blur());
    expect(heading).not.toHaveAttribute("tabindex");
  });
});

describe("one modal stack", () => {
  it("keeps a re-registering layer in its own place", () => {
    pushSheet("lower");
    pushSheet("upper");
    // A panel re-registering (its effect re-runs on resize) pops and pushes in one task.
    popSheet("lower");
    pushSheet("lower");
    expect(isTopmostSheet("upper")).toBe(true);
    popSheet("upper");
    popSheet("lower");
  });

  it("still puts a layer that really closed and opened again on top", async () => {
    pushSheet("first");
    pushSheet("second");
    popSheet("first");
    await Promise.resolve();
    pushSheet("first");
    expect(isTopmostSheet("first")).toBe(true);
    popSheet("first");
    popSheet("second");
  });

  it("leaves the top pop-up answering Escape after the layer below re-registers", () => {
    const onLower = vi.fn();
    const onUpper = vi.fn();
    function Two({ phase }: { phase: "bubble" | "capture" }) {
      return (
        <>
          <Layer name="Lower" open onClose={onLower} keyPhase={phase} focusOnOpen="immediate" />
          <Layer name="Upper" open onClose={onUpper} focusOnOpen="immediate" />
        </>
      );
    }
    const { rerender } = render(<Two phase="bubble" />);
    // A changed option re-runs the lower layer's effect, as a resize does.
    rerender(<Two phase="capture" />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Upper control" }), { key: "Escape" });
    expect(onUpper).toHaveBeenCalledTimes(1);
    expect(onLower).not.toHaveBeenCalled();
  });
});
