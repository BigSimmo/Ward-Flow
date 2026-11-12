import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sheet } from "@/components/wf/sheet";
import {
  SHEET_INERT_MARKER,
  SHEET_INERT_SKIP_ATTRIBUTE,
  SHEET_PORTAL_ATTRIBUTE,
  SHEET_SCRIM_ATTRIBUTE,
  shouldReclaimFocus,
} from "@/components/wf/sheet-focus";
import { useModalFocus } from "@/components/wf/use-modal-focus";

afterEach(() => {
  vi.restoreAllMocks();
  if (typeof document !== "undefined" && document.body) {
    document.body.style.overflow = "";
  }
});

function TwoSheets({ shown }: { shown: "a" | "b" | "both" | "none" }) {
  return (
    <>
      <Sheet open={shown === "a" || shown === "both"} onClose={() => {}} title="Sheet A" portal>
        <p>A body</p>
      </Sheet>
      <Sheet open={shown === "b" || shown === "both"} onClose={() => {}} title="Sheet B" portal>
        <p>B body</p>
      </Sheet>
    </>
  );
}

/** Mounts an autofocus input one tick after the sheet body first paints. */
function DeferredAutofocusChild() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 20);
    return () => clearTimeout(timer);
  }, []);
  return ready ? <input data-sheet-autofocus="true" data-testid="deferred-input" aria-label="Deferred" /> : null;
}

function panelOf(title: string) {
  const heading = Array.from(document.body.querySelectorAll("h2")).find((node) => node.textContent === title);
  expect(heading, `no open sheet titled "${title}"`).toBeTruthy();
  return heading?.closest('[role="dialog"]') as HTMLElement;
}

it("keeps the sheet open when a picker consumes Escape or a native select owns it", () => {
  const onClose = vi.fn();
  const { getByRole } = render(
    <Sheet open onClose={onClose} title="Picker sheet">
      <input aria-label="Search picker" onKeyDown={(event) => event.key === "Escape" && event.preventDefault()} />
      <select aria-label="Native choice">
        <option>Choose</option>
      </select>
      <button type="button">Ordinary control</button>
    </Sheet>,
  );
  fireEvent.keyDown(getByRole("textbox"), { key: "Escape" });
  fireEvent.keyDown(getByRole("combobox"), { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(getByRole("button", { name: "Ordinary control" }), { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("locks the desktop work column until the last stacked sheet closes and preserves its position", () => {
  const scroller = document.createElement("div");
  scroller.setAttribute("data-wf-scroller", "");
  scroller.style.overflowY = "auto";
  scroller.scrollTop = 420;
  document.body.append(scroller);
  const { rerender, unmount } = render(<TwoSheets shown="both" />);
  expect(scroller.style.overflowY).toBe("hidden");
  rerender(<TwoSheets shown="a" />);
  expect(scroller.style.overflowY).toBe("hidden");
  rerender(<TwoSheets shown="none" />);
  expect(scroller.style.overflowY).toBe("auto");
  expect(scroller.scrollTop).toBe(420);
  unmount();
  scroller.remove();
});

it("retains the canonical work-column offset through auto-to-auto resize clamps", async () => {
  const column = document.createElement("div");
  column.setAttribute("data-wf-scroller", "");
  column.scrollTop = 420;
  document.body.append(column);
  const getStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) =>
    element === column
      ? ({ overflowY: column.style.overflowY || "auto" } as CSSStyleDeclaration)
      : getStyle(element, pseudo),
  );
  const view = render(<TwoSheets shown="a" />);
  try {
    expect(column.style.overflowY).toBe("hidden");
    // Native layout can clamp the offset before the queued resize callback runs.
    column.scrollTop = 52;
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(column.scrollTop).toBe(420));
    column.scrollTop = 17;
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(column.scrollTop).toBe(420));
    view.rerender(<TwoSheets shown="none" />);
    expect(column.scrollTop).toBe(420);
  } finally {
    view.unmount();
    column.remove();
  }
});

it("adopts a new route's position behind a persistent sheet before preserving further clamps", async () => {
  const original = window.location.href;
  window.history.replaceState(null, "", "/ward-flow/search");
  const column = document.createElement("div");
  column.setAttribute("data-wf-scroller", "");
  column.scrollTop = 420;
  document.body.append(column);
  const getStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) =>
    element === column
      ? ({ overflowY: column.style.overflowY || "auto" } as CSSStyleDeclaration)
      : getStyle(element, pseudo),
  );
  const view = render(<TwoSheets shown="a" />);
  try {
    window.history.replaceState(null, "", "/ward-flow/capacity");
    column.scrollTop = 73;
    const reads = vi.mocked(window.getComputedStyle).mock.calls.length;
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(vi.mocked(window.getComputedStyle).mock.calls.length).toBeGreaterThan(reads));
    expect(column.scrollTop).toBe(73);
    column.scrollTop = 12;
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(column.scrollTop).toBe(73));
    view.rerender(<TwoSheets shown="none" />);
    expect(column.scrollTop).toBe(73);
  } finally {
    view.unmount();
    column.remove();
    window.history.replaceState(null, "", original);
  }
});

