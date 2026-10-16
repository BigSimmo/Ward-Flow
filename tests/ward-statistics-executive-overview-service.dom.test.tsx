import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import { StatisticsServiceScreen } from "@/components/ward-management/statistics/statistics-service-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/**
 * Executive Statistics on the Overview and one health service (role access plan, Josh's yes 15 Oct
 * 2026): counts only. A small count of people below the hero reads "fewer than 5", a part beside a
 * hidden one is not shown, and each list of people gives way to a note. Beds stay exact. The
 * coordinator, and every desk with the flag off, sees today's screen. Seed data only.
 */

function asDesk(role: "executive" | "coordinator", flag: boolean) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", flag);
    setWardAccess({ role, scope: { kind: "statewide" } });
  });
}

function asPhone() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderScreen(node: ReactNode) {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>
    </ToastProvider>,
  );
}

const text = (testId: string) => (screen.getByTestId(testId).textContent ?? "").trim();

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  vi.unstubAllGlobals();
});

describe("Overview on the executive desk, counts only", () => {
  it("words small decline and decision counts, and keeps beds exact", () => {
    asDesk("executive", true);
    renderScreen(<StatisticsOverviewScreen />);

    // Seed: one no-bed decline, from two of the movements, two escalated.
    expect(text("ward-statistics-overview-decline-no_bed")).toBe("fewer than 5");
    // Every reason above nought is under five and the total of 6 is shown, so one nought is not
    // shown either, or the hidden reasons' sum would be known.
    expect(text("ward-statistics-overview-decline-sex_mix")).toBe("not shown");
    expect(text("ward-statistics-overview-declines-total")).toBe("6");
    expect(text("ward-statistics-overview-declines-movements-with")).toBe("fewer than 5");
    expect(text("ward-statistics-overview-refused-so-far-escalated")).toBe("fewer than 5");
    // A worded bar reads its words to a screen reader, not the number.
    const chart = within(screen.getByTestId("ward-statistics-overview-declines-table"));
    expect(chart.getByText("No bed: fewer than 5")).toBeInTheDocument();

    // Bed figures stay exact: one bed pending preparation, 45 physically empty.
    expect(text("ward-statistics-overview-preparing-value")).toBe("1");
    expect(text("ward-statistics-overview-capacity-empty")).toBe("45");
  });

  it("words the admission stages table, whose parts add up to its total row", () => {
    asDesk("executive", true);
    renderScreen(<StatisticsOverviewScreen />);
    fireEvent.click(screen.getByRole("radio", { name: "Data" }));
    expect(text("ward-statistics-overview-stage-no-bed-yet")).toBe("fewer than 5");
  });

  it("shows the coordinator the exact counts", () => {
    asDesk("coordinator", true);
    renderScreen(<StatisticsOverviewScreen />);
    expect(text("ward-statistics-overview-decline-no_bed")).toBe("1");
    expect(text("ward-statistics-overview-declines-movements-with")).toBe("2");
    expect(text("ward-statistics-overview-refused-so-far-escalated")).toBe("2");
  });
});

describe("one health service on the executive desk, counts only", () => {
  it("words small referral and far-from-home counts, and keeps ready beds exact", () => {
    asDesk("executive", true);
    renderScreen(<StatisticsServiceScreen serviceId="North Metro" />);

    // Seed: two referrals raised, both placed within; four people far from home, all by air.
    expect(text("ward-statistics-service-placement-raised")).toBe("fewer than 5");
    expect(text("ward-statistics-service-placement-within")).toBe("fewer than 5");
    expect(text("ward-statistics-service-out-of-area-value")).toBe("fewer than 5");
    expect(text("ward-statistics-service-out-of-area-band-air_transport_only-count")).toBe("fewer than 5");
    expect(text("ward-statistics-service-out-of-area-band-three_hours_or_more-count")).toBe("0");

    expect(text("ward-statistics-service-ready-total")).toBe("4");
    expect(text("ward-statistics-service-exec-total-beds")).toBe("65");
  });

  it("hides the part beside a lone hidden one, so it cannot be worked back from Raised", () => {
    asDesk("executive", true);
    renderScreen(<StatisticsServiceScreen serviceId="East Metro" />);

    // Seed: 16 raised, one accepted at a South Metro ward, 15 not yet accepted.
    expect(text("ward-statistics-service-placement-raised")).toBe("16");
    expect(text("ward-statistics-service-placement-to-South Metro-count")).toBe("fewer than 5");
    expect(text("ward-statistics-service-placement-not-yet")).toBe("not shown");
    expect(text("ward-statistics-service-placement-elsewhere")).toBe("fewer than 5");
  });

  it("replaces the ED swarm and the far-from-home table with the note", () => {
    asDesk("executive", true);
    renderScreen(<StatisticsServiceScreen serviceId="North Metro" />);

    expect(screen.queryByTestId("ward-statistics-service-ed-swarm")).toBeNull();
    expect(screen.getByTestId("ward-statistics-service-ed-swarm-not-listed")).toHaveTextContent(
      "people are not listed",
    );
    const repatriation = within(screen.getByTestId("ward-statistics-service-repatriation"));
    expect(repatriation.queryByRole("table")).toBeNull();
    expect(repatriation.getByTestId("ward-statistics-service-repatriation-not-listed")).toBeInTheDocument();
  });

  it("on a phone, counts the people far from home without listing them", () => {
    asPhone();
    asDesk("executive", true);
    renderScreen(<StatisticsServiceScreen serviceId="North Metro" />);

    const row = screen.getByTestId("ward-statistics-service-phone-out-of-area");
    expect(row).toHaveTextContent("fewer than 5 people out of area");
    fireEvent.click(row);
    expect(screen.getByTestId("ward-statistics-service-phone-out-of-area-not-listed")).toBeInTheDocument();
  });

  it("shows the coordinator, and the executive with the flag off, the exact counts and the lists", () => {
    asDesk("coordinator", true);
    const first = renderScreen(<StatisticsServiceScreen serviceId="North Metro" />);
    expect(text("ward-statistics-service-placement-raised")).toBe("2");
    expect(text("ward-statistics-service-out-of-area-value")).toBe("4");
    expect(screen.getByTestId("ward-statistics-service-ed-swarm")).toBeInTheDocument();
    first.unmount();

    asDesk("executive", false);
    renderScreen(<StatisticsServiceScreen serviceId="East Metro" />);
    expect(text("ward-statistics-service-placement-not-yet")).toBe("15");
    expect(within(screen.getByTestId("ward-statistics-service-repatriation")).getByRole("table")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-statistics-people-not-listed")).toBeNull();
  });
});
