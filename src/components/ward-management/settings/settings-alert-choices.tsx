"use client";
// Item 20, smart alerts (Josh, 9 Nov 2026): which alerts this desk gets on this device, and quiet
// hours overnight. Rows sit under "Alerts on this device" in the Alerts card. Act now always comes
// through; the rules live in shell/ward-alert-preferences.ts.

import { Segmented, SrOnly, Switch } from "@/components/wf";
import { useAccessShellRole } from "@/components/ward-management/shell/ward-access-store";
import {
  deskSeesStaffRequests,
  QUIET_HOURS_PRESETS,
  quietHoursText,
  useAlertPreferences,
} from "@/components/ward-management/shell/ward-alert-preferences";
import { WARD_SHELL_ROLE } from "@/components/ward-management/ward-chrome-role";

import { SettingRow } from "./settings-rows";

const presetLabel = (start: number, end: number) => quietHoursText({ start, end }).replace(" to ", "–");

export function SettingsAlertChoices() {
  const role = useAccessShellRole(WARD_SHELL_ROLE);
  const [preferences, setPreferences] = useAlertPreferences(role);
  const { quiet } = preferences;
  const preset =
    QUIET_HOURS_PRESETS.find((choice) => choice.start === quiet.start && choice.end === quiet.end)?.id ??
    QUIET_HOURS_PRESETS[1].id;

  return (
    <>
      <SettingRow
        setting="alerts-due-soon"
        title="Due soon too"
        sub="Amber alerts as well as act now"
        testId="setting-alerts-due-soon-row"
      >
        <Switch
          checked={preferences.dueSoon}
          onCheckedChange={(next) => setPreferences({ ...preferences, dueSoon: next })}
          label={<SrOnly>Due soon too</SrOnly>}
        />
      </SettingRow>
      {deskSeesStaffRequests(role) ? (
        <SettingRow
          setting="alerts-staff-requests"
          title="Staff requests"
          sub="When a ward logs that it needs more staff"
          testId="setting-alerts-staff-row"
        >
          <Switch
            checked={preferences.staffRequests}
            onCheckedChange={(next) => setPreferences({ ...preferences, staffRequests: next })}
            label={<SrOnly>Staff requests</SrOnly>}
          />
        </SettingRow>
      ) : null}
      <SettingRow
        setting="alerts-quiet-hours"
        title="Quiet hours"
        sub={
          quiet.on
            ? `${quietHoursText(quiet)}. Act now still comes through.`
            : "Hold other alerts overnight. Act now always comes through."
        }
        subTestId="setting-alerts-quiet-sub"
        testId="setting-alerts-quiet-row"
      >
        <Switch
          checked={quiet.on}
          onCheckedChange={(next) => setPreferences({ ...preferences, quiet: { ...quiet, on: next } })}
          label={<SrOnly>Quiet hours</SrOnly>}
        />
      </SettingRow>
      {quiet.on ? (
        <SettingRow setting="alerts-quiet-window" title="Quiet window" testId="setting-alerts-quiet-window-row">
          <Segmented
            label="Quiet hours"
            value={preset}
            items={QUIET_HOURS_PRESETS.map((choice) => ({
              id: choice.id,
              label: presetLabel(choice.start, choice.end),
            }))}
            onChange={(id) => {
              const choice = QUIET_HOURS_PRESETS.find((item) => item.id === id);
              if (choice) setPreferences({ ...preferences, quiet: { on: true, start: choice.start, end: choice.end } });
            }}
          />
        </SettingRow>
      ) : null}
    </>
  );
}
