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
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronRight, Search } from "lucide-react";

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
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
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
  CountCircle,
  Hero,
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
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { ROLE_SCREENS, type WardAccessRole } from "@/components/ward-management/ward-role-access";
import { useConfigurationGate } from "@/components/ward-management/settings/settings-configuration-gate";
import { AccessSettings, showsAccessTab } from "./access-settings";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import {
  THEME_CHOICES,
  type ReferenceTab,
  type ThemeChoice,
} from "@/components/ward-management/settings/settings-panes";
import { useRowDensity, type RowDensity } from "@/components/ward-management/settings/row-density";
import { SettingRow } from "./settings-rows";
import { type SettingsSearchEntry } from "@/components/ward-management/settings/settings-search-index";
import { useSettingsDeskProfile } from "@/components/ward-management/settings/settings-desk-profile";
import { publishedThresholds } from "@/components/ward-management/settings/settings-thresholds";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-layout.module.css";
import { SettingsProfileCard } from "./settings-profile-card";
import { SettingsSaveBar } from "./settings-save-bar";
import {
  PHONE_QUICK_SETTINGS,
  copySettingsDiagnostics,
  isSurgePreset,
  ruleDiffs,
} from "@/components/ward-management/settings/settings-screen-model";
import { SettingsAlertsPane } from "./settings-alerts-check";
import { SettingsDisplayPane } from "./settings-display-pane";
import { SettingsDemoTools, SettingsHelpCard } from "./settings-help-and-demo";
import { RULES_FOR_DESK, SettingsRulesSummary } from "./settings-rules-summary";
import { SettingsReferenceCard } from "./settings-reference-card";
import { SettingsRestoreDialog, type RestoreScope } from "./settings-restore-dialog";
import { SettingsReviewDialog } from "./settings-review-dialog";
import { surgeConfiguration } from "./settings-rule-catalogue";
import { SettingsRulesPane } from "./settings-rules-pane";
import {
  SECTION_ICONS,
  SECTION_LABELS,
  findRedesignSettings,
  sectionForEntry,
  sectionFromHash,
  type SettingsSection,
} from "./settings-tabs";
import { SettingsWhoCan } from "./settings-who-can";
import {
  copyExecutiveSettingsDiagnostics,
  SettingsSourceHost,
  type SettingsSource,
} from "@/components/ward-management/settings/settings-operational-source";

/** Settings (owner-approved 8 Oct 2026; by login, Josh, 31 Oct 2026, "yes to all").
 * One page of sections, each shown only to the desks that use it, in the order that desk needs:
 * the statewide coordinator opens on the rule editor, the access admin on Access, every other desk on
 * This device. Desks the rules touch read a short "Rules that affect you". The coordinator and the
 * access admin have a closed Demo tools section (rules file, diagnostics, reset, reference tables,
 * feature switches). "Switch login (demo)" is hidden once real sign-in is on.
 * Operational desks edit drafts and audit each SET_CONFIGURATION; executive reports supply public
 * values, with individual record evidence explicitly unavailable. Save opens a review first, and a
 * loaded rules file lands in the same review. Never show controls nothing reads (D-72). Clock,
 * scenario and Reset belong in Tools (Q-7).
 */

