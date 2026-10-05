"use client";

import { useState } from "react";

import { applyAppearance, useAppearanceStore } from "@/components/ward-management/shell/ward-bar";
import { setRailOpenPreference, useRailOpenStore } from "@/components/ward-management/shell/ward-rail";
import type { WardAppearance } from "@/components/ward-management/shell/ward-shell-types";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { defaultWardConfiguration, type WardConfiguration } from "@/components/ward-management/ward-configuration";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_RANGE_MINUTES,
  PARALLEL_REFERRAL_CAP_RANGE,
  PULL_HOLD_RANGE_MINUTES,
} from "@/components/ward-management/ward-model";
import {
  DUE_SOON_RANGE_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
  OPERATIONAL_DEFAULTS,
} from "@/components/ward-management/ward-operational-defaults";

import {
  KpiStrip,
  Panel,
  Pill,
  ProposalHeader,
  ProposalPreviewBar,
  Segmented,
  Verdict,
} from "./oversight-proposal-parts";
import styles from "./oversight-proposal.module.css";

type Key = keyof WardConfiguration;

const clockTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The six shared thresholds, in the words a coordinator would use. One row per engine field. */
const THRESHOLDS: {
  key: Key;
  name: string;
  help: string;
  range: { min: number; max: number; step: number };
  show: (value: number) => string;
}[] = [
  {
    key: "dueSoonUrgentMinutes",
    name: "First warning before a typed legal form expiry",
    help: "A form is shown as urgent from this long before the expiry typed from the paper form.",
    range: DUE_SOON_URGENT_RANGE_MINUTES,
    show: (value) => splitDuration(value),
  },
  {
    key: "dueSoonMinutes",
    name: "Second warning before a typed legal form expiry",
    help: "A form is shown as due soon from this long before the typed expiry. Always longer than the first warning.",
    range: DUE_SOON_RANGE_MINUTES,
    show: (value) => splitDuration(value),
  },
  {
    key: "edAccessTargetMinutes",
    name: "Emergency department access target",
    help: "A departmental performance line, counted from arrival. Not a legal limit.",
    range: ED_ACCESS_TARGET_RANGE_MINUTES,
    show: (value) => splitDuration(value),
  },
  {
    key: "pullHoldMinutes",
    name: "How long a pulled bed is held",
    help: "A bed given to someone who has not arrived is released after this long.",
    range: PULL_HOLD_RANGE_MINUTES,
    show: (value) => splitDuration(value),
  },
  {
    key: "parallelReferralCap",
    name: "Wards one referral can go to at once",
    help: "The most wards a single referral may be sent to in one step. Can only be lowered from the default.",
    range: PARALLEL_REFERRAL_CAP_RANGE,
    show: (value) => `${value} ${value === 1 ? "ward" : "wards"}`,
  },
  {
    key: "morningRollupDeadlineMinutes",
    name: "Morning bed census time",
    help: "When wards are asked to confirm their beds each morning. Your practice default, not a legal limit.",
    range: MORNING_ROLLUP_TIME_RANGE_MINUTES,
    show: clockTime,
  },
];

const SECTIONS = [
  { id: "appearance", label: "Appearance" },
  { id: "thresholds", label: "Shared thresholds" },
  { id: "fixed", label: "Fixed defaults" },
] as const;

