import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The tour player (Josh approved the mock-up on 22 Oct 2026): a spotlight on the step's control with
 * the card beside it, Back and Next, Skip tour, which ends it as Done does, and Close, which keeps
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
const tablet = { on: false };
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.on,
  useIsTabletPortrait: () => tablet.on,
}));

// Go further's steps come from the tour content (`ward-tour-more-steps.ts`, tested on its own); here
// each test sets them, so the player's behaviour does not hang on how many a desk has.
const further: { steps: readonly import("@/components/ward-management/help/ward-tour-steps").TourStep[] } = {
  steps: [],
};
const furtherCalls: string[] = [];
vi.mock("@/components/ward-management/help/ward-tour-more-steps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/help/ward-tour-more-steps")>()),
  goFurtherSteps: (_role: string, device: string) => {
    furtherCalls.push(device);
    return further.steps;
  },
}));

import { WardTour, findTourTarget } from "@/components/ward-management/help/ward-tour";
import { TOUR_AUTO_DONE_STORAGE_KEY, WardTourAutoStart } from "@/components/ward-management/help/ward-tour-auto-start";
import {
  TOUR_SEEN_STORAGE_KEY,
  markTourSeen,
  parseTourSeen,
  readTourStep,
  resetTourSeenForTests,
  saveTourStep,
} from "@/components/ward-management/help/ward-help-store";
import { fullTourSteps } from "@/components/ward-management/help/ward-tour-more-steps";
import { TOUR_AUTO_STARTED_EVENT, WardWhatsNew } from "@/components/ward-management/help/ward-whats-new";

const STEPS = fullTourSteps("coordinator", "desk", tourFacts.facts);

function card() {
  return screen.getByTestId("ward-tour-card");
}

beforeEach(() => {
  route.pathname = "/ward-flow";
  tourFacts.home = "/ward-flow";
  tourFacts.deskHome = "/ward-flow";
  phone.on = false;
  tablet.on = false;
  further.steps = [];
  furtherCalls.length = 0;
  push.mockReset();
  resetTourSeenForTests();
  window.localStorage.removeItem(TOUR_AUTO_DONE_STORAGE_KEY);
});

afterEach(() => {
  resetTourSeenForTests();
  document.body.querySelectorAll("[data-test-control]").forEach((element) => element.remove());
});

