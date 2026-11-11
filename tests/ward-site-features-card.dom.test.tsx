import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/settings",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider } from "@/components/wf";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { resetLocalAccessAdminForTests } from "@/components/ward-management/shell/ward-access-admin-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import {
  SITE_PROTECTED_FEATURES,
  SITE_SWITCHABLE_FEATURES,
} from "@/components/ward-management/ward-site-feature-switches";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

/**
 * Batch 4 item 20 (D-142): the access admin's Features at this site card in Settings, Access. Only
 * the access admin sees it; one tap switches a listed feature for the chosen site, Undo reverses it,
 * and a protected feature never shows. Synthetic data only.
 */
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
    resetLocalAccessAdminForTests();
  });
});

/** The shared site switch records, as the workspace holds them. */
function SwitchProbe() {
  const { siteFeatureSwitches } = useWardFlow();
  return <output data-testid="probe-switches">{JSON.stringify(siteFeatureSwitches)}</output>;
}

function settingsAs(access: WardAccess) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SwitchProbe />
        <SettingsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

const switches = () => JSON.parse(screen.getByTestId("probe-switches").textContent ?? "[]") as unknown[];

describe("Features at this site", () => {
  it("shows only to the access admin", () => {
    const others: WardAccess[] = [
      { role: "coordinator", scope: { kind: "statewide" } },
      { role: "executive", scope: { kind: "statewide" } },
      { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } },
      { role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } },
    ];
    for (const access of others) {
      settingsAs(access);
      for (const section of ["you", "access"]) {
        const jump = screen.queryByTestId(`ward-settings-jump-${section}`);
        if (jump) fireEvent.click(jump);
      }
      expect(screen.queryByTestId("ward-settings-site-features"), access.role).not.toBeInTheDocument();
      cleanup();
    }
    // Anti-vacuity: the access admin's Access tab has it.
    settingsAs({ role: "admin", scope: { kind: "statewide" } });
    expect(screen.getByTestId("ward-settings-site-features")).toBeInTheDocument();
  });

  it("lists the five features only, never a protected one, with the always-on line", () => {
    settingsAs({ role: "admin", scope: { kind: "statewide" } });
    const card = screen.getByTestId("ward-settings-site-features");
    expect(within(card).getAllByRole("switch")).toHaveLength(SITE_SWITCHABLE_FEATURES.length);
    for (const feature of SITE_SWITCHABLE_FEATURES)
      expect(within(card).getByTestId(`site-feature-${feature}`)).toBeInTheDocument();
    for (const feature of Object.keys(SITE_PROTECTED_FEATURES))
      expect(within(card).queryByTestId(`site-feature-${feature}`)).not.toBeInTheDocument();
    expect(within(card).queryByText("Absent without leave bed hold review")).not.toBeInTheDocument();
    expect(within(card).queryByText("Ward closure")).not.toBeInTheDocument();
    expect(
      within(card).getByText("Always on, so not listed: safety notices, legal times and ruling guards."),
    ).toBeInTheDocument();
  });

  it("starts with no site chosen, so nothing switches until one is", () => {
    settingsAs({ role: "admin", scope: { kind: "statewide" } });
    const card = screen.getByTestId("ward-settings-site-features");
    expect(within(card).getByRole("combobox", { name: "Site" })).toHaveValue("");
    const row = within(card).getByTestId("site-feature-help-ask");
    expect(row).toHaveTextContent("Choose a site first");
    fireEvent.click(within(row).getByRole("switch"));
    expect(switches()).toEqual([]);
  });

  it("switches a feature off for the chosen site with one tap, and Undo switches it back", () => {
    settingsAs({ role: "admin", scope: { kind: "statewide" } });
    const card = screen.getByTestId("ward-settings-site-features");
    fireEvent.change(within(card).getByRole("combobox", { name: "Site" }), { target: { value: "RPH" } });
    const row = () => within(screen.getByTestId("ward-settings-site-features")).getByTestId("site-feature-help-ask");
    expect(row()).toHaveTextContent("On for everyone here");
    expect(within(row()).getByRole("switch")).toHaveAttribute("aria-checked", "true");

    // One tap, no "Are you sure?".
    fireEvent.click(within(row()).getByRole("switch"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(switches()).toEqual([{ siteCode: "RPH", feature: "help-ask", at: NOW_ANCHOR, by: "admin" }]);
    expect(within(row()).getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(row()).toHaveTextContent(/^.*Off for everyone here since \d\d:\d\d · Access admin/u);

    fireEvent.click(within(row()).getByRole("button", { name: /^Undo/u }));
    expect(switches()).toEqual([]);
    expect(row()).toHaveTextContent("On for everyone here");
    expect(within(row()).queryByRole("button", { name: /^Undo/u })).not.toBeInTheDocument();
  });
});
