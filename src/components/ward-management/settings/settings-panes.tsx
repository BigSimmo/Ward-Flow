"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import {
  BookOpen,
  BellRing,
  CircleHelp,
  Copy,
  Database,
  Download,
  Gauge,
  Info,
  Keyboard,
  Palette,
  Play,
  ShieldCheck,
  Upload,
  UserRound,
  Wrench,
} from "lucide-react";

import type { NotificationSupport } from "@/components/ward-management/shell/ward-act-now-notifications";
import { phonePushRow, type PhonePushState } from "@/components/ward-management/shell/ward-phone-push";
import { digestHref } from "@/components/ward-management/shell/ward-facade";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { openWardHelp } from "@/components/ward-management/help/ward-help-events";
import { saveTourStep, useTourRole } from "@/components/ward-management/help/ward-help-store";
import type { WardAppearance } from "@/components/ward-management/shell/ward-shell-types";
import { clinicalValueStatusText, formatClinicalFigure } from "@/components/ward-management/ward-clinical-values";
import {
  CLINICAL_VALUE_LIST,
  unsignedClinicalValueCount,
} from "@/components/ward-management/ward-clinical-value-notes";
import { OPERATIONAL_DEFAULTS } from "@/components/ward-management/ward-operational-defaults";
import {
  Button,
  Card,
  CardHead,
  Kbd,
  Segmented,
  SrOnly,
  StatusGlyph,
  Switch,
  TabPanel,
  Tabs,
  buttonClass,
  useIsPhone,
} from "@/components/wf";

import type { RowDensity } from "./row-density";
import { FeatureFlagsCard } from "./feature-flags-card";
import { SettingsInstallHint } from "./settings-install-hint";
import { ScopeLine, SettingRow } from "./settings-rows";
import { useSettingsDeskProfile } from "./settings-desk-profile";
import type { PublishedThreshold, ThresholdState } from "./settings-thresholds";

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

/* Display ----------------------------------------------------------------------------------- */

const SHORTCUTS: readonly { readonly label: string; readonly keys: readonly string[] }[] = [
  { label: "Find a patient", keys: ["Ctrl", "K"] },
  { label: "Find a setting", keys: ["/"] },
  { label: "Open or close the sidebar", keys: ["["] },
  { label: "Close, dismiss", keys: ["Esc"] },
];

/** Theme with Glare as a fourth choice (audit settings-15, Josh 13 Oct 2026). Glare uses light. */
export type ThemeChoice = WardAppearance | "glare";

export const THEME_CHOICES: readonly { id: ThemeChoice; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "glare", label: "Glare" },
];

export function DisplayPane({
  theme,
  onThemeChange,
  railOpen,
  onRailChange,
  reducedMotion,
  onReducedMotionChange,
  highContrast,
  onHighContrastChange,
  rowDensity,
  onRowDensityChange,
  characterShortcuts,
  onCharacterShortcutsChange,
}: {
  theme: ThemeChoice;
  onThemeChange: (next: ThemeChoice) => void;
  railOpen: boolean;
  onRailChange: (open: boolean) => void;
  reducedMotion: boolean;
  onReducedMotionChange: (next: boolean) => void;
  highContrast: boolean;
  onHighContrastChange: (next: boolean) => void;
  rowDensity: RowDensity;
  onRowDensityChange: (next: RowDensity) => void;
  characterShortcuts: boolean;
  onCharacterShortcutsChange: (next: boolean) => void;
}) {
  const tourRole = useTourRole();
  return (
    <>
      <ScopeLine kind="live" />
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="display-title">
            <CardHead iconPlain id="display-title" icon={Palette} title="Display" />
            <SettingRow setting="theme" title="Theme" testId="ward-settings-appearance">
              <Segmented<ThemeChoice>
                className={styles.pillSeg}
                label="Theme"
                items={[...THEME_CHOICES]}
                value={theme}
                onChange={onThemeChange}
              />
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
            <SettingRow setting="density" title="Row density" testId="ward-settings-density">
              <Segmented<RowDensity>
                className={styles.pillSeg}
                label="Row density"
                items={[
                  { id: "comfortable", label: "Comfortable" },
                  { id: "compact", label: "Compact" },
                ]}
                value={rowDensity}
                onChange={onRowDensityChange}
              />
            </SettingRow>
            <SettingRow
              setting="character-shortcuts"
              title="Single-key shortcuts"
              sub="Letters, numbers and punctuation across Ward Flow in this browser. Escape and Ctrl/Cmd+K stay available."
            >
              <RowSwitch
                name="Single-key shortcuts"
                checked={characterShortcuts}
                onCheckedChange={onCharacterShortcutsChange}
              />
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
          <Card aria-labelledby="shortcuts-title" data-setting="shortcuts">
            <CardHead iconPlain id="shortcuts-title" icon={Keyboard} title="Shortcuts" />

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

          <Card aria-labelledby="help-title" data-setting="help">
            <CardHead iconPlain id="help-title" icon={CircleHelp} title="Help and tour" />
            <SettingRow
              setting="help-screen"
              title="Help"
              sub="Your desk's guide, what each screen is for, and a glossary"
            >
              <Button variant="ghost" size="sm" onClick={() => openWardHelp("desk")} data-testid="settings-open-help">
                Open help
              </Button>
            </SettingRow>
            <SettingRow
              setting="tour"
              title="First-run tour"
              sub="Starts by itself once for this desk on this device. Replay it here or from Help."
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Replay starts from the first step, not the step the tour was left at.
                  saveTourStep(tourRole, 0);
                  openWardHelp("tour");
                }}
                data-testid="settings-replay-tour"
              >
                Replay the tour
              </Button>
            </SettingRow>
          </Card>
        </div>
      </div>
    </>
  );
}

