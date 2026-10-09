"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  Bell,
  Check,
  Clock,
  Database,
  Gavel,
  History,
  Layers,
  Palette,
  Search,
  SlidersHorizontal,
  Timer,
  UserRound,
} from "lucide-react";

import { useWardAccessibilityPreference } from "@/components/ward-management/shell/ward-accessibility";
import { applyAppearance, useAppearanceStore } from "@/components/ward-management/shell/ward-bar";
import { setRailOpenPreference, useRailOpenStore } from "@/components/ward-management/shell/ward-rail";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  playSyntheticUrgentChime,
  setAudioBuzzPreference,
  useAudioBuzzPreference,
} from "@/components/ward-management/shell/ward-sound-store";
import type { AuditEvent } from "@/components/ward-management/ward-audit";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import {
  defaultWardConfiguration,
  validateConfiguration,
  type WardConfiguration,
} from "@/components/ward-management/ward-configuration";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import {
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_MINUTES,
  MORNING_ROLLUP_TIME_RANGE_MINUTES,
  PARALLEL_REFERRAL_CAP_RANGE,
  PULL_HOLD_RANGE_MINUTES,
} from "@/components/ward-management/ward-model";
import {
  BED_HOLD_EXPIRY_MINUTES,
  DECISION_TARGET_RANGE_MINUTES,
  DUE_SOON_MINUTES,
  DUE_SOON_RANGE_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
  OCCUPANCY_ALERT_PERCENT,
  OVERDUE_AFTER_MINUTES_BY_TIER,
  WARD_ANSWER_TARGET_MINUTES,
  SILENT_WARD_FIRST_REMINDER_MINUTES,
  TRANSFER_ACCEPTANCE_TARGET_MINUTES,
  TRANSPORT_BOOKED_TARGET_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { DECISION_TARGET_STEPS } from "@/components/ward-management/ward-decision-targets";
import {
  enableActNowNotifications,
  notificationSupport,
  setActNowNotificationPreference,
  useActNowNotificationPreference,
  type NotificationSupport,
} from "@/components/ward-management/shell/ward-act-now-notifications";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  Hero,
  HeroStat,
  HeroTrack,
  Kbd,
  Segmented,
  StatusGlyph,
  buttonClass,
  cx,
  type WfTone,
} from "@/components/wf";

import { OperatorSwitcherModal } from "./operator-switcher-modal";
import { ResetBaselineModal } from "./reset-baseline-modal";
import { AlertsPane, DataPane, DisplayPane, ProfilePane, type ReferenceTab } from "./settings-panes";
import { NOT_WIRED, PreviewTag, RuleRow, ScopeLine, SettingRow } from "./settings-rows";
import { SETTINGS_TABS, findSettings, type SettingsSearchEntry, type SettingsTab } from "./settings-search-index";
import { SETTINGS_DEMO_PROFILE } from "./settings-profile";
import { publishedThresholds } from "./settings-thresholds";

import styles from "./settings.module.css";

/**
 * 🔴 **SETTINGS — AND THE ONE RULE THAT DECIDES WHAT IS ON IT: A CONTROL THAT WRITES STATE NOTHING
 * READS IS WORSE THAN A MISSING CONTROL.**
 *
 * Rebuilt as workspaces on 8 Oct 2026 (Josh picked the Workspaces mockup). A profile band carries
 * the tabs and Find a setting; each tab says once whether its changes wait for Save or apply at
 * once; one save bar holds every unsaved rule on every tab.
 *
 * Wired: the six coordination rules (draft, then `SET_CONFIGURATION`, each save audited), theme,
 * sidebar, reduce motion, high contrast, buzz sound, export, import, clear session and restore.
 * Everything marked Preview is shown for review only: each such control is `aria-disabled`, stays
 * focusable, and says "Not wired in this prototype." (D4) when pressed.
 *
 * ⚠️ **NO DEMONSTRATION CONTROL BELONGS ON THIS SCREEN.** Owner ruling Q-7 puts the clock, the
 * scenario and Reset in the Tools drawer; the Data tab says so in words.
 */

const TAB_ICONS = {
  rules: Clock,
  alerts: Bell,
  display: Palette,
  profile: UserRound,
  data: Database,
} as const;

/** 24-hour clock time, `HH:MM`, for the morning count. */
function clock24(minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60);
  const mins = minutesFromMidnight % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Compact duration for rule values: "45m", "4h", "1h 15m". */
function shortDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function wardsText(count: number): string {
  return `${count} ${count === 1 ? "ward" : "wards"}`;
}

/**
 * The first due-time warning (`dueSoonUrgentMinutes`) must stay before the second
 * (`dueSoonMinutes`) or `validateConfiguration` refuses the save. Always adjusts the first value
 * down to one of its own steps below the second, whichever control changed.
 */
function clampDueSoonUrgent(urgentCandidate: number, soonValue: number): number {
  const withinOwnRange = Math.max(
    DUE_SOON_URGENT_RANGE_MINUTES.min,
    Math.min(DUE_SOON_URGENT_RANGE_MINUTES.max, urgentCandidate),
  );
  return Math.min(withinOwnRange, soonValue - DUE_SOON_URGENT_RANGE_MINUTES.step);
}

