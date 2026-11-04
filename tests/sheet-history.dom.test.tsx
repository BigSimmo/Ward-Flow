import { useState } from "react";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OverlayRoot } from "@/components/wf/overlay-root";
import { PhoneSheet } from "@/components/wf/phone";
import { Sheet } from "@/components/wf/sheet";
import { resetSheetHistoryForTests } from "@/components/wf/sheet-history";
import { WF_PHONE_QUERY } from "@/components/wf/use-is-phone";

import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * S5 (Josh, 4 Nov 2026): on a phone, Back closes the open kit sheet first instead of leaving the
 * page. Opening pushes one same-address entry; Back closes the top sheet; an ordinary close steps
 * back over its own entry once; a page change made while the sheet was open is never undone.
 */

function phoneMatchMedia(phone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: phone && query === WF_PHONE_QUERY,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function sheetDepth() {
  const state = window.history.state as { __wfSheet?: number } | null;
  return state?.__wfSheet ?? 0;
}

/** jsdom traverses history on a later task and then fires popstate. */
async function back() {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function Harness({ closeOnBack, nested = false }: { closeOnBack?: boolean; nested?: boolean }) {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <OverlayRoot />
      <button type="button" onClick={() => setOuter(true)}>
        Open outer
      </button>
      <Sheet open={outer} onClose={() => setOuter(false)} title="Outer sheet" closeOnBack={closeOnBack}>
        <p>Outer body</p>
        {nested ? (
          <button type="button" onClick={() => setInner(true)}>
            Open inner
          </button>
        ) : null}
      </Sheet>
      <PhoneSheet open={inner} onClose={() => setInner(false)} title="Inner sheet">
        <p>Inner body</p>
      </PhoneSheet>
    </>
  );
}

beforeEach(() => {
  resetSheetHistoryForTests();
  window.history.replaceState(null, "", "/sheet-history-test");
});

afterEach(() => {
  installMatchMediaStub(false);
  resetSheetHistoryForTests();
});

describe("Back closes the open sheet first (phone)", () => {
  it("pushes one entry on open and Back closes the sheet without leaving the address", async () => {
    phoneMatchMedia(true);
    render(<Harness />);
    const startLength = window.history.length;

    fireEvent.click(screen.getByRole("button", { name: "Open outer" }));
    expect(await screen.findByRole("dialog", { name: "Outer sheet" })).toBeTruthy();
    expect(window.history.length).toBe(startLength + 1);
    expect(sheetDepth()).toBe(1);

    await back();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Outer sheet" })).toBeNull());
    expect(window.location.pathname).toBe("/sheet-history-test");
    expect(sheetDepth()).toBe(0);
  });

  it("an ordinary close steps back over its own entry once", async () => {
    phoneMatchMedia(true);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open outer" }));
    await screen.findByRole("dialog", { name: "Outer sheet" });
    expect(sheetDepth()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Outer sheet" })).toBeNull());
    await waitFor(() => expect(sheetDepth()).toBe(0));
    expect(window.location.pathname).toBe("/sheet-history-test");

    // Opening again still works, and Back closes it again: the earlier entry was not left behind.
    fireEvent.click(screen.getByRole("button", { name: "Open outer" }));
    await screen.findByRole("dialog", { name: "Outer sheet" });
    expect(sheetDepth()).toBe(1);
    await back();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Outer sheet" })).toBeNull());
  });

  it("nested sheets close one per Back, the top one first", async () => {
    phoneMatchMedia(true);
    render(<Harness nested />);
    fireEvent.click(screen.getByRole("button", { name: "Open outer" }));
    await screen.findByRole("dialog", { name: "Outer sheet" });
    fireEvent.click(screen.getByRole("button", { name: "Open inner" }));
    await screen.findByRole("dialog", { name: "Inner sheet" });
    expect(sheetDepth()).toBe(2);

    await back();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Inner sheet" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Outer sheet" })).toBeTruthy();
    expect(sheetDepth()).toBe(1);

    await back();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Outer sheet" })).toBeNull());
    expect(sheetDepth()).toBe(0);
  });

  it("does not undo a page change made while the sheet was open", async () => {
    phoneMatchMedia(true);
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open outer" }));
    await screen.findByRole("dialog", { name: "Outer sheet" });

    // A link inside the sheet went to another page; the page then closes the sheet.
    act(() => window.history.pushState({}, "", "/another-page"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    rerender(<Harness />);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Outer sheet" })).toBeNull());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(window.location.pathname).toBe("/another-page");
  });

  it("adds no entry above the phone range or when the page owns the entry", async () => {
    phoneMatchMedia(false);
    const { unmount } = render(<Harness />);
    const startLength = window.history.length;
    fireEvent.click(screen.getByRole("button", { name: "Open outer" }));
    await screen.findByRole("dialog", { name: "Outer sheet" });
    expect(window.history.length).toBe(startLength);
    unmount();

    phoneMatchMedia(true);
    render(<Harness closeOnBack={false} />);
    const ownedLength = window.history.length;
    fireEvent.click(screen.getByRole("button", { name: "Open outer" }));
    await screen.findByRole("dialog", { name: "Outer sheet" });
    expect(window.history.length).toBe(ownedLength);
    expect(sheetDepth()).toBe(0);
  });
});
