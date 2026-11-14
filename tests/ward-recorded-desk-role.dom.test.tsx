import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useRecordedDeskRole } from "@/components/ward-management/use-recorded-desk-role";

/*
 * Demo-Rules-LG-6 and RV2-8 (14 Nov 2026): a step the coordinator's desk takes on an ED or ward
 * route is recorded as the coordinator's, as the shared server records it (`deskCommand`).
 */
afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("the role a desk's step is recorded under", () => {
  it("is the coordinator for the coordinator's desk on another desk's route", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
    });
    expect(renderHook(() => useRecordedDeskRole("ed")).result.current).toBe("coordinator");
    expect(renderHook(() => useRecordedDeskRole("ward")).result.current).toBe("coordinator");
  });

  it("stays the route's role for that desk's own staff", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ed", scope: { kind: "ed", edId: "rph-ed" } });
    });
    expect(renderHook(() => useRecordedDeskRole("ed")).result.current).toBe("ed");
  });

  it("stays the route's role with role access off, where the route is the desk", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", false);
    });
    expect(renderHook(() => useRecordedDeskRole("ward")).result.current).toBe("ward");
  });
});
