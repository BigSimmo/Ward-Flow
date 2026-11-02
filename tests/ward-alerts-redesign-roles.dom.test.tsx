import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { officerHref } from "@/components/ward-management/shell/ward-facade";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * Alerts redesign (Josh, 31 Oct 2026 09:04 UTC, "Yes to all"), built from the mock-up's page and its
 * role views into the one real screen: the Checking chip, same-kind group rows, the owner menu, and
 * the role branches for the nurse in charge and the transport officer. Synthetic seed data only.
 */
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

/** The seed world with nothing that raises an alert: no movements, bookings, notifications or leave. */
function QuietWorld({ children }: { children: ReactNode }) {
  const world = useWardFlow();
  return (
    <WardFlowOverride
      value={{
        ...world,
        movements: [],
        referrals: [],
        plannedAdmissions: [],
        supportNotifications: [],
        admissions: [],
        leaveBeds: [],
      }}
    >
      {children}
    </WardFlowOverride>
  );
}

function renderAs(access: Parameters<typeof setWardAccess>[0], { quiet = false } = {}) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {quiet ? (
        <QuietWorld>
          <AlertsScreen />
        </QuietWorld>
      ) : (
        <AlertsScreen />
      )}
    </WardFlowProvider>,
  );
}

const panel = () => screen.getByRole("complementary", { name: "Selected alert" });

describe("Alerts redesign: the coordinator's page", () => {
  it("folds the Checking strip into one chip that opens the full list in place", () => {
    renderAs({ role: "coordinator", scope: { kind: "statewide" } });
    expect(screen.queryByRole("list", { name: "Conditions checked" })).not.toBeInTheDocument();
    const chip = screen.getByRole("button", { name: /^Checking \d+ flagged · \d+ clear$/u });
    expect(chip).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", { name: "Conditions checked" });
    expect(within(list).getByRole("listitem", { name: "Not checked: handover sheets" })).toBeInTheDocument();
  });

  it("shows three or more alerts of one kind in a row as one group row that opens to each alert", () => {
    const { container } = renderAs({ role: "coordinator", scope: { kind: "statewide" } });
    const groups = screen.getAllByTestId("ward-alerts-kind-group");
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      const head = within(group).getByRole("button", { name: /Show each/u });
      const people = Number(/(\d+) people/u.exec(head.textContent ?? "")?.[1]);
      expect(people).toBeGreaterThanOrEqual(3);
      expect(group.querySelectorAll("li[data-alert-id]")).toHaveLength(0);
      fireEvent.click(head);
      expect(head).toHaveAttribute("aria-expanded", "true");
      expect(group.querySelectorAll("li[data-alert-id]")).toHaveLength(people);
    }
    // Section counts still count alerts, not group rows.
    const actNow = screen.getByRole("region", { name: "Act now" });
    expect(container.querySelectorAll("li[data-alert-id]").length).toBeGreaterThan(0);
    expect(actNow).toBeInTheDocument();
  });

  // Josh, 31 Oct 2026 (answer 17): the desktop keeps Owner under Arrange by and drops the owner menu
  // that repeated it; the phone keeps the menu (tests/ward-alerts-screen.dom.test.tsx).
  it("arranges by owner on desktop with no second owner menu", () => {
    renderAs({ role: "coordinator", scope: { kind: "statewide" } });
    expect(screen.queryByRole("combobox", { name: "Highlight by owner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Highlight by owner" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("radiogroup", { name: "Arrange by" })).getByRole("radio", { name: /Owner/u }));
  });

  it("names its one action row Hand back after Take, beside More actions", () => {
    renderAs({ role: "coordinator", scope: { kind: "statewide" } });
    const take = within(panel()).queryByRole("button", { name: /^Take / });
    if (take) fireEvent.click(take);
    expect(within(panel()).getByRole("button", { name: /^Hand back / })).toHaveTextContent("Hand back");
    expect(within(panel()).getByTestId("alerts-more-actions")).toBeInTheDocument();
  });
});

