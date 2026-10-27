import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardAccessBanner, WardAccessScope } from "@/components/ward-management/shell/ward-access";
import {
  resetWardAccessStoreForTests,
  setWardAccess,
  startAccessPreview,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

// #792: a service coordinator opens Governance, Settings and Add patient by design (D-80), so the
// banner says what the desk's scope does (narrow the lists), not that it sees only what it needs.
function renderBanner() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <WardAccessBanner />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

describe("access banner wording (#792)", () => {
  it("says the lists are held to the places the previewed desk covers", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
      startAccessPreview({ role: "coordinator", scope: { kind: "service", service: "East Metro" } });
    });
    renderBanner();
    const banner = screen.getByTestId("ward-access-banner");
    expect(banner).toHaveTextContent("Previewing as");
    expect(banner).toHaveTextContent("Lists show only the places this desk covers.");
    expect(banner).not.toHaveTextContent("only what this role needs");
  });

  // Josh, 27 Oct 2026: a strip on every page looked poor. A desk signed in as itself already shows
  // its name on the rail's identity card, so the banner is for a preview only.
  it("shows nothing for a desk signed in as itself", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    });
    renderBanner();
    expect(screen.queryByTestId("ward-access-banner")).toBeNull();
  });
});
