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
  it("keeps desktop panels, appearance controls and the authenticated role switch with no operational hooks", () => {
    render(
      <PublicExecutive>
        <SettingsScreen />
      </PublicExecutive>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Display/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    const appearance = renderHook(() => useAppearanceStore());
    expect(appearance.result.current).toBe("dark");
    fireEvent.click(screen.getAllByRole("button", { name: "Go to a desk" })[0]);
    expect(switchRole).toHaveBeenCalledOnce();
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
    fireEvent.click(within(screen.getByTestId("ward-settings-phone-area-display")).getByRole("button"));
    expect(screen.getByTestId("ward-settings-phone-sheet")).toBeInTheDocument();
    expect(raw).not.toHaveBeenCalled();
  });
  it("shows supplied public rules and explicit unavailable history rather than inferred empty records", () => {
    render(
      <PublicExecutive>
        <SettingsScreen />
      </PublicExecutive>,
    );
    expect(screen.getByRole("spinbutton", { name: "ED access target" })).toHaveTextContent("20h");
    expect(
      screen.getByText("Individual changes and audit entries are unavailable for executive reporting."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No rule saves this session.")).toBeNull();
    expect(screen.queryByText("None over now")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Data and about/ }));
    expect(screen.getByText("Aggregate reports only")).toBeVisible();
    expect(screen.queryByText("Movements held")).toBeNull();
    expect(screen.queryByText("Events recorded this session")).toBeNull();
    expect(screen.getByTestId("ward-settings-thresholds-unavailable")).toBeVisible();
    expect(screen.getByText("Feature flags")).toBeVisible();
    expect(raw).not.toHaveBeenCalled();
  });
  it("retains public diagnostics, allowed export and own-browser clearing with no operational payload", async () => {
    render(
      <PublicExecutive>
        <SettingsScreen />
      </PublicExecutive>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Data and about/ }));
    fireEvent.click(screen.getByTestId("btn-copy-diagnostics"));
    const diagnostics = JSON.parse(browser.copy.mock.calls[0][0]);
    expect(diagnostics.configuration).toEqual(report.configuration);
    expect(diagnostics.dataAccess).toBe("aggregate-only");
    expect(diagnostics).not.toHaveProperty("movementCount");
    expect(diagnostics).not.toHaveProperty("patients");
    fireEvent.click(screen.getByTestId("btn-export-config"));
    expect(browser.download).toHaveBeenCalledOnce();
    expect(browser.download.mock.calls[0][1]).toMatch(/^ward-flow-rules-.*\.json$/);
    const exported = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(browser.download.mock.calls[0][0]);
    });
    expect(JSON.parse(exported)).toMatchObject({
      product: "Ward Flow Statewide Bed Coordination",
      version: 6,
      configuration: report.configuration,
    });
    expect(Object.keys(JSON.parse(exported)).sort()).toEqual(
      ["product", "version", "exportedAt", "configuration"].sort(),
    );
    sessionStorage.setItem("wf-draft:synthetic-preview", "synthetic");
    fireEvent.click(screen.getByTestId("btn-clear-cache"));
    expect(sessionStorage.getItem("wf-draft:synthetic-preview")).toBeNull();
    expect(screen.getByRole("button", { name: /Import/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("btn-restore-baseline")).toHaveAttribute("aria-disabled", "true");
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