/** The six rules with optional fields filled in, so drafts compare like for like. */
function fullRules(value: WardConfiguration) {
  return {
    ed: value.edAccessTargetMinutes,
    cap: value.parallelReferralCap,
    hold: value.pullHoldMinutes,
    morning: value.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES,
    urgent: value.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES,
    soon: value.dueSoonMinutes ?? DUE_SOON_MINUTES,
    referralTarget: value.referralDecisionTargetMinutes ?? WARD_ANSWER_TARGET_MINUTES,
    transferTarget: value.transferAcceptanceTargetMinutes ?? TRANSFER_ACCEPTANCE_TARGET_MINUTES,
    transportTarget: value.transportBookedTargetMinutes ?? TRANSPORT_BOOKED_TARGET_MINUTES,
  };
}

/** One phrase per rule that moved, in page order ("ED target 24h to 20h"). */
function ruleDiffs(before: WardConfiguration, after: WardConfiguration): string[] {
  const a = fullRules(before);
  const b = fullRules(after);
  const parts: string[] = [];
  if (a.ed !== b.ed) parts.push(`ED target ${a.ed / 60}h to ${b.ed / 60}h`);
  if (a.cap !== b.cap) parts.push(`Wards asked ${a.cap} to ${b.cap}`);
  if (a.hold !== b.hold) parts.push(`Pull hold ${shortDuration(a.hold)} to ${shortDuration(b.hold)}`);
  if (a.morning !== b.morning) parts.push(`Morning count ${clock24(a.morning)} to ${clock24(b.morning)}`);
  if (a.urgent !== b.urgent) {
    parts.push(`First warning ${shortDuration(a.urgent)} to ${shortDuration(b.urgent)}`);
  }
  if (a.soon !== b.soon) {
    parts.push(`Second warning ${shortDuration(a.soon)} to ${shortDuration(b.soon)}`);
  }
  if (a.referralTarget !== b.referralTarget) {
    parts.push(`Referral decision ${shortDuration(a.referralTarget)} to ${shortDuration(b.referralTarget)}`);
  }
  if (a.transferTarget !== b.transferTarget) {
    parts.push(`Transfer acceptance ${shortDuration(a.transferTarget)} to ${shortDuration(b.transferTarget)}`);
  }
  if (a.transportTarget !== b.transportTarget) {
    parts.push(`Transport booked ${shortDuration(a.transportTarget)} to ${shortDuration(b.transportTarget)}`);
  }
  return parts;
}

type ConfigurationAuditEvent = Extract<AuditEvent, { category: "configuration" }>;

function isConfigurationEvent(event: AuditEvent): event is ConfigurationAuditEvent {
  return event.category === "configuration";
}

const CHANGE_OUTCOME_TONE: Record<ConfigurationAuditEvent["outcome"], WfTone> = {
  accepted: "success",
  partial: "warning",
  denied: "closed",
  stale: "closed",
};

const CHANGE_OUTCOME_PREFIX: Record<ConfigurationAuditEvent["outcome"], string> = {
  accepted: "",
  partial: "Partly applied: ",
  denied: "Refused: ",
  stale: "Refused: ",
};

/** One line for a recorded rule save: the first figure that moved, and how many more did. */
function configurationChangeText(before: WardConfiguration | null, after: WardConfiguration | null): string {
  if (!before || !after) return "Coordination rules";
  const parts = ruleDiffs(before, after);
  if (parts.length === 0) return "Rules saved unchanged";
  return parts.length === 1 ? parts[0] : `${parts[0]}, ${parts.length - 1} more`;
}

function isSurgePreset(value: WardConfiguration): boolean {
  return (
    value.parallelReferralCap === PARALLEL_REFERRAL_CAP_RANGE.max &&
    value.edAccessTargetMinutes === ED_ACCESS_TARGET_RANGE_MINUTES.min &&
    value.pullHoldMinutes === 120
  );
}

function readTabFromHash(): SettingsTab | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  return SETTINGS_TABS.some((tab) => tab.id === hash) ? (hash as SettingsTab) : null;
}

