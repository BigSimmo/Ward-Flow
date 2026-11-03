// S7 notifications (Josh, 3 Nov 2026): one "Alerts on this device" switch for browser and phone
// alerts. This is its on and off flow, kept apart from the screen so the order of the two answers
// can be tested.

import type { NotificationSupport } from "@/components/ward-management/shell/ward-act-now-notifications";
import type { PhonePushState } from "@/components/ward-management/shell/ward-phone-push";

export type DeviceAlertsDeps = {
  /** The phone row as it reads when the switch is pressed. */
  phone: { checked: boolean; unavailable: boolean };
  /**
   * The latest on or off asked of the switch, shared across presses. A phone registration still
   * running when the person switches off must not leave phone alerts on (Codex review, #1365).
   */
  wanted: { current: boolean | null };
  setBrowserPreference: (enabled: boolean) => void;
  enableBrowser: () => Promise<NotificationSupport>;
  onPermission: (answer: NotificationSupport) => void;
  setPhone: (enabled: boolean) => Promise<PhonePushState>;
  toast: (words: string) => void;
};

export async function changeDeviceAlerts(next: boolean, deps: DeviceAlertsDeps): Promise<void> {
  const { phone, wanted, toast } = deps;
  wanted.current = next;
  if (!next) {
    deps.setBrowserPreference(false);
    // A registration still in flight is undone when it lands, below.
    if (!phone.checked) {
      toast("Alerts off on this device.");
      return;
    }
    const answer = await deps.setPhone(false);
    toast(answer === "off" ? "Alerts off on this device." : "Phone alerts could not be changed. Try again.");
    return;
  }
  // Browser first, while the tap still counts as a user action; the phone then reuses its answer.
  const answer = await deps.enableBrowser();
  deps.onPermission(answer);
  const phoneAnswer = answer === "granted" && !phone.unavailable && !phone.checked ? await deps.setPhone(true) : null;
  if (wanted.current === false) {
    // Switched off while this was running: take the phone back off, and say nothing more, because
    // the off already said "Alerts off on this device."
    if (phoneAnswer === "on") await deps.setPhone(false);
    return;
  }
  toast(
    phoneAnswer === "on"
      ? "Alerts on, even with Ward Flow closed."
      : answer === "granted"
        ? "Alerts on while Ward Flow is open."
        : answer === "unsupported"
          ? "This browser cannot show notifications."
          : "Notifications are blocked for this site in the browser.",
  );
}
