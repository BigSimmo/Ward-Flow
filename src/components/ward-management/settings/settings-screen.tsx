"use client";

import dynamic from "next/dynamic";
import {
  areCharacterShortcutsEnabled,
  useCharacterShortcutsPreference,
} from "@/components/ward-management/shell/ward-character-shortcuts";
import { perthCalendarDay } from "@/components/ward-management/ward-clock";
import { downloadBlob } from "@/components/ward-management/ward-download";

import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
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
  KeyRound,
  Layers,
  Palette,
  Search,
  UserRound,
} from "lucide-react";

import { useWardAccessibilityPreference } from "@/components/ward-management/shell/ward-accessibility";
import {
  applyAppearance,
  applyGlare,
  useAppearanceStore,
  useGlareStore,
} from "@/components/ward-management/shell/ward-bar";
import { setRailOpenPreference, useRailOpenStore } from "@/components/ward-management/shell/ward-rail-preferences";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  playSyntheticUrgentChime,
  setAudioBuzzPreference,
  useAudioBuzzPreference,
} from "@/components/ward-management/shell/ward-sound-store";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import {
  defaultWardConfiguration,
  mergeConfiguration,
  validateConfiguration,
  type WardConfiguration,
} from "@/components/ward-management/ward-configuration";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { clearReferralDraftSession } from "@/components/ward-management/referrals/referral-draft-lifecycle";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import {
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_RANGE_MINUTES,
  PARALLEL_REFERRAL_CAP_RANGE,
  PULL_HOLD_RANGE_MINUTES,
} from "@/components/ward-management/ward-model";
import {
  DUE_SOON_RANGE_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
  UNDO_TOAST_MS,
} from "@/components/ward-management/ward-operational-defaults";
import {
  enableActNowNotifications,
  notificationSupport,
  setActNowNotificationPreference,
  useActNowNotificationPreference,
  type NotificationSupport,
} from "@/components/ward-management/shell/ward-act-now-notifications";
import { usePhonePush } from "@/components/ward-management/shell/ward-phone-push-switch";
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
  cx,
  useIsPhone,
  useOptionalToast,
  type ToastInput,
} from "@/components/wf";

import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";

// Help usage counts carry the how-to list, so they load only when the Ask help preview is on.
const WardHelpUsageCard = dynamic(() =>
  import("@/components/ward-management/help/ward-help-usage-card").then((m) => m.WardHelpUsageCard),
);
import { useWardAccessSnapshot } from "@/components/ward-management/shell/ward-access-store";
import { useConfigurationGate } from "./settings-configuration-gate";
import { AccessSettings, showsAccessTab } from "./access-settings";
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
import { useRowDensity, type RowDensity } from "./row-density";
import { RuleRow, ScopeLine, SettingRow } from "./settings-rows";
import { SETTINGS_TABS, findSettings, type SettingsSearchEntry, type SettingsTab } from "./settings-search-index";
import { useSettingsDeskProfile } from "./settings-desk-profile";
import { publishedThresholds } from "./settings-thresholds";

import styles from "./settings.module.css";
import {
  PHONE_QUICK_SETTINGS,
  clampDueSoonUrgent,
  clock24,
  copySettingsDiagnostics,
  fullRules,
  isSurgePreset,
  readTabFromHash,
  ruleDiffs,
  shortDuration,
  wardsText,
} from "./settings-screen-model";
import { SettingsTargetsColumn } from "./settings-targets-column";
import {
  copyExecutiveSettingsDiagnostics,
  SettingsSourceHost,
  type SettingsSource,
} from "./settings-operational-source";

// Moved to `settings-screen-model.ts`; re-exported so existing importers keep working.
export { copySettingsDiagnostics, maskDiagnosticMovement, maskDiagnosticPatient } from "./settings-screen-model";

/** Settings workspaces (owner-approved 8 Oct 2026): tabs, Find a setting and one rule save bar.
 * Operational desks edit drafts and audit each SET_CONFIGURATION; executive reports supply
 * twelve public values, with individual record evidence explicitly unavailable.
 * Browser preferences, profile, rules export, diagnostics and own-session clearing stay wired.
 * Never show controls nothing reads (D-72). Clock, scenario and Reset belong in Tools (Q-7).
 */

