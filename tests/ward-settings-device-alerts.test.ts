import { describe, expect, it, vi } from "vitest";
import {
  changeDeviceAlerts,
  type DeviceAlertsDeps,
} from "@/components/ward-management/settings/settings-device-alerts";
import type { PhonePushState } from "@/components/ward-management/shell/ward-phone-push";

function deps(overrides: Partial<DeviceAlertsDeps> = {}) {
  const base: DeviceAlertsDeps = {
    phone: { checked: false, unavailable: false },
    wanted: { current: null },
    setBrowserPreference: vi.fn(),
    enableBrowser: vi.fn(async () => "granted" as const),
    onPermission: vi.fn(),
    setPhone: vi.fn(async (on: boolean): Promise<PhonePushState> => (on ? "on" : "off")),
    toast: vi.fn(),
  };
  return { ...base, ...overrides };
}

describe("the one Alerts on this device switch", () => {
  it("on: browser first, then the phone, and says it works with Ward Flow closed", async () => {
    const d = deps();
    await changeDeviceAlerts(true, d);
    expect(d.setPhone).toHaveBeenCalledWith(true);
    expect(d.toast).toHaveBeenCalledWith("Alerts on, even with Ward Flow closed.");
  });

  it("an off while the phone is still registering takes the phone back off when it lands", async () => {
    // Codex review of #1365: the off must win over a registration already in flight.
    let land: (state: PhonePushState) => void = () => {};
    const shared = { current: null as boolean | null };
    const setPhone = vi.fn((on: boolean) =>
      on ? new Promise<PhonePushState>((resolve) => (land = resolve)) : Promise.resolve<PhonePushState>("off"),
    );
    const on = deps({ wanted: shared, setPhone });
    const pending = changeDeviceAlerts(true, on);
    await vi.waitFor(() => expect(setPhone).toHaveBeenCalledWith(true));

    // While registering, the phone row reads unchecked ("busy").
    const off = deps({ wanted: shared, setPhone, phone: { checked: false, unavailable: true } });
    await changeDeviceAlerts(false, off);
    expect(off.toast).toHaveBeenCalledWith("Alerts off on this device.");

    land("on");
    await pending;
    expect(setPhone).toHaveBeenLastCalledWith(false);
    expect(on.toast).not.toHaveBeenCalled();
  });

  it("off with the phone on removes the phone and says so", async () => {
    const d = deps({ phone: { checked: true, unavailable: false } });
    await changeDeviceAlerts(false, d);
    expect(d.setBrowserPreference).toHaveBeenCalledWith(false);
    expect(d.setPhone).toHaveBeenCalledWith(false);
    expect(d.toast).toHaveBeenCalledWith("Alerts off on this device.");
  });
});
