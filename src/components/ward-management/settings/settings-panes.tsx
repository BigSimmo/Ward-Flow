"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import {
  BellOff,
  BellRing,
  ClipboardList,
  Database,
  Download,
  EyeOff,
  Gauge,
  Info,
  Keyboard,
  Lock,
  Monitor,
  Palette,
  Play,
  ShieldCheck,
  Upload,
  UserRound,
  Wrench,
} from "lucide-react";

import type { NotificationSupport } from "@/components/ward-management/shell/ward-act-now-notifications";
import { phonePushRow, type PhonePushState } from "@/components/ward-management/shell/ward-phone-push";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import type { WardAppearance } from "@/components/ward-management/shell/ward-shell-types";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { OPERATIONAL_DEFAULTS } from "@/components/ward-management/ward-operational-defaults";
import {
  Button,
  Card,
  CardHead,
  FilterChip,
  Kbd,
  Segmented,
  SrOnly,
  StatusGlyph,
  Switch,
  TabPanel,
  Tabs,
  buttonClass,
  cx,
} from "@/components/wf";

import { NOT_WIRED, PreviewTag, ScopeLine, SettingRow } from "./settings-rows";
import { SETTINGS_DEMO_PROFILE } from "./settings-profile";
import type { PublishedThreshold, ThresholdState } from "./settings-thresholds";

import styles from "./settings.module.css";

/** Reports that a Preview control was pressed. The screen answers with the D4 sentence. */
export type OnPreview = (name: string) => void;

/** A switch with its name read from the row beside it. */
function RowSwitch({
  name,
  checked,
  onCheckedChange,
  preview = false,
}: {
  name: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  preview?: boolean;
}) {
  return (
    <Switch checked={checked} onCheckedChange={onCheckedChange} unavailable={preview} label={<SrOnly>{name}</SrOnly>} />
  );
}