const TAB_ICONS = {
  rules: Clock,
  alerts: Bell,
  display: Palette,
  profile: UserRound,
  data: Database,
  access: KeyRound,
} as const;

export function SettingsScreen() {
  return <SettingsSourceHost>{(source) => <SettingsWorkspace source={source} />}</SettingsSourceHost>;
}

function SettingsWorkspace({ source }: { source: SettingsSource }) {
  const appearance = useAppearanceStore();
  const glare = useGlareStore();
  const railOpen = useRailOpenStore();
  const { configuration, now } = source;
  const operational = source.kind === "operational" ? source : null;
  const sharedEnabled = source.kind === "executive" ? source.authenticated : !!source.shared?.enabled;
  const configurationGate = useConfigurationGate(source.kind === "executive");
  const configurationBlockReason = configurationGate.allowed
    ? undefined
    : (configurationGate.reason ?? "Coordination rules can only be changed by a coordinator.");
  const thresholds = operational ? publishedThresholds(operational.movements, now, configuration) : null;

  /**
   * The six rules are edited as a local DRAFT of `state.configuration`, never applied directly.
   * Steppers, sliders, Surge and Import only ever call `setDraft`; the provider's value, and
   * everything that reads it, stays put until Save dispatches `SET_CONFIGURATION`.
   */
  const [draft, setDraft] = useState<WardConfiguration>(configuration);
  const [draftBase, setDraftBase] = useState<WardConfiguration>(configuration);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [configurationFailure, setConfigurationFailure] = useState<string | null>(null);
  const latestConfiguration = useRef(configuration);
  useEffect(() => {
    latestConfiguration.current = configuration;
  }, [configuration]);
  // A clean form follows incoming settings. Dirty forms keep their original baseline so the
  // engine can merge unrelated edits and refuse an actual conflict rather than overwrite it.
  useEffect(() => {
    if (ruleDiffs(draftBase, draft).length === 0 && configuration !== draftBase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external workspace settings changed
      setDraft(configuration);
      setDraftBase(configuration);
    }
  }, [configuration, draft, draftBase]);
  const [chosenTab, setTab] = useState<SettingsTab | null>(null);
  // The Access tab is for the desks that give access or cover, with the role-access flag on. An
  // Access admin desk opens on it, because giving roles is all that desk does.
  const { desk } = useWardAccessSnapshot();
  const accessOn = useWardFeatureFlag("role-access") && showsAccessTab(desk);
  const helpAskOn = useWardFeatureFlag("help-ask");
  const tabs = accessOn ? SETTINGS_TABS : SETTINGS_TABS.filter((item) => item.id !== "access");
  const tab: SettingsTab =
    chosenTab === null
      ? accessOn && desk.role === "admin"
        ? "access"
        : "rules"
      : !accessOn && chosenTab === "access"
        ? "rules"
        : chosenTab;
  // Phone only: the area whose tall sheet is open. The desktop never reads it.
  const isPhone = useIsPhone();
  const [phoneSheet, setPhoneSheet] = useState<SettingsTab | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const goToDesk = () => {
    if (source.kind === "executive") source.switchRole?.();
    else setIsOperatorModalOpen(true);
  };
  const [reducedMotion, setReducedMotion] = useWardAccessibilityPreference("reduced-motion");
  const [highContrast, setHighContrast] = useWardAccessibilityPreference("high-contrast");
  const [rowDensity, setRowDensity] = useRowDensity();
  const [characterShortcuts, setCharacterShortcuts] = useCharacterShortcutsPreference();
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
  const chooseRowDensity = useCallback(
    (next: RowDensity) => {
      setRowDensity(next);
      showToast(`Row density set to ${next === "compact" ? "Compact" : "Comfortable"}.`);
    },
    [setRowDensity, showToast],
  );

  // Open the tab named in the address (#alerts), and keep the address in step.
  useEffect(() => {
    const fromHash = readTabFromHash();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the hash is only readable after mount
    if (fromHash) setTab(fromHash);
  }, []);
  // A hash change while Settings is open (Help's Show me naming a tab) opens that tab too.
  useEffect(() => {
    const openFromHash = () => {
      const fromHash = readTabFromHash();
      if (fromHash) setTab(fromHash);
    };
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
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

  const saved = fullRules(configuration);
  const rules = fullRules(draft);
  const diffs = useMemo(() => ruleDiffs(draftBase, draft), [draftBase, draft]);
  const unsavedCount = diffs.length;
  const hasUnsavedRules = unsavedCount > 0;
  useDirtyStateGuard({ isDirty: hasUnsavedRules });
  const isSurge = isSurgePreset(draft);

  // The ED row's effect: who waits past the target now, at the draft value and at the saved one.
  const savedEdOver = thresholds?.find((threshold) => threshold.id === "ed-access-target")?.reached ?? null;
  const draftEdOver = operational
    ? (publishedThresholds(operational.movements, now, draft).find((threshold) => threshold.id === "ed-access-target")
        ?.reached ?? 0)
    : null;

  // Recent rule saves, newest first, from the audit trail every save writes to.
  const ruleChanges = operational?.ruleChanges ?? null;
  const lastAccepted = ruleChanges?.find((change) => change.outcome === "accepted" && change.at !== null);

  const setRule = (patch: Partial<WardConfiguration>) => {
    if (configurationGate.allowed && !savingRef.current) setDraft((current) => ({ ...current, ...patch }));
  };

  const handleSurge = (choice: "standard" | "surge") => {
    if (!configurationGate.allowed || !operational) {
      showToast(configurationBlockReason!, "warning");
      return;
    }
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

  /** Complete only this command: another desk's incoming save cannot confirm ours. */
  const saveConfiguration = (
    requested: WardConfiguration,
    base: WardConfiguration,
    // Restore defaults replaces every rule, so another desk's newer change is refused, not kept.
    replaceAll: boolean,
    onAccepted: (applied: WardConfiguration, outcome: WardCommandOutcome) => void,
  ) => {
    if (!configurationGate.allowed || !operational) {
      setConfigurationFailure(configurationBlockReason!);
      showToast(configurationBlockReason!, "warning");
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setConfigurationFailure(null);
    const finish = (outcome: void | WardCommandOutcome) => {
      savingRef.current = false;
      setSaving(false);
      if (outcome?.status !== "accepted" || outcome.isCurrent?.() === false) {
        const message = outcome?.message ?? "The rule change was not confirmed. Your draft is still available.";
        setConfigurationFailure(message);
        showToast(message, "warning");
        return;
      }
      const merged = mergeConfiguration(latestConfiguration.current, requested, base, replaceAll);
      const applied = merged.status === "merged" ? merged.configuration : requested;
      setDraft(applied);
      setDraftBase(applied);
      onAccepted(applied, outcome);
    };
    try {
      const completion = operational.raise("SET_CONFIGURATION", {
        payload: requested,
        baseConfiguration: base,
        replaceAll,
      });
      if (completion && typeof (completion as Promise<WardCommandOutcome>).then === "function") {
        void (completion as Promise<WardCommandOutcome>).then(finish, () => finish(undefined));
      } else finish(completion as void | WardCommandOutcome);
    } catch {
      finish(undefined);
    }
  };

  const handleSave = () => {
    if (!hasUnsavedRules) return;
    const before = draftBase;
    const requested = draft;
    saveConfiguration(requested, before, false, (applied, outcome) => {
      setPhoneSheet(null);
      const changed = ruleDiffs(before, requested);
      toast?.push({
        tone: "success",
        title: `${changed.join(", ")}, saved and recorded.`,
        undo: {
          durationMs: UNDO_TOAST_MS,
          onUndo: () => {
            if (savingRef.current) {
              showToast("Wait for the current rule change before undoing.", "warning");
              return false;
            }
            if (outcome.isCurrent?.() === false) {
              showToast("The workspace changed. This rule change can no longer be undone.", "warning");
              return undefined;
            }
            const inverse = mergeConfiguration(applied, before, requested);
            if (inverse.status !== "merged") {
              showToast("The saved rules changed. Review the current settings before undoing.", "warning");
              return undefined;
            }
            saveConfiguration(inverse.configuration, applied, false, () =>
              showToast("Rules back as they were. Recorded in the audit."),
            );

            return undefined;
          },
        },
      });
    });
  };

  const handleDiscard = () => {
    if (savingRef.current) return;
    const kept = draft;
    const keptBase = draftBase;
    setDraft({ ...configuration });
    setDraftBase(configuration);
    setConfigurationFailure(null);
    toast?.push({
      tone: "info",
      title: "Draft discarded.",
      undo: {
        durationMs: UNDO_TOAST_MS,
        onUndo: () => {
          if (savingRef.current) return false;
          setDraft(kept);
          setDraftBase(keptBase);

          return undefined;
        },
      },
    });
  };

  const handleExport = () => {
    try {
      const payload = {
        product: "Ward Flow Statewide Bed Coordination",
        version: 6,
        exportedAt: new Date().toISOString(),
        // Bug list row 2: the saved rules only, the one thing Import reads back (no draft, theme or sidebar).
        configuration,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const day = perthCalendarDay(new Date());
      const date = `${day.year}-${String(day.monthIndex + 1).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
      downloadBlob(blob, `ward-flow-rules-${date}.json`);
      showToast("Rules exported.");
    } catch {
      showToast("Rules could not be exported.");
    }
  };

  const handleCopyDiagnostics = async () => {
    try {
      if (operational) {
        await copySettingsDiagnostics({
          configuration,
          movements: operational.movements,
          patients: operational.patients,
        });
      } else {
        await copyExecutiveSettingsDiagnostics(configuration);
      }
      showToast(
        operational
          ? "Diagnostics copied to clipboard (records masked)."
          : "Diagnostics copied to clipboard (aggregate only).",
      );
    } catch {
      showToast("Diagnostics could not be copied.");
    }
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    // H-0351: clear the picker straight away, so choosing the same file again always fires a change.
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!configurationGate.allowed) {
      showToast(configurationBlockReason!, "warning");
      return;
    }
    if (savingRef.current || !file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("Configuration file exceeds 10 MB limit.");
      return;
    }
    const reader = new FileReader();

    reader.onload = (loaded) => {
      if (savingRef.current) return;
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
    };
    reader.onerror = () => showToast("This rules file could not be read. Select it again.");
    reader.readAsText(file);
  };

  const handleClearSession = () => {
    // Fence old form owners before clearing storage, including callbacks from mounted sheets.
    clearReferralDraftSession();
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && (key.startsWith("wf-draft:") || key.startsWith("ward-flow-") || key.startsWith("ward_flow_"))) {
          keys.push(key);
        }
      }
      keys.forEach((key) => window.sessionStorage.removeItem(key));
      // A2-7: the provider re-saves the day it shows after each change, so the local demo resets too.
      if (operational && !sharedEnabled) operational.resetDemoState();
      showToast(
        `Session data for this tab cleared.${operational && !sharedEnabled ? " The demonstration has restarted." : ""}`,
      );
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
      draftBase,
      buzz: audioBuzz,
      appearance,
      glare,
      railOpen,
    };
    const defaults = defaultWardConfiguration();
    saveConfiguration(defaults, before.configuration, true, (applied, outcome) => {
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
            if (savingRef.current) {
              showToast("Wait for the current rule change before undoing.", "warning");
              return false;
            }
            if (outcome.isCurrent?.() === false) {
              showToast("The workspace changed. This restore can no longer be undone.", "warning");
              return undefined;
            }
            const inverse = mergeConfiguration(applied, before.configuration, defaults);
            if (inverse.status !== "merged") {
              showToast("The saved rules changed. Review the current settings before undoing.", "warning");
              return undefined;
            }
            saveConfiguration(inverse.configuration, applied, false, () => {
              setDraft({ ...before.draft });
              setDraftBase(before.draftBase);
              setAudioBuzz(before.buzz);
              setAudioBuzzPreference(before.buzz);
              applyAppearance(before.appearance);
              applyGlare(before.glare);
              setRailOpenPreference(before.railOpen);
              showToast("Settings back as they were. Recorded in the audit.");
            });

            return undefined;
          },
        },
      });
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
      if (areCharacterShortcutsEnabled() && event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
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
      goToDesk();
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
  const edDelta = draftEdOver !== null && savedEdOver !== null ? draftEdOver - savedEdOver : null;

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
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- combobox option: the input handles the keys through aria-activedescendant
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
      {source.kind === "executive" ? (
        <p className={styles.scopeLine}>
          <span className={styles.scopeTag}>Read only</span>
          <span>Public rules for executive reporting.</span>
        </p>
      ) : configurationBlockReason ? (
        // Bug list row 4: the reason follows on its own line, so no "Save to apply" for a desk that cannot save.
        <p className={styles.scopeLine}>
          <span className={styles.scopeTag}>Read only</span>
          <span>Rules change what every screen shows.</span>
        </p>
      ) : (
        <ScopeLine kind="save" />
      )}
      {configurationBlockReason ? <p role="status">{configurationBlockReason}</p> : null}
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
                  unavailable={!configurationGate.allowed}
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
              unavailableReason={configurationBlockReason}
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
                draftEdOver === null ? (
                  "Individual record status unavailable for executive reporting."
                ) : (
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
                    {edDelta !== null && edDelta !== 0 ? (
                      <span className={styles.delta}>{`${edDelta > 0 ? "+" : ""}${edDelta}`}</span>
                    ) : null}
                  </>
                )
              }
              usedBy="Home, ED, Movements"
            />
            <RuleRow
              unavailableReason={configurationBlockReason}
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
              unavailableReason={configurationBlockReason}
              setting="pull-hold"
              title="Pull time limit"
              sub="How long a pulled bed is kept"
              value={rules.hold}
              saved={saved.hold}
              savedDisplay={shortDuration(saved.hold)}
              display={shortDuration(rules.hold)}
              noun="pull time limit"
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
              unavailableReason={configurationBlockReason}
              setting="morning-count"
              testId="setting-morning-rollup-row"
              title="Morning bed numbers due"
              sub="Not a legal limit"
              subTestId="setting-morning-rollup-desc"
              value={rules.morning}
              saved={saved.morning}
              savedDisplay={clock24(saved.morning)}
              display={clock24(rules.morning)}
              displayTestId="morning-rollup-display"
              noun="morning bed numbers due time"
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
              unavailableReason={configurationBlockReason}
              setting="early-warning"
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
              unavailableReason={configurationBlockReason}
              setting="final-warning"
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

        <SettingsTargetsColumn
          rules={rules}
          saved={saved}
          setRule={setRule}
          ruleChanges={ruleChanges}
          now={now}
          unavailableReason={configurationBlockReason}
        />
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
                      : answer === "role"
                        ? "Phone alerts are not part of your role."
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
        characterShortcuts={characterShortcuts}
        onCharacterShortcutsChange={setCharacterShortcuts}
      />
    </>
  );

  const profileContent = (
    <>
      <ProfilePane onGoToDesk={goToDesk} />
    </>
  );

  const dataContent = (
    <>
      <DataPane
        shared={sharedEnabled}
        reference={reference}
        onReferenceChange={setReference}
        movementCount={operational?.movements.length ?? null}
        eventCount={operational?.eventLog?.length ?? (operational ? 0 : null)}
        thresholds={thresholds}
        onExport={handleExport}
        onCopyDiagnostics={handleCopyDiagnostics}
        onImport={handleImport}
        onClearSession={handleClearSession}
        restoreUnavailable={configurationBlockReason}
        importUnavailable={configurationBlockReason}
        onRestore={() => {
          if (!configurationGate.allowed) return;
          // On a phone the Data sheet closes first, so the restore dialog is the only layer.
          setPhoneSheet(null);
          setIsResetModalOpen(true);
        }}
      />
      {helpAskOn ? <WardHelpUsageCard /> : null}
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
      <Button
        variant="ghost"
        size="sm"
        className={styles.pill}
        onClick={handleDiscard}
        disabled={saving}
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
        disabledReason={configurationBlockReason ?? (saving ? "Saving the rule change." : undefined)}
        data-testid="btn-save-draft"
      >
        {saving ? "Saving…" : unsavedCount === 1 ? "Save 1 change" : `Save ${unsavedCount} changes`}
      </Button>
    </div>
  ) : null;

  const overlays = (
    <>
      <ResetBaselineModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmReset}
        pending={saving}
      />
      {isOperatorModalOpen ? (
        <OperatorSwitcherModal isOpen={isOperatorModalOpen} onClose={() => setIsOperatorModalOpen(false)} />
      ) : null}
      <WardPrototypeFooter
        testId="ward-settings-governance"
        note={
          sharedEnabled
            ? "Synthetic records · Not approved for clinical use · Coordination rules are saved to the shared workspace. Appearance preferences apply to this browser."
            : "Synthetic records · Not approved for clinical use · Coordination rules stay in this device's demo workspace. Appearance preferences apply to this browser."
        }
      />
    </>
  );

  const refusedLine = configurationFailure ? (
    <p className={styles.refused} role="alert" data-testid="ward-settings-configuration-refused">
      <StatusGlyph tone="danger" size={10} />
      <strong>Rule change not saved.</strong> {configurationFailure}
    </p>
  ) : null;
  // #788: the band names the desk in use, not the coordinator demo profile, on every role.
  const deskProfile = useSettingsDeskProfile();

  /* Phone (v10): its own design, never a reflow of the desktop. A compact profile hero, Find a
     setting, the four settings people change on a phone, then the five areas as rows that open
     tall sheets. Rules keep the stepper; unsaved rules pin a save bar and the sheet has Save in
     its foot. */
  if (isPhone) {
    const areaSummary: Record<SettingsTab, string> = {
      rules: "Timings, form warnings, decision targets",
      alerts: `Browser ${actNowNotifications ? "on" : "off"} · buzz ${audioBuzz ? "on" : "off"}`,
      display: `Motion ${reducedMotion ? "reduced" : "on"} · contrast ${highContrast ? "high" : "standard"}`,
      profile: `${deskProfile.role} · ${deskProfile.location}`,
      data: "Export, restore, about this prototype",
      access: desk.role === "admin" ? "Roles, approvals and requests" : "Cover for a second ward or ED",
    };
    const sheetTab = phoneSheet;
    const sheetContent: Record<SettingsTab, ReactNode> = {
      rules: rulesContent,
      alerts: alertsContent,
      display: displayContent,
      profile: profileContent,
      data: dataContent,
      access: accessOn ? <AccessSettings /> : null,
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
                  name={deskProfile.name}
                  initials={deskProfile.initials}
                  online
                  decorative
                  className={styles.avatar}
                />
                {deskProfile.name}
              </span>
            }
            eyebrow={deskProfile.location}
            chip={<span className={styles.phoneProfileChip}>Demo profile</span>}
            sub={deskProfile.role}
            // Device audit 11 Oct 2026: no figures on a phone; the name, role and Switch workstation
            // are what this hero is for. The save strip still appears when a rule is unsaved.
            actions={
              <Button variant="onHero" icon={Layers} className={styles.phoneGrow} onClick={goToDesk}>
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
              {tabs.map((item) => {
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
              <Button variant="sec" onClick={handleDiscard} disabled={saving} data-testid="btn-discard-draft">
                Discard
              </Button>
              <Button
                variant="pri"
                icon={Check}
                onClick={handleSave}
                disabledReason={configurationBlockReason ?? (saving ? "Saving the rule change." : undefined)}
                data-testid="btn-save-draft"
              >
                {saving ? "Saving…" : unsavedCount === 1 ? "Save 1 change" : `Save ${unsavedCount} changes`}
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
                ? source.kind === "executive"
                  ? "Read only · Coordinator only"
                  : configurationBlockReason
                    ? `Read only · ${configurationBlockReason}`
                    : "Save to apply. Each save is recorded in the audit"
                : "Saves at once · this browser only"
            }
            primary={
              sheetTab === "rules" && hasUnsavedRules
                ? {
                    label: saving ? "Saving…" : unsavedCount === 1 ? "Save 1 change" : `Save ${unsavedCount} changes`,
                    disabledReason: configurationBlockReason ?? (saving ? "Saving the rule change." : undefined),
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
          eyebrow={`${deskProfile.role} · ${deskProfile.location}`}
          title={
            <span className={styles.who}>
              <Avatar
                name={deskProfile.name}
                initials={deskProfile.initials}
                online
                decorative
                className={styles.avatar}
              />
              {deskProfile.name}
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
              <Button variant="onHero" size="sm" icon={Layers} onClick={goToDesk}>
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
              items={tabs.map((item) => {
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
              {ruleChanges === null ? (
                <HeroChip value="Rule-save history" label="unavailable" />
              ) : lastAccepted?.at != null ? (
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

        {/* Mounted only while open, so its server reads wait until the tab is chosen (review on PR #363). */}
        {accessOn && tab === "access" ? (
          <div className={styles.pane} data-pane="access">
            <AccessSettings />
          </div>
        ) : null}

        {saveBar}

        {overlays}
      </main>
    </div>
  );
}
