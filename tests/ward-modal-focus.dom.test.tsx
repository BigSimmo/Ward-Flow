/** @vitest-environment jsdom */

import { useRef, useState, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, useModalFocus, type UseModalFocusOptions } from "@/components/wf";
import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardDailySheetDialog } from "@/components/ward-management/board/ward-daily-sheet";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { alertsMoreButton, openAlertsBroadcast } from "./helpers/alerts-broadcast";

/*
 * One modal focus contract (`useModalFocus`) for Dialog, PhoneSheet and the hand-built Ward modals:
 * focus moves in, Tab wraps inside, the page behind is inert, Escape closes only the top layer, and
 * focus returns to the opener.
 */

// jsdom has no layout; the shared trap only cycles through controls that have client rects.
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
  children?: ReactNode;
};

/** A hand-built modal on the hook, with its own opener, as a screen would write it. */
function Layer({ name, children, ...options }: LayerProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { rootRef } = useModalFocus({ open, onClose: () => setOpen(false), panelRef, ...options });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open {name}
      </button>
      {open ? (
        <div ref={rootRef} data-testid={`${name}-scrim`}>
          <div ref={panelRef} role="dialog" aria-modal="true" aria-label={name} tabIndex={-1}>
            <button type="button">{name} first</button>
            <button type="button">{name} middle</button>
            {children}
            <button type="button" onClick={() => setOpen(false)}>
              {name} last
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function openLayer(name: string) {
  const opener = screen.getByRole("button", { name: `Open ${name}` });
  opener.focus();
  fireEvent.click(opener);
  return { opener, dialog: screen.getByRole("dialog", { name }) };
}

describe("useModalFocus", () => {
  it("moves focus in, wraps Tab both ways, inerts the page and returns focus to the opener", () => {
    render(
      <>
        <button type="button">Page control</button>
        <Layer name="Plain" focusOnOpen="immediate" />
      </>,
    );
    const { opener, dialog } = openLayer("Plain");
    const first = within(dialog).getByRole("button", { name: "Plain first" });
    const last = within(dialog).getByRole("button", { name: "Plain last" });

    // No initial ref or autofocus child: the first control takes focus as soon as it opens.
    expect(first).toHaveFocus();
    expect(hasOpenSheet()).toBe(true);
    expect(screen.getByRole("button", { name: "Page control" }).closest("[inert]")).not.toBeNull();

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Tab" });
    expect(within(dialog).getByRole("button", { name: "Plain middle" })).toHaveFocus();

    fireEvent.keyDown(first, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Plain" })).toBeNull();
    expect(opener).toHaveFocus();
    expect(hasOpenSheet()).toBe(false);
    expect(screen.getByRole("button", { name: "Page control" }).closest("[inert]")).toBeNull();
  });

  it("settles deferred focus on a data-sheet-autofocus child, then the fallback ref", async () => {
    function Fallback() {
      const closeRef = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      const panelRef = useRef<HTMLDivElement>(null);
      useModalFocus({ open, onClose: () => setOpen(false), panelRef, fallbackFocusRef: closeRef });
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open Fallback
          </button>
          {open ? (
            <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Fallback" tabIndex={-1}>
              <button type="button">Other</button>
              <button ref={closeRef} type="button">
                Close
              </button>
            </div>
          ) : null}
        </>
      );
    }
    render(
      <>
        <Fallback />
        <Layer name="Auto">
          <input aria-label="Find" data-sheet-autofocus="true" />
        </Layer>
      </>,
    );
    openLayer("Fallback");
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toHaveFocus());
    fireEvent.keyDown(window, { key: "Escape" });

    openLayer("Auto");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Find" })).toHaveFocus());
  });

  it("focuses a bare data-sheet-autofocus child, and skips one set to false (form-friction 251)", async () => {
    render(
      <>
        <Layer name="Bare">
          <input aria-label="Password" data-sheet-autofocus="" />
        </Layer>
        <Layer name="Off">
          <input aria-label="Skipped" data-sheet-autofocus="false" />
        </Layer>
      </>,
    );
    openLayer("Bare");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Password" })).toHaveFocus());
    fireEvent.keyDown(window, { key: "Escape" });
    openLayer("Off");
    await waitFor(() => expect(screen.getByRole("button", { name: "Off first" })).toHaveFocus());
  });

  it("closes only the top layer on Escape and hands focus back down the stack", () => {
    render(
      <Layer name="Lower" focusOnOpen="immediate">
        <Layer name="Upper" focusOnOpen="immediate" />
      </Layer>,
    );
    const { opener: pageOpener } = openLayer("Lower");
    const { opener: lowerOpener } = openLayer("Upper");
    // The lower layer is inert under the upper one.
    expect(lowerOpener.closest("[inert]")).not.toBeNull();

    fireEvent.keyDown(screen.getByRole("button", { name: "Upper first" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Upper" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Lower" })).toBeInTheDocument();
    expect(lowerOpener).toHaveFocus();
    expect(lowerOpener.closest("[inert]")).toBeNull();

    fireEvent.keyDown(lowerOpener, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Lower" })).toBeNull();
    expect(pageOpener).toHaveFocus();
  });

  it("stacks with the shared Dialog: Escape closes the Dialog first, then the hand-built layer", async () => {
    function DialogInside() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open confirm
          </button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Confirm step" />
        </>
      );
    }
    render(
      <Layer name="Host" focusOnOpen="immediate">
        <DialogInside />
      </Layer>,
    );
    openLayer("Host");
    const confirmOpener = screen.getByRole("button", { name: "Open confirm" });
    confirmOpener.focus();
    fireEvent.click(confirmOpener);
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toHaveFocus());

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Confirm step" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Host" })).toBeInTheDocument();
    expect(confirmOpener).toHaveFocus();
  });

  it("leaves Escape to a control inside that handled it, in the default bubble phase", () => {
    render(
      <Layer name="Menu host" focusOnOpen="immediate">
        <input
          aria-label="Picker"
          onKeyDown={(event) => {
            if (event.key === "Escape") event.preventDefault();
          }}
        />
      </Layer>,
    );
    openLayer("Menu host");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Picker" }), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Menu host" })).toBeInTheDocument();
  });

  it("in the capture phase, keeps Escape from a screen's own window shortcut", () => {
    const screenShortcut = vi.fn();
    window.addEventListener("keydown", screenShortcut);
    try {
      render(<Layer name="Captured" focusOnOpen="immediate" keyPhase="capture" />);
      openLayer("Captured");
      fireEvent.keyDown(screen.getByRole("button", { name: "Captured first" }), { key: "Escape" });
      expect(screen.queryByRole("dialog", { name: "Captured" })).toBeNull();
      expect(screenShortcut).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", screenShortcut);
    }
  });

  it("keeps the layer open on Escape when closeOnEscape is off", () => {
    render(<Layer name="Sticky" focusOnOpen="immediate" closeOnEscape={false} />);
    openLayer("Sticky");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Sticky" })).toBeInTheDocument();
  });

  it("in the capture phase, a layer that ignores Escape still keeps it from the screen behind", () => {
    const screenShortcut = vi.fn();
    window.addEventListener("keydown", screenShortcut);
    try {
      render(<Layer name="Locked" focusOnOpen="immediate" keyPhase="capture" closeOnEscape={false} />);
      openLayer("Locked");
      fireEvent.keyDown(screen.getByRole("button", { name: "Locked first" }), { key: "Escape" });
      expect(screen.getByRole("dialog", { name: "Locked" })).toBeInTheDocument();
      expect(screenShortcut).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", screenShortcut);
    }
  });
});

