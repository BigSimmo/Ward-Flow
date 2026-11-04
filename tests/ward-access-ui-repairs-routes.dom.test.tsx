import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ pathname: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
import { WardAccessGate, WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
const seed = seedWardFlowState();
const movement = seed.movements.find((m) => m.patientId && m.originEdId)!;
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});
it.each([true, false])("logs an authorised movement address, authorised=%s", (authorised) => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({
      role: "ed",
      scope: { kind: "ed", edId: authorised ? movement.originEdId! : "synthetic-unrelated-ed" },
    });
  });
  route.pathname = `/ward-flow/movements/${encodeRecordAddress(movement.id)}`;
  const logRecordView = vi.fn();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <SharedSessionContext.Provider value={{ signOut: vi.fn(), logRecordView }}>
          <WardAccessGate>
            <p>Authorised content</p>
          </WardAccessGate>
        </SharedSessionContext.Provider>
      </WardAccessScope>
    </WardFlowProvider>,
  );
  if (authorised) {
    expect(screen.getByText("Authorised content")).toBeInTheDocument();
    expect(logRecordView).toHaveBeenCalledWith(movement.patientId, "movement");
    expect(logRecordView).toHaveBeenCalledTimes(1);
  } else {
    expect(screen.queryByText("Authorised content")).toBeNull();
    expect(logRecordView).not.toHaveBeenCalled();
  }
});
