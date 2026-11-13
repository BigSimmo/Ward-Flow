import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { MIDLAND_DECISIONS_KEY } from "@/components/ward-management/community/team-2026/midland-decisions";
import { REFERRALS, STAFF } from "@/components/ward-management/community/team-2026/midland-demo";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/*
 * F-53 (C28, design critique v2, Josh 13 Nov 2026), Midland's invented team page:
 * - phone Accept dropped the case manager chosen in the sheet, because the select was not connected;
 * - on the full referral, Decline and "Ask for more" toasted that a form opens, and none does.
 * Accept now carries the chosen case manager, and the two toasts say plainly they are not wired
 * (building those forms would be a new feature). Every name and figure is invented.
 */
beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function openFirstReferral() {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId="midland" />
      </WardFlowProvider>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByTestId("community-top-more"));
  fireEvent.click(screen.getByRole("menuitem", { name: /^Referrals/u }));
  fireEvent.click(screen.getAllByRole("button", { name: /^Open/u })[0]!);
  return screen.getByTestId("ward-community-phone-demo-referral");
}

const decisions = () =>
  JSON.parse(window.localStorage.getItem(MIDLAND_DECISIONS_KEY) ?? "{}") as Record<string, { line: string }>;

describe("F-53: Midland's referral actions do what they say", () => {
  it("phone Accept records the case manager chosen in the sheet", () => {
    const sheet = openFirstReferral();
    const staff = STAFF.find((each) => each.load)!;
    fireEvent.change(within(sheet).getByTestId("ward-community-phone-demo-case-manager"), {
      target: { value: staff.id },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "Accept for Midland" }));
    const lines = Object.values(decisions()).map((decision) => decision.line);
    expect(lines).toEqual([`Accepted. Case manager: ${staff.name}`]);
  });

  it("phone Accept with Allocate later says it is not allocated yet", () => {
    const sheet = openFirstReferral();
    fireEvent.click(within(sheet).getByRole("button", { name: "Accept for Midland" }));
    expect(Object.values(decisions()).map((decision) => decision.line)).toEqual(["Accepted, not allocated yet"]);
    expect(REFERRALS.some((referral) => decisions()[referral.id] !== undefined)).toBe(true);
  });

  it("full referral Decline and Ask for more never promise a form that does not open", () => {
    const sheet = openFirstReferral();
    fireEvent.click(within(sheet).getByRole("button", { name: /Full referral/u }));
    for (const button of screen.getAllByRole("button", { name: /^(Decline|Ask for more)$/u })) {
      fireEvent.click(button);
    }
    expect(screen.queryByText(/opens a/u)).toBeNull();
    expect(screen.getAllByText("Decline is not wired in this prototype.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ask for more is not wired in this prototype.").length).toBeGreaterThan(0);
  });
});