/** A Preview segmented control: shows its intended default, says it is not wired when pressed. */
function PreviewSegmented({
  name,
  items,
  value,
  onPreview,
}: {
  name: string;
  items: readonly string[];
  value: string;
  onPreview: OnPreview;
}) {
  return (
    <Segmented
      className={styles.pillSeg}
      label={name}
      items={items.map((item) => ({ id: item, label: item }))}
      value={value}
      unavailable
      onChange={() => onPreview(name)}
    />
  );
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

const ACT_NOW_EVENTS = ["Legal due time in first warning", "Urgent buzz from a ward"] as const;

const OTHER_EVENTS: readonly { readonly name: string; readonly inApp: boolean; readonly sound: boolean }[] = [
  { name: "New referral for my service", inApp: true, sound: true },
  { name: "Ward accepted or declined", inApp: true, sound: false },
  { name: "ED wait over target", inApp: true, sound: true },
  { name: "Held bed about to lapse", inApp: true, sound: false },
  { name: "Transport delayed", inApp: true, sound: false },
  { name: "Ward not answering", inApp: true, sound: false },
];

export function AlertsPane({
  notifications = false,
  notificationPermission = "default",
  onNotificationsChange = () => {},
  phonePush = "local",
  onPhonePushChange = () => {},
  buzz,
  onBuzzChange,
  onTestBuzz,
  onPreview,
}: {
  /** Stream A, 9 Oct 2026: opt-in browser notifications for new act-now alerts in this tab. */
  notifications?: boolean;
  notificationPermission?: NotificationSupport;
  onNotificationsChange?: (next: boolean) => void;
  /** Feature 4, 10 Oct 2026: phone alerts through the shared Azure workspace, per device. */
  phonePush?: PhonePushState;
  onPhonePushChange?: (next: boolean) => void;
  buzz: boolean;
  onBuzzChange: (next: boolean) => void;
  onTestBuzz: () => void;
  onPreview: OnPreview;
}) {
  return (
    <>
      <ScopeLine kind="live" />
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="alerts-title">
            <CardHead
              id="alerts-title"
              icon={BellRing}
              title="Alerts"
              action={
                <span data-setting="snooze">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={BellOff}
                    className={styles.pill}
                    disabledReason={NOT_WIRED}
                    reasonDisplay="tooltip"
                  >
                    Snooze 15m
                  </Button>
                </span>
              }
            />
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
            <SettingRow setting="flash" title="Flash on urgent" sub="Screen edge flashes once" preview>
              <RowSwitch name="Flash on urgent" checked onCheckedChange={() => onPreview("Flash on urgent")} preview />
            </SettingRow>
            <SettingRow setting="buzz-again" title="Buzz again if not seen" sub="Until someone acknowledges" preview>
              <PreviewSegmented
                name="Buzz again if not seen"
                items={["Off", "2m", "5m", "10m"]}
                value="5m"
                onPreview={onPreview}
              />
            </SettingRow>
            <SettingRow setting="quiet-hours" title="Quiet hours" sub="Act now still sounds" preview>
              <span className={styles.mono}>23:00 to 07:00</span>
              <RowSwitch name="Quiet hours" checked={false} onCheckedChange={() => onPreview("Quiet hours")} preview />
            </SettingRow>
            <SettingRow
              setting="shift-summary"
              title="Summary at shift start"
              sub="What changed since you left"
              preview
            >
              <RowSwitch
                name="Summary at shift start"
                checked
                onCheckedChange={() => onPreview("Summary at shift start")}
                preview
              />
            </SettingRow>
          </Card>

          <Card aria-labelledby="live-title">
            <CardHead id="live-title" icon={Monitor} title="Live data and boards" aside={<PreviewTag />} />
            <SettingRow setting="live-lists" title="Live lists" sub="Update every minute" preview="quiet">
              <PreviewSegmented
                name="Live lists"
                items={["Live", "Pause when idle"]}
                value="Live"
                onPreview={onPreview}
              />
            </SettingRow>
            <SettingRow setting="timer-seconds" title="Seconds on timers" sub="Under 10 minutes only" preview="quiet">
              <RowSwitch
                name="Seconds on timers"
                checked
                onCheckedChange={() => onPreview("Seconds on timers")}
                preview
              />
            </SettingRow>
            <SettingRow
              setting="wallboard"
              title="Wallboard refresh"
              sub="Shared ward screens"
              testId="setting-wallboard-refresh-row"
              preview="quiet"
            >
              <PreviewSegmented
                name="Wallboard refresh"
                items={["Off", "15s", "30s", "60s"]}
                value="30s"
                onPreview={onPreview}
              />
            </SettingRow>
          </Card>
        </div>

        <div className={styles.column}>
          <Card aria-labelledby="notify-title" data-setting="notifications">
            <CardHead id="notify-title" icon={BellRing} title="Notifications" aside={<PreviewTag />} />
            <div className={styles.notifyGrid} role="table" aria-label="Notifications">
              <div className={cx(styles.notifyRow, styles.notifyHead)} role="row">
                <span role="columnheader">Tell me when</span>
                <span role="columnheader">In app</span>
                <span role="columnheader">Sound</span>
              </div>
              <div className={styles.notifyGroup} role="row">
                <span role="cell">Act now, always on</span>
              </div>
              {ACT_NOW_EVENTS.map((name) => (
                <div key={name} className={styles.notifyRow} role="row">
                  <span role="rowheader" className={styles.notifyName}>
                    <StatusGlyph tone="danger" size={9} />
                    {name}
                  </span>
                  {["In app", "Sound"].map((channel) => (
                    <span key={channel} role="cell" className={styles.notifyCell}>
                      <span className={styles.locked} title="Act now alerts cannot be turned off">
                        <Lock size={12} aria-hidden="true" />
                        <SrOnly>{`${channel}, always on`}</SrOnly>
                      </span>
                    </span>
                  ))}
                </div>
              ))}
              <div className={styles.notifyGroup} role="row">
                <span role="cell">Everything else</span>
              </div>
              {OTHER_EVENTS.map((event) => (
                <div key={event.name} className={styles.notifyRow} role="row">
                  <span role="rowheader" className={styles.notifyName}>
                    {event.name}
                  </span>
                  <span role="cell" className={styles.notifyCell}>
                    <RowSwitch
                      name={`${event.name}, in app`}
                      checked={event.inApp}
                      onCheckedChange={() => onPreview(`${event.name}, in app`)}
                      preview
                    />
                  </span>
                  <span role="cell" className={styles.notifyCell}>
                    <RowSwitch
                      name={`${event.name}, sound`}
                      checked={event.sound}
                      onCheckedChange={() => onPreview(`${event.name}, sound`)}
                      preview
                    />
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/* Display ----------------------------------------------------------------------------------- */

const SHORTCUTS: readonly { readonly label: string; readonly keys: readonly string[] }[] = [
  { label: "Find a patient", keys: ["Ctrl", "K"] },
  { label: "Find a setting", keys: ["/"] },
  { label: "Open or close the sidebar", keys: ["["] },
  { label: "Close, dismiss", keys: ["Esc"] },
];

export function DisplayPane({
  appearance,
  onAppearanceChange,
  glare,
  onGlareChange,
  railOpen,
  onRailChange,
  reducedMotion,
  onReducedMotionChange,
  highContrast,
  onHighContrastChange,
  onPreview,
}: {
  appearance: WardAppearance;
  onAppearanceChange: (next: WardAppearance) => void;
  glare: boolean;
  onGlareChange: (next: boolean) => void;
  railOpen: boolean;
  onRailChange: (open: boolean) => void;
  reducedMotion: boolean;
  onReducedMotionChange: (next: boolean) => void;
  highContrast: boolean;
  onHighContrastChange: (next: boolean) => void;
  onPreview: OnPreview;
}) {
  return (
    <>
      <ScopeLine kind="live" />
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="display-title">
            <CardHead id="display-title" icon={Palette} title="Display" />
            <SettingRow setting="theme" title="Theme" testId="ward-settings-appearance">
              <Segmented<WardAppearance>
                className={styles.pillSeg}
                label="Theme"
                items={[
                  { id: "light", label: "Light" },
                  { id: "dark", label: "Dark" },
                  { id: "auto", label: "Auto" },
                ]}
                value={appearance}
                onChange={onAppearanceChange}
              />
            </SettingRow>
            <SettingRow
              setting="glare"
              title="Glare mode"
              sub="Stronger contrast for bright rooms"
              testId="ward-settings-glare"
            >
              <RowSwitch name="Glare mode" checked={glare} onCheckedChange={onGlareChange} />
            </SettingRow>
            <SettingRow
              setting="sidebar"
              title="Sidebar"
              sub={railOpen ? "Full, names and counts. Opens this way" : "Compact, icons only. Opens this way"}
              subTestId="ward-settings-rail-now"
              testId="ward-settings-rail"
            >
              <Segmented
                className={styles.pillSeg}
                label="Sidebar"
                items={[
                  { id: "full", label: "Full" },
                  { id: "compact", label: "Compact" },
                ]}
                value={railOpen ? "full" : "compact"}
                onChange={(choice) => onRailChange(choice === "full")}
              />
            </SettingRow>
            <SettingRow setting="text-size" title="Text size" preview>
              <PreviewSegmented name="Text size" items={["S", "M", "L"]} value="M" onPreview={onPreview} />
            </SettingRow>
            <SettingRow setting="density" title="Row density" preview>
              <PreviewSegmented
                name="Row density"
                items={["Comfortable", "Compact"]}
                value="Comfortable"
                onPreview={onPreview}
              />
            </SettingRow>
            <SettingRow setting="touch" title="Touch mode" sub="Larger targets on tablets" preview>
              <PreviewSegmented name="Touch mode" items={["Auto", "On", "Off"]} value="Auto" onPreview={onPreview} />
            </SettingRow>
            <SettingRow setting="reduce-motion" title="Reduce motion" sub="Stops slides and pulses">
              <RowSwitch name="Reduce motion" checked={reducedMotion} onCheckedChange={onReducedMotionChange} />
            </SettingRow>
            <SettingRow setting="high-contrast" title="High contrast" sub="Stronger edges and ink">
              <RowSwitch name="High contrast" checked={highContrast} onCheckedChange={onHighContrastChange} />
            </SettingRow>
          </Card>
        </div>

        <div className={styles.column}>
          <Card aria-labelledby="privacy-title">
            <CardHead id="privacy-title" icon={EyeOff} title="Privacy" aside={<PreviewTag />} />
            <SettingRow
              setting="initials"
              title="Initials only on shared screens"
              sub="Wallboards and projected views"
              preview="quiet"
            >
              <RowSwitch
                name="Initials only on shared screens"
                checked
                onCheckedChange={() => onPreview("Initials only on shared screens")}
                preview
              />
            </SettingRow>
            <SettingRow setting="lock-idle" title="Lock after idle" sub="Returns to a blank board" preview="quiet">
              <PreviewSegmented
                name="Lock after idle"
                items={["5m", "10m", "15m", "Off"]}
                value="10m"
                onPreview={onPreview}
              />
            </SettingRow>
            <SettingRow
              setting="clear-on-close"
              title="Clear session on close"
              sub="Drafts and filters go with the tab"
              preview="quiet"
            >
              <RowSwitch
                name="Clear session on close"
                checked
                onCheckedChange={() => onPreview("Clear session on close")}
                preview
              />
            </SettingRow>
          </Card>

          <Card aria-labelledby="shortcuts-title" data-setting="shortcuts">
            <CardHead id="shortcuts-title" icon={Keyboard} title="Shortcuts" />
            <ul className={styles.shortcuts} aria-label="Keyboard shortcuts">
              {SHORTCUTS.map((shortcut) => (
                <li key={shortcut.label}>
                  <span>{shortcut.label}</span>
                  <span className={styles.keys}>
                    {shortcut.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

/* Profile and shift ------------------------------------------------------------------------- */

/** The sections the printed handover sheet carries, as the Handover screen names them. */
export const HANDOVER_SHEET_SECTIONS = [
  "Act now",
  "Due by the handover",
  "Waiting for a bed",
  "Accepted, bed not ready",
  "Moving",
  "Beds by ward",
  "Discharges held up",
  "Handover signatures",
] as const;

export function ProfilePane({ onPreview }: { onPreview: OnPreview }) {
  const service = useServiceScope();
  return (
    <>
      <ScopeLine kind="live" />
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="profile-title">
            <CardHead id="profile-title" icon={UserRound} title="Profile" />
            <SettingRow setting="role" title="Role" sub="From sign-in once accounts exist">
              <span className={styles.readout}>{SETTINGS_DEMO_PROFILE.role}</span>
            </SettingRow>
            <SettingRow
              setting="service"
              title="Service in view"
              sub="Set from the bar, not saved past this tab"
              testId="ward-settings-default-service"
            >
              <span className={styles.readout}>{service ?? "All services"}</span>
            </SettingRow>
            <SettingRow setting="opens-on" title="Opens on" sub="First screen after sign-in" preview>
              <PreviewSegmented
                name="Opens on"
                items={["Home", "Referrals", "Wards"]}
                value="Home"
                onPreview={onPreview}
              />
            </SettingRow>
            <SettingRow setting="my-shift" title="My shift" sub="Drives handover and quiet hours" preview>
              <PreviewSegmented name="My shift" items={["Day", "Evening", "Night"]} value="Day" onPreview={onPreview} />
            </SettingRow>
            <SettingRow setting="covering" title="Covering for" sub="Their alerts come to you too" preview stacked>
              <span className={styles.chips} role="group" aria-label="Covering for">
                {HEALTH_SERVICES.slice(0, 4).map((name) => (
                  <FilterChip
                    key={name}
                    className={styles.pill}
                    pressed={name === "East Metro"}
                    unavailable
                    onPressedChange={() => onPreview("Covering for")}
                  >
                    {name}
                  </FilterChip>
                ))}
              </span>
            </SettingRow>
          </Card>
        </div>

        <div className={styles.column}>
          <Card aria-labelledby="handover-title" data-testid="ward-settings-handover">
            <CardHead
              id="handover-title"
              icon={ClipboardList}
              title="Handover"
              action={
                <Link
                  className={buttonClass({ variant: "ghost", size: "sm", className: styles.pill })}
                  href="/mockups/ward-flow/handover"
                >
                  Open handover
                </Link>
              }
            />
            <SettingRow setting="handover-sections" title="Sheet sections" sub="Printed and on screen" preview stacked>
              <span className={styles.chips} role="group" aria-label="Sheet sections">
                {HANDOVER_SHEET_SECTIONS.map((section) => (
                  <FilterChip
                    key={section}
                    className={styles.pill}
                    pressed
                    unavailable
                    onPressedChange={() => onPreview("Sheet sections")}
                  >
                    {section}
                  </FilterChip>
                ))}
              </span>
            </SettingRow>
            <SettingRow setting="handover-reminder" title="Remind me before shift end" preview>
              <PreviewSegmented
                name="Remind me before shift end"
                items={["Off", "15m", "30m"]}
                value="15m"
                onPreview={onPreview}
              />
            </SettingRow>
            <SettingRow
              setting="handover-open"
              title="Open handover at shift change"
              sub="07:00, 15:00 and 23:00"
              preview
            >
              <RowSwitch
                name="Open handover at shift change"
                checked={false}
                onCheckedChange={() => onPreview("Open handover at shift change")}
                preview
              />
            </SettingRow>
          </Card>
        </div>
      </div>
    </>
  );
}

/* Data and about ---------------------------------------------------------------------------- */

const THRESHOLD_STATE_WORDS: Record<ThresholdState, string> = {
  "fires-now": "Showing now",
  "nothing-reaches-it": "Nothing reaches it today",
};

export type ReferenceTab = "thresholds" | "defaults";

export function DataPane({
  reference,
  onReferenceChange,
  movementCount,
  eventCount,
  thresholds,
  onExport,
  onImport,
  onClearSession,
  onRestore,
}: {
  /** Held by the screen so Find a setting can open Fixed defaults. */
  reference: ReferenceTab;
  onReferenceChange: (next: ReferenceTab) => void;
  movementCount: number;
  eventCount: number;
  thresholds: readonly PublishedThreshold[];
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearSession: () => void;
  onRestore: () => void;
}) {
  return (
    <>
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="data-title" data-testid="ward-settings-storage-telemetry">
            <CardHead id="data-title" icon={Database} title="Data in this browser" />
            <div className={styles.dataStats}>
              <div>
                <strong className={styles.mono}>{movementCount}</strong>
                <span>Movements held</span>
              </div>
              <div>
                <strong className={styles.mono}>{eventCount}</strong>
                <span>Events recorded this session</span>
              </div>
            </div>
            <div className={styles.dataActions}>
              <button
                type="button"
                className={buttonClass({ variant: "sec", size: "sm", className: styles.pill })}
                onClick={onExport}
                data-setting="export"
                data-testid="btn-export-config"
              >
                <Download size={14} aria-hidden="true" />
                Export
              </button>
              <label
                className={buttonClass({ variant: "sec", size: "sm", className: styles.pill })}
                data-setting="import"
                title="Load a rules file into the draft"
              >
                <Upload size={14} aria-hidden="true" />
                Import
                <input
                  type="file"
                  accept=".json,application/json"
                  className={styles.fileInput}
                  onChange={onImport}
                  data-testid="input-import-config"
                />
              </label>
              <button
                type="button"
                className={buttonClass({ variant: "ghost", size: "sm", className: styles.pill })}
                onClick={onClearSession}
                data-setting="clear-session"
                data-testid="btn-clear-cache"
                title="Clear this tab's saved demo state and drafts"
              >
                Clear session
              </button>
              <button
                type="button"
                className={buttonClass({
                  variant: "danger",
                  size: "sm",
                  className: `${styles.pill} ${styles.pushEnd}`,
                })}
                onClick={onRestore}
                aria-haspopup="dialog"
                data-setting="restore"
                data-testid="btn-restore-baseline"
              >
                Restore all defaults
              </button>
            </div>
            <p className={styles.cardNote}>
              <Wrench size={14} aria-hidden="true" />
              Demo clock, scenario and reset are in Tools in the bar.
            </p>
          </Card>
        </div>
        <div className={styles.column}>
          <Card aria-labelledby="about-title" data-setting="about">
            <CardHead id="about-title" icon={Info} title="About" />
            <dl className={styles.aboutGrid}>
              <div>
                <dt>Records</dt>
                <dd>Synthetic only</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Not a medical device</dd>
              </div>
              <div>
                <dt>Sign-in</dt>
                <dd>Demo profile, no accounts</dd>
              </div>
              <div>
                <dt>Rule saves</dt>
                <dd>Recorded in the audit</dd>
              </div>
            </dl>
            <p className={styles.cardNote}>
              <ShieldCheck size={14} aria-hidden="true" />
              Governance and the full audit
              <Link className={styles.inlineLink} href="/mockups/ward-flow/governance">
                Open
              </Link>
            </p>
          </Card>
        </div>
      </div>

      <Card aria-labelledby="reference-title" data-setting="thresholds">
        <CardHead
          id="reference-title"
          icon={Gauge}
          title="Reference"
          meta="Read only"
          action={
            <Tabs
              label="Reference"
              idPrefix="settings-reference"
              value={reference}
              onChange={onReferenceChange}
              items={[
                { id: "thresholds", label: "Thresholds" },
                { id: "defaults", label: "Fixed defaults", count: OPERATIONAL_DEFAULTS.length },
              ]}
            />
          }
        />
        <TabPanel idPrefix="settings-reference" id="thresholds" hidden={reference !== "thresholds"}>
          <div data-testid="ward-settings-thresholds">
            <p className={styles.cardNote} data-tone="accent">
              Figures here change only through the Rules tab, and every change is recorded.
            </p>
            <div className={styles.tableWrap} role="region" aria-label="Published thresholds" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Figure</th>
                    <th scope="col">Triggers</th>
                    <th scope="col">Right now</th>
                    <th scope="col">Lives in</th>
                    <th scope="col">Set by</th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.map((threshold) => (
                    <tr key={threshold.id} data-testid={`ward-settings-threshold-${threshold.id}`}>
                      <td className={styles.cellStrong}>{threshold.figure}</td>
                      <td>{threshold.triggers}</td>
                      <td data-threshold-state={threshold.state}>
                        <span className={styles.readout}>
                          <StatusGlyph tone={threshold.state === "fires-now" ? "warning" : "neutral"} size={9} />
                          {THRESHOLD_STATE_WORDS[threshold.state]}
                          {threshold.state === "fires-now" ? `, ${threshold.reached}` : null}
                        </span>
                      </td>
                      <td>
                        <code className={styles.code}>{threshold.livesIn}</code>
                      </td>
                      <td>{threshold.setBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabPanel>
        <TabPanel idPrefix="settings-reference" id="defaults" hidden={reference !== "defaults"}>
          <dl className={styles.defaultsGrid} aria-label="Fixed defaults" data-setting="fixed-defaults">
            {OPERATIONAL_DEFAULTS.map((item) => (
              <div key={item.name} data-testid={`ward-settings-operational-default-${item.name}`}>
                <dt>{item.name}</dt>
                <dd>{item.display}</dd>
              </div>
            ))}
          </dl>
        </TabPanel>
      </Card>
    </>
  );
}
