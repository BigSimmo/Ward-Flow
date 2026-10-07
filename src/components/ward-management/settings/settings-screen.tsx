"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  Database,
  Download,
  Gauge,
  Gavel,
  History,
  Keyboard,
  ListChecks,
  Minus,
  Palette,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";

import type { WallboardRefreshInterval } from "@/components/ward-management/shell/ward-wallboard-store";
import { useWardAccessibilityPreference } from "@/components/ward-management/shell/ward-accessibility";
import { applyAppearance, useAppearanceStore } from "@/components/ward-management/shell/ward-bar";
import { setRailOpenPreference, useRailOpenStore } from "@/components/ward-management/shell/ward-rail";
import type { WardAppearance } from "@/components/ward-management/shell/ward-shell-types";
import {
  defaultWardConfiguration,
  validateConfiguration,
  type WardConfiguration,
} from "@/components/ward-management/ward-configuration";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  Card,
  CardHead,
  Hero,
  HeroStat,
  Kbd,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  Switch,
  buttonClass,
  durMinutes,
  type WfTone,
} from "@/components/wf";
import type { AuditEvent } from "@/components/ward-management/ward-audit";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import {
  DUE_SOON_MINUTES,
  DUE_SOON_RANGE_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
  OPERATIONAL_DEFAULTS,
} from "@/components/ward-management/ward-operational-defaults";

import { publishedThresholds, type ThresholdState } from "./settings-thresholds";
import { countMatchesByDomain, filterSettingEntries, SETTINGS_DOMAINS } from "./settings-search-index";
import {
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_MINUTES,
  PARALLEL_REFERRAL_CAP_RANGE,
  PULL_HOLD_RANGE_MINUTES,
} from "@/components/ward-management/ward-model";
import { useAudioBuzzPreference, setAudioBuzzPreference } from "@/components/ward-management/shell/ward-sound-store";

import { OperatorSwitcherModal } from "./operator-switcher-modal";
import { ResetBaselineModal } from "./reset-baseline-modal";
import { SETTINGS_SEARCH_ENTRIES } from "./settings-search-index";

import styles from "./settings.module.css";

/** Short toolbar chip names (v6 Settings mockup); the full name stays as the chip's title. */
const DOMAIN_CHIP_LABEL: Record<string, string> = {
  "cat-appearance": "Look",
  "cat-thresholds": "Thresholds",
  "cat-allocation": "Beds",
  "cat-notifications": "Alerts",
  "cat-reset": "Storage",
};

/** 24-hour clock time, `HH:MM`, for the hero's morning count. */
function clock24(minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60);
  const mins = minutesFromMidnight % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Minutes under an hour show as minutes; an hour or more shows as hours and any minutes left,
 *  e.g. "45 min", "1 h", "1 h 15 min" — the same figure the due-time warning rows and their sliders
 *  display. */
function formatDueSoonDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * The first due-time warning (`dueSoonUrgentMinutes`) must stay before the second
 * (`dueSoonMinutes`) or `validateConfiguration` refuses the save — see its own comment in
 * `ward-configuration.ts`. Always adjusts the first value down to one of its own steps below
 * the second, whichever control changed; the second is free to move within its own range.
 */
function clampDueSoonUrgent(urgentCandidate: number, soonValue: number): number {
  const withinOwnRange = Math.max(
    DUE_SOON_URGENT_RANGE_MINUTES.min,
    Math.min(DUE_SOON_URGENT_RANGE_MINUTES.max, urgentCandidate),
  );
  return Math.min(withinOwnRange, soonValue - DUE_SOON_URGENT_RANGE_MINUTES.step);
}

/**
 * 🔴 **SETTINGS — AND THE ONE RULE THAT DECIDES WHAT IS ON IT: A CONTROL THAT WRITES STATE NOTHING
 * READS IS WORSE THAN A MISSING CONTROL.**
 *
 * It looks like it works and silently does nothing, and a reader who touches it believes they have
 * changed something. **So every control here names what reads it, or it does not exist.**
 *
 * ⚠️ **NO DEMONSTRATION CONTROL BELONGS ON THIS SCREEN.** Owner ruling Q-7 puts the clock, the
 * scenario and Reset in the Tools drawer, *"nothing a demonstration needs is lost, and nothing reads
 * as a real control"*. The drawing correctly omits them. 🔴 **A settings screen is exactly where a
 * later well-meaning reader puts them back** — see the note rendered below, which exists so their
 * absence reads as a decision rather than an oversight.
 */

const THRESHOLD_STATE_WORDS: Record<ThresholdState, string> = {
  "fires-now": "Showing now",
  "nothing-reaches-it": "Nothing reaches it today",
};

const APPEARANCE_CHOICES: readonly {
  readonly value: WardAppearance;
  readonly label: string;
  readonly description: string;
}[] = [
  { value: "light", label: "Light", description: "Crisp daylight contrast" },
  { value: "dark", label: "Dark", description: "Low-glare night shift" },
  { value: "auto", label: "Auto", description: "Follows system theme" },
];

interface RolePermission {
  readonly role: string;
  readonly scope: string;
  readonly forms: string;
  readonly override: string;
  readonly handover: string;
  readonly handoverTone: WfTone;
}

const ROLE_PERMISSIONS: readonly RolePermission[] = [
  {
    role: "State bed coordinator",
    scope: "Statewide flow desk",
    forms: "Full",
    override: "Catchment and acuity",
    handover: "Signs",
    handoverTone: "success",
  },
  {
    role: "Duty consultant psychiatrist",
    scope: "Health service cluster",
    forms: "Examination, detention",
    override: "Clinical exceptions",
    handover: "Signs",
    handoverTone: "success",
  },
  {
    role: "Ward NUM, shift coordinator",
    scope: "One inpatient unit",
    forms: "Receive Form 4A",
    override: "Ward bed allocation",
    handover: "Signs",
    handoverTone: "success",
  },
  {
    role: "ED mental health liaison",
    scope: "ED pod",
    forms: "Record Form 1A",
    override: "Escalation request",
    handover: "Signs",
    handoverTone: "success",
  },
  {
    role: "Custodial transport officer",
    scope: "Secure vehicle",
    forms: "Record Form 4A",
    override: "Route change",
    handover: "Transport only",
    handoverTone: "info",
  },
  {
    role: "Clinical governance lead",
    scope: "Statewide directorate",
    forms: "Audit and review",
    override: "Review verdict",
    handover: "Audit only",
    handoverTone: "neutral",
  },
];

const NOT_WIRED = "Not wired in this prototype.";

/** The morning count stepper and slider: 08:00 to 11:00 in quarter hours. */
const MORNING_COUNT_RANGE = { min: 480, max: 660, step: 15 } as const;

/** The sections the printed handover sheet carries, as the Handover screen names them. */
const HANDOVER_SHEET_SECTIONS =
  "Longest waits, Beds pulled, In transit, Placement gone wrong, Outside this filter, Still open at 15:00, Shift and sign off, and Handover details";

const BOARD_REFRESH_CHOICES: readonly { readonly value: WallboardRefreshInterval; readonly label: string }[] = [
  { value: "off", label: "Off" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
];

/** Only shortcuts something on this page or in the shell actually answers. */
const KEYBOARD_SHORTCUTS: readonly { readonly label: string; readonly keys: readonly string[] }[] = [
  { label: "Focus settings filter", keys: ["/"] },
  { label: "Close, dismiss", keys: ["Esc"] },
  { label: "Toggle the rail", keys: ["["] },
  { label: "Find a patient", keys: ["Ctrl", "K"] },
];

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
  const parts: string[] = [];
  if (before.edAccessTargetMinutes !== after.edAccessTargetMinutes) {
    parts.push(`ED target ${before.edAccessTargetMinutes / 60}h to ${after.edAccessTargetMinutes / 60}h`);
  }
  if (before.parallelReferralCap !== after.parallelReferralCap) {
    parts.push(`Wards asked ${before.parallelReferralCap} to ${after.parallelReferralCap}`);
  }
  if (before.pullHoldMinutes !== after.pullHoldMinutes) {
    parts.push(`Pull hold ${durMinutes(before.pullHoldMinutes)} to ${durMinutes(after.pullHoldMinutes)}`);
  }
  const rollupBefore = before.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES;
  const rollupAfter = after.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES;
  if (rollupBefore !== rollupAfter) parts.push(`Morning count ${clock24(rollupBefore)} to ${clock24(rollupAfter)}`);
  const urgentBefore = before.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES;
  const urgentAfter = after.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES;
  if (urgentBefore !== urgentAfter) {
    parts.push(`First warning ${formatDueSoonDuration(urgentBefore)} to ${formatDueSoonDuration(urgentAfter)}`);
  }
  const soonBefore = before.dueSoonMinutes ?? DUE_SOON_MINUTES;
  const soonAfter = after.dueSoonMinutes ?? DUE_SOON_MINUTES;
  if (soonBefore !== soonAfter) {
    parts.push(`Second warning ${formatDueSoonDuration(soonBefore)} to ${formatDueSoonDuration(soonAfter)}`);
  }
  if (parts.length === 0) return "Rules saved unchanged";
  return parts.length === 1 ? parts[0] : `${parts[0]}, ${parts.length - 1} more`;
}

/** "Saved" when the draft matches the saved rule, otherwise the saved value beside it. */
function savedText(unchanged: boolean, savedValue: string): string {
  return unchanged ? "Saved" : `Saved ${savedValue}`;
}

