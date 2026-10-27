import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  resetWardAccessStoreForTests,
  setWardAccess,
  useDeskRoleLabel,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

// The access admin borrows the executive chrome, so the menus read "Executive" for it (Help thread, 26 Oct 2026).
describe("desk name in the menus", () => {
  it("names the access admin desk Access admin, not Executive", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    const { result } = renderHook(() => useDeskRoleLabel("executive"));
    expect(result.current).toBe("Access admin");
  });

  it("keeps the chrome's own name for every other desk", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    });
    const { result } = renderHook(() => useDeskRoleLabel("executive"));
    expect(result.current).toBe("Executive");
  });
});
