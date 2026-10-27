// WS-18 (workflow speed audit, 26 Oct 2026): the Referrals board's A and D keys press the
// decision's own on-screen Accept and Decline. They never decide what the button would not, so a
// read-only desk gets nothing and Decline still asks for a reason. Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

import { REFERRAL_SHORTCUTS } from "@/components/ward-management/referrals/referral-board-parts";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";

// A site whose bed manager (read-only, D-80) sees a referral still in the queue.
const SEED = seedWardFlowState();
const QUEUED_IDS = new Set(referralQueueOrder(SEED.referrals).map(({ id }) => id));
const QUEUED_SITE = [...new Set(SEED.units.map((unit) => unit.siteCode))].find((siteCode) =>
  scopeWardFlowState(
    SEED,
    { role: "bed_manager", scope: { kind: "site", siteCode } },
    { now: NOW_ANCHOR, places: wardPlaceLookup(SEED.units) },
  ).state.referrals.some(({ id }) => QUEUED_IDS.has(id)),
)!;

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
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

function Decisions() {
  const { referrals } = useWardFlow();
  const answered = referrals.filter((referral) =>
    referral.destinations.some((addressing) => addressing.state !== "queued"),
  ).length;
  return <output data-testid="answered-count">{answered}</output>;
}

function renderBoard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <ReferralBoard defaultSelectFirst />
      </WardAccessScope>
      <Decisions />
    </WardFlowProvider>,
  );
}

const answered = () => screen.getByTestId("answered-count").textContent;
const detail = () => screen.getByRole("region", { name: "Selected referral detail" });

describe("decision keys on the Referrals board", () => {
  it("lists A and D in the board's shortcuts", () => {
    const keys = REFERRAL_SHORTCUTS.map(([key]) => key);
    expect(keys).toContain("A");
    expect(keys).toContain("D");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("D opens the decline reasons, or moves to the reason list, and declines nothing", async () => {
    renderBoard();
    await within(detail()).findByTestId(/^ward-referral-match-decline-(open|reason-)/);
    const before = answered();
    const wardForm = within(detail()).queryByTestId("ward-referral-match-decline-open");
    fireEvent.keyDown(window, { key: "d" });
    if (wardForm) {
      expect(within(detail()).getByTestId("ward-referral-match-decline")).toBeInTheDocument();
    } else {
      expect(document.activeElement?.getAttribute("data-testid")).toMatch(/^ward-referral-match-decline-reason-/);
    }
    expect(answered()).toBe(before);
  });

  it("A presses the referral's Accept, which still waits for a ward or a confirmation", async () => {
    renderBoard();
    const accept = await within(detail()).findByTestId(
      /^ward-referral-match-(phone-accept|accept-emergency_department)$/,
    );
    const click = vi.fn();
    accept.addEventListener("click", click);
    const before = answered();
    fireEvent.keyDown(window, { key: "a" });
    if (accept.getAttribute("aria-disabled") === "true") {
      expect(click).not.toHaveBeenCalled();
    } else {
      expect(click).toHaveBeenCalledTimes(1);
    }
    if (accept.getAttribute("data-testid") === "ward-referral-match-accept-emergency_department") {
      // An ED acceptance asks to confirm, exactly as a tap does.
      expect(within(detail()).getByTestId("ward-referral-match-confirm-accept-emergency_department")).toBeVisible();
    }
    expect(answered()).toBe(before);
  });

  it("does nothing with a modifier or with Shift", async () => {
    renderBoard();
    await within(detail()).findByTestId(/^ward-referral-match-decline-(open|reason-)/);
    const focused = document.activeElement;
    fireEvent.keyDown(window, { key: "d", ctrlKey: true });
    fireEvent.keyDown(window, { key: "D", shiftKey: true });
    fireEvent.keyDown(window, { key: "a", metaKey: true });
    expect(document.activeElement).toBe(focused);
    expect(within(detail()).queryByTestId("ward-referral-match-confirm-accept-emergency_department")).toBeNull();
    expect(within(detail()).queryByTestId("ward-referral-match-decline")).toBeNull();
  });

  it("gives a read-only desk nothing to press", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: QUEUED_SITE } });
    });
    renderBoard();
    const rows = await screen.findAllByTestId(/^ward-referral-board-select-(?!decided)/);
    fireEvent.click(rows[0]!);
    expect(within(detail()).getByTestId("ward-referral-read-only")).toBeInTheDocument();
    const before = answered();
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(window, { key: "a" });
    expect(within(detail()).queryByTestId("ward-referral-match-decline")).toBeNull();
    expect(answered()).toBe(before);
  });
});
