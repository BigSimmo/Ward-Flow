import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.on,
}));

import { HOW_TOS } from "@/components/ward-management/help/ward-help-howto";
import { WardShowMe } from "@/components/ward-management/help/ward-show-me";

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
  push.mockReset();
});

afterEach(() => {
  document.body.querySelectorAll("[data-test-control]").forEach((element) => element.remove());
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
    act(() => fireEvent.keyDown(screen.getByTestId("ward-show-me-next"), { key: "ArrowRight" }));
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
    act(() => fireEvent.keyDown(screen.getByTestId("ward-show-me-done"), { key: "ArrowLeft" }));
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-back")));
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Back to Help" })));
    expect(onBack).toHaveBeenCalledTimes(1);
    for (let step = 0; step < 2; step++) act(() => fireEvent.click(screen.getByTestId("ward-show-me-next")));
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
  });
});
