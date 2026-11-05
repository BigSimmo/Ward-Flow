import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ pathname: "/ward-flow/search" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
import { useTourHome } from "@/components/ward-management/help/ward-tour-home";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { dispatchPersonaSyncForRole } from "@/components/ward-management/settings/persona-sync";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { ExecutiveStatisticsProvider } from "@/components/ward-management/statistics/executive-statistics-context";
const wrapper = ({ children }: { children: ReactNode }) => <WardFlowProvider>{children}</WardFlowProvider>;
afterEach(() => {
  act(() => {
    resetWardAccessStoreForTests();
    setWardFeatureFlagOnDevice("role-access", null);
    dispatchPersonaSyncForRole("coordinator");
  });
  route.pathname = "/ward-flow/search";
});
it("updates local persona homes and retains current-route priority", () => {
  act(() => dispatchPersonaSyncForRole("ward", "fre-adult-open"));
  const view = renderHook(() => useTourHome("ward"), { wrapper });
  expect(view.result.current.home).toBe("/ward-flow/ward/fre-adult-open");
  act(() => dispatchPersonaSyncForRole("ward", "rph-adult-secure"));
  expect(view.result.current.home).toBe("/ward-flow/ward/rph-adult-secure");
  route.pathname = "/ward-flow/ward/fre-adult-open";
  view.rerender();
  expect(view.result.current.home).toBe("/ward-flow/ward/fre-adult-open");
});
it("resolves an authenticated ward before route or persona", () => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({
      role: "ward",
      scope: { kind: "ward", unitIds: ["rph-adult-secure"] },
    });
    dispatchPersonaSyncForRole("ward", "fre-adult-open");
  });
  route.pathname = "/ward-flow/ward/fre-adult-open";
  const view = renderHook(() => useTourHome("ward"), { wrapper });
  expect(view.result.current).toEqual({
    home: "/ward-flow/ward/rph-adult-secure",
    deskHome: "/ward-flow/ward/rph-adult-secure",
  });
});
it("keeps missing-flow and executive-control early returns", () => {
  const absent = renderHook(() => useTourHome("ward"));
  expect(absent.result.current.home).toBeUndefined();
  absent.unmount();
  const reporting = ({ children }: { children: ReactNode }) => (
    <ExecutiveStatisticsProvider
      binding={null}
      snapshot={null}
      now={0}
      controls={{ executive: true, paused: false, togglePause: null }}
    >
      {children}
    </ExecutiveStatisticsProvider>
  );
  const view = renderHook(() => useTourHome("ward"), { wrapper: reporting });
  expect(view.result.current).toEqual({
    home: "/ward-flow/statistics",
    deskHome: "/ward-flow/statistics",
  });
});
