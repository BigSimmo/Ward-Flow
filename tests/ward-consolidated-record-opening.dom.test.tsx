import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
const nav = vi.hoisted(() => ({ pathname: "/ward-flow" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
import { WardAccessGate, WardAccessScope } from "@/components/ward-management/shell/ward-access";
import {
  SharedSessionContext,
  type SharedSession,
} from "@/components/ward-management/shell/ward-shared-session-context";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { scopeWorkspace } from "@/components/ward-management/ward-access-scope";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
const access: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } };
const seed = seedWardFlowState();
const scoped = scopeWorkspace(seed, access, { now: NOW_ANCHOR, places: wardPlaceLookup(seed.units) });
const permitted = scoped.movements.find((movement) => movement.patientId)!;
const outside = seed.movements.find((movement) => !scoped.movements.some((seen) => seen.id === movement.id))!;
function Generation({ generation, children }: { generation: number; children: ReactNode }) {
  const context = useWardFlow();
  return <WardFlowOverride value={{ ...context, worldGeneration: generation }}>{children}</WardFlowOverride>;
}
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});
describe("permitted direct movement record opening", () => {
  function app(session: SharedSession, generation = seed.worldGeneration) {
    return (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Generation generation={generation}>
          <WardAccessScope>
            <SharedSessionContext.Provider value={session}>
              <WardAccessGate>
                <p>Record content</p>
              </WardAccessGate>
            </SharedSessionContext.Provider>
          </WardAccessScope>
        </Generation>
      </WardFlowProvider>
    );
  }
  function asWard() {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(access);
    });
  }
  it("logs and requests hydration for the person on an allowed movement URL", () => {
    asWard();
    nav.pathname = movementHref(permitted.id);
    const logRecordView = vi.fn();
    render(app({ signOut: vi.fn(), logRecordView }));
    expect(screen.getByText("Record content")).toBeInTheDocument();
    expect(logRecordView).toHaveBeenCalledWith(permitted.patientId, "movement");
    expect(logRecordView).toHaveBeenCalledTimes(1);
  });
  it("does not log or render an out-of-scope movement", () => {
    asWard();
    nav.pathname = movementHref(outside.id);
    const logRecordView = vi.fn();
    render(app({ signOut: vi.fn(), logRecordView }));
    expect(screen.queryByText("Record content")).toBeNull();
    expect(logRecordView).not.toHaveBeenCalled();
  });
  it("logs the replacement generation again without changing the desk or patient id", () => {
    asWard();
    nav.pathname = movementHref(permitted.id);
    const session = { signOut: vi.fn(), logRecordView: vi.fn() };
    const { rerender } = render(app(session));
    expect(session.logRecordView).toHaveBeenCalledTimes(1);
    rerender(app(session));
    expect(session.logRecordView).toHaveBeenCalledTimes(1);
    rerender(app(session, seed.worldGeneration + 1));
    expect(session.logRecordView).toHaveBeenCalledTimes(2);
    expect(session.logRecordView).toHaveBeenLastCalledWith(permitted.patientId, "movement");
  });
});
