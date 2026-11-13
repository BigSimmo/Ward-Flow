import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BedMeetingAgendaScreen } from "@/components/ward-management/bed-meeting/bed-meeting-agenda-screen";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { DESK_GUIDES } from "@/components/ward-management/help/ward-help-guide";
import { tourSteps, type TourFacts } from "@/components/ward-management/help/ward-tour-steps";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import {
  referralContactSendError,
  type ReferralContact,
} from "@/components/ward-management/referrals/referral-submission";
import { contactFieldErrors } from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { TodaysReviewScreen } from "@/components/ward-management/review/todays-review-screen";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { DemonstrationChart } from "@/components/ward-management/statistics/statistics-demonstration-chart";
import { generateDemonstrationSeries } from "@/components/ward-management/statistics/statistics-demonstration";
import { setStatisticsSamples } from "@/components/ward-management/statistics/statistics-samples";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * Design critique v2, section B: the demo-safe fixes Josh approved on 13 Nov 2026 (8:08 pm Perth).
 * One check per item that jsdom can see. The CSS-only items (C24, C29, C04, C25, C23) are not here.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("bed-meeting-tv", null);
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

const FACTS: TourFacts = {
  place: "Dabakarn at Royal Perth Hospital",
  placeName: "Dabakarn",
  readyBeds: 26,
  openMovements: 70,
  referralsWaiting: 7,
  waitingInEd: 62,
  topEd: { name: "Armadale ED", waiting: 22, longest: "7d 1h" },
  ward: { beds: 20, occupied: 16, ready: 1, confirmedAt: "10:22" },
  ed: { waiting: 5, longest: "13h 24m", targetHours: 24 },
  activeJobs: 13,
};

describe("C06: Help and the tour use today's names", () => {
  it("the coordinator's guide opens on Needs you, not the retired My list", () => {
    expect(DESK_GUIDES.coordinator.startsAt).toContain("Home opens Needs you: Act now, Referrals to decide");
    expect(DESK_GUIDES.coordinator.startsAt).not.toContain("My list");
  });

  it("the coordinator's phone tab bar step names the dock as it is: Home, Capacity, Alerts and Tools", () => {
    const dock = tourSteps("coordinator", "phone", FACTS).find((step) => step.title === "The tab bar");
    expect(dock?.body).toBe("Home, Capacity, Alerts and Tools. Referrals, with 7 awaiting a decision, is in the menu.");
    const unknown = tourSteps("coordinator", "phone", { ...FACTS, referralsWaiting: undefined }).find(
      (step) => step.title === "The tab bar",
    );
    expect(unknown?.body).toBe("Home, Capacity, Alerts and Tools. Referrals is in the menu.");
  });
});

describe("C21: Today's review labels each figure by what it counts", () => {
  it("keeps Declines for the hero's count and names the chip's lines by ward", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <TodaysReviewScreen />
      </WardFlowProvider>,
    );
    const review = screen.getByTestId("ward-todays-review");
    expect(within(review).getByRole("tab", { name: /^Wards declining/ })).toBeInTheDocument();
    expect(within(review).queryByRole("tab", { name: /^Declines/ })).toBeNull();
    expect(within(review).getByText("Declines")).toBeInTheDocument();
  });
});

describe("C14: the phone helper says what Send will do", () => {
  const contact = (phone: string): ReferralContact => ({
    name: "Synthetic Referrer",
    email: "",
    phone,
    role: "Registrar",
    location: "Synthetic ED",
  });

  it("a typed number Send refuses shows Send's own refusal, not 'You can still send'", () => {
    const typed = contact("call the desk");
    const refusal = referralContactSendError(typed);
    expect(refusal).not.toBeNull();
    expect(contactFieldErrors(typed).phone).toBe(refusal);
  });

  it("a short number Send accepts still warns that it can be sent", () => {
    const short = contact("5550 12");
    expect(referralContactSendError(short)).toBeNull();
    expect(contactFieldErrors(short).phone).toBe("This phone number cannot be rung. You can still send.");
    expect(contactFieldErrors(contact("")).phone).toBe("Phone number not recorded. You can still send.");
    expect(contactFieldErrors(contact("08 5550 1234")).phone).toBeUndefined();
  });
});

describe("C11: a site bed manager's own wards open on Capacity", () => {
  it("opens the desk's own service even when it is not first in network order", () => {
    const seed = seedWardFlowState();
    const unit = seed.units.find((candidate) => {
      const service = siteByCode(candidate.siteCode)?.service;
      return service !== undefined && wardServiceOrder.indexOf(service) >= 2;
    });
    expect(unit, "the seed must hold a ward in a service after the first two").toBeDefined();
    const service = siteByCode(unit!.siteCode)!.service;
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: unit!.siteCode } });
    });
    render(
      <WardFlowProvider>
        <CapacityScreen />
      </WardFlowProvider>,
    );
    const group = screen.getByRole("region", { name: `${service} bed map` });
    expect(within(group).getAllByRole("button", { expanded: true }).length).toBeGreaterThan(0);
  });
});

describe("C08: the agenda's TV button says where it goes", () => {
  it("reads Open on TV and links to the TV view", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingAgendaScreen />
      </WardFlowProvider>,
    );
    const button = screen.getByTestId("agenda-start-meeting");
    expect(button).toHaveTextContent(/^Open on TV$/u);
    expect(button).toHaveAttribute("href", "/ward-flow/bed-meeting");
  });
});

describe("C10: a sample chart shows its real range", () => {
  it("prints the series' low and high under the chart", () => {
    act(() => setStatisticsSamples(true));
    const series = generateDemonstrationSeries(
      "standard",
      5000,
      {
        label: "Synthetic occupancy",
        whatItWouldMeasure: "Synthetic share of beds in use.",
        whyItIsNotReal: "Invented for the preview.",
      },
      { baseline: 80, volatility: 4, minValue: 60, maxValue: 100 },
    );
    const values = series.points.map((point) => point.value);
    render(<DemonstrationChart series={series} unit="%" testId="fix-x-chart" />);
    expect(screen.getByTestId("fix-x-chart-scale")).toHaveTextContent(
      `Scale ${Math.round(Math.min(...values))}% to ${Math.round(Math.max(...values))}%`,
    );
    act(() => setStatisticsSamples(false));
  });
});

describe("C15: an empty upload says it is empty", () => {
  it("reads Empty file, not 1 KB, and Add to pack says why it waits", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-officer-select-WF-005"));
    fireEvent.click(within(screen.getByTestId("ward-officer-detail")).getByRole("tab", { name: /^Forms/ }));
    const pack = screen.getByTestId("ward-officer-forms-pack-WF-005");
    fireEvent.click(within(pack).getByRole("button", { name: /^Upload transport order/ }));
    const dialog = screen.getByRole("dialog", { name: /Upload Form 4A/ });
    const empty = new File([], "empty.pdf", { type: "application/pdf" });
    fireEvent.change(within(dialog).getByLabelText("Form file"), { target: { files: [empty] } });
    expect(within(dialog).getByText("Empty file")).toBeInTheDocument();
    expect(within(dialog).queryByText("1 KB")).toBeNull();
    expect(within(dialog).getByText("This file is empty. Choose another file.")).toBeInTheDocument();
    expect(within(dialog).queryByText("Choose a file first.")).toBeNull();
  });
});
