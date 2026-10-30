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
import { Check, ChevronRight, Layers, Search, UserRound } from "lucide-react";

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
import { useConfigurationGate } from "@/components/ward-management/settings/settings-configuration-gate";
import { showsAccessTab } from "@/components/ward-management/settings/access-settings";
// Round 3: every desk's Access tab draws the access admin's round 2 copy (shorter role rows, chips
// only for exceptions); it serves the coordinator and ward desks unchanged otherwise.
import { AccessSettings } from "@/components/ward-redesign/as-admin-home/access-settings";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import {
  THEME_CHOICES,
  type ReferenceTab,
  type ThemeChoice,
} from "@/components/ward-management/settings/settings-panes";
import { useRowDensity, type RowDensity } from "@/components/ward-management/settings/row-density";
import { SettingRow } from "./settings-rows";
import {
  type SettingsSearchEntry,
  type SettingsTab,
} from "@/components/ward-management/settings/settings-search-index";
import { useSettingsDeskProfile } from "@/components/ward-management/settings/settings-desk-profile";
import { publishedThresholds } from "@/components/ward-management/settings/settings-thresholds";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-redesign.module.css";
import { SettingsProfileCard } from "./settings-profile-card";
import { SettingsSaveBar } from "./settings-save-bar";
import {
  PHONE_QUICK_SETTINGS,
  copySettingsDiagnostics,
  isSurgePreset,
  readTabFromHash,
  ruleDiffs,
} from "@/components/ward-management/settings/settings-screen-model";
import { SettingsAlertsPane } from "./settings-alerts-check";
import { SettingsDisplayPane } from "./settings-display-pane";
import { SettingsHelpData } from "./settings-help-data";
import { SettingsReferenceCard } from "./settings-reference-card";
import { SettingsRestoreDialog, type RestoreScope } from "./settings-restore-dialog";
import { SettingsReviewDialog } from "./settings-review-dialog";
import { surgeConfiguration } from "./settings-rule-catalogue";
import { SettingsRulesPane } from "./settings-rules-pane";
import { REDESIGN_TABS, TAB_ICONS, findRedesignSettings } from "./settings-tabs";
import { SettingsWhoCan } from "./settings-who-can";
import {
  copyExecutiveSettingsDiagnostics,
  SettingsSourceHost,
  type SettingsSource,
} from "@/components/ward-management/settings/settings-operational-source";

/** Settings workspaces (owner-approved 8 Oct 2026): tabs, Find a setting and one rule save bar.
 * Operational desks edit drafts and audit each SET_CONFIGURATION; executive reports supply
 * twelve public values, with individual record evidence explicitly unavailable.
 * Browser preferences, profile, rules export, diagnostics and own-session clearing stay wired.
 * Never show controls nothing reads (D-72). Clock, scenario and Reset belong in Tools (Q-7).
 *
 * REDESIGN (mock-up, 30 Oct 2026): "Save to apply" is plain words, not a button-shaped tag; the Rules
 * tab keeps a sticky save bar at the bottom (unsaved changes, Discard, Save rules, Full audit) even
 * when nothing is unsaved; rule steppers are compact on a desktop; and Profile and shift joins Display
 * as one "Display and profile" tab whose Profile card reads only what the app holds (desk, role,
 * scope, shift pattern, service in view, appearance). An old #profile address opens that tab.
 *
 * ROUND 3 (mock-up, 30 Oct 2026, Josh: "go ahead with all recommendations"): tabs by job (Help and
 * data replaces Data and about); the Rules tab in its own file with live impact, honest Surge, the
 * last change as one line and Show changed only; Save opens a review first, and a loaded rules file
 * lands in the same review; Download writes the saved rules; Restore lists all twelve rules and asks
 * whether this browser comes back too; an alerts check; three proposed browser settings; a Who can
 * change what table under Access. The nurse in charge, access admin and executive views are this one
 * component, their differences marked `ROLE BRANCH (...)`, as the real component will serve them.
 */

