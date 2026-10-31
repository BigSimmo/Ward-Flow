// Desk views (Josh, 31 Oct 2026): the one Referrals board, as the nurse in charge sees it (role
// "ward"). It names the ward, drops the network lenses (pills, Next overdue, meeting list, runway,
// statewide beds) and keeps the ward's own Accept and Decline. Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const desk = vi.hoisted(() => ({ role: "coordinator" as "coordinator" | "ward", unitId: "" }));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({
    role: desk.role,
    scope: desk.role === "ward" ? { kind: "ward", unitIds: [desk.unitId] } : { kind: "statewide" },
  }),
}));

// The ward's lines here are whole local records, not a shared sender summary.
vi.mock("@/components/ward-management/ward-sender-presentation", () => ({
  useSenderPresentation: () => ({ required: false, referralFor: () => undefined }),
}));

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { ReferralPhoneHero } from "@/components/ward-management/referrals/referral-board-phone";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";

const SEED = seedWardFlowState();
const WARD = SEED.units[0]!;
// A queued referral with its ward arm addressed to this ward, as the scoped ward desk receives it.
const queuedSource = referralQueueOrder(SEED.referrals).find((referral) =>
  referral.destinations.some((arm) => arm.destination.kind === "psychiatric_ward"),
)!;
const TO_WARD: Referral = {
  ...queuedSource,
  destinations: queuedSource.destinations.map((arm) =>
    arm.destination.kind === "psychiatric_ward"
      ? { ...arm, destination: { ...arm.destination, unitId: WARD.id } }
      : arm,
  ),
};

beforeEach(() => {
  const split = (query: string) => ({
    matches: query === "(min-width: 64rem)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: split });
});
afterEach(() => {
  cleanup();
  desk.role = "coordinator";
  desk.unitId = "";
});

function Board({ referrals }: { referrals?: Referral[] }) {
  const value = useWardFlow();
  if (!referrals) return <ReferralBoard />;
  return (
    <WardFlowOverride value={{ ...value, referrals, movements: [] }}>
      <ReferralBoard />
    </WardFlowOverride>
  );
}

function renderBoardAs(role: "coordinator" | "ward", referrals?: Referral[]) {
  desk.role = role;
  desk.unitId = WARD.id;
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Board referrals={referrals} />
    </WardFlowProvider>,
  );
}

const hero = () => screen.getByTestId("ward-referral-kpis");

describe("Referrals as the nurse in charge", () => {
  it("leaves the coordinator's board as it is", () => {
    renderBoardAs("coordinator");
    expect(within(hero()).getByText(/\d+ awaiting decision/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Highlight referrals" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bed meeting list/ })).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-board-own-ward-empty")).not.toBeInTheDocument();
  });

  it("names the ward's own requests and drops the network lenses", async () => {
    renderBoardAs("ward", [TO_WARD]);
    expect(within(hero()).getByText(`1 for ${WARD.name} to answer`)).toBeInTheDocument();
    expect(screen.queryByTestId(/^ward-referral-highlight-/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next overdue/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bed meeting list/ })).not.toBeInTheDocument();
    // The ward keeps its decision pane, which is not a read-only desk.
    const rows = screen.getAllByTestId(/^ward-referral-board-select-(?!decided)/);
    fireEvent.click(rows[0]!);
    const detail = screen.getByRole("region", { name: "Selected referral detail" });
    expect(within(detail).queryByTestId("ward-referral-read-only-foot")).not.toBeInTheDocument();
    // Its own Accept and Decline: the decision's Decline, or the bottom bar's way back to it.
    expect(
      await within(detail).findByTestId(/^ward-referral-match-decline-(open|reason-)|^ward-referral-foot-decide$/),
    ).toBeInTheDocument();
  });

  it("says an empty ward queue in one line and gives the queue the width", () => {
    renderBoardAs("ward", []);
    expect(within(hero()).getByText(`Nothing for ${WARD.name} to answer`)).toBeInTheDocument();
    expect(within(hero()).queryByText(/^Oldest/)).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-board-own-ward-empty")).toHaveTextContent(
      `No referral or bed offer for ${WARD.name}.`,
    );
    expect(screen.queryByRole("region", { name: "Selected referral detail" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-board-order-note")).not.toBeInTheDocument();
  });

  it("keeps the phone hero to the ward's title", () => {
    const props = {
      count: 2,
      oldest: "1h",
      median: undefined,
      overdue: 1,
      tier1: 1,
      bedsReady: 3,
      highlight: null,
      onHighlight: () => {},
      onBeds: () => {},
      bedsOpen: false,
      onNextOverdue: () => {},
      onMeeting: () => {},
    };
    const view = render(<ReferralPhoneHero {...props} />);
    expect(screen.getByText("Referrals · statewide")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-phone-beds")).toBeInTheDocument();
    view.rerender(<ReferralPhoneHero {...props} placeName="Synthetic Ward" />);
    const phoneHero = screen.getByTestId("ward-referral-phone-hero");
    expect(within(phoneHero).getByText("Referrals")).toBeInTheDocument();
    expect(within(phoneHero).getByRole("heading")).toHaveTextContent("2 for Synthetic Ward to answer");
    expect(screen.queryByTestId("ward-referral-phone-beds")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bed meeting list/ })).not.toBeInTheDocument();
    view.rerender(<ReferralPhoneHero {...props} count={0} oldest={undefined} placeName="Synthetic Ward" />);
    expect(within(phoneHero).getByRole("heading")).toHaveTextContent("Nothing for Synthetic Ward to answer");
    expect(screen.queryByText("No referral waiting")).not.toBeInTheDocument();
  });
});
