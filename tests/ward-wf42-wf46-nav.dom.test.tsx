/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatisticsOwnRedirect } from "@/components/ward-management/statistics/statistics-own-redirect";
import { setStatisticsSamples } from "@/components/ward-management/statistics/statistics-samples";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { resetWardLiveRegionForTests, WardLiveRegion } from "@/components/ward-management/shell/ward-live-region";
import { homeHrefFor, screenForPath } from "@/components/ward-management/ward-role-access";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/ward-flow/statistics",
}));

afterEach(() => {
  cleanup();
  replace.mockReset();
  setStatisticsSamples(false);
  resetWardLiveRegionForTests();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("WF-42 navigation quirks", () => {
  it("treats /activity and /help as home for access so the redirect pages can open", () => {
    expect(screenForPath("/ward-flow/activity")).toEqual({ screen: "home" });
    expect(screenForPath("/ward-flow/help")).toEqual({ screen: "home" });
  });

  it("redirects a ward desk from bare /statistics to its own ward statistics", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    });
    render(
      <StatisticsOwnRedirect>
        <p>hub</p>
      </StatisticsOwnRedirect>,
    );
    expect(screen.getByTestId("ward-statistics-own-redirect")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/ward-flow/statistics/ward/rph-adult-secure");
  });

  it("announces when example history is turned on or off", () => {
    render(<WardLiveRegion />);
    const live = screen.getByTestId("ward-live-region");
    act(() => {
      setStatisticsSamples(true);
    });
    expect(live).toHaveTextContent(/Example history on/i);
    expect(live).toHaveTextContent(/Invented/i);
    act(() => {
      setStatisticsSamples(false);
    });
    expect(live).toHaveTextContent(/Example history off/i);
  });
});

describe("WF-46 access admin home", () => {
  it("sends the access admin home to Governance", () => {
    expect(homeHrefFor({ role: "admin", scope: { kind: "statewide" } }, (name) => name)).toBe("/ward-flow/governance");
  });
});
