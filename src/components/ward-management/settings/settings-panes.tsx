"use client";

import { BellRing, Play } from "lucide-react";

import type { NotificationSupport } from "@/components/ward-management/shell/ward-act-now-notifications";
import { phonePushRow, type PhonePushState } from "@/components/ward-management/shell/ward-phone-push";
import type { WardAppearance } from "@/components/ward-management/shell/ward-shell-types";
import { Card, CardHead, SrOnly, Switch, buttonClass } from "@/components/wf";

import { SettingsInstallHint } from "./settings-install-hint";
import { ScopeLine, SettingRow } from "./settings-rows";

import styles from "./settings.module.css";

/** A switch with its name read from the row beside it. */
function RowSwitch({
  name,
  checked,
  onCheckedChange,
}: {
  name: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return <Switch checked={checked} onCheckedChange={onCheckedChange} label={<SrOnly>{name}</SrOnly>} />;
}

/* Alerts ------------------------------------------------------------------------------------ */

/** Phone states whose own words say what went wrong, so the row shows them as they are. */
const PHONE_NOTES: readonly PhonePushState[] = ["limit", "in-use", "error", "error-on"];

/**
 * S7 notifications (Josh, 3 Nov 2026): one Alerts switch for this device. On means act-now
 * alerts as browser notifications while Ward Flow is open, and phone alerts too where the shared
 * workspace offers them. Either stored switch still counts, so a person who turned on Browser
 * notifications or Phone alerts before keeps alerts on. Each line fits one row at 390px wide.
 */
export function deviceAlertsRow({
  notifications,
  permission,
  phonePush,
}: {
  notifications: boolean;
  permission: NotificationSupport;
  phonePush: PhonePushState;
}): { checked: boolean; unavailable: boolean; phoneReady: boolean; sub: string } {
  const phone = phonePushRow(phonePush);
  const browserOn = notifications && permission === "granted";
  const browserReady = permission !== "unsupported" && permission !== "denied";
  const checked = browserOn || phone.checked;
  const unavailable = !checked && !browserReady && phone.unavailable;
  const sub =
    !checked && permission === "denied"
      ? "Blocked for this site in the browser"
      : PHONE_NOTES.includes(phonePush)
        ? phone.sub
        : unavailable
          ? phonePush === "install"
            ? phone.sub
            : "Not available in this browser"
          : phone.checked
            ? phone.sub
            : browserOn
              ? "Act-now alerts while Ward Flow is open"
              : "New act-now alerts on this device";
  return { checked, unavailable, phoneReady: !phone.unavailable, sub };
}

/** The one Alerts switch. Greyed with a reason only when neither the browser nor the phone can alert. */
export function DeviceAlertsRow({
  notifications,
  permission,
  phonePush,
  onChange,
}: {
  notifications: boolean;
  permission: NotificationSupport;
  phonePush: PhonePushState;
  onChange: (next: boolean) => void;
}) {
  const row = deviceAlertsRow({ notifications, permission, phonePush });
  return (
    <SettingRow setting="device-alerts" title="Alerts on this device" sub={row.sub} testId="setting-device-alerts-row">
      <Switch
        checked={row.checked}
        unavailable={row.unavailable}
        onCheckedChange={(next) => {
          if (!row.unavailable) onChange(next);
        }}
        label={<SrOnly>Alerts on this device</SrOnly>}
      />
    </SettingRow>
  );
}

export function AlertsPane({
  notifications = false,
  notificationPermission = "default",
  phonePush = "local",
  onAlertsChange = () => {},
  buzz,
  onBuzzChange,
  onTestBuzz,
}: {
  /** Stream A, 9 Oct 2026: opt-in browser notifications for new act-now alerts in this tab. */
  notifications?: boolean;
  notificationPermission?: NotificationSupport;
  /** Feature 4, 10 Oct 2026: phone alerts through the shared workspace backend, per device. */
  phonePush?: PhonePushState;
  /** The one Alerts switch (S7, 3 Nov 2026): turns browser and phone alerts on or off together. */
  onAlertsChange?: (next: boolean) => void;
  buzz: boolean;
  onBuzzChange: (next: boolean) => void;
  onTestBuzz: () => void;
}) {
  return (
    <>
      <ScopeLine kind="live" />
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="alerts-title">
            <CardHead iconPlain id="alerts-title" icon={BellRing} title="Alerts" />
            <DeviceAlertsRow
              notifications={notifications}
              permission={notificationPermission}
              phonePush={phonePush}
              onChange={onAlertsChange}
            />
            <SettingsInstallHint />
            <SettingRow setting="buzz" title="Buzz sound" sub="Chime on an urgent buzz" testId="setting-buzz-alert-row">
              <button
                type="button"
                className={buttonClass({ variant: "sec", size: "sm", className: styles.pill })}
                onClick={onTestBuzz}
              >
                <Play size={14} aria-hidden="true" />
                {/* Review 5 Nov 2026: "Test" read as a second test alert beside "Send a test alert". */}
                Play sound
              </button>
              <RowSwitch name="Buzz sound" checked={buzz} onCheckedChange={onBuzzChange} />
            </SettingRow>
          </Card>
        </div>
      </div>
    </>
  );
}

/* Theme ------------------------------------------------------------------------------------- */

/** Theme with a fourth choice for a bright room (audit settings-15, Josh 13 Oct 2026), shown as
 * Bright light since 31 Oct 2026; its stored id stays "glare". It uses the light palette. */
export type ThemeChoice = WardAppearance | "glare";

export const THEME_CHOICES: readonly { id: ThemeChoice; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "glare", label: "Bright light" },
];

/** The Reference card's tabs (settings-reference-card.tsx). */
export type ReferenceTab = "thresholds" | "defaults" | "clinical";
