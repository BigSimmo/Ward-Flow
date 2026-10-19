import "@testing-library/jest-dom/vitest";
import { useEffect } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReferralInformationNeedsPanel } from "@/components/ward-management/referrals/referral-information-needs-panel";
import { WardReferralInbox } from "@/components/ward-management/referrals/ward-referral-inbox";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Smart features ideas 3 and 4 on screen: the ward's receipt, its ask, and the referrer's tick-off. */
let pathname = "/ward-flow/referrals";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const seed = seedWardFlowState();
const WARD = seed.units.find((unit) => unit.cohort === "Adult")!;

function Refer() {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      source: "community",
      originSiteCode: "BTY",
      urgency: 2,
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: WARD.id,
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Bentley" },
      transportNeeded: true,
      history: "Synthetic referral.",
    });
  }, [dispatch]);
  return null;
}

function WardCopy() {
  const { referrals } = useWardFlow();
  const arm = referrals.at(-1)?.destinations[0];
  return (
    <output data-testid="copy">
      {arm
        ? `${arm.state}|${arm.openedAt ?? "unopened"}|${(arm.informationNeeds ?? []).map((n) => `${n.need}:${n.metAt ?? "open"}`).join(",")}`
        : ""}
    </output>
  );
}

function Referrer() {
  const { referrals } = useWardFlow();
  const referral = referrals.at(-1);
  return referral ? <ReferralInformationNeedsPanel referral={referral} now={NOW_ANCHOR} /> : null;
}

function setup() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Refer />
      <WardReferralInbox unitId={WARD.id} />
      <WardCopy />
      <Referrer />
    </WardFlowProvider>,
  );
}

describe("referral receipts and what we still need", () => {
  beforeEach(() => {
    pathname = "/ward-flow/referrals";
  });

  it("marks the referral opened when the ward itself shows it, and not when the coordinator does", () => {
    setup();
    expect(screen.getByTestId("copy")).toHaveTextContent("queued|unopened|");
  });

  it("stamps opened on the ward's own route, without answering", () => {
    pathname = `/ward-flow/ward/${WARD.id}`;
    setup();
    expect(screen.getByTestId("copy")).toHaveTextContent(`queued|${NOW_ANCHOR}|`);
  });

  it("lets the ward ask for listed items, and keeps the tick-off for the referrer side", () => {
    pathname = `/ward-flow/ward/${WARD.id}`;
    setup();
    const inbox = within(screen.getByRole("region", { name: "Ward referral inbox" }));
    const ask = inbox.getByRole("button", { name: "Ask the referrer" });
    expect(ask).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(inbox.getByRole("checkbox", { name: "Drug screen" }));
    fireEvent.click(ask);
    expect(screen.getByTestId("copy")).toHaveTextContent("queued|");
    expect(screen.getByTestId("copy")).toHaveTextContent("drug_screen:open");
    expect(inbox.getByText("Waiting on the referrer")).toBeInTheDocument();

    // On the ward's route the referrer's button is greyed with its reason.
    const panel = within(screen.getByRole("region", { name: "What the ward still needs" }));
    const provided = panel.getByRole("button", { name: "Mark Drug screen as provided" });
    expect(provided).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(provided);
    expect(screen.getByTestId("copy")).toHaveTextContent("drug_screen:open");
  });
});
