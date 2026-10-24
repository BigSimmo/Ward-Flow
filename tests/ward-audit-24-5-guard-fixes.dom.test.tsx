import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The role is the route: each test sets the path the gate reads.
const navigation = vi.hoisted(() => ({ pathname: "/ward-flow" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import {
  resolveWardFeatureFlags,
  wardEnvironment,
  wardSafeguardsLocked,
} from "@/components/ward-management/ward-feature-flags";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

const unitId = seedWardFlowState().units[0].id;

function ExaminationButton() {
  const gate = useRoleGate()("RECORD_EXAMINATION");
  return (
    <div>
      <button type="button" data-testid="record-examination" {...gate.buttonProps}>
        Record examination
      </button>
      {gate.note}
    </div>
  );
}

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  navigation.pathname = "/ward-flow";
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", "/");
});

describe("RA-04: the desk switch is offered only where it can work", () => {
  it("a ward desk under role access sees the reason but no switch that would do nothing", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });
    });
    navigation.pathname = "/ward-flow/ed";
    render(<ExaminationButton />);
    expect(screen.getByTestId("record-examination")).toBeDisabled();
    expect(screen.getByText("ED or coordinator only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Switch to .* desk/ })).toBeNull();
  });

  it("a coordinator desk under role access keeps a switch that works", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
    });
    navigation.pathname = "/ward-flow/transport/officer";
    render(<ExaminationButton />);
    expect(screen.getByTestId("record-examination")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Switch to ED desk →" }));
    expect(screen.getByTestId("record-examination")).toBeEnabled();
  });

  it("with role access off the switch is offered and works", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", false);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });
    });
    navigation.pathname = "/ward-flow/transport/officer";
    render(<ExaminationButton />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to ED desk →" }));
    expect(screen.getByTestId("record-examination")).toBeEnabled();
  });
});

describe("RA-07: a shared build keeps the role access guard locked on", () => {
  it("locks safeguards whenever shared mode is enabled, even in a build named demo", () => {
    expect(wardSafeguardsLocked("demo", "production", "true")).toBe(true);
    expect(wardSafeguardsLocked("development", "development", " TRUE ")).toBe(true);
    expect(wardSafeguardsLocked("demo", "production", "false")).toBe(false);
    expect(wardSafeguardsLocked("demo", "production", undefined)).toBe(false);
    const resolved = resolveWardFeatureFlags({
      environment: wardEnvironment("demo", "production"),
      safeguardsLocked: wardSafeguardsLocked("demo", "production", "true"),
      server: { "role-access": false },
      device: { "role-access": false, "bed-meeting-tv": false },
    });
    const flag = (name: string) => resolved.find((entry) => entry.name === name)!;
    expect(flag("role-access")).toMatchObject({ on: true, source: "default", deviceCanChange: false });
    // Other flags still follow the device in a demo build.
    expect(flag("bed-meeting-tv")).toMatchObject({ on: false, source: "device", deviceCanChange: true });
  });

  it("a ?flags=role-access:off demo link cannot switch the guard off on a shared demo device", async () => {
    vi.stubEnv("NEXT_PUBLIC_WARD_ENVIRONMENT", "demo");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
    vi.resetModules();
    const store = await import("@/components/ward-management/shell/ward-feature-flag-store");
    window.history.replaceState(null, "", "/ward-flow?flags=role-access:off,bed-meeting-tv:off");
    render(<store.WardFeatureFlagLink />);
    const { result } = renderHook(() => ({
      roleAccess: store.useWardFeatureFlag("role-access"),
      tv: store.useWardFeatureFlag("bed-meeting-tv"),
    }));
    expect(result.current.tv).toBe(false);
    expect(result.current.roleAccess).toBe(true);
    act(() => store.setWardFeatureFlagOnDevice("bed-meeting-tv", null));
  });
});
