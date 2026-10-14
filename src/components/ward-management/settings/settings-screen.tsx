"use client";

import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Bell,
  Check,
  ChevronRight,
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
import {
  applyAppearance,
  applyGlare,
  useAppearanceStore,
  useGlareStore,
} from "@/components/ward-management/shell/ward-bar";
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
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import {
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_MINUTES,
  MORNING_ROLLUP_TIME_RANGE_MINUTES,
  PARALLEL_REFERRAL_CAP_RANGE,
  PULL_HOLD_RANGE_MINUTES,
} from "@/components/ward-management/ward-model";
import {
  DECISION_TARGET_RANGE_MINUTES,
  DUE_SOON_MINUTES,
  DUE_SOON_RANGE_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
  WARD_ANSWER_TARGET_MINUTES,
  SILENT_WARD_FIRST_REMINDER_MINUTES,
  TRANSFER_ACCEPTANCE_TARGET_MINUTES,
  TRANSPORT_BOOKED_TARGET_MINUTES,
  UNDO_TOAST_MS,
} from "@/components/ward-management/ward-operational-defaults";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { DECISION_TARGET_STEPS } from "@/components/ward-management/ward-decision-targets";
import {
  enableActNowNotifications,
  notificationSupport,
  setActNowNotificationPreference,
  useActNowNotificationPreference,
  type NotificationSupport,
} from "@/components/ward-management/shell/ward-act-now-notifications";
import { usePhonePush } from "@/components/ward-management/shell/ward-phone-push";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  CountCircle,
  Hero,
  HeroChip,
  HeroChips,
  HeroTrack,
  Kbd,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  SrOnly,
  StatusGlyph,
  Switch,
  buttonClass,
  cx,
  useIsPhone,
  useOptionalToast,
  type ToastInput,
  type WfTone,
} from "@/components/wf";

import { OperatorSwitcherModal } from "./operator-switcher-modal";
import { ResetBaselineModal } from "./reset-baseline-modal";
import {
  AlertsPane,
  DataPane,
  DisplayPane,
  ProfilePane,
  THEME_CHOICES,
  type ReferenceTab,
  type ThemeChoice,
} from "./settings-panes";
import { useDiscreetNamesSetting } from "./discreet-names";
import { useRowDensity, type RowDensity } from "./row-density";
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
 * Everything marked Preview is shown for review only. Site review (12 Oct 2026): such a control
 * works like any other and, when pressed, says "<name> is not wired in this prototype." (D4, D-16);
 * it is never greyed. Row density is wired (`row-density.tsx`).
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

/** The settings a phone shows on its first screen (Find a setting lands there, not in a sheet). */
const PHONE_QUICK_SETTINGS: ReadonlySet<string> = new Set(["theme", "density", "discreet-names", "buzz"]);

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
  if (a.soon !== b.soon) {
    parts.push(`Early warning ${shortDuration(a.soon)} to ${shortDuration(b.soon)}`);
  }
  if (a.urgent !== b.urgent) {
    parts.push(`Final warning ${shortDuration(a.urgent)} to ${shortDuration(b.urgent)}`);
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

export function maskDiagnosticPatient(patient: DiagnosticPatientInput): { id?: string } {
  return {
    ...(patient.id !== undefined ? { id: patient.id } : {}),
  };
}

export function maskDiagnosticMovement(movement: DiagnosticMovementInput): {
  id: string;
  stage?: unknown;
  originEdId?: unknown;
  acceptedUnitId?: unknown;
  admissionId?: unknown;
  openedAt?: unknown;
  acceptedAt?: unknown;
  pulledAt?: unknown;
  arrivedAt?: unknown;
} {
  const allowed = [
    "stage",
    "originEdId",
    "acceptedUnitId",
    "admissionId",
    "openedAt",
    "acceptedAt",
    "pulledAt",
    "arrivedAt",
  ] as const;
  return {
    id: movement.id,
    ...Object.fromEntries(allowed.flatMap((key) => (movement[key] !== undefined ? [[key, movement[key]]] : []))),
  };
}

export type DiagnosticPatientInput = {
  id?: string;
  umrn?: string;
  mrn?: string;
  givenName?: string;
  familyName?: string;
  preferredName?: string;
  displayName?: string;
  name?: string;
  [key: string]: unknown;
};

export type DiagnosticMovementInput = {
  id: string;
  patientName?: string;
  patientUmrn?: string;
  patientMrn?: string;
  mrn?: string;
  [key: string]: unknown;
};

export async function copySettingsDiagnostics(state: {
  configuration: WardConfiguration;
  movements?: readonly DiagnosticMovementInput[];
  patients?: readonly DiagnosticPatientInput[];
}): Promise<string> {
  const maskedPatients = (state.patients ?? []).map(maskDiagnosticPatient);
  const maskedMovements = (state.movements ?? []).map(maskDiagnosticMovement);

  const payload = {
    product: "Ward Flow Statewide Bed Coordination",
    version: 6,
    exportedAt: new Date().toISOString(),
    configuration: state.configuration,
    movementCount: (state.movements ?? []).length,
    patientCount: (state.patients ?? []).length,
    movements: maskedMovements,
    patients: maskedPatients,
  };

  const text = JSON.stringify(payload, null, 2);
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard is unavailable");
  }
  await navigator.clipboard.writeText(text);
  return text;
}

