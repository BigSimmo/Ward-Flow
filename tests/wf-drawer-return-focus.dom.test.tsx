/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { PanelDrawer } from "../src/components/wf";

afterEach(cleanup);

// CodeRabbit (#1495, drawer review 6 Nov 2026): releasing a pulled bed can remove the alert row that
// opened the drawer. Focus must then go to a stable page target, never fall to the body.
function Harness() {
  const [rowShown, setRowShown] = useState(true);
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const resolve = useCallback(() => (openerRef.current?.isConnected ? null : mainRef.current), []);
  return (
    <main ref={mainRef} tabIndex={-1} data-testid="main">
      {rowShown ? (
        <button
          type="button"
          onClick={(event) => {
            openerRef.current = event.currentTarget;
            setOpen(true);
          }}
        >
          Synthetic alert
        </button>
      ) : null}
      {open ? (
        <PanelDrawer open onClose={() => setOpen(false)} title="Synthetic patient" resolveReturnFocusTarget={resolve}>
          <button
            type="button"
            onClick={() => {
              setRowShown(false);
              setOpen(false);
            }}
          >
            Release
          </button>
        </PanelDrawer>
      ) : null}
    </main>
  );
}

describe("PanelDrawer focus return", () => {
  it("returns focus to the page target when the opener row has gone", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Synthetic alert" });
    opener.focus();
    fireEvent.click(opener);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Release" }));
    });
    expect(screen.queryByRole("button", { name: "Synthetic alert" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("main"));
  });

  it("still returns focus to the opener when it remains", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Synthetic alert" });
    opener.focus();
    fireEvent.click(opener);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    return new Promise<void>((done) =>
      window.requestAnimationFrame(() => {
        expect(document.activeElement).toBe(opener);
        done();
      }),
    );
  });
});
