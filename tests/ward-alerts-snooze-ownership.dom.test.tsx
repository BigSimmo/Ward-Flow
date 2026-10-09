import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Stream A, 9 Oct 2026: ownership and snooze on the Alerts screen, as the reducer records them. */
const NOW = NOW_ANCHOR;

function SnoozeFirstRow() {
  const { movements, units, dispatch } = useWardFlow();
  const row = buildActionInbox(movements.filter(isOpen), NOW, units)[0];
  return (
    <button
      type="button"
      onClick={() => {
        if (!row) return;
        dispatch({
          type: "SNOOZE_INBOX_ITEM",
          role: "coordinator",
          now: NOW,
          inboxItemId: row.id,
          until: NOW + 30,
          reason: "awaiting_call_back",
        });
      }}
    >
      Snooze first row
    </button>
  );
}

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <SnoozeFirstRow />
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

describe("alerts: ownership and snooze", () => {
  it("stops offering Take ownership once the coordinator owns the row", () => {
    renderScreen();
    const trigger = screen.getAllByRole("button", { name: /More actions for/ })[0]!;
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Take ownership" }));
    expect(screen.getByText(/^You own "/)).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole("menuitem", { name: /Take ownership/ })).toBeNull();
    expect(screen.getAllByText(/Owned by Flow coordinator since/).length).toBeGreaterThan(0);
  });

  it("keeps the patient, the severity and an Open action on a snoozed row", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Snooze first row" }));
    const snoozed = screen.getByTestId("ward-alerts-snoozed");
    const row = within(snoozed).getAllByRole("listitem")[0]!;
    expect(row).toHaveTextContent(/Back .* · Awaiting call back · Flow coordinator/);
    expect(row.textContent).not.toMatch(/WF-\d/);
    // The same patient the live row named: display name and UMRN, never the journey id.
    const seed = seedWardFlowState();
    const first = buildActionInbox(seed.movements.filter(isOpen), NOW, seed.units)[0]!;
    expect(row).toHaveAttribute("data-movement-id", first.movementId);
    const expected = resolveSubjectPatient(
      seed.movements.find((movement) => movement.id === first.movementId),
      seed,
    );
    expect(within(row).getByText(expected.displayName)).toBeInTheDocument();
    expect(within(row).getByText(expected.umrn)).toBeInTheDocument();
    // The row keeps its real severity glyph: a red row shows the triangle, not a neutral mark.
    expect(first.tone).toBe("danger");
    expect(row.querySelector('svg path[d="M5 0.8 9.6 9.2H0.4Z"]')).not.toBeNull();
    expect(within(row).getByRole("button", { name: /^Return .* now, / })).toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: `Open for ${expected.displayName}` }));
    expect(screen.getByRole("dialog", { name: /Alert Escalation & Triage/i })).toBeInTheDocument();
  });
});
