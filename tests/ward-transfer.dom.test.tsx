import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mock next/link to render anchor tag in jsdom
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { referralState } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Test harness component allowing live interaction with WardFlow state
 * to initiate inter-ward stepdown transfers, accept them, and observe two-ward capacity.
 */
function TransferTestHarness() {
  const { referrals, rejections, bedReleases, leaveBeds, dispatch, now } = useWardFlow();

  const sendingUnit = unitById("bty-adult-secure");
  const receivingUnit = unitById("scgh-adult-open");

  const sendingBreakdown = sendingUnit ? capacityBreakdown(sendingUnit, bedReleases, leaveBeds, now) : null;
  const receivingBreakdown = receivingUnit ? capacityBreakdown(receivingUnit, bedReleases, leaveBeds, now) : null;

  const transferReferrals = referrals.filter(
    (r) => r.source === "psychiatric_ward" && r.originUnitId === "bty-adult-secure",
  );

  return (
    <div>
      <div data-testid="rejection-count">{rejections.length}</div>
      <div data-testid="transfer-referral-count">{transferReferrals.length}</div>
      {transferReferrals.map((r) => (
        <div key={r.id} data-testid={`transfer-card-${r.id}`}>
          <span data-testid={`transfer-state-${r.id}`}>{referralState(r)}</span>
          <span data-testid={`transfer-accepted-unit-${r.id}`}>
            {r.destinations[0]?.state === "accepted" ? r.destinations[0].acceptedUnitId : "none"}
          </span>
          <button
            type="button"
            data-testid={`accept-btn-${r.id}`}
            onClick={() =>
              dispatch({
                type: "ACCEPT_REFERRAL",
                role: "coordinator",
                referralId: r.id,
                destinationKind: "psychiatric_ward",
                unitId: "scgh-adult-open",
                now: NOW_ANCHOR,
              })
            }
          >
            Accept Transfer
          </button>
          <button
            type="button"
            data-testid={`accept-no-unit-btn-${r.id}`}
            onClick={() =>
              dispatch({
                type: "ACCEPT_REFERRAL",
                role: "coordinator",
                referralId: r.id,
                destinationKind: "psychiatric_ward",
                now: NOW_ANCHOR,
              })
            }
          >
            Accept Without Unit
          </button>
        </div>
      ))}

      <button
        type="button"
        data-testid="raise-transfer-btn"
        onClick={() =>
          dispatch({
            type: "RECEIVE_REFERRAL",
            role: "community",
            now: NOW_ANCHOR,
            ageBand: "Adult",
            source: "psychiatric_ward",
            originUnitId: "bty-adult-secure",
            originSiteCode: "BTY",
            urgency: 2,
            destinations: [
              {
                kind: "psychiatric_ward",
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
            ...FIXTURE_HISTORY,
            history: "Stepdown transfer request from adult secure to open rehabilitation.",
          })
        }
      >
        Initiate Inter-Ward Transfer
      </button>

      <div data-testid="sending-unit-capacity">
        <span data-testid="sending-available">{sendingBreakdown?.availableNow}</span>
        <span data-testid="sending-held">{sendingBreakdown?.held}</span>
      </div>

      <div data-testid="receiving-unit-capacity">
        <span data-testid="receiving-available">{receivingBreakdown?.availableNow}</span>
        <span data-testid="receiving-held">{receivingBreakdown?.held}</span>
      </div>
    </div>
  );
}

describe("Inter-Ward Transfer & Capacity Balancing Integration (#PHASE-2)", () => {
  it("initiates inter-ward transfer, accepts it into stepdown unit, and preserves two-ward capacity invariants", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <TransferTestHarness />
      </WardFlowProvider>,
    );

    // Initial state: no transfers raised from Bentley secure yet
    expect(screen.getByTestId("transfer-referral-count").textContent).toBe("0");
    expect(screen.getByTestId("rejection-count").textContent).toBe("0");

    const initialSendingAvailable = Number(screen.getByTestId("sending-available").textContent);
    const initialReceivingAvailable = Number(screen.getByTestId("receiving-available").textContent);

    // 1. Initiate inter-ward transfer
    fireEvent.click(screen.getByTestId("raise-transfer-btn"));

    expect(screen.getByTestId("transfer-referral-count").textContent).toBe("1");
    expect(screen.getByTestId("rejection-count").textContent).toBe("0");

    // Retrieve transfer card
    const cards = screen.getAllByTestId(/^transfer-card-/);
    expect(cards).toHaveLength(1);
    const cardId = (cards[0].getAttribute("data-testid") ?? "").replace("transfer-card-", "");

    expect(screen.getByTestId(`transfer-state-${cardId}`).textContent).toBe("queued");
    expect(screen.getByTestId(`transfer-accepted-unit-${cardId}`).textContent).toBe("none");

    // Sending ward availability remains unchanged while transfer is queued (patient still physically in sending bed)
    expect(Number(screen.getByTestId("sending-available").textContent)).toBe(initialSendingAvailable);

    // 2. Accept transfer into receiving unit (scgh-adult-open)
    fireEvent.click(screen.getByTestId(`accept-btn-${cardId}`));

    expect(screen.getByTestId("rejection-count").textContent).toBe("0");
    expect(screen.getByTestId(`transfer-state-${cardId}`).textContent).toBe("accepted");
    expect(screen.getByTestId(`transfer-accepted-unit-${cardId}`).textContent).toBe("scgh-adult-open");

    // Inpatient remains in sending bed until departure, capacity breakdown remains bounded and valid
    expect(Number(screen.getByTestId("sending-available").textContent)).toBe(initialSendingAvailable);
    expect(Number(screen.getByTestId("receiving-available").textContent)).toBe(initialReceivingAvailable);
  });

  it("refuses malformed or duplicate transfer acceptances without corrupting state", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <TransferTestHarness />
      </WardFlowProvider>,
    );

    // Initiate transfer
    fireEvent.click(screen.getByTestId("raise-transfer-btn"));
    const cards = screen.getAllByTestId(/^transfer-card-/);
    const cardId = (cards[0].getAttribute("data-testid") ?? "").replace("transfer-card-", "");

    // 1. Attempt accepting into a psychiatric ward without specifying a destination unit
    // Should be rejected by reducer (ACCEPT_REFERRAL into a psychiatric ward must name a unit)
    fireEvent.click(screen.getByTestId(`accept-no-unit-btn-${cardId}`));
    expect(screen.getByTestId("rejection-count").textContent).toBe("1");
    expect(screen.getByTestId(`transfer-state-${cardId}`).textContent).toBe("queued");

    // 2. Now accept legitimately
    fireEvent.click(screen.getByTestId(`accept-btn-${cardId}`));
    expect(screen.getByTestId(`transfer-state-${cardId}`).textContent).toBe("accepted");

    // 3. Attempt duplicate acceptance (FD-22: already accepted elsewhere)
    fireEvent.click(screen.getByTestId(`accept-btn-${cardId}`));
    expect(screen.getByTestId("rejection-count").textContent).toBe("2");
    expect(screen.getByTestId(`transfer-state-${cardId}`).textContent).toBe("accepted");
  });
});