function wardsText(count: number): string {
  return `${count} ${count === 1 ? "ward" : "wards"}`;
}

/** The nine controls the engine cannot back (owner decision D4): visible, keyboard-reachable, and
 *  each one saying it is not wired. They read across the card in rows. */
const PREVIEWS: readonly { readonly id: string; readonly title: string; readonly sub: string }[] = [
  { id: "setting-form1a-strict", title: "Form 1A before involuntary", sub: "Admission check" },
  { id: "setting-cp-audit", title: "Chief Psychiatrist audit", sub: "Governance trail" },
  { id: "setting-acuity-ceiling", title: "Specialling limit", sub: "Specialling per ward" },
  { id: "setting-form4a-escort", title: "Escort before transport", sub: "Escort assignment" },
  { id: "setting-gender-mix", title: "Bay and gender rules", sub: "Bay integrity" },
  { id: "setting-medical-release", title: "Clearance bed buffer", sub: "Medical clearance" },
  { id: "setting-auth-hospital", title: "Authorised bed check", sub: "Involuntary destination" },
  { id: "setting-auto-escalate", title: "Text all services", sub: "Multi-service broadcast" },
  { id: "setting-form4a-warn", title: "Form 4A expiry warning", sub: "Transport order" },
];

type RuleStepper = {
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
  readonly display: string;
  readonly displayTestId?: string;
  readonly atMin: boolean;
  readonly atMax: boolean;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
};

type RuleRange = {
  readonly id: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly ariaLabel: string;
  readonly minLabel: string;
  readonly maxLabel: string;
  readonly onChange: (value: number) => void;
};

/** One rule on a timings card: words, a stepper, a slim range and, on the timings table, its effect. */
function RuleRow({
  title,
  sub,
  subTestId,
  testId,
  stepper,
  range,
  effect,
}: {
  title: string;
  sub: string;
  subTestId?: string;
  testId?: string;
  stepper: RuleStepper;
  range: RuleRange;
  effect?: ReactNode;
}) {
  return (
    <div className={effect ? styles.ruleRow : `${styles.ruleRow} ${styles.ruleRowWarning}`} data-testid={testId}>
      <span className={`${styles.ruleText} ${styles.ruleTextCell}`}>
        <span className={styles.ruleTitle}>{title}</span>
        <span className={styles.ruleSub} data-testid={subTestId}>
          {sub}
        </span>
      </span>
      <span className={styles.stepBox}>
        <button
          type="button"
          className={styles.stepButton}
          aria-label={stepper.decreaseLabel}
          aria-disabled={stepper.atMin || undefined}
          onClick={stepper.onDecrease}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <span className={styles.stepValue} data-testid={stepper.displayTestId}>
          {stepper.display}
        </span>
        <button
          type="button"
          className={styles.stepButton}
          aria-label={stepper.increaseLabel}
          aria-disabled={stepper.atMax || undefined}
          onClick={stepper.onIncrease}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </span>
      <span className={styles.rangeCell}>
        <input
          id={range.id}
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={range.value}
          onChange={(e) => range.onChange(Number(e.target.value))}
          className={styles.rangeInput}
          aria-label={range.ariaLabel}
        />
        <span className={styles.rangeEnds} aria-hidden="true">
          <span>{range.minLabel}</span>
          <span>{range.maxLabel}</span>
        </span>
      </span>
      {effect ? <span className={styles.effectCell}>{effect}</span> : null}
    </div>
  );
}

/** A switch row's words: the name, and a short line under it. */
function SwitchText({ title, sub, subTestId }: { title: string; sub: string; subTestId?: string }) {
  return (
    <span className={styles.ruleText}>
      <span className={styles.ruleTitle}>{title}</span>
      <span className={styles.ruleSub} data-testid={subTestId}>
        {sub}
      </span>
    </span>
  );
}

