import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * P017 (UI audit, 27 Oct 2026): on a phone, Broadcast sat right beside Next alert, so a thumb aiming
 * for the next alert could start a statewide broadcast. Pause now sits between them.
 */
afterEach(() => installMatchMediaStub(false));

describe("phone Alerts hero: Broadcast kept apart from Next alert", () => {
  it("does not place Broadcast next to Next alert", () => {
    installMatchMediaStub(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    const next = screen.getByTestId("ward-alerts-phone-next");
    const names = Array.from(next.parentElement!.querySelectorAll("button")).map((button) =>
      (button.textContent ?? "").trim(),
    );
    const at = names.indexOf("Next alert");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(names).toContain("Broadcast");
    expect(Math.abs(names.indexOf("Broadcast") - at)).toBeGreaterThan(1);
  });
});
