import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** P188 (Josh, 27 Oct 2026): the tour is offered by a small card on a desk's first visit, not opened. */

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

import { TOUR_AUTO_DONE_STORAGE_KEY, WardTourAutoStart } from "@/components/ward-management/help/ward-tour-auto-start";
import { resetTourSeenForTests } from "@/components/ward-management/help/ward-help-store";

/** P188: the tour is offered first; this presses "Start the tour" on the card. */
async function startFromOffer() {
  fireEvent.click(await screen.findByRole("button", { name: "Start the tour" }));
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 700));

beforeEach(() => {
  desk.role = "coordinator";
  resetTourSeenForTests();
  window.localStorage.removeItem(TOUR_AUTO_DONE_STORAGE_KEY);
});

describe("P188: the tour is offered, not forced", () => {
  it("shows the offer card instead of opening the tour", async () => {
    const onStart = vi.fn();
    render(<WardTourAutoStart onStart={onStart} />);
    const card = await screen.findByTestId("ward-tour-offer");
    expect(card.textContent).toBe("Want a quick tour? It takes about 2 minutes.Start the tourNot now");
    await settle();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("starts the existing tour from Start the tour", async () => {
    const onStart = vi.fn();
    render(<WardTourAutoStart onStart={onStart} />);
    await startFromOffer();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("ward-tour-offer")).toBeNull();
  });

  it("closes on Not now and does not come back on this browser", async () => {
    const onStart = vi.fn();
    const first = render(<WardTourAutoStart onStart={onStart} />);
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("ward-tour-offer")).toBeNull();
    first.unmount();
    render(<WardTourAutoStart onStart={onStart} />);
    await settle();
    expect(screen.queryByTestId("ward-tour-offer")).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBe("coordinator");
  });

  it("takes the card away when the desk changes, so it cannot start another desk's tour", async () => {
    const onStart = vi.fn();
    const view = render(<WardTourAutoStart onStart={onStart} />);
    await screen.findByTestId("ward-tour-offer");
    desk.role = "ward";
    view.rerender(<WardTourAutoStart onStart={onStart} />);
    expect(screen.queryByTestId("ward-tour-offer")).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
  });
});
