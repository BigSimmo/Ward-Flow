import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * HF-01 (26 Oct 2026) offered each desk's tour once. G3 (Josh, 3 Nov 2026) replaced it: desk switches
 * in the demo kept bringing the offer back, so the tour is offered once per device.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

const desk = { role: "coordinator" as string };
vi.mock("@/components/ward-management/help/ward-help-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/help/ward-help-store")>()),
  useTourRole: () => desk.role,
}));

import {
  TOUR_AUTO_DONE_STORAGE_KEY,
  WardTourAutoStart,
  parseTourAutoDone,
} from "@/components/ward-management/help/ward-tour-auto-start";
import { resetTourSeenForTests } from "@/components/ward-management/help/ward-help-store";
import { WardHelpAccountMemory } from "@/components/ward-management/help/ward-help-account-memory";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

/** P188: the tour is offered first; this reads the three welcome cards and presses "Start the tour". */
async function startFromOffer() {
  fireEvent.click(await screen.findByTestId("ward-tour-welcome-next"));
  fireEvent.click(screen.getByTestId("ward-tour-welcome-next"));
  fireEvent.click(await screen.findByRole("button", { name: "Start the tour" }));
}

/**
 * TE-08 (front-end audit, 5 Nov 2026): mounts on fake time and carries the auto-start's settle timer
 * (500 ms) well past its end before the caller asserts that nothing started. A real-clock sleep let
 * a late start pass by accident under load.
 */
function mountAndSettle<T>(mount: () => T): T {
  vi.useFakeTimers();
  try {
    const result = mount();
    act(() => vi.advanceTimersByTime(2000));
    return result;
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => {
  desk.role = "coordinator";
  resetTourSeenForTests();
  window.localStorage.removeItem(TOUR_AUTO_DONE_STORAGE_KEY);
});

describe("tour auto-start once per device (G3)", () => {
  it("offers the tour once on a device, and a later desk does not get it again", async () => {
    const onStart = vi.fn();
    const first = render(<WardTourAutoStart onStart={onStart} />);
    await startFromOffer();
    expect(onStart).toHaveBeenCalledTimes(1);
    first.unmount();
    expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBe("coordinator");

    desk.role = "ward";
    const second = mountAndSettle(() => render(<WardTourAutoStart onStart={onStart} />));
    expect(screen.queryByRole("button", { name: "Start the tour" })).toBeNull();
    // The offer marks its desk the moment it shows, so an unchanged mark proves none was raised.
    expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBe("coordinator");
    second.unmount();

    desk.role = "coordinator";
    mountAndSettle(() => render(<WardTourAutoStart onStart={onStart} />));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("does not offer the next desk's tour when the desk changes without a reload", async () => {
    const onStart = vi.fn();
    const { rerender } = render(<WardTourAutoStart onStart={onStart} />);
    await startFromOffer();
    expect(onStart).toHaveBeenCalledTimes(1);
    desk.role = "ed";
    mountAndSettle(() => rerender(<WardTourAutoStart onStart={onStart} />));
    expect(screen.queryByRole("button", { name: "Start the tour" })).toBeNull();
    expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBe("coordinator");
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("reads the old once-per-device mark as done for every desk", async () => {
    expect(parseTourAutoDone("yes")).toEqual(["coordinator"]);
    expect(parseTourAutoDone("ward,someone else,ed")).toEqual(["ward", "ed"]);
    window.localStorage.setItem(TOUR_AUTO_DONE_STORAGE_KEY, "yes");
    const onStart = vi.fn();
    desk.role = "community";
    mountAndSettle(() => render(<WardTourAutoStart onStart={onStart} />));
    expect(screen.queryByRole("button", { name: "Start the tour" })).toBeNull();
    expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBe("yes");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("#1427: waits for a signed-in account's Help memory before offering the tour", async () => {
    vi.useFakeTimers();
    try {
      for (const [actorId, tours, offered] of [
        ["synthetic-account-seen", ["ward"], false],
        ["synthetic-account-new", [], true],
      ] as const) {
        resetTourSeenForTests();
        window.localStorage.clear();
        let answer: (value: unknown) => void = () => undefined;
        const preferences = vi.fn(
          (body?: Record<string, unknown>) =>
            new Promise<unknown>((resolve) => {
              if (body) resolve({ shared: true });
              else answer = resolve;
            }),
        );
        const view = render(
          <SharedAccessContext.Provider value={{ api: { preferences } as unknown as SharedAccessApi, actorId }}>
            <WardHelpAccountMemory />
            <WardTourAutoStart onStart={vi.fn()} />
          </SharedAccessContext.Provider>,
        );
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
        // Still loading: nothing is offered yet.
        expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBeNull();
        expect(screen.queryByTestId("ward-tour-offer")).toBeNull();
        await act(async () => {
          answer({ shared: true, tours, tips: [], whatsNew: [], tipsOff: null });
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
        // An account whose tour was offered elsewhere is not offered it again; a new one is.
        expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBe(offered ? "coordinator" : "ward");
        view.unmount();
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
