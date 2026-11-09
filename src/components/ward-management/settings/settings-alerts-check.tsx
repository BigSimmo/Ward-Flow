"use client";
// Settings round 3 (mock-up, 30 Oct 2026): the Alerts tab. A copy of AlertsPane
// (src/components/ward-management/settings/settings-panes.tsx) with a short readiness card in the
// empty right-hand column. The card does not repeat the switches: it counts how many of the four ways
// an alert reaches this browser are ready, gives the one next step, and sends a test alert. S7
// notifications (Josh, 3 Nov 2026): Browser notifications and Phone alerts are one switch,
// "Alerts on this device", and the test shows here in Ward Flow, plus a browser notification when
// the browser allows one. "Applies now" is plain words, as on the other tabs. Nothing here is stored.

import { useEffect, useState } from "react";
import { Bell, Play, Radar } from "lucide-react";

import type { NotificationSupport } from "@/components/ward-management/shell/ward-act-now-notifications";
import { phonePushRow, standaloneApp, type PhonePushState } from "@/components/ward-management/shell/ward-phone-push";
import { SettingsInstallHint } from "@/components/ward-management/settings/settings-install-hint";
import { DeviceAlertsRow } from "@/components/ward-management/settings/settings-panes";
import { Button, Card, CardHead, SrOnly, StatusGlyph, Switch, buttonClass } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-layout.module.css";
import { SettingRow } from "./settings-rows";
import { SettingsAlertChoices } from "./settings-alert-choices";

export function SettingsAlertsPane({
  notifications,
  permission,
  phonePush,
  onAlertsChange,
  buzz,
  onBuzzChange,
  onTestBuzz,
  showToast,
  phoneQuick = false,
}: {
  notifications: boolean;
  permission: NotificationSupport;
  phonePush: PhonePushState;
  /** The one Alerts switch: turns browser and phone alerts on or off together. */
  onAlertsChange: (next: boolean) => void;
  buzz: boolean;
  onBuzzChange: (next: boolean) => void;
  onTestBuzz: () => void;
  showToast: (message: string, tone?: "info" | "warning") => void;
  /** On a phone Buzz sound is on the page itself, so the sheet leaves it out. */
  phoneQuick?: boolean;
}) {
  // Whether this was opened from the Home Screen is only readable after mount.
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the display mode is only readable after mount
    setInstalled(standaloneApp());
  }, []);

  const browserOn = notifications && permission === "granted";
  const phoneRow = phonePushRow(phonePush);
  const ready = [browserOn, phoneRow.checked, buzz, installed].filter(Boolean).length;
  // One next step: the first thing that would reach the person and is not on.
  const next = !browserOn
    ? permission === "denied"
      ? "Allow notifications for this site in the browser's settings, then turn them on here."
      : permission === "unsupported"
        ? "This browser cannot show notifications. The buzz sound still plays while Ward Flow is open."
        : "Turn on Alerts on this device."
    : !buzz
      ? "Turn on Buzz sound."
      : "Act-now alerts will reach you while Ward Flow is open here.";

  // Always shows in Ward Flow; also as a browser notification when the browser allows one.
  const sendTest = () => {
    let shown = false;
    if (permission === "granted" && typeof Notification !== "undefined") {
      try {
        new Notification("Ward Flow test alert", { body: "Synthetic test. Nothing needs doing." });
        shown = true;
      } catch {
        // The in-app test still shows.
      }
    }
    showToast(shown ? "Test alert shown here and in the browser." : "Test alert shown here. Nothing needs doing.");
  };

  return (
    <>
      <Card aria-labelledby="alerts-title">
        <CardHead iconPlain id="alerts-title" icon={Bell} title="Alerts" />
        <DeviceAlertsRow
          notifications={notifications}
          permission={permission}
          phonePush={phonePush}
          onChange={onAlertsChange}
        />
        <SettingsAlertChoices />
        <SettingsInstallHint />
        {phoneQuick ? null : (
          <SettingRow setting="buzz" title="Buzz sound" sub="Chime on an urgent buzz" testId="setting-buzz-alert-row">
            <button
              type="button"
              className={buttonClass({ variant: "sec", className: styles.pill })}
              onClick={onTestBuzz}
            >
              <Play size={14} aria-hidden="true" />
              Test
            </button>
            <Switch checked={buzz} onCheckedChange={onBuzzChange} label={<SrOnly>Buzz sound</SrOnly>} />
          </SettingRow>
        )}
      </Card>
      <Card aria-labelledby="alerts-check-title" data-setting="alerts-check" data-testid="ward-settings-alerts-check">
        <CardHead
          iconPlain
          id="alerts-check-title"
          icon={Radar}
          title="Will alerts reach you here?"
          meta={`${ready} of 4 ways ready`}
        />
        <p className={rx.checkNext}>
          <StatusGlyph tone={browserOn && buzz ? "success" : "warning"} size={9} />
          {next}
        </p>
        <div className={rx.checkFoot}>
          <Button variant="sec" onClick={sendTest} data-setting="test-alert">
            Send a test alert
          </Button>
        </div>
      </Card>
    </>
  );
}