describe("Alerts redesign: nurse in charge (ROLE BRANCH ward)", () => {
  const ward = allUnits()[0]!;

  it("names a quiet ward, says so in one line and lists the checks in the side panel", () => {
    renderAs({ role: "ward", scope: { kind: "ward", unitIds: [ward.id] } }, { quiet: true });
    // Q183 (1 Nov 2026): one headline on every desk; the ward is named in the eyebrow above it.
    expect(screen.getByRole("heading", { level: 1, name: "Nothing needs you" })).toBeInTheDocument();
    expect(screen.getByTestId("ward-alerts-hero")).toHaveTextContent(`Alerts · Nurse in charge · ${ward.name}`);
    // Q184: one calm empty state in place of the two empty groups.
    expect(screen.getByTestId("ward-alerts-nothing")).toHaveTextContent(`Nothing is late or blocked for ${ward.name}.`);
    const checked = screen.getByRole("region", { name: `Checked for ${ward.name}` });
    expect(within(checked).getByRole("list", { name: "Conditions checked" })).toBeInTheDocument();
    // The checks show once: not also as the hero's chip.
    expect(screen.queryByRole("button", { name: /^Checking \d+ flagged/u })).not.toBeInTheDocument();
    expect(screen.queryByText("Pick an alert to see it here")).not.toBeInTheDocument();
    // One ward needs no arrange-by or owner lens, and a quiet ward has no Today to chart.
    expect(screen.queryByRole("radiogroup", { name: "Arrange by" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Highlight by owner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Today" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-alerts-order-note")).not.toBeInTheDocument();
  });

  it("keeps the queue and Today for a ward with alerts, without the arrange-by lens", () => {
    renderAs({ role: "ward", scope: { kind: "ward", unitIds: [ward.id] } });
    expect(screen.queryByRole("heading", { level: 1, name: "Nothing needs you" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Arrange by" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Checking \d+ flagged/u })).toBeInTheDocument();
  });

  it("leaves the coordinator's quiet page as it was", () => {
    renderAs({ role: "coordinator", scope: { kind: "statewide" } }, { quiet: true });
    expect(screen.getByRole("heading", { level: 1, name: "Nothing needs you" })).toBeInTheDocument();
    expect(screen.getByTestId("ward-alerts-nothing")).toHaveTextContent("Nothing is late or blocked for Statewide.");
    expect(screen.getByText("Pick an alert to see it here")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Today" })).toBeInTheDocument();
  });
});

describe("Alerts redesign: transport officer (ROLE BRANCH officer)", () => {
  it("opens the officer's jobs from each alert, with the coordinator's actions left out", () => {
    renderAs({ role: "officer", scope: { kind: "jobs" } });
    const detail = panel();
    expect(within(detail).getByRole("link", { name: "Open my jobs" })).toHaveAttribute("href", officerHref());
    expect(within(detail).queryByRole("link", { name: /^Patient/u })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: /^Take / })).not.toBeInTheDocument();
    expect(within(detail).queryByTestId("alerts-more-actions")).not.toBeInTheDocument();
    expect(within(detail).getAllByText("Only the coordinator can change alerts.")).toHaveLength(1);
  });

  it("shows Now and Earlier today, no Owner arrangement and no owner menu", () => {
    renderAs({ role: "officer", scope: { kind: "jobs" } });
    // Q181 (1 Nov 2026): every desk has the same two views.
    const tabs = within(screen.getByRole("tablist", { name: "Alerts views" })).getAllByRole("tab");
    expect(tabs.map((tab) => (tab.textContent ?? "").replace(/\d+/gu, "").trim())).toEqual(["Now", "Earlier today"]);
    expect(
      within(screen.getByRole("radiogroup", { name: "Arrange by" })).queryByRole("radio", { name: /Owner/u }),
    ).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Highlight by owner" })).not.toBeInTheDocument();
  });
});
