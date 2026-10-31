import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mode = vi.hoisted(() => ({ phone: false }));
const raw = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("Executive Settings reached operational state");
  }),
);
// Public field contract with a deliberately non-default target, proving the renderer consumes
// the supplied report rather than a default factory. No World or individual records are built.
const report = vi.hoisted(() => ({
  available: true,
  configuration: {
    edAccessTargetMinutes: 1200,
    parallelReferralCap: 3,
    pullHoldMinutes: 240,
    morningRollupDeadlineMinutes: 570,
    dueSoonUrgentMinutes: 60,
    dueSoonMinutes: 180,
    referralDecisionTargetMinutes: 120,
    transferAcceptanceTargetMinutes: 240,
    transportBookedTargetMinutes: 60,
    forecastShortBeds: 3,
    forecastEdLeadMinutes: 720,
    forecastWorseBeds: 2,
  },
}));
const browser = vi.hoisted(() => ({
  copy: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined),
  download: vi.fn<(blob: Blob, name: string) => void>(),
}));
vi.mock("@/components/ward-management/statistics/executive-statistics-context", () => ({
  useExecutiveStatistics: () => (report.available ? { publicConfiguration: report.configuration } : null),
  useExecutiveStatisticsControl: () => ({ executive: true }),
}));
vi.mock("@/components/ward-management/ward-clipboard", () => ({ copyTextToClipboard: browser.copy }));
vi.mock("@/components/ward-management/ward-download", () => ({ downloadBlob: browser.download }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/wf", async (load) => ({
  ...(await load<typeof import("@/components/wf")>()),
  useIsPhone: () => mode.phone,
}));
vi.mock("@/components/ward-management/ward-flow-provider", async (load) => ({
  ...(await load<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlow: raw,
  useWardFlowSelect: raw,
  useWardFlowClock: raw,
  useWardNetwork: raw,
  WardFlowProvider: raw,
}));
vi.mock("@/components/ward-management/ward-flow-raise", () => ({ useWardRaise: raw }));
vi.mock("@/components/ward-management/shell/ward-access-context", async (load) => ({
  ...(await load<typeof import("@/components/ward-management/shell/ward-access-context")>()),
  useUnscopedWardFlow: raw,
}));
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { copyExecutiveSettingsDiagnostics } from "@/components/ward-management/settings/settings-operational-source";
import { useSettingsDeskProfile } from "@/components/ward-management/settings/settings-desk-profile";
import {
  WardShellAuthorityProvider,
  WardShellPublicProvider,
} from "@/components/ward-management/shell/ward-shell-public-context";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { applyAppearance, useAppearanceStore } from "@/components/ward-management/shell/ward-bar";
const switchRole = vi.fn();
function PublicExecutive({ children }: { children: ReactNode }) {
  return (
    <WardShellAuthorityProvider access={{ role: "executive", scope: { kind: "service", service: "North Metro" } }}>
      <WardShellPublicProvider
        value={{
          now: 642,
          placeLabel: "North Metro",
          authenticated: true,
          switchRole,
          places: {
            unitSiteCode: () => undefined,
            unitService: () => undefined,
            edSiteCode: () => undefined,
            edService: () => undefined,
            teamSlug: (name) => name,
            teamService: () => undefined,
            siteService: () => undefined,
          },
        }}
      >
        {children}
      </WardShellPublicProvider>
    </WardShellAuthorityProvider>
  );
}
beforeEach(() => {
  raw.mockClear();
  switchRole.mockClear();
  browser.copy.mockClear();
  browser.download.mockClear();
  report.available = true;
  mode.phone = false;
  setWardFeatureFlagOnDevice("role-access", false);
  window.history.replaceState({}, "", "/ward-flow/settings");
});
afterEach(() => {
  applyAppearance("auto");
  setWardFeatureFlagOnDevice("role-access", null);
});
describe("executive Settings from public authority only", () => {
  it("names the actual executive desk without requesting Unit records", () => {
    const hook = renderHook(() => useSettingsDeskProfile(), { wrapper: PublicExecutive });
    expect(hook.result.current.role).toBe("Executive");
    expect(hook.result.current.location).toBe("North Metro");
    expect(raw).not.toHaveBeenCalled();
  });
  // Settings by login (Josh, 31 Oct 2026): "Switch login (demo)" is the demo's desk switcher and is
  // hidden once real sign-in is on, so a signed-in executive is not offered it, here or in Find.
  it("keeps desktop sections and appearance controls, with no demo login switch once signed in", () => {
    render(
      <PublicExecutive>
        <SettingsScreen />
      </PublicExecutive>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    const appearance = renderHook(() => useAppearanceStore());
    expect(appearance.result.current).toBe("dark");
    expect(screen.queryByRole("button", { name: "Go to a desk" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Switch login/ })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Find a setting" }), { target: { value: "workstation" } });
    expect(screen.queryByRole("option", { name: /Switch login|Go to a desk/ })).toBeNull();
    expect(switchRole).not.toHaveBeenCalled();
    expect(raw).not.toHaveBeenCalled();
  });
  it("keeps the phone's quick preferences and Settings area sheets without a world", () => {
    mode.phone = true;
    render(
      <PublicExecutive>
        <SettingsScreen />
      </PublicExecutive>,
    );
    expect(screen.getByTestId("ward-settings-phone-theme")).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("ward-settings-phone-area-device")).getByRole("button"));
    expect(screen.getByTestId("ward-settings-phone-sheet")).toBeInTheDocument();
    expect(raw).not.toHaveBeenCalled();
  });
  it("shows supplied public rules and explicit unavailable history rather than inferred empty records", () => {
    render(
      <PublicExecutive>
        <SettingsScreen />
      </PublicExecutive>,
    );
    // Settings by login (31 Oct 2026): the executive reads "How the figures are worked out", the rules
    // behind its figures, read only, from the supplied report (20h, not the 24h default).
    const summary = screen.getByTestId("ward-settings-rules-summary");
    expect(summary).toHaveTextContent("How the figures are worked out");
    expect(screen.getByTestId("ward-settings-rule-ed-target")).toHaveTextContent("20h");
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryByText("No rule saves this session.")).toBeNull();
    expect(screen.queryByText("None over now")).toBeNull();
    // No Demo tools for the executive, so no record counts of any kind.
    expect(screen.queryByTestId("ward-settings-demo-tools")).toBeNull();
    expect(screen.queryByText(/movements held|events this session/u)).toBeNull();
    expect(raw).not.toHaveBeenCalled();
  });
  // Settings by login (31 Oct 2026): the rules file, diagnostics and reset are Demo tools, for the
  // coordinator and access admin only. The executive keeps its own browser's Restore. The aggregate-only
  // diagnostics stay guarded at their source.
  it("offers the executive no rules file, diagnostics or reset, and keeps any diagnostics aggregate-only", async () => {
    render(
      <PublicExecutive>
        <SettingsScreen />
      </PublicExecutive>,
    );
    for (const id of ["btn-copy-diagnostics", "btn-export-config", "btn-clear-cache", "input-import-config"]) {
      expect(screen.queryByTestId(id), id).toBeNull();
    }
    fireEvent.click(screen.getByTestId("btn-restore-baseline"));
    const restore = screen.getByRole("dialog", { name: "Restore this browser's settings?" });
    expect(restore).toHaveTextContent("Only this browser changes.");
    fireEvent.click(within(restore).getByRole("button", { name: "Cancel" }));

    await copyExecutiveSettingsDiagnostics(report.configuration);
    const diagnostics = JSON.parse(browser.copy.mock.calls[0][0]);
    expect(diagnostics.configuration).toEqual(report.configuration);
    expect(diagnostics.dataAccess).toBe("aggregate-only");
    expect(diagnostics).not.toHaveProperty("movementCount");
    expect(diagnostics).not.toHaveProperty("patients");
    expect(raw).not.toHaveBeenCalled();
  });
  it("does not substitute defaults or operational selectors when the bound report is absent", () => {
    report.available = false;
    render(
      <PublicExecutive>
        <SettingsScreen />
      </PublicExecutive>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Public settings are unavailable");
    expect(screen.queryByText("24h")).toBeNull();
    expect(raw).not.toHaveBeenCalled();
  });
});
