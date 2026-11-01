import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Profiler, useState, type ReactNode } from "react";

/**
 * Show me (Josh, 26 and 30 Oct 2026): opens the screen a task is done on, then lights each control in
 * turn with the tour's card and spotlight. It presses nothing. Back on the first step returns to
 * Help; Close and Escape end it.
 */

const route = { pathname: "/ward-flow" };
const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

const phone = { on: false };
const desk = vi.hoisted(() => ({ role: "coordinator" as "coordinator" | "ward" }));
vi.mock("@/components/ward-management/help/ward-help-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/help/ward-help-store")>()),
  useTourRole: () => desk.role,
}));
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.on,
}));

import { HOW_TOS } from "@/components/ward-management/help/ward-help-howto";
import { WardShowMe } from "@/components/ward-management/help/ward-show-me";
import { useSpotlight } from "@/components/ward-management/help/ward-spotlight";
import { Dialog } from "@/components/wf";
import { openSheetHandles } from "@/components/wf/sheet-focus";

function control(testId: string, rect = new DOMRect(400, 300, 160, 40)): HTMLElement {
  const element = document.createElement("button");
  element.dataset.testid = testId;
  element.dataset.testControl = "";
  element.getClientRects = () => [rect] as unknown as DOMRectList;
  element.getBoundingClientRect = () => rect;
  element.scrollIntoView = vi.fn();
  document.body.append(element);
  return element;
}

beforeEach(() => {
  route.pathname = "/ward-flow";
  phone.on = false;
  desk.role = "coordinator";
  push.mockReset();
});

afterEach(() => {
  document.body.querySelectorAll("[data-test-control]").forEach((element) => element.remove());
  vi.useRealTimers();
});

