/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/link for jsdom
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

const UNIT_ID = "rph-adult-secure";

// 09:40 AM on Day 0 = 9 * 60 + 40 = 580 minutes
const OVERDUE_NOW = 580;

function ConfirmRollupHelper() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="helper-confirm-btn"
      onClick={() =>
        dispatch({
          type: "CONFIRM_MORNING_ROLLUP",
          role: "ward",
          now,
          unitId: UNIT_ID,
          actingUnitId: UNIT_ID,
          expectedDischarges: 3,
        })
      }
    >
      confirm
    </button>
  );
}

function SendBuzzHelper() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="helper-send-buzz-btn"
      onClick={() =>
        dispatch({
          type: "SEND_WARD_BUZZ",
          role: "coordinator",
          now,
          unitId: UNIT_ID,
          message: "Please review and confirm ward capacity.",
          urgent: true,
        })
      }
    >
      send buzz
    </button>
  );
}

describe("WardScreen 09:30 Morning Rollup & Notification Center", () => {
  afterEach(cleanup);

  it("renders the 09:30 Morning Bed Rollup Overdue banner when now is past 09:30 and rollup is unconfirmed", () => {
    render(
      <WardFlowProvider initialNow={OVERDUE_NOW}>
        <WardScreen unitId={UNIT_ID} />
      </WardFlowProvider>,
    );

    const banner = screen.getByTestId("ward-morning-rollup-overdue-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("09:30 Morning Bed Rollup Overdue");

    const confirmBtn = screen.getByTestId("ward-confirm-morning-rollup-btn");
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);

    expect(screen.queryByTestId("ward-morning-rollup-overdue-banner")).not.toBeInTheDocument();
    const confirmedBanner = screen.getByTestId("ward-morning-rollup-confirmed-banner");
    expect(confirmedBanner).toBeInTheDocument();
    expect(confirmedBanner).toHaveTextContent("09:30 Morning Bed Rollup Confirmed");
  });

  it("renders the confirmed banner when morning rollup is already recorded for today", () => {
    render(
      <WardFlowProvider initialNow={OVERDUE_NOW}>
        <ConfirmRollupHelper />
        <WardScreen unitId={UNIT_ID} />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId("helper-confirm-btn"));

    expect(screen.queryByTestId("ward-morning-rollup-overdue-banner")).not.toBeInTheDocument();
    const confirmedBanner = screen.getByTestId("ward-morning-rollup-confirmed-banner");
    expect(confirmedBanner).toBeInTheDocument();
    expect(confirmedBanner).toHaveTextContent("09:30 Morning Bed Rollup Confirmed");
    expect(confirmedBanner).toHaveTextContent("3 discharges scheduled today");
  });

  it("toggles the WardNotificationCenter when the Tasks & Buzzes action button is clicked", () => {
    render(
      <WardFlowProvider initialNow={OVERDUE_NOW}>
        <SendBuzzHelper />
        <WardScreen unitId={UNIT_ID} />
      </WardFlowProvider>,
    );

    const toggleBtn = screen.getByTestId("ward-notifications-toggle-btn");
    expect(toggleBtn).toBeInTheDocument();

    // Notification center initially closed
    expect(screen.queryByTestId("ward-notification-center-wrap")).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("ward-notification-center-wrap")).toBeInTheDocument();
    expect(screen.getByTestId("ward-notification-center")).toBeInTheDocument();

    // Click again to close
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId("ward-notification-center-wrap")).not.toBeInTheDocument();
  });
});
