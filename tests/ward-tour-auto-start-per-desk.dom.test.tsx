import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * HF-01 (help and tour audit, 26 Oct 2026). Josh chose once per desk: every device opens as the
 * coordinator first, so a once-per-device tour meant no other desk ever met its own. Each desk's
 * tour now starts by itself once, the first time that desk reaches its home on the device.
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 700));

beforeEach(() => {
  desk.role = "coordinator";
  resetTourSeenForTests();
  window.localStorage.removeItem(TOUR_AUTO_DONE_STORAGE_KEY);
});

describe("tour auto-start once per desk", () => {
  it("starts each desk's tour once on the same device, and never again for a desk that had it", async () => {
    const onStart = vi.fn();
    const first = render(<WardTourAutoStart onStart={onStart} />);
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    first.unmount();

    desk.role = "ward";
    const second = render(<WardTourAutoStart onStart={onStart} />);
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(2));
    second.unmount();
    expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBe("coordinator,ward");

    desk.role = "coordinator";
    const third = render(<WardTourAutoStart onStart={onStart} />);
    await settle();
    third.unmount();
    desk.role = "ward";
    render(<WardTourAutoStart onStart={onStart} />);
    await settle();
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it("starts the next desk's tour when the desk changes without a reload", async () => {
    const onStart = vi.fn();
    const { rerender } = render(<WardTourAutoStart onStart={onStart} />);
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    desk.role = "ed";
    rerender(<WardTourAutoStart onStart={onStart} />);
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(2));
  });

  it("reads the old once-per-device mark as the coordinator's, so no desk's tour comes back twice", async () => {
    expect(parseTourAutoDone("yes")).toEqual(["coordinator"]);
    expect(parseTourAutoDone("ward,someone else,ed")).toEqual(["ward", "ed"]);
    window.localStorage.setItem(TOUR_AUTO_DONE_STORAGE_KEY, "yes");
    const onStart = vi.fn();
    const first = render(<WardTourAutoStart onStart={onStart} />);
    await settle();
    expect(onStart).not.toHaveBeenCalled();
    first.unmount();
    desk.role = "community";
    render(<WardTourAutoStart onStart={onStart} />);
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY)).toBe("coordinator,community");
  });
});
