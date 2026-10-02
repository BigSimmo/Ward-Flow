"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  Layers,
  Minus,
  Palette,
  Plus,
  RotateCcw,
  Search,
  Sliders,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";

import { applyAppearance, useAppearanceStore } from "@/components/ward-management/shell/ward-bar";
import { setRailOpenPreference, useRailOpenStore } from "@/components/ward-management/shell/ward-rail";
import type { WardAppearance } from "@/components/ward-management/shell/ward-shell-types";
import {
  defaultWardConfiguration,
  validateConfiguration,
  type WardConfiguration,
} from "@/components/ward-management/ward-configuration";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { WardDynamicIsland } from "@/components/ward-management/shell/ward-dynamic-island";
import {
  DUE_SOON_MINUTES,
  DUE_SOON_RANGE_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
  OPERATIONAL_DEFAULTS,
} from "@/components/ward-management/ward-operational-defaults";

import { publishedThresholds, type ThresholdState } from "./settings-thresholds";
import {
  countMatchesByDomain,
  filterSettingEntries,
  SETTINGS_DOMAINS,
  type SettingsDomainId,
} from "./settings-search-index";
import {
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_MINUTES,
  MORNING_ROLLUP_TIME_RANGE_MINUTES,
  PARALLEL_REFERRAL_CAP_RANGE,
  PULL_HOLD_RANGE_MINUTES,
} from "@/components/ward-management/ward-model";
import { useAudioBuzzPreference, setAudioBuzzPreference } from "@/components/ward-management/shell/ward-sound-store";
import {
  useWallboardRefreshPreference,
  setWallboardRefreshPreference,
  type WallboardRefreshInterval,
} from "@/components/ward-management/shell/ward-wallboard-store";
import { OperatorSwitcherModal } from "./operator-switcher-modal";
import { ResetBaselineModal } from "./reset-baseline-modal";
import { SETTINGS_SEARCH_ENTRIES } from "./settings-search-index";

import styles from "./settings.module.css";

function playSyntheticUrgentChime() {
  if (typeof window === "undefined" || !("AudioContext" in window || "webkitAudioContext" in window)) return;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(520, now);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(660, now + 0.12);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.12);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.4);
  } catch {
    // Ignore audio context errors in restricted environments
  }
}

