// tests/ward-settings-due-soon-warnings.dom.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { applyDueSoonThresholds } from "@/components/ward-management/ward-clock";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { DUE_SOON_MINUTES, DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";

/**
 * The two due-time warning rows (Josh, 26 Sept 2026: "your default, not a legal limit",
 * changeable in Settings). Mirrors the probe pattern in tests/ward-settings-configuration.dom.test.tsx.
 */
function Probe() {
  const { configuration } = useWardFlow();
  return (
    <div>
      <span data-testid="probe-due-soon-urgent">{configuration.dueSoonUrgentMinutes}</span>
      <span data-testid="probe-due-soon">{configuration.dueSoonMinutes}</span>
    </div>
  );
}

// Saving applies the warnings to ward-clock's shared thresholds; put the defaults back so no later
// test in this file inherits a saved value (Code map's Q3 review, note 2).
afterEach(() => applyDueSoonThresholds(DUE_SOON_URGENT_MINUTES, DUE_SOON_MINUTES));

function renderSettings() {
  return render(
    <WardFlowProvider>
      <SettingsScreen />
      <Probe />
    </WardFlowProvider>,
  );
}

/* v10: each warning is one stepper (a spinbutton between minus and plus); no slider. */
function urgentStepper() {
  return screen.getByRole("spinbutton", { name: "First warning before a legal due time" });
}

function soonStepper() {
  return screen.getByRole("spinbutton", { name: "Second warning before a legal due time" });
}

const valueOf = (stepper: HTMLElement) => Number(stepper.getAttribute("aria-valuenow"));

describe("settings screen due-time warning rows", () => {
  it("shows both rows at their defaults, each labelled as a default rather than a legal limit", () => {
    renderSettings();

    expect(screen.getByText("First warning")).toBeVisible();
    expect(screen.getByText("Second warning")).toBeVisible();
    // The card that holds both rows says once that these are defaults, not legal limits.
    expect(screen.getByText("Your defaults, not legal limits")).toBeVisible();

    expect(screen.getByTestId("due-soon-urgent-display")).toHaveTextContent("1h");
    expect(screen.getByTestId("due-soon-display")).toHaveTextContent("3h");
    expect(valueOf(urgentStepper())).toBe(DUE_SOON_URGENT_MINUTES);
    expect(valueOf(soonStepper())).toBe(DUE_SOON_MINUTES);

    expect(screen.getByTestId("setting-due-soon-urgent-desc")).toHaveTextContent("Before a legal due time");
    expect(screen.getByTestId("setting-due-soon-desc")).toHaveTextContent("Shown as due soon");
  });

  it("stepping the first warning up once and saving carries the new value into the provider's configuration", () => {
    renderSettings();
    expect(screen.getByTestId("probe-due-soon-urgent")).toHaveTextContent(String(DUE_SOON_URGENT_MINUTES));

    fireEvent.click(screen.getByRole("button", { name: "Increase first warning before a legal due time" }));
    expect(screen.getByTestId("due-soon-urgent-display")).toHaveTextContent("1h 15m");
    expect(valueOf(urgentStepper())).toBe(DUE_SOON_URGENT_MINUTES + 15);
    // Not dispatched yet.
    expect(screen.getByTestId("probe-due-soon-urgent")).toHaveTextContent(String(DUE_SOON_URGENT_MINUTES));

    fireEvent.click(screen.getByRole("button", { name: /^Save \d+ changes?$/ }));
    expect(screen.getByTestId("probe-due-soon-urgent")).toHaveTextContent(String(DUE_SOON_URGENT_MINUTES + 15));
    // The second warning was untouched and saves unchanged.
    expect(screen.getByTestId("probe-due-soon")).toHaveTextContent(String(DUE_SOON_MINUTES));
  });

  it("never lets the first warning's stepper reach or pass the second, so Save could never send a refused payload", () => {
    renderSettings();
    const increase = screen.getByRole("button", { name: "Increase first warning before a legal due time" });

    // 15-minute steps from 60 would reach 180 (equal to the second warning) after 8 clicks;
    // the clamp must stop it one urgent-step short of that, at 165, and hold it there.
    for (let i = 0; i < 12; i += 1) {
      fireEvent.click(increase);
    }

    expect(valueOf(urgentStepper())).toBe(165);
    expect(screen.getByTestId("due-soon-urgent-display")).toHaveTextContent("2h 45m");
    expect(valueOf(urgentStepper())).toBeLessThan(valueOf(soonStepper()));
  });

  it("jumping the first warning's stepper to its end stops it below the second, not equal or over", () => {
    renderSettings();
    // The urgent range's own maximum (180) equals the second warning's untouched default, so
    // jumping straight to the end (End key) is the sharpest boundary case: the clamp must still
    // refuse it.
    fireEvent.keyDown(urgentStepper(), { key: "End" });

    expect(valueOf(urgentStepper())).toBeLessThan(DUE_SOON_MINUTES);
    expect(valueOf(urgentStepper())).toBe(DUE_SOON_MINUTES - 15);
  });

  it("decreasing the second warning down to the first pulls the first down with it, keeping it strictly lower", () => {
    renderSettings();
    const decreaseSoon = screen.getByRole("button", { name: "Decrease second warning before a legal due time" });

    // 30-minute steps from 180 reach 60 (equal to the untouched first warning) after 4 clicks,
    // and 30 (the second warning's own floor) after 5; the first must be pulled down each time
    // it would no longer be strictly below the second.
    fireEvent.click(decreaseSoon);
    fireEvent.click(decreaseSoon);
    fireEvent.click(decreaseSoon);
    fireEvent.click(decreaseSoon);
    expect(valueOf(soonStepper())).toBe(60);
    expect(valueOf(urgentStepper())).toBeLessThan(60);

    fireEvent.click(decreaseSoon);
    expect(valueOf(soonStepper())).toBe(30);
    expect(valueOf(urgentStepper())).toBeLessThan(30);
    expect(valueOf(urgentStepper())).toBeGreaterThanOrEqual(15); // the first warning's own floor
  });
});