describe("hand-built Ward modals on the shared contract", () => {
  it("Alerts broadcast composer: close button first, Tab wraps, page inert, Escape returns to the trigger", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    const trigger = alertsMoreButton();
    trigger.focus();
    openAlertsBroadcast();

    const dialog = screen.getByRole("dialog", { name: /New broadcast/i });
    const close = within(dialog).getByRole("button", { name: "Close" });
    expect(close).toHaveFocus();
    expect(trigger.closest("[inert]")).not.toBeNull();

    // Shift+Tab from the first control wraps to the last one inside the composer, and back.
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    const last = document.activeElement as HTMLElement;
    expect(dialog.contains(last)).toBe(true);
    expect(last).not.toBe(close);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /New broadcast/i })).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger.closest("[inert]")).toBeNull();
  });

  it("Shift brief dialog: focus on the dialog, page inert, Escape closes it and returns focus", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Shift brief
          </button>
          {open ? <WardDailySheetDialog now={WARD_ADMISSIONS_ANCHOR} onClose={() => setOpen(false)} /> : null}
        </>
      );
    }
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Shift brief" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByTestId("ward-daily-sheet-modal");
    expect(dialog).toHaveFocus();
    expect(trigger.closest("[inert]")).not.toBeNull();

    // Tab from the dialog itself lands on a control inside it, never the page.
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(dialog);

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByTestId("ward-daily-sheet-modal")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger.closest("[inert]")).toBeNull();
  });
});
