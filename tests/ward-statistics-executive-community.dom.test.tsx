import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => null }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Executive Statistics are counts only (role access plan): on a community team's page a count of
 * people under five reads "fewer than 5" in the tables below the headline too, and the lists of
 * people (follow-up, due out) are not shown. Every other desk sees the exact counts and the lists.
 * Inner City Clinic's one member in the seed has left the ward, so its "left another way" count is 1.
 */
function renderTeam() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsCommunityScreen teamId="inner-city-clinic" />
    </WardFlowProvider>,
  );
}

const leftOrDischarged = () =>
  ["discharged", "other"].map((key) => screen.getByTestId(`ward-statistics-community-value-${key}`).textContent);

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("executive counts on the community team page", () => {
  it("words a small count in the handover table and hides the lists of people", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    });
    renderTeam();
    expect(leftOrDischarged()).toContain("fewer than 5");
    expect(leftOrDischarged()).not.toContain("1");
    expect(screen.getByTestId("ward-statistics-community-follow-up-not-listed")).toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-community-due-out-not-listed")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("AD-LEFT-01");
    // A nought is not a small group, so it stays.
    expect(screen.getByTestId("ward-statistics-community-value-admitted").textContent).toBe("0");
  });

  it("shows the coordinator the exact count and the lists", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
    });
    renderTeam();
    expect(leftOrDischarged()).toContain("1");
    expect(screen.queryByTestId("ward-statistics-community-follow-up-not-listed")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-community-due-out-not-listed")).toBeNull();
    // The seed's one member left the ward, so the follow-up list names that admission.
    expect(document.getElementById("follow-up")).toHaveTextContent("AD-LEFT-01");
    expect(screen.getByRole("table", { name: /with a discharge date/ })).toBeInTheDocument();
  });
});