export { copySettingsDiagnostics, maskDiagnosticMovement, maskDiagnosticPatient } from "./settings-screen-model";

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
  // Round 3: Save opens a review first; "file" when a loaded rules file put the draft there.
  const [review, setReview] = useState<"draft" | "file" | null>(null);
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
  // Settings by login (Josh, 31 Oct 2026, "yes to all"): one page of sections, each shown only to
  // the desks that use it. The statewide coordinator edits the rules; every other desk that the rules
  // touch reads a short "Rules that affect you"; the access admin opens on Access; only the
  // coordinator and the access admin have the closed Demo tools.
  const access = useEffectiveWardAccess();
  const role: WardAccessRole = source.kind === "executive" ? "executive" : access.role;
  const accessOn = useWardFeatureFlag("role-access") && showsAccessTab(access);
  const helpAskOn = useWardFeatureFlag("help-ask");
  const editsRules = role === "coordinator";
  const rulesSummary = !editsRules && (RULES_FOR_DESK[role]?.length ?? 0) > 0;
  const alertsHere = role !== "admin" && role !== "executive";
  const demoTools = role === "coordinator" || role === "admin";
  const governanceOpen = ROLE_SCREENS[role].governance !== undefined;
  const sections: SettingsSection[] =
    role === "admin"
      ? [...(accessOn ? (["access"] as const) : []), "you", "device", "help", "demo"]
      : [
          ...(editsRules ? (["rules"] as const) : []),
          "device",
          ...(rulesSummary ? (["rules"] as const) : []),
          ...(accessOn ? (["access"] as const) : []),
          "you",
          "help",
          ...(demoTools ? (["demo"] as const) : []),
        ];
  // On a phone the access admin's requests and roles sit open on the page, with no Access row.
  const accessInline = role === "admin";
  const [demoOpen, setDemoOpen] = useState(false);
  // Phone only: the section whose tall sheet is open. The desktop never reads it.
  const isPhone = useIsPhone();
  const [phoneSheet, setPhoneSheet] = useState<SettingsSection | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  // "Switch login (demo)" (Josh, 31 Oct 2026): the demo's desk switcher, hidden once real sign-in is on.
  const switchLogin = sharedEnabled
    ? undefined
    : () => {
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

  // Open the section named in the address (#device, or an old tab such as #alerts or #profile). On a
  // desktop it scrolls into view; on a phone its sheet opens; Demo tools opens its fold first.
  const showSection = (section: SettingsSection) => {
    if (!sections.includes(section)) return;
    if (section === "demo") setDemoOpen(true);
    if (isPhone) {
      setPhoneSheet(section);
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById(`settings-section-${section}`)?.scrollIntoView?.({ block: "start" });
    });
  };
  const openFromHash = useEffectEvent(() => {
    const fromHash = sectionFromHash();
    if (fromHash) showSection(fromHash);
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the hash is only readable after mount
    openFromHash();
    // A hash change while Settings is open (Help's Show me naming a section) opens it too.
    const onHashChange = () => openFromHash();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Keep document attributes in sync when Settings is mounted without the layout helper.
  useEffect(() => {
    if (reducedMotion) document.documentElement.setAttribute("data-reduced-motion", "true");
    else document.documentElement.removeAttribute("data-reduced-motion");
    if (highContrast) document.documentElement.setAttribute("data-high-contrast", "true");
    else document.documentElement.removeAttribute("data-high-contrast");
  }, [reducedMotion, highContrast]);

  const diffs = useMemo(() => ruleDiffs(draftBase, draft), [draftBase, draft]);
  const unsavedCount = diffs.length;
  const hasUnsavedRules = unsavedCount > 0;
  useDirtyStateGuard({ isDirty: hasUnsavedRules });
  const isSurge = isSurgePreset(draft);

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
      const surge = surgeConfiguration(draft);
      setRule({
        parallelReferralCap: surge.parallelReferralCap,
        edAccessTargetMinutes: surge.edAccessTargetMinutes,
        pullHoldMinutes: surge.pullHoldMinutes,
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
      setReview(null);
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
        // Round 3: the saved rules, never an unsaved draft, and no display settings (Load reads
        // rules only, so a file that also carried the theme promised something Load never did).
        configuration,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const day = perthCalendarDay(new Date());
      const date = `${day.year}-${String(day.monthIndex + 1).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
      downloadBlob(blob, `ward-flow-rules-${date}.json`);
      showToast("Saved rules downloaded.");
    } catch {
      showToast("The rules file could not be downloaded.");
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
          // Round 3: a file lands in the review, so it never changes a rule unseen.
          setDraft(imported);
          setPhoneSheet(null);
          setReview("file");
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

  const handleConfirmReset = (scope: RestoreScope) => {
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
      rowDensity,
      reducedMotion,
      highContrast,
      characterShortcuts,
    };
    const withBrowser = scope === "rules-and-browser";
    // Round 3: every browser setting the dialog lists comes back, not only theme, glare, sidebar and buzz.
    const restoreBrowser = () => {
      setAudioBuzz(true);
      setAudioBuzzPreference(true);
      applyAppearance("auto");
      applyGlare(false);
      setRailOpenPreference(true);
      setRowDensity("comfortable");
      setReducedMotion(false);
      setHighContrast(false);
      setCharacterShortcuts(true);
    };
    const putBrowserBack = () => {
      setAudioBuzz(before.buzz);
      setAudioBuzzPreference(before.buzz);
      applyAppearance(before.appearance);
      applyGlare(before.glare);
      setRailOpenPreference(before.railOpen);
      setRowDensity(before.rowDensity);
      setReducedMotion(before.reducedMotion);
      setHighContrast(before.highContrast);
      setCharacterShortcuts(before.characterShortcuts);
    };
    // A desk that cannot change the rules restores only its own browser.
    if (!configurationGate.allowed || !operational) {
      restoreBrowser();
      setIsResetModalOpen(false);
      toast?.push({
        tone: "success",
        title: "This browser's settings restored.",
        undo: { durationMs: UNDO_TOAST_MS, onUndo: () => void putBrowserBack() },
      });
      return;
    }
    const defaults = defaultWardConfiguration();
    saveConfiguration(defaults, before.configuration, true, (applied, outcome) => {
      if (withBrowser) restoreBrowser();
      setIsResetModalOpen(false);
      toast?.push({
        tone: "success",
        title: withBrowser ? "Rules and this browser restored. Recorded in the audit." : "Rules restored and recorded.",
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
              if (withBrowser) putBrowserBack();
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
  // "Switch login (demo)" is hidden once real sign-in is on, so Find does not offer it either.
  const results = findRedesignSettings(query, sections).filter(
    (entry) => entry.id !== "go-to-desk" || switchLogin !== undefined,
  );

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
    setQuery("");
    setFindOpen(false);
    if (entry.id === "go-to-desk" && switchLogin) {
      switchLogin();
      return;
    }
    const section = sectionForEntry(entry);
    if (section === "demo") setDemoOpen(true);
    // Fixed defaults and Clinical values sit behind the reference card's tabs; show them first.
    if (entry.id === "fixed-defaults") setReference("defaults");
    if (entry.id === "clinical-values") setReference("clinical");
    // Phone: the quick settings sit on the screen itself; every other one opens its section's sheet.
    if (isPhone)
      setPhoneSheet(PHONE_QUICK_SETTINGS.has(entry.id) || (accessInline && section === "access") ? null : section);
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
                <span className={styles.findTab}>{SECTION_LABELS[sectionForEntry(entry)]}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );

  // The rule editor is the coordinator's. A coordinator who is not the statewide one sees it read
  // only, with one line saying why, and no save bar. Every other desk reads "Rules that affect you".
  const readOnlyWords = configurationBlockReason ?? null;

  const rulesContent = editsRules ? (
    <SettingsRulesPane
      draft={draft}
      configuration={configuration}
      movements={operational?.movements ?? null}
      now={now}
      ruleChanges={ruleChanges}
      setRule={setRule}
      isSurge={isSurge}
      onSurge={handleSurge}
      blockReason={configurationBlockReason}
      readOnlyWords={readOnlyWords}
    />
  ) : (
    <SettingsRulesSummary role={role} configuration={configuration} />
  );

  const testBuzz = () => {
    playSyntheticUrgentChime();
    showToast("Test buzz played.");
  };

  const alertsContent = (phoneQuick: boolean) => (
    <SettingsAlertsPane
      phoneQuick={phoneQuick}
      notifications={actNowNotifications}
      permission={notificationPermission}
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
      onTestBuzz={testBuzz}
      showToast={showToast}
    />
  );

  const openRestore = () => {
    // On a phone the sheet closes first, so the restore dialog is the only layer.
    setPhoneSheet(null);
    setIsResetModalOpen(true);
  };
  const displayContent = (phoneQuick: boolean) => (
    <SettingsDisplayPane
      phoneQuick={phoneQuick}
      onRestore={openRestore}
      restoresRules={editsRules && configurationBlockReason === undefined}
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
  );

  // This device (Josh, 31 Oct 2026): Display and Alerts on one card row. The transport officer's
  // device is mostly for alerts, so its alerts come first; the access admin and the executive get no
  // alerts here, so only Display.
  const deviceContent = (phoneQuick: boolean) =>
    alertsHere ? (
      <div className={phoneQuick ? rx.accessStack : styles.columns}>
        {role === "officer" ? (
          <>
            <div className={rx.accessStack}>{alertsContent(phoneQuick)}</div>
            {displayContent(phoneQuick)}
          </>
        ) : (
          <>
            {displayContent(phoneQuick)}
            <div className={rx.accessStack}>{alertsContent(phoneQuick)}</div>
          </>
        )}
      </div>
    ) : (
      <div className={phoneQuick ? rx.accessStack : styles.columns}>{displayContent(phoneQuick)}</div>
    );

  const youContent = <SettingsProfileCard now={now} onSwitchLogin={switchLogin} />;

  const helpContent = (
    <>
      <SettingsHelpCard />
      {helpAskOn ? <WardHelpUsageCard /> : null}
    </>
  );

  const demoContent = demoTools ? (
    <SettingsDemoTools
      movementCount={operational?.movements.length ?? null}
      eventCount={operational?.eventLog?.length ?? (operational ? 0 : null)}
      shared={sharedEnabled}
      auditAvailable={ruleChanges !== null}
      governanceOpen={governanceOpen}
      onDownload={handleExport}
      onCopyDiagnostics={handleCopyDiagnostics}
      onLoad={handleImport}
      loadUnavailable={configurationBlockReason}
      onClearSession={handleClearSession}
      reference={
        <SettingsReferenceCard reference={reference} onReferenceChange={setReference} thresholds={thresholds} />
      }
      open={demoOpen}
      onOpenChange={setDemoOpen}
    />
  ) : null;

  // Round 3: the Access tab adds the read-only Who can change what table under today's panels.
  const accessContent = accessOn ? (
    // Final round: the wrapper keeps the pane's card gap, which a plain block dropped (the cards touched).
    <div data-setting="access" className={rx.accessStack}>
      <AccessSettings />
      <SettingsWhoCan />
    </div>
  ) : null;

  // The rule editor's save bar always shows, so where Save lives never moves. A desk that cannot
  // change the rules has no save bar, unless it lost that right with a draft open: then the bar stays,
  // Save greyed with the reason, so the draft can still be discarded.
  const saveBar =
    editsRules && (readOnlyWords === null || hasUnsavedRules) ? (
      <SettingsSaveBar
        diffs={diffs}
        onRulesTab
        onReview={() => showSection("rules")}
        lastSave={
          ruleChanges === null
            ? "Rule-save history unavailable"
            : lastAccepted?.at != null
              ? `Last save ${formatInstantWithDay(lastAccepted.at, now)}`
              : "No saves yet"
        }
        saving={saving}
        blockReason={configurationBlockReason}
        onDiscard={handleDiscard}
        onSave={() => setReview("draft")}
      />
    ) : null;

  const overlays = (
    <>
      <SettingsRestoreDialog
        open={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmReset}
        pending={saving}
        rulesUnavailable={configurationBlockReason}
      />
      <SettingsReviewDialog
        open={review !== null}
        onClose={() => setReview(null)}
        base={draftBase}
        draft={draft}
        movements={operational?.movements ?? null}
        now={now}
        fromFile={review === "file"}
        saving={saving}
        blockReason={configurationBlockReason}
        onSave={handleSave}
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
    const areaSummary: Record<SettingsSection, string> = {
      rules: editsRules
        ? readOnlyWords === null
          ? "ED and placement, form warnings, reply targets"
          : "Read only"
        : "Set by the bed coordinator",
      device: alertsHere
        ? `Alerts ${actNowNotifications ? "on" : "off"} · motion ${reducedMotion ? "reduced" : "on"}`
        : `Sidebar, motion ${reducedMotion ? "reduced" : "on"}, contrast ${highContrast ? "high" : "standard"}`,
      access: role === "admin" ? "Roles, approvals and requests" : "Cover for a second ward or ED",
      you: `${deskProfile.role} · ${deskProfile.location}`,
      help: "Help, the tour and shortcuts",
      demo: "Rules file, diagnostics, feature switches",
    };
    const sheetTab = phoneSheet;
    const sheetContent: Record<SettingsSection, ReactNode> = {
      rules: rulesContent,
      device: deviceContent(true),
      access: accessContent,
      you: youContent,
      help: helpContent,
      demo: demoContent,
    };
    const roleIsName = deskProfile.name === deskProfile.role;
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
            chip={sharedEnabled ? undefined : <span className={styles.phoneProfileChip}>Demo profile</span>}
            sub={roleIsName ? undefined : deskProfile.role}
          />

          <div className={styles.phoneFind}>{findSetting}</div>
          {refusedLine}
          {accessInline ? (
            <section className={styles.phoneSection} aria-label="Access">
              {accessContent}
            </section>
          ) : null}

          <section className={styles.phoneSection} aria-labelledby="settings-phone-quick">
            <h2 id="settings-phone-quick" className={styles.phoneHead}>
              On this phone
              <span className={styles.phoneHeadMeta}>Saves at once</span>
            </h2>
            <div className={styles.phoneCard}>
              <SettingRow setting="theme" title="Theme" stacked testId="ward-settings-phone-theme">
                <Segmented<ThemeChoice>
                  className={rx.phoneSeg}
                  size="md"
                  label="Theme"
                  items={[...THEME_CHOICES]}
                  value={theme}
                  onChange={chooseTheme}
                />
              </SettingRow>
              <SettingRow setting="density" title="Row density" stacked>
                <Segmented<RowDensity>
                  className={rx.phoneSeg}
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
              {alertsHere ? (
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
              ) : null}
            </div>
          </section>

          <section className={styles.phoneSection} aria-labelledby="settings-phone-all">
            <h2 id="settings-phone-all" className={styles.phoneHead}>
              All settings
            </h2>
            <ul className={styles.phoneList}>
              {sections.flatMap((section) => {
                const Icon = SECTION_ICONS[section];
                if (accessInline && section === "access") return [];
                return (
                  <PhoneListRow
                    key={section}
                    as="li"
                    data-testid={`ward-settings-phone-area-${section}`}
                    leading={<Icon size={18} aria-hidden="true" className={styles.phoneAreaIcon} />}
                    name={editsRules || section !== "rules" ? SECTION_LABELS[section] : "Rules that affect you"}
                    meta={areaSummary[section]}
                    value={
                      section === "rules" && hasUnsavedRules ? (
                        <CountCircle n={unsavedCount} label="unsaved" />
                      ) : (
                        <ChevronRight size={16} aria-hidden="true" className={styles.phoneChevron} />
                      )
                    }
                    onSelect={() => {
                      if (section === "demo") setDemoOpen(true);
                      setPhoneSheet(section);
                    }}
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
              <span className={cx(styles.phoneSaveText, rx.wrapText)}>
                <StatusGlyph tone="info" size={9} />
                {diffs.join(", ")}
              </span>
              <Button variant="sec" onClick={handleDiscard} disabled={saving} data-testid="btn-discard-draft">
                Discard
              </Button>
              <Button
                variant="pri"
                icon={Check}
                onClick={() => setReview("draft")}
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
            title={sheetTab ? SECTION_LABELS[sheetTab] : "Settings"}
            description={
              // Round 3: a desk that cannot save is never told "Save to apply".
              sheetTab === "rules"
                ? !editsRules
                  ? "Read only · set by the bed coordinator"
                  : readOnlyWords !== null
                    ? `Read only · ${readOnlyWords}`
                    : "Changes wait for Save. Each save is recorded in the audit"
                : sheetTab === "access"
                  ? "Each change asks for your password again"
                  : sheetTab === "device"
                    ? "Saves at once · this browser only"
                    : undefined
            }
            primary={
              sheetTab === "rules" && hasUnsavedRules
                ? {
                    label: saving ? "Saving…" : unsavedCount === 1 ? "Save 1 change" : `Save ${unsavedCount} changes`,
                    disabledReason: configurationBlockReason ?? (saving ? "Saving the rule change." : undefined),
                    onAction: () => setReview("draft"),
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

  const sectionContent: Record<SettingsSection, ReactNode> = {
    rules: rulesContent,
    device: deviceContent(false),
    access: accessContent,
    you: youContent,
    help: helpContent,
    demo: demoContent,
  };

  return (
    <div className={styles.screen} data-testid="ward-settings-screen" data-ward-design="workspaces">
      <main id="main-content" className={styles.main}>
        <h1 className={styles.srOnly}>Settings</h1>

        <Hero
          className={styles.band}
          testId="ward-settings-profile"
          // A desk named by its role says the role once, in the title.
          eyebrow={
            deskProfile.name === deskProfile.role
              ? deskProfile.location
              : `${deskProfile.role} · ${deskProfile.location}`
          }
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
            sharedEnabled ? undefined : (
              <Badge variant="onHero" size="sm">
                Demo profile
              </Badge>
            )
          }
          aside={findSetting}
          bar={
            // Settings by login: one page of sections; these jump to each, in this desk's order.
            <nav className={rx.sectionNav} aria-label="Settings sections">
              {sections.map((section) => {
                const Icon = SECTION_ICONS[section];
                return (
                  <Button
                    key={section}
                    variant="onHero"
                    icon={Icon}
                    onClick={() => showSection(section)}
                    data-testid={`ward-settings-jump-${section}`}
                  >
                    {editsRules || section !== "rules" ? SECTION_LABELS[section] : "Rules that affect you"}
                    {section === "rules" && hasUnsavedRules ? <CountCircle n={unsavedCount} label="unsaved" /> : null}
                  </Button>
                );
              })}
            </nav>
          }
        />

        {refusedLine}

        <div className={rx.sections}>
          {sections.map((section) => (
            <section
              key={section}
              id={`settings-section-${section}`}
              className={rx.section}
              aria-label={editsRules || section !== "rules" ? SECTION_LABELS[section] : "Rules that affect you"}
              data-pane={section}
            >
              {sectionContent[section]}
            </section>
          ))}
        </div>

        {saveBar}

        {overlays}
      </main>
    </div>
  );
}
