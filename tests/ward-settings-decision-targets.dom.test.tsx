import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason as every sibling settings dom suite: next/link needs an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import {
  ACT_NOW_NOTIFICATIONS_STORAGE_KEY,
  getActNowNotificationPreference,
} from "@/components/ward-management/shell/ward-act-now-notifications";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { REFERRAL_DECISION_TARGET_MINUTES } from "@/components/ward-management/ward-operational-defaults";

/** Stream A, 9 Oct 2026: decision targets are labelled defaults set in Settings; notifications are opt-in. */
function Probe() {
  const { configuration } = useWardFlow();
  return <span data-testid="probe-referral-target">{configuration.referralDecisionTargetMinutes}</span>;
}

function renderSettings() {
  return render(
    <WardFlowProvider>
      <SettingsScreen />
      <Probe />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.removeItem(ACT_NOW_NOTIFICATIONS_STORAGE_KEY);
});

describe("settings: decision targets", () => {
  it("shows three labelled default targets as durations", () => {
    renderSettings();
    const card = screen.getByText("Decision targets").closest("[data-setting='decision-targets']") as HTMLElement;
    expect(within(card).getByText("Your defaults, not clinical standards")).toBeVisible();
    expect(within(card).getByText("Referral decision")).toBeVisible();
    expect(within(card).getByText("Transfer acceptance")).toBeVisible();
    expect(within(card).getByText("Transport booked")).toBeVisible();
    expect(screen.getByTestId("setting-target-referral_decision")).toHaveTextContent("2h");
  });

  it("saves a changed target into the configuration through the existing Save", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Increase referral decision target" }));
    expect(screen.getByTestId("probe-referral-target")).toHaveTextContent(String(REFERRAL_DECISION_TARGET_MINUTES));
    fireEvent.click(screen.getByRole("button", { name: /^Save \d+ changes?$/ }));
    expect(screen.getByTestId("probe-referral-target")).toHaveTextContent(
      String(REFERRAL_DECISION_TARGET_MINUTES + 15),
    );
  });
});

describe("settings: browser notifications", () => {
  function openAlerts() {
    fireEvent.click(screen.getByRole("radio", { name: /^Alerts/ }));
    return screen.getByTestId("setting-browser-notifications-row");
  }

  it("says when the browser cannot notify, and stays off", async () => {
    vi.stubGlobal("Notification", undefined);
    renderSettings();
    const row = openAlerts();
    expect(row).toHaveTextContent("Not available in this browser");
    await act(async () => {
      fireEvent.click(within(row).getByRole("switch", { name: "Browser notifications" }));
    });
    expect(getActNowNotificationPreference()).toBe(false);
    expect(within(row).getByRole("switch", { name: "Browser notifications" })).not.toBeChecked();
  });

  it("respects a denied permission without turning on", async () => {
    vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn(async () => "denied") });
    renderSettings();
    const row = openAlerts();
    await act(async () => {
      fireEvent.click(within(row).getByRole("switch", { name: "Browser notifications" }));
    });
    expect(getActNowNotificationPreference()).toBe(false);
    expect(row).toHaveTextContent("Blocked for this site in the browser");
    expect(screen.getByText("Notifications are blocked for this site in the browser.")).toBeInTheDocument();
  });

  it("turns on when the browser grants permission", async () => {
    vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn(async () => "granted") });
    renderSettings();
    const row = openAlerts();
    await act(async () => {
      fireEvent.click(within(row).getByRole("switch", { name: "Browser notifications" }));
    });
    expect(getActNowNotificationPreference()).toBe(true);
    expect(within(row).getByRole("switch", { name: "Browser notifications" })).toBeChecked();
  });
});