/* Profile and shift ------------------------------------------------------------------------- */

export function ProfilePane({ onGoToDesk }: { onGoToDesk: () => void }) {
  const service = useServiceScope();
  const deskProfile = useSettingsDeskProfile();
  return (
    <>
      <ScopeLine kind="live" />
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="profile-title">
            <CardHead iconPlain id="profile-title" icon={UserRound} title="Profile" />
            <SettingRow setting="role" title="Role">
              <span className={styles.readout}>{deskProfile.role}</span>
              {/* Audit settings-27: the role row leads to the desk drawer, not a dead end. */}
              <button
                type="button"
                className={buttonClass({ variant: "sec", size: "sm", className: styles.pill })}
                onClick={onGoToDesk}
                data-setting="go-to-desk"
              >
                Go to a desk
              </button>
            </SettingRow>
            <SettingRow
              setting="service"
              title="Service in view"
              sub="Set from the bar, not saved past this tab"
              testId="ward-settings-default-service"
            >
              <span className={styles.readout}>{service ?? "All services"}</span>
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

export type ReferenceTab = "thresholds" | "defaults" | "clinical";
type PhoneReference = Extract<ReferenceTab, "defaults" | "clinical">;

/** The clinical values on a phone: the desktop table's rows as a list, grouped the same way. */
// D-56 signs values for the prototype only; D-54 still needs clinical governance sign-off for real use.
function ClinicalValuesNote() {
  const unsigned = unsignedClinicalValueCount();
  return (
    <p className={styles.cardNote} data-tone="accent">
      {unsigned === 0
        ? `All ${CLINICAL_VALUE_LIST.length} values are signed for the prototype only.`
        : `${unsigned} of ${CLINICAL_VALUE_LIST.length} values are still synthetic. The rest are signed for the prototype only.`}{" "}
      Every value still needs clinical governance sign-off before real patient use.
    </p>
  );
}

function PhoneClinicalValues() {
  const groups = [...new Set(CLINICAL_VALUE_LIST.map((entry) => entry.group))];
  return (
    <div data-testid="ward-settings-clinical-values-phone" data-setting="clinical-values">
      <ClinicalValuesNote />
      {groups.map((group) => (
        <section key={group} className={styles.phoneClinicalGroup} aria-label={group}>
          <h3 className={styles.phoneClinicalGroupHead}>{group}</h3>
          <dl className={styles.defaultsGrid}>
            {CLINICAL_VALUE_LIST.filter((entry) => entry.group === group).map((entry) => (
              <div
                key={entry.id}
                data-testid={`ward-settings-clinical-value-phone-${entry.id}`}
                data-clinical-status={entry.status}
              >
                <dt>{entry.name}</dt>
                <dd>
                  {formatClinicalFigure(entry.value, entry.unit)}
                  {entry.adjustable ? ", default, changeable in Settings" : null}
                </dd>
                <dd className={styles.phoneClinicalMeta}>
                  <StatusGlyph tone={entry.status === "signed" ? "success" : "neutral"} size={9} />
                  {clinicalValueStatusText(entry)}. {entry.source}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function DataPane({
  reference,
  onReferenceChange,
  movementCount,
  eventCount,
  thresholds,
  onExport,
  onCopyDiagnostics,
  onImport,
  onClearSession,
  onRestore,
  restoreUnavailable,
  importUnavailable,
  shared = false,
}: {
  /** Held by the screen so Find a setting can open Fixed defaults. */
  reference: ReferenceTab;
  onReferenceChange: (next: ReferenceTab) => void;
  movementCount: number | null;
  eventCount: number | null;
  thresholds: readonly PublishedThreshold[] | null;
  onExport: () => void;
  onCopyDiagnostics?: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearSession: () => void;
  onRestore: () => void;
  restoreUnavailable?: string;
  importUnavailable?: string;
  shared?: boolean;
}) {
  // Audit settings-24: the thresholds table is five columns wide, laid out for a tablet or computer.
  const isPhone = useIsPhone();
  // The phone has no thresholds table, so its switch shows Fixed defaults unless Clinical values is picked.
  const phoneReference: PhoneReference = reference === "clinical" ? "clinical" : "defaults";
  return (
    <>
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="data-title" data-testid="ward-settings-storage-telemetry">
            <CardHead iconPlain id="data-title" icon={Database} title="Data in this browser" />
            {movementCount === null || eventCount === null ? (
              <p className={styles.cardNote}>
                <ShieldCheck size={16} aria-hidden="true" />
                <span>
                  <strong>Aggregate reports only</strong>
                  <br />
                  This executive view holds summary reports and public rules. Individual records and session event
                  history are unavailable.
                </span>
              </p>
            ) : (
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
            )}
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
              {onCopyDiagnostics ? (
                <button
                  type="button"
                  className={buttonClass({ variant: "sec", size: "sm", className: styles.pill })}
                  onClick={onCopyDiagnostics}
                  data-setting="copy-diagnostics"
                  data-testid="btn-copy-diagnostics"
                >
                  <Copy size={14} aria-hidden="true" />
                  Copy diagnostics
                </button>
              ) : null}
              {importUnavailable ? (
                <Button
                  variant="sec"
                  size="sm"
                  className={styles.pill}
                  disabledReason={importUnavailable}
                  data-setting="import"
                >
                  <Upload size={14} aria-hidden="true" />
                  Import
                </Button>
              ) : (
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
              )}
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
              <Button
                variant="sec"
                size="sm"
                className={`${styles.pill} ${styles.pushEnd}`}
                onClick={onRestore}
                disabledReason={restoreUnavailable}
                aria-haspopup="dialog"
                data-setting="restore"
                data-testid="btn-restore-baseline"
              >
                Restore all defaults
              </Button>
            </div>
            <p className={styles.cardNote}>
              <Wrench size={14} aria-hidden="true" />
              Demo clock, scenario and reset are in Tools in the bar.
            </p>
          </Card>
        </div>
        <div className={styles.column}>
          <Card aria-labelledby="about-title" data-setting="about">
            <CardHead iconPlain id="about-title" icon={Info} title="About" />
            <dl className={styles.aboutGrid}>
              <div>
                <dt>Records</dt>
                <dd>Synthetic only</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Not approved for clinical use</dd>
              </div>
              {/* A7 (overall review, 20 Oct 2026): moved here from the rail's Menu foot. */}
              <div data-testid="ward-settings-policy-version">
                <dt>Policy</dt>
                <dd>2026.3</dd>
              </div>
              <div>
                <dt>Sign-in</dt>
                <dd>{shared ? "Signed-in shared workspace" : "Local synthetic demo"}</dd>
              </div>
              <div>
                <dt>Rule saves</dt>
                <dd>
                  {thresholds === null
                    ? "Individual audit entries unavailable for executive reporting"
                    : "Recorded in the audit"}
                </dd>
              </div>
            </dl>
            <p className={styles.cardNote}>
              <ShieldCheck size={14} aria-hidden="true" />
              Governance and the full audit
              {thresholds !== null ? (
                <Link className={styles.inlineLink} href="/ward-flow/governance">
                  Open
                </Link>
              ) : (
                <span>Unavailable for executive reporting</span>
              )}
            </p>
            {/* Moved here from Tools (Tools review, 15 Oct 2026): a builder reference, not a ward task. */}
            <p className={styles.cardNote}>
              <BookOpen size={14} aria-hidden="true" />
              Product design reference
              {process.env.NODE_ENV !== "production" ? (
                <a className={styles.inlineLink} href={digestHref()} target="_blank" rel="noopener noreferrer">
                  Ward Flow Digest
                </a>
              ) : (
                <span>Ward Flow Digest is available in the local development preview.</span>
              )}
            </p>
          </Card>
        </div>
      </div>

      <FeatureFlagsCard />

      <Card aria-labelledby="reference-title" data-setting="thresholds">
        <CardHead
          iconPlain
          id="reference-title"
          icon={Gauge}
          title="Reference"
          meta="Read only"
          action={
            isPhone ? undefined : (
              <Tabs
                label="Reference"
                idPrefix="settings-reference"
                value={reference}
                onChange={onReferenceChange}
                items={[
                  { id: "thresholds", label: "Thresholds" },
                  { id: "defaults", label: "Fixed defaults", count: OPERATIONAL_DEFAULTS.length },
                  { id: "clinical", label: "Clinical values", count: CLINICAL_VALUE_LIST.length },
                ]}
              />
            )
          }
        />
        {isPhone ? (
          <>
            <p className={styles.cardNote} data-testid="ward-settings-thresholds-phone">
              The thresholds table is laid out for a tablet or computer.
            </p>
            {/* Josh, 15 Oct 2026 (phone mockup B): a two-way switch swaps Fixed defaults for the
                clinical values, listed in the desktop table's groups. Phone only. */}
            <Segmented<PhoneReference>
              label="Reference list"
              size="md"
              className={styles.phoneReferenceSwitch}
              value={phoneReference}
              onChange={onReferenceChange}
              items={[
                { id: "defaults", label: "Fixed defaults" },
                { id: "clinical", label: "Clinical values", count: CLINICAL_VALUE_LIST.length },
              ]}
            />
            {phoneReference === "clinical" ? <PhoneClinicalValues /> : null}
          </>
        ) : null}
        <TabPanel idPrefix="settings-reference" id="thresholds" hidden={isPhone || reference !== "thresholds"}>
          {thresholds === null ? (
            <p className={styles.cardNote} data-testid="ward-settings-thresholds-unavailable">
              Record-based threshold status unavailable. Executive reporting does not expose the individual records used
              to calculate “right now” threshold rows. All twelve public rule values remain available in Rules.
            </p>
          ) : (
            <div data-testid="ward-settings-thresholds">
              <p className={styles.cardNote} data-tone="accent">
                Figures here change only in Rules, and every change is recorded.
              </p>
              <div className={styles.tableWrap} role="region" aria-label="Published thresholds" tabIndex={0}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Figure</th>
                      <th scope="col">Triggers</th>
                      <th scope="col">Right now</th>
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
                        <td>{threshold.setBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabPanel>
        <TabPanel idPrefix="settings-reference" id="clinical" hidden={isPhone || reference !== "clinical"}>
          {/* Josh, 15 Oct 2026 (item 6): every clinical value with its status, read from
              `ward-clinical-values.ts`. Read only; a value is signed in that file, never here. */}
          <div data-testid="ward-settings-clinical-values" data-setting="clinical-values">
            <ClinicalValuesNote />
            <div className={styles.tableWrap} role="region" aria-label="Clinical values" tabIndex={0}>
              <table className={styles.table}>
                <caption className={styles.srOnly}>Clinical values and sign-off status</caption>
                <thead>
                  <tr>
                    <th scope="col">Rule</th>
                    <th scope="col">Value</th>
                    <th scope="col">Status</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {CLINICAL_VALUE_LIST.map((entry) => (
                    <tr
                      key={entry.id}
                      data-testid={`ward-settings-clinical-value-${entry.id}`}
                      data-clinical-status={entry.status}
                    >
                      <td className={styles.cellStrong}>{entry.name}</td>
                      <td className={styles.mono}>
                        {formatClinicalFigure(entry.value, entry.unit)}
                        {entry.adjustable ? ", default, changeable in Settings" : null}
                      </td>
                      <td>
                        <span className={styles.readout}>
                          <StatusGlyph tone={entry.status === "signed" ? "success" : "neutral"} size={9} />
                          {clinicalValueStatusText(entry)}
                        </span>
                      </td>
                      <td>{entry.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabPanel>
        <TabPanel
          idPrefix="settings-reference"
          id="defaults"
          hidden={isPhone ? phoneReference !== "defaults" : reference !== "defaults"}
        >
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
