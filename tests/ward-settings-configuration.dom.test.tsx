// tests/ward-settings-configuration.dom.test.tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
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
// Bug list row 2: catch the rules file the Export button writes.
const download = vi.hoisted(() => vi.fn<(blob: Blob, name: string) => void>());
vi.mock("@/components/ward-management/ward-download", () => ({ downloadBlob: download }));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { ToastProvider } from "@/components/wf";
import { ED_ACCESS_TARGET_RANGE_MINUTES } from "@/components/ward-management/ward-model";
import { applyAppearance } from "@/components/ward-management/shell/ward-bar";

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

type Intercept = (
  event: Parameters<WardCommandDispatch>[0],
  dispatch: WardCommandDispatch,
) => ReturnType<WardCommandDispatch>;

function DispatchOverride({ children, intercept }: { children: ReactNode; intercept?: Intercept }) {
  const value = useWardFlow();
  return (
    <WardFlowOverride
      value={{ ...value, dispatch: intercept ? (event) => intercept(event, value.dispatch) : value.dispatch }}
    >
      {children}
    </WardFlowOverride>
  );
}

function renderSettings(intercept?: Intercept) {
  return render(
    <ToastProvider>
      <WardFlowProvider>
        <DispatchOverride intercept={intercept}>
          <SettingsScreen />
          <Probe />
        </DispatchOverride>
      </WardFlowProvider>
    </ToastProvider>,
  );
}

/* v10: one control per value. Each rule is a stepper (a spinbutton between minus and plus); the
   slider that once sat under it is gone. Home sets the range's own minimum, as a slider drag to
   its start did. */
function edStepper() {
  return screen.getByRole("spinbutton", { name: "ED access target" });
}

function rollupStepper() {
  return screen.getByRole("spinbutton", { name: "Morning bed numbers due time" });
}

/** The ED target at its range minimum, 12h (720 minutes). */
function setEdToMinimum() {
  fireEvent.keyDown(edStepper(), { key: "Home" });
}