it("leaves the document-scrolling phone column visible so it does not gain a sticky scroll ancestor", () => {
  const column = document.createElement("div");
  column.setAttribute("data-wf-scroller", "");
  column.style.overflowX = "clip";
  column.style.overflowY = "visible";
  document.body.append(column);
  const { unmount } = render(<TwoSheets shown="a" />);
  expect(column.style.overflowY).toBe("visible");
  expect(document.documentElement.style.overflowY).toBe("hidden");
  unmount();
  expect(column.style.overflowY).toBe("visible");
  column.remove();
});

it("transfers the work-column lock across responsive layouts while sheets remain stacked", async () => {
  const column = document.createElement("div");
  column.setAttribute("data-wf-scroller", "");
  column.scrollTop = 420;
  document.body.append(column);
  let desktop = true;
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) =>
    element === column
      ? ({ overflowY: column.style.overflowY || (desktop ? "auto" : "visible") } as CSSStyleDeclaration)
      : computed(element, pseudo),
  );
  const { rerender, unmount } = render(<TwoSheets shown="both" />);
  expect(column.style.overflowY).toBe("hidden");
  desktop = false;
  fireEvent(window, new Event("resize"));
  await waitFor(() => expect(column.style.overflowY).toBe(""));
  // A column released into document flow loses its own scrolling range.
  column.scrollTop = 0;
  expect(document.documentElement.style.overflowY).toBe("hidden");
  rerender(<TwoSheets shown="a" />);
  desktop = true;
  fireEvent(window, new Event("resize"));
  await waitFor(() => expect(column.style.overflowY).toBe("hidden"));
  expect(column.scrollTop).toBe(420);
  rerender(<TwoSheets shown="none" />);
  expect(column.style.overflowY).toBe("");
  expect(column.scrollTop).toBe(420);
  unmount();
  column.remove();
});

describe("shouldReclaimFocus", () => {
  it("reclaims from nothing at all", () => {
    expect(shouldReclaimFocus(null, null)).toBe(true);
    expect(shouldReclaimFocus(null, document.body)).toBe(true);
  });

  it("leaves focus alone inside the panel", () => {
    const panel = document.createElement("div");
    const control = document.createElement("button");
    panel.append(control);
    document.body.append(panel);

    expect(shouldReclaimFocus(panel, control)).toBe(false);
    panel.remove();
  });

  it("leaves focus alone in a surface portaled out of the sheet", () => {
    const panel = document.createElement("div");
    const portalHost = document.createElement("div");
    portalHost.setAttribute(SHEET_PORTAL_ATTRIBUTE, "true");
    const control = document.createElement("button");
    portalHost.append(control);
    document.body.append(panel, portalHost);

    expect(shouldReclaimFocus(panel, control)).toBe(false);
    panel.remove();
    portalHost.remove();
  });

  it("reclaims only from background this module deactivated", () => {
    const panel = document.createElement("div");
    const deactivated = document.createElement("div");
    deactivated.setAttribute(SHEET_INERT_MARKER, "true");
    const backgroundControl = document.createElement("button");
    deactivated.append(backgroundControl);
    const untouched = document.createElement("button");
    document.body.append(panel, deactivated, untouched);

    expect(shouldReclaimFocus(panel, backgroundControl)).toBe(true);
    expect(shouldReclaimFocus(panel, untouched)).toBe(false);

    panel.remove();
    deactivated.remove();
    untouched.remove();
  });
});