export function SettingsScreen() {
  const appearance = useAppearanceStore();
  const glare = useGlareStore();
  const railOpen = useRailOpenStore();
  const { movements, dispatch, rejections, configuration, eventLog = [], readAuditEvents, patients } = useWardFlow();
  const now = useWardFlowClock();
  const thresholds = publishedThresholds(movements, now, configuration);

  /**
   * The six rules are edited as a local DRAFT of `state.configuration`, never applied directly.
   * Steppers, sliders, Surge and Import only ever call `setDraft`; the provider's value, and
   * everything that reads it, stays put until Save dispatches `SET_CONFIGURATION`.
   */
  const [draft, setDraft] = useState<WardConfiguration>(configuration);
  const [tab, setTab] = useState<SettingsTab>("rules");
  // Phone only: the area whose tall sheet is open. The desktop never reads it.
  const isPhone = useIsPhone();
  const [phoneSheet, setPhoneSheet] = useState<SettingsTab | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useWardAccessibilityPreference("reduced-motion");
  const [highContrast, setHighContrast] = useWardAccessibilityPreference("high-contrast");
  const [rowDensity, setRowDensity] = useRowDensity();
  const [discreetNames, setDiscreetNames] = useDiscreetNamesSetting();
  const [audioBuzz, setAudioBuzz] = useAudioBuzzPreference();
  const [actNowNotifications] = useActNowNotificationPreference();
  const [notificationPermission, setNotificationPermission] = useState<NotificationSupport>("default");
  const [phonePush, setPhonePush] = usePhonePush();
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

  // v10 pass 3: every outcome on this page goes through the shared wf toast (one polite live
  // region for the whole app, set up by the ward layout). Words stay neutral; the glyph carries tone.
  const toast = useOptionalToast();
  const showToast = useCallback(
    (message: string, tone: ToastInput["tone"] = "info") => {
      toast?.push({ tone, title: message, duration: 3200 });
    },
    [toast],
  );
  // Audit settings-15 (Josh, 13 Oct 2026): Glare is a fourth Theme choice, so Theme never reads Dark
  // while the page is in Glare's light. One choice, one toast.
  const theme: ThemeChoice = glare ? "glare" : appearance;
  const chooseTheme = useCallback(
    (next: ThemeChoice) => {
      if (next === "glare") {
        applyGlare(true);
      } else {
        applyGlare(false);
        applyAppearance(next);
      }
      const label = THEME_CHOICES.find((choice) => choice.id === next)?.label ?? "Auto";
      showToast(`Theme set to ${label}.`);
    },
    [showToast],
  );
  // D-16: "<name> is not wired in this prototype." No colon outside a clock time.
  const onPreview = useCallback(
    (name: string) => showToast(`${name} is ${NOT_WIRED.charAt(0).toLowerCase()}${NOT_WIRED.slice(1)}`),
    [showToast],
  );
  const chooseRowDensity = useCallback(
    (next: RowDensity) => {
      setRowDensity(next);
      showToast(`Row density set to ${next === "compact" ? "Compact" : "Comfortable"}.`);
    },
    [setRowDensity, showToast],
  );
  const chooseDiscreetNames = useCallback(
    (next: boolean) => {
      setDiscreetNames(next);
      showToast(`Discreet names on phone ${next ? "on" : "off"}.`);
    },
    [setDiscreetNames, showToast],
  );

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
  useDirtyStateGuard({ isDirty: hasUnsavedRules });
  const isSurge = isSurgePreset(draft);

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

  /**
   * A save waits for the reducer: the toast with Undo shows only once the saved configuration has
   * changed, and never when the save was refused (the refusal line says why instead).
   */
  const pendingSave = useRef<{ before: WardConfiguration; count: number; rejectionsAt: number } | null>(null);

  const handleSave = () => {
    if (!hasUnsavedRules) return;
    pendingSave.current = { before: configuration, count: unsavedCount, rejectionsAt: rejections.length };
    dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now, payload: draft });
    setPhoneSheet(null);
  };

  useEffect(() => {
    const pending = pendingSave.current;
    if (!pending) return;
    if (rejections.length > pending.rejectionsAt) {
      pendingSave.current = null;
      return;
    }
    if (configuration === pending.before) return;
    pendingSave.current = null;
    const { before, count } = pending;
    const changed = ruleDiffs(before, configuration);
    toast?.push({
      tone: "success",
      title:
        changed.length > 0
          ? `${changed.join(", ")}, saved and recorded.`
          : count === 1
            ? "Rule saved and recorded."
            : `${count} rules saved and recorded.`,
      // Undo puts the rules back with a second recorded save, so the audit keeps both.
      undo: {
        durationMs: UNDO_TOAST_MS,
        onUndo: () => {
          dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now, payload: before });
          setDraft({ ...before });
          showToast("Rules back as they were. Recorded in the audit.");
        },
      },
    });
  }, [configuration, rejections, toast, dispatch, now, showToast]);

  const handleDiscard = () => {
    const kept = draft;
    setDraft({ ...configuration });
    toast?.push({
      tone: "info",
      title: "Draft discarded.",
      undo: { durationMs: UNDO_TOAST_MS, onUndo: () => setDraft(kept) },
    });
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

  const handleCopyDiagnostics = async () => {
    try {
      await copySettingsDiagnostics({
        configuration,
        movements,
        patients,
      });
      showToast("Diagnostics copied to clipboard (records masked).");
    } catch {
      showToast("Diagnostics could not be copied.");
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
    // Audit settings-18: everything a restore changes can come back from the toast, as a rule save
    // can. Undo puts the rules back with a second recorded save, so the audit keeps both.
    const before = {
      configuration,
      // The draft as it stands, unsaved edits included, so Undo gives those back too.
      draft,
      buzz: audioBuzz,
      appearance,
      glare,
      railOpen,
    };
    const defaults = defaultWardConfiguration();
    dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now, payload: defaults });
    setDraft({ ...defaults });
    setAudioBuzz(true);
    setAudioBuzzPreference(true);
    applyAppearance("auto");
    applyGlare(false);
    setRailOpenPreference(true);
    setIsResetModalOpen(false);
    toast?.push({
      tone: "success",
      title: "Defaults restored and recorded.",
      undo: {
        durationMs: UNDO_TOAST_MS,
        onUndo: () => {
          dispatch({ type: "SET_CONFIGURATION", role: "coordinator", now, payload: before.configuration });
          setDraft({ ...before.draft });
          setAudioBuzz(before.buzz);
          setAudioBuzzPreference(before.buzz);
          applyAppearance(before.appearance);
          applyGlare(before.glare);
          setRailOpenPreference(before.railOpen);
          showToast("Settings back as they were. Recorded in the audit.");
        },
      },
    });
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
      element?.scrollIntoView?.({ block: "center", behavior: wardScrollBehavior() });
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
    if (entry.id === "go-to-desk") {
      setQuery("");
      setFindOpen(false);
      setIsOperatorModalOpen(true);
      return;
    }
    chooseTab(entry.tab);
    // Fixed defaults sits behind the reference card's second tab; show it before highlighting.
    if (entry.id === "fixed-defaults") setReference("defaults");
    // Phone: the four quick settings sit on the screen itself; every other one opens its area.
    if (isPhone) setPhoneSheet(PHONE_QUICK_SETTINGS.has(entry.id) ? null : entry.tab);
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
    minLabel: `${ED_ACCESS_TARGET_RANGE_MINUTES.min / 60}h`,
    maxLabel: `${ED_ACCESS_TARGET_RANGE_MINUTES.max / 60}h`,
  };
  const edDelta = draftEdOver - savedEdOver;

  const findSetting = (
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
        <ul id="settings-find-results" className={styles.findResults} role="listbox" aria-label="Settings found">
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
  );

  const rulesContent = (
    <>
      <ScopeLine kind="save" />
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="timings-title" data-setting="surge">
            <CardHead
              iconPlain
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
              savedDisplay={`${saved.ed / 60}h`}
              display={`${rules.ed / 60}h`}
              noun="ED access target"
              range={edRange}
              onChange={(minutes) => setRule({ edAccessTargetMinutes: minutes })}
              onReset={() => setRule({ edAccessTargetMinutes: saved.ed })}
              effect={
                <>
                  <StatusGlyph tone={draftEdOver > 0 ? "warning" : "success"} size={9} />
                  {/* Audit settings-25: the count is read from the draft; a changed target says so. */}
                  {rules.ed !== saved.ed
                    ? draftEdOver > 0
                      ? `${draftEdOver} over if saved`
                      : "None over if saved"
                    : draftEdOver > 0
                      ? `${draftEdOver} over now`
                      : "None over now"}
                  {edDelta !== 0 ? <span className={styles.delta}>{`${edDelta > 0 ? "+" : ""}${edDelta}`}</span> : null}
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
              savedDisplay={wardsText(saved.cap)}
              display={wardsText(rules.cap)}
              noun="parallel referral enquiry limit"
              range={{
                id: "setting-parallel-cap",
                ...PARALLEL_REFERRAL_CAP_RANGE,
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
              savedDisplay={shortDuration(saved.hold)}
              display={shortDuration(rules.hold)}
              noun="pulled bed hold duration"
              range={{
                id: "setting-hold-duration",
                ...PULL_HOLD_RANGE_MINUTES,
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
              savedDisplay={clock24(saved.morning)}
              display={clock24(rules.morning)}
              displayTestId="morning-rollup-display"
              noun="morning rollup deadline"
              range={{
                id: "setting-morning-rollup-slider",
                ...MORNING_ROLLUP_TIME_RANGE_MINUTES,
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
                onChange={() => onPreview("Surge ends")}
              />
            </SettingRow>
          </Card>

          <Card aria-labelledby="warnings-title">
            <CardHead
              iconPlain
              id="warnings-title"
              icon={Gavel}
              title="Form warnings"
              meta="Your defaults, not legal limits"
            />
            <RuleRow
              setting="second-warning"
              testId="setting-due-soon-row"
              title="Early warning"
              sub="Shown as due soon"
              subTestId="setting-due-soon-desc"
              value={rules.soon}
              saved={saved.soon}
              savedDisplay={shortDuration(saved.soon)}
              display={shortDuration(rules.soon)}
              displayTestId="due-soon-display"
              noun="early warning before a legal due time"
              range={{
                id: "setting-due-soon",
                ...DUE_SOON_RANGE_MINUTES,
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
            <RuleRow
              setting="first-warning"
              testId="setting-due-soon-urgent-row"
              title="Final warning"
              sub="Before a legal due time"
              subTestId="setting-due-soon-urgent-desc"
              value={rules.urgent}
              saved={saved.urgent}
              savedDisplay={shortDuration(saved.urgent)}
              display={shortDuration(rules.urgent)}
              displayTestId="due-soon-urgent-display"
              noun="final warning before a legal due time"
              max={clampDueSoonUrgent(DUE_SOON_URGENT_RANGE_MINUTES.max, rules.soon)}
              range={{
                id: "setting-due-soon-urgent",
                ...DUE_SOON_URGENT_RANGE_MINUTES,
                minLabel: shortDuration(DUE_SOON_URGENT_RANGE_MINUTES.min),
                maxLabel: shortDuration(DUE_SOON_URGENT_RANGE_MINUTES.max),
              }}
              onChange={(minutes) => setRule({ dueSoonUrgentMinutes: clampDueSoonUrgent(minutes, rules.soon) })}
              onReset={() => setRule({ dueSoonUrgentMinutes: clampDueSoonUrgent(saved.urgent, rules.soon) })}
              usedBy="Home, every legal due time"
            />
            {/* The two warnings on one window, read from the draft: calm, early warning, final warning. */}
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
                <span style={{ flexGrow: Math.max(0, rules.soon - rules.urgent) }}>{shortDuration(rules.urgent)}</span>
                <span style={{ flexGrow: rules.urgent }}>Due</span>
              </div>
            </div>
          </Card>
        </div>

        <div className={styles.column}>
          <Card aria-labelledby="targets-title" data-setting="decision-targets">
            <CardHead
              iconPlain
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
                  savedDisplay={shortDuration(saved[ruleKey])}
                  display={shortDuration(rules[ruleKey])}
                  noun={`${step.label.toLowerCase()} target`}
                  range={{
                    id: `setting-target-${step.step}-range`,
                    ...DECISION_TARGET_RANGE_MINUTES,
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
              iconPlain
              id="more-title"
              icon={SlidersHorizontal}
              title="More thresholds"
              aside={<PreviewTag />}
            />
            <RuleRow
              setting="occupancy"
              title="Occupancy alert"
              sub="Bed alerts dot from"
              value={BED_ALERT_THRESHOLD_PERCENT}
              saved={BED_ALERT_THRESHOLD_PERCENT}
              display={`${BED_ALERT_THRESHOLD_PERCENT}%`}
              noun="occupancy alert"
              range={{
                min: 80,
                max: 95,
                step: 1,
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
                minLabel: "30m",
                maxLabel: "4h",
              }}
              onChange={() => onPreview("Ward not answering")}
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
              iconPlain
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
    </>
  );

  const alertsContent = (
    <>
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
        phonePush={phonePush}
        onPhonePushChange={(next) => {
          void setPhonePush(next).then((answer) => {
            showToast(
              answer === "on"
                ? "Phone alerts on for this device."
                : answer === "off"
                  ? "Phone alerts off for this device."
                  : answer === "denied"
                    ? "Notifications are blocked for this site in the browser."
                    : answer === "server-off"
                      ? "Phone alerts are not set up on the server yet."
                      : "Phone alerts could not be changed. Try again.",
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
    </>
  );

  const displayContent = (
    <>
      <DisplayPane
        theme={theme}
        onThemeChange={chooseTheme}
        railOpen={railOpen}
        onRailChange={(open) => {
          setRailOpenPreference(open);
          showToast(open ? "Sidebar set to Full." : "Sidebar set to Compact.");
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
        rowDensity={rowDensity}
        onRowDensityChange={chooseRowDensity}
        discreetNames={discreetNames}
        onDiscreetNamesChange={chooseDiscreetNames}
        onPreview={onPreview}
      />
    </>
  );

  const profileContent = (
    <>
      <ProfilePane onPreview={onPreview} onGoToDesk={() => setIsOperatorModalOpen(true)} />
    </>
  );

  const dataContent = (
    <>
      <DataPane
        reference={reference}
        onReferenceChange={setReference}
        movementCount={movements.length}
        eventCount={eventLog.length}
        thresholds={thresholds}
        onExport={handleExport}
        onCopyDiagnostics={handleCopyDiagnostics}
        onImport={handleImport}
        onClearSession={handleClearSession}
        onRestore={() => {
          // On a phone the Data sheet closes first, so the restore dialog is the only layer.
          setPhoneSheet(null);
          setIsResetModalOpen(true);
        }}
      />
    </>
  );

  const saveBar = hasUnsavedRules ? (
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
      <Button variant="ghost" size="sm" className={styles.pill} onClick={handleDiscard} data-testid="btn-discard-draft">
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
  ) : null;

  const overlays = (
    <>
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
    </>
  );

  const refusedLine = configurationRejection ? (
    <p className={styles.refused} role="alert" data-testid="ward-settings-configuration-refused">
      <StatusGlyph tone="danger" size={10} />
      <strong>Rule change refused.</strong> {configurationRejection.reason}
    </p>
  ) : null;

  /* Phone (v10): its own design, never a reflow of the desktop. A compact profile hero, Find a
     setting, the four settings people change on a phone, then the five areas as rows that open
     tall sheets. Rules keep the stepper; unsaved rules pin a save bar and the sheet has Save in
     its foot. */
  if (isPhone) {
    const areaSummary: Record<SettingsTab, string> = {
      rules: "Timings, form warnings, decision targets",
      alerts: `Browser ${actNowNotifications ? "on" : "off"} · buzz ${audioBuzz ? "on" : "off"}`,
      display: `Motion ${reducedMotion ? "reduced" : "on"} · contrast ${highContrast ? "high" : "standard"}`,
      profile: `${SETTINGS_DEMO_PROFILE.role} · ${SETTINGS_DEMO_PROFILE.location}`,
      data: "Export, restore, about this prototype",
    };
    const sheetTab = phoneSheet;
    const sheetContent: Record<SettingsTab, ReactNode> = {
      rules: rulesContent,
      alerts: alertsContent,
      display: displayContent,
      profile: profileContent,
      data: dataContent,
    };
    return (
      <div
        className={cx(styles.screen, styles.phoneScreen)}
        data-testid="ward-settings-screen"
        data-ward-design="v10-phone"
      >
        <main id="main-content" className={styles.phoneMain}>
          <PhoneHero
            level={1}
            data-testid="ward-settings-profile"
            title={
              <span className={styles.phoneWho}>
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
            eyebrow={SETTINGS_DEMO_PROFILE.location}
            chip={<span className={styles.phoneProfileChip}>Demo profile</span>}
            sub={SETTINGS_DEMO_PROFILE.role}
            // Device audit 11 Oct 2026: no figures on a phone; the name, role and Switch workstation
            // are what this hero is for. The save strip still appears when a rule is unsaved.
            actions={
              <Button
                variant="onHero"
                icon={Layers}
                className={styles.phoneGrow}
                onClick={() => setIsOperatorModalOpen(true)}
              >
                Go to a desk
              </Button>
            }
          />

          <div className={styles.phoneFind}>{findSetting}</div>
          {refusedLine}

          <section className={styles.phoneSection} aria-labelledby="settings-phone-quick">
            <h2 id="settings-phone-quick" className={styles.phoneHead}>
              On this phone
              <span className={styles.phoneHeadMeta}>Saves at once</span>
            </h2>
            <div className={styles.phoneCard}>
              <SettingRow setting="theme" title="Theme" stacked testId="ward-settings-phone-theme">
                <Segmented<ThemeChoice>
                  className={styles.phoneSeg}
                  size="md"
                  label="Theme"
                  items={[...THEME_CHOICES]}
                  value={theme}
                  onChange={chooseTheme}
                />
              </SettingRow>
              <SettingRow setting="density" title="Row density" stacked>
                <Segmented<RowDensity>
                  className={styles.phoneSeg}
                  size="md"
                  label="Row density"
                  items={[
                    { id: "comfortable", label: "Comfortable" },
                    { id: "compact", label: "Compact" },
                  ]}
                  value={rowDensity}
                  onChange={chooseRowDensity}
                />
              </SettingRow>
              <SettingRow setting="discreet-names" title="Discreet names on phone" sub="Initials and UMRN in lists">
                <Switch
                  checked={discreetNames}
                  onCheckedChange={chooseDiscreetNames}
                  label={<SrOnly>Discreet names on phone</SrOnly>}
                  className={styles.phoneSwitch}
                />
              </SettingRow>
              <SettingRow setting="buzz" title="Buzz sound" sub="Chime on an urgent buzz">
                <Switch
                  checked={audioBuzz}
                  onCheckedChange={(next) => {
                    setAudioBuzz(next);
                    setAudioBuzzPreference(next);
                    showToast(next ? "Buzz sound on." : "Buzz sound off.");
                  }}
                  label={<SrOnly>Buzz sound</SrOnly>}
                  className={styles.phoneSwitch}
                />
              </SettingRow>
            </div>
          </section>

          <section className={styles.phoneSection} aria-labelledby="settings-phone-all">
            <h2 id="settings-phone-all" className={styles.phoneHead}>
              All settings
            </h2>
            <ul className={styles.phoneList}>
              {SETTINGS_TABS.map((item) => {
                const Icon = TAB_ICONS[item.id];
                return (
                  <PhoneListRow
                    key={item.id}
                    as="li"
                    data-testid={`ward-settings-phone-area-${item.id}`}
                    leading={<Icon size={18} aria-hidden="true" className={styles.phoneAreaIcon} />}
                    name={item.label}
                    meta={areaSummary[item.id]}
                    value={
                      item.id === "rules" && hasUnsavedRules ? (
                        <CountCircle n={unsavedCount} label="unsaved" />
                      ) : (
                        <ChevronRight size={16} aria-hidden="true" className={styles.phoneChevron} />
                      )
                    }
                    onSelect={() => setPhoneSheet(item.id)}
                  />
                );
              })}
            </ul>
          </section>

          {hasUnsavedRules && sheetTab === null ? (
            <div
              className={styles.phoneSaveBar}
              role="region"
              aria-label="Unsaved rule changes"
              data-testid="unsaved-draft-inspector"
            >
              <span className={styles.phoneSaveText} title={diffs.join(", ")}>
                <StatusGlyph tone="info" size={9} />
                {diffs.join(", ")}
              </span>
              <Button variant="sec" onClick={handleDiscard} data-testid="btn-discard-draft">
                Discard
              </Button>
              <Button variant="pri" icon={Check} onClick={handleSave} data-testid="btn-save-draft">
                {unsavedCount === 1 ? "Save 1 change" : `Save ${unsavedCount} changes`}
              </Button>
            </div>
          ) : null}

          <PhoneSheet
            open={sheetTab !== null}
            onClose={() => setPhoneSheet(null)}
            height="tall"
            data-testid="ward-settings-phone-sheet"
            title={sheetTab ? tabLabel(sheetTab) : "Settings"}
            description={
              sheetTab === "rules"
                ? "Save to apply. Each save is recorded in the audit"
                : "Saves at once · this browser only"
            }
            primary={
              sheetTab === "rules" && hasUnsavedRules
                ? {
                    label: unsavedCount === 1 ? "Save 1 change" : `Save ${unsavedCount} changes`,
                    onAction: handleSave,
                  }
                : { label: "Done", onAction: () => setPhoneSheet(null) }
            }
            secondary={
              sheetTab === "rules" && hasUnsavedRules ? { label: "Discard", onAction: handleDiscard } : undefined
            }
          >
            {sheetTab ? <div className={styles.phoneSheetBody}>{sheetContent[sheetTab]}</div> : null}
          </PhoneSheet>

          {overlays}
        </main>
      </div>
    );
  }

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
          aside={
            <>
              {findSetting}
              <Button variant="onHero" size="sm" icon={Layers} onClick={() => setIsOperatorModalOpen(true)}>
                Go to a desk
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
            // Device audit 11 Oct 2026: the other chips repeated the tabs, the save strip and the
            // Buzz switch; Last save is the one fact only the hero gives.
            <HeroChips label="Settings at a glance">
              {/* Site review (12 Oct 2026): plain words when nothing has been saved yet. */}
              {lastAccepted?.at != null ? (
                <HeroChip value={formatInstantWithDay(lastAccepted.at, now)} label="Last save" />
              ) : (
                <HeroChip value="No" label="saves yet" />
              )}
            </HeroChips>
          }
        />

        {refusedLine}

        <div className={styles.pane} hidden={tab !== "rules"} data-pane="rules">
          {rulesContent}
        </div>

        <div className={styles.pane} hidden={tab !== "alerts"} data-pane="alerts">
          {alertsContent}
        </div>

        <div className={styles.pane} hidden={tab !== "display"} data-pane="display">
          {displayContent}
        </div>

        <div className={styles.pane} hidden={tab !== "profile"} data-pane="profile">
          {profileContent}
        </div>

        <div className={styles.pane} hidden={tab !== "data"} data-pane="data">
          {dataContent}
        </div>

        {saveBar}

        {overlays}
      </main>
    </div>
  );
}