describe("settings screen configuration draft", () => {
  it("does not announce or apply a restore before its command is accepted, and keeps the draft on refusal", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    const completion = new Promise<WardCommandOutcome>((settle) => {
      resolve = settle;
    });
    renderSettings(() => completion);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    setEdToMinimum();
    fireEvent.click(screen.getByRole("button", { name: "Restore all defaults" }));
    fireEvent.click(screen.getByTestId("confirm-restore-defaults-btn"));
    expect(screen.queryByText("Defaults restored and recorded.")).not.toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await act(async () => resolve({ commandId: "restore", status: "refused", message: "Rules changed elsewhere." }));
    expect(screen.queryByText("Defaults restored and recorded.")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Unsaved rule changes" })).toBeInTheDocument();
    expect(edStepper()).toHaveAttribute("aria-valuenow", "720");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    act(() => applyAppearance("auto"));
  });

  it("does not announce an Undo before its command is accepted or change the draft on refusal", async () => {
    let defer = false;
    let resolve!: (outcome: WardCommandOutcome) => void;
    const completion = new Promise<WardCommandOutcome>((settle) => {
      resolve = settle;
    });
    renderSettings((event, dispatch) => (defer ? completion : dispatch(event)));
    setEdToMinimum();
    fireEvent.click(screen.getByRole("button", { name: /^Save 1 change$/ }));
    const savedToast = within(screen.getByTestId("toast-region"))
      .getByText(/saved and recorded\./)
      .closest<HTMLElement>('[data-testid="toast"]')!;
    defer = true;
    fireEvent.click(within(savedToast).getByRole("button", { name: "Undo" }));
    expect(screen.queryByText("Rules back as they were. Recorded in the audit.")).not.toBeInTheDocument();
    await act(async () => resolve({ commandId: "undo", status: "refused", message: "Rules changed elsewhere." }));
    expect(screen.queryByText("Rules back as they were. Recorded in the audit.")).not.toBeInTheDocument();
    expect(screen.getByTestId("probe-ed-target")).toHaveTextContent("720");
    expect(edStepper()).toHaveAttribute("aria-valuenow", "720");
    expect(screen.queryByRole("region", { name: "Unsaved rule changes" })).not.toBeInTheDocument();
  });

  it("undoes only an older save's own rule after a later save, never replacing the newer rule", () => {
    renderSettings();
    const edTargetBefore = screen.getByTestId("probe-ed-target").textContent;
    setEdToMinimum();
    fireEvent.click(screen.getByRole("button", { name: /^Save 1 change$/ }));
    const firstToast = within(screen.getByTestId("toast-region"))
      .getByText(/saved and recorded\./)
      .closest<HTMLElement>('[data-testid="toast"]')!;
    fireEvent.click(screen.getByRole("button", { name: "Increase morning bed numbers due time" }));
    fireEvent.click(screen.getByRole("button", { name: /^Save 1 change$/ }));
    expect(screen.getByTestId("probe-morning-rollup")).toHaveTextContent("585");
    expect(screen.getByTestId("probe-ed-target")).toHaveTextContent("720");
    // Main's three-way merge (#419): the stale Undo reverts the first save's field only; the
    // later save's rule is kept rather than replaced by the older snapshot.
    fireEvent.click(within(firstToast).getByRole("button", { name: "Undo" }));
    expect(screen.getByTestId("probe-ed-target")).toHaveTextContent(edTargetBefore!);
    expect(screen.getByTestId("probe-morning-rollup")).toHaveTextContent("585");
  });

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

  it("copies the saved rules in diagnostics while rule edits are still a draft", async () => {
    const previousUrl = window.location.href;
    userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    try {
      renderSettings();
      const savedTarget = Number(screen.getByTestId("probe-ed-target").textContent);
      setEdToMinimum();
      expect(savedTarget).not.toBe(ED_ACCESS_TARGET_RANGE_MINUTES.min);
      expect(edStepper()).toHaveAttribute("aria-valuenow", String(ED_ACCESS_TARGET_RANGE_MINUTES.min));
      fireEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
      // D-71 item 7: the synthetic line first, then the JSON payload.
      const [first, ...json] = writeText.mock.calls[0][0].split("\n");
      expect(first).toBe("Synthetic prototype.");
      const payload = JSON.parse(json.join("\n"));
      expect(payload.configuration.edAccessTargetMinutes).toBe(savedTarget);
    } finally {
      writeText.mockRestore();
      window.history.replaceState(null, "", previousUrl);
    }
  });

  it("exports the saved rules only, never the unsaved draft or this browser's display settings", async () => {
    download.mockClear();
    renderSettings();
    const savedTarget = Number(screen.getByTestId("probe-ed-target").textContent);
    setEdToMinimum();
    expect(savedTarget).not.toBe(ED_ACCESS_TARGET_RANGE_MINUTES.min);
    fireEvent.click(screen.getByTestId("btn-export-config"));
    expect(download).toHaveBeenCalledOnce();
    const exported = JSON.parse(await download.mock.calls[0][0].text());
    // Import reads rules only, so the file carries nothing else.
    expect(Object.keys(exported).sort()).toEqual(["configuration", "exportedAt", "product", "version"]);
    expect(exported.configuration.edAccessTargetMinutes).toBe(savedTarget);
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
    fireEvent.click(screen.getByRole("button", { name: "Increase morning bed numbers due time" }));
    expect(screen.getByTestId("morning-rollup-display")).toHaveTextContent("09:45");
    expect(rollupStepper()).toHaveAttribute("aria-valuenow", "585");
    expect(screen.getByTestId("probe-morning-rollup")).toHaveTextContent("570"); // not saved yet

    // Click minus button twice (decrease by 30m to 09:15 AM / 555)
    fireEvent.click(screen.getByRole("button", { name: "Decrease morning bed numbers due time" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease morning bed numbers due time" }));
    expect(screen.getByTestId("morning-rollup-display")).toHaveTextContent("09:15");
    expect(rollupStepper()).toHaveAttribute("aria-valuenow", "555");

    // Step up three times to 600 (10:00 AM)
    for (let press = 0; press < 3; press += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Increase morning bed numbers due time" }));
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

  // Audit settings-25 and settings-28: a draft says its effect is "if saved", and the Changed word
  // reads the saved value as the row shows it, not raw minutes.
  it("labels a draft ED count as if saved and reads the saved value in hours", () => {
    renderSettings();
    setEdToMinimum();
    const row = screen.getByTestId("ward-settings-screen").querySelector<HTMLElement>('[data-setting="ed-target"]')!;
    expect(row).toHaveTextContent(/over if saved/);
    expect(row).toHaveTextContent("saved value 24h");
    expect(row).not.toHaveTextContent("saved value 1440");
  });

  it("names every value a restore resets and offers Undo, which puts the saved rules back on the record", () => {
    renderSettings();
    const beforeAuditCount = Number(screen.getByTestId("probe-audit-count").textContent);
    // The open area is remembered per browser; the previous case left it on Data and about.
    setEdToMinimum();
    fireEvent.click(screen.getByRole("button", { name: /^Save \d+ changes?$/ }));
    expect(screen.getByTestId("probe-ed-target").textContent).toBe("720");

    fireEvent.click(screen.getByRole("button", { name: "Restore all defaults" }));
    const modal = screen.getByTestId("ward-reset-baseline-modal");
    // Bug list row 1: a restore saves twelve rules, the three forecast alerts among them.
    expect(modal).toHaveTextContent("all twelve rules");
    for (const name of [
      "Referral decision",
      "Transfer acceptance",
      "Transport booked",
      "Bed type short tomorrow",
      "Access target forecast",
      "Forecast got worse",
      "Glare",
    ]) {
      expect(modal, name).toHaveTextContent(name);
    }
    expect(modal).not.toHaveTextContent("six coordination rules");
    fireEvent.click(screen.getAllByRole("button", { name: "Restore all defaults" }).at(-1)!);
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(
      String(defaultWardConfiguration().edAccessTargetMinutes),
    );

    const restored = within(screen.getByTestId("toast-region")).getByText("Defaults restored and recorded.");
    const restoredToast = restored.closest<HTMLElement>('[data-testid="toast"]')!;
    fireEvent.click(within(restoredToast).getByRole("button", { name: "Undo" }));
    expect(screen.getByTestId("probe-ed-target").textContent).toBe("720");
    // Save + Restore + Undo: three recorded configuration changes, so the audit keeps all of them.
    expect(Number(screen.getByTestId("probe-audit-count").textContent)).toBe(beforeAuditCount + 3);
  });

  it("gives unsaved rule edits back on Undo after a restore, without saving them", () => {
    renderSettings();
    const saved = screen.getByTestId("probe-ed-target").textContent;
    setEdToMinimum();
    expect(screen.getByRole("button", { name: /^Save 1 change$/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore all defaults" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Restore all defaults" }).at(-1)!);
    const restored = within(screen.getByTestId("toast-region")).getByText("Defaults restored and recorded.");
    fireEvent.click(
      within(restored.closest<HTMLElement>('[data-testid="toast"]')!).getByRole("button", { name: "Undo" }),
    );

    // The unsaved edit is back as a draft; the saved rules are the ones from before the restore.
    expect(screen.getByRole("button", { name: /^Save 1 change$/ })).toBeInTheDocument();
    expect(screen.getByTestId("probe-ed-target").textContent).toBe(saved);
  });
});