describe("tour player", () => {
  it("has no dead Back on the first card, and its welcome says how long once (round 2, #1118)", () => {
    render(<WardTour onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(card().textContent).not.toMatch(/This takes about/);
    act(() => fireEvent.click(screen.getByTestId("ward-tour-next")));
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });

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

  it("closes the tour on Skip tour and marks it seen, so it does not come back on its own", () => {
    const onClose = vi.fn();
    saveTourStep("coordinator", 2);
    render(<WardTour onClose={onClose} />);
    fireEvent.click(screen.getByTestId("ward-tour-skip"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(parseTourSeen(window.localStorage.getItem(TOUR_SEEN_STORAGE_KEY) ?? "")).toContain("coordinator");
    expect(readTourStep("coordinator")).toBe(0);
  });

  it("replays from the first step on the last step", () => {
    render(<WardTour onClose={vi.fn()} />);
    for (let index = 1; index < STEPS.length; index++) fireEvent.click(screen.getByTestId("ward-tour-next"));
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
    // H-0376 / H-0890: placed by transform only, so settling beside the control is no layout shift.
    expect(card().style.transform).toMatch(/^translate\(/);
    expect(card().style.top).toBe("");
    expect(card().style.left).toBe("");
    persona.remove();
    act(() => fireEvent.click(screen.getByTestId("ward-tour-next")));
    // The shift block is not drawn in this test, so the card waits, then shows in the middle.
    await waitFor(() => expect(card().dataset.place).toBe("centre"), { timeout: 3000 });
    expect(screen.queryByTestId("ward-tour-spot")).toBeNull();
    // With no control there is no spotlight re-measure, so the card is placed again on resize.
    const centred = card().style.transform;
    const width = window.innerWidth;
    try {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width + 100 });
      act(() => fireEvent(window, new Event("resize")));
      expect(card().style.transform).not.toBe(centred);
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    }
  });

  it("keeps the same step when the window crosses the phone width", () => {
    const { rerender } = render(<WardTour onClose={vi.fn()} />);
    for (let index = 1; index < STEPS.length; index++) fireEvent.click(screen.getByTestId("ward-tour-next"));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(card().dataset.step).toBe("more-learn");
    phone.on = true;
    rerender(<WardTour onClose={vi.fn()} />);
    const phoneSteps = fullTourSteps("coordinator", "phone", tourFacts.facts);
    expect(card().dataset.step).toBe("more-learn");
    expect(card().textContent).toContain(
      `Step ${phoneSteps.findIndex((candidate) => candidate.id === "more-learn") + 1} of ${phoneSteps.length}`,
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

/** P188: the tour is offered first; this reads the three welcome cards and presses "Start the tour". */
async function startFromOffer() {
  await screen.findByTestId("ward-tour-offer");
  fireEvent.click(screen.getByTestId("ward-tour-welcome-next"));
  fireEvent.click(screen.getByTestId("ward-tour-welcome-next"));
  fireEvent.click(screen.getByRole("button", { name: "Start the tour" }));
}

describe("tour auto-start", () => {
  it("starts once on the desk's home, while the tour has not been seen", async () => {
    const onStart = vi.fn();
    const { rerender } = render(<WardTourAutoStart onStart={onStart} />);
    await startFromOffer();
    expect(onStart).toHaveBeenCalledTimes(1);
    rerender(<WardTourAutoStart onStart={onStart} />);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("starts on its own only once for the desk, even if the tour was never closed", async () => {
    const onStart = vi.fn();
    // Mounted together, as the help host does for a signed-in desk.
    const { unmount } = render(
      <>
        <WardTourAutoStart onStart={onStart} />
        <WardWhatsNew />
      </>,
    );
    await startFromOffer();
    expect(onStart).toHaveBeenCalledTimes(1);
    unmount();
    // A reload: the desk's tour is still unseen, but this desk already had it on this device.
    // TE-08: fake time carries the 500 ms settle timer past its end, so a late start cannot slip by.
    vi.useFakeTimers();
    try {
      render(<WardTourAutoStart onStart={onStart} />);
      act(() => vi.advanceTimersByTime(2000));
    } finally {
      vi.useRealTimers();
    }
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBe("coordinator");
    // A first visit gets the tour, so the what's new note is marked read too.
    expect(window.localStorage.getItem("ward_flow_choice_whats_new_seen")).not.toBeNull();
  });

  it("stays quiet when the device mark cannot be saved", async () => {
    const onStart = vi.fn();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const offered = vi.fn();
    window.addEventListener(TOUR_AUTO_STARTED_EVENT, offered);
    vi.useFakeTimers();
    try {
      render(<WardTourAutoStart onStart={onStart} />);
      act(() => vi.advanceTimersByTime(2000));
      expect(offered).not.toHaveBeenCalled();
      expect(onStart).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      setItem.mockRestore();
      window.removeEventListener(TOUR_AUTO_STARTED_EVENT, offered);
    }
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
      // The welcome cards load on demand, so real time runs again while they arrive.
      vi.useRealTimers();
      await startFromOffer();
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
    await startFromOffer();
    expect(onStart).toHaveBeenCalledTimes(1);
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
    // TE-08: the old 50 ms wait ended before the 500 ms settle timer, so it proved nothing.
    const offered = vi.fn();
    window.addEventListener(TOUR_AUTO_STARTED_EVENT, offered);
    vi.useFakeTimers();
    try {
      render(<WardTourAutoStart onStart={onStart} />);
      act(() => vi.advanceTimersByTime(2000));
    } finally {
      vi.useRealTimers();
      window.removeEventListener(TOUR_AUTO_STARTED_EVENT, offered);
    }
    expect(offered).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("forgets a saved step once the tour is finished", () => {
    saveTourStep("coordinator", 3);
    render(<WardTour onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("ward-tour-skip"));
    expect(readTourStep("coordinator")).toBe(0);
  });
});

/** A sideways (or other) stroke across an element, as a finger on a touch screen makes it. */
function swipe(element: HTMLElement, dx: number, dy = 0) {
  fireEvent.touchStart(element, { touches: [{ clientX: 200, clientY: 300 }] });
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
}

function chapterOf(id: string | undefined) {
  return STEPS.find((each) => each.id === id)?.chapter;
}

describe("welcome cards before the first-run tour", () => {
  it("shows three cards in order, with dots, Back, Next and the arrow keys, then Start the tour", async () => {
    const onStart = vi.fn();
    render(<WardTourAutoStart onStart={onStart} />);
    const dialog = await screen.findByTestId("ward-tour-offer");
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.dataset.card).toBe("what");
    expect(screen.getByRole("heading", { name: "Welcome to Ward Flow" })).toBeTruthy();
    // No dead Back on the first card; Not now is always there.
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getByRole("button", { name: "Not now" })).toBeTruthy();
    const dots = screen.getAllByRole("button", { name: /^Card \d of 3/u });
    expect(dots).toHaveLength(3);
    expect(dots[0]?.getAttribute("aria-current")).toBe("step");

    fireEvent.click(screen.getByTestId("ward-tour-welcome-next"));
    expect(dialog.dataset.card).toBe("prototype");
    expect(dialog.textContent).toMatch(/synthetic/u);
    expect(dialog.textContent).toMatch(/no real patients/u);
    // The move is said once, for a screen reader.
    expect(screen.getByTestId("ward-tour-welcome-live").textContent).toBe("Card 2. A prototype with made-up data");

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(dialog.dataset.card).toBe("help");
    expect(dialog.textContent).toMatch(/Help is at the foot of the menu on the left/u);
    expect(dialog.textContent).toMatch(/The tour takes about/u);
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(dialog.dataset.card).toBe("prototype");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(dialog.dataset.card).toBe("what");
    fireEvent.click(screen.getByRole("button", { name: /^Card 3 of 3/u }));
    expect(dialog.dataset.card).toBe("help");
    expect(screen.queryByTestId("ward-tour-welcome-next")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start the tour" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("ward-tour-offer")).toBeNull();
  });

  it("moves with a swipe on a touch screen, and ignores an up and down stroke", async () => {
    phone.on = true;
    render(<WardTourAutoStart onStart={vi.fn()} />);
    const dialog = await screen.findByTestId("ward-tour-offer");
    swipe(dialog, -120);
    expect(dialog.dataset.card).toBe("prototype");
    swipe(dialog, 20, -200);
    expect(dialog.dataset.card).toBe("prototype");
    swipe(dialog, 120);
    expect(dialog.dataset.card).toBe("what");
    // A phone has no side menu, so the last card says where Help is there.
    swipe(dialog, -120);
    swipe(dialog, -120);
    expect(dialog.textContent).toMatch(/Help is in the menu, the button at the top left/u);
  });

  it("takes focus, keeps the page behind inert, and closes as Not now on Escape", async () => {
    const onStart = vi.fn();
    const page = document.createElement("button");
    page.dataset.testControl = "";
    document.body.append(page);
    render(<WardTourAutoStart onStart={onStart} />);
    await screen.findByTestId("ward-tour-offer");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("ward-tour-welcome-next")));
    expect(page.closest("[inert]")).not.toBeNull();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByTestId("ward-tour-offer")).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
    // Still once per device: the offer has been made.
    expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBe("coordinator");
  });
});

describe("tour chapter menu", () => {
  it("says where you are in the chapter, lists every chapter and jumps to one", () => {
    render(<WardTour onClose={vi.fn()} />);
    act(() => fireEvent.click(screen.getByTestId("ward-tour-next")));
    const firstChapter = chapterOf(STEPS[1]?.id);
    const inFirst = STEPS.filter((each) => each.chapter === firstChapter).length;
    expect(screen.getByTestId("ward-tour-chapter").textContent).toContain(firstChapter);
    expect(screen.getByTestId("ward-tour-chapter-step").textContent).toBe(
      `${STEPS.findIndex((each) => each.id === STEPS[1]?.id) - STEPS.findIndex((each) => each.chapter === firstChapter) + 1} of ${inFirst}`,
    );
    // The overall place stays under the header.
    expect(screen.getByTestId("ward-tour-meta").textContent).toMatch(new RegExp(`^Step 2 of ${STEPS.length}`, "u"));

    const toggle = screen.getByTestId("ward-tour-chapter");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const names = [...new Set(STEPS.map((each) => each.chapter))];
    const items = Array.from(screen.getByTestId("ward-tour-chapters").querySelectorAll("button"));
    expect(items.map((item) => item.textContent?.replace(/\d+ steps?.*$/u, ""))).toEqual(names);
    expect(items.find((item) => item.getAttribute("aria-current") === "step")?.textContent).toContain(firstChapter);
    // Focus starts on the chapter you are in, and the arrow keys move through the list.
    expect(document.activeElement?.getAttribute("aria-current")).toBe("step");

    const lastChapter = names.at(-1);
    fireEvent.click(items.at(-1)!);
    expect(screen.queryByTestId("ward-tour-chapters")).toBeNull();
    expect(card().dataset.step).toBe(STEPS.find((each) => each.chapter === lastChapter)?.id);
    expect(document.activeElement).toBe(toggle);
  });

  it("closes the menu on Escape before the tour", () => {
    const onClose = vi.fn();
    render(<WardTour onClose={onClose} />);
    fireEvent.click(screen.getByTestId("ward-tour-chapter"));
    expect(screen.getByTestId("ward-tour-chapters")).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByTestId("ward-tour-chapters")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("tour swipe and device", () => {
  it("goes Next on a swipe left and Back on a swipe right, and ignores a scroll", () => {
    render(<WardTour onClose={vi.fn()} />);
    swipe(card(), 120);
    expect(card().dataset.step).toBe(STEPS[0]?.id);
    swipe(card(), -120);
    expect(card().dataset.step).toBe(STEPS[1]?.id);
    swipe(card(), -30, -240);
    expect(card().dataset.step).toBe(STEPS[1]?.id);
    swipe(card(), 120);
    expect(card().dataset.step).toBe(STEPS[0]?.id);
  });

  it("reads the screen as a phone, a tablet or a desk", () => {
    const { rerender } = render(<WardTour onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-tour").dataset.device).toBe("desk");
    tablet.on = true;
    rerender(<WardTour onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-tour").dataset.device).toBe("tablet");
    expect(furtherCalls).toContain("tablet");
    phone.on = true;
    rerender(<WardTour onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-tour").dataset.device).toBe("phone");
  });
});

describe("Go further after the first-run tour", () => {
  const extra = [
    { id: "further-a", chapter: "Your desk", title: "Further A", body: "First extra step." },
    { id: "further-b", chapter: "Your desk", title: "Further B", body: "Second extra step." },
  ] as unknown as import("@/components/ward-management/help/ward-tour-steps").TourStep[];

  it("offers no Go further when there are no extra steps", () => {
    render(<WardTour onClose={vi.fn()} />);
    for (let index = 1; index < STEPS.length; index++) fireEvent.click(screen.getByTestId("ward-tour-next"));
    expect(screen.queryByTestId("ward-tour-further")).toBeNull();
    expect(screen.getByTestId("ward-tour-done")).toBeTruthy();
  });

  it("offers the extra steps beside Done at the end, and plays them with the same player", () => {
    further.steps = extra;
    const onClose = vi.fn();
    render(<WardTour onClose={onClose} />);
    for (let index = 1; index < STEPS.length; index++) fireEvent.click(screen.getByTestId("ward-tour-next"));
    expect(card().dataset.step).toBe("can-do");
    // Not offered before the end.
    expect(screen.getByTestId("ward-tour-further").textContent).toBe("Go further, 2 more steps");
    expect(screen.getByTestId("ward-tour-done")).toBeTruthy();
    fireEvent.click(screen.getByTestId("ward-tour-further"));
    expect(card().dataset.step).toBe("further-a");
    expect(screen.getByTestId("ward-tour-meta").textContent).toMatch(
      new RegExp(`^Step ${STEPS.length + 1} of ${STEPS.length + 2}`, "u"),
    );
    expect(screen.queryByTestId("ward-tour-further")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-tour-next"));
    expect(card().dataset.step).toBe("further-b");
    expect(screen.queryByTestId("ward-tour-further")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-tour-done"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(readTourStep("coordinator")).toBe(0);
  });

  it("picks up inside Go further when the tour was closed there", () => {
    further.steps = extra;
    saveTourStep("coordinator", STEPS.length, "further-a");
    render(<WardTour onClose={vi.fn()} />);
    expect(card().dataset.step).toBe("further-a");
  });
});