export function SettingsScreen() {
  const appearance = useAppearanceStore();
  const railOpen = useRailOpenStore();
  const { movements, dispatch, rejections, configuration, eventLog = [], readAuditEvents } = useWardFlow();
  const now = useWardFlowClock();
  const thresholds = publishedThresholds(movements, now, configuration);

  /**
   * Task 9 of the audit-wiring plan, 2026-09-16: the three coordinator-tunable figures
   * (ED access target, parallel referral cap, pull hold) are edited as a local DRAFT of
   * `state.configuration`, never applied directly. Moving a slider or clicking a stepper
   * only ever calls `setDraft` — the provider's own value, and everything that reads it,
   * stays exactly where it was until "Save coordination rules" dispatches `SET_CONFIGURATION`
   * with this draft as its payload.
   */
  const [draft, setDraft] = useState<WardConfiguration>(configuration);

  /**
   * The most recent refusal of THIS screen's own `SET_CONFIGURATION` attempts, read fresh every
   * render rather than captured at the moment `handleSave` ran — `dispatch` mutates provider
   * state asynchronously from this component's point of view, so there is no synchronous return
   * value to inspect.
   */
  const configurationRejection = [...rejections]
    .reverse()
    .find((rejection) => rejection.attempted === "SET_CONFIGURATION");

  // The not-wired controls (owner direction, 2026-09-16; see tests/ward-settings-not-wired-controls.dom.test.tsx).
  // None of these local states is read by anything outside this file.
  const [medicalReleaseMinutes, setMedicalReleaseMinutes] = useState(120);
  const [acuityCeiling, setAcuityCeiling] = useState(3);
  const [statutoryWarningHours, setStatutoryWarningHours] = useState(4);
  const [autoEscalationAlerts, setAutoEscalationAlerts] = useState(false);
  const [autoCapacityRefresh, setAutoCapacityRefresh] = useState(false);
  const [multiCatchmentSearch, setMultiCatchmentSearch] = useState(false);
  const [statutoryExpiryAlerts, setStatutoryExpiryAlerts] = useState(false);
  const [genderMixProtection, setGenderMixProtection] = useState(false);
  const [audioBreachChimes, setAudioBreachChimes] = useState(false);

  const [reducedMotion, setReducedMotion] = useWardAccessibilityPreference("reduced-motion");
  const [highContrast, setHighContrast] = useWardAccessibilityPreference("high-contrast");
  const handleToggleReducedMotion = (enabled: boolean) => {
    setReducedMotion(enabled);
    showToast(`Reduced motion ${enabled ? "enabled" : "disabled"}.`);
  };
  const handleToggleHighContrast = (enabled: boolean) => {
    setHighContrast(enabled);
    showToast(`High contrast mode ${enabled ? "enabled" : "disabled"}.`);
  };

  // Audio & Visual Urgent Buzz Alerts state (browser-store backed, SSR-safe)
  const [audioBuzzAlerts, setAudioBuzzAlerts] = useAudioBuzzPreference();
  // Operator Switcher Modal state
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);

  // Operational Surge Mode state
  const isSurgePreset = (value: WardConfiguration) =>
    value.parallelReferralCap === PARALLEL_REFERRAL_CAP_RANGE.max &&
    value.edAccessTargetMinutes === ED_ACCESS_TARGET_RANGE_MINUTES.min &&
    value.pullHoldMinutes === 120;
  const isSurge = isSurgePreset(draft);
  const savedSurge = isSurgePreset(configuration);
  const hasUnsavedRules =
    draft.parallelReferralCap !== configuration.parallelReferralCap ||
    draft.edAccessTargetMinutes !== configuration.edAccessTargetMinutes ||
    draft.pullHoldMinutes !== configuration.pullHoldMinutes ||
    (draft.morningRollupDeadlineMinutes ?? 570) !== (configuration.morningRollupDeadlineMinutes ?? 570) ||
    (draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES) !==
      (configuration.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES) ||
    (draft.dueSoonMinutes ?? DUE_SOON_MINUTES) !== (configuration.dueSoonMinutes ?? DUE_SOON_MINUTES);

  // Clinical Operator Profile Popover state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Search & Navigation state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDomain, setActiveDomain] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([
    "ED threshold",
    "Form catalogue",
    "Form 4A",
    "Hold buffer",
  ]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Filtered entries and domain match counts
  const matchedEntryIds = useMemo(() => filterSettingEntries(searchQuery), [searchQuery]);
  const domainMatchCounts = useMemo(() => countMatchesByDomain(matchedEntryIds), [matchedEntryIds]);
  const totalMatches = matchedEntryIds.size;

  // Storage Quota Estimation (SSR-safe, client-mount resolved)
  const [storageEstimate, setStorageEstimate] = useState<{
    usedFormatted: string;
    quotaFormatted: string;
    percent: number;
  }>({
    usedFormatted: "48 KB",
    quotaFormatted: "5.0 MB",
    percent: 1,
  });

  useEffect(() => {
    let mounted = true;
    async function checkStorage() {
      if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          if (mounted && estimate.quota && estimate.usage !== undefined) {
            const usedKB = Math.round(estimate.usage / 1024);
            const quotaMB = Math.round(estimate.quota / (1024 * 1024));
            const pct = Math.min(100, Math.round((estimate.usage / estimate.quota) * 100));
            setStorageEstimate({
              usedFormatted: usedKB < 1024 ? `${usedKB} KB` : `${(usedKB / 1024).toFixed(1)} MB`,
              quotaFormatted: `${quotaMB} MB`,
              percent: Math.max(1, pct),
            });
            return;
          }
        } catch {
          // Fallback to storage measurement below
        }
      }
      if (typeof window !== "undefined") {
        let bytes = 0;
        try {
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k) bytes += (k.length + (window.localStorage.getItem(k)?.length ?? 0)) * 2;
          }
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const k = window.sessionStorage.key(i);
            if (k) bytes += (k.length + (window.sessionStorage.getItem(k)?.length ?? 0)) * 2;
          }
        } catch {
          bytes = 49152;
        }
        const kb = Math.max(16, Math.round(bytes / 1024));
        if (mounted) {
          setStorageEstimate({
            usedFormatted: `${kb} KB`,
            quotaFormatted: "5.0 MB",
            percent: Math.min(100, Math.max(1, Math.round((kb / 5120) * 100))),
          });
        }
      }
    }
    checkStorage();
    return () => {
      mounted = false;
    };
  }, []);

  // Diff computation for all modified parameters
  const draftDiffs = useMemo(() => {
    const diffs: { label: string; from: string; to: string }[] = [];
    if (draft.parallelReferralCap !== configuration.parallelReferralCap) {
      diffs.push({
        label: "Parallel cap",
        from: `${configuration.parallelReferralCap}`,
        to: `${draft.parallelReferralCap}`,
      });
    }
    if (draft.edAccessTargetMinutes !== configuration.edAccessTargetMinutes) {
      diffs.push({
        label: "ED target",
        from: `${configuration.edAccessTargetMinutes / 60}h`,
        to: `${draft.edAccessTargetMinutes / 60}h`,
      });
    }
    if (draft.pullHoldMinutes !== configuration.pullHoldMinutes) {
      diffs.push({
        label: "Pull hold",
        from: `${configuration.pullHoldMinutes}m`,
        to: `${draft.pullHoldMinutes}m`,
      });
    }
    const curRollup = configuration.morningRollupDeadlineMinutes ?? 570;
    const draftRollup = draft.morningRollupDeadlineMinutes ?? 570;
    if (draftRollup !== curRollup) {
      diffs.push({
        label: "Rollup",
        from: clock24(curRollup),
        to: clock24(draftRollup),
      });
    }
    const curUrgent = configuration.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES;
    const draftUrgent = draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES;
    if (draftUrgent !== curUrgent) {
      diffs.push({
        label: "Urgent warn",
        from: formatDueSoonDuration(curUrgent),
        to: formatDueSoonDuration(draftUrgent),
      });
    }
    const curSoon = configuration.dueSoonMinutes ?? DUE_SOON_MINUTES;
    const draftSoon = draft.dueSoonMinutes ?? DUE_SOON_MINUTES;
    if (draftSoon !== curSoon) {
      diffs.push({
        label: "Due soon",
        from: formatDueSoonDuration(curSoon),
        to: formatDueSoonDuration(draftSoon),
      });
    }
    return diffs;
  }, [draft, configuration]);

  const handleDiscardDraft = () => {
    setDraft({ ...configuration });
    showToast("Draft changes discarded. Restored saved configuration.");
  };

  // Export Configuration JSON
  const handleExportConfig = () => {
    try {
      const exportPayload = {
        product: "Ward Flow Statewide Bed Coordination",
        version: 5,
        exportedAt: new Date().toISOString(),
        configuration: draft,
        appearance,
        railOpen,
      };
      const jsonStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ward-flow-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Configuration JSON exported successfully.");
    } catch {
      showToast("Failed to export configuration JSON.");
    }
  };

  // Import Backup JSON
  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed: unknown = JSON.parse(event.target?.result as string);
        const payload =
          parsed && typeof parsed === "object" && !Array.isArray(parsed) && "configuration" in parsed
            ? parsed.configuration
            : parsed;
        const conf = validateConfiguration(payload);
        if (conf) {
          setDraft(conf);
          showToast("Configuration backup loaded into draft. Save coordination rules to apply.");
        } else {
          showToast("Invalid configuration file format.");
        }
      } catch {
        showToast("Error reading configuration JSON file.");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  // Clear Transient Cache
  const handleClearTransientCache = () => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("ward-flow-demo-state-v1");
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && (k.startsWith("wf-draft:") || k.startsWith("ward-flow-") || k.startsWith("ward_flow_"))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
      }
      setSearchHistory([]);
      showToast("Transient session cache, drafts, and search ledger cleared.");
    } catch {
      showToast("Failed to clear transient cache.");
    }
  };

  // Global keyboard shortcuts: "/" to search, "Escape" to dismiss popovers/modals/search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isOperatorModalOpen) {
          setIsOperatorModalOpen(false);
        } else if (isProfileOpen) {
          setIsProfileOpen(false);
        } else if (isResetModalOpen) {
          setIsResetModalOpen(false);
        } else if (searchQuery.length > 0) {
          setSearchQuery("");
        }
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOperatorModalOpen, isProfileOpen, isResetModalOpen, searchQuery]);

  // Outside click listener for operator profile popover
  useEffect(() => {
    if (!isProfileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileOpen]);

  // Scrollspy: update activeDomain as the user scrolls through the settings sections
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    const domainIds = SETTINGS_DOMAINS.map((d) => d.id);
    const scrollParent = document.querySelector('[class*="shellContent"]');

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          visibleEntries.sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
          const topVisibleId = visibleEntries[0].target.id;
          if (topVisibleId) {
            setActiveDomain(topVisibleId);
          }
        } else if (scrollParent && scrollParent.scrollTop < 80) {
          setActiveDomain("all");
        }
      },
      {
        root: scrollParent || null,
        rootMargin: "-5% 0px -65% 0px",
        threshold: [0, 0.1, 0.5],
      },
    );

    domainIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleDomainClick = (domainId: string) => {
    setActiveDomain(domainId);
    if (domainId === "all") {
      const scrollParent = document.querySelector('[class*="shellContent"]');
      if (scrollParent) {
        scrollParent.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    const element = document.getElementById(domainId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleToggleSurge = () => {
    const next = !isSurge;
    if (next) {
      setDraft((prev) => ({
        ...prev,
        parallelReferralCap: PARALLEL_REFERRAL_CAP_RANGE.max,
        edAccessTargetMinutes: ED_ACCESS_TARGET_RANGE_MINUTES.min,
        pullHoldMinutes: 120,
      }));
      showToast("Surge values selected in the draft. Save coordination rules to apply them.");
    } else {
      const defaults = defaultWardConfiguration();
      setDraft((prev) => ({
        ...prev,
        parallelReferralCap: defaults.parallelReferralCap,
        edAccessTargetMinutes: defaults.edAccessTargetMinutes,
        pullHoldMinutes: defaults.pullHoldMinutes,
      }));
      showToast("Standard values selected in the draft. Save coordination rules to apply them.");
    }
  };

  const handleSave = () => {
    dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now, payload: draft });
    showToast(
      `Configuration save requested: ED access target ${draft.edAccessTargetMinutes / 60}h, parallel cap ${draft.parallelReferralCap} units, pull hold ${draft.pullHoldMinutes}m, rollup ${clock24(draft.morningRollupDeadlineMinutes ?? 570)}, due-time warnings ${formatDueSoonDuration(draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES)}/${formatDueSoonDuration(draft.dueSoonMinutes ?? DUE_SOON_MINUTES)}.`,
    );
  };

  const handleConfirmReset = () => {
    const defaults = defaultWardConfiguration();
    dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now, payload: defaults });
    setDraft({ ...defaults, morningRollupDeadlineMinutes: 570 });
    setAudioBuzzAlerts(true);
    setAudioBuzzPreference(true);
    setStatutoryWarningHours(4);
    setAutoEscalationAlerts(false);
    setAutoCapacityRefresh(false);
    setMultiCatchmentSearch(false);
    setStatutoryExpiryAlerts(false);
    setGenderMixProtection(false);
    setAudioBreachChimes(false);
    setMedicalReleaseMinutes(120);
    setAcuityCeiling(3);
    applyAppearance("auto");
    setRailOpenPreference(true);
    setIsResetModalOpen(false);
    showToast("Configuration restored to baseline.");
  };

  const handleClearLedger = () => {
    setSearchHistory([]);
    showToast("Search access history cleared.");
  };

  // Helper to check if a specific row should be rendered
  const isRowVisible = (id: string) => matchedEntryIds.has(id);

  const filtering = searchQuery.trim().length > 0;
  const draftRollup = draft.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES;
  const savedRollup = configuration.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES;
  const draftUrgent = draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES;
  const draftSoon = draft.dueSoonMinutes ?? DUE_SOON_MINUTES;
  // The ED row's effect: who waits past the target now, at the draft value and at the saved one.
  const savedEdOver = thresholds.find((threshold) => threshold.id === "ed-access-target")?.reached ?? 0;
  const draftEdOver =
    publishedThresholds(movements, now, draft).find((threshold) => threshold.id === "ed-access-target")?.reached ?? 0;

  // Recent rule saves, newest first, from the audit trail every save writes to.
  const auditRead = readAuditEvents({ role: "coordinator" });
  const ruleChanges =
    auditRead.status === "allowed" ? auditRead.value.filter(isConfigurationEvent).slice(-5).reverse() : [];

  const timingsVisible = [
    "setting-ed-threshold",
    "setting-parallel-cap",
    "setting-hold-duration",
    "setting-morning-rollup",
  ].some(isRowVisible);
  const warningsVisible = isRowVisible("setting-due-soon-urgent") || isRowVisible("setting-due-soon");
  const browserVisible = ["setting-default-service", "setting-handover-sheet", "setting-demonstration-data"].some(
    isRowVisible,
  );
  const lookVisible = isRowVisible("setting-appearance-theme") || isRowVisible("setting-rail-density");
  const alertsVisible = isRowVisible("setting-buzz-alert") || isRowVisible("setting-wallboard-refresh");
  const displayVisible = lookVisible || alertsVisible;
  const shortcutsVisible = isRowVisible("setting-keyboard-shortcuts") || isRowVisible("setting-search-ledger");
  const visiblePreviews = PREVIEWS.filter((preview) => isRowVisible(preview.id));

  /**
   * Each domain's scroll anchor (`cat-*`, read by the category chips and the scrollspy) sits on the
   * first visible card or row of that domain in page order, so a filtered page still has one.
   */
  const domainOf = (entryId: string) => SETTINGS_SEARCH_ENTRIES.find((entry) => entry.id === entryId)?.domainId;
  const anchorCandidates: readonly (readonly [string, string | undefined, boolean])[] = [
    ["timings", "cat-thresholds", timingsVisible],
    ["warnings", "cat-thresholds", warningsVisible],
    ["browser", "cat-reset", browserVisible],
    ["display", "cat-appearance", lookVisible],
    ["alerts", "cat-notifications", alertsVisible],
    ["shortcuts", "cat-notifications", shortcutsVisible],
    ...visiblePreviews.map((preview) => [preview.id, domainOf(preview.id), true] as const),
    ["defaults", "cat-thresholds", isRowVisible("setting-operational-defaults")],
    ["thresholds", "cat-thresholds", isRowVisible("setting-published-thresholds")],
    ["roles", "cat-notifications", isRowVisible("setting-roles-matrix")],
  ];
  const anchorOwners = new Map<string, string>();
  const claimedDomains = new Set<string>();
  for (const [key, domain, visible] of anchorCandidates) {
    if (!visible || !domain || claimedDomains.has(domain)) continue;
    claimedDomains.add(domain);
    anchorOwners.set(key, domain);
  }
  const anchorId = (key: string) => anchorOwners.get(key);

  const previewChecked: Partial<Record<string, boolean>> = {
    "setting-form1a-strict": statutoryExpiryAlerts,
    "setting-form4a-escort": autoCapacityRefresh,
    "setting-auth-hospital": multiCatchmentSearch,
    "setting-cp-audit": audioBreachChimes,
    "setting-gender-mix": genderMixProtection,
    "setting-auto-escalate": autoEscalationAlerts,
  };

  /** A not-wired preview's control: aria-disabled, never natively disabled, and it says why. */
  const previewControl = (preview: (typeof PREVIEWS)[number]) => {
    const notWired = () => showToast(`${preview.title} is not wired in this prototype.`);
    const name = `${preview.title} — not wired in this prototype`;
    if (preview.id === "setting-acuity-ceiling") {
      return (
        <Select
          boxClassName={styles.previewSelect}
          value={acuityCeiling}
          aria-disabled="true"
          onChange={notWired}
          aria-label={name}
        >
          {[2, 3, 4].map((count) => (
            <option key={count} value={count}>
              {count} patients
            </option>
          ))}
        </Select>
      );
    }
    if (preview.id === "setting-medical-release") {
      return (
        <Select
          boxClassName={styles.previewSelect}
          value={medicalReleaseMinutes}
          aria-disabled="true"
          onChange={notWired}
          aria-label={name}
        >
          {[60, 120, 180].map((minutes) => (
            <option key={minutes} value={minutes}>
              {durMinutes(minutes)}
            </option>
          ))}
        </Select>
      );
    }
    if (preview.id === "setting-form4a-warn") {
      return (
        <span className={styles.previewRange}>
          <input
            id="setting-form4a-warn"
            type="range"
            min={1}
            max={12}
            step={1}
            value={statutoryWarningHours}
            aria-disabled="true"
            aria-describedby="setting-form4a-warn-desc"
            onChange={notWired}
            className={styles.rangeInput}
            aria-label={name}
          />
          <span className={styles.previewValue}>{`${statutoryWarningHours}h`}</span>
        </span>
      );
    }
    return (
      <label className={styles.switchToggle}>
        <input
          type="checkbox"
          checked={previewChecked[preview.id] ?? false}
          aria-disabled="true"
          onChange={notWired}
          aria-label={name}
        />
        <span className={styles.switchSlider} />
      </label>
    );
  };

  return (
    <div className={styles.screen} data-testid="ward-settings-screen" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        {/* Apple/ChatGPT-style Sovereign Settings Header & Clinical Profile */}
        <header className={styles.pageHeader}>
          {/* Accessible Level-1 Heading for Screen Readers and Contract Compliance */}
          <h1 className={styles.srOnly} aria-label="Settings">
            Settings
          </h1>

          {/* v6 Settings (7 Oct 2026): the operator and the SAVED rules on one hero band. The draft below
              never feeds these figures. */}
          <Hero
            className={styles.operatorHero}
            eyebrow="Duty coordinator"
            title={
              <span className={styles.operatorName}>
                <span className={styles.operatorAvatar} aria-hidden="true">
                  SC
                </span>
                Dr S. Chen
              </span>
            }
            titleMeta="Perth Central Desk"
            stats={
              <>
                <HeroStat value={`${configuration.edAccessTargetMinutes / 60}h`} label="ED target" />
                <HeroStat value={configuration.parallelReferralCap} label="Wards asked" />
                <HeroStat value={durMinutes(configuration.pullHoldMinutes)} label="Pull hold" />
                <HeroStat
                  value={clock24(configuration.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES)}
                  label="Morning count"
                />
                <HeroStat
                  value={savedSurge ? "Surge" : "Standard"}
                  label="Mode"
                  tone={savedSurge ? "warning" : undefined}
                />
              </>
            }
            aside={
              <>
                <div className={styles.userProfileWrap} ref={profileRef}>
                  <button
                    type="button"
                    className={buttonClass({ variant: "onHero", size: "sm" })}
                    id="userProfileBtn"
                    data-testid="clinical-operator-profile"
                    aria-haspopup="dialog"
                    aria-expanded={isProfileOpen}
                    aria-controls="profilePopover"
                    onClick={() => setIsProfileOpen((v) => !v)}
                    title="Clinical Operator Profile · Dr S. Chen"
                  >
                    <span>Delegation</span>
                    <ChevronDown size={13} className={styles.userChevron} aria-hidden="true" />
                  </button>

                  {isProfileOpen && (
                    <div
                      className={styles.profilePopover}
                      id="profilePopover"
                      data-testid="profile-popover"
                      role="dialog"
                      aria-label="Operator Profile Details"
                    >
                      <div className={styles.popoverHdr}>
                        <div className={styles.popoverAvatar}>SC</div>
                        <div className={styles.popoverIdentity}>
                          <span className={styles.popoverName}>Dr S. Chen (MBBS, FRANZCP)</span>
                          <span className={styles.popoverSub}>Consultant Psychiatrist · State Bed Desk</span>
                          <span className={styles.popoverBadgeGood}>Active Session · On Duty</span>
                        </div>
                      </div>
                      <div className={styles.popoverBody}>
                        <div className={styles.popoverSection}>
                          <span className={styles.popoverLabel}>CLINICAL DELEGATION</span>
                          <div className={styles.popoverRow}>
                            <span>Where they work:</span>
                            <span>Statewide Bed Desk</span>
                          </div>
                          <div className={styles.popoverRow}>
                            <span>Clinical Governance:</span>
                            <span>SMHS &amp; WACHS Liaison</span>
                          </div>
                          <div className={styles.popoverRow}>
                            <span>Legal Forms:</span>
                            <span className="mono">Forms 1A, 4A, 6A</span>
                          </div>
                          <div className={styles.popoverRow}>
                            <span>AHPRA Number:</span>
                            <span className="mono">MED0001892041</span>
                          </div>
                          <div className={styles.popoverRow}>
                            <span>Shift Schedule:</span>
                            <span className="mono">08:00–16:30 AWST</span>
                          </div>
                        </div>
                        <div className={styles.popoverActions}>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            style={{ flex: 1 }}
                            onClick={() => showToast("Verify authority is not wired in this prototype.")}
                          >
                            Verify Authority
                          </button>
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            style={{ flex: 1 }}
                            onClick={() => {
                              setIsOperatorModalOpen(true);
                              setIsProfileOpen(false);
                            }}
                          >
                            Switch Operator
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={buttonClass({ variant: "light", size: "sm" })}
                  onClick={() => setIsOperatorModalOpen(true)}
                >
                  Switch operator
                </button>
              </>
            }
          />

          <div className={styles.toolbar} data-testid="settings-telemetry-ribbon">
            {/* v6 Settings (7 Oct 2026): filter and domain choice sit in one toolbar row. */}
            <nav
              className={styles.categoryRail}
              data-testid="ward-settings-category-rail"
              aria-label="Settings Categories"
            >
              {/* Integrated Sidebar Search */}
              <div className={styles.sidebarSearchWrap}>
                <div className={styles.searchInputWrap}>
                  <Search className={styles.sidebarSearchIcon} size={15} aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    id="sidebarSearchInput"
                    name="sidebarSearchInput"
                    data-testid="sidebar-search-input"
                    type="text"
                    className={styles.sidebarSearchInput}
                    placeholder="Filter settings"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                    aria-label="Filter settings by keyword"
                  />
                  {searchQuery.length === 0 ? (
                    <span className={styles.searchKbd} aria-hidden="true">
                      /
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.searchClear}
                      onClick={() => {
                        setSearchQuery("");
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear filter query"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Live search match feedback */}
                {searchQuery.trim().length > 0 && (
                  <div className={styles.searchFeedback} role="status" aria-live="polite">
                    {totalMatches > 0 ? (
                      <span className={styles.searchFeedbackText}>
                        Showing <strong>{totalMatches}</strong> of {SETTINGS_SEARCH_ENTRIES.length} prototype entries
                      </span>
                    ) : (
                      <div className={styles.searchFeedbackZeroWrap}>
                        <span className={styles.searchFeedbackZero}>No settings match &ldquo;{searchQuery}&rdquo;</span>
                        <button
                          type="button"
                          className={styles.searchFeedbackClearLink}
                          onClick={() => {
                            setSearchQuery("");
                            searchInputRef.current?.focus();
                          }}
                        >
                          Clear filter
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Domain match pills when filtering is active */}
                {searchQuery.trim().length > 0 && totalMatches > 0 && (
                  <div className={styles.domainFilterPills} role="group" aria-label="Filter results by domain">
                    {SETTINGS_DOMAINS.map((domain) => {
                      const count = domainMatchCounts[domain.id];
                      if (count === 0) return null;
                      const isSelected = activeDomain === domain.id;
                      return (
                        <a
                          key={domain.id}
                          href={`#${domain.id}`}
                          className={`${styles.filterPill} ${isSelected ? styles.filterPillActive : ""}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleDomainClick(domain.id);
                          }}
                          title={`Jump to ${domain.navLabel} (${count} matches)`}
                        >
                          <span>{domain.navLabel.split(" ")[0]}</span>
                          <span className={styles.filterPillCount}>{count}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={styles.catListScroll}>
                <button
                  type="button"
                  className={styles.catItem}
                  aria-current={activeDomain === "all"}
                  onClick={() => handleDomainClick("all")}
                >
                  <span className={styles.catTitle}>All</span>
                  <span className={styles.catCount}>{totalMatches}</span>
                </button>

                {SETTINGS_DOMAINS.map((domain) => {
                  const count = domainMatchCounts[domain.id];
                  return (
                    <button
                      key={domain.id}
                      type="button"
                      className={styles.catItem}
                      aria-current={activeDomain === domain.id}
                      onClick={() => handleDomainClick(domain.id)}
                    >
                      <span className={styles.catTitle} title={domain.navLabel}>
                        {DOMAIN_CHIP_LABEL[domain.id] ?? domain.navLabel}
                      </span>
                      <span className={styles.catCount}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
            <div className={styles.toolbarActions}>
              {hasUnsavedRules ? (
                <div className={styles.toolbarStatus} role="status">
                  <StatusGlyph tone="warning" size={9} />
                  <span>Unsaved changes — Save coordination rules to apply.</span>
                </div>
              ) : savedSurge ? (
                <span className={styles.toolbarStatus}>
                  <StatusGlyph tone="warning" size={9} />
                  Surge values saved
                </span>
              ) : (
                <span className={styles.toolbarStatus}>
                  <StatusGlyph tone="success" size={9} />
                  Current saved rules
                </span>
              )}

              <button
                type="button"
                className={buttonClass({ variant: isSurge ? "tint" : "ghost", size: "sm" })}
                onClick={handleToggleSurge}
                aria-pressed={isSurge}
                title="Select surge values in the unsaved draft"
              >
                <Plus size={13} aria-hidden="true" />
                <span>{isSurge ? "Surge values selected" : "Select surge values"}</span>
              </button>

              <button
                type="button"
                className={buttonClass({ variant: "ghost", size: "sm" })}
                onClick={() => setIsResetModalOpen(true)}
                aria-haspopup="dialog"
                title="Restore all defaults"
              >
                <RotateCcw size={13} aria-hidden="true" />
                <span>Restore all defaults</span>
              </button>

              <button
                type="button"
                className={buttonClass({ variant: "pri", size: "sm" })}
                onClick={handleSave}
                title="Save coordination rules"
              >
                <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                <span>Save coordination rules</span>
              </button>
            </div>
          </div>
        </header>

        {configurationRejection && (
          <div
            className={styles.calloutCard}
            data-tone="warn"
            role="alert"
            data-testid="ward-settings-configuration-refused"
          >
            <strong className={styles.calloutTitle}>Configuration change refused</strong>
            <p className={styles.calloutText}>{configurationRejection.reason}</p>
          </div>
        )}

        {/* v6 Settings (7 Oct 2026): the section bodies are cards on a two-column grid, then the
            full-width previews, defaults, thresholds and roles. Each domain's scroll anchor sits on its
            first visible card or row, so the category chips and the scrollspy still find it. */}
        <div className={styles.settingsSurface}>
          <div className={styles.settingsBody}>
            <div className={styles.contentPane}>
              {totalMatches === 0 ? (
                <div className={styles.emptySearchState} role="status">
                  <Search className={styles.emptySearchIcon} size={36} aria-hidden="true" />
                  <h3 className={styles.emptySearchTitle}>No matching settings</h3>
                  <p className={styles.emptySearchText}>
                    No configuration parameter matches &quot;{searchQuery}&quot;.
                  </p>
                  <button type="button" className={styles.btnSecondary} onClick={() => setSearchQuery("")}>
                    Clear Filter
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.cardGrid}>
                    <div className={styles.cardColumn}>
                      {timingsVisible && (
                        <Card id={anchorId("timings")} aria-labelledby="timings-title">
                          <CardHead
                            id="timings-title"
                            icon={Clock}
                            title="Busy-day timings"
                            action={
                              <Segmented
                                label="Timing set"
                                items={[
                                  { id: "standard", label: "Standard" },
                                  { id: "surge", label: "Surge" },
                                ]}
                                value={isSurge ? "surge" : "standard"}
                                onChange={(choice) => {
                                  if ((choice === "surge") !== isSurge) handleToggleSurge();
                                }}
                              />
                            }
                          />
                          <div className={styles.ruleColumns} aria-hidden="true">
                            <span>Rule</span>
                            <span>Value</span>
                            <span>Range</span>
                            <span className={styles.ruleColumnEnd}>Effect now</span>
                          </div>
                          {isRowVisible("setting-ed-threshold") && (
                            <RuleRow
                              title="ED wait target"
                              sub="Access measure only"
                              stepper={{
                                decreaseLabel: "Decrease ED access target",
                                increaseLabel: "Increase ED access target",
                                display: `${draft.edAccessTargetMinutes / 60}h`,
                                atMin: draft.edAccessTargetMinutes <= ED_ACCESS_TARGET_RANGE_MINUTES.min,
                                atMax: draft.edAccessTargetMinutes >= ED_ACCESS_TARGET_RANGE_MINUTES.max,
                                onDecrease: () =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    edAccessTargetMinutes: Math.max(
                                      ED_ACCESS_TARGET_RANGE_MINUTES.min,
                                      curr.edAccessTargetMinutes - ED_ACCESS_TARGET_RANGE_MINUTES.step,
                                    ),
                                  })),
                                onIncrease: () =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    edAccessTargetMinutes: Math.min(
                                      ED_ACCESS_TARGET_RANGE_MINUTES.max,
                                      curr.edAccessTargetMinutes + ED_ACCESS_TARGET_RANGE_MINUTES.step,
                                    ),
                                  })),
                              }}
                              range={{
                                id: "setting-ed-threshold",
                                min: ED_ACCESS_TARGET_RANGE_MINUTES.min,
                                max: ED_ACCESS_TARGET_RANGE_MINUTES.max,
                                step: ED_ACCESS_TARGET_RANGE_MINUTES.step,
                                value: draft.edAccessTargetMinutes,
                                ariaLabel: "ED access target in hours",
                                minLabel: `${ED_ACCESS_TARGET_RANGE_MINUTES.min / 60}h`,
                                maxLabel: `${ED_ACCESS_TARGET_RANGE_MINUTES.max / 60}h`,
                                onChange: (minutes) =>
                                  setDraft((current) => ({ ...current, edAccessTargetMinutes: minutes })),
                              }}
                              effect={
                                <>
                                  <span className={styles.effectLine}>
                                    <StatusGlyph tone={draftEdOver > 0 ? "warning" : "success"} size={9} />
                                    {draftEdOver > 0 ? `${draftEdOver} over` : "None over"}
                                    {draftEdOver !== savedEdOver
                                      ? `, ${draftEdOver > savedEdOver ? "+" : ""}${draftEdOver - savedEdOver}`
                                      : null}
                                  </span>
                                  <span className={styles.savedLine}>
                                    {savedText(
                                      draft.edAccessTargetMinutes === configuration.edAccessTargetMinutes,
                                      `${configuration.edAccessTargetMinutes / 60}h`,
                                    )}
                                  </span>
                                </>
                              }
                            />
                          )}
                          {isRowVisible("setting-parallel-cap") && (
                            <RuleRow
                              title="Wards asked at once"
                              sub="Parallel referral cap"
                              stepper={{
                                decreaseLabel: "Decrease parallel referral enquiry limit",
                                increaseLabel: "Increase parallel referral enquiry limit",
                                display: wardsText(draft.parallelReferralCap),
                                atMin: draft.parallelReferralCap <= PARALLEL_REFERRAL_CAP_RANGE.min,
                                atMax: draft.parallelReferralCap >= PARALLEL_REFERRAL_CAP_RANGE.max,
                                onDecrease: () =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    parallelReferralCap: Math.max(
                                      PARALLEL_REFERRAL_CAP_RANGE.min,
                                      curr.parallelReferralCap - PARALLEL_REFERRAL_CAP_RANGE.step,
                                    ),
                                  })),
                                onIncrease: () =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    parallelReferralCap: Math.min(
                                      PARALLEL_REFERRAL_CAP_RANGE.max,
                                      curr.parallelReferralCap + PARALLEL_REFERRAL_CAP_RANGE.step,
                                    ),
                                  })),
                              }}
                              range={{
                                id: "setting-parallel-cap",
                                min: PARALLEL_REFERRAL_CAP_RANGE.min,
                                max: PARALLEL_REFERRAL_CAP_RANGE.max,
                                step: PARALLEL_REFERRAL_CAP_RANGE.step,
                                value: draft.parallelReferralCap,
                                ariaLabel: "Parallel referral cap in units",
                                minLabel: wardsText(PARALLEL_REFERRAL_CAP_RANGE.min),
                                maxLabel: wardsText(PARALLEL_REFERRAL_CAP_RANGE.max),
                                onChange: (units) =>
                                  setDraft((current) => ({ ...current, parallelReferralCap: units })),
                              }}
                              effect={
                                <span className={styles.savedLine}>
                                  {savedText(
                                    draft.parallelReferralCap === configuration.parallelReferralCap,
                                    wardsText(configuration.parallelReferralCap),
                                  )}
                                </span>
                              }
                            />
                          )}
                          {isRowVisible("setting-hold-duration") && (
                            <RuleRow
                              title="Pull hold"
                              sub="Before a held bed returns"
                              stepper={{
                                decreaseLabel: "Decrease pulled bed hold duration",
                                increaseLabel: "Increase pulled bed hold duration",
                                display: durMinutes(draft.pullHoldMinutes),
                                atMin: draft.pullHoldMinutes <= PULL_HOLD_RANGE_MINUTES.min,
                                atMax: draft.pullHoldMinutes >= PULL_HOLD_RANGE_MINUTES.max,
                                onDecrease: () =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    pullHoldMinutes: Math.max(
                                      PULL_HOLD_RANGE_MINUTES.min,
                                      curr.pullHoldMinutes - PULL_HOLD_RANGE_MINUTES.step,
                                    ),
                                  })),
                                onIncrease: () =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    pullHoldMinutes: Math.min(
                                      PULL_HOLD_RANGE_MINUTES.max,
                                      curr.pullHoldMinutes + PULL_HOLD_RANGE_MINUTES.step,
                                    ),
                                  })),
                              }}
                              range={{
                                id: "setting-hold-duration",
                                min: PULL_HOLD_RANGE_MINUTES.min,
                                max: PULL_HOLD_RANGE_MINUTES.max,
                                step: PULL_HOLD_RANGE_MINUTES.step,
                                value: draft.pullHoldMinutes,
                                ariaLabel: "Pulled bed reservation hold duration in minutes",
                                minLabel: durMinutes(PULL_HOLD_RANGE_MINUTES.min),
                                maxLabel: durMinutes(PULL_HOLD_RANGE_MINUTES.max),
                                onChange: (minutes) =>
                                  setDraft((current) => ({ ...current, pullHoldMinutes: minutes })),
                              }}
                              effect={
                                <span className={styles.savedLine}>
                                  {savedText(
                                    draft.pullHoldMinutes === configuration.pullHoldMinutes,
                                    durMinutes(configuration.pullHoldMinutes),
                                  )}
                                </span>
                              }
                            />
                          )}
                          {isRowVisible("setting-morning-rollup") && (
                            <RuleRow
                              testId="setting-morning-rollup-row"
                              title="Morning count"
                              sub="Your default, not a legal limit"
                              subTestId="setting-morning-rollup-desc"
                              stepper={{
                                decreaseLabel: "Decrease morning rollup deadline",
                                increaseLabel: "Increase morning rollup deadline",
                                display: clock24(draftRollup),
                                displayTestId: "morning-rollup-display",
                                atMin: draftRollup <= MORNING_COUNT_RANGE.min,
                                atMax: draftRollup >= MORNING_COUNT_RANGE.max,
                                onDecrease: () =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    morningRollupDeadlineMinutes: Math.max(
                                      MORNING_COUNT_RANGE.min,
                                      (curr.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES) -
                                        MORNING_COUNT_RANGE.step,
                                    ),
                                  })),
                                onIncrease: () =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    morningRollupDeadlineMinutes: Math.min(
                                      MORNING_COUNT_RANGE.max,
                                      (curr.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES) +
                                        MORNING_COUNT_RANGE.step,
                                    ),
                                  })),
                              }}
                              range={{
                                id: "setting-morning-rollup-slider",
                                min: MORNING_COUNT_RANGE.min,
                                max: MORNING_COUNT_RANGE.max,
                                step: MORNING_COUNT_RANGE.step,
                                value: draftRollup,
                                ariaLabel: "Morning rollup deadline in minutes from midnight",
                                minLabel: clock24(MORNING_COUNT_RANGE.min),
                                maxLabel: clock24(MORNING_COUNT_RANGE.max),
                                onChange: (minutes) =>
                                  setDraft((curr) => ({ ...curr, morningRollupDeadlineMinutes: minutes })),
                              }}
                              effect={
                                <span className={styles.savedLine}>
                                  {savedText(draftRollup === savedRollup, clock24(savedRollup))}
                                </span>
                              }
                            />
                          )}
                        </Card>
                      )}

                      {warningsVisible && (
                        <Card id={anchorId("warnings")} aria-labelledby="warnings-title">
                          <CardHead id="warnings-title" icon={Gavel} title="Form warning times" />
                          {isRowVisible("setting-due-soon-urgent") && (
                            <RuleRow
                              testId="setting-due-soon-urgent-row"
                              title="First warning before a legal due time"
                              sub="Shows a recorded legal due time as due within this time. Your default, not a legal limit."
                              subTestId="setting-due-soon-urgent-desc"
                              stepper={{
                                decreaseLabel: "Decrease first warning before a legal due time",
                                increaseLabel: "Increase first warning before a legal due time",
                                display: formatDueSoonDuration(draftUrgent),
                                displayTestId: "due-soon-urgent-display",
                                atMin: draftUrgent <= DUE_SOON_URGENT_RANGE_MINUTES.min,
                                atMax: draftUrgent >= clampDueSoonUrgent(DUE_SOON_URGENT_RANGE_MINUTES.max, draftSoon),
                                onDecrease: () =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    dueSoonUrgentMinutes: clampDueSoonUrgent(
                                      (curr.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES) -
                                        DUE_SOON_URGENT_RANGE_MINUTES.step,
                                      curr.dueSoonMinutes ?? DUE_SOON_MINUTES,
                                    ),
                                  })),
                                onIncrease: () =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    dueSoonUrgentMinutes: clampDueSoonUrgent(
                                      (curr.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES) +
                                        DUE_SOON_URGENT_RANGE_MINUTES.step,
                                      curr.dueSoonMinutes ?? DUE_SOON_MINUTES,
                                    ),
                                  })),
                              }}
                              range={{
                                id: "setting-due-soon-urgent",
                                min: DUE_SOON_URGENT_RANGE_MINUTES.min,
                                max: DUE_SOON_URGENT_RANGE_MINUTES.max,
                                step: DUE_SOON_URGENT_RANGE_MINUTES.step,
                                value: draftUrgent,
                                ariaLabel: "First warning before a legal due time",
                                minLabel: formatDueSoonDuration(DUE_SOON_URGENT_RANGE_MINUTES.min),
                                maxLabel: formatDueSoonDuration(DUE_SOON_URGENT_RANGE_MINUTES.max),
                                onChange: (minutes) =>
                                  setDraft((current) => ({
                                    ...current,
                                    dueSoonUrgentMinutes: clampDueSoonUrgent(
                                      minutes,
                                      current.dueSoonMinutes ?? DUE_SOON_MINUTES,
                                    ),
                                  })),
                              }}
                            />
                          )}
                          {isRowVisible("setting-due-soon") && (
                            <RuleRow
                              testId="setting-due-soon-row"
                              title="Second warning before a legal due time"
                              sub="Shows a recorded legal due time as due soon from this time. Your default, not a legal limit."
                              subTestId="setting-due-soon-desc"
                              stepper={{
                                decreaseLabel: "Decrease second warning before a legal due time",
                                increaseLabel: "Increase second warning before a legal due time",
                                display: formatDueSoonDuration(draftSoon),
                                displayTestId: "due-soon-display",
                                atMin: draftSoon <= DUE_SOON_RANGE_MINUTES.min,
                                atMax: draftSoon >= DUE_SOON_RANGE_MINUTES.max,
                                onDecrease: () =>
                                  setDraft((curr) => {
                                    const nextSoon = Math.max(
                                      DUE_SOON_RANGE_MINUTES.min,
                                      (curr.dueSoonMinutes ?? DUE_SOON_MINUTES) - DUE_SOON_RANGE_MINUTES.step,
                                    );
                                    return {
                                      ...curr,
                                      dueSoonMinutes: nextSoon,
                                      dueSoonUrgentMinutes: clampDueSoonUrgent(
                                        curr.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES,
                                        nextSoon,
                                      ),
                                    };
                                  }),
                                onIncrease: () =>
                                  setDraft((curr) => {
                                    const nextSoon = Math.min(
                                      DUE_SOON_RANGE_MINUTES.max,
                                      (curr.dueSoonMinutes ?? DUE_SOON_MINUTES) + DUE_SOON_RANGE_MINUTES.step,
                                    );
                                    return {
                                      ...curr,
                                      dueSoonMinutes: nextSoon,
                                      dueSoonUrgentMinutes: clampDueSoonUrgent(
                                        curr.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES,
                                        nextSoon,
                                      ),
                                    };
                                  }),
                              }}
                              range={{
                                id: "setting-due-soon",
                                min: DUE_SOON_RANGE_MINUTES.min,
                                max: DUE_SOON_RANGE_MINUTES.max,
                                step: DUE_SOON_RANGE_MINUTES.step,
                                value: draftSoon,
                                ariaLabel: "Second warning before a legal due time",
                                minLabel: formatDueSoonDuration(DUE_SOON_RANGE_MINUTES.min),
                                maxLabel: formatDueSoonDuration(DUE_SOON_RANGE_MINUTES.max),
                                onChange: (minutes) =>
                                  setDraft((current) => ({
                                    ...current,
                                    dueSoonMinutes: minutes,
                                    dueSoonUrgentMinutes: clampDueSoonUrgent(
                                      current.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES,
                                      minutes,
                                    ),
                                  })),
                              }}
                            />
                          )}
                          {/* The two warnings on one window, read from the draft: calm, then due soon,
                              then the first warning, up to the due time. */}
                          <div className={styles.cascade} aria-hidden="true">
                            <div className={styles.cascadeTrack}>
                              <span
                                className={styles.cascadeCalm}
                                style={{ flexGrow: Math.max(0, DUE_SOON_RANGE_MINUTES.max - draftSoon) }}
                              />
                              <span
                                className={styles.cascadeSoon}
                                style={{ flexGrow: Math.max(0, draftSoon - draftUrgent) }}
                              />
                              <span className={styles.cascadeUrgent} style={{ flexGrow: draftUrgent }} />
                            </div>
                            <div className={styles.cascadeEnds}>
                              <span className={styles.cascadeStart}>
                                T - {formatDueSoonDuration(DUE_SOON_RANGE_MINUTES.max)}
                              </span>
                              <span style={{ flexGrow: Math.max(0, DUE_SOON_RANGE_MINUTES.max - draftSoon) }}>
                                {formatDueSoonDuration(draftSoon)}
                              </span>
                              <span style={{ flexGrow: Math.max(0, draftSoon - draftUrgent) }}>
                                {formatDueSoonDuration(draftUrgent)}
                              </span>
                              <span style={{ flexGrow: draftUrgent }}>0</span>
                            </div>
                          </div>
                        </Card>
                      )}

                      {browserVisible && (
                        <Card
                          id={anchorId("browser")}
                          aria-labelledby="browser-title"
                          data-testid="ward-settings-storage-telemetry"
                        >
                          <CardHead id="browser-title" icon={Database} title="This browser" />
                          <div className={styles.statRow}>
                            <div className={styles.statItem}>
                              <strong className={styles.statValue}>{storageEstimate.usedFormatted}</strong>
                              <span className={styles.statLabel}>of {storageEstimate.quotaFormatted} used</span>
                            </div>
                            <div className={styles.statItem}>
                              <strong className={styles.statValue}>{movements.length}</strong>
                              <span className={styles.statLabel}>Movements held</span>
                            </div>
                            <div className={styles.statItem}>
                              <strong className={styles.statValue}>{eventLog.length}</strong>
                              <span className={styles.statLabel}>Events recorded this session</span>
                            </div>
                          </div>
                          {isRowVisible("setting-default-service") && (
                            <div className={styles.listRow} data-testid="ward-settings-default-service">
                              <span className={styles.ruleText}>
                                <span className={styles.ruleTitle}>Default service</span>
                                <span className={styles.ruleSub}>Not saved, set from the bar</span>
                              </span>
                              <span className={styles.readout}>All services</span>
                            </div>
                          )}
                          {isRowVisible("setting-handover-sheet") && (
                            <div className={styles.listRow} data-testid="ward-settings-handover">
                              <span className={styles.ruleText}>
                                <span className={styles.ruleTitle}>Handover sheet</span>
                                <span className={styles.ruleSub} title={HANDOVER_SHEET_SECTIONS}>
                                  Built on demand: {HANDOVER_SHEET_SECTIONS}
                                </span>
                              </span>
                              <Link
                                className={buttonClass({ variant: "sec", size: "sm" })}
                                href="/mockups/ward-flow/handover"
                              >
                                Open handover
                              </Link>
                            </div>
                          )}
                          {isRowVisible("setting-demonstration-data") && (
                            <div className={styles.listRow} data-testid="ward-settings-demonstration">
                              <span className={styles.ruleText}>
                                <span className={styles.ruleTitle}>Demonstration data</span>
                                <span className={styles.ruleSub}>
                                  Clock, scenario and reset are in Tools in the bar
                                </span>
                              </span>
                            </div>
                          )}
                          <div className={styles.browserFoot}>
                            <button
                              type="button"
                              className={buttonClass({ variant: "sec", size: "sm" })}
                              onClick={handleExportConfig}
                              title="Download the configuration as JSON"
                              data-testid="btn-export-config"
                            >
                              <Download size={14} aria-hidden="true" />
                              <span>Export</span>
                            </button>
                            <label
                              className={buttonClass({ variant: "sec", size: "sm" })}
                              title="Load a configuration JSON into the draft"
                            >
                              <Upload size={14} aria-hidden="true" />
                              <span>Import</span>
                              <input
                                type="file"
                                accept=".json,application/json"
                                className={styles.hiddenFileInput}
                                onChange={handleImportConfig}
                                data-testid="input-import-config"
                              />
                            </label>
                            <button
                              type="button"
                              className={buttonClass({ variant: "ghost", size: "sm" })}
                              onClick={handleClearTransientCache}
                              title="Clear session drafts and the search history"
                              data-testid="btn-clear-cache"
                            >
                              Clear cache
                            </button>
                            <button
                              type="button"
                              className={buttonClass({ variant: "danger", size: "sm", className: styles.footEnd })}
                              onClick={() => setIsResetModalOpen(true)}
                              aria-haspopup="dialog"
                              aria-label="Restore all defaults"
                              data-testid="btn-restore-baseline"
                            >
                              Restore all defaults
                            </button>
                          </div>
                        </Card>
                      )}
                    </div>

                    <div className={styles.cardColumn}>
                      {displayVisible && (
                        <Card id={anchorId("display")} aria-labelledby="display-title">
                          <CardHead id="display-title" icon={Palette} title="Display and alerts" />
                          {lookVisible && (
                            <>
                              {isRowVisible("setting-appearance-theme") && (
                                <div className={styles.listRow} data-testid="ward-settings-appearance">
                                  <span className={styles.ruleText}>
                                    <span className={styles.ruleTitle}>Theme</span>
                                  </span>
                                  <div className={styles.segGroup} role="group" aria-label="Appearance">
                                    {APPEARANCE_CHOICES.map((choice) => {
                                      const isSelected = appearance === choice.value;
                                      return (
                                        <button
                                          key={choice.value}
                                          type="button"
                                          className={styles.segOption}
                                          aria-pressed={isSelected}
                                          aria-label={choice.label}
                                          data-testid={`ward-settings-appearance-${choice.value}`}
                                          onClick={() => {
                                            applyAppearance(choice.value);
                                            showToast(`Theme set to ${choice.label}.`);
                                          }}
                                        >
                                          {choice.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {isRowVisible("setting-rail-density") && (
                                <div className={styles.listRow} data-testid="ward-settings-rail">
                                  <span className={styles.ruleText}>
                                    <span className={styles.ruleTitle}>Sidebar</span>
                                    <span className={styles.ruleSub} data-testid="ward-settings-rail-now">
                                      {railOpen ? "Open, full names" : "Closed, icons only"}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    className={buttonClass({ variant: "sec", size: "sm" })}
                                    data-testid="ward-settings-rail-toggle"
                                    onClick={() => {
                                      const next = !railOpen;
                                      setRailOpenPreference(next);
                                      showToast(`Navigation rail set to ${next ? "Open" : "Closed"}.`);
                                    }}
                                  >
                                    {railOpen ? "Close the rail" : "Open the rail"}
                                  </button>
                                </div>
                              )}
                              <div className={styles.listRow}>
                                <Switch
                                  block
                                  checked={reducedMotion}
                                  onCheckedChange={handleToggleReducedMotion}
                                  label={<SwitchText title="Reduce motion" sub="Stops interface animation" />}
                                />
                              </div>
                              <div className={styles.listRow}>
                                <Switch
                                  block
                                  checked={highContrast}
                                  onCheckedChange={handleToggleHighContrast}
                                  label={<SwitchText title="High contrast" sub="Stronger edges and ink" />}
                                />
                              </div>
                              <div className={styles.listRow}>
                                <span className={styles.ruleText}>
                                  <span className={styles.ruleTitle}>Tabular figures</span>
                                  <span className={styles.ruleSub}>Timers keep their width</span>
                                </span>
                                <span className={styles.readout}>
                                  <StatusGlyph tone="success" size={9} />
                                  Always on
                                </span>
                              </div>
                            </>
                          )}
                          {alertsVisible && (
                            <div id={anchorId("alerts")}>
                              {isRowVisible("setting-buzz-alert") && (
                                <div className={styles.listRow} data-testid="setting-buzz-alert-row">
                                  <Switch
                                    block
                                    checked={audioBuzzAlerts}
                                    onCheckedChange={(next) => {
                                      setAudioBuzzAlerts(next);
                                      setAudioBuzzPreference(next);
                                      showToast(next ? "Buzz sound on." : "Buzz sound off.");
                                    }}
                                    label={
                                      <SwitchText
                                        title="Buzz sound"
                                        sub="Chime and flash on an urgent buzz"
                                        subTestId="setting-buzz-alert-desc"
                                      />
                                    }
                                  />
                                </div>
                              )}
                              {isRowVisible("setting-wallboard-refresh") && (
                                <div className={styles.listRow} data-testid="setting-wallboard-refresh-row">
                                  <span className={styles.ruleText}>
                                    <span className={styles.ruleTitle}>Board refresh</span>
                                    <span className={styles.ruleSub} data-testid="setting-wallboard-refresh-desc">
                                      {NOT_WIRED}
                                    </span>
                                  </span>
                                  <div role="group" aria-label="Board refresh">
                                    {BOARD_REFRESH_CHOICES.map((choice) => (
                                      <button
                                        key={String(choice.value)}
                                        type="button"
                                        aria-disabled="true"
                                        onClick={() => showToast(NOT_WIRED)}
                                        className={buttonClass({ variant: "ghost", size: "sm" })}
                                      >
                                        {choice.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      )}

                      {!filtering && (
                        <Card aria-labelledby="changes-title" data-testid="ward-settings-recent-changes">
                          <CardHead
                            id="changes-title"
                            icon={History}
                            title="Recent changes"
                            action={
                              <Link
                                className={buttonClass({ variant: "ghost", size: "sm" })}
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
                      )}

                      {shortcutsVisible && (
                        <Card id={anchorId("shortcuts")} aria-labelledby="shortcuts-title">
                          <CardHead id="shortcuts-title" icon={Keyboard} title="Shortcuts and search" />
                          {isRowVisible("setting-keyboard-shortcuts") && (
                            <ul className={styles.kbdList} aria-label="Keyboard shortcuts">
                              {KEYBOARD_SHORTCUTS.map((shortcut) => (
                                <li key={shortcut.label} className={styles.kbdRow}>
                                  <span>{shortcut.label}</span>
                                  <span className={styles.kbdKeys}>
                                    {shortcut.keys.map((key) => (
                                      <Kbd key={key}>{key}</Kbd>
                                    ))}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {isRowVisible("setting-search-ledger") && (
                            <div className={styles.recentRow}>
                              <span className={styles.recentLabel}>Recent</span>
                              {searchHistory.length > 0 ? (
                                <span className={styles.recentChips}>
                                  {searchHistory.map((query) => (
                                    <button
                                      key={query}
                                      type="button"
                                      className={styles.recentChip}
                                      onClick={() => {
                                        setSearchQuery(query);
                                        searchInputRef.current?.focus();
                                      }}
                                      title={`Filter settings by "${query}"`}
                                    >
                                      {query}
                                    </button>
                                  ))}
                                </span>
                              ) : (
                                <span className={styles.recentEmpty}>No recent searches</span>
                              )}
                              {searchHistory.length > 0 && (
                                <button
                                  type="button"
                                  className={buttonClass({ variant: "ghost", size: "sm", className: styles.footEnd })}
                                  onClick={handleClearLedger}
                                  title="Clear the recent searches"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          )}
                        </Card>
                      )}
                    </div>
                  </div>

                  {visiblePreviews.length > 0 && (
                    <Card aria-labelledby="previews-title">
                      <CardHead
                        id="previews-title"
                        icon={ListChecks}
                        title="Prototype previews"
                        aside={<span className={styles.headMeta}>Not wired in this prototype</span>}
                      />
                      <div className={styles.previewGrid}>
                        {visiblePreviews.map((preview) => (
                          <div
                            key={preview.id}
                            id={anchorId(preview.id)}
                            className={styles.previewItem}
                            data-testid={`${preview.id}-row`}
                          >
                            <span className={styles.ruleText}>
                              <span className={styles.ruleTitle}>{preview.title}</span>
                              <span
                                className={styles.ruleSub}
                                id={`${preview.id}-desc`}
                                data-testid={`${preview.id}-desc`}
                              >
                                {preview.sub}
                                <SrOnly>. {NOT_WIRED}</SrOnly>
                              </span>
                            </span>
                            <span className={styles.previewMark}>
                              <StatusGlyph tone="neutral" size={9} />
                              Preview
                            </span>
                            {previewControl(preview)}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {isRowVisible("setting-operational-defaults") && (
                    <Card id={anchorId("defaults")} aria-labelledby="defaults-title">
                      <CardHead
                        id="defaults-title"
                        icon={SlidersHorizontal}
                        title="Operational defaults"
                        meta={`${OPERATIONAL_DEFAULTS.length} fixed in code`}
                      />
                      <dl className={styles.defaultsGrid} aria-label="Operational defaults table">
                        {OPERATIONAL_DEFAULTS.map((item) => (
                          <div
                            key={item.name}
                            className={styles.defaultsItem}
                            data-testid={`ward-settings-operational-default-${item.name}`}
                          >
                            <dt className={styles.defaultsName}>{item.name}</dt>
                            <dd className={styles.defaultsValue}>{item.display}</dd>
                          </div>
                        ))}
                      </dl>
                    </Card>
                  )}

                  {isRowVisible("setting-published-thresholds") && (
                    <Card
                      id={anchorId("thresholds")}
                      aria-labelledby="thresholds-title"
                      data-testid="ward-settings-thresholds"
                    >
                      <CardHead id="thresholds-title" icon={Gauge} title="Thresholds" />
                      <p className={styles.cardNote} data-tone="accent">
                        Figures here change only through the controls above, and every change is recorded.
                      </p>
                      <div className={styles.tableWrap} role="region" aria-label="Published thresholds" tabIndex={0}>
                        <table className={`${styles.table} ${styles.cardTable}`}>
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
                                    <StatusGlyph
                                      tone={threshold.state === "fires-now" ? "warning" : "neutral"}
                                      size={9}
                                    />
                                    {THRESHOLD_STATE_WORDS[threshold.state]}
                                    {threshold.state === "fires-now" ? `, ${threshold.reached}` : null}
                                  </span>
                                </td>
                                <td>
                                  <code className={styles.codeCell}>{threshold.livesIn}</code>
                                </td>
                                <td>{threshold.setBy}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {isRowVisible("setting-roles-matrix") && (
                    <Card id={anchorId("roles")} aria-labelledby="roles-title">
                      <CardHead
                        id="roles-title"
                        icon={ShieldCheck}
                        title="Roles and sign-off"
                        aside={<span className={styles.headMeta}>Demo scopes</span>}
                      />
                      <div className={styles.tableWrap} role="region" aria-label="Role permissions matrix" tabIndex={0}>
                        <table className={`${styles.table} ${styles.cardTable}`}>
                          <thead>
                            <tr>
                              <th scope="col">Role</th>
                              <th scope="col">Works in</th>
                              <th scope="col">Legal forms</th>
                              <th scope="col">Can override</th>
                              <th scope="col">Handover</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ROLE_PERMISSIONS.map((item) => (
                              <tr key={item.role}>
                                <td className={styles.cellStrong}>{item.role}</td>
                                <td>{item.scope}</td>
                                <td>{item.forms}</td>
                                <td>{item.override}</td>
                                <td>
                                  <span className={styles.readout}>
                                    <StatusGlyph tone={item.handoverTone} size={9} />
                                    {item.handover}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Elevated Sticky Unsaved Changes / Draft Diff Inspector */}
        {hasUnsavedRules && (
          <aside
            className={styles.stickyDraftBar}
            role="region"
            aria-label="Unsaved coordination rules draft diff"
            data-testid="unsaved-draft-inspector"
          >
            <div className={styles.stickyDraftBarInner}>
              <div className={styles.draftDiffMeta}>
                <div className={styles.draftPulseBadge}>
                  <span className={styles.pulseDot} aria-hidden="true" />
                  <Sliders size={14} aria-hidden="true" />
                  <strong>Unsaved Draft</strong>
                </div>
                <div className={styles.diffChipsList} aria-label="Modified parameters">
                  {draftDiffs.map((diff) => (
                    <span key={diff.label} className={styles.diffChip}>
                      <span className={styles.diffChipLabel}>{diff.label}:</span>
                      <span className={styles.diffChipFrom}>{diff.from}</span>
                      <span className={styles.diffChipArrow} aria-hidden="true">
                        →
                      </span>
                      <span className={styles.diffChipTo}>{diff.to}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.draftActionsGroup}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleDiscardDraft}
                  data-testid="btn-discard-draft"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>Discard changes</span>
                </button>
                <button
                  type="button"
                  className={styles.btnPrimaryPulsing}
                  onClick={handleSave}
                  data-testid="btn-save-draft"
                  aria-label="Apply draft changes"
                >
                  <Check size={15} aria-hidden="true" />
                  <span>Apply draft changes</span>
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Reset to Baseline Confirmation Modal Dialog */}
        <ResetBaselineModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onConfirm={handleConfirmReset}
        />

        {isOperatorModalOpen && (
          <OperatorSwitcherModal isOpen={isOperatorModalOpen} onClose={() => setIsOperatorModalOpen(false)} />
        )}
        <WardPrototypeFooter
          testId="ward-settings-governance"
          note="Synthetic records · Not a medical device · Changes remembered for this browser only"
        />
        {toastMessage && (
          <div className={`${styles.toast} ${styles.toastShow}`} role="status">
            {toastMessage}
          </div>
        )}
      </main>
    </div>
  );
}
