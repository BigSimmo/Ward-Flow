import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * Referrals desk views (Josh, 31 Oct 2026): the ED desk's branches on the one real board. An ED
 * desk leads with the open journeys it raised, names its own department and offers no bed meeting
 * list; the highlights, runway and empty decision pane show only while an ED review is asked of
 * it. The coordinator's board stays as it was. Synthetic seed data only.
 */
const desk = vi.hoisted(() => ({
  role: "ed" as "ed" | "coordinator",
  phone: false,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/wf", async (original) => ({
  ...(await original<typeof import("@/components/wf")>()),
  useIsPhone: () => desk.phone,
}));
vi.mock("@/components/ward-management/ward-role-gate", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-role-gate")>()),
  useRouteRole: () => desk.role,
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({
    role: desk.role,
    scope: desk.role === "ed" ? { kind: "ed", edId: "peel-ed" } : { kind: "statewide" },
  }),
}));
afterEach(() => {
  desk.role = "ed";
  desk.phone = false;
});

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const peelOpen = seed.movements.filter(
  (movement) => movement.originEdId === "peel-ed" && !movement.closure && !movement.edOutcome,
);
const oneQueued = seed.referrals.filter((referral) => referral.id === "RF-001");

function Board({ referrals }: { referrals: Referral[] }) {
  const value = useWardFlow();
  return (
    <WardFlowOverride value={{ ...value, referrals }}>
      <ReferralBoard />
    </WardFlowOverride>
  );
}

function renderBoard(referrals: Referral[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Board referrals={referrals} />
    </WardFlowProvider>,
  );
}

describe("Referrals, ED desk", () => {
  it("leads with what this ED raised and leaves out the coordinator's tools when nothing is asked of it", () => {
    expect(peelOpen.length).toBeGreaterThan(0);
    renderBoard([]);
    const hero = screen.getByTestId("ward-referral-kpis");
    expect(within(hero).getByText("Referrals · Peel ED")).toBeTruthy();
    expect(within(hero).getByText(`${peelOpen.length} raised from this ED`)).toBeTruthy();
    expect(hero.textContent).toContain("ED reviews asked of you");
    expect(hero.textContent).not.toContain("median");
    expect(screen.queryByTestId("ward-referral-meeting")).toBeNull();
    expect(screen.queryByTestId("ward-referral-next-overdue")).toBeNull();
    expect(screen.queryByRole("group", { name: "Highlight referrals" })).toBeNull();

    const raised = screen.getByTestId("ward-referral-ed-raised");
    expect(within(raised).getByRole("heading", { name: /Open referrals/ })).toBeTruthy();
    // Long lists open on their first eight rows.
    expect(within(raised).getAllByRole("link", { name: /^Journey, / })).toHaveLength(Math.min(peelOpen.length, 8));
    if (peelOpen.length > 8) expect(within(raised).getByRole("button", { name: /^Show \d+ more$/ })).toBeTruthy();

    // No ED review asked and nothing chosen: the decision pane is left out.
    const detail = document.querySelector<HTMLElement>('[aria-label="Selected referral detail"]');
    expect(detail?.hidden).toBe(true);
  });

  it("keeps Next overdue, the highlights and the decision pane while an ED review is asked of it", () => {
    renderBoard(oneQueued);
    const hero = screen.getByTestId("ward-referral-kpis");
    expect(hero.textContent).toContain("1 ED review asked of you");
    expect(screen.getByTestId("ward-referral-next-overdue")).toBeTruthy();
    expect(screen.queryByTestId("ward-referral-meeting")).toBeNull();
    expect(screen.getByRole("group", { name: "Highlight referrals" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Selected referral detail" }).hidden).toBe(false);
  });

  it("leaves M, the bed meeting key, off on the ED desk", () => {
    // Josh, 31 Oct 2026 (answer 35).
    renderBoard(oneQueued);
    fireEvent.keyDown(window, { key: "m" });
    expect(screen.queryByRole("dialog", { name: "Bed meeting list" })).toBeNull();
    fireEvent.keyDown(window, { key: "?" });
    const keys = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(keys).queryByText("Bed meeting list")).toBeNull();
  });

  it("says its own department on the phone, with where its journeys stand and no bed meeting list", () => {
    desk.phone = true;
    renderBoard([]);
    const hero = screen.getByTestId("ward-referral-phone-hero");
    expect(within(hero).getByText("Referrals · Peel ED")).toBeTruthy();
    expect(within(hero).getByText("Finding a ward")).toBeTruthy();
    expect(within(hero).getByText("Accepted")).toBeTruthy();
    const noWard = peelOpen.filter((movement) => movement.acceptedUnitId === undefined).length;
    expect(within(screen.getByTestId("ward-referral-phone-ed-no-ward")).getByText(String(noWard))).toBeTruthy();
    expect(within(hero).queryByRole("button", { name: "Bed meeting list" })).toBeNull();
    expect(within(hero).queryByRole("button", { name: /Next overdue/ })).toBeNull();
    expect(screen.getByTestId("ward-referral-ed-raised")).toBeTruthy();
  });
});

describe("Referrals, coordinator desk is unchanged by the ED branches", () => {
  it("keeps the statewide hero, the bed meeting list and no raised section", () => {
    desk.role = "coordinator";
    renderBoard(oneQueued);
    const hero = screen.getByTestId("ward-referral-kpis");
    expect(within(hero).getByText("Referrals")).toBeTruthy();
    expect(within(hero).getByText("1 awaiting decision")).toBeTruthy();
    expect(screen.getByTestId("ward-referral-meeting")).toBeTruthy();
    expect(screen.queryByTestId("ward-referral-ed-raised")).toBeNull();
    fireEvent.keyDown(window, { key: "m" });
    expect(screen.getByRole("dialog", { name: "Bed meeting list" })).toBeTruthy();
  });
});
