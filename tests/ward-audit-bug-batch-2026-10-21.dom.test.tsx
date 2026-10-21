// tests/ward-audit-bug-batch-2026-10-21.dom.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same reason as every sibling settings dom suite: jsdom has no App Router context for next/link.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import {
  WARD_FLOW_DEMO_STORAGE_KEY,
  WardFlowProvider,
  useWardFlow,
} from "@/components/ward-management/ward-flow-provider";
import { referralState } from "@/components/ward-management/ward-referrals";
import type { Referral } from "@/components/ward-management/ward-model";
import { ToastProvider } from "@/components/wf";

/**
 * Audit A2-7 (8 Oct 2026, re-confirmed 21 Oct): Settings "Clear session" removed the saved demo
 * state, but the provider saves the day it is showing after every change, so the next change wrote
 * the old work straight back. Synthetic seed data only.
 */
describe("A2-7: Clear session stays cleared after the next change", () => {
  let current: ReturnType<typeof useWardFlow> | undefined;
  function Capture() {
    current = useWardFlow();
    return null;
  }
  function storedReferral(id: string): Referral | undefined {
    const raw = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
    if (!raw) return undefined;
    const referrals = (JSON.parse(raw) as { state: { referrals: Referral[] } }).state.referrals;
    return referrals.find((referral) => referral.id === id);
  }

  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });
  afterEach(() => window.sessionStorage.clear());

  it("does not write the cleared work back on the next save", () => {
    render(
      <ToastProvider>
        <WardFlowProvider>
          <SettingsScreen />
          <Capture />
        </WardFlowProvider>
      </ToastProvider>,
    );
    act(() => {
      current!.dispatch({
        type: "ACCEPT_REFERRAL",
        role: "coordinator",
        now: current!.now,
        referralId: "RF-011",
        destinationKind: "psychiatric_ward",
        unitId: "alb-adult-open",
      });
    });
    expect(referralState(storedReferral("RF-011")!)).toBe("accepted");

    fireEvent.click(screen.getByText("Data and about"));
    fireEvent.click(screen.getByTestId("btn-clear-cache"));
    act(() => {
      current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
    });

    expect(referralState(storedReferral("RF-011")!)).toBe("queued");
    expect(referralState(current!.referrals.find((referral) => referral.id === "RF-011")!)).toBe("queued");
  });
});
