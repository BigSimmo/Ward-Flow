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

/**
 * Phone alerts for this device. Always shown: when unavailable it greys out and says why (local
 * demonstration, not signed in, browser or server not set up, or notifications blocked).
 */
function PhonePushRow({ state, onChange }: { state: PhonePushState; onChange: (next: boolean) => void }) {
  const row = phonePushRow(state);
  return (
    <SettingRow setting="phone-alerts" title="Phone alerts" sub={row.sub} testId="setting-phone-alerts-row">
      <Switch
        checked={row.checked}
        unavailable={row.unavailable}
        onCheckedChange={(next) => {
          if (!row.unavailable) onChange(next);
        }}
        label={<SrOnly>Phone alerts</SrOnly>}
      />
    </SettingRow>
  );
}

export function AlertsPane({
  notifications = false,
  notificationPermission = "default",
  onNotificationsChange = () => {},
  phonePush = "local",
  onPhonePushChange = () => {},
  buzz,
  onBuzzChange,
  onTestBuzz,
}: {
  /** Stream A, 9 Oct 2026: opt-in browser notifications for new act-now alerts in this tab. */
  notifications?: boolean;
  notificationPermission?: NotificationSupport;
  onNotificationsChange?: (next: boolean) => void;
  /** Feature 4, 10 Oct 2026: phone alerts through the shared workspace backend, per device. */
  phonePush?: PhonePushState;
  onPhonePushChange?: (next: boolean) => void;
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
            <SettingRow
              setting="browser-notifications"
              title="Browser notifications"
              sub={
                notificationPermission === "unsupported"
                  ? "Not available in this browser"
                  : notificationPermission === "denied"
                    ? "Blocked for this site in the browser"
                    : "New act-now alerts, while this tab is open"
              }
              testId="setting-browser-notifications-row"
            >
              <Switch
                checked={notifications && notificationPermission === "granted"}
                onCheckedChange={onNotificationsChange}
                label={<SrOnly>Browser notifications</SrOnly>}
              />
            </SettingRow>
            <PhonePushRow state={phonePush} onChange={onPhonePushChange} />
            <SettingsInstallHint />
            <SettingRow setting="buzz" title="Buzz sound" sub="Chime on an urgent buzz" testId="setting-buzz-alert-row">
              <button
                type="button"
                className={buttonClass({ variant: "sec", size: "sm", className: styles.pill })}
                onClick={onTestBuzz}
              >
                <Play size={14} aria-hidden="true" />
                Test
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