export function SettingsScreen() {
  const appearance = useAppearanceStore();
  const railOpen = useRailOpenStore();
  const { movements, dispatch, rejections, configuration, eventLog = [], readAuditEvents } = useWardFlow();
  const now = useWardFlowClock();
  const thresholds = publishedThresholds(movements, now, configuration);

  /**
   * The six rules are edited as a local DRAFT of `state.configuration`, never applied directly.
   * Steppers, sliders, Surge and Import only ever call `setDraft`; the provider's value, and
   * everything that reads it, stays put until Save dispatches `SET_CONFIGURATION`.
   */
  const [draft, setDraft] = useState<WardConfiguration>(configuration);
  const [tab, setTab] = useState<SettingsTab>("rules");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useWardAccessibilityPreference("reduced-motion");
  const [highContrast, setHighContrast] = useWardAccessibilityPreference("high-contrast");
  const [audioBuzz, setAudioBuzz] = useAudioBuzzPreference();
  const [actNowNotifications] = useActNowNotificationPreference();
  const [notificationPermission, setNotificationPermission] = useState<NotificationSupport>("default");
  useEffect(() => {
    const refresh = () => {
      setNotificationPermission(notificationSupport());
    };
    // The browser permission is external state: read after mount, and again when this tab regains
    // focus or another tab changes the switch, so the row never disagrees with the browser.
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
    };
  }, [actNowNotifications]);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3200);
  }, []);
  const onPreview = useCallback((name: string) => showToast(`${name}: ${NOT_WIRED}`), [showToast]);

  // Open the tab named in the address (#alerts), and keep the address in step.
  useEffect(() => {
    const fromHash = readTabFromHash();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the hash is only readable after mount
    if (fromHash) setTab(fromHash);
  }, []);
  const chooseTab = useCallback((next: SettingsTab) => {
    setTab(next);
    try {
      window.history.replaceState(null, "", next === "rules" ? window.location.pathname : `#${next}`);
    } catch {
      // An address the browser refuses to rewrite only loses the deep link.
    }
  }, []);

  // Keep document attributes in sync when Settings is mounted without the layout helper.
  useEffect(() => {
    if (reducedMotion) document.documentElement.setAttribute("data-reduced-motion", "true");
    else document.documentElement.removeAttribute("data-reduced-motion");
    if (highContrast) document.documentElement.setAttribute("data-high-contrast", "true");
    else document.documentElement.removeAttribute("data-high-contrast");
  }, [reducedMotion, highContrast]);

  /** The most recent refusal of this screen's own save, read fresh every render. */
  const configurationRejection = [...rejections]
    .reverse()
    .find((rejection) => rejection.attempted === "SET_CONFIGURATION");

  const saved = fullRules(configuration);
  const rules = fullRules(draft);
  const diffs = useMemo(() => ruleDiffs(configuration, draft), [configuration, draft]);
  const unsavedCount = diffs.length;
  const hasUnsavedRules = unsavedCount > 0;
  const isSurge = isSurgePreset(draft);
  const savedSurge = isSurgePreset(configuration);

  // The ED row's effect: who waits past the target now, at the draft value and at the saved one.
  const savedEdOver = thresholds.find((threshold) => threshold.id === "ed-access-target")?.reached ?? 0;
  const draftEdOver =
    publishedThresholds(movements, now, draft).find((threshold) => threshold.id === "ed-access-target")?.reached ?? 0;

  // Recent rule saves, newest first, from the audit trail every save writes to.
  const auditRead = readAuditEvents({ role: "coordinator" });
  const ruleChanges =
    auditRead.status === "allowed" ? auditRead.value.filter(isConfigurationEvent).slice(-5).reverse() : [];
  const lastAccepted = ruleChanges.find((change) => change.outcome === "accepted" && change.at !== null);

  const setRule = (patch: Partial<WardConfiguration>) => setDraft((current) => ({ ...current, ...patch }));

  const handleSurge = (choice: "standard" | "surge") => {
    if ((choice === "surge") === isSurge) return;
    if (choice === "surge") {
      setRule({
        parallelReferralCap: PARALLEL_REFERRAL_CAP_RANGE.max,
        edAccessTargetMinutes: ED_ACCESS_TARGET_RANGE_MINUTES.min,
        pullHoldMinutes: 120,
      });
      showToast("Surge values are in the draft. Save to apply them.");
    } else {
      const defaults = defaultWardConfiguration();
      setRule({
        parallelReferralCap: defaults.parallelReferralCap,
        edAccessTargetMinutes: defaults.edAccessTargetMinutes,
        pullHoldMinutes: defaults.pullHoldMinutes,
      });
      showToast("Standard values are in the draft. Save to apply them.");
    }
  };

  const handleSave = () => {
    if (!hasUnsavedRules) return;
    dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now, payload: draft });
    showToast(unsavedCount === 1 ? "Rule saved and recorded." : `${unsavedCount} rules saved and recorded.`);
  };

  const handleDiscard = () => {
    setDraft({ ...configuration });
    showToast("Draft discarded.");
  };

  const handleExport = () => {
    try {
      const payload = {
        product: "Ward Flow Statewide Bed Coordination",
        version: 6,
        exportedAt: new Date().toISOString(),
        configuration: draft,
        appearance,
        railOpen,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ward-flow-rules-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showToast("Rules exported.");
    } catch {
      showToast("Rules could not be exported.");
    }
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loaded) => {
      try {
        const parsed: unknown = JSON.parse(loaded.target?.result as string);
        const payload =
          parsed && typeof parsed === "object" && !Array.isArray(parsed) && "configuration" in parsed
            ? parsed.configuration
            : parsed;
        const imported = validateConfiguration(payload);
        if (imported) {
          setDraft(imported);
          showToast("Rules file loaded into the draft. Save to apply.");
        } else {
          showToast("Invalid configuration file format.");
        }
      } catch {
        showToast("Invalid configuration file format.");
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleClearSession = () => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && (key.startsWith("wf-draft:") || key.startsWith("ward-flow-") || key.startsWith("ward_flow_"))) {
          keys.push(key);
        }
      }
      keys.forEach((key) => window.sessionStorage.removeItem(key));
      showToast("Session data for this tab cleared.");
    } catch {
      showToast("Session data could not be cleared.");
    }
  };

  const handleConfirmReset = () => {
    const defaults = defaultWardConfiguration();
    dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now, payload: defaults });
    setDraft({ ...defaults });
    setAudioBuzz(true);
    setAudioBuzzPreference(true);
    applyAppearance("auto");
    setRailOpenPreference(true);
    setIsResetModalOpen(false);
    showToast("Defaults restored and recorded.");
  };

  /* Find a setting ------------------------------------------------------------------------- */
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [reference, setReference] = useState<ReferenceTab>("thresholds");
  const findRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => findSettings(query), [query]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        findRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!highlight) return;
    const frame = window.requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-setting="${highlight}"]`);
      element?.classList.add(styles.hit);
      element?.scrollIntoView?.({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
      const control = element?.matches("button, a, input")
        ? element
        : element?.querySelector<HTMLElement>("button, a[href], input");
      control?.focus({ preventScroll: true });
    });
    const clear = window.setTimeout(() => setHighlight(null), 1800);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clear);
      document.querySelector(`[data-setting="${highlight}"]`)?.classList.remove(styles.hit);
    };
  }, [highlight, reducedMotion]);

  const jumpTo = (entry: SettingsSearchEntry) => {
    chooseTab(entry.tab);
    // Fixed defaults sits behind the reference card's second tab; show it before highlighting.
    if (entry.id === "fixed-defaults") setReference("defaults");
    setHighlight(entry.id);
    setQuery("");
    setFindOpen(false);
  };

  const onFindKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      jumpTo(results[activeIndex]);
    } else if (event.key === "Escape") {
      setQuery("");
      setFindOpen(false);
    }
  };

  const showResults = findOpen && query.trim().length > 0;
  const tabLabel = (id: SettingsTab) => SETTINGS_TABS.find((item) => item.id === id)?.label ?? id;

  /* Rule rows -------------------------------------------------------------------------------- */
  const edRange = {
    id: "setting-ed-threshold",
    ...ED_ACCESS_TARGET_RANGE_MINUTES,
    ariaLabel: "ED access target in hours",
    minLabel: `${ED_ACCESS_TARGET_RANGE_MINUTES.min / 60}h`,
    maxLabel: `${ED_ACCESS_TARGET_RANGE_MINUTES.max / 60}h`,
  };
  const edDelta = draftEdOver - savedEdOver;

  return (
    <div className={styles.screen} data-testid="ward-settings-screen" data-ward-design="workspaces">
      <main id="main-content" className={styles.main}>
        <h1 className={styles.srOnly}>Settings</h1>

        <Hero
          className={styles.band}
          testId="ward-settings-profile"
          eyebrow={`${SETTINGS_DEMO_PROFILE.role} · ${SETTINGS_DEMO_PROFILE.location}`}
          title={
            <span className={styles.who}>
              <Avatar
                name={SETTINGS_DEMO_PROFILE.name}
                initials={SETTINGS_DEMO_PROFILE.initials}
                online
                decorative
                className={styles.avatar}
              />
              {SETTINGS_DEMO_PROFILE.name}
            </span>
          }
          titleMeta={
            <Badge variant="onHero" size="sm">
              Demo profile
            </Badge>
          }
          stats={
            <>
              <HeroStat
                className={styles.wordStat}
                value={savedSurge ? "Surge" : "Standard"}
                label="Rules"
                tone={savedSurge ? "warning" : undefined}
              />
              <HeroStat
                className={hasUnsavedRules ? undefined : styles.wordStat}
                value={hasUnsavedRules ? `${unsavedCount} ${unsavedCount === 1 ? "rule" : "rules"}` : "None"}
                label="Unsaved"
                tone={hasUnsavedRules ? "warning" : undefined}
              />
              <HeroStat className={styles.wordStat} value={audioBuzz ? "On" : "Off"} label="Buzz sound" />
              <HeroStat
                className={lastAccepted ? undefined : styles.wordStat}
                value={lastAccepted?.at != null ? formatInstantWithDay(lastAccepted.at, now) : "None"}
                label="Last rule save"
              />
            </>
          }
          aside={
            <>
              <Button variant="onHero" size="sm" icon={Layers} onClick={() => setIsOperatorModalOpen(true)}>
                Switch workstation
              </Button>
              <Button variant="light" size="sm" icon={UserRound} onClick={() => chooseTab("profile")}>
                Edit profile
              </Button>
            </>
          }
          bar={
            <HeroTrack<SettingsTab>
              className={styles.tabs}
              label="Settings areas"
              value={tab}
              onChange={chooseTab}
              items={SETTINGS_TABS.map((item) => {
                const Icon = TAB_ICONS[item.id];
                return {
                  id: item.id,
                  label: (
                    <>
                      <Icon size={14} aria-hidden="true" />
                      {item.label}
                    </>
                  ),
                  count: item.id === "rules" && hasUnsavedRules ? unsavedCount : undefined,
                };
              })}
            />
          }
          barAside={
            <div className={styles.find}>
              <label className={styles.findBox}>
                <Search size={14} aria-hidden="true" />
                <input
                  ref={findRef}
                  type="search"
                  role="combobox"
                  aria-label="Find a setting"
                  aria-expanded={showResults}
                  aria-controls="settings-find-results"
                  aria-activedescendant={
                    showResults && results[activeIndex] ? `settings-find-${results[activeIndex].id}` : undefined
                  }
                  aria-autocomplete="list"
                  placeholder="Find a setting"
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                    setFindOpen(true);
                  }}
                  onFocus={() => setFindOpen(true)}
                  onBlur={() => window.setTimeout(() => setFindOpen(false), 120)}
                  onKeyDown={onFindKeyDown}
                />
                <Kbd className={styles.findKey}>/</Kbd>
              </label>
              {showResults ? (
                <ul
                  id="settings-find-results"
                  className={styles.findResults}
                  role="listbox"
                  aria-label="Settings found"
                >
                  {results.length === 0 ? (
                    <li className={styles.findEmpty} role="presentation">
                      No setting matches
                    </li>
                  ) : (
                    results.map((entry, index) => (
                      <li
                        key={entry.id}
                        id={`settings-find-${entry.id}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={cx(styles.findOption, index === activeIndex && styles.findActive)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => jumpTo(entry)}
                      >
                        <span className={styles.findLabel}>{entry.label}</span>
                        <span className={styles.findTab}>{tabLabel(entry.tab)}</span>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          }
        />

        {configurationRejection ? (
          <p className={styles.refused} role="alert" data-testid="ward-settings-configuration-refused">
            <StatusGlyph tone="danger" size={10} />
            <strong>Rule change refused.</strong> {configurationRejection.reason}
          </p>
        ) : null}

        <div className={styles.pane} hidden={tab !== "rules"} data-pane="rules">
          <ScopeLine kind="save" />
          <div className={styles.columns}>
            <div className={styles.column}>
              <Card aria-labelledby="timings-title" data-setting="surge">
                <CardHead
                  id="timings-title"
                  icon={Clock}
                  title="Busy-day timings"
                  action={
                    <Segmented
                      className={styles.pillSeg}
                      label="Timing set"
                      items={[
                        { id: "standard", label: "Standard" },
                        { id: "surge", label: "Surge" },
                      ]}
                      value={isSurge ? "surge" : "standard"}
                      onChange={handleSurge}
                    />
                  }
                />
                <RuleRow
                  setting="ed-target"
                  title="ED wait target"
                  sub="Access measure only"
                  value={rules.ed}
                  saved={saved.ed}
                  display={`${rules.ed / 60}h`}
                  noun="ED access target"
                  range={edRange}
                  onChange={(minutes) => setRule({ edAccessTargetMinutes: minutes })}
                  onReset={() => setRule({ edAccessTargetMinutes: saved.ed })}
                  effect={
                    <>
                      <StatusGlyph tone={draftEdOver > 0 ? "warning" : "success"} size={9} />
                      {draftEdOver > 0 ? `${draftEdOver} over` : "None over"}
                      {edDelta !== 0 ? (
                        <span className={styles.delta}>{`${edDelta > 0 ? "+" : ""}${edDelta}`}</span>
                      ) : null}
                    </>
                  }
                  usedBy="Home, ED, Movements"
                />
                <RuleRow
                  setting="wards-asked"
                  title="Wards asked at once"
                  sub="Per referral"
                  value={rules.cap}
                  saved={saved.cap}
                  display={wardsText(rules.cap)}
                  noun="parallel referral enquiry limit"
                  range={{
                    id: "setting-parallel-cap",
                    ...PARALLEL_REFERRAL_CAP_RANGE,
                    ariaLabel: "Parallel referral cap in units",
                    minLabel: wardsText(PARALLEL_REFERRAL_CAP_RANGE.min),
                    maxLabel: wardsText(PARALLEL_REFERRAL_CAP_RANGE.max),
                  }}
                  onChange={(units) => setRule({ parallelReferralCap: units })}
                  onReset={() => setRule({ parallelReferralCap: saved.cap })}
                  usedBy="Home, Referrals, Placement"
                />
                <RuleRow
                  setting="pull-hold"
                  title="Pull hold"
                  sub="Before a held bed returns"
                  value={rules.hold}
                  saved={saved.hold}
                  display={shortDuration(rules.hold)}
                  noun="pulled bed hold duration"
                  range={{
                    id: "setting-hold-duration",
                    ...PULL_HOLD_RANGE_MINUTES,
                    ariaLabel: "Pulled bed reservation hold duration in minutes",
                    minLabel: shortDuration(PULL_HOLD_RANGE_MINUTES.min),
                    maxLabel: shortDuration(PULL_HOLD_RANGE_MINUTES.max),
                  }}
                  onChange={(minutes) => setRule({ pullHoldMinutes: minutes })}
                  onReset={() => setRule({ pullHoldMinutes: saved.hold })}
                  usedBy="Home, ED, Referrals"
                />
                <RuleRow
                  setting="morning-count"
                  testId="setting-morning-rollup-row"
                  title="Morning count"
                  sub="Not a legal limit"
                  subTestId="setting-morning-rollup-desc"
                  value={rules.morning}
                  saved={saved.morning}
                  display={clock24(rules.morning)}
                  displayTestId="morning-rollup-display"
                  noun="morning rollup deadline"
                  range={{
                    id: "setting-morning-rollup-slider",
                    ...MORNING_ROLLUP_TIME_RANGE_MINUTES,
                    ariaLabel: "Morning rollup deadline in minutes from midnight",
                    minLabel: clock24(MORNING_ROLLUP_TIME_RANGE_MINUTES.min),
                    maxLabel: clock24(MORNING_ROLLUP_TIME_RANGE_MINUTES.max),
                  }}
                  onChange={(minutes) => setRule({ morningRollupDeadlineMinutes: minutes })}
                  onReset={() => setRule({ morningRollupDeadlineMinutes: saved.morning })}
                  usedBy="Wards, Ward alerts"
                />
                <SettingRow setting="surge-ends" title="Surge ends" sub="Back to Standard on its own" preview>
                  <Segmented
                    className={styles.pillSeg}
                    label="Surge ends"
                    items={["Manual", "8h", "12h", "Shift end"].map((item) => ({ id: item, label: item }))}
                    value="12h"
                    unavailable
                    onChange={() => onPreview("Surge ends")}
                  />
                </SettingRow>
              </Card>

              <Card aria-labelledby="warnings-title">
                <CardHead
                  id="warnings-title"
                  icon={Gavel}
                  title="Form warnings"
                  meta="Your defaults, not legal limits"
                />
                <RuleRow
                  setting="first-warning"
                  testId="setting-due-soon-urgent-row"
                  title="First warning"
                  sub="Before a legal due time"
                  subTestId="setting-due-soon-urgent-desc"
                  value={rules.urgent}
                  saved={saved.urgent}
                  display={shortDuration(rules.urgent)}
                  displayTestId="due-soon-urgent-display"
                  noun="first warning before a legal due time"
                  max={clampDueSoonUrgent(DUE_SOON_URGENT_RANGE_MINUTES.max, rules.soon)}
                  range={{
                    id: "setting-due-soon-urgent",
                    ...DUE_SOON_URGENT_RANGE_MINUTES,
                    ariaLabel: "First warning before a legal due time",
                    minLabel: shortDuration(DUE_SOON_URGENT_RANGE_MINUTES.min),
                    maxLabel: shortDuration(DUE_SOON_URGENT_RANGE_MINUTES.max),
                  }}
                  onChange={(minutes) => setRule({ dueSoonUrgentMinutes: clampDueSoonUrgent(minutes, rules.soon) })}
                  onReset={() => setRule({ dueSoonUrgentMinutes: clampDueSoonUrgent(saved.urgent, rules.soon) })}
                  usedBy="Home, every legal due time"
                />
                <RuleRow
                  setting="second-warning"
                  testId="setting-due-soon-row"
                  title="Second warning"
                  sub="Shown as due soon"
                  subTestId="setting-due-soon-desc"
                  value={rules.soon}
                  saved={saved.soon}
                  display={shortDuration(rules.soon)}
                  displayTestId="due-soon-display"
                  noun="second warning before a legal due time"
                  range={{
                    id: "setting-due-soon",
                    ...DUE_SOON_RANGE_MINUTES,
                    ariaLabel: "Second warning before a legal due time",
                    minLabel: shortDuration(DUE_SOON_RANGE_MINUTES.min),
                    maxLabel: shortDuration(DUE_SOON_RANGE_MINUTES.max),
                  }}
                  onChange={(minutes) =>
                    setRule({
                      dueSoonMinutes: minutes,
                      dueSoonUrgentMinutes: clampDueSoonUrgent(rules.urgent, minutes),
                    })
                  }
                  onReset={() =>
                    setRule({
                      dueSoonMinutes: saved.soon,
                      dueSoonUrgentMinutes: clampDueSoonUrgent(rules.urgent, saved.soon),
                    })
                  }
                  usedBy="Home, every legal due time"
                />
                {/* The two warnings on one window, read from the draft: calm, due soon, first warning. */}
                <div className={styles.cascade} aria-hidden="true">
                  <div className={styles.cascadeTrack}>
                    <span style={{ flexGrow: Math.max(0, DUE_SOON_RANGE_MINUTES.max - rules.soon) }} />
                    <span className={styles.cascadeSoon} style={{ flexGrow: Math.max(0, rules.soon - rules.urgent) }} />
                    <span className={styles.cascadeUrgent} style={{ flexGrow: rules.urgent }} />
                  </div>
                  <div className={styles.cascadeEnds}>
                    <span className={styles.cascadeStart}>Due in {shortDuration(DUE_SOON_RANGE_MINUTES.max)}</span>
                    <span style={{ flexGrow: Math.max(0, DUE_SOON_RANGE_MINUTES.max - rules.soon) }}>
                      {shortDuration(rules.soon)}
                    </span>
                    <span style={{ flexGrow: Math.max(0, rules.soon - rules.urgent) }}>
                      {shortDuration(rules.urgent)}
                    </span>
                    <span style={{ flexGrow: rules.urgent }}>Due</span>
                  </div>
                </div>
              </Card>
            </div>

            <div className={styles.column}>
              <Card aria-labelledby="targets-title" data-setting="decision-targets">
                <CardHead
                  id="targets-title"
                  icon={Timer}
                  title="Decision targets"
                  meta="Your defaults, not clinical standards"
                />
                {DECISION_TARGET_STEPS.map((step) => {
                  const ruleKey =
                    step.configKey === "referralDecisionTargetMinutes"
                      ? "referralTarget"
                      : step.configKey === "transferAcceptanceTargetMinutes"
                        ? "transferTarget"
                        : "transportTarget";
                  return (
                    <RuleRow
                      key={step.step}
                      setting={`target-${step.step}`}
                      testId={`setting-target-${step.step}`}
                      title={step.label}
                      sub={
                        step.step === "referral_decision"
                          ? "Referral to ward answer"
                          : step.step === "transfer_acceptance"
                            ? "Acceptance to bed pulled"
                            : "Bed pulled to transport booked"
                      }
                      value={rules[ruleKey]}
                      saved={saved[ruleKey]}
                      display={shortDuration(rules[ruleKey])}
                      noun={`${step.label.toLowerCase()} target`}
                      range={{
                        id: `setting-target-${step.step}-range`,
                        ...DECISION_TARGET_RANGE_MINUTES,
                        ariaLabel: `${step.label} target in minutes`,
                        minLabel: shortDuration(DECISION_TARGET_RANGE_MINUTES.min),
                        maxLabel: shortDuration(DECISION_TARGET_RANGE_MINUTES.max),
                      }}
                      onChange={(minutes) => {
                        setRule({ [step.configKey]: minutes });
                      }}
                      onReset={() => {
                        setRule({ [step.configKey]: saved[ruleKey] });
                      }}
                      usedBy="Alerts, Tasks"
                    />
                  );
                })}
              </Card>

              <Card aria-labelledby="more-title">
                <CardHead
                  id="more-title"
                  icon={SlidersHorizontal}
                  title="More thresholds"
                  meta="Fixed in code today"
                  aside={<PreviewTag />}
                />
                <RuleRow
                  setting="occupancy"
                  title="Occupancy alert"
                  sub="Bed alerts dot from"
                  value={OCCUPANCY_ALERT_PERCENT}
                  saved={OCCUPANCY_ALERT_PERCENT}
                  display={`${OCCUPANCY_ALERT_PERCENT}%`}
                  noun="occupancy alert"
                  range={{
                    min: 80,
                    max: 95,
                    step: 1,
                    ariaLabel: "Occupancy alert percent",
                    minLabel: "80%",
                    maxLabel: "95%",
                  }}
                  onChange={() => onPreview("Occupancy alert")}
                  preview
                  previewTag={false}
                />
                <RuleRow
                  setting="tier-one"
                  title="Tier 1 overdue after"
                  sub="Referral queue"
                  value={OVERDUE_AFTER_MINUTES_BY_TIER[1]}
                  saved={OVERDUE_AFTER_MINUTES_BY_TIER[1]}
                  display={shortDuration(OVERDUE_AFTER_MINUTES_BY_TIER[1])}
                  noun="tier 1 overdue time"
                  range={{
                    min: 30,
                    max: 240,
                    step: 30,
                    ariaLabel: "Tier 1 overdue after",
                    minLabel: "30m",
                    maxLabel: "4h",
                  }}
                  onChange={() => onPreview("Tier 1 overdue after")}
                  preview
                  previewTag={false}
                />
                <RuleRow
                  setting="ward-silent"
                  title="Ward not answering"
                  sub="First reminder after"
                  value={SILENT_WARD_FIRST_REMINDER_MINUTES}
                  saved={SILENT_WARD_FIRST_REMINDER_MINUTES}
                  display={shortDuration(SILENT_WARD_FIRST_REMINDER_MINUTES)}
                  noun="ward reminder time"
                  range={{
                    min: 30,
                    max: 240,
                    step: 30,
                    ariaLabel: "Ward not answering",
                    minLabel: "30m",
                    maxLabel: "4h",
                  }}
                  onChange={() => onPreview("Ward not answering")}
                  preview
                  previewTag={false}
                />
                <RuleRow
                  setting="bed-hold"
                  title="Bed hold expires"
                  sub="After a bed is held"
                  value={BED_HOLD_EXPIRY_MINUTES}
                  saved={BED_HOLD_EXPIRY_MINUTES}
                  display={shortDuration(BED_HOLD_EXPIRY_MINUTES)}
                  noun="bed hold expiry"
                  range={{ min: 60, max: 360, step: 30, ariaLabel: "Bed hold expires", minLabel: "1h", maxLabel: "6h" }}
                  onChange={() => onPreview("Bed hold expires")}
                  preview
                  previewTag={false}
                />
              </Card>

              <Card
                aria-labelledby="changes-title"
                data-testid="ward-settings-recent-changes"
                data-setting="recent-changes"
              >
                <CardHead
                  id="changes-title"
                  icon={History}
                  title="Recent changes"
                  action={
                    <Link
                      className={buttonClass({ variant: "ghost", size: "sm", className: styles.pill })}
                      href="/mockups/ward-flow/governance"
                    >
                      Full audit
                    </Link>
                  }
                />
                {ruleChanges.length === 0 ? (
                  <p className={styles.cardEmpty}>No rule saves this session.</p>
                ) : (
                  <ol className={styles.changeList}>
                    {ruleChanges.map((change) => (
                      <li key={change.id} className={styles.changeRow}>
                        <span className={styles.changeTime}>
                          {change.at === null ? "No time" : formatInstantWithDay(change.at, now)}
                        </span>
                        <StatusGlyph tone={CHANGE_OUTCOME_TONE[change.outcome]} size={9} />
                        <span className={styles.changeText}>
                          {CHANGE_OUTCOME_PREFIX[change.outcome]}
                          {configurationChangeText(
                            change.details.before,
                            change.outcome === "accepted" ? change.details.after : change.details.requested,
                          )}
                        </span>
                        <span className={styles.changeActor}>
                          {change.actor.role ? WARD_FLOW_ROLE_LABELS[change.actor.role] : "Role not recorded"}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </div>
          </div>
        </div>

        <div className={styles.pane} hidden={tab !== "alerts"} data-pane="alerts">
          <AlertsPane
            notifications={actNowNotifications}
            notificationPermission={notificationPermission}
            onNotificationsChange={(next) => {
              if (!next) {
                setActNowNotificationPreference(false);
                showToast("Browser notifications off.");
                return;
              }
              void enableActNowNotifications().then((answer) => {
                setNotificationPermission(answer);
                showToast(
                  answer === "granted"
                    ? "Browser notifications on for act-now alerts."
                    : answer === "unsupported"
                      ? "This browser cannot show notifications."
                      : "Notifications are blocked for this site in the browser.",
                );
              });
            }}
            buzz={audioBuzz}
            onBuzzChange={(next) => {
              setAudioBuzz(next);
              setAudioBuzzPreference(next);
              showToast(next ? "Buzz sound on." : "Buzz sound off.");
            }}
            onTestBuzz={() => {
              playSyntheticUrgentChime();
              showToast("Test buzz played.");
            }}
            onPreview={onPreview}
          />
        </div>

        <div className={styles.pane} hidden={tab !== "display"} data-pane="display">
          <DisplayPane
            appearance={appearance}
            onAppearanceChange={(next) => {
              applyAppearance(next);
              showToast(`Theme set to ${next === "auto" ? "Auto" : next === "dark" ? "Dark" : "Light"}.`);
            }}
            railOpen={railOpen}
            onRailChange={(open) => {
              setRailOpenPreference(open);
              showToast(open ? "Sidebar open." : "Sidebar shows icons only.");
            }}
            reducedMotion={reducedMotion}
            onReducedMotionChange={(next) => {
              setReducedMotion(next);
              showToast(`Reduce motion ${next ? "on" : "off"}.`);
            }}
            highContrast={highContrast}
            onHighContrastChange={(next) => {
              setHighContrast(next);
              showToast(`High contrast ${next ? "on" : "off"}.`);
            }}
            onPreview={onPreview}
          />
        </div>

        <div className={styles.pane} hidden={tab !== "profile"} data-pane="profile">
          <ProfilePane onPreview={onPreview} />
        </div>

        <div className={styles.pane} hidden={tab !== "data"} data-pane="data">
          <DataPane
            reference={reference}
            onReferenceChange={setReference}
            movementCount={movements.length}
            eventCount={eventLog.length}
            thresholds={thresholds}
            onExport={handleExport}
            onImport={handleImport}
            onClearSession={handleClearSession}
            onRestore={() => setIsResetModalOpen(true)}
          />
        </div>

        {hasUnsavedRules ? (
          <div
            className={styles.saveBar}
            role="region"
            aria-label="Unsaved rule changes"
            data-testid="unsaved-draft-inspector"
          >
            <StatusGlyph tone="info" size={9} />
            <span className={styles.saveText} title={diffs.join(", ")}>
              {diffs.join(", ")}
            </span>
            {tab !== "rules" ? (
              <button type="button" className={styles.saveLink} onClick={() => chooseTab("rules")}>
                Review
              </button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className={styles.pill}
              onClick={handleDiscard}
              data-testid="btn-discard-draft"
            >
              Discard
            </Button>
            <Button
              variant="pri"
              size="sm"
              icon={Check}
              className={styles.pill}
              onClick={handleSave}
              data-testid="btn-save-draft"
            >
              {unsavedCount === 1 ? "Save 1 change" : `Save ${unsavedCount} changes`}
            </Button>
          </div>
        ) : null}

        <ResetBaselineModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onConfirm={handleConfirmReset}
        />
        {isOperatorModalOpen ? (
          <OperatorSwitcherModal
            isOpen={isOperatorModalOpen}
            onClose={() => setIsOperatorModalOpen(false)}
            onPreview={onPreview}
          />
        ) : null}
        <WardPrototypeFooter
          testId="ward-settings-governance"
          note="Synthetic records · Not a medical device · Changes remembered for this browser only"
        />
        {toastMessage ? (
          <div className={styles.toast} role="status">
            {toastMessage}
          </div>
        ) : null}
      </main>
    </div>
  );
}
