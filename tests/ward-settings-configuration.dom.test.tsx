// tests/ward-settings-configuration.dom.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling settings dom suite: this screen renders next/link anchors and
// jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ED_ACCESS_TARGET_RANGE_MINUTES } from "@/components/ward-management/ward-model";

/**
 * Task 9 of the audit-wiring plan, 2026-09-16: the settings screen edits a local draft of
 * `state.configuration` and dispatches once, on "Save coordination rules" — never per slider move.
 */
function Probe() {
  const { configuration, readAuditEvents } = useWardFlow();
  const auditRead = readAuditEvents({ role: "coordinator" });
  const configurationAudits =
    auditRead.status === "allowed" ? auditRead.value.filter((event) => event.category === "configuration").length : 0;
  return (
    <div>
      <span data-testid="probe-ed-target">{configuration.edAccessTargetMinutes}</span>
      <span data-testid="probe-pull-hold">{configuration.pullHoldMinutes}</span>
      <span data-testid="probe-parallel-cap">{configuration.parallelReferralCap}</span>
      <span data-testid="probe-morning-rollup">{configuration.morningRollupDeadlineMinutes}</span>
      <span data-testid="probe-audit-count">{configurationAudits}</span>
    </div>
  );
}

function renderSettings() {
  return render(
    <WardFlowProvider>
      <SettingsScreen />
      <Probe />
    </WardFlowProvider>,
  );
}

function edSlider() {
  return document.getElementById("setting-ed-threshold") as HTMLInputElement;
}

function rollupSlider() {
  return document.getElementById("setting-morning-rollup-slider") as HTMLInputElement;
}

describe("settings screen configuration draft", () => {
  it("announces surge values as an unsaved draft and shows saved status only after acceptance", () => {
    renderSettings();
    const beforeTarget = screen.getByTestId("probe-ed-target").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Select surge values" }));
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(beforeTarget);
    expect(screen.getByText("Unsaved changes — Save coordination rules to apply.")).toBeVisible();
    expect(screen.queryByText("SURGE VALUES SAVED")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save coordination rules" }));
    expect(screen.getByTestId("probe-ed-target")).toHaveTextContent(String(ED_ACCESS_TARGET_RANGE_MINUTES.min));
    expect(screen.getByText("SURGE VALUES SAVED")).toBeVisible();
    expect(screen.queryByText("Unsaved changes — Save coordination rules to apply.")).not.toBeInTheDocument();
  });

  it("moving a slider without saving leaves the provider's configuration and the audit trail unchanged", () => {
    renderSettings();
    const beforeTarget = screen.getByTestId("probe-ed-target").textContent;
    const beforeAuditCount = screen.getByTestId("probe-audit-count").textContent;

    fireEvent.change(edSlider(), { target: { value: "720" } });

    // The slider's own displayed value moves (it reflects the local draft)...
    expect(edSlider().value).toBe("720");
    // ...but the provider's real configuration, and the audit trail, do not.
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(beforeTarget);
    expect(screen.getByTestId("probe-audit-count").textContent).toBe(beforeAuditCount);
  });

  it('"Save coordination rules" dispatches the edited draft and records exactly one audit event', () => {
    renderSettings();
    const beforeAuditCount = Number(screen.getByTestId("probe-audit-count").textContent);

    fireEvent.change(edSlider(), { target: { value: "720" } });
    fireEvent.click(screen.getByRole("button", { name: "Save coordination rules" }));

    expect(screen.getByTestId("probe-ed-target").textContent).toBe("720");
    expect(Number(screen.getByTestId("probe-audit-count").textContent)).toBe(beforeAuditCount + 1);
  });

  it("morning rollup deadline stepper and slider update draft and dispatch on save", () => {
    renderSettings();
    expect(screen.getByTestId("morning-rollup-display")).toHaveTextContent("09:30 AM");
    expect(rollupSlider().value).toBe("570");

    // Click plus button (increase by 15m to 09:45 AM / 585)
    fireEvent.click(screen.getByRole("button", { name: "Increase morning rollup deadline" }));
    expect(screen.getByTestId("morning-rollup-display")).toHaveTextContent("09:45 AM");
    expect(rollupSlider().value).toBe("585");
    expect(screen.getByTestId("probe-morning-rollup")).toHaveTextContent("570"); // not saved yet

    // Click minus button twice (decrease by 30m to 09:15 AM / 555)
    fireEvent.click(screen.getByRole("button", { name: "Decrease morning rollup deadline" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease morning rollup deadline" }));
    expect(screen.getByTestId("morning-rollup-display")).toHaveTextContent("09:15 AM");
    expect(rollupSlider().value).toBe("555");

    // Move slider to 600 (10:00 AM)
    fireEvent.change(rollupSlider(), { target: { value: "600" } });
    expect(screen.getByTestId("morning-rollup-display")).toHaveTextContent("10:00 AM");
    expect(screen.getByTestId("probe-morning-rollup")).toHaveTextContent("570");

    // Save coordination rules
    fireEvent.click(screen.getByRole("button", { name: "Save coordination rules" }));
    expect(screen.getByTestId("probe-morning-rollup")).toHaveTextContent("600");
  });

  it("the ED slider's maximum is the configured range's own maximum, not 48 hours (ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS)", () => {
    renderSettings();
    // 48 hours = 2880 minutes. This screen's ED slider was once bounded by
    // ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS — a different, owner-ruled bed-management figure
    // (FD-19) that must never sit beside this one. The slider's real ceiling is
    // ED_ACCESS_TARGET_RANGE_MINUTES.max (36 hours = 2160 minutes).
    expect(Number(edSlider().max)).not.toBe(48 * 60);
    expect(Number(edSlider().max)).toBe(ED_ACCESS_TARGET_RANGE_MINUTES.max);
    expect(Number(edSlider().min)).toBe(ED_ACCESS_TARGET_RANGE_MINUTES.min);
  });

  it('"Restore all defaults" writes an audited change back to the product owner\'s defaults', () => {
    renderSettings();
    const beforeAuditCount = Number(screen.getByTestId("probe-audit-count").textContent);

    // Move all three sliders away from their defaults first, and save, so the reset has
    // something real to undo.
    fireEvent.change(edSlider(), { target: { value: "720" } });
    fireEvent.click(screen.getByRole("button", { name: "Save coordination rules" }));
    expect(screen.getByTestId("probe-ed-target").textContent).toBe("720");

    fireEvent.click(screen.getAllByRole("button", { name: "Restore all defaults" }).at(-1)!);
    fireEvent.click(screen.getAllByRole("button", { name: "Restore all defaults" }).at(-1)!);

    const defaults = defaultWardConfiguration();
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(String(defaults.edAccessTargetMinutes));
    expect(screen.getByTestId("probe-pull-hold").textContent).toBe(String(defaults.pullHoldMinutes));
    expect(screen.getByTestId("probe-parallel-cap").textContent).toBe(String(defaults.parallelReferralCap));
    expect(screen.getByTestId("probe-morning-rollup").textContent).toBe(String(defaults.morningRollupDeadlineMinutes ?? 570));
    // Save (accepted) + Reset (accepted) = two recorded configuration audit events.
    expect(Number(screen.getByTestId("probe-audit-count").textContent)).toBe(beforeAuditCount + 2);
  });
});