describe("Sheet background inerting", () => {
  it("deactivates page background while open and restores it on close", () => {
    const background = document.createElement("div");
    background.append(document.createElement("button"));
    document.body.append(background);

    const { rerender } = render(
      <Sheet open onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );

    expect(background).toHaveAttribute("inert");
    expect(background).toHaveAttribute(SHEET_INERT_MARKER, "true");

    rerender(
      <Sheet open={false} onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );

    expect(background).not.toHaveAttribute("inert");
    expect(background).not.toHaveAttribute(SHEET_INERT_MARKER);
    background.remove();
  });

  it("honours the opt-out marker and never clobbers another owner's inert", () => {
    const optedOut = document.createElement("div");
    optedOut.setAttribute(SHEET_INERT_SKIP_ATTRIBUTE, "true");
    const alreadyInert = document.createElement("div");
    alreadyInert.setAttribute("inert", "");
    document.body.append(optedOut, alreadyInert);

    const { rerender } = render(
      <Sheet open onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );

    expect(optedOut).not.toHaveAttribute("inert");
    expect(alreadyInert).not.toHaveAttribute(SHEET_INERT_MARKER);

    rerender(
      <Sheet open={false} onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );

    // The pre-existing inert belongs to its own owner and must survive.
    expect(alreadyInert).toHaveAttribute("inert");
    optedOut.remove();
    alreadyInert.remove();
  });

  it("deactivates a lower sheet while one is stacked above it, then revives it", () => {
    const { rerender } = render(<TwoSheets shown="a" />);
    const lowerBackdrop = panelOf("Sheet A").parentElement as HTMLElement;
    expect(lowerBackdrop).not.toHaveAttribute("inert");

    rerender(<TwoSheets shown="both" />);
    expect(lowerBackdrop).toHaveAttribute("inert");

    rerender(<TwoSheets shown="a" />);
    expect(lowerBackdrop).not.toHaveAttribute("inert");
  });
});

/** A hand-built drawer whose backdrop sits beside the panel, as the bed dossier's does. */
function SiblingScrimDrawer({ onClose, marked = true }: { onClose: () => void; marked?: boolean }) {
  const panelRef = useRef<HTMLElement>(null);
  useModalFocus({ open: true, onClose, panelRef, focusOnOpen: "immediate" });
  return (
    <div>
      <div
        data-testid="scrim"
        aria-hidden="true"
        onClick={onClose}
        {...(marked ? { [SHEET_SCRIM_ATTRIBUTE]: "" } : {})}
      />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-label="Drawer">
        <button type="button">Inside</button>
      </aside>
    </div>
  );
}

