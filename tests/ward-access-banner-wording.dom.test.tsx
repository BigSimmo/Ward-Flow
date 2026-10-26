import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardAccessBanner, WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
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
describe("access banner wording (#792)", () => {
  it("says the lists are held to the places the desk covers", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "coordinator", scope: { kind: "service", service: "East Metro" } });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAccessScope>
          <WardAccessBanner />
        </WardAccessScope>
      </WardFlowProvider>,
    );
    const banner = screen.getByTestId("ward-access-banner");
    expect(banner).toHaveTextContent("Lists show only the places this desk covers.");
    expect(banner).not.toHaveTextContent("only what this role needs");
  });
});
