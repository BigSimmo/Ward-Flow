import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Night view (feature plan item 29): the page draws the day screens' figures, and its first-night
 * walk round (Show me around Night view) plays end to end on it, lighting every part it names.
 * Synthetic seed data only.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/night",
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

import { screenHelpFor } from "@/components/ward-management/help/ward-help-content";
import { showMeSteps } from "@/components/ward-management/help/ward-help-howto";
import { SCREEN_TOURS, walkPlaysHere } from "@/components/ward-management/help/ward-help-screen-tours";
import { WardShowMe } from "@/components/ward-management/help/ward-show-me";
import { NightViewScreen } from "@/components/ward-management/night/night-view-screen";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import { OverlayRoot } from "@/components/wf/overlay-root";

afterEach(() => vi.restoreAllMocks());

function renderNight(children?: ReactNode) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <OverlayRoot />
      <NightViewScreen />
      {children}
    </WardFlowProvider>,
  );
}

const figure = (testId: string) => screen.getByTestId(testId).querySelector("b")?.textContent?.trim();

describe("Night view page", () => {
  it("shows Home's beds ready and Waiting's figure for the same records", () => {
    const state = seedWardFlowState();
    const counts = wardNavCounts({
      movements: state.movements,
      units: state.units,
      referrals: state.referrals,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      admissions: state.admissions,
      now: NOW_ANCHOR,
      sites: wardSites,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    });
    renderNight();
    expect(figure("night-figure-beds")).toBe(String(counts.capacity?.value));
    expect(figure("night-figure-waiting")).toBe(String(counts.delays?.value));
    expect(screen.getByTestId("night-intake-not-recorded").textContent).toMatch(/^Not recorded/);
  });

  it("has its own help and walk round, played only on its page", () => {
    expect(screenHelpFor("/ward-flow/night", [])?.id).toBe("night");
    const tour = SCREEN_TOURS.find((each) => each.around === "night")!;
    expect(tour).toBeDefined();
    expect(walkPlaysHere(tour, "/ward-flow/night")).toBe(true);
    expect(walkPlaysHere(tour, "/ward-flow")).toBe(false);
  });
});

describe("Show me around Night view", () => {
  it("runs end to end, lighting every part it names", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 300, 200));
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    const tour = SCREEN_TOURS.find((each) => each.around === "night")!;
    const steps = showMeSteps(tour, "desk");
    expect(steps.length).toBeGreaterThanOrEqual(5);
    const onClose = vi.fn();
    renderNight(<WardShowMe id={tour.id} onClose={onClose} onBack={() => {}} />);
    // A page walk round plays where it is open: it never navigates away.
    for (const [at, step] of steps.entries()) {
      await waitFor(() => expect(screen.getByTestId("ward-show-me-card").dataset.step).toBe(String(at)));
      expect(document.getElementById("ward-show-me-title")?.textContent).toBe(step.title);
      await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeInTheDocument());
      expect(screen.queryByTestId("ward-show-me-not-here")).toBeNull();
      fireEvent.click(screen.getByTestId(at === steps.length - 1 ? "ward-show-me-done" : "ward-show-me-next"));
    }
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });
});
