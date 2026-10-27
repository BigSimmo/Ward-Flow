import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A tour closed at one width reopens on the same subject at the other (PC review, 27 Oct 2026).
 * The phone and the desktop walk different lists, so the saved number alone could name another
 * step; the saved step id keeps the subject. Mocks match `ward-tour.dom.test.tsx`.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
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

import { WardTour } from "@/components/ward-management/help/ward-tour";
import {
  TOUR_STEP_STORAGE_KEY,
  parseTourSteps,
  readTourStepId,
  resetTourSeenForTests,
} from "@/components/ward-management/help/ward-help-store";
import { tourSteps } from "@/components/ward-management/help/ward-tour-steps";

const DESK = tourSteps("coordinator", "desk", tourFacts.facts);
const PHONE = tourSteps("coordinator", "phone", tourFacts.facts);

beforeEach(() => {
  phone.on = false;
  resetTourSeenForTests();
});

afterEach(() => {
  resetTourSeenForTests();
});

describe("saved tour place", () => {
  it("reopens on the same subject after the width changes between visits", () => {
    // A desk step that the phone also walks, but at another position.
    const deskIndex = DESK.findIndex(
      (step, index) => index > 0 && PHONE.some((other, at) => other.id === step.id && at !== index),
    );
    expect(deskIndex).toBeGreaterThan(0);
    const subject = DESK[deskIndex]!.id;

    const { unmount } = render(<WardTour onClose={vi.fn()} />);
    for (let index = 0; index < deskIndex; index++) fireEvent.click(screen.getByTestId("ward-tour-next"));
    fireEvent.keyDown(screen.getByTestId("ward-tour-card"), { key: "Escape" });
    expect(readTourStepId("coordinator")).toBe(subject);
    unmount();

    phone.on = true;
    render(<WardTour onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-tour-card").dataset.step).toBe(subject);
  });

  it("reads an older saved number without an id, and ignores an id that is not a step id", () => {
    expect([...parseTourSteps("ward:3,ed:2:help,officer:1:<b>")]).toEqual([
      ["ward", 3],
      ["ed", 2],
      ["officer", 1],
    ]);
    window.localStorage.setItem(TOUR_STEP_STORAGE_KEY, "coordinator:2:Not An Id");
    expect(readTourStepId("coordinator")).toBeUndefined();
  });
});