function formatMinutesToTime(minutesFromMidnight: number): string {
  const hours24 = Math.floor(minutesFromMidnight / 60);
  const mins = minutesFromMidnight % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  const formattedHours = hours12 < 10 ? `0${hours12}` : `${hours12}`;
  const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
  return `${formattedHours}:${formattedMins} ${period}`;
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

const DOMAIN_SNIPPETS: Record<SettingsDomainId, string> = {
  "cat-appearance": "Theme mode & rail width",
  "cat-thresholds": "Emergency dwell & due warnings",
  "cat-allocation": "Hold timers & referral caps",
  "cat-notifications": "Urgent buzz, roles & telemetry",
  "cat-reset": "Handover sheets & baseline reset",
};

interface RolePermission {
  readonly role: string;
  readonly scope: string;
  readonly forms: string;
  readonly formsTone: "good" | "accent" | "warn";
  readonly override: string;
  readonly overrideTone: "good" | "accent" | "warn";
  readonly handover: string;
  readonly handoverTone: "good" | "accent";
}

const ROLE_PERMISSIONS: readonly RolePermission[] = [
  {
    role: "State Bed Coordinator",
    scope: "Statewide System Flow Desk",
    forms: "Full Authority",
    formsTone: "good",
    override: "Catchment & Acuity",
    overrideTone: "good",
    handover: "Authorised",
    handoverTone: "good",
  },
  {
    role: "Duty Consultant Psychiatrist",
    scope: "Specialist Health Service Cluster",
    forms: "Examination & Detention Forms",
    formsTone: "good",
    override: "Clinical Exceptions",
    overrideTone: "good",
    handover: "Authorised",
    handoverTone: "good",
  },
  {
    role: "Ward NUM / Shift Coordinator",
    scope: "Single Inpatient Unit / Facility",
    forms: "Form 4A Receive",
    formsTone: "accent",
    override: "Ward Bed Allocation",
    overrideTone: "warn",
    handover: "Authorised",
    handoverTone: "good",
  },
  {
    role: "ED Mental Health Liaison",
    scope: "Emergency Department Pod",
    forms: "Form 1A recorded (demo)",
    formsTone: "accent",
    override: "Escalation Request",
    overrideTone: "warn",
    handover: "Authorised",
    handoverTone: "good",
  },
  {
    role: "Custodial Transport Officer",
    scope: "Mobile transport / secure vehicle (demo)",
    forms: "Form 4A recorded (demo)",
    formsTone: "accent",
    override: "Route Alteration",
    overrideTone: "accent",
    handover: "Transport handover only (demo)",
    handoverTone: "good",
  },
  {
    role: "Clinical Governance Lead",
    scope: "Statewide Directorate",
    forms: "Audit & Review",
    formsTone: "good",
    override: "Formal Review Verdict",
    overrideTone: "good",
    handover: "Audit Only",
    handoverTone: "accent",
  },
];

function getDomainIcon(domainId: SettingsDomainId) {
  switch (domainId) {
    case "cat-appearance":
      return <Palette size={16} className={styles.catIcon} aria-hidden="true" />;
    case "cat-thresholds":
      return <Sliders size={16} className={styles.catIcon} aria-hidden="true" />;
    case "cat-allocation":
      return <Layers size={16} className={styles.catIcon} aria-hidden="true" />;
    case "cat-notifications":
      return <Bell size={16} className={styles.catIcon} aria-hidden="true" />;
    case "cat-reset":
      return <Database size={16} className={styles.catIcon} aria-hidden="true" />;
  }
}

export function SettingsScreen() {
  const appearance = useAppearanceStore();
  const railOpen = useRailOpenStore();
  const { movements, dispatch, rejections, configuration } = useWardFlow();
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
  const [autoEscalationAlerts, setAutoEscalationAlerts] = useState(true);
  const [autoCapacityRefresh, setAutoCapacityRefresh] = useState(true);
  const [multiCatchmentSearch, setMultiCatchmentSearch] = useState(true);
  const [statutoryExpiryAlerts, setStatutoryExpiryAlerts] = useState(true);
  const [genderMixProtection, setGenderMixProtection] = useState(true);
  const [audioBreachChimes, setAudioBreachChimes] = useState(false);

  // Audio & Visual Urgent Buzz Alerts state (browser-store backed, SSR-safe)
  const [audioBuzzAlerts, setAudioBuzzAlerts] = useAudioBuzzPreference();
  // Wallboard Auto-Refresh Timer state (browser-store backed, SSR-safe)
  const [wallboardRefresh, setWallboardRefresh] = useWallboardRefreshPreference();
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
        from: formatMinutesToTime(curRollup),
        to: formatMinutesToTime(draftRollup),
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
      }
      setSearchHistory([]);
      showToast("Transient session cache and search ledger cleared.");
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
      `Configuration save requested: ED access target ${draft.edAccessTargetMinutes / 60}h, parallel cap ${draft.parallelReferralCap} units, pull hold ${draft.pullHoldMinutes}m, rollup ${formatMinutesToTime(draft.morningRollupDeadlineMinutes ?? 570)}, due-time warnings ${formatDueSoonDuration(draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES)}/${formatDueSoonDuration(draft.dueSoonMinutes ?? DUE_SOON_MINUTES)}.`,
    );
  };

  const handleConfirmReset = () => {
    const defaults = defaultWardConfiguration();
    dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now, payload: defaults });
    setDraft({ ...defaults, morningRollupDeadlineMinutes: 570 });
    setAudioBuzzAlerts(true);
    setAudioBuzzPreference(true);
    setWallboardRefresh("off");
    setWallboardRefreshPreference("off");
    setStatutoryWarningHours(4);
    setAutoEscalationAlerts(true);
    setAutoCapacityRefresh(true);
    setMultiCatchmentSearch(true);
    setStatutoryExpiryAlerts(true);
    setGenderMixProtection(true);
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

  return (
    <div className={styles.screen} data-testid="ward-settings-screen" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        {/* Third-Edition Sovereign Header with Context & Clinical Profile */}
        <header className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <div className={styles.headerContextPill}>
              <strong>WA HEALTH</strong> · STATEWIDE BED COORDINATION · PERTH CENTRAL DESK · DAY SHIFT 08:00–16:30 AWST
            </div>
            <div className={styles.titleRow}>
              <h1 className={styles.pageTitle} aria-label="Settings">
                <span>Settings</span> <span className={styles.pageTitleSub}>&amp; coordination rules</span>
              </h1>
              {savedSurge ? (
                <span className={styles.statusPillSurge}>
                  <span className={styles.statusDotSurge} /> SURGE VALUES SAVED
                </span>
              ) : (
                <span className={styles.statusPillStandard}>
                  <span className={styles.statusDotStandard} /> CURRENT SAVED RULES
                </span>
              )}
            </div>
            {hasUnsavedRules ? (
              <div className={styles.unsavedPill} role="status">
                <span className={styles.unsavedDot} aria-hidden="true" />
                <span>Unsaved changes — Save coordination rules to apply.</span>
              </div>
            ) : null}
          </div>
          <div className={styles.hdrEnd}>
            <button
              type="button"
              className={`${styles.btnSurge} ${isSurge ? styles.btnSurgeActive : ""}`}
              onClick={handleToggleSurge}
              aria-pressed={isSurge}
              title="Select surge values in the unsaved draft"
            >
              <Plus size={15} aria-hidden="true" />
              <span>{isSurge ? "Surge values selected" : "Select surge values"}</span>
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setIsResetModalOpen(true)}
              aria-haspopup="dialog"
            >
              <RotateCcw size={15} aria-hidden="true" />
              <span>Restore all defaults</span>
            </button>
            <button type="button" className={styles.btnPrimary} onClick={handleSave}>
              <Check size={15} aria-hidden="true" />
              <span>Save coordination rules</span>
            </button>

            <div className={styles.hdrDivider} aria-hidden="true" />

            {/* Clinical Operator Profile Component */}
            <div className={styles.userProfileWrap} ref={profileRef}>
              <button
                type="button"
                className={styles.userProfile}
                id="userProfileBtn"
                data-testid="clinical-operator-profile"
                aria-haspopup="dialog"
                aria-expanded={isProfileOpen}
                aria-controls="profilePopover"
                onClick={() => setIsProfileOpen((v) => !v)}
                title="Clinical Operator Profile · Dr S. Chen"
              >
                <div className={styles.userAvatar}>
                  <span>SC</span>
                  <span className={styles.userStatusDot} title="On Duty" />
                </div>
                <div className={styles.userInfo}>
                  <div className={styles.userNameRow}>
                    <span className={styles.userName}>Dr S. Chen</span>
                    <span className={styles.userRoleBadge}>Consultant</span>
                  </div>
                  <span className={styles.userRoleDesc}>Duty Coordinator · Central Desk</span>
                </div>
                <ChevronDown size={14} className={styles.userChevron} aria-hidden="true" />
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
                        <span>Operational Scope:</span>
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

        {/* Dynamic Island micro-HUD — reads the SAVED configuration, never the draft below */}
        <WardDynamicIsland
          testId="ward-settings-hud-island"
          title="System Operations"
          status={hasUnsavedRules ? "warning" : "nominal"}
          statusText={
            hasUnsavedRules ? "Unsaved configuration draft pending" : "All coordination parameters synchronized"
          }
          ariaLabel="System operations status summary"
          className={styles.hudWrapper}
          metrics={[
            {
              id: "kpi-sync-status",
              label: "Sync",
              value: hasUnsavedRules ? "Draft (Unsaved)" : "Synced",
              subtext: hasUnsavedRules ? "Pending Changes" : undefined,
              tone: hasUnsavedRules ? "warn" : "good",
              ariaLabel: hasUnsavedRules ? "Sync Status: Draft (Unsaved) Pending Changes" : "Sync Status: Synced",
            },
            {
              id: "kpi-mode",
              label: "Mode",
              value: savedSurge ? "Surge Mode" : "Standard",
              tone: savedSurge ? "danger" : "normal",
            },
            {
              id: "kpi-morning-rollup",
              label: "Rollup",
              value: formatMinutesToTime(configuration.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES),
              subtext: `${configuration.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES}m`,
              tone: "accent",
            },
            {
              id: "kpi-ed-target",
              label: "ED Target",
              value: `${configuration.edAccessTargetMinutes / 60}h`,
              subtext: `${configuration.edAccessTargetMinutes}m`,
              tone: "normal",
            },
            {
              id: "kpi-pull-hold",
              label: "Pull Hold",
              value: `${configuration.pullHoldMinutes}m`,
              tone: "normal",
            },
            {
              id: "kpi-parallel-cap",
              label: "Cap",
              value: `${configuration.parallelReferralCap} Wards`,
              tone: "normal",
              ariaLabel: `Parallel Referral Cap: ${configuration.parallelReferralCap} Wards`,
            },
          ]}
        />

        {/* Settings Master Surface */}
        <div className={styles.settingsSurface}>
          {/* Master-Detail Body */}
          <div className={styles.settingsBody}>
            {/* Left Category Navigation Rail with Integrated Search */}
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
                    placeholder="Filter levers... (/)"
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
                        Showing <strong>{totalMatches}</strong> of {SETTINGS_SEARCH_ENTRIES.length} settings
                      </span>
                    ) : (
                      <div className={styles.searchFeedbackZeroWrap}>
                        <span className={styles.searchFeedbackZero}>No settings match &ldquo;{searchQuery}&rdquo;</span>
                        <a
                          href="#clear-filter"
                          className={styles.searchFeedbackClearLink}
                          onClick={(e) => {
                            e.preventDefault();
                            setSearchQuery("");
                            searchInputRef.current?.focus();
                          }}
                        >
                          Clear filter
                        </a>
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

              <div className={styles.domainNavDivider} aria-hidden="true" />

              <div className={styles.catListScroll}>
                <button
                  type="button"
                  className={styles.catItem}
                  aria-current={activeDomain === "all"}
                  onClick={() => handleDomainClick("all")}
                >
                  <div className={styles.catIconBox} aria-hidden="true">
                    <Sliders size={15} className={styles.catIcon} aria-hidden="true" />
                  </div>
                  <div className={styles.catItemContent}>
                    <div className={styles.catTitleRow}>
                      <span className={styles.catTitle}>All Levers</span>
                      <span className={styles.catCount}>{totalMatches}</span>
                    </div>
                    <span className={styles.catSnippet}>All configuration levers &amp; rules</span>
                  </div>
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
                      <div className={styles.catIconBox} aria-hidden="true">
                        {getDomainIcon(domain.id)}
                      </div>
                      <div className={styles.catItemContent}>
                        <div className={styles.catTitleRow}>
                          <span className={styles.catTitle}>{domain.navLabel}</span>
                          <span className={styles.catCount}>{count}</span>
                        </div>
                        <span className={styles.catSnippet}>{DOMAIN_SNIPPETS[domain.id]}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Right Content Pane */}
            <div className={styles.contentPane}>
              {totalMatches === 0 ? (
                <div className={styles.emptySearchState} role="status">
                  <Search className={styles.emptySearchIcon} size={40} aria-hidden="true" />
                  <h3 className={styles.emptySearchTitle}>No matching settings found</h3>
                  <p className={styles.emptySearchText}>
                    No configuration parameter matches &quot;{searchQuery}&quot;. Try searching for keywords such as
                    &quot;threshold&quot;, &quot;hold&quot;, &quot;rail&quot;, or &quot;appearance&quot;.
                  </p>
                  <button type="button" className={styles.btnSecondary} onClick={() => setSearchQuery("")}>
                    Clear Filter
                  </button>
                </div>
              ) : (
                <>
                  {/* DOMAIN 1: APPEARANCE & THEME */}
                  {(isRowVisible("setting-appearance-theme") || isRowVisible("setting-rail-density")) && (
                    <section id="cat-appearance" className={styles.settingsSection} aria-labelledby="appearance-title">
                      <header className={styles.sectionHeader}>
                        <div>
                          <span className={styles.secEyebrow}>Domain 1 · Presentation</span>
                          <h2 id="appearance-title" className={styles.secTitle}>
                            Appearance &amp; Theme
                          </h2>
                          <p className={styles.secDesc}>
                            Console display presentation, daylight and dark contrast modes, and navigation rail density.
                          </p>
                        </div>
                        <span className={styles.rowTag}>2 Controls</span>
                      </header>

                      <div className={styles.preferenceGrid}>
                        {isRowVisible("setting-appearance-theme") && (
                          <WardPanel title="Appearance" testId="ward-settings-appearance">
                            <div className={styles.preferenceBody}>
                              <p className={styles.panelLead}>
                                Choose your preferred visual presentation. Theme applies instantly across all clinical
                                boards and persists across browser sessions.
                              </p>

                              <div className={styles.themeSelectorGrid} role="group" aria-label="Appearance">
                                {APPEARANCE_CHOICES.map((choice) => {
                                  const isSelected = appearance === choice.value;
                                  return (
                                    <button
                                      key={choice.value}
                                      type="button"
                                      className={`${styles.themePreviewCard} ${isSelected ? styles.themePreviewCardActive : ""}`}
                                      aria-pressed={isSelected}
                                      aria-label={choice.label}
                                      data-testid={`ward-settings-appearance-${choice.value}`}
                                      onClick={() => {
                                        applyAppearance(choice.value);
                                        showToast(`Theme set to ${choice.label}.`);
                                      }}
                                    >
                                      {/* UI Miniature Swatch */}
                                      <div
                                        className={`${styles.themeMiniature} ${
                                          choice.value === "light"
                                            ? styles.themeMini_light
                                            : choice.value === "dark"
                                              ? styles.themeMini_dark
                                              : styles.themeMini_auto
                                        }`}
                                        aria-hidden="true"
                                      >
                                        <div className={styles.miniHeader}>
                                          <span className={styles.miniBrandDot} />
                                          <span className={styles.miniHeaderBar} />
                                        </div>
                                        <div className={styles.miniBody}>
                                          <div className={styles.miniSidebar}>
                                            <span className={styles.miniNavDot} />
                                            <span className={styles.miniNavDot} />
                                          </div>
                                          <div className={styles.miniContent}>
                                            <div className={styles.miniCardActive} />
                                            <div className={styles.miniCard} />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Metadata & Radio Indicator */}
                                      <div className={styles.themeMetaRow}>
                                        <div className={styles.themeNameGroup}>
                                          <span className={styles.themeName}>{choice.label}</span>
                                          <span className={styles.themeDescription}>{choice.description}</span>
                                        </div>
                                        <div
                                          className={`${styles.themeRadioIndicator} ${
                                            isSelected ? styles.themeRadioIndicatorActive : ""
                                          }`}
                                          aria-hidden="true"
                                        >
                                          {isSelected && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className={styles.preferenceStatus}>
                                <span>Current</span>
                                <strong data-testid="ward-settings-appearance-now">
                                  {APPEARANCE_CHOICES.find((choice) => choice.value === appearance)?.label ??
                                    appearance}
                                </strong>
                              </div>
                              <p className={styles.note}>Auto follows this device.</p>
                            </div>
                          </WardPanel>
                        )}

                        {isRowVisible("setting-rail-density") && (
                          <WardPanel title="Navigation rail" testId="ward-settings-rail">
                            <div className={styles.preferenceBody}>
                              <p className={styles.panelLead}>
                                Adjust primary sidebar density. Expanded mode provides full text labels; collapsed mode
                                maximizes clinical workspace area.
                              </p>

                              {/* Rail Preview Miniature Wireframes */}
                              <div className={styles.railVisualContainer} aria-hidden="true">
                                <div
                                  className={`${styles.railMiniOption} ${!railOpen ? styles.railMiniOptionActive : ""}`}
                                >
                                  <div className={styles.railMiniWireframeCollapsed}>
                                    <div className={styles.wireRailNarrow}>
                                      <span className={styles.wireIcon} />
                                      <span className={styles.wireIcon} />
                                      <span className={styles.wireIcon} />
                                    </div>
                                    <div className={styles.wireWorkspaceWide} />
                                  </div>
                                  <span className={styles.railMiniLabel}>Narrow (Icons Only)</span>
                                </div>

                                <div
                                  className={`${styles.railMiniOption} ${railOpen ? styles.railMiniOptionActive : ""}`}
                                >
                                  <div className={styles.railMiniWireframeExpanded}>
                                    <div className={styles.wireRailWide}>
                                      <span className={styles.wireRow} />
                                      <span className={styles.wireRow} />
                                      <span className={styles.wireRow} />
                                    </div>
                                    <div className={styles.wireWorkspaceNarrow} />
                                  </div>
                                  <span className={styles.railMiniLabel}>Wide (Expanded Labels)</span>
                                </div>
                              </div>

                              <div className={styles.preferenceStatus}>
                                <span>Current</span>
                                <strong data-testid="ward-settings-rail-now">{railOpen ? "Open" : "Closed"}</strong>
                              </div>
                              <button
                                type="button"
                                className={`${styles.choice} ${styles.railChoice} ${styles.railToggleBtn}`}
                                data-testid="ward-settings-rail-toggle"
                                onClick={() => {
                                  const next = !railOpen;
                                  setRailOpenPreference(next);
                                  showToast(`Navigation rail set to ${next ? "Open" : "Closed"}.`);
                                }}
                              >
                                {railOpen ? "Close the rail" : "Open the rail"}
                              </button>
                              <p className={styles.note}>Remembered for this browser.</p>
                            </div>
                          </WardPanel>
                        )}
                      </div>

                      {/* High Contrast & Motion Indicators */}
                      <div className={styles.accessibilityBadgesGrid}>
                        <div className={styles.a11yCard}>
                          <div className={styles.a11yCardHeader}>
                            <span className={styles.a11yTitle}>Text contrast target</span>
                            <span className={styles.badge} data-tone="good">
                              4.5:1
                            </span>
                          </div>
                          <p className={styles.a11yDesc}>Normal text in light and dark themes.</p>
                        </div>
                        <div className={styles.a11yCard}>
                          <div className={styles.a11yCardHeader}>
                            <span className={styles.a11yTitle}>Forced Colors</span>
                            <span className={styles.badge} data-tone="good">
                              Supported
                            </span>
                          </div>
                          <p className={styles.a11yDesc}>
                            Adheres to Windows High Contrast mode and system forced-color palettes automatically.
                          </p>
                        </div>
                        <div className={styles.a11yCard}>
                          <div className={styles.a11yCardHeader}>
                            <span className={styles.a11yTitle}>Reduced Motion</span>
                            <span className={styles.badge} data-tone="good">
                              Respected
                            </span>
                          </div>
                          <p className={styles.a11yDesc}>
                            Transitions and layout animations disable instantly when prefers-reduced-motion is active.
                          </p>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* DOMAIN 2: CLINICAL THRESHOLDS */}
                  {(isRowVisible("setting-ed-threshold") ||
                    isRowVisible("setting-parallel-cap") ||
                    isRowVisible("setting-hold-duration") ||
                    isRowVisible("setting-due-soon-urgent") ||
                    isRowVisible("setting-due-soon") ||
                    isRowVisible("setting-morning-rollup") ||
                    isRowVisible("setting-form4a-warn") ||
                    isRowVisible("setting-auto-escalate") ||
                    isRowVisible("setting-medical-release") ||
                    isRowVisible("setting-published-thresholds") ||
                    isRowVisible("setting-operational-defaults")) && (
                    <section id="cat-thresholds" className={styles.settingsSection} aria-labelledby="thresholds-title">
                      <header className={styles.sectionHeader}>
                        <div>
                          <span className={styles.secEyebrow}>Domain 2 · Operational Limits</span>
                          <h2 id="thresholds-title" className={styles.secTitle}>
                            Clinical Escalation &amp; Operational Thresholds
                          </h2>
                          <p className={styles.secDesc}>
                            Emergency department dwell targets, warning windows, medical clearance buffers, and
                            published operational safeguards.
                          </p>
                        </div>
                        <span className={styles.rowTag}>Operational Safeguards</span>
                      </header>

                      {/* Surge Mode Banner */}
                      <div className={`${styles.surgeBanner} ${isSurge ? styles.surgeBannerActive : ""}`}>
                        <div className={styles.surgeBannerHeader}>
                          <div className={styles.surgeBannerTitleGroup}>
                            <div className={styles.surgeBannerTitleRow}>
                              <span className={styles.surgeBannerTitle}>Surge Mode &amp; Escalation Capacity</span>
                              {isSurge ? (
                                <span className={styles.statusPillSurge}>
                                  <span className={styles.statusDotSurge} /> SURGE ACTIVE IN DRAFT
                                </span>
                              ) : (
                                <span className={styles.statusPillStandard}>
                                  <span className={styles.statusDotStandard} /> STANDARD BASELINE
                                </span>
                              )}
                            </div>
                            <p className={styles.surgeBannerDesc}>
                              Rapidly switches operational parameters between standard baseline thresholds and emergency
                              surge capacity. Toggling modifies draft levers below; changes only take effect upon
                              saving.
                            </p>
                          </div>
                          <button
                            type="button"
                            className={styles.bannerPresetBtn}
                            aria-label={isSurge ? "Restore standard preset" : "Apply emergency surge preset"}
                            onClick={handleToggleSurge}
                          >
                            {isSurge ? "Reset Draft to Standard Baseline" : "Apply Emergency Surge Preset"}
                          </button>
                        </div>

                        <div className={styles.surgeDiffGrid}>
                          <div className={`${styles.surgeDiffCard} ${isSurge ? styles.surgeDiffCardActive : ""}`}>
                            <span className={styles.surgeDiffLabel}>ED Access Target</span>
                            <div className={styles.surgeDiffValues}>
                              <span className={styles.surgeDiffStandard}>
                                {defaultWardConfiguration().edAccessTargetMinutes / 60}h standard
                              </span>
                              <span className={styles.surgeDiffSurge}>
                                {ED_ACCESS_TARGET_RANGE_MINUTES.min / 60}h surge
                              </span>
                            </div>
                            <span className={styles.surgeDiffEffect}>
                              Halves dwell ceiling to accelerate mental health clearance from ED.
                            </span>
                          </div>

                          <div className={`${styles.surgeDiffCard} ${isSurge ? styles.surgeDiffCardActive : ""}`}>
                            <span className={styles.surgeDiffLabel}>Parallel Referral Cap</span>
                            <div className={styles.surgeDiffValues}>
                              <span className={styles.surgeDiffStandard}>3 units</span>
                              <span className={styles.surgeDiffSurge}>5 units</span>
                            </div>
                            <span className={styles.surgeDiffEffect}>
                              Broadens referral circulation across adult inpatient units simultaneously.
                            </span>
                          </div>

                          <div className={`${styles.surgeDiffCard} ${isSurge ? styles.surgeDiffCardActive : ""}`}>
                            <span className={styles.surgeDiffLabel}>Pull Hold Buffer</span>
                            <div className={styles.surgeDiffValues}>
                              <span className={styles.surgeDiffStandard}>90m standard</span>
                              <span className={styles.surgeDiffSurge}>45m surge</span>
                            </div>
                            <span className={styles.surgeDiffEffect}>
                              Compresses bed reservation hold window to release unconfirmed beds rapidly.
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 5 Clinical Parameter Cards */}
                      <div className={styles.parameterCardsGrid}>
                        {/* Parameter Card 1: ED Access Target */}
                        {isRowVisible("setting-ed-threshold") && (
                          <div className={styles.paramCard}>
                            <div className={styles.paramCardHeader}>
                              <div className={styles.paramCardTitleCol}>
                                <span className={styles.paramCardTitle}>
                                  Emergency Department Access Target
                                  <span className={styles.rowTag}>{draft.edAccessTargetMinutes / 60} Hours</span>
                                </span>
                                <p className={styles.paramCardRationale}>
                                  Read by the Emergency department screen&rsquo;s own access-target line, its ED-home
                                  summaries, and the movements board&rsquo;s wait meter — a departmental performance
                                  measure, never a Mental Health Act deadline. Saved changes are recorded in the audit
                                  trail.
                                </p>
                              </div>
                              {draft.edAccessTargetMinutes <= 120 ? (
                                <span className={styles.badge} data-tone="danger">
                                  Surge ({draft.edAccessTargetMinutes / 60}h)
                                </span>
                              ) : draft.edAccessTargetMinutes <= 240 ? (
                                <span className={styles.badge} data-tone="good">
                                  Standard ({draft.edAccessTargetMinutes / 60}h)
                                </span>
                              ) : (
                                <span className={styles.badge} data-tone="warn">
                                  Extended ({draft.edAccessTargetMinutes / 60}h)
                                </span>
                              )}
                            </div>
                            <div className={styles.paramCardBody}>
                              <div className={styles.paramReadoutBox}>
                                <span className={styles.paramBigValue}>{draft.edAccessTargetMinutes / 60}</span>
                                <span className={styles.paramUnitLabel}>Hours</span>
                                <span className={styles.paramSavedComparison}>
                                  Saved: {configuration.edAccessTargetMinutes / 60}h
                                </span>
                              </div>
                              <div className={styles.paramControlsCol}>
                                <div className={styles.stepperCluster}>
                                  <button
                                    type="button"
                                    className={styles.stepperBtn}
                                    aria-label="Decrease ED access target"
                                    onClick={() => {
                                      setDraft((curr) => ({
                                        ...curr,
                                        edAccessTargetMinutes: Math.max(
                                          ED_ACCESS_TARGET_RANGE_MINUTES.min,
                                          curr.edAccessTargetMinutes - ED_ACCESS_TARGET_RANGE_MINUTES.step,
                                        ),
                                      }));
                                    }}
                                  >
                                    <Minus size={16} aria-hidden="true" />
                                  </button>
                                  <div className={styles.stepperDisplay}>
                                    <span className={styles.stepperVal}>{draft.edAccessTargetMinutes / 60}</span>
                                    <span className={styles.stepperUnit}>hours</span>
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.stepperBtn}
                                    aria-label="Increase ED access target"
                                    onClick={() => {
                                      setDraft((curr) => ({
                                        ...curr,
                                        edAccessTargetMinutes: Math.min(
                                          ED_ACCESS_TARGET_RANGE_MINUTES.max,
                                          curr.edAccessTargetMinutes + ED_ACCESS_TARGET_RANGE_MINUTES.step,
                                        ),
                                      }));
                                    }}
                                  >
                                    <Plus size={16} aria-hidden="true" />
                                  </button>
                                </div>
                                <div className={styles.sliderTickTrack}>
                                  <div className={styles.sliderLine}>
                                    <input
                                      id="setting-ed-threshold"
                                      type="range"
                                      min={ED_ACCESS_TARGET_RANGE_MINUTES.min}
                                      max={ED_ACCESS_TARGET_RANGE_MINUTES.max}
                                      step={ED_ACCESS_TARGET_RANGE_MINUTES.step}
                                      value={draft.edAccessTargetMinutes}
                                      onChange={(e) => {
                                        const minutes = Number(e.target.value);
                                        setDraft((current) => ({ ...current, edAccessTargetMinutes: minutes }));
                                      }}
                                      className={styles.rangeSlider}
                                      aria-label="ED access target in hours"
                                    />
                                    <span className={styles.sliderVal}>{draft.edAccessTargetMinutes / 60}h</span>
                                  </div>
                                  <div className={styles.sliderTicks} aria-hidden="true">
                                    {[2, 4, 8, 12, 24, 36].map((hrs) => {
                                      const valMin = hrs * 60;
                                      return (
                                        <span
                                          key={hrs}
                                          className={`${styles.sliderTickItem} ${draft.edAccessTargetMinutes === valMin ? styles.sliderTickItemActive : ""}`}
                                        >
                                          {hrs}h
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className={styles.sliderFoot}>
                                  <span>{ED_ACCESS_TARGET_RANGE_MINUTES.min / 60}h (minimum)</span>
                                  <span>{defaultWardConfiguration().edAccessTargetMinutes / 60}h (default)</span>
                                  <span>{ED_ACCESS_TARGET_RANGE_MINUTES.max / 60}h (maximum)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Parameter Card 2: Parallel Referral Cap */}
                        {isRowVisible("setting-parallel-cap") && (
                          <div className={styles.paramCard}>
                            <div className={styles.paramCardHeader}>
                              <div className={styles.paramCardTitleCol}>
                                <span className={styles.paramCardTitle}>
                                  Parallel Referral Enquiry Limit
                                  <span className={styles.rowTag}>{draft.parallelReferralCap} Units</span>
                                </span>
                                <p className={styles.paramCardRationale}>
                                  Read by the coordinator&rsquo;s shortlist, the referral intake form, and the
                                  statistics screen — how many wards one referral may be sent to in one act. Saved
                                  changes are recorded in the audit trail.
                                </p>
                              </div>
                              {draft.parallelReferralCap >= 5 ? (
                                <span className={styles.badge} data-tone="warn">
                                  Surge (5 units)
                                </span>
                              ) : (
                                <span className={styles.badge} data-tone="good">
                                  Standard ({draft.parallelReferralCap} units)
                                </span>
                              )}
                            </div>
                            <div className={styles.paramCardBody}>
                              <div className={styles.paramReadoutBox}>
                                <span className={styles.paramBigValue}>{draft.parallelReferralCap}</span>
                                <span className={styles.paramUnitLabel}>Units</span>
                                <span className={styles.paramSavedComparison}>
                                  Saved: {configuration.parallelReferralCap} units
                                </span>
                              </div>
                              <div className={styles.paramControlsCol}>
                                <div className={styles.stepperCluster}>
                                  <button
                                    type="button"
                                    className={styles.stepperBtn}
                                    aria-label="Decrease parallel referral enquiry limit"
                                    onClick={() => {
                                      setDraft((curr) => ({
                                        ...curr,
                                        parallelReferralCap: Math.max(
                                          PARALLEL_REFERRAL_CAP_RANGE.min,
                                          curr.parallelReferralCap - PARALLEL_REFERRAL_CAP_RANGE.step,
                                        ),
                                      }));
                                    }}
                                  >
                                    <Minus size={16} aria-hidden="true" />
                                  </button>
                                  <div className={styles.stepperDisplay}>
                                    <span className={styles.stepperVal}>{draft.parallelReferralCap}</span>
                                    <span className={styles.stepperUnit}>units</span>
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.stepperBtn}
                                    aria-label="Increase parallel referral enquiry limit"
                                    onClick={() => {
                                      setDraft((curr) => ({
                                        ...curr,
                                        parallelReferralCap: Math.min(
                                          PARALLEL_REFERRAL_CAP_RANGE.max,
                                          curr.parallelReferralCap + PARALLEL_REFERRAL_CAP_RANGE.step,
                                        ),
                                      }));
                                    }}
                                  >
                                    <Plus size={16} aria-hidden="true" />
                                  </button>
                                </div>
                                <div className={styles.sliderTickTrack}>
                                  <div className={styles.sliderLine}>
                                    <input
                                      id="setting-parallel-cap"
                                      type="range"
                                      min={PARALLEL_REFERRAL_CAP_RANGE.min}
                                      max={PARALLEL_REFERRAL_CAP_RANGE.max}
                                      step={PARALLEL_REFERRAL_CAP_RANGE.step}
                                      value={draft.parallelReferralCap}
                                      onChange={(e) => {
                                        const units = Number(e.target.value);
                                        setDraft((current) => ({ ...current, parallelReferralCap: units }));
                                      }}
                                      className={styles.rangeSlider}
                                      aria-label="Parallel referral cap in units"
                                    />
                                    <span className={styles.sliderVal}>{draft.parallelReferralCap} units</span>
                                  </div>
                                  <div className={styles.sliderTicks} aria-hidden="true">
                                    {[1, 2, 3, 4, 5].map((u) => (
                                      <span
                                        key={u}
                                        className={`${styles.sliderTickItem} ${draft.parallelReferralCap === u ? styles.sliderTickItemActive : ""}`}
                                      >
                                        {u} {u === 1 ? "unit" : "units"}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className={styles.sliderFoot}>
                                  <span>{PARALLEL_REFERRAL_CAP_RANGE.min} unit (minimum)</span>
                                  <span>{defaultWardConfiguration().parallelReferralCap} units (default)</span>
                                  <span>{PARALLEL_REFERRAL_CAP_RANGE.max} units (maximum)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Parameter Card 3: Pulled Bed Reservation Hold Duration */}
                        {isRowVisible("setting-hold-duration") && (
                          <div className={styles.paramCard}>
                            <div className={styles.paramCardHeader}>
                              <div className={styles.paramCardTitleCol}>
                                <span className={styles.paramCardTitle}>
                                  Pulled Bed Reservation Hold Duration
                                  <span className={styles.rowTag}>{draft.pullHoldMinutes} Minutes</span>
                                </span>
                                <p className={styles.paramCardRationale}>
                                  Read by a pulled bed&rsquo;s own hold timer — how long an accepting unit&rsquo;s bed
                                  stays reserved for an incoming patient before the hold expires. Saved changes are
                                  recorded in the audit trail.
                                </p>
                              </div>
                              {draft.pullHoldMinutes <= 45 ? (
                                <span className={styles.badge} data-tone="danger">
                                  Surge (45m)
                                </span>
                              ) : draft.pullHoldMinutes <= 90 ? (
                                <span className={styles.badge} data-tone="good">
                                  Standard (90m)
                                </span>
                              ) : (
                                <span className={styles.badge} data-tone="warn">
                                  Extended ({draft.pullHoldMinutes}m)
                                </span>
                              )}
                            </div>
                            <div className={styles.paramCardBody}>
                              <div className={styles.paramReadoutBox}>
                                <span className={styles.paramBigValue}>{draft.pullHoldMinutes}</span>
                                <span className={styles.paramUnitLabel}>Minutes</span>
                                <span className={styles.paramSavedComparison}>
                                  Saved: {configuration.pullHoldMinutes}m
                                </span>
                              </div>
                              <div className={styles.paramControlsCol}>
                                <div className={styles.stepperCluster}>
                                  <button
                                    type="button"
                                    className={styles.stepperBtn}
                                    aria-label="Decrease pulled bed hold duration"
                                    onClick={() => {
                                      setDraft((curr) => ({
                                        ...curr,
                                        pullHoldMinutes: Math.max(
                                          PULL_HOLD_RANGE_MINUTES.min,
                                          curr.pullHoldMinutes - PULL_HOLD_RANGE_MINUTES.step,
                                        ),
                                      }));
                                    }}
                                  >
                                    <Minus size={16} aria-hidden="true" />
                                  </button>
                                  <div className={styles.stepperDisplay}>
                                    <span className={styles.stepperVal}>{draft.pullHoldMinutes}</span>
                                    <span className={styles.stepperUnit}>minutes</span>
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.stepperBtn}
                                    aria-label="Increase pulled bed hold duration"
                                    onClick={() => {
                                      setDraft((curr) => ({
                                        ...curr,
                                        pullHoldMinutes: Math.min(
                                          PULL_HOLD_RANGE_MINUTES.max,
                                          curr.pullHoldMinutes + PULL_HOLD_RANGE_MINUTES.step,
                                        ),
                                      }));
                                    }}
                                  >
                                    <Plus size={16} aria-hidden="true" />
                                  </button>
                                </div>
                                <div className={styles.sliderTickTrack}>
                                  <div className={styles.sliderLine}>
                                    <input
                                      id="setting-hold-duration"
                                      type="range"
                                      min={PULL_HOLD_RANGE_MINUTES.min}
                                      max={PULL_HOLD_RANGE_MINUTES.max}
                                      step={PULL_HOLD_RANGE_MINUTES.step}
                                      value={draft.pullHoldMinutes}
                                      onChange={(e) => {
                                        const minutes = Number(e.target.value);
                                        setDraft((current) => ({ ...current, pullHoldMinutes: minutes }));
                                      }}
                                      className={styles.rangeSlider}
                                      aria-label="Pulled bed reservation hold duration in minutes"
                                    />
                                    <span className={styles.sliderVal}>{draft.pullHoldMinutes}m</span>
                                  </div>
                                  <div className={styles.sliderTicks} aria-hidden="true">
                                    {[30, 60, 90, 120, 180].map((m) => (
                                      <span
                                        key={m}
                                        className={`${styles.sliderTickItem} ${draft.pullHoldMinutes === m ? styles.sliderTickItemActive : ""}`}
                                      >
                                        {m}m
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className={styles.sliderFoot}>
                                  <span>{PULL_HOLD_RANGE_MINUTES.min}m (minimum)</span>
                                  <span>{defaultWardConfiguration().pullHoldMinutes}m (default)</span>
                                  <span>{PULL_HOLD_RANGE_MINUTES.max}m (maximum)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Parameter Card 4: Morning Rollup Deadline */}
                        {isRowVisible("setting-morning-rollup") && (
                          <div className={styles.paramCard} data-testid="setting-morning-rollup-row">
                            <div className={styles.paramCardHeader}>
                              <div className={styles.paramCardTitleCol}>
                                <span className={styles.paramCardTitle}>
                                  Morning roll-up time
                                  <span className={styles.rowTag}>
                                    {formatMinutesToTime(draft.morningRollupDeadlineMinutes ?? 570)}
                                  </span>
                                </span>
                                <p className={styles.paramCardRationale} data-testid="setting-morning-rollup-desc">
                                  Time by which inpatient wards are asked to confirm their morning discharge census and
                                  available beds ({OPERATIONAL_DEFAULT_LABEL}).
                                </p>
                              </div>
                              <span className={styles.badge} data-tone="good">
                                {OPERATIONAL_DEFAULT_LABEL}
                              </span>
                            </div>
                            <div className={styles.paramCardBody}>
                              <div className={styles.paramReadoutBox}>
                                <span className={styles.paramBigValue} data-testid="morning-rollup-display">
                                  {formatMinutesToTime(draft.morningRollupDeadlineMinutes ?? 570)}
                                </span>
                                <span className={styles.paramUnitLabel}>Daily Cutoff</span>
                                <span className={styles.paramSavedComparison}>
                                  Saved: {formatMinutesToTime(configuration.morningRollupDeadlineMinutes ?? 570)}
                                </span>
                              </div>
                              <div className={styles.paramControlsCol}>
                                <div className={styles.stepperCluster}>
                                  <button
                                    type="button"
                                    className={styles.stepperBtn}
                                    aria-label="Decrease morning rollup deadline"
                                    onClick={() => {
                                      const current = draft.morningRollupDeadlineMinutes ?? 570;
                                      const next = Math.max(480, current - 15);
                                      setDraft((curr) => ({ ...curr, morningRollupDeadlineMinutes: next }));
                                    }}
                                  >
                                    <Minus size={16} aria-hidden="true" />
                                  </button>
                                  <div className={styles.stepperDisplay}>
                                    <span className={styles.stepperVal}>
                                      {formatMinutesToTime(draft.morningRollupDeadlineMinutes ?? 570)}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.stepperBtn}
                                    aria-label="Increase morning rollup deadline"
                                    onClick={() => {
                                      const current = draft.morningRollupDeadlineMinutes ?? 570;
                                      const next = Math.min(660, current + 15);
                                      setDraft((curr) => ({ ...curr, morningRollupDeadlineMinutes: next }));
                                    }}
                                  >
                                    <Plus size={16} aria-hidden="true" />
                                  </button>
                                </div>
                                <div className={styles.sliderTickTrack}>
                                  <div className={styles.sliderLine}>
                                    <input
                                      id="setting-morning-rollup-slider"
                                      type="range"
                                      min={480}
                                      max={660}
                                      step={15}
                                      value={draft.morningRollupDeadlineMinutes ?? 570}
                                      onChange={(e) => {
                                        const minutes = Number(e.target.value);
                                        setDraft((curr) => ({ ...curr, morningRollupDeadlineMinutes: minutes }));
                                      }}
                                      className={styles.rangeSlider}
                                      aria-label="Morning rollup deadline in minutes from midnight"
                                    />
                                    <span className={styles.sliderVal}>
                                      {formatMinutesToTime(draft.morningRollupDeadlineMinutes ?? 570)}
                                    </span>
                                  </div>
                                  <div className={styles.sliderTicks} aria-hidden="true">
                                    {[480, 540, 570, 600, 660].map((t) => (
                                      <span
                                        key={t}
                                        className={`${styles.sliderTickItem} ${(draft.morningRollupDeadlineMinutes ?? 570) === t ? styles.sliderTickItemActive : ""}`}
                                      >
                                        {formatMinutesToTime(t)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className={styles.sliderFoot}>
                                  <span>08:00 AM (earliest)</span>
                                  <span>09:30 AM (default)</span>
                                  <span>11:00 AM (latest)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Parameter Card 5: Due-Time Warning Thresholds */}
                        {(isRowVisible("setting-due-soon-urgent") || isRowVisible("setting-due-soon")) && (
                          <div className={styles.paramCard}>
                            <div className={styles.paramCardHeader}>
                              <div className={styles.paramCardTitleCol}>
                                <span className={styles.paramCardTitle}>
                                  Due-Time Warning Intervals
                                  <span className={styles.rowTag}>2 Thresholds</span>
                                </span>
                                <p className={styles.paramCardRationale}>
                                  Configures visual warnings before recorded legal due times. Your default, not a legal
                                  limit. The urgent warning is automatically clamped strictly below the standard
                                  warning.
                                </p>
                              </div>
                              <span className={styles.badge} data-tone="accent">
                                Auto-Clamped
                              </span>
                            </div>

                            {/* Sub-Card 1: First warning (urgent) */}
                            {isRowVisible("setting-due-soon-urgent") && (
                              <div
                                className={`${styles.settingRow} ${styles.vertical}`}
                                data-testid="setting-due-soon-urgent-row"
                                style={{ borderBottom: "1px solid var(--line)", padding: "1.25rem" }}
                              >
                                <div className={styles.rowMeta}>
                                  <span className={styles.rowTitle}>
                                    First warning before a legal due time
                                    <span className={styles.rowTag}>
                                      {formatDueSoonDuration(draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES)}
                                    </span>
                                  </span>
                                  <span className={styles.rowDesc} data-testid="setting-due-soon-urgent-desc">
                                    Shows a recorded legal due time as due within this time. Your default, not a legal
                                    limit.
                                  </span>
                                </div>
                                <div className={styles.sliderBox}>
                                  <div className={styles.stepperCluster}>
                                    <button
                                      type="button"
                                      className={styles.stepperBtn}
                                      aria-label="Decrease first warning before a legal due time"
                                      onClick={() => {
                                        setDraft((curr) => {
                                          const soon = curr.dueSoonMinutes ?? DUE_SOON_MINUTES;
                                          const urgent = curr.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES;
                                          return {
                                            ...curr,
                                            dueSoonUrgentMinutes: clampDueSoonUrgent(
                                              urgent - DUE_SOON_URGENT_RANGE_MINUTES.step,
                                              soon,
                                            ),
                                          };
                                        });
                                      }}
                                    >
                                      <Minus size={16} aria-hidden="true" />
                                    </button>
                                    <div className={styles.stepperDisplay}>
                                      <span className={styles.stepperVal} data-testid="due-soon-urgent-display">
                                        {formatDueSoonDuration(draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES)}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className={styles.stepperBtn}
                                      aria-label="Increase first warning before a legal due time"
                                      onClick={() => {
                                        setDraft((curr) => {
                                          const soon = curr.dueSoonMinutes ?? DUE_SOON_MINUTES;
                                          const urgent = curr.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES;
                                          return {
                                            ...curr,
                                            dueSoonUrgentMinutes: clampDueSoonUrgent(
                                              urgent + DUE_SOON_URGENT_RANGE_MINUTES.step,
                                              soon,
                                            ),
                                          };
                                        });
                                      }}
                                    >
                                      <Plus size={16} aria-hidden="true" />
                                    </button>
                                  </div>
                                  <div className={styles.sliderTickTrack}>
                                    <div className={styles.sliderLine}>
                                      <input
                                        id="setting-due-soon-urgent"
                                        type="range"
                                        min={DUE_SOON_URGENT_RANGE_MINUTES.min}
                                        max={DUE_SOON_URGENT_RANGE_MINUTES.max}
                                        step={DUE_SOON_URGENT_RANGE_MINUTES.step}
                                        value={draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES}
                                        onChange={(e) => {
                                          const minutes = Number(e.target.value);
                                          setDraft((current) => ({
                                            ...current,
                                            dueSoonUrgentMinutes: clampDueSoonUrgent(
                                              minutes,
                                              current.dueSoonMinutes ?? DUE_SOON_MINUTES,
                                            ),
                                          }));
                                        }}
                                        className={styles.rangeSlider}
                                        aria-label="First warning before a legal due time"
                                      />
                                      <span className={styles.sliderVal}>
                                        {formatDueSoonDuration(draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES)}
                                      </span>
                                    </div>
                                    <div className={styles.sliderTicks} aria-hidden="true">
                                      {[15, 30, 60, 90, 120, 150, 180].map((m) => (
                                        <span
                                          key={m}
                                          className={`${styles.sliderTickItem} ${(draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES) === m ? styles.sliderTickItemActive : ""}`}
                                        >
                                          {formatDueSoonDuration(m)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className={styles.sliderFoot}>
                                    <span>{formatDueSoonDuration(DUE_SOON_URGENT_RANGE_MINUTES.min)} (minimum)</span>
                                    <span>{formatDueSoonDuration(DUE_SOON_URGENT_MINUTES)} (default)</span>
                                    <span>{formatDueSoonDuration(DUE_SOON_URGENT_RANGE_MINUTES.max)} (maximum)</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Sub-Card 2: Second warning (soon) */}
                            {isRowVisible("setting-due-soon") && (
                              <div
                                className={`${styles.settingRow} ${styles.vertical}`}
                                data-testid="setting-due-soon-row"
                                style={{ padding: "1.25rem" }}
                              >
                                <div className={styles.rowMeta}>
                                  <span className={styles.rowTitle}>
                                    Second warning before a legal due time
                                    <span className={styles.rowTag}>
                                      {formatDueSoonDuration(draft.dueSoonMinutes ?? DUE_SOON_MINUTES)}
                                    </span>
                                  </span>
                                  <span className={styles.rowDesc} data-testid="setting-due-soon-desc">
                                    Shows a recorded legal due time as due soon from this time. Your default, not a
                                    legal limit.
                                  </span>
                                </div>
                                <div className={styles.sliderBox}>
                                  <div className={styles.stepperCluster}>
                                    <button
                                      type="button"
                                      className={styles.stepperBtn}
                                      aria-label="Decrease second warning before a legal due time"
                                      onClick={() => {
                                        setDraft((curr) => {
                                          const soon = curr.dueSoonMinutes ?? DUE_SOON_MINUTES;
                                          const urgent = curr.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES;
                                          const nextSoon = Math.max(
                                            DUE_SOON_RANGE_MINUTES.min,
                                            soon - DUE_SOON_RANGE_MINUTES.step,
                                          );
                                          return {
                                            ...curr,
                                            dueSoonMinutes: nextSoon,
                                            dueSoonUrgentMinutes: clampDueSoonUrgent(urgent, nextSoon),
                                          };
                                        });
                                      }}
                                    >
                                      <Minus size={16} aria-hidden="true" />
                                    </button>
                                    <div className={styles.stepperDisplay}>
                                      <span className={styles.stepperVal} data-testid="due-soon-display">
                                        {formatDueSoonDuration(draft.dueSoonMinutes ?? DUE_SOON_MINUTES)}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className={styles.stepperBtn}
                                      aria-label="Increase second warning before a legal due time"
                                      onClick={() => {
                                        setDraft((curr) => {
                                          const soon = curr.dueSoonMinutes ?? DUE_SOON_MINUTES;
                                          const urgent = curr.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES;
                                          const nextSoon = Math.min(
                                            DUE_SOON_RANGE_MINUTES.max,
                                            soon + DUE_SOON_RANGE_MINUTES.step,
                                          );
                                          return {
                                            ...curr,
                                            dueSoonMinutes: nextSoon,
                                            dueSoonUrgentMinutes: clampDueSoonUrgent(urgent, nextSoon),
                                          };
                                        });
                                      }}
                                    >
                                      <Plus size={16} aria-hidden="true" />
                                    </button>
                                  </div>
                                  <div className={styles.sliderTickTrack}>
                                    <div className={styles.sliderLine}>
                                      <input
                                        id="setting-due-soon"
                                        type="range"
                                        min={DUE_SOON_RANGE_MINUTES.min}
                                        max={DUE_SOON_RANGE_MINUTES.max}
                                        step={DUE_SOON_RANGE_MINUTES.step}
                                        value={draft.dueSoonMinutes ?? DUE_SOON_MINUTES}
                                        onChange={(e) => {
                                          const minutes = Number(e.target.value);
                                          setDraft((current) => ({
                                            ...current,
                                            dueSoonMinutes: minutes,
                                            dueSoonUrgentMinutes: clampDueSoonUrgent(
                                              current.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES,
                                              minutes,
                                            ),
                                          }));
                                        }}
                                        className={styles.rangeSlider}
                                        aria-label="Second warning before a legal due time"
                                      />
                                      <span className={styles.sliderVal}>
                                        {formatDueSoonDuration(draft.dueSoonMinutes ?? DUE_SOON_MINUTES)}
                                      </span>
                                    </div>
                                    <div className={styles.sliderTicks} aria-hidden="true">
                                      {[30, 60, 120, 180, 240, 360].map((m) => (
                                        <span
                                          key={m}
                                          className={`${styles.sliderTickItem} ${(draft.dueSoonMinutes ?? DUE_SOON_MINUTES) === m ? styles.sliderTickItemActive : ""}`}
                                        >
                                          {formatDueSoonDuration(m)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className={styles.sliderFoot}>
                                    <span>{formatDueSoonDuration(DUE_SOON_RANGE_MINUTES.min)} (minimum)</span>
                                    <span>{formatDueSoonDuration(DUE_SOON_MINUTES)} (default)</span>
                                    <span>{formatDueSoonDuration(DUE_SOON_RANGE_MINUTES.max)} (maximum)</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Visual Timeline Countdown Simulation (0 buttons) */}
                            <div
                              className={styles.timelineGraphContainer}
                              aria-hidden="true"
                              style={{ margin: "0 1.25rem 1.25rem" }}
                            >
                              <div className={styles.timelineGraphHeader}>
                                <span className={styles.timelineGraphTitle}>Warning Threshold Cascade</span>
                                <span className={styles.badge} data-tone="accent">
                                  Visual Countdown
                                </span>
                              </div>
                              <div className={styles.timelineTrack}>
                                <div className={styles.timelineSegmentCalm}>
                                  Normal ({">"} {formatDueSoonDuration(draft.dueSoonMinutes ?? DUE_SOON_MINUTES)})
                                </div>
                                <div className={styles.timelineSegmentSoon}>
                                  Due Soon ({formatDueSoonDuration(draft.dueSoonMinutes ?? DUE_SOON_MINUTES)})
                                </div>
                                <div className={styles.timelineSegmentUrgent}>
                                  Urgent ({formatDueSoonDuration(draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES)}
                                  )
                                </div>
                              </div>
                              <div className={styles.timelineMilestonesRow}>
                                <span>
                                  T - {formatDueSoonDuration(draft.dueSoonMinutes ?? DUE_SOON_MINUTES)} (Second Warning)
                                </span>
                                <span>
                                  T - {formatDueSoonDuration(draft.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES)}{" "}
                                  (First Warning)
                                </span>
                                <span>T - 0 (Deadline)</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Unwired Demonstration Controls Container */}
                      <div className={styles.rowsContainer}>
                        {/* Form 4A Warning Stepper & Slider */}
                        {isRowVisible("setting-form4a-warn") && (
                          <div
                            className={`${styles.settingRow} ${styles.vertical}`}
                            data-testid="setting-form4a-warn-row"
                          >
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>
                                Recorded Form 4A expiry warning (demo)
                                <span className={styles.unwiredPill}>Not wired (Demo)</span>
                                <span className={styles.rowTag}>{statutoryWarningHours} Hours</span>
                              </span>
                              <span className={styles.rowDesc} data-testid="setting-form4a-warn-desc">
                                Would set how far ahead of a recorded Form 4A transport-form expiry a warning appears.
                                Not wired in this prototype.
                              </span>
                            </div>
                            <div className={styles.sliderBox}>
                              <div className={styles.stepperCluster}>
                                <button
                                  type="button"
                                  className={styles.stepperBtn}
                                  aria-disabled="true"
                                  aria-label="Decrease recorded Form 4A expiry warning"
                                  onClick={() => {
                                    showToast("Recorded Form 4A expiry warning is not wired in this prototype.");
                                  }}
                                >
                                  <Minus size={16} aria-hidden="true" />
                                </button>
                                <div className={styles.stepperDisplay}>
                                  <span className={styles.stepperVal}>{statutoryWarningHours}</span>
                                  <span className={styles.stepperUnit}>hours prior</span>
                                </div>
                                <button
                                  type="button"
                                  className={styles.stepperBtn}
                                  aria-disabled="true"
                                  aria-label="Increase recorded Form 4A expiry warning"
                                  onClick={() => {
                                    showToast("Recorded Form 4A expiry warning is not wired in this prototype.");
                                  }}
                                >
                                  <Plus size={16} aria-hidden="true" />
                                </button>
                              </div>
                              <div className={styles.sliderLine}>
                                <input
                                  id="setting-form4a-warn"
                                  type="range"
                                  min={1}
                                  max={12}
                                  step={1}
                                  value={statutoryWarningHours}
                                  aria-disabled="true"
                                  onChange={() => {
                                    showToast("Recorded Form 4A expiry warning is not wired in this prototype.");
                                  }}
                                  className={styles.rangeSlider}
                                  aria-label="Recorded Form 4A expiry warning in hours — not wired in this prototype"
                                />
                                <span className={styles.sliderVal}>{statutoryWarningHours}h prior</span>
                              </div>
                              <div className={styles.sliderFoot}>
                                <span>1h</span>
                                <span>12h</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Auto-escalation Broadcast Toggle */}
                        {isRowVisible("setting-auto-escalate") && (
                          <div className={styles.settingRow} data-testid="setting-auto-escalate-row">
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>
                                Automated Multi-Service Escalation Broadcast
                                <span className={styles.unwiredPill}>Not wired (Demo)</span>
                              </span>
                              <span className={styles.rowDesc} data-testid="setting-auto-escalate-desc">
                                Would notify the Duty Consultant Psychiatrist and statewide bed desk when a threshold is
                                passed. Not wired in this prototype.
                              </span>
                            </div>
                            <div className={styles.rowControl}>
                              <label className={styles.switchToggle}>
                                <input
                                  type="checkbox"
                                  checked={autoEscalationAlerts}
                                  aria-disabled="true"
                                  onChange={() => {
                                    showToast(
                                      "Automated Multi-Service Escalation Broadcast is not wired in this prototype.",
                                    );
                                  }}
                                  aria-label="Automated Multi-Service Escalation Broadcast — not wired in this prototype"
                                />
                                <span className={styles.switchSlider} />
                              </label>
                            </div>
                          </div>
                        )}

                        {/* Medical Clearance Buffer Select */}
                        {isRowVisible("setting-medical-release") && (
                          <div className={styles.settingRow} data-testid="setting-medical-release-row">
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>
                                Medical Clearance Bed Release Buffer
                                <span className={styles.unwiredPill}>Not wired (Demo)</span>
                              </span>
                              <span className={styles.rowDesc} data-testid="setting-medical-release-desc">
                                Would set how long a psychiatric bed reservation survives while emergency medical
                                clearance is pending. Not wired in this prototype.
                              </span>
                            </div>
                            <div className={styles.rowControl}>
                              <select
                                className={styles.selectBox}
                                value={medicalReleaseMinutes}
                                aria-disabled="true"
                                onChange={() => {
                                  showToast("Medical Clearance Bed Release Buffer is not wired in this prototype.");
                                }}
                                aria-label="Medical Clearance Bed Release Buffer — not wired in this prototype"
                              >
                                <option value={60}>60 Minutes</option>
                                <option value={120}>120 Minutes</option>
                                <option value={180}>180 Minutes</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Published Thresholds Table */}
                      {isRowVisible("setting-published-thresholds") && (
                        <WardPanel title="Thresholds" testId="ward-settings-thresholds">
                          <div className={styles.referenceBody}>
                            <div className={styles.calloutCard} data-tone="accent">
                              <p className={styles.calloutText}>
                                Figures here change only through the controls above, and every change is recorded.
                              </p>
                            </div>
                            <div
                              className={styles.tableWrap}
                              role="region"
                              aria-label="Published thresholds"
                              tabIndex={0}
                            >
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
                                      <td>
                                        <strong>{threshold.figure}</strong>
                                      </td>
                                      <td>{threshold.triggers}</td>
                                      <td data-threshold-state={threshold.state}>
                                        <span
                                          className={styles.badge}
                                          data-tone={threshold.state === "fires-now" ? "warn" : "accent"}
                                        >
                                          {THRESHOLD_STATE_WORDS[threshold.state]}
                                          {threshold.state === "fires-now" ? ` — ${threshold.reached}` : null}
                                        </span>
                                      </td>
                                      <td>
                                        <code>{threshold.livesIn}</code>
                                      </td>
                                      <td>{threshold.setBy}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </WardPanel>
                      )}

                      {/* Operational Defaults List */}
                      {isRowVisible("setting-operational-defaults") && (
                        <WardPanel title="Operational defaults">
                          <div className={styles.referenceBody}>
                            <div className={styles.calloutCard} data-tone="accent">
                              <p className={styles.calloutText}>
                                Read-only for now. Each is {OPERATIONAL_DEFAULT_LABEL}.
                              </p>
                            </div>
                            <div
                              className={styles.tableWrap}
                              role="region"
                              aria-label="Operational defaults"
                              tabIndex={0}
                            >
                              <table className={styles.table}>
                                <thead>
                                  <tr>
                                    <th scope="col">Default</th>
                                    <th scope="col">Value</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {OPERATIONAL_DEFAULTS.map((item) => (
                                    <tr key={item.name} data-testid={`ward-settings-operational-default-${item.name}`}>
                                      <td>{item.name}</td>
                                      <td>
                                        <strong>{item.display}</strong>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </WardPanel>
                      )}
                    </section>
                  )}
                  {/* DOMAIN 3: BED ALLOCATION WEIGHTS */}
                  {(isRowVisible("setting-gender-mix") || isRowVisible("setting-acuity-ceiling")) && (
                    <section id="cat-allocation" className={styles.settingsSection} aria-labelledby="allocation-title">
                      <header className={styles.sectionHeader}>
                        <div>
                          <span className={styles.secEyebrow}>Domain 3 · Capacity &amp; Surge</span>
                          <h2 id="allocation-title" className={styles.secTitle}>
                            Bed Allocation &amp; Capacity Rules
                          </h2>
                          <p className={styles.secDesc}>Bay integrity enforcement and ward acuity profile limits.</p>
                        </div>
                        <span className={styles.rowTag}>2 Parameters (Demo)</span>
                      </header>

                      <div className={styles.rowsContainer}>
                        {/* Gender Bay Protection */}
                        {isRowVisible("setting-gender-mix") && (
                          <div className={styles.settingRow} data-testid="setting-gender-mix-row">
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>
                                Gender Designation &amp; Bay Integrity Enforcement
                                <span className={styles.unwiredPill}>Not wired (Demo)</span>
                              </span>
                              <span className={styles.rowDesc} data-testid="setting-gender-mix-desc">
                                Would flag placement into a mixed-gender multi-bed bay unless a Ward NUM override is
                                recorded. Not wired in this prototype.
                              </span>
                            </div>
                            <div className={styles.rowControl}>
                              <label className={styles.switchToggle}>
                                <input
                                  type="checkbox"
                                  checked={genderMixProtection}
                                  aria-disabled="true"
                                  onChange={() => {
                                    showToast(
                                      "Gender Designation & Bay Integrity Enforcement is not wired in this prototype.",
                                    );
                                  }}
                                  aria-label="Gender Designation and Bay Integrity Enforcement — not wired in this prototype"
                                />
                                <span className={styles.switchSlider} />
                              </label>
                            </div>
                          </div>
                        )}

                        {/* Acuity Specialling Ceiling */}
                        {isRowVisible("setting-acuity-ceiling") && (
                          <div className={styles.settingRow} data-testid="setting-acuity-ceiling-row">
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>
                                Ward Acuity &amp; 1:1 Specialling Ceiling
                                <span className={styles.unwiredPill}>Not wired (Demo)</span>
                              </span>
                              <span className={styles.rowDesc} data-testid="setting-acuity-ceiling-desc">
                                Would set how many concurrent high-dependency 1:1 specialling patients a ward may hold.
                                Not wired in this prototype.
                              </span>
                            </div>
                            <div className={styles.rowControl}>
                              <select
                                className={styles.selectBox}
                                value={acuityCeiling}
                                aria-disabled="true"
                                onChange={() => {
                                  showToast("Ward Acuity & 1:1 Specialling Ceiling is not wired in this prototype.");
                                }}
                                aria-label="Ward Acuity and 1:1 Specialling Ceiling — not wired in this prototype"
                              >
                                <option value={2}>2 Patients</option>
                                <option value={3}>3 Patients</option>
                                <option value={4}>4 Patients</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* DOMAIN 4: NOTIFICATIONS & TELEMETRY */}
                  {(isRowVisible("setting-buzz-alert") ||
                    isRowVisible("setting-wallboard-refresh") ||
                    isRowVisible("setting-form1a-strict") ||
                    isRowVisible("setting-form4a-escort") ||
                    isRowVisible("setting-auth-hospital") ||
                    isRowVisible("setting-cp-audit") ||
                    isRowVisible("setting-roles-matrix") ||
                    isRowVisible("setting-keyboard-shortcuts") ||
                    isRowVisible("setting-search-ledger")) && (
                    <section
                      id="cat-notifications"
                      className={styles.settingsSection}
                      aria-labelledby="notifications-title"
                    >
                      <header className={styles.sectionHeader}>
                        <div>
                          <span className={styles.secEyebrow}>Domain 4 · Governance &amp; Telemetry</span>
                          <h2 id="notifications-title" className={styles.secTitle}>
                            Notifications, Access Matrix &amp; Telemetry
                          </h2>
                          <p className={styles.secDesc}>
                            Clinical escalation notifications, AHPRA-aligned role scopes, keyboard accelerators, and
                            search access telemetry.
                          </p>
                        </div>
                        <span className={styles.rowTag}>Clinical Governance</span>
                      </header>

                      <div className={styles.rowsContainer}>
                        {/* Audio & Visual Urgent Buzz Alerts */}
                        {isRowVisible("setting-buzz-alert") && (
                          <div className={styles.settingRow} data-testid="setting-buzz-alert-row">
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>Audio &amp; Visual Urgent Buzz Alerts</span>
                              <span className={styles.rowDesc} data-testid="setting-buzz-alert-desc">
                                Sound an audible chime and display a visual flash when an urgent coordinator buzz is
                                received by a ward.
                              </span>
                            </div>
                            <div className={styles.rowControl}>
                              <label className={styles.switchToggle}>
                                <input
                                  type="checkbox"
                                  checked={audioBuzzAlerts}
                                  onChange={() => {
                                    const next = !audioBuzzAlerts;
                                    setAudioBuzzAlerts(next);
                                    setAudioBuzzPreference(next);
                                    showToast(
                                      next
                                        ? "Audio & visual urgent buzz alerts enabled."
                                        : "Audio & visual urgent buzz alerts disabled.",
                                    );
                                  }}
                                  aria-label="Audio & Visual Urgent Buzz Alerts"
                                />
                                <span className={styles.switchSlider} />
                              </label>
                            </div>
                          </div>
                        )}

                        {/* Wallboard Auto-Refresh Timer */}
                        {isRowVisible("setting-wallboard-refresh") && (
                          <div className={styles.settingRow} data-testid="setting-wallboard-refresh-row">
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>Wallboard Auto-Refresh Timer</span>
                              <span className={styles.rowDesc} data-testid="setting-wallboard-refresh-desc">
                                Automatically refresh countdown clocks and telemetry for unattended wall displays in EDs
                                and Coordinator desks.
                              </span>
                            </div>
                            <div className={styles.rowControl}>
                              <div
                                className={styles.segTrack}
                                role="radiogroup"
                                aria-label="Wallboard Auto-Refresh Timer"
                              >
                                {(
                                  [
                                    { value: "off", label: "Off" },
                                    { value: 15, label: "15s" },
                                    { value: 30, label: "30s" },
                                    { value: 60, label: "60s" },
                                  ] as const
                                ).map((opt) => (
                                  <button
                                    key={String(opt.value)}
                                    type="button"
                                    role="radio"
                                    aria-checked={wallboardRefresh === opt.value}
                                    className={styles.segBtn}
                                    onClick={() => {
                                      setWallboardRefresh(opt.value);
                                      setWallboardRefreshPreference(opt.value);
                                      showToast(
                                        opt.value === "off"
                                          ? "Wallboard auto-refresh disabled."
                                          : `Wallboard auto-refresh interval set to ${opt.label}.`,
                                      );
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {isRowVisible("setting-form1a-strict") && (
                          <div className={styles.settingRow} data-testid="setting-form1a-strict-row">
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>
                                Require a Form 1A before an involuntary admission
                                <span className={styles.unwiredPill}>Not wired (Demo)</span>
                              </span>
                              <span className={styles.rowDesc} data-testid="setting-form1a-strict-desc">
                                Would flag a Form 1A referral for examination once it runs past its window. Not wired in
                                this prototype.
                              </span>
                            </div>
                            <div className={styles.rowControl}>
                              <label className={styles.switchToggle}>
                                <input
                                  type="checkbox"
                                  checked={statutoryExpiryAlerts}
                                  aria-disabled="true"
                                  onChange={() => {
                                    showToast(
                                      "Require a Form 1A before an involuntary admission is not wired in this prototype.",
                                    );
                                  }}
                                  aria-label="Require a Form 1A before an involuntary admission — not wired in this prototype"
                                />
                                <span className={styles.switchSlider} />
                              </label>
                            </div>
                          </div>
                        )}

                        {isRowVisible("setting-form4a-escort") && (
                          <div className={styles.settingRow} data-testid="setting-form4a-escort-row">
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>
                                Escort required before transport advances (demo)
                                <span className={styles.unwiredPill}>Not wired (Demo)</span>
                              </span>
                              <span className={styles.rowDesc} data-testid="setting-form4a-escort-desc">
                                Would require an escort to be assigned before a recorded Form 4A transport advances. Not
                                wired in this prototype.
                              </span>
                            </div>
                            <div className={styles.rowControl}>
                              <label className={styles.switchToggle}>
                                <input
                                  type="checkbox"
                                  checked={autoCapacityRefresh}
                                  aria-disabled="true"
                                  onChange={() => {
                                    showToast(
                                      "Escort required before transport advances (demo) is not wired in this prototype.",
                                    );
                                  }}
                                  aria-label="Escort required before transport advances (demo) — not wired in this prototype"
                                />
                                <span className={styles.switchSlider} />
                              </label>
                            </div>
                          </div>
                        )}

                        {isRowVisible("setting-auth-hospital") && (
                          <div className={styles.settingRow} data-testid="setting-auth-hospital-row">
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>
                                Authorised Hospital Involuntary Bed Validation
                                <span className={styles.unwiredPill}>Not wired (Demo)</span>
                              </span>
                              <span className={styles.rowDesc} data-testid="setting-auth-hospital-desc">
                                Would flag an involuntary patient being directed to a non-gazetted mental health
                                facility. Not wired in this prototype.
                              </span>
                            </div>
                            <div className={styles.rowControl}>
                              <label className={styles.switchToggle}>
                                <input
                                  type="checkbox"
                                  checked={multiCatchmentSearch}
                                  aria-disabled="true"
                                  onChange={() => {
                                    showToast(
                                      "Authorised Hospital Involuntary Bed Validation is not wired in this prototype.",
                                    );
                                  }}
                                  aria-label="Authorised Hospital Involuntary Bed Validation — not wired in this prototype"
                                />
                                <span className={styles.switchSlider} />
                              </label>
                            </div>
                          </div>
                        )}

                        {isRowVisible("setting-cp-audit") && (
                          <div className={styles.settingRow} data-testid="setting-cp-audit-row">
                            <div className={styles.rowMeta}>
                              <span className={styles.rowTitle}>
                                Audit Log for Chief Psychiatrist
                                <span className={styles.unwiredPill}>Not wired (Demo)</span>
                              </span>
                              <span className={styles.rowDesc} data-testid="setting-cp-audit-desc">
                                Would append a timestamped record of any override or delayed examination for governance
                                review. Not wired in this prototype.
                              </span>
                            </div>
                            <div className={styles.rowControl}>
                              <label className={styles.switchToggle}>
                                <input
                                  type="checkbox"
                                  checked={audioBreachChimes}
                                  aria-disabled="true"
                                  onChange={() => {
                                    showToast("Audit Log for Chief Psychiatrist is not wired in this prototype.");
                                  }}
                                  aria-label="Audit Log for Chief Psychiatrist — not wired in this prototype"
                                />
                                <span className={styles.switchSlider} />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* AHPRA Roles Matrix */}
                      {isRowVisible("setting-roles-matrix") && (
                        <div className={styles.tableCard}>
                          <div
                            className={styles.tableWrap}
                            role="region"
                            aria-label="Role permissions matrix"
                            tabIndex={0}
                          >
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th scope="col">Clinical Role</th>
                                  <th scope="col">Operational Scope</th>
                                  <th scope="col">Legal Form Sign-off</th>
                                  <th scope="col">Override Privilege</th>
                                  <th scope="col">Handover Sign-Off</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ROLE_PERMISSIONS.map((item) => (
                                  <tr key={item.role}>
                                    <td>
                                      <strong>{item.role}</strong>
                                    </td>
                                    <td>{item.scope}</td>
                                    <td>
                                      <span className={styles.badge} data-tone={item.formsTone}>
                                        {item.forms}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={styles.badge} data-tone={item.overrideTone}>
                                        {item.override}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={styles.badge} data-tone={item.handoverTone}>
                                        {item.handover}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Tactical Shortcuts & Telemetry Ledger */}
                      {(isRowVisible("setting-keyboard-shortcuts") || isRowVisible("setting-search-ledger")) && (
                        <div className={styles.shortcutsGrid}>
                          {isRowVisible("setting-keyboard-shortcuts") && (
                            <div className={styles.shortcutCard}>
                              <div className={styles.shortcutHeader}>
                                <span>Keyboard Accelerators</span>
                                <span className={styles.rowTag}>Cheatsheet</span>
                              </div>
                              <div className={styles.shortcutList}>
                                <div className={styles.shortcutRow}>
                                  <span>Focus search settings</span>
                                  <kbd className={styles.kbdBadge}>/</kbd>
                                </div>
                                <div className={styles.shortcutRow}>
                                  <span>Dismiss search / close modals</span>
                                  <kbd className={styles.kbdBadge}>Esc</kbd>
                                </div>
                                <div className={styles.shortcutRow}>
                                  <span>Toggle navigation rail</span>
                                  <kbd className={styles.kbdBadge}>[</kbd>
                                </div>
                                <div className={styles.shortcutRow}>
                                  <span>Global command palette</span>
                                  <kbd className={styles.kbdBadge}>Cmd + K</kbd>
                                </div>
                              </div>
                            </div>
                          )}

                          {isRowVisible("setting-search-ledger") && (
                            <div className={styles.shortcutCard}>
                              <div className={styles.shortcutHeader}>
                                <span>Ephemeral Search Ledger</span>
                                <button
                                  type="button"
                                  className={styles.btnSecondary}
                                  onClick={handleClearLedger}
                                  title="Clear search telemetry history"
                                >
                                  Clear History
                                </button>
                              </div>
                              <div className={styles.ledgerBox}>
                                <div className={styles.ledgerMeta}>
                                  <strong>Recorded Queries ({searchHistory.length})</strong>
                                  <span>
                                    {searchHistory.length > 0
                                      ? searchHistory.join(" · ")
                                      : "No recent search queries stored in this session."}
                                  </span>
                                </div>
                              </div>
                              <p className={styles.note}>
                                Local browser session memory only. Zero network persistence.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}

                  {/* DOMAIN 5: LOCAL STORAGE & RESET */}
                  {(isRowVisible("setting-default-service") ||
                    isRowVisible("setting-handover-sheet") ||
                    isRowVisible("setting-demonstration-data")) && (
                    <section id="cat-reset" className={styles.settingsSection} aria-labelledby="reset-domain-title">
                      <header className={styles.sectionHeader}>
                        <div>
                          <span className={styles.secEyebrow}>Domain 5 · Storage &amp; Defaults</span>
                          <h2 id="reset-domain-title" className={styles.secTitle}>
                            Local Storage, Workspace &amp; Baseline Reset
                          </h2>
                          <p className={styles.secDesc}>
                            Browser session memory, clinical handover sheet output configuration, and audited
                            configuration baseline restoration.
                          </p>
                        </div>
                        <span className={styles.rowTag}>Persistence &amp; Reset</span>
                      </header>

                      <div className={styles.workspaceGrid}>
                        {isRowVisible("setting-default-service") && (
                          <WardPanel title="Default service" testId="ward-settings-default-service">
                            <div className={styles.compactBody}>
                              <div className={styles.preferenceStatus}>
                                <span>Starts on</span>
                                <strong>All services</strong>
                              </div>
                              <div className={styles.calloutCard}>
                                <p className={styles.calloutText}>
                                  Not saved. Choose a service from the bar for this visit.
                                </p>
                              </div>
                            </div>
                          </WardPanel>
                        )}

                        {isRowVisible("setting-handover-sheet") && (
                          <WardPanel title="Handover sheet" testId="ward-settings-handover">
                            <div className={styles.compactBody}>
                              <p className={styles.body}>
                                Point-in-Time Shift Handover &amp; Bedflow Snapshot includes: Longest waits, Beds
                                pulled, In transit, Placement gone wrong, Outside this filter, Still open at 15:00,
                                Shift and sign off, and Clinical Handover Details. Generated on demand.
                              </p>
                              <Link className={styles.inlineLink} href="/mockups/ward-flow/handover">
                                Open Handover
                              </Link>
                            </div>
                          </WardPanel>
                        )}

                        {isRowVisible("setting-demonstration-data") && (
                          <WardPanel title="Demonstration data" testId="ward-settings-demonstration">
                            <div className={styles.compactBody}>
                              <div className={styles.calloutCard}>
                                <p className={styles.calloutText}>
                                  Clock, scenario and data reset controls are in <strong>Tools</strong> in the bar.
                                </p>
                              </div>
                            </div>
                          </WardPanel>
                        )}

                        {/* Storage Telemetry & Quota Diagnostics Card */}
                        <div className={styles.storageTelemetryCard} data-testid="ward-settings-storage-telemetry">
                          <div className={styles.telemetryHeader}>
                            <div className={styles.telemetryTitleGroup}>
                              <Database size={16} className={styles.telemetryIcon} aria-hidden="true" />
                              <h3 className={styles.telemetryTitle}>Storage Telemetry &amp; Quota Diagnostics</h3>
                            </div>
                            <span className={styles.cacheHealthBadge}>
                              <span className={styles.statusDotLive} aria-hidden="true" />
                              Cache Healthy
                            </span>
                          </div>

                          <p className={styles.telemetryDesc}>
                            Ward Flow client-side caching maintains active bed coordination states, ephemeral search
                            logs, and governance audit trails. Zero identifiable patient records leave this browser
                            without explicit export.
                          </p>

                          {/* Visual Storage Quota Bar */}
                          <div className={styles.quotaSection}>
                            <div className={styles.quotaHeader}>
                              <span className={styles.quotaLabel}>Browser Cache &amp; Storage Quota</span>
                              <span className={styles.quotaValue}>
                                {storageEstimate.usedFormatted} of {storageEstimate.quotaFormatted} (
                                {storageEstimate.percent}%)
                              </span>
                            </div>
                            <div
                              className={styles.quotaBarTrack}
                              role="progressbar"
                              aria-valuenow={storageEstimate.percent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label="Browser storage quota usage"
                            >
                              <div
                                className={styles.quotaBarFill}
                                style={{ width: `${Math.max(2, storageEstimate.percent)}%` }}
                              />
                            </div>
                          </div>

                          {/* Cache Health Metrics Grid */}
                          <div className={styles.cacheHealthGrid}>
                            <div className={styles.cacheMetricItem}>
                              <span className={styles.metricLabel}>Active Movements</span>
                              <strong className={styles.metricVal}>{movements.length}</strong>
                              <span className={styles.metricSub}>Inpatient bed tracking</span>
                            </div>
                            <div className={styles.cacheMetricItem}>
                              <span className={styles.metricLabel}>Audited Actions</span>
                              <strong className={styles.metricVal}>{rejections.length}</strong>
                              <span className={styles.metricSub}>Recorded governance actions</span>
                            </div>
                            <div className={styles.cacheMetricItem}>
                              <span className={styles.metricLabel}>Last State Sync</span>
                              <strong className={styles.metricVal}>Active</strong>
                              <span className={styles.metricSub}>Local clock synchronized</span>
                            </div>
                            <div className={styles.cacheMetricItem}>
                              <span className={styles.metricLabel}>Appearance &amp; Rail</span>
                              <strong className={styles.metricVal}>
                                {appearance} · {railOpen ? "Expanded" : "Collapsed"}
                              </strong>
                              <span className={styles.metricSub}>Client-persisted UI mode</span>
                            </div>
                          </div>

                          {/* Storage Actions Bar */}
                          <div className={styles.storageActionsBar}>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              onClick={handleExportConfig}
                              title="Download JSON configuration backup"
                              data-testid="btn-export-config"
                            >
                              <Download size={14} aria-hidden="true" />
                              <span>Export Configuration JSON</span>
                            </button>

                            <label
                              className={styles.btnSecondaryLabel}
                              title="Upload and restore a configuration JSON backup"
                            >
                              <Upload size={14} aria-hidden="true" />
                              <span>Import Backup JSON</span>
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
                              className={styles.btnSecondary}
                              onClick={handleClearTransientCache}
                              title="Purge ephemeral demo state and search ledger"
                              data-testid="btn-clear-cache"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              <span>Clear Transient Cache</span>
                            </button>
                          </div>
                        </div>

                        {/* Baseline Reset Danger Zone */}
                        <div className={styles.dangerZoneCard} data-testid="ward-settings-danger-zone">
                          <div className={styles.dangerZoneHeader}>
                            <div className={styles.dangerIconBadge}>
                              <AlertTriangle size={18} aria-hidden="true" />
                            </div>
                            <div className={styles.dangerZoneMeta}>
                              <h3 className={styles.dangerZoneTitle}>Baseline Reset &amp; Disaster Recovery</h3>
                              <p className={styles.dangerZoneDesc}>
                                Restoring the factory baseline overwrites all coordination thresholds (ED target,
                                parallel cap, pull hold buffer, morning rollup, due-time alerts) back to WA Health
                                clinical standards, resets UI appearance and rail preferences, and records an audited
                                governance entry.
                              </p>
                            </div>
                          </div>

                          <div className={styles.dangerZoneActionRow}>
                            <div className={styles.dangerZoneNote}>
                              <span>Audited operation: Requires coordinator confirmation.</span>
                            </div>
                            <button
                              type="button"
                              className={styles.btnDanger}
                              onClick={() => setIsResetModalOpen(true)}
                              aria-haspopup="dialog"
                              aria-label="Restore all defaults"
                              data-testid="btn-restore-baseline"
                            >
                              <RotateCcw size={15} aria-hidden="true" />
                              <span>Restore all defaults</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
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
