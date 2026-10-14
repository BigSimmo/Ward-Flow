import "@testing-library/jest-dom/vitest";
import { useEffect } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WardReferralInbox } from "@/components/ward-management/referrals/ward-referral-inbox";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { ReferralGender } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * B1 (site review, 12 Oct 2026): the referral inbox answers as the route's own role. The route is
 * the role (`ward-chrome-role.ts`), so each case mocks the path it is on.
 */
let pathname = "/mockups/ward-flow/referrals";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const seed = seedWardFlowState();
const ORIGIN_UNIT_ID = "bty-adult-secure";
const origin = seed.units.find((unit) => unit.id === ORIGIN_UNIT_ID)!;
const ELSEWHERE = seed.units.find((unit) => unit.siteCode !== origin.siteCode && unit.cohort === "Adult")!;
const OTHER_WARD = seed.units.find((unit) => unit.id !== ELSEWHERE.id && unit.cohort === "Adult")!;

function Refer({ source, gender }: { source: "psychiatric_ward" | "community"; gender: ReferralGender }) {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      source,
      ...(source === "psychiatric_ward" ? { originUnitId: ORIGIN_UNIT_ID } : {}),
      originSiteCode: "BTY",
      urgency: 2,
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: ELSEWHERE.id,
          sex: "Female",
          gender,
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Bentley" },
      transportNeeded: true,
      history: "Synthetic transfer request.",
    });
  }, [dispatch, gender, source]);
  return null;
}

function Decided() {
  const { referrals } = useWardFlow();
  const arm = referrals.at(-1)?.destinations[0];
  return <output data-testid="decided">{arm ? `${arm.state}|${arm.decidedBy ?? ""}` : ""}</output>;
}

function setup(source: "psychiatric_ward" | "community", gender: ReferralGender = "Female") {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Refer source={source} gender={gender} />
      <WardReferralInbox unitId={ELSEWHERE.id} />
      <Decided />
    </WardFlowProvider>,
  );
  return within(screen.getByRole("region", { name: "Ward referral inbox" }));
}

describe("the referral inbox answers as the route's role (B1)", () => {
  beforeEach(() => {
    pathname = "/mockups/ward-flow/referrals";
  });

  it("gives the coordinator a working Accept for a transfer from another hospital, recorded as the coordinator", () => {
    const inbox = setup("psychiatric_ward");
    const accept = inbox.getByRole("button", { name: "Accept referral" });
    expect(accept).toBeEnabled();
    fireEvent.click(accept);
    expect(screen.getByTestId("decided")).toHaveTextContent("accepted|Flow coordinator");
  });

  it("greys the receiving ward's Accept for that transfer, with the reason", () => {
    pathname = `/mockups/ward-flow/ward/${ELSEWHERE.id}`;
    const inbox = setup("psychiatric_ward");
    const accept = inbox.getByRole("button", { name: "Accept referral" });
    expect(accept).not.toBeDisabled();
    expect(accept).toHaveAttribute("aria-disabled", "true");
    expect(accept).toHaveAccessibleDescription("Coordinator accepts transfers from another hospital");
    fireEvent.click(accept);
    expect(screen.getByTestId("decided")).toHaveTextContent("queued|");
  });

  it("lets the ward answer its own referral, recorded as the ward", () => {
    pathname = `/mockups/ward-flow/ward/${ELSEWHERE.id}`;
    const inbox = setup("community");
    fireEvent.click(inbox.getByRole("button", { name: "Accept referral" }));
    expect(screen.getByTestId("decided")).toHaveTextContent("accepted|Ward manager");
  });

  it("greys every answer on another ward's route and on a role with no ward seat", () => {
    pathname = `/mockups/ward-flow/ward/${OTHER_WARD.id}`;
    const inbox = setup("community");
    expect(inbox.getByRole("button", { name: "Accept referral" })).toHaveAccessibleDescription(
      `${ELSEWHERE.name} or coordinator only`,
    );
    const waitlist = inbox.getByRole("button", { name: "Waitlist" });
    expect(waitlist).not.toBeDisabled();
    expect(waitlist).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(waitlist);
    expect(screen.getByTestId("decided")).toHaveTextContent("queued|");
  });

  it("lets the coordinator accept a gender placement once it records the reason and the ward check", () => {
    const inbox = setup("community", "Non-binary");
    const accept = inbox.getByRole("button", { name: "Accept referral" });
    fireEvent.click(accept);
    expect(screen.getByTestId("decided")).toHaveTextContent("queued|");
    expect(inbox.getByText("Choose a placement reason and tick the ward check first.")).toBeInTheDocument();
    fireEvent.change(inbox.getByLabelText("Placement reason"), { target: { value: GENDER_PLACEMENT_REASONS[0] } });
    fireEvent.click(inbox.getByLabelText("I have checked this placement with the ward"));
    fireEvent.click(accept);
    expect(screen.getByTestId("decided")).toHaveTextContent("accepted|Flow coordinator");
  });
});