export function SettingsProposal() {
  const { configuration, dispatch, rejections } = useWardFlow();
  const now = useWardFlowClock();
  const appearance = useAppearanceStore();
  const railOpen = useRailOpenStore();
  const defaults = defaultWardConfiguration();
  const [draft, setDraft] = useState<WardConfiguration>(configuration);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [query, setQuery] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const unsaved = THRESHOLDS.filter((row) => draft[row.key] !== configuration[row.key]);
  const notDefault = THRESHOLDS.filter((row) => configuration[row.key] !== defaults[row.key]);
  const lastRefusal = rejections.findLast((entry) => entry.attempted === "SET_CONFIGURATION");
  const fixed = OPERATIONAL_DEFAULTS.filter((row) =>
    `${row.name} ${row.display}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const bounded = (key: Key, value: number) => {
    const row = THRESHOLDS.find((entry) => entry.key === key)!;
    let max = row.range.max;
    let min = row.range.min;
    // The engine refuses a first warning that is not shorter than the second; never offer one.
    if (key === "dueSoonUrgentMinutes") max = Math.min(max, draft.dueSoonMinutes - row.range.step);
    if (key === "dueSoonMinutes") min = Math.max(min, draft.dueSoonUrgentMinutes + row.range.step);
    return { min, max, ok: value >= min && value <= max };
  };
  const step = (key: Key, direction: 1 | -1) => {
    const row = THRESHOLDS.find((entry) => entry.key === key)!;
    const next = draft[key] + direction * row.range.step;
    if (bounded(key, next).ok) setDraft({ ...draft, [key]: next });
  };
  const save = (payload: WardConfiguration) => {
    dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now, payload });
    setDraft(payload);
    setSavedAt(now);
    setConfirmRestore(false);
  };

  return (
    <>
      <ProposalPreviewBar active="settings" />
      <main id="main-content" className={styles.page} data-testid="settings-proposal">
        <ProposalHeader
          crumb="Ward Flow"
          title="Settings"
          subtitle="Your display choices and the warning thresholds every screen shares. Nothing here changes how any patient is treated."
        />

        <Verdict
          attention={[
            ...(unsaved.length > 0
              ? [{ tone: "warn" as const, label: `${unsaved.length} unsaved change${unsaved.length === 1 ? "" : "s"}` }]
              : []),
            ...notDefault.map((row) => ({
              tone: "accent" as const,
              label: `${row.name}: ${row.show(configuration[row.key])}`,
            })),
          ]}
        >
          {notDefault.length === 0 ? (
            <>
              <strong>Every shared threshold is at its default.</strong> Changes here apply to every screen for everyone
              in this session, and each one is recorded.
            </>
          ) : (
            <>
              <strong>
                {notDefault.length} of {THRESHOLDS.length} shared thresholds differ from the default.
              </strong>{" "}
              They apply to every screen, and each change is recorded in Governance.
            </>
          )}
        </Verdict>

        <KpiStrip
          label="Settings summary"
          items={[
            {
              label: "Theme",
              value: appearance === "auto" ? "Auto" : appearance === "dark" ? "Dark" : "Light",
              note: "This browser only",
            },
            {
              label: "Changed thresholds",
              value: notDefault.length,
              note: `Of ${THRESHOLDS.length} shared`,
              tone: notDefault.length ? "warn" : undefined,
            },
            {
              label: "Unsaved",
              value: unsaved.length,
              tone: unsaved.length ? "warn" : undefined,
              note: "Saved changes apply to every screen",
            },
            { label: "Fixed defaults", value: OPERATIONAL_DEFAULTS.length, note: "Read only in this prototype" },
          ]}
        />

        <div className={styles.sideNav}>
          <nav className={`${styles.panel} ${styles.sticky}`} aria-label="Settings sections">
            <ul className={styles.navList}>
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a className={styles.navButton} href={`#${section.id}`}>
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.stack}>
            <div id="appearance">
              <Panel title="Appearance" question="Kept in this browser only. Other people are not affected." flush>
                <div className={styles.setting}>
                  <div>
                    <p className={styles.settingName}>Theme</p>
                    <p className={styles.settingHelp}>Auto follows your device&apos;s light or dark setting.</p>
                  </div>
                  <Segmented<WardAppearance>
                    label="Theme"
                    value={appearance}
                    onChange={applyAppearance}
                    options={[
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                      { value: "auto", label: "Auto" },
                    ]}
                  />
                </div>
                <div className={styles.setting}>
                  <div>
                    <p className={styles.settingName}>Sidebar</p>
                    <p className={styles.settingHelp}>
                      Show the full sidebar, or icons only to give the screen more room.
                    </p>
                  </div>
                  <Segmented
                    label="Sidebar"
                    value={railOpen ? "open" : "closed"}
                    onChange={(value) => setRailOpenPreference(value === "open")}
                    options={[
                      { value: "open", label: "Full" },
                      { value: "closed", label: "Icons only" },
                    ]}
                  />
                </div>
                <div className={styles.setting}>
                  <div>
                    <p className={styles.settingName}>Motion</p>
                    <p className={styles.settingHelp}>
                      Ward Flow follows your device&apos;s reduce-motion setting. There is no separate switch here.
                    </p>
                  </div>
                  <Pill>Follows device</Pill>
                </div>
              </Panel>
            </div>

            <div id="thresholds">
              <Panel
                title="Shared thresholds"
                question="These change what every screen shows as due, late or held. They are your defaults, not legal limits."
                meta={notDefault.length === 0 ? "All at default" : `${notDefault.length} changed`}
                flush
              >
                {THRESHOLDS.map((row) => {
                  const value = draft[row.key];
                  const changed = value !== configuration[row.key];
                  const limits = bounded(row.key, value);
                  return (
                    <div key={row.key} className={`${styles.setting} ${changed ? styles.changed : ""}`}>
                      <div>
                        <p className={styles.settingName}>{row.name}</p>
                        <p className={styles.settingHelp}>{row.help}</p>
                        <p className={styles.note}>
                          Default {row.show(defaults[row.key])} · allowed {row.show(limits.min)} to{" "}
                          {row.show(limits.max)}
                          {changed ? ` · saved ${row.show(configuration[row.key])}` : ""}
                        </p>
                      </div>
                      <div className={styles.stepper}>
                        <button
                          type="button"
                          aria-label={`Lower ${row.name}`}
                          disabled={!bounded(row.key, value - row.range.step).ok}
                          onClick={() => step(row.key, -1)}
                        >
                          −
                        </button>
                        <output className={styles.stepperValue} aria-live="polite" aria-label={row.name}>
                          {row.show(value)}
                        </output>
                        <button
                          type="button"
                          aria-label={`Raise ${row.name}`}
                          disabled={!bounded(row.key, value + row.range.step).ok}
                          onClick={() => step(row.key, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className={styles.panelFoot}>
                  {confirmRestore ? (
                    <span className={styles.toolbar}>
                      <span>Restore all six thresholds to their defaults for everyone?</span>
                      <button
                        type="button"
                        className={`${styles.button} ${styles.buttonDanger}`}
                        onClick={() => save(defaults)}
                      >
                        Restore defaults
                      </button>
                      <button type="button" className={styles.button} onClick={() => setConfirmRestore(false)}>
                        Keep current
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.button}
                      disabled={notDefault.length === 0 && unsaved.length === 0}
                      onClick={() => setConfirmRestore(true)}
                    >
                      Restore defaults…
                    </button>
                  )}
                  {lastRefusal && savedAt !== null && lastRefusal.at >= savedAt ? (
                    <span className={styles.toneDanger}>
                      The last save was refused, so nothing changed. Check the values and try again.
                    </span>
                  ) : savedAt !== null ? (
                    <span>Saved. Every screen now uses these values.</span>
                  ) : null}
                </div>
              </Panel>
            </div>

            {unsaved.length > 0 ? (
              <div className={styles.saveBar} role="region" aria-label="Unsaved changes">
                <span>
                  <strong>{unsaved.length} unsaved:</strong> {unsaved.map((row) => row.name).join(", ")}
                </span>
                <span className={styles.toolbar}>
                  <button type="button" className={styles.button} onClick={() => setDraft(configuration)}>
                    Discard
                  </button>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonPrimary}`}
                    onClick={() => save(draft)}
                  >
                    Save for everyone
                  </button>
                </span>
              </div>
            ) : null}

            <div id="fixed">
              <Panel
                title="Fixed defaults"
                question="Built into this prototype and read only. Each is a working default, not a legal limit."
                meta={
                  <input
                    className={styles.input}
                    type="search"
                    aria-label="Filter fixed defaults"
                    placeholder="Filter, for example ‘hold’"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                }
                flush
              >
                {fixed.length === 0 ? (
                  <div className={styles.panelBody}>
                    <p className={styles.empty}>No fixed default matches that filter.</p>
                  </div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Default</th>
                        <th scope="col">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixed.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>
                            <strong>{row.display}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
