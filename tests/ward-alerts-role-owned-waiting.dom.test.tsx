import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";
import { openAlertKindGroups } from "./helpers/alerts-kind-groups";

const ward = allUnits()[0]!;
const desks = [
  { role: "ward", scope: { kind: "ward", unitIds: [ward.id] } },
  { role: "ed", scope: { kind: "ed", edId: "peel-ed" } },
  { role: "officer", scope: { kind: "jobs" } },
  { role: "community", scope: { kind: "team", teamName: "Synthetic team" } },
  { role: "bed_manager", scope: { kind: "site", siteCode: ward.siteCode } },
] as const satisfies readonly WardAccess[];
const roles = [...desks.map((desk) => desk.role), "coordinator"] as const;
const idFor = (role: string) => `${INBOX_CATEGORIES.transport_awaiting_departure.idPrefix}WF-ROLE-${role}`;

/** Real taskItems derives these waiting rows from their accepted transport jobs and owner words. */
function WaitingWorld({ taken = false, released = false }: { taken?: boolean; released?: boolean }) {
  const world = useWardFlow();
  const base = world.movements[0]!;
  const movements: Movement[] = roles.map((role) => ({
    ...base,
    id: `WF-ROLE-${role}`,
    patientId: undefined,
    referralId: undefined,
    openedAt: NOW_ANCHOR - 1,
    formedAt: NOW_ANCHOR - 1,
    legalStatus: "Voluntary",
    legalForm: undefined,
    stage: "handover_ready",
    acceptedUnitId: ward.id,
    pullExpiresAt: undefined,
    declines: [],
    owner: role === "ward" ? ward.name : WARD_FLOW_ROLE_LABELS[role],
    transport: {
      id: `TR-ROLE-${role}`,
      provider: "Patient transport service",
      escortRequired: false,
      acceptedAt: NOW_ANCHOR - 1,
    },
    closure: undefined,
  }));
  const urgent: Movement = {
    ...movements[0]!,
    id: "WF-ROLE-ACT",
    stage: "pulled",
    owner: WARD_FLOW_ROLE_LABELS.coordinator,
    pullExpiresAt: NOW_ANCHOR - 1,
    transport: undefined,
  };
  return (
    <WardFlowOverride
      value={{
        ...world,
        movements: [...movements, urgent],
        admissions: [],
        patients: [],
        referrals: [],
        plannedAdmissions: [],
        supportNotifications: [],
        leaveBeds: [],
        inboxSnoozes: {},
        inboxOwnership: taken
          ? {
              [idFor("ward")]: [
                { at: NOW_ANCHOR, by: WARD_FLOW_ROLE_LABELS.coordinator },
                ...(released
                  ? [{ at: NOW_ANCHOR, by: WARD_FLOW_ROLE_LABELS.coordinator, kind: "released" as const }]
                  : []),
              ],
            }
          : {},
      }}
    >
      <AlertsScreen />
    </WardFlowOverride>
  );
}

function renderAs(access: WardAccess, options: { taken?: boolean; released?: boolean } = {}) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WaitingWorld {...options} />
    </WardFlowProvider>,
  );
}
function all() {
  fireEvent.click(within(screen.getByTestId("ward-alerts-filters")).getByRole("button", { name: "All" }));
  openAlertKindGroups();
}
function row(id: string) {
  return document.querySelector(`li[data-alert-id="${id}"]`);
}

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  localStorage.clear();
});

it.each(desks)("shows $role-owned waiting work by default, keeps urgent rows and offers All", (desk) => {
  renderAs(desk);
  const filters = screen.getByTestId("ward-alerts-filters");
  expect(within(filters).getByRole("button", { name: /^Yours/ })).toHaveAttribute("aria-pressed", "true");
  expect(row(idFor(desk.role))).toBeVisible();
  expect(row(idFor("coordinator"))).toBeNull();
  expect(row(`${INBOX_CATEGORIES.bed_pull_expired.idPrefix}WF-ROLE-ACT`)).toBeVisible();
  all();
  for (const role of roles) expect(row(idFor(role))).toBeVisible();
});

it("respects a coordinator taking a ward's row and restores its original ownership after hand back", () => {
  const view = renderAs(desks[0], { taken: true });
  expect(row(idFor("ward"))).toBeNull();
  all();
  expect(row(idFor("ward"))).toBeVisible();
  expect(row(idFor("ward"))).toHaveTextContent("Bed coordinator");
  expect(within(row(idFor("ward")) as HTMLElement).queryByText("You")).toBeNull();
  view.unmount();
  renderAs(desks[0], { taken: true, released: true });
  expect(row(idFor("ward"))).toBeVisible();
});

it("keeps the coordinator's All default and limits its Yours filter to coordinator ownership", () => {
  renderAs({ role: "coordinator", scope: { kind: "statewide" } });
  const filters = screen.getByTestId("ward-alerts-filters");
  expect(within(filters).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  openAlertKindGroups();
  for (const role of roles) expect(row(idFor(role))).toBeVisible();
  fireEvent.click(within(filters).getByRole("button", { name: /^Yours/ }));
  expect(row(idFor("coordinator"))).toBeVisible();
  for (const role of roles.filter((role) => role !== "coordinator")) expect(row(idFor(role))).toBeNull();
});
