import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardDeskQrCard } from "@/components/ward-management/settings/ward-desk-qr-card";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";

/** Item 42 (D-137): the desk QR card offers only the wards the desk holds. Made-up desks only. */
const A = "rph-adult-secure";
const B = "scgh-adult-open";

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

function renderCard(demoUnitId?: string) {
  render(
    <WardFlowProvider>
      <WardDeskQrCard demoUnitId={demoUnitId} />
    </WardFlowProvider>,
  );
}

describe("ward desk QR card", () => {
  it("closes an open print page when its ward leaves the desk's scope", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [A, B] } });
    });
    renderCard();
    fireEvent.click(screen.getByTestId(`ward-settings-desk-qr-${A}`).querySelector("button")!);
    expect(screen.getByTestId("ward-desk-qr-paper")).toBeInTheDocument();
    act(() => {
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [B] } });
    });
    expect(screen.queryByTestId("ward-desk-qr-paper")).toBeNull();
    expect(screen.queryByTestId(`ward-settings-desk-qr-${A}`)).toBeNull();
    // Getting the ward back does not reopen the old page.
    act(() => {
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [A, B] } });
    });
    expect(screen.queryByTestId("ward-desk-qr-paper")).toBeNull();
  });

  it("with role access off, offers the ward desk being tried in the demo, and only that ward", () => {
    renderCard(A);
    expect(screen.getByTestId(`ward-settings-desk-qr-${A}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`ward-settings-desk-qr-${B}`)).toBeNull();
  });

  it("with role access off and no ward desk chosen, shows nothing", () => {
    renderCard();
    expect(screen.queryByTestId("ward-settings-desk-qr-card")).toBeNull();
  });
});
