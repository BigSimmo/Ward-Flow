import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { exitDemoRole, useDemoRoleSession } from "@/components/ward-management/tools/ward-demo-role-session";
import { WardViewingAsBar } from "@/components/ward-management/shell/ward-viewing-as-bar";
import { WardViewingAsBarBody } from "@/components/ward-management/shell/ward-viewing-as-bar-body";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import {
  resetWardAccessStoreForTests,
  useEffectiveWardAccess,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const navigation = vi.hoisted(() => ({ path: "/ward-flow", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.path,
  useRouter: () => ({ push: navigation.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function RoleProbe() {
  return <output data-testid="role">{useEffectiveWardAccess().role}</output>;
}

/** The bar as the layout shows it, without the lazy load: only while a role demo is on. */
function Bar() {
  return useDemoRoleSession() ? <WardViewingAsBarBody /> : null;
}

function renderShell() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <Bar />
        <RoleProbe />
        <WardDemoPanel oneList />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  navigation.path = "/ward-flow";
  navigation.push.mockImplementation((path: string) => {
    navigation.path = path;
  });
  localStorage.clear();
  act(() => {
    resetWardAccessStoreForTests();
    setWardFeatureFlagOnDevice("role-access", null);
  });
});
afterEach(() => {
  act(() => {
    exitDemoRole();
    resetWardAccessStoreForTests();
    setWardFeatureFlagOnDevice("role-access", null);
  });
});

/**
 * Shared design parts item 8 (13 Nov 2026): viewing as another desk through See it as shows one
 * slim bar under the app bar, "Viewing as {place} · {role}", whose Back to coordinator is See it
 * as's own way back.
 */
describe("Viewing as bar", () => {
  it("draws nothing while no role demo is on", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardViewingAsBar />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-viewing-as-bar")).toBeNull();
  });

  it("names the desk on view and goes back to the coordinator", () => {
    renderShell();
    expect(screen.queryByTestId("ward-viewing-as-bar")).toBeNull();
    const roles = screen.getByRole("group", { name: "Demo role" });
    fireEvent.click(within(roles).getByRole("button", { name: /^Nurse in charge/u }));
    expect(screen.getByTestId("role")).toHaveTextContent("ward");
    const bar = screen.getByTestId("ward-viewing-as-bar");
    expect(bar).toHaveTextContent(/^Viewing as .+ · Nurse in charge/u);
    fireEvent.click(within(bar).getByRole("button", { name: "Back to coordinator" }));
    expect(screen.getByTestId("role")).toHaveTextContent("coordinator");
    expect(navigation.push).toHaveBeenLastCalledWith("/ward-flow");
    expect(screen.queryByTestId("ward-viewing-as-bar")).toBeNull();
  });
});
