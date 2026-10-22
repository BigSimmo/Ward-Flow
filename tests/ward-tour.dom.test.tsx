import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The tour player (Josh approved the mock-up on 22 Oct 2026): a spotlight on the step's control with
 * the card beside it, Back and Next, Skip tour to what the desk can do, Done, and Close, which keeps
 * the step so Help picks the tour up there. It starts on its own once, on a signed-in desk's home.
 */

const route = { pathname: "/ward-flow" };
const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const tourFacts = {
  facts: { readyBeds: 26, openMovements: 70, referralsWaiting: 7 },
  home: "/ward-flow",
  deskHome: "/ward-flow",
};
vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({ useTourFacts: () => tourFacts }));

const phone = { on: false };
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.on,
}));

import { WardTour, findTourTarget } from "@/components/ward-management/help/ward-tour";
import { WardTourAutoStart } from "@/components/ward-management/help/ward-tour-auto-start";
import {
  TOUR_SEEN_STORAGE_KEY,
  markTourSeen,
  parseTourSeen,
  readTourStep,
  resetTourSeenForTests,
  saveTourStep,
} from "@/components/ward-management/help/ward-help-store";
import { tourSteps } from "@/components/ward-management/help/ward-tour-steps";

const STEPS = tourSteps("coordinator", "desk", tourFacts.facts);

function card() {
  return screen.getByTestId("ward-tour-card");
}

beforeEach(() => {
  route.pathname = "/ward-flow";
  tourFacts.home = "/ward-flow";
  tourFacts.deskHome = "/ward-flow";
  phone.on = false;
  push.mockReset();
  resetTourSeenForTests();
});

afterEach(() => {
  resetTourSeenForTests();
  document.body.querySelectorAll("[data-test-control]").forEach((element) => element.remove());
});

