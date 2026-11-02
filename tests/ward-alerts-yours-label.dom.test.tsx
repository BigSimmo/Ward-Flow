import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * P018 (Josh, 27 Oct 2026): one name for your own alerts. The phone hero said "Assigned to you"
 * where the desktop says "Yours"; both now say "Yours".
 */
afterEach(() => installMatchMediaStub(false));

function renderAlerts() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

describe("Alerts hero: your own alerts are called Yours", () => {
  it("says Yours on a phone", () => {
    installMatchMediaStub(true);
    const { container } = renderAlerts();
    expect(container.textContent).not.toContain("Assigned to you");
    expect(screen.getAllByText("Yours").length).toBeGreaterThan(0);
  });

  it("says Yours on a desktop", () => {
    installMatchMediaStub(false);
    const { container } = renderAlerts();
    expect(container.textContent).not.toContain("Assigned to you");
    expect(screen.getAllByText("Yours").length).toBeGreaterThan(0);
  });
});
