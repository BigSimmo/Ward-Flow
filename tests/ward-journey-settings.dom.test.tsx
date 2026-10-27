import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useLayoutEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

const interception = vi.hoisted(() => ({ raise: null as WardRaise | null }));
vi.mock("@/components/ward-management/ward-flow-raise", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-flow-raise")>();
  return {
    ...actual,
    useWardRaise: (role: Parameters<typeof actual.useWardRaise>[0]) => {
      const real = actual.useWardRaise(role);
      return interception.raise ?? real;
    },
  };
});
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { ToastProvider } from "@/components/wf";
import { applyAppearance } from "@/components/ward-management/shell/ward-bar";
import { clearReferralDraftSession } from "@/components/ward-management/referrals/referral-draft-lifecycle";
import {
  useReferralDraftAutosave,
  useReferralDraftRecovery,
} from "@/components/ward-management/referrals/referral-draft-hooks";
import { readKeptReferralDraft, keepReferralDraft } from "@/components/ward-management/referrals/referral-draft-cache";
import {
  draftSessionVersion,
  sessionDraftKey,
  writeSessionDraft,
} from "@/components/ward-management/ward-session-drafts";

import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { setWardAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { readTourStep, saveTourStep } from "@/components/ward-management/help/ward-help-store";

let flow!: ReturnType<typeof useWardFlow>;
function Probe() {
  const value = useWardFlow();
  useLayoutEffect(() => {
    flow = value;
  }, [value]);
  return <output data-testid="configuration">{JSON.stringify(value.configuration)}</output>;
}
function renderSettings(extra?: ReactNode) {
  return render(
    <ToastProvider>
      <WardFlowProvider>
        <SettingsScreen />
        <Probe />
        {extra}
      </WardFlowProvider>
    </ToastProvider>,
  );
}
const selectData = () => fireEvent.click(screen.getByRole("radio", { name: /^Data and about/ }));
const edit = () => fireEvent.keyDown(screen.getByRole("spinbutton", { name: "ED access target" }), { key: "Home" });
const save = () => fireEvent.click(screen.getByRole("button", { name: /^Save \d+ change/ }));
const undo = (title: RegExp) =>
  fireEvent.click(
    within(screen.getByText(title).closest<HTMLElement>('[data-testid="toast"]')!).getByRole("button", {
      name: "Undo",
    }),
  );
function external(patch: Partial<ReturnType<typeof defaultWardConfiguration>>) {
  act(() => {
    const completion = flow.dispatch({
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now: flow.now,
      payload: { ...flow.configuration, ...patch },
    });
    expect(completion).toMatchObject({ status: "accepted" });
  });
}

describe("settings audited journey recovery", () => {
  beforeEach(() => {
    interception.raise = null;
    clearReferralDraftSession();
    window.history.replaceState(null, "", "/ward-flow/settings");
  });
  afterEach(() => {
    cleanup();
    applyAppearance("auto");
    interception.raise = null;
    clearReferralDraftSession();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    act(() => {
      setWardFeatureFlagOnDevice("role-access", null);
      resetWardAccessStoreForTests();
    });
  });

  it("preserves an unrelated incoming save, including through Undo", () => {
    renderSettings();
    edit();
    external({ pullHoldMinutes: 120 });
    save();
    expect(flow.configuration.edAccessTargetMinutes).toBe(720);
    expect(flow.configuration.pullHoldMinutes).toBe(120);
    external({ parallelReferralCap: 2 });
    undo(/saved and recorded\./);
    expect(flow.configuration.edAccessTargetMinutes).toBe(defaultWardConfiguration().edAccessTargetMinutes);
    expect(flow.configuration.pullHoldMinutes).toBe(120);
    expect(flow.configuration.parallelReferralCap).toBe(2);
  });

  it("refuses conflicting edits, keeps the draft, and permits discard/retry", () => {
    renderSettings();
    edit();
    external({ edAccessTargetMinutes: 960 });
    save();
    expect(flow.configuration.edAccessTargetMinutes).toBe(960);
    expect(screen.getByTestId("ward-settings-configuration-refused")).toBeVisible();
    expect(screen.getByRole("spinbutton", { name: "ED access target" })).toHaveAttribute("aria-valuenow", "720");
    expect(screen.queryByText(/saved and recorded\./)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    edit();
    save();
    expect(flow.configuration.edAccessTargetMinutes).toBe(720);
    expect(screen.queryByTestId("ward-settings-configuration-refused")).not.toBeInTheDocument();
  });

  it("refuses Undo after a conflicting later edit without announcing a successful reversal", () => {
    renderSettings();
    edit();
    save();
    external({ edAccessTargetMinutes: 960 });
    undo(/saved and recorded\./);
    expect(flow.configuration.edAccessTargetMinutes).toBe(960);
    expect(screen.getByTestId("ward-settings-configuration-refused")).toBeVisible();
    expect(screen.queryByText("Rules back as they were. Recorded in the audit.")).not.toBeInTheDocument();
  });

  it("keeps an earlier Undo available while another rule change is pending", async () => {
    renderSettings();
    edit();
    save();
    let finish!: (outcome: WardCommandOutcome) => void;
    const pending = vi.fn(
      () =>
        new Promise<WardCommandOutcome>((resolve) => {
          finish = resolve;
        }),
    );
    interception.raise = pending as WardRaise;
    external({ parallelReferralCap: 2 });
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: /pull time limit/i }), { key: "ArrowDown" });
    save();
    undo(/saved and recorded\./);
    expect(pending).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/saved and recorded\./)).toBeVisible();
    expect(screen.getByText("Wait for the current rule change before undoing.")).toBeVisible();
    await act(async () => finish({ commandId: "synthetic-pending-setting", status: "failed" }));
    expect(
      within(screen.getByText(/saved and recorded\./).closest<HTMLElement>('[data-testid="toast"]')!).getByRole(
        "button",
        { name: "Undo" },
      ),
    ).toBeEnabled();
  });

  it.each(["refused", "failed", "cancelled"] as const)(
    "waits for this save and keeps the draft on %s",
    async (status) => {
      let finish!: (outcome: WardCommandOutcome) => void;
      interception.raise = vi.fn(
        () =>
          new Promise<WardCommandOutcome>((resolve) => {
            finish = resolve;
          }),
      ) as WardRaise;
      renderSettings();
      edit();
      save();
      external({ pullHoldMinutes: 120 });
      const pendingSave = screen.getByRole("button", { name: "Saving…" });
      expect(pendingSave).toHaveAttribute("aria-disabled", "true");
      pendingSave.focus();
      expect(pendingSave).toHaveFocus();
      fireEvent.click(pendingSave);
      expect(interception.raise).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/saved and recorded\./)).not.toBeInTheDocument();
      await act(async () =>
        finish({ commandId: "synthetic-settings-command", status, message: "Synthetic command did not complete." }),
      );
      expect(screen.getByRole("button", { name: "Save 1 change" })).toBeEnabled();
      expect(screen.getByTestId("ward-settings-configuration-refused")).toHaveTextContent(
        "Synthetic command did not complete.",
      );
    },
  );

  it("does not claim a refused restore or change browser preferences", async () => {
    applyAppearance("dark");
    let finish!: (outcome: WardCommandOutcome) => void;
    interception.raise = vi.fn(
      () =>
        new Promise<WardCommandOutcome>((resolve) => {
          finish = resolve;
        }),
    ) as WardRaise;
    renderSettings();
    selectData();
    fireEvent.click(screen.getByRole("button", { name: "Restore all defaults" }));
    fireEvent.click(screen.getByTestId("confirm-restore-defaults-btn"));
    expect(screen.getByTestId("confirm-restore-defaults-btn")).toBeDisabled();
    expect(screen.queryByText("Defaults restored and recorded.")).not.toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await act(async () =>
      finish({ commandId: "synthetic-settings-restore", status: "refused", message: "Synthetic refusal." }),
    );
    expect(screen.getByTestId("ward-reset-baseline-modal")).toBeVisible();
    expect(screen.getByTestId("confirm-restore-defaults-btn")).toBeEnabled();
    expect(screen.queryByText("Defaults restored and recorded.")).not.toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("clears memory and fences a mounted autosave, unmount, stale owner and reopening", () => {
    vi.useFakeTimers();
    const key = sessionDraftKey("standard/0", "referral", "new");
    const owner = draftSessionVersion();
    const draft = { activePatientKey: "synthetic-new-person" };
    keepReferralDraft(draft, undefined, key);
    function PendingDraft() {
      useReferralDraftAutosave({
        draft: { ...draft, edited: true },
        storageKey: key,
        draftJson: "synthetic changed draft",
        enabled: true,
        dirty: true,
        initialKeptAt: null,
        initialKeptJson: null,
      });
      return null;
    }
    window.sessionStorage.setItem("unrelated-application-preference", "kept");
    const page = renderSettings(<PendingDraft />);
    selectData();
    fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
    act(() => vi.advanceTimersByTime(600));
    expect(readKeptReferralDraft(key)).toBeNull();
    expect(writeSessionDraft(key, "synthetic stale callback", owner)).toBe(false);
    page.unmount();
    expect(readKeptReferralDraft(key)).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(window.sessionStorage.getItem("unrelated-application-preference")).toBe("kept");
    const newKey = sessionDraftKey("standard/0", "referral", "new");
    expect(newKey).not.toBe(key);
    expect(readKeptReferralDraft(newKey)).toBeNull();
    function ReopenedDraft() {
      const recovery = useReferralDraftRecovery("standard/0", undefined, null, "synthetic-new-person");
      return <output data-testid="reopened-draft">{recovery.kept === null ? "empty" : "recovered"}</output>;
    }
    render(<ReopenedDraft />);
    expect(screen.getByTestId("reopened-draft")).toHaveTextContent("empty");
  });

  it("explains the development-only digest in production without offering a broken link", () => {
    vi.stubEnv("NODE_ENV", "production");
    renderSettings();
    selectData();
    expect(screen.queryByRole("link", { name: "Ward Flow Digest" })).not.toBeInTheDocument();
    expect(screen.getByText("Ward Flow Digest is available in the local development preview.")).toBeVisible();
  });

  it("explains coordinator-only rules while retaining personal settings for a ward desk", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    });
    const raised = vi.fn();
    interception.raise = raised as WardRaise;
    render(
      <ToastProvider>
        <WardFlowProvider>
          <WardAccessScope>
            <SettingsScreen />
            <Probe />
          </WardAccessScope>
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /^Rules/ }));
    const target = screen.getByRole("spinbutton", { name: "ED access target" });
    const original = target.getAttribute("aria-valuenow");
    expect(target).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(target, { key: "Home" });
    expect(target).toHaveAttribute("aria-valuenow", original);
    selectData();
    const restore = screen.getByTestId("btn-restore-baseline");
    expect(restore).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(restore);
    expect(screen.queryByRole("dialog", { name: /Restore/i })).toBeNull();
    expect(raised).not.toHaveBeenCalled();
  });
  it("replays the tour from the first step, not the step it was left at", () => {
    saveTourStep("coordinator", 3);
    renderSettings();
    fireEvent.click(screen.getByTestId("settings-replay-tour"));
    expect(readTourStep("coordinator")).toBe(0);
  });
});