describe("tour player", () => {
  it("walks the desk's steps, lists what the desk can do last, and marks the tour seen when done", () => {
    const onClose = vi.fn();
    render(<WardTour onClose={onClose} />);
    expect(card().dataset.step).toBe("welcome");
    expect(screen.getByRole("dialog", { name: STEPS[0]?.title })).toBeTruthy();
    for (let index = 1; index < STEPS.length; index++) fireEvent.click(screen.getByTestId("ward-tour-next"));
    expect(card().dataset.step).toBe("can-do");
    expect(screen.getByTestId("ward-tour-can-do").textContent).toContain("Refer to wards");
    fireEvent.click(screen.getByTestId("ward-tour-done"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(parseTourSeen(window.localStorage.getItem(TOUR_SEEN_STORAGE_KEY) ?? "")).toContain("coordinator");
    expect(readTourStep("coordinator")).toBe(0);
  });

  it("skips to what the desk can do, and replays from there", () => {
    render(<WardTour onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ward-tour-skip"));
    expect(card().dataset.step).toBe("can-do");
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(card().dataset.step).toBe("welcome");
  });

  it("keeps the step on Close or Escape, and picks up there next time", () => {
    const onClose = vi.fn();
    const { unmount } = render(<WardTour onClose={onClose} />);
    fireEvent.click(screen.getByTestId("ward-tour-next"));
    fireEvent.click(screen.getByTestId("ward-tour-next"));
    fireEvent.keyDown(card(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(readTourStep("coordinator")).toBe(2);
    unmount();
    render(<WardTour onClose={vi.fn()} />);
    expect(card().dataset.step).toBe(STEPS[2]?.id);
    fireEvent.keyDown(card(), { key: "ArrowLeft" });
    expect(card().dataset.step).toBe(STEPS[1]?.id);
  });

  it("goes to the desk's home first when opened from another page", () => {
    route.pathname = "/ward-flow/movements";
    render(<WardTour onClose={vi.fn()} />);
    expect(push).toHaveBeenCalledWith("/ward-flow");
  });

  it("lights the step's control when it is on screen, and centres the card when it is not", async () => {
    const persona = document.createElement("button");
    persona.dataset.testid = "ward-rail-persona-trigger";
    persona.dataset.testControl = "";
    persona.getClientRects = () => [new DOMRect(10, 800, 240, 44)] as unknown as DOMRectList;
    persona.getBoundingClientRect = () => new DOMRect(10, 800, 240, 44);
    persona.scrollIntoView = vi.fn();
    document.body.append(persona);
    expect(findTourTarget({ sel: '[data-testid="ward-rail-persona-trigger"]' })).toBe(persona);
    render(<WardTour onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("ward-tour-spot")).toBeTruthy());
    expect(card().dataset.place).toBe("beside");
    persona.remove();
    act(() => fireEvent.click(screen.getByTestId("ward-tour-next")));
    // The shift block is not drawn in this test, so the card waits, then shows in the middle.
    await waitFor(() => expect(card().dataset.place).toBe("centre"), { timeout: 3000 });
    expect(screen.queryByTestId("ward-tour-spot")).toBeNull();
  });

  it("keeps the same step when the window crosses the phone width", () => {
    const { rerender } = render(<WardTour onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ward-tour-skip"));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(card().dataset.step).toBe("help");
    phone.on = true;
    rerender(<WardTour onClose={vi.fn()} />);
    const phoneSteps = tourSteps("coordinator", "phone", tourFacts.facts);
    expect(card().dataset.step).toBe("help");
    expect(card().textContent).toContain(
      `Step ${phoneSteps.findIndex((candidate) => candidate.id === "help") + 1} of ${phoneSteps.length}`,
    );
  });

  it("goes to the desk's home again when the desk's access settles to another role while open", () => {
    const { rerender } = render(<WardTour onClose={vi.fn()} />);
    expect(push).not.toHaveBeenCalled();
    tourFacts.home = "/ward-flow/statistics";
    rerender(<WardTour onClose={vi.fn()} />);
    expect(push).toHaveBeenCalledWith("/ward-flow/statistics");
  });

  it("holds the page behind still and inert, and gives focus back to what opened it", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Help";
    opener.dataset.testControl = "";
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(<WardTour onClose={vi.fn()} />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("ward-tour-next")));
    expect(opener.closest("[inert]")).not.toBeNull();
    unmount();
    expect(opener.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("finds a control by its words and climbs to the parent asked for", () => {
    const wrap = document.createElement("div");
    wrap.dataset.testControl = "";
    wrap.innerHTML = '<div aria-label="Ward actions"><button>Shift brief</button><button>Raise referral</button></div>';
    for (const element of wrap.querySelectorAll<HTMLElement>("*")) {
      element.getClientRects = () => [new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList;
    }
    document.body.append(wrap);
    const raise = findTourTarget({ sel: '[aria-label="Ward actions"] button', text: "Raise referral" });
    expect(raise?.textContent).toBe("Raise referral");
    expect(
      findTourTarget({ sel: '[aria-label="Ward actions"] button', text: "Raise referral", up: 1 })?.getAttribute(
        "aria-label",
      ),
    ).toBe("Ward actions");
    expect(findTourTarget({ sel: '[data-testid="nothing-here"]' })).toBeNull();
  });
});

describe("tour auto-start", () => {
  it("starts once on the desk's home, while the tour has not been seen", async () => {
    const onStart = vi.fn();
    const { rerender } = render(<WardTourAutoStart onStart={onStart} />);
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    rerender(<WardTourAutoStart onStart={onStart} />);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("waits for the desk's access to settle before it starts", async () => {
    vi.useFakeTimers();
    try {
      const onStart = vi.fn();
      const { rerender } = render(<WardTourAutoStart onStart={onStart} />);
      act(() => vi.advanceTimersByTime(200));
      // The stored desk applies: another role, whose home this page is not.
      tourFacts.home = "/ward-flow/statistics";
      tourFacts.deskHome = "/ward-flow/statistics";
      rerender(<WardTourAutoStart onStart={onStart} />);
      act(() => vi.advanceTimersByTime(2000));
      expect(onStart).not.toHaveBeenCalled();
      route.pathname = "/ward-flow/statistics";
      rerender(<WardTourAutoStart onStart={onStart} />);
      act(() => vi.advanceTimersByTime(2000));
      expect(onStart).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts on the page the app opens for the desk when the tour's own home differs", async () => {
    const onStart = vi.fn();
    tourFacts.home = "/ward-flow/governance";
    tourFacts.deskHome = "/ward-flow/settings";
    route.pathname = "/ward-flow/settings";
    render(<WardTourAutoStart onStart={onStart} />);
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
  });

  it("closes on Escape pressed anywhere, not only inside the card", () => {
    const onClose = vi.fn();
    render(<WardTour onClose={onClose} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays quiet on another page and once the tour has been seen", async () => {
    const onStart = vi.fn();
    route.pathname = "/ward-flow/handover";
    const { unmount } = render(<WardTourAutoStart onStart={onStart} />);
    unmount();
    route.pathname = "/ward-flow";
    act(() => markTourSeen("coordinator"));
    render(<WardTourAutoStart onStart={onStart} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onStart).not.toHaveBeenCalled();
  });

  it("forgets a saved step once the tour is finished", () => {
    saveTourStep("coordinator", 3);
    render(<WardTour onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ward-tour-skip"));
    fireEvent.click(screen.getByTestId("ward-tour-done"));
    expect(readTourStep("coordinator")).toBe(0);
  });
});
