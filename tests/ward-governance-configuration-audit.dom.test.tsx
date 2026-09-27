// tests/ward-governance-configuration-audit.dom.test.tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite that mounts the governance workspace
// (ward-governance.dom.test.tsx): `ClinicalRail` renders next/link anchors and this suite never
// checks routing, so a plain <a> avoids requiring an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Task 8 of the audit-wiring plan, 2026-09-16: a coordinator-saved configuration change must
 * appear in the governance workbench's captured-events register, filed under the new
 * "Configuration" category, with its detail panel naming both the before and after figures.
 */
function ConfigurationSaver() {
  const { dispatch, now } = useWardFlow();
  const saved = useRef(false);
  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    dispatch({
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now,
      payload: { ...defaultWardConfiguration(), pullHoldMinutes: 120 },
    });
  }, [dispatch, now]);
  return null;
}

function renderGovernanceAfterSave() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ConfigurationSaver />
      <WardModeWorkspace mode="governance" />
    </WardFlowProvider>,
  );
}

describe("a saved configuration change appears in the governance register", () => {
  it('files it under "Configuration" and its detail panel names the before/after pull hold figures', () => {
    renderGovernanceAfterSave();

    // Filter to the new category — proves categoryLabels/the select option exist for it.
    fireEvent.change(screen.getByLabelText("Filter event category"), { target: { value: "configuration" } });

    const workbench = screen.getByTestId("ward-governance-workbench");
    const row = within(workbench).getByText(/Change configuration/);
    expect(row).toBeInTheDocument();

    fireEvent.click(row.closest("button") as HTMLButtonElement);

    const detail = screen.getByTestId("ward-governance-override-detail");
    const beforeSection = within(detail).getByRole("heading", { name: "Before", level: 3 }).closest("section");
    const afterSection = within(detail).getByRole("heading", { name: "After", level: 3 }).closest("section");
    if (!beforeSection || !afterSection) throw new Error("Before/After sections did not render");

    // Before: the default 240-minute (4-hour) pull hold. After: the coordinator's saved 120-minute figure.
    expect(within(beforeSection).getByText("240 min")).toBeInTheDocument();
    expect(within(afterSection).getByText("120 min")).toBeInTheDocument();
  });
});
