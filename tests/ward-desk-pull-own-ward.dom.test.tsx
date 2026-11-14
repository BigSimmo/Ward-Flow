import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * D-197 item 7 (with D-188, D-191): the ward desk pulls the bed for an acceptance its own ward made,
 * on Alerts and on the Referrals board, never for another ward's. The coordinator keeps pulling for
 * any ward. Synthetic seed data only.
 */
const SEED = seedWardFlowState();
// The seed holds a referral a ward has accepted with no bed pulled (D-76).
const [ACCEPTED] = acceptedReferralsAwaitingPull(SEED.referrals, SEED.units, SEED.movements);
const OTHER_UNIT = SEED.units.find((unit) => unit.id !== ACCEPTED?.unitId);
const wardDesk = (unitId: string): WardAccess => ({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });
const COORDINATOR: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };

let current: ReturnType<typeof useWardFlow> | undefined;
function Capture() {
  const flow = useWardFlow();
  useEffect(() => {
    current = flow;
  });
  return null;
}

function renderAs(access: WardAccess, page: ReactNode) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture />
        {page}
      </WardFlowProvider>
    </ToastProvider>,
  );
}

/** Answers whatever the record left open, then pulls (as the coordinator's one-step test does). */
async function pullFromOpenForm() {
  const status = screen.getByTestId("ward-pull-accepted-legal-status");
  const legalForm = screen.getByTestId("ward-pull-accepted-legal-form") as HTMLSelectElement;
  const observation = screen.getByTestId("ward-pull-accepted-observation");
  if (!within(status).queryByRole("radio", { checked: true }))
    fireEvent.click(within(status).getByRole("radio", { name: "Voluntary" }));
  if (legalForm.value === "") fireEvent.change(legalForm, { target: { value: "none" } });
  if (!within(observation).queryByRole("radio", { checked: true }))
    fireEvent.click(within(observation).getByRole("radio", { name: "General" }));
  await act(async () => {
    fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
  current = undefined;
  expect(ACCEPTED).toBeDefined();
  expect(OTHER_UNIT).toBeDefined();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("Alerts: the ward desk pulls its own ward's accepted bed", () => {
  it("lists its own ward's acceptance in Act now, and the sheet pulls the bed as that ward", async () => {
    const { referral, unitId } = ACCEPTED!;
    renderAs(wardDesk(unitId), <AlertsScreen />);
    const rows = screen.getByTestId("ward-alerts-accepted-to-pull");
    const row = rows.querySelector<HTMLElement>(`[data-referral-id="${referral.id}"]`);
    expect(row).not.toBeNull();
    // Only the desk's own ward: every listed row is for its unit.
    for (const listed of rows.querySelectorAll("[data-pull-unit-id]"))
      expect(listed.getAttribute("data-pull-unit-id")).toBe(unitId);
    const [pullButton] = within(row!)
      .getAllByRole("button", { name: /^Pull the bed for / })
      .filter((button) => button.textContent === "Pull the bed");
    fireEvent.click(pullButton!);
    const sheet = screen.getByTestId("home-pull-accepted-sheet");
    expect(await within(sheet).findByTestId(`ward-pull-accepted-${referral.id}`)).toBeInTheDocument();
    expect(sheet).not.toHaveTextContent(/desk can pull this bed/);
    await pullFromOpenForm();
    expect(current!.rejections.map((rejection) => rejection.reason)).toEqual([]);
    const journey = current!.movements.find((movement) => movement.referralId === referral.id);
    expect(journey?.acceptedUnitId).toBe(unitId);
    expect(journey?.stage).toBe("pulled");
  });

  it("does not list another ward's acceptance", () => {
    renderAs(wardDesk(OTHER_UNIT!.id), <AlertsScreen />);
    expect(document.querySelector(`[data-referral-id="${ACCEPTED!.referral.id}"][data-pull-unit-id]`)).toBeNull();
    expect(screen.queryByTestId("ward-alerts-accepted-to-pull")).toBeNull();
  });

  it("the coordinator still lists every ward's acceptance", () => {
    renderAs(COORDINATOR, <AlertsScreen />);
    const rows = screen.getByTestId("ward-alerts-accepted-to-pull");
    const all = acceptedReferralsAwaitingPull(SEED.referrals, SEED.units, SEED.movements);
    expect(rows.querySelectorAll("[data-pull-unit-id]")).toHaveLength(all.length);
    expect(rows.querySelector(`[data-referral-id="${ACCEPTED!.referral.id}"]`)).not.toBeNull();
  });
});

describe("Referrals board: the ward desk pulls its own ward's accepted bed", () => {
  const openBoardOn = (access: WardAccess) => {
    window.history.replaceState(null, "", `/ward-flow/referrals?referral=${ACCEPTED!.referral.id}`);
    renderAs(access, <ReferralBoard defaultSelectFirst />);
  };

  it("offers Pull the bed in place for its own ward, and the sheet pulls as that ward", async () => {
    const { referral, unitId } = ACCEPTED!;
    openBoardOn(wardDesk(unitId));
    expect(screen.queryByTestId("ward-referral-hold-bed")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-referral-pull-bed"));
    const sheet = screen.getByTestId("ward-referral-pull-sheet");
    expect(await within(sheet).findByTestId(`ward-pull-accepted-${referral.id}`)).toBeInTheDocument();
    expect(sheet).not.toHaveTextContent(/desk can pull this bed/);
    await pullFromOpenForm();
    expect(current!.rejections.map((rejection) => rejection.reason)).toEqual([]);
    const journey = current!.movements.find((movement) => movement.referralId === referral.id);
    expect(journey?.acceptedUnitId).toBe(unitId);
    expect(journey?.stage).toBe("pulled");
  });

  it("gives another ward's desk no in-place pull", () => {
    openBoardOn(wardDesk(OTHER_UNIT!.id));
    expect(screen.queryByTestId("ward-referral-pull-bed")).toBeNull();
  });

  it("the coordinator still pulls in place", async () => {
    openBoardOn(COORDINATOR);
    fireEvent.click(screen.getByTestId("ward-referral-pull-bed"));
    expect(
      await within(screen.getByTestId("ward-referral-pull-sheet")).findByTestId(
        `ward-pull-accepted-${ACCEPTED!.referral.id}`,
      ),
    ).toBeInTheDocument();
  });
});