describe("Hand-built drawer backdrop", () => {
  it("keeps the drawer's own backdrop live, so a click outside closes it (3 Nov 2026)", () => {
    const background = document.createElement("div");
    document.body.append(background);
    const onClose = vi.fn();
    const { getByTestId, unmount } = render(<SiblingScrimDrawer onClose={onClose} />);

    expect(background).toHaveAttribute("inert");
    expect(getByTestId("scrim")).not.toHaveAttribute("inert");
    fireEvent.click(getByTestId("scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    background.remove();
  });

  it("still inerts an unmarked sibling", () => {
    const { getByTestId, unmount } = render(<SiblingScrimDrawer onClose={() => {}} marked={false} />);
    expect(getByTestId("scrim")).toHaveAttribute("inert");
    unmount();
  });
});

describe("Sheet open focus", () => {
  it("does not restore focus to the opener when another sheet takes over", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { rerender } = render(<TwoSheets shown="a" />);
    // Swap sheets in one commit: A's restore and B's open focus race.
    rerender(<TwoSheets shown="b" />);

    await waitFor(() => {
      expect(panelOf("Sheet B").contains(document.activeElement)).toBe(true);
    });
    expect(document.activeElement).not.toBe(opener);
    opener.remove();
  });

  it("keeps focus in the panel across a close-then-reopen of the same sheet", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { rerender } = render(<TwoSheets shown="a" />);
    rerender(<TwoSheets shown="none" />);
    rerender(<TwoSheets shown="a" />);

    await waitFor(() => {
      expect(panelOf("Sheet A").contains(document.activeElement)).toBe(true);
    });
    opener.remove();
  });

  it("upgrades to a late-mounted autofocus child", async () => {
    render(
      <Sheet open onClose={() => {}} title="Deferred" portal>
        <DeferredAutofocusChild />
      </Sheet>,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('[data-testid="deferred-input"]'));
    });
  });

  it("takes focus back when it lands on deactivated background", async () => {
    const background = document.createElement("div");
    const backgroundControl = document.createElement("button");
    background.append(backgroundControl);
    document.body.append(background);

    render(
      <Sheet open onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );
    await waitFor(() => {
      expect(panelOf("Solo").contains(document.activeElement)).toBe(true);
    });

    // jsdom does not enforce `inert`, so background focus is still reachable
    // here; the marker is what tells the sheet this focus is stale.
    act(() => {
      backgroundControl.focus();
    });

    await waitFor(() => {
      expect(panelOf("Solo").contains(document.activeElement)).toBe(true);
    });
    background.remove();
  });

  it("stops reclaiming focus once the user interacts", async () => {
    const background = document.createElement("div");
    const backgroundControl = document.createElement("button");
    background.append(backgroundControl);
    document.body.append(background);

    render(
      <Sheet open onClose={() => {}} title="Solo" portal>
        <p>Body</p>
      </Sheet>,
    );
    await waitFor(() => {
      expect(panelOf("Solo").contains(document.activeElement)).toBe(true);
    });

    act(() => {
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      backgroundControl.focus();
    });

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(document.activeElement).toBe(backgroundControl);
    background.remove();
  });
});

describe("Sheet Tab cycle", () => {
  it("skips visible controls explicitly removed from the tab order", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      length: 1,
      item: () => null,
      [Symbol.iterator]: function* () {
        yield {} as DOMRect;
      },
    } as DOMRectList);

    render(
      <Sheet open onClose={() => {}} title="Tab order" portal>
        <a href="#first">First</a>
        <input aria-label="Programmatic only" tabIndex={-1} />
        <button type="button">Last</button>
      </Sheet>,
    );

    const panel = panelOf("Tab order");
    const first = panel.querySelector<HTMLAnchorElement>('a[href="#first"]');
    const excluded = panel.querySelector<HTMLInputElement>('input[tabindex="-1"]');
    const last = Array.from(panel.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Last",
    );
    expect(first).not.toBeNull();
    expect(excluded).not.toBeNull();
    expect(last).toBeDefined();

    act(() => {
      first?.focus();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });

    expect(document.activeElement).toBe(last);
    expect(document.activeElement).not.toBe(excluded);
  });

  it("stops once on a radio group, at its checked radio, as browsers do", () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      length: 1,
      item: () => null,
      [Symbol.iterator]: function* () {
        yield {} as DOMRect;
      },
    } as DOMRectList);

    render(
      <Sheet open onClose={() => {}} title="Radio order" portal>
        <button type="button">Before</button>
        <input type="radio" name="level" value="low" aria-label="Low" />
        <input type="radio" name="level" value="mid" aria-label="Mid" defaultChecked />
        <input type="radio" name="level" value="high" aria-label="High" />
        <button type="button">After</button>
      </Sheet>,
    );

    const panel = panelOf("Radio order");
    const button = (name: string) =>
      Array.from(panel.querySelectorAll<HTMLButtonElement>("button")).find((node) => node.textContent === name);
    const tab = (shiftKey = false) =>
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true }));
      });

    act(() => button("Before")?.focus());
    tab();
    expect(document.activeElement).toBe(panel.querySelector('input[value="mid"]'));
    tab();
    expect(document.activeElement).toBe(button("After"));
    tab(true);
    expect(document.activeElement).toBe(panel.querySelector('input[value="mid"]'));
  });
});
