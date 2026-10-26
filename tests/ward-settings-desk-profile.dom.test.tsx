import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useSettingsDeskProfile } from "@/components/ward-management/settings/settings-desk-profile";
import { SETTINGS_DEMO_PROFILE } from "@/components/ward-management/settings/settings-profile";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { ACCESS_ROLE_LABELS } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const wrapper = ({ children }: { children: ReactNode }) => (
  <WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>
);

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

// #788: Settings named every role "Bed coordinator, Perth Central Desk, Dr S. Chen".
// #790: one desk had different role names in the banner, the rail and Settings.
describe("Settings profile follows the desk (#788, #790)", () => {
  it("keeps the demo profile for the statewide coordinator", () => {
    const { result } = renderHook(() => useSettingsDeskProfile(), { wrapper });
    expect(result.current.name).toBe(SETTINGS_DEMO_PROFILE.name);
  });

  it("names a ward desk by its own role and ward, not the coordinator", () => {
    const unit = seedWardFlowState().units[0];
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [unit.id] } });
    });
    const { result } = renderHook(() => useSettingsDeskProfile(), { wrapper });
    expect(result.current.role).toBe(ACCESS_ROLE_LABELS.ward);
    expect(result.current.location).toContain(unit.name);
    expect(result.current.name).not.toBe(SETTINGS_DEMO_PROFILE.name);
    expect(result.current.location).not.toBe(SETTINGS_DEMO_PROFILE.location);
  });

  it("names an access admin as an access admin, not the executive", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    const { result } = renderHook(() => useSettingsDeskProfile(), { wrapper });
    expect(result.current.role).toBe("Access admin");
    expect(result.current.name).toBe("Access admin");
  });

  it("gives the coordinator one name everywhere", () => {
    expect(ACCESS_ROLE_LABELS.coordinator).toBe(SETTINGS_DEMO_PROFILE.role);
  });
});
