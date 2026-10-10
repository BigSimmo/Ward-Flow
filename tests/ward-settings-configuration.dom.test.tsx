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
 * `state.configuration` and dispatches once, on Save — never per slider move.
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

/* v10: one control per value. Each rule is a stepper (a spinbutton between minus and plus); the
   slider that once sat under it is gone. Home sets the range's own minimum, as a slider drag to
   its start did. */
function edStepper() {
  return screen.getByRole("spinbutton", { name: "ED access target" });
}

function rollupStepper() {
  return screen.getByRole("spinbutton", { name: "Morning rollup deadline" });
}

/** The ED target at its range minimum, 12h (720 minutes). */
function setEdToMinimum() {
  fireEvent.keyDown(edStepper(), { key: "Home" });
}

describe("settings screen configuration draft", () => {
  it("announces surge values as an unsaved draft and shows saved status only after acceptance", () => {
    renderSettings();
    const beforeTarget = screen.getByTestId("probe-ed-target").textContent;
    fireEvent.click(screen.getByRole("radio", { name: "Surge" }));
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(beforeTarget);
    expect(screen.getByRole("region", { name: "Unsaved rule changes" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Surge values are in the draft. Save to apply them.");
    fireEvent.click(screen.getByRole("button", { name: /^Save \d+ changes?$/ }));
    expect(screen.getByTestId("probe-ed-target")).toHaveTextContent(String(ED_ACCESS_TARGET_RANGE_MINUTES.min));
    expect(screen.getByRole("status")).toHaveTextContent(/saved and recorded/);
    expect(screen.queryByRole("region", { name: "Unsaved rule changes" })).not.toBeInTheDocument();
  });

  it("changing a stepper without saving leaves the provider's configuration and the audit trail unchanged", () => {
    renderSettings();
    const beforeTarget = screen.getByTestId("probe-ed-target").textContent;
    const beforeAuditCount = screen.getByTestId("probe-audit-count").textContent;

    setEdToMinimum();

    // The stepper's own displayed value moves (it reflects the local draft)...
    expect(edStepper()).toHaveAttribute("aria-valuenow", "720");
    // ...but the provider's real configuration, and the audit trail, do not.
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(beforeTarget);
    expect(screen.getByTestId("probe-audit-count").textContent).toBe(beforeAuditCount);
  });

  it("Save dispatches the edited draft and records exactly one audit event", () => {
    renderSettings();
    const beforeAuditCount = Number(screen.getByTestId("probe-audit-count").textContent);

    setEdToMinimum();
    fireEvent.click(screen.getByRole("button", { name: /^Save \d+ changes?$/ }));

    expect(screen.getByTestId("probe-ed-target").textContent).toBe("720");
    expect(Number(screen.getByTestId("probe-audit-count").textContent)).toBe(beforeAuditCount + 1);
  });

  it("morning rollup deadline stepper updates the draft and dispatches on save", () => {
    renderSettings();
    expect(screen.getByTestId("morning-rollup-display")).toHaveTextContent("09:30");
    expect(rollupStepper()).toHaveAttribute("aria-valuenow", "570");

    // Click plus button (increase by 15m to 09:45 AM / 585)
    fireEvent.click(screen.getByRole("button", { name: "Increase morning rollup deadline" }));
    expect(screen.getByTestId("morning-rollup-display")).toHaveTextContent("09:45");
    expect(rollupStepper()).toHaveAttribute("aria-valuenow", "585");
    expect(screen.getByTestId("probe-morning-rollup")).toHaveTextContent("570"); // not saved yet

    // Click minus button twice (decrease by 30m to 09:15 AM / 555)
    fireEvent.click(screen.getByRole("button", { name: "Decrease morning rollup deadline" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease morning rollup deadline" }));
    expect(screen.getByTestId("morning-rollup-display")).toHaveTextContent("09:15");
    expect(rollupStepper()).toHaveAttribute("aria-valuenow", "555");

    // Step up three times to 600 (10:00 AM)
    for (let press = 0; press < 3; press += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Increase morning rollup deadline" }));
    }
    expect(screen.getByTestId("morning-rollup-display")).toHaveTextContent("10:00");
    expect(screen.getByTestId("probe-morning-rollup")).toHaveTextContent("570");

    // Save coordination rules
    fireEvent.click(screen.getByRole("button", { name: /^Save \d+ changes?$/ }));
    expect(screen.getByTestId("probe-morning-rollup")).toHaveTextContent("600");
  });

  it("the ED stepper's maximum is the configured range's own maximum, not 48 hours (ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS)", () => {
    renderSettings();
    // 48 hours = 2880 minutes. This screen's ED control was once bounded by
    // ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS — a different, owner-ruled bed-management figure
    // (FD-19) that must never sit beside this one. The real ceiling is
    // ED_ACCESS_TARGET_RANGE_MINUTES.max (36 hours = 2160 minutes).
    expect(Number(edStepper().getAttribute("aria-valuemax"))).not.toBe(48 * 60);
    expect(Number(edStepper().getAttribute("aria-valuemax"))).toBe(ED_ACCESS_TARGET_RANGE_MINUTES.max);
    expect(Number(edStepper().getAttribute("aria-valuemin"))).toBe(ED_ACCESS_TARGET_RANGE_MINUTES.min);
    // The range is written out in words beside the rule instead.
    expect(screen.getByTestId("setting-ed-threshold-range")).toHaveTextContent("Range 12h to 36h");
    // And no rule carries a slider as well as its stepper.
    expect(document.querySelector('input[type="range"]')).toBeNull();
  });

  it('"Restore all defaults" writes an audited change back to the product owner\'s defaults', () => {
    renderSettings();
    const beforeAuditCount = Number(screen.getByTestId("probe-audit-count").textContent);

    // Move the ED target away from its default first, and save, so the reset has
    // something real to undo.
    setEdToMinimum();
    fireEvent.click(screen.getByRole("button", { name: /^Save \d+ changes?$/ }));
    expect(screen.getByTestId("probe-ed-target").textContent).toBe("720");

    fireEvent.click(screen.getByRole("radio", { name: /^Data and about/ }));
    fireEvent.click(screen.getByRole("button", { name: "Restore all defaults" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Restore all defaults" }).at(-1)!);

    const defaults = defaultWardConfiguration();
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(String(defaults.edAccessTargetMinutes));
    expect(screen.getByTestId("probe-pull-hold").textContent).toBe(String(defaults.pullHoldMinutes));
    expect(screen.getByTestId("probe-parallel-cap").textContent).toBe(String(defaults.parallelReferralCap));
    expect(screen.getByTestId("probe-morning-rollup").textContent).toBe(
      String(defaults.morningRollupDeadlineMinutes ?? 570),
    );
    // Save (accepted) + Reset (accepted) = two recorded configuration audit events.
    expect(Number(screen.getByTestId("probe-audit-count").textContent)).toBe(beforeAuditCount + 2);
  });
});