/** Pages each desk could open first, for the proposed Open Ward Flow on (its rail's own pages). */
const START_PAGES: Partial<Record<string, readonly string[]>> = {
  coordinator: ["Home", "Referrals", "Waiting", "Capacity", "Movements"],
  ward: ["My ward", "Referrals", "Alerts", "Statistics"],
  ed: ["ED board", "Referrals", "Waiting"],
  admin: ["Settings", "Governance"],
  executive: ["Statistics", "Capacity"],
};

export function SettingsRedesign() {
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
  const [chosenTab, setTab] = useState<SettingsTab | null>(null);
  // The Access tab is for the desks that give access or cover, with the role-access flag on. An
  // Access admin desk opens on it, because giving roles is all that desk does.
  const { desk } = useWardAccessSnapshot();
  const accessOn = useWardFeatureFlag("role-access") && showsAccessTab(desk);
  const helpAskOn = useWardFeatureFlag("help-ask");
  // ROLE BRANCH (ward), from the nurse in charge copy: a ward desk changes no rule, so it opens on its
  // own desk's display and profile, and the rules read as read only with no save bar.
  const readsRulesOnly = desk.role === "ward";
  // ROLE BRANCH (admin), from the access admin copy: no clinical content and no alerts on this desk,
  // so Rules and Alerts go, and Access, the desk's work, comes first.
  const adminDesk = accessOn && desk.role === "admin";
  const tabs = adminDesk
    ? [
        REDESIGN_TABS[4],
        ...REDESIGN_TABS.filter((item) => item.id !== "rules" && item.id !== "alerts" && item.id !== "access"),
      ]
    : accessOn
      ? REDESIGN_TABS
      : REDESIGN_TABS.filter((item) => item.id !== "access");
  const firstTab: SettingsTab = adminDesk ? "access" : readsRulesOnly ? "display" : "rules";
  const tab: SettingsTab =
    chosenTab === null || !tabs.some((item) => item.id === (chosenTab === "profile" ? "display" : chosenTab))
      ? firstTab
      : chosenTab === "profile"
        ? "display"
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
  const chooseTab = useCallback((requested: SettingsTab) => {
    const next: SettingsTab = requested === "profile" ? "display" : requested;
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
  const results = findRedesignSettings(
    query,
    tabs.map((item) => item.id),
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
    if (entry.id === "go-to-desk") {
      setQuery("");
      setFindOpen(false);
      goToDesk();
      return;
    }
    chooseTab(entry.tab);
    // Fixed defaults and Clinical values sit behind the reference card's tabs; show them first.
    if (entry.id === "fixed-defaults") setReference("defaults");
    if (entry.id === "clinical-values") setReference("clinical");
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
  const tabLabel = (id: SettingsTab) =>
    REDESIGN_TABS.find((item) => item.id === (id === "profile" ? "display" : id))?.label ?? id;

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

  // Who cannot change the rules, in words: the executive, the nurse in charge (ROLE BRANCH (ward)),
  // and a coordinator who is not the statewide one. They get one Read only line and no save bar.
  const readOnlyWords =
    source.kind === "executive"
      ? "Public rules for executive reporting."
      : readsRulesOnly
        ? "The rules your ward's screens use, set by the coordinator."
        : (configurationBlockReason ?? null);

  const rulesContent = (
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
  );

  const testBuzz = () => {
    playSyntheticUrgentChime();
    showToast("Test buzz played.");
  };

  const alertsContent = (
    <SettingsAlertsPane
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

  const displayContent = (
    <SettingsDisplayPane
      profileCard={<SettingsProfileCard now={now} onGoToDesk={goToDesk} />}
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
      startPages={START_PAGES[desk.role] ?? ["Home"]}
      now={now}
    />
  );

  const dataContent = (
    <>
      <SettingsHelpData
        movementCount={operational?.movements.length ?? null}
        eventCount={operational?.eventLog?.length ?? (operational ? 0 : null)}
        shared={sharedEnabled}
        auditAvailable={ruleChanges !== null}
        onDownload={handleExport}
        onCopyDiagnostics={handleCopyDiagnostics}
        onLoad={handleImport}
        loadUnavailable={configurationBlockReason}
        onClearSession={handleClearSession}
        onRestore={() => {
          // On a phone the sheet closes first, so the restore dialog is the only layer.
          setPhoneSheet(null);
          setIsResetModalOpen(true);
        }}
        reference={
          <SettingsReferenceCard reference={reference} onReferenceChange={setReference} thresholds={thresholds} />
        }
      />
      {helpAskOn ? <WardHelpUsageCard /> : null}
    </>
  );

  // Round 3: the Access tab adds the read-only Who can change what table under today's panels.
  const accessContent = accessOn ? (
    <div data-setting="access">
      <AccessSettings />
      <SettingsWhoCan />
    </div>
  ) : null;

  // Redesign: on the Rules tab the save bar always shows, so where Save lives never moves.
  // A desk that cannot change the rules has no save bar (ROLE BRANCH (ward), executive, non-statewide).
  const saveBar =
    readOnlyWords === null && (hasUnsavedRules || tab === "rules") ? (
      <SettingsSaveBar
        diffs={diffs}
        onRulesTab={tab === "rules"}
        onReview={() => chooseTab("rules")}
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
    const areaSummary: Record<SettingsTab, string> = {
      rules: readOnlyWords === null ? "ED and placement, form warnings, reply targets" : "Read only",
      alerts: `Browser ${actNowNotifications ? "on" : "off"} · buzz ${audioBuzz ? "on" : "off"}`,
      display: `${deskProfile.role} · motion ${reducedMotion ? "reduced" : "on"} · contrast ${highContrast ? "high" : "standard"}`,
      profile: `${deskProfile.role} · ${deskProfile.location}`,
      data: "Help, rules file, restore, about",
      access: desk.role === "admin" ? "Roles, approvals and requests" : "Cover for a second ward or ED",
    };
    const sheetTab = phoneSheet;
    const sheetContent: Record<SettingsTab, ReactNode> = {
      rules: rulesContent,
      alerts: alertsContent,
      display: displayContent,
      profile: displayContent,
      data: dataContent,
      access: accessContent,
    };
    // ROLE BRANCH (admin), from the access admin copy: giving access is all this desk does, so on a
    // phone its requests and roles are open on the page, above the other areas, with no Access row,
    // and the buzz sound (for alerts it never gets) is left out.
    const accessInline = adminDesk;
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
            chip={<span className={styles.phoneProfileChip}>Demo profile</span>}
            sub={roleIsName ? undefined : deskProfile.role}
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
              {accessInline ? null : (
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
              )}
            </div>
          </section>

          <section className={styles.phoneSection} aria-labelledby="settings-phone-all">
            <h2 id="settings-phone-all" className={styles.phoneHead}>
              All settings
            </h2>
            <ul className={styles.phoneList}>
              {tabs.flatMap((item) => {
                const Icon = TAB_ICONS[item.id];
                if (accessInline && item.id === "access") return [];
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
            title={sheetTab ? tabLabel(sheetTab) : "Settings"}
            description={
              // Round 3: a desk that cannot save is never told "Save to apply".
              sheetTab === "rules"
                ? readOnlyWords !== null
                  ? `Read only · ${readOnlyWords}`
                  : "Changes wait for Save. Each save is recorded in the audit"
                : sheetTab === "access"
                  ? "Each change asks for your password again"
                  : "Saves at once · this browser only"
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

  return (
    <div className={styles.screen} data-testid="ward-settings-screen" data-ward-design="workspaces">
      <main id="main-content" className={styles.main}>
        <h1 className={styles.srOnly}>Settings</h1>

        <Hero
          className={styles.band}
          testId="ward-settings-profile"
          // ROLE BRANCH (admin), polish r2: a desk named by its role says the role once, in the title.
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
              {/* ROLE BRANCH (ward, admin): these desks open on Display or Access, so no Profile jump. */}
              {readsRulesOnly || adminDesk ? null : (
                <Button variant="light" size="sm" icon={UserRound} onClick={() => chooseTab("display")}>
                  Profile
                </Button>
              )}
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

        <div className={styles.pane} hidden={tab !== "data"} data-pane="data">
          {dataContent}
        </div>

        {/* Mounted only while open, so its server reads wait until the tab is chosen (review on PR #363). */}
        {accessOn && tab === "access" ? (
          <div className={styles.pane} data-pane="access">
            {accessContent}
          </div>
        ) : null}

        {saveBar}

        {overlays}
      </main>
    </div>
  );
}