describe("Show me player", () => {
  it("opens the task's screen first, then lights each step and counts them", async () => {
    control("ward-handover-kpi-strip");
    render(<WardShowMe id="sign-off-handover" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(push).toHaveBeenCalledWith("/ward-flow/handover");
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeTruthy());
    const card = screen.getByTestId("ward-show-me-card");
    // Placed by transform from the corner, as the tour is, so it never sits stuck in a corner.
    expect(card.style.transform).toMatch(/^translate\(/);
    expect(card.dataset.place).toBe("beside");
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Start with Act now" })).toBeTruthy();
  });

  it("says when a step's control is not on screen", async () => {
    render(<WardShowMe id="sign-off-handover" onClose={vi.fn()} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("ward-show-me-not-here")).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByTestId("ward-show-me-spot")).toBeNull();
  });

  it("finds a control that appears after the step began", async () => {
    render(<WardShowMe id="sign-off-handover" onClose={vi.fn()} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("ward-show-me-not-here")).toBeTruthy(), { timeout: 4000 });
    control("ward-handover-kpi-strip");
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeTruthy());
    expect(screen.queryByTestId("ward-show-me-not-here")).toBeNull();
  });

  it("moves with Next, Back and the arrow keys, returns to Help from the first step and ends on Done", () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    render(<WardShowMe id="sign-off-handover" onClose={onClose} onBack={onBack} />);
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-next")));
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
    act(() => fireEvent.keyDown(screen.getByTestId("ward-show-me-try"), { key: "ArrowRight" }));
    expect(screen.getByTestId("ward-show-me-paused")).toBeTruthy();
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-continue")));
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
    act(() => fireEvent.keyDown(screen.getByTestId("ward-show-me-done"), { key: "ArrowLeft" }));
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-back")));
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Back to Help" })));
    expect(onBack).toHaveBeenCalledTimes(1);
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-next")));
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-try")));
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-continue")));
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-done")));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the corner Close and on Escape", () => {
    const onClose = vi.fn();
    const { unmount } = render(<WardShowMe id="theme" onClose={onClose} onBack={vi.fn()} />);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Close Show me" })));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    render(<WardShowMe id="theme" onClose={onClose} onBack={vi.fn()} />);
    act(() => fireEvent.keyDown(document.body, { key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps the phone dock in view under its card, so dock controls can be lit", () => {
    render(<WardShowMe id="alerts" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId("ward-show-me-card").id).toBe("ward-show-me-card");
  });

  it("draws nothing for an unknown task", () => {
    const { container } = render(<WardShowMe id="no-such-task" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(container.textContent).toBe("");
    expect(HOW_TOS.some((howTo) => howTo.id === "no-such-task")).toBe(false);
    expect(openSheetHandles()).toHaveLength(0);
  });

  it.each(["undo", "mha-times"])("does not lock scrolling or keys for answer-only %s", (id) => {
    const before = document.body.style.overflow;
    const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    render(<WardShowMe id={id} onClose={vi.fn()} onBack={vi.fn()} />);
    expect(openSheetHandles()).toHaveLength(0);
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.body.style.overflow).toBe(before);
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps Statistics navigation on a phone and omits its computer-only export step", () => {
    phone.on = true;
    render(<WardShowMe id="statistics" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText("Step 1 of 1")).toBeTruthy();
    expect(screen.queryByText("Export the figures")).toBeNull();
    expect(screen.getByTestId("ward-show-me-done")).toBeTruthy();
  });

  it("rejects a computer-only phone request before navigating or trapping focus", () => {
    phone.on = true;
    render(<WardShowMe id="print-handover" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(openSheetHandles()).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it("hands pointer and keyboard access to the page, then lights the chosen record's control", async () => {
    route.pathname = "/ward-flow/movements";
    const main = document.createElement("main");
    main.id = "main-content";
    main.dataset.testControl = "";
    document.body.append(main);
    const entry = document.createElement("a");
    entry.href = "/ward-flow/movements/synthetic-guide";
    entry.textContent = "Pull the bed";
    entry.getClientRects = () => [new DOMRect(400, 300, 160, 40)] as unknown as DOMRectList;
    entry.getBoundingClientRect = () => new DOMRect(400, 300, 160, 40);
    main.append(entry);
    const choose = vi.fn((event: Event) => event.preventDefault());
    entry.addEventListener("click", choose);
    const onClose = vi.fn();
    const view = render(<WardShowMe id="pull-bed" onClose={onClose} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeTruthy());
    expect(main.closest("[inert]")).not.toBeNull();
    fireEvent.click(screen.getByTestId("ward-show-me-try"));
    expect(openSheetHandles()).toHaveLength(0);
    expect(main.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(entry);
    expect(choose).not.toHaveBeenCalled();
    fireEvent.click(entry);
    expect(choose).toHaveBeenCalledTimes(1);
    const action = control("ward-shortlist-hold-bed");
    const save = vi.fn();
    action.addEventListener("click", save);
    route.pathname = "/ward-flow/movements/synthetic-guide";
    view.rerender(<WardShowMe id="pull-bed" onClose={onClose} onBack={vi.fn()} />);
    fireEvent.keyDown(window, { altKey: true, key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "Open the bed details" })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeTruthy());
    expect(save).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("can resume above a form without closing it or losing its own focus trap", async () => {
    const formClose = vi.fn();
    const view = render(
      <>
        <WardShowMe id="new-referral" onClose={vi.fn()} onBack={vi.fn()} />
        <Dialog open={false} title="Synthetic referral form" onClose={formClose}>
          <button type="button">Form control</button>
        </Dialog>
      </>,
    );
    fireEvent.click(screen.getByTestId("ward-show-me-try"));
    view.rerender(
      <>
        <WardShowMe id="new-referral" onClose={vi.fn()} onBack={vi.fn()} />
        <Dialog open title="Synthetic referral form" onClose={formClose}>
          <button type="button">Form control</button>
        </Dialog>
      </>,
    );
    const paused = screen.getByRole("region", { name: "Paused Show me guide" });
    expect(paused.closest("[inert]")).toBeNull();
    fireEvent.keyDown(window, { altKey: true, key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "Destinations, then send" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("ward-show-me-done")));
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByTestId("ward-show-me-card").contains(document.activeElement)).toBe(true);
    expect(formClose).not.toHaveBeenCalled();
  });

  it("drops a guide when the desk can no longer do its task, and resets when the task changes", () => {
    const view = render(<WardShowMe id="pull-bed" onClose={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ward-show-me-try"));
    desk.role = "ward";
    view.rerender(<WardShowMe id="pull-bed" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(screen.queryByTestId("ward-show-me-paused")).toBeNull();
    expect(openSheetHandles()).toHaveLength(0);
    desk.role = "coordinator";
    view.rerender(<WardShowMe id="theme" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText("Step 1 of 1")).toBeTruthy();
    expect(push).toHaveBeenLastCalledWith("/ward-flow/settings#device");
  });

  it("starts a same-step resume dark rather than showing the previous target's stale position", async () => {
    const target = control("ward-statistics-nav");
    render(<WardShowMe id="statistics" onClose={vi.fn()} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeTruthy());
    fireEvent.click(screen.getByTestId("ward-show-me-use-screen"));
    target.remove();
    fireEvent.click(screen.getByTestId("ward-show-me-continue"));
    expect(screen.queryByTestId("ward-show-me-spot")).toBeNull();
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
  });

  it.each([0, -1])(
    "returns focus to the last page control with tabindex %s when the paused guide closes",
    (tabIndex) => {
      const pageControl = control("audit-page-control");
      pageControl.tabIndex = tabIndex;
      function Host() {
        const [open, setOpen] = useState(true);
        return open ? <WardShowMe id="new-referral" onClose={() => setOpen(false)} onBack={vi.fn()} /> : null;
      }
      render(<Host />);
      fireEvent.click(screen.getByTestId("ward-show-me-try"));
      pageControl.focus();
      const close = screen.getByRole("button", { name: "Close Show me" });
      close.focus();
      fireEvent.click(close);
      expect(screen.queryByTestId("ward-show-me-paused")).toBeNull();
      expect(document.activeElement).toBe(pageControl);
    },
  );

  it.each(["disabled", "hidden"])("skips a previously focused control that becomes %s", (state) => {
    const fallback = control("audit-fallback");
    const previous = control("audit-previous") as HTMLButtonElement;
    function Host() {
      const [open, setOpen] = useState(true);
      return open ? <WardShowMe id="new-referral" onClose={() => setOpen(false)} onBack={vi.fn()} /> : null;
    }
    render(<Host />);
    fireEvent.click(screen.getByTestId("ward-show-me-try"));
    previous.focus();
    if (state === "disabled") previous.disabled = true;
    else previous.style.visibility = "hidden";
    const close = screen.getByRole("button", { name: "Close Show me" });
    close.focus();
    fireEvent.click(close);
    expect(document.activeElement).toBe(fallback);
  });

  it("returns focus inside an open form when closing the paused guide", async () => {
    function Host({ formOpen }: { formOpen: boolean }) {
      const [open, setOpen] = useState(true);
      return (
        <>
          {open ? <WardShowMe id="new-referral" onClose={() => setOpen(false)} onBack={vi.fn()} /> : null}
          <Dialog open={formOpen} title="Synthetic form" onClose={vi.fn()}>
            <button type="button">Continue editing form</button>
          </Dialog>
        </>
      );
    }
    const view = render(<Host formOpen={false} />);
    fireEvent.click(screen.getByTestId("ward-show-me-try"));
    view.rerender(<Host formOpen />);
    const field = screen.getByRole("button", { name: "Continue editing form" });
    field.focus();
    const close = screen.getByRole("button", { name: "Close Show me" });
    close.focus();
    fireEvent.click(close);
    expect(screen.queryByTestId("ward-show-me-paused")).toBeNull();
    expect(document.activeElement).toBe(field);
    expect(screen.getByRole("dialog", { name: "Synthetic form" })).toBeTruthy();
  });

  it("ignores repeated, composing and modified continuation shortcuts", () => {
    render(<WardShowMe id="new-referral" onClose={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ward-show-me-try"));
    for (const extra of [{ repeat: true }, { isComposing: true }, { shiftKey: true }, { ctrlKey: true }]) {
      fireEvent.keyDown(window, { altKey: true, key: "ArrowRight", ...extra });
      expect(screen.getByTestId("ward-show-me-paused")).toBeTruthy();
    }
    const handled = new KeyboardEvent("keydown", { altKey: true, key: "ArrowRight", cancelable: true });
    handled.preventDefault();
    fireEvent(window, handled);
    expect(screen.getByTestId("ward-show-me-paused")).toBeTruthy();
    fireEvent.keyDown(window, { altKey: true, key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "Destinations, then send" })).toBeTruthy();
  });

  it("reserves plain arrow presses for steps without intercepting browser shortcuts or key repeats", () => {
    render(<WardShowMe id="sign-off-handover" onClose={vi.fn()} onBack={vi.fn()} />);
    const next = screen.getByTestId("ward-show-me-next");
    for (const extra of [
      { altKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { repeat: true },
      { isComposing: true },
    ]) {
      fireEvent.keyDown(next, { key: "ArrowRight", ...extra });
      expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    }
    fireEvent.keyDown(next, { key: "ArrowRight" });
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
  });
});

describe("spotlight work and recovery", () => {
  it("retains unchanged geometry while still reacting to a resize and stopping work when paused", async () => {
    vi.useFakeTimers();
    const target = control("audit-fixed");
    const measure = vi.spyOn(target, "getBoundingClientRect");
    const targets = [{ sel: '[data-testid="audit-fixed"]' }];
    const committed = vi.fn();
    const view = renderHook(({ active }) => useSpotlight(active ? targets : undefined, "fixed"), {
      initialProps: { active: true },
      wrapper: ({ children }: { children: ReactNode }) => (
        <Profiler id="spotlight" onRender={committed}>
          {children}
        </Profiler>
      ),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    const original = view.result.current.box;
    expect(original).not.toBeNull();
    committed.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(view.result.current.box).toBe(original);
    expect(committed).not.toHaveBeenCalled();
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width - 100 });
    fireEvent(window, new Event("resize"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(view.result.current.box).not.toBe(original);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    view.rerender({ active: false });
    expect(view.result.current.box).toBeNull();
    measure.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(measure).not.toHaveBeenCalled();
  });

  it("uses the visible fallback when its connected target becomes hidden, and reports disappearance", async () => {
    vi.useFakeTimers();
    const first = control("audit-first");
    const fallback = control("audit-fallback", new DOMRect(100, 300, 160, 40));
    const targets = [{ sel: '[data-testid="audit-first"]' }, { sel: '[data-testid="audit-fallback"]' }];
    const { result } = renderHook(() => useSpotlight(targets, "fallback"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    const firstLeft = result.current.box?.left;
    expect(firstLeft).toBeGreaterThan(390);
    first.getClientRects = () => [] as unknown as DOMRectList;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.box?.left).toBe((firstLeft ?? 0) - 300);
    fallback.remove();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toEqual({ box: null, missing: true });
  });
});
