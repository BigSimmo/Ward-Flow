"use client";

import { useCharacterShortcutsPreference } from "@/components/ward-management/shell/ward-character-shortcuts";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { waitingHref } from "@/components/ward-management/delays/waiting-href";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ChevronDown,
  ClipboardCopy,
  Clock,
  Columns3,
  Keyboard,
  Lock,
  MonitorPlay,
  MoreHorizontal,
  Printer,
  Sparkles,
  Timer as TimerIcon,
} from "lucide-react";

import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen, isStoppedTransportAwaitingRelease } from "@/components/ward-management/ward-derivations";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { accessIsWholeNetwork, unitInScope } from "@/components/ward-management/ward-role-access";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  Button,
  Card,
  Checkbox,
  Drawer,
  FilterChip,
  HeroTrack,
  Hero,
  type SinceItem,
  Icon,
  LiveChip,
  Menu,
  Popover,
  PortraitList,
  PortraitRail,
  Segmented,
  Select,
  StatusGlyph,
  TabPanel,
  Tabs,
  buttonClass,
  cx,
  durMinutes,
  tableClasses,
  useIsPhone,
  useIsTabletPortrait,
  useMediaQuery,
  SrOnly,
} from "@/components/wf";

import {
  DENSITY_COLUMNS,
  DENSITY_LABEL,
  HANDOVER_COLUMNS,
  columnsFor,
  rowTone,
  type ColumnContext,
  type HandoverColumnId,
  type HandoverDensity,
} from "./handover-columns";
import {
  HANDOVER_CHIPS,
  HANDOVER_SHIFTS,
  defaultHandoverShift,
  groupOf,
  groupRows,
  currentHeldHandover,
  handoverAt,
  handoverShift,
  heldHandoverCutoff,
  heldHandoverNewSince,
  holdHandover,
  heldDischarges,
  isActNow,
  isActOrUrgent,
  isFlaggedUrgent,
  isbarText,
  pillTest,
  summaryText,
  toHandoverRow,
  toHandoverWard,
  STAGE_LABEL,
  nextStep,
  type HandoverChip,
  type HandoverGrouping,
  type HandoverPill,
  type HandoverRow,
  type HandoverShiftId,
  type HandoverSort,
  type HeldHandover,
  handoverSignedBefore,
} from "./handover-model";
import { HandoverFlowPanel, HandoverSignOffPanel } from "./handover-panels";
import { handoverSignOffChecks } from "./handover-sign-off-checks";
import {
  HandoverKeysHelp,
  HandoverMeetingTimer,
  ShowMoreRow,
  SignOffBar,
  SinceLine,
  signOffWaitReason,
} from "./handover-sheet-parts";
import * as desk from "./handover-desk";
import { HandoverBeds } from "./handover-beds";
import { LongStaySummary } from "./long-stay-summary";
// Closing-the-loop package A (24 Oct 2026): open promises and callbacks carried over.
import { HandoverOpenPromises } from "./handover-open-promises";
import { DEFAULT_PRINT_OPTIONS, HandoverPrintSheet } from "./handover-print-sheet";
import { HandoverPhone } from "./handover-phone";
import styles from "./handover-refined.module.css";

import { NETWORK_SCOPE_VALUE, handoverScopeValue, parseHandoverScope } from "./handover-scope";
import { HandoverHistory, HandoverScopeControl, StatusCheckIcon } from "./handover-page-parts";
import {
  allRecordsScopeLabel,
  handoverScopeLabel,
  movementInHandoverScope,
  recordHandoverSignOff,
  resolveAdmissionPatient,
} from "./handover-scope-rules";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

export {
  handoverScopeLabel,
  movementInHandoverScope,
  movementIsUrgent,
  resolveMovementPatient,
  urgentMovementsOutsideScope,
} from "./handover-scope-rules";

export { type HandoverScope, handoverScopeValue, parseHandoverScope } from "./handover-scope";

/* ================================================================== the page */

type HandoverTab = "pts" | "beds" | "hist";

const SORT_LABEL: Record<HandoverSort, string> = {
  wait: "Longest wait first",
  tier: "Tier first",
  due: "Due first",
};

const GROUPING_LABEL: Record<HandoverGrouping, string> = {
  meet: "Group: meeting order",
  ed: "Group: emergency department",
  ward: "Group: destination ward",
  owner: "Group: owner",
  none: "No groups",
};

const PILL_TONE: Record<Exclude<HandoverPill, "new">, "danger" | "warning" | "neutral" | "info"> = {
  act: "danger",
  urg: "danger",
  due: "warning",
  bed: "neutral",
  mov: "info",
};

const GROUP_TONE = {
  act: "danger",
  urg: "danger",
  due: "warning",
  rel: "warning",
  bed: "neutral",
  acc: "neutral",
  mov: "info",
} as const;

const DUE_FIRST = 4; // Due by rows shown before Show more.

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * The Handover page, refined A (Josh, 9 Oct 2026). One grouped table in meeting order is the core,
 * held to a set height so it scrolls inside its card. The right panel is the sign-off sheet until a
 * patient is picked, then that patient's flow. Beds and History are tabs, and Print handover opens
 * the sheet builder, where what you see is what prints.
 */
export function HandoverPage() {
  const [dueAll, setDueAll] = useState(false);
  const {
    movements,
    units,
    referrals,
    patients,
    admissions,
    bedReleases,
    dispatch,
    dayZero,
    handoverSignOffs,
    rejections,
    configuration,
    inboxSnoozes,
  } = useWardFlowSelect(
    "movements",
    "units",
    "referrals",
    "patients",
    "admissions",
    "bedReleases",
    "dispatch",
    "dayZero",
    "handoverSignOffs",
    "rejections",
    "configuration",
    "inboxSnoozes",
  );
  const now = useWardFlowClock();
  const access = useEffectiveWardAccess();
  // Role branches: the nurse in charge's one ward (no scope picker, empty groups folded), and the ED
  // clinician's own department (no Beds tab, no bed counts, no sign-off).
  const { ownWard, edDesk, edName } = desk.handoverDeskOf(access, units);
  const allRecordsLabel = ownWard?.name ?? edName ?? allRecordsScopeLabel(access);
  const isPhoneWidth = useIsPhone();
  const isTabletPortrait = useIsTabletPortrait();
  /* iPad portrait (820px, device audit 11 Oct 2026): list rows and the rail as a slide-over. */
  const portrait = isTabletPortrait && !isPhoneWidth;

  /* scope, read once from the URL */
  const searchParams = useSearchParams();
  const [scopeValue, setScopeValue] = useState<string>(() => {
    const requested = searchParams?.get("scope")?.trim();
    if (requested === undefined || requested.length === 0) return NETWORK_SCOPE_VALUE;
    // A link naming a ward, ED or team that does not exist falls back to the whole network: a
    // quiet empty sheet is the dangerous direction on a handover.
    const parsed = parseHandoverScope(requested);
    return handoverScopeLabel(parsed, units) === undefined ? NETWORK_SCOPE_VALUE : handoverScopeValue(parsed);
  });
  const scope = useMemo(() => parseHandoverScope(scopeValue), [scopeValue]);
  const scopeLabel = handoverScopeLabel(scope, units, allRecordsLabel) ?? allRecordsLabel;

  /* which handover */
  // Audit TC2-02: held as the instant it meant when chosen, so midnight cannot move it.
  const [heldChoice, setHeldChoice] = useState<HeldHandover>(() => holdHandover(defaultHandoverShift(now), now));
  const { id: shift, at: shiftAt } = currentHeldHandover(heldChoice, now);
  const setShift = (id: HandoverShiftId) => setHeldChoice(holdHandover(id, now));
  const shiftInfo = handoverShift(shift);
  const passed = shiftAt <= now;
  const cutoff = heldHandoverCutoff(shiftAt, now);
  const newSince = heldHandoverNewSince(shiftAt, now);

  /* view state */
  const [tab, setTab] = useState<HandoverTab>("pts");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [grouping, setGrouping] = useState<HandoverGrouping>("meet");
  const [sort, setSort] = useState<HandoverSort>("wait");
  const [density, setDensity] = useState<HandoverDensity>("std");
  const [customColumns, setCustomColumns] = useState<HandoverColumnId[] | null>(null);
  const [pill, setPill] = useState<HandoverPill | null>(null);
  const [chips, setChips] = useState<ReadonlySet<HandoverChip>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [present, setPresent] = useState(false);
  const [meetingStartedAt, setMeetingStartedAt] = useState<number | null>(null);
  const [meetings, setMeetings] = useState<{ at: Instant; minutes: number }[]>([]);
  const [preparedAt, setPreparedAt] = useState<Instant | null>(null);
  const [printOptions, setPrintOptions] = useState(DEFAULT_PRINT_OPTIONS);
  const [copied, setCopied] = useState(false);
  const [singleKeyShortcutsEnabled, setSingleKeyShortcutsEnabled] = useCharacterShortcutsPreference();
  const shortcutScopeRef = useRef<HTMLElement | null>(null);
  const keysTriggerRef = useRef<HTMLButtonElement | null>(null);
  const signOffRef = useRef<HTMLDivElement | null>(null);

  useDirtyStateGuard({ isDirty: meetingStartedAt !== null });

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(id);
  }, [copied]);

  /* rows and wards */
  // Act now reads the shared act-now list (`ward-act-now-items.ts`), the one Alerts and Tasks show.
  const actNowItems = useMemo(
    () => activeActNowItems({ movements, units, configuration, inboxSnoozes }, now),
    [movements, units, configuration, inboxSnoozes, now],
  );
  const actNowMovementIds = useMemo(() => new Set(actNowItems.map((item) => item.movementId)), [actNowItems]);
  const allRows = useMemo(
    () =>
      movements
        .filter((movement) => isOpen(movement) || isStoppedTransportAwaitingRelease(movement))
        .map((movement) => ({
          ...toHandoverRow(movement, units, patients, referrals),
          actNow: actNowMovementIds.has(movement.id),
        })),
    [movements, units, patients, referrals, actNowMovementIds],
  );
  const rows = useMemo(
    () => allRows.filter((row) => movementInHandoverScope(row.movement, scope, units, referrals)),
    [allRows, scope, units, referrals],
  );
  const outside = useMemo(
    () => allRows.filter((row) => !movementInHandoverScope(row.movement, scope, units, referrals)),
    [allRows, scope, units, referrals],
  );
  const deskPlaces = useMemo(() => wardPlaceLookup(units), [units]);
  const allWards = useMemo(
    () => units.map((unit) => toHandoverWard(unit, admissions, now, bedReleases)),
    [units, admissions, now, bedReleases],
  );
  const wards = useMemo(
    () =>
      allWards.filter((ward) => {
        // #815: a scoped desk's sign-off and stale count cover its own wards only.
        if (!accessIsWholeNetwork(access) && !unitInScope(access.scope, ward.id, deskPlaces)) return false;
        if (scope.kind === "ward") return ward.id === scope.id;
        if (scope.kind === "service") return ward.service === scope.id;
        return true;
      }),
    [allWards, scope, access, deskPlaces],
  );
  const held = useMemo(
    () => heldDischarges(admissions, wards, patients, referrals, now),
    [admissions, wards, patients, referrals, now],
  );
  const wardOf = useCallback((unitId: string) => allWards.find((ward) => ward.id === unitId), [allWards]);
  // Beds a pull can take now: free beds still being made ready are refused by the engine.
  const readyBeds = useCallback(
    (unitId: string) => {
      const ward = wardOf(unitId);
      return ward ? Math.max(0, ward.ready - ward.pendingPreparation) : 0;
    },
    [wardOf],
  );
  const ctx: ColumnContext = useMemo(() => ({ now, cutoff, readyBeds }), [now, cutoff, readyBeds]);

  /* highlight, never hide */
  const anyHighlight = pill !== null || chips.size > 0;
  const isHighlighted = useCallback(
    (row: HandoverRow) => {
      if (pill === null && chips.size === 0) return false;
      if (pill !== null && !pillTest(pill, row, now, cutoff, newSince)) return false;
      for (const chip of chips) {
        const definition = HANDOVER_CHIPS.find((candidate) => candidate.id === chip);
        if (definition && !definition.test(row, now)) return false;
      }
      return true;
    },
    [pill, chips, now, cutoff, newSince],
  );
  const groups = useMemo(() => groupRows(rows, grouping, sort, now, cutoff), [rows, grouping, sort, now, cutoff]);
  const visibleOrder = useMemo(
    () => groups.filter((group) => !collapsed.has(group.id)).flatMap((group) => group.rows),
    [groups, collapsed],
  );

  // Audit 24-4 decision 5 (Josh, 24 Oct 2026): Act now counts people (one row per journey), while
  // Alerts counts alerts; one person can carry two, and some alerts have no journey. The pill names
  // both, so the two screens are never read as disagreeing. An alert with no journey counts only on
  // the whole network, where nothing is scoped out.
  const actNowAlertCount = useMemo(() => {
    const inScope = new Set<string>(rows.map((row) => row.movement.id));
    return actNowItems.filter((item) => (item.movementId ? inScope.has(item.movementId) : scope.kind === "network"))
      .length;
  }, [actNowItems, rows, scope]);
  const counts = useMemo(
    () => ({
      act: rows.filter((row) => groupOf(row, now, cutoff) === "act").length,
      urg: rows.filter((row) => groupOf(row, now, cutoff) === "urg").length,
      due: rows.filter((row) => groupOf(row, now, cutoff) === "due").length,
      bed: rows.filter((row) => groupOf(row, now, cutoff) === "bed").length,
      mov: rows.filter((row) => groupOf(row, now, cutoff) === "mov").length,
      new: rows.filter((row) => row.openedAt >= newSince).length,
    }),
    [rows, now, cutoff, newSince],
  );
  const readyTotal = wards.reduce((sum, ward) => sum + ward.ready, 0);

  // Changes since the preceding handover boundary, not a recorded personal visit.
  const [sinceOpen, setSinceOpen] = useState(true);
  const sinceItems = useMemo((): SinceItem[] => {
    const inScopeUnit = (unitId: string) => wards.some((ward) => ward.id === unitId);
    const within = (at: Instant | null | undefined) => at !== null && at !== undefined && at >= newSince && at <= now;
    const unitWords = (list: Admission[]) => {
      const byUnit = new Map<string, number>();
      for (const admission of list) {
        const name = units.find((unit) => unit.id === admission.unitId)?.name ?? "Ward not recorded";
        byUnit.set(name, (byUnit.get(name) ?? 0) + 1);
      }
      return [...byUnit.entries()].map(([name, n]) => `${n} ${name}`).join(", ") || "None";
    };
    // ED/team membership is not recorded for every ward admission. Keep the all-ward counts,
    // but name their broader population on screen and in copied handover text.
    const wardPopulation = scope.kind === "ed" || scope.kind === "team" ? " across accessible wards" : "";
    const admitted = admissions.filter((admission) => inScopeUnit(admission.unitId) && within(admission.arrivedAt));
    const discharged = admissions.filter((admission) => inScopeUnit(admission.unitId) && within(admission.leftAt));
    const opened = rows.filter((row) => row.openedAt >= newSince);
    const newAct = opened.filter((row) => isActNow(row, now));
    const items: SinceItem[] = [
      {
        id: "admitted",
        value: admitted.length,
        word: `admitted${wardPopulation}`,
        detail: unitWords(admitted),
        tone: "success",
      },
      {
        id: "discharged",
        value: discharged.length,
        word: `discharged${wardPopulation}`,
        detail: unitWords(discharged),
        tone: "success",
      },
      {
        id: "opened",
        value: opened.length,
        word: "new on the sheet",
        detail: "Referrals and moves opened",
        tone: "info",
      },
      {
        id: "act",
        value: newAct.length,
        word: "new act now",
        detail: newAct.length ? newAct.map((row) => row.umrn).join(", ") : "None",
        tone: newAct.length ? "danger" : "neutral",
      },
    ];
    // ROLE BRANCH (ed): an ED desk holds no ward, so ward admissions and discharges are left out.
    return edDesk ? items.filter((item) => item.id !== "admitted" && item.id !== "discharged") : items;
  }, [admissions, wards, units, rows, scope.kind, newSince, now, edDesk]);
  // L1 (site review, 12 Oct 2026): the chip counts each change once. "New act now" rows are already
  // among "new on the sheet", so adding them again made the chip read 35 beside a strip of 0, 1, 32.
  const sinceTotal = sinceItems.reduce((sum, item) => (item.id === "act" ? sum : sum + item.value), 0);
  const copySince = useCallback(() => {
    const text = [
      "Synthetic demonstration · Not approved for clinical use",
      `Since previous handover at ${formatInstantWithDay(newSince, now)} (${scopeLabel}):`,
      ...sinceItems.map((item) => `${item.value} ${item.word}${item.detail ? ` (${item.detail})` : ""}`),
    ].join("\n");
    void copyTextToClipboard(text).then(
      () => announceToWardShell("Changes copied as handover text."),
      () => announceToWardShell("Copy was blocked by the browser."),
    );
  }, [sinceItems, newSince, now, scopeLabel]);
  // Flagged urgent rows outside the scope are listed with act now, so neither leaves the sheet.
  const outsideAct = outside.filter((row) => isActNow(row, now) || isFlaggedUrgent(row, now));
  const wardAllShown = ownWard !== undefined && rows.length === allRows.length && outsideAct.length === 0;

  /* columns */
  // Desktop with the sign-off rail beside the table (1201px and up): Standard drops Legal and obs and
  // fits the rest to the card, so Due and Next step are on screen rather than scrolled off (device
  // audit 11 Oct 2026). Full and custom columns keep their own set.
  const railBeside = useMediaQuery("(min-width: 75.0625rem)");
  // iPad landscape (1001px and up) fits the Standard columns to the card too, so Next step is not cut
  // at the card edge behind a sideways scroll (layout sweep 25 Oct 2026).
  const fitsCard = useMediaQuery("(min-width: 62.5625rem)");
  const fitted = fitsCard && !present && !sheetOpen && customColumns === null && density === "std";
  const columnIds =
    customColumns ?? (fitted ? DENSITY_COLUMNS.std.filter((id) => id !== "lo") : DENSITY_COLUMNS[density]);
  // Final check (30 Oct 2026): Waiting gets 18 units from Next step, so "21:55 yesterday" is not cut
  // to "yesterd…" at 1440; the fitted table keeps the same total width.
  const columns = columnsFor(columnIds).map((column) =>
    !fitted
      ? column
      : column.id === "wait"
        ? { ...column, width: 128 }
        : column.id === "next"
          ? { ...column, width: 252 }
          : column,
  );
  const wide = present || columnIds.length > 8;
  const compact = customColumns === null && density === "min";

  /* selection */
  const selected = selectedId === null ? undefined : allRows.find((row) => row.id === selectedId);
  // The rail's own Sign off shows only when the rail is on screen beside the Patients table and is
  // not holding a picked patient's flow; everywhere else the hero button is the way in.
  // ROLE BRANCH (ed): an ED desk never signs off, so there is no sign-off rail.
  const signOffInRail = !edDesk && railBeside && !wide && tab === "pts" && !selected;
  const pick = (id: string) => {
    setSelectedId(id);
    if (wide || isPhoneWidth || portrait) setDrawerOpen(true);
  };
  const step = useCallback(
    (direction: 1 | -1) => {
      if (visibleOrder.length === 0) return;
      const index = visibleOrder.findIndex((row) => row.id === selectedId);
      const next = index < 0 ? 0 : Math.max(0, Math.min(visibleOrder.length - 1, index + direction));
      const id = visibleOrder[next]!.id;
      setSelectedId(id);
      if (wide || isPhoneWidth || portrait) setDrawerOpen(true);
      // A sheet owns the selection on phone and in presentation mode. Revealing
      // its table row would move the locked background behind that sheet.
      else if (typeof document !== "undefined") {
        document.querySelector(`[data-row-id="${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: "nearest" });
      }
    },
    [visibleOrder, selectedId, wide, isPhoneWidth, portrait, setDrawerOpen],
  );

  /* sign-off */
  const routeRole = useRouteRole();
  const gate = useRoleGate();
  const signOffGate = gate("RECORD_HANDOVER_SIGN_OFF");
  const signedAt = handoverSignedBefore(handoverSignOffs, shiftAt);
  const signedBy =
    signedAt === null ? null : ([...handoverSignOffs].reverse().find((record) => record.at === signedAt)?.by ?? null);
  // v10 pass 3: the sign-off is recorded at once and Undo takes it back (UNDO_HANDOVER_SIGN_OFF).
  const { run: runStep } = useUndoableStep({
    dispatch,
    rejections,
    now,
    routeRole,
    onMessage: announceToWardShell,
  });
  const handleSignOff = useCallback(() => {
    // Records contain role and time only, so only the current sign-off window can be signed.
    if (!signOffGate.allowed || shiftAt <= now || shiftAt !== handoverAt(defaultHandoverShift(now), now)) return;
    const recorded = recordHandoverSignOff(
      (event) =>
        runStep(event, {
          // Audit S-31: one short toast; the panel's own line carries the time and the record.
          success: "Handover signed off.",
          undo: (at) => ({ type: "UNDO_HANDOVER_SIGN_OFF", role: routeRole, now: at }),
          undone: "Sign-off undone.",
        }),
      now,
      routeRole,
    );
    if (recorded === null) announceToWardShell("Sign-off is not recorded.");
  }, [runStep, now, routeRole, shiftAt, signOffGate.allowed]);
  const handleUndoSignOff = useCallback(() => {
    runStep({ type: "UNDO_HANDOVER_SIGN_OFF", role: routeRole, now }, { success: "Sign-off undone." });
  }, [runStep, now, routeRole]);
  const showSignOff = () => {
    setSheetOpen(false);
    setTab("pts");
    setSelectedId(null);
    if (wide || isPhoneWidth || portrait) setDrawerOpen(true);
    window.requestAnimationFrame(() => signOffRef.current?.querySelector<HTMLElement>("button")?.focus());
  };

  /* meeting timer: session only, the length goes to History */
  const toggleMeeting = useCallback(() => {
    if (meetingStartedAt === null) {
      setMeetingStartedAt(Date.now());
      return;
    }
    const minutes = Math.max(1, Math.round((Date.now() - meetingStartedAt) / 60_000));
    setMeetings((list) => [{ at: now, minutes }, ...list]);
    setMeetingStartedAt(null);
    announceToWardShell(`Meeting took ${minutes} min. Added to History.`);
  }, [meetingStartedAt, now]);

  /* copy */
  const shiftLine = `${shiftInfo.label.toLowerCase()}, ${formatInstantWithDay(shiftAt, now)}`;
  const copySummary = useCallback(() => {
    const text = summaryText(groups, scopeLabel, shiftLine, now, now);
    void copyTextToClipboard(text).then(
      () => {
        setCopied(true);
        announceToWardShell(`Summary copied, ${rows.length} synthetic patients.`);
      },
      () => announceToWardShell("Copy was blocked by the browser."),
    );
  }, [groups, scopeLabel, shiftLine, now, rows.length]);
  const copyIsbar = useCallback(
    (row: HandoverRow) => {
      void copyTextToClipboard(isbarText(row, now, readyBeds)).then(
        () => announceToWardShell(`ISBAR for ${row.name} copied.`),
        () => announceToWardShell("Copy was blocked by the browser."),
      );
    },
    [now, readyBeds],
  );

  /* keyboard */
  const showSignOffRef = useRef(showSignOff);
  useEffect(() => {
    showSignOffRef.current = showSignOff;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]') && event.key !== "Escape") return;
      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        if (drawerOpen) setDrawerOpen(false);
        else if (sheetOpen) setSheetOpen(false);
        else if (selectedId !== null) setSelectedId(null);
        else if (present) setPresent(false);
        return;
      }
      // Character shortcuts belong to this handover, not the surrounding shell or another widget.
      // Nothing focused (the document body, as after a fresh load) counts as this handover.
      const active = document.activeElement;
      const inScope = active === null || active === document.body || shortcutScopeRef.current?.contains(active);
      if (!singleKeyShortcutsEnabled || isPhoneWidth || !inScope) return;
      if (key === "p") {
        event.preventDefault();
        setSheetOpen(true);
      } else if (key === "s" && !edDesk) {
        event.preventDefault();
        showSignOffRef.current();
      } else if (key === "m") {
        event.preventDefault();
        toggleMeeting();
      } else if (event.key === "?") {
        event.preventDefault();
        keysTriggerRef.current?.click();
      } else if ((key === "j" || key === "k") && tab === "pts" && !sheetOpen) {
        event.preventDefault();
        step(key === "j" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    drawerOpen,
    selectedId,
    present,
    sheetOpen,
    isPhoneWidth,
    singleKeyShortcutsEnabled,
    toggleMeeting,
    tab,
    step,
    edDesk,
  ]);

  /* sign-off checks */
  const signChecks = handoverSignOffChecks({
    rows,
    wards,
    now,
    cutoff,
    dueCount: counts.due,
    preparedAt,
    meetings,
    onCheckBeds: isPhoneWidth
      ? undefined
      : () => {
          setDrawerOpen(false);
          setTab("beds");
        },
  });
  const nextShift = shiftAt === handoverAt(defaultHandoverShift(now), now);
  const canSignOff = signOffGate.allowed && !passed && nextShift;
  const cannotSignReason = signOffGate.reason ?? signOffWaitReason(passed, nextShift);

  // ROLE BRANCH (ed): an ED desk never signs a handover off (RECORD_HANDOVER_SIGN_OFF is coordinator
  // or ward only), so the checklist, rail, bar, hero button and S shortcut are left out (Josh, 30 Oct
  // 2026). One quiet line in the hero foot says who signs off, or when it was signed.
  const signOffPanel = edDesk ? null : (
    <div ref={signOffRef}>
      <HandoverSignOffPanel
        title={`Sign off ${formatInstantWithDay(shiftAt, now)} handover`}
        subtitle={`${shiftInfo.label} · ${scopeLabel}`}
        checks={signChecks}
        signedAt={signedAt}
        signedBy={signedBy}
        viewerRole={routeRole}
        now={now}
        canSignOff={canSignOff}
        cannotSignReason={cannotSignReason}
        onSignOff={handleSignOff}
        onUndoSignOff={handleUndoSignOff}
      />
      {!passed ? signOffGate.note : null}
    </div>
  );
  const flowPanel = selected ? (
    <HandoverFlowPanel
      row={selected}
      ctx={ctx}
      wardOf={wardOf}
      openPatientHref={selected.patientId ? patientHref(selected.patientId) : undefined}
      onClose={() => {
        setSelectedId(null);
        setDrawerOpen(false);
      }}
      onCopyIsbar={copyIsbar}
    />
  ) : null;

  /* iPad portrait: the rail (sign off, or the open patient) as a slide-over. An ED desk has no
     sign-off rest state, so its rail shows only while a patient is open. */
  const portraitRail = (signedLine: string | null, checksDone: number) =>
    !signOffPanel && !flowPanel ? null : (
      <PortraitRail
        title={selected ? selected.name : "Sign off"}
        summary={selected ? "Patient flow" : (signedLine ?? `${checksDone} of ${signChecks.length} checks`)}
        open={drawerOpen}
        onOpenChange={(open) => {
          // The trigger opens the rest state (sign off); closing returns to it.
          setSelectedId(null);
          setDrawerOpen(open);
        }}
      >
        {flowPanel ?? signOffPanel}
      </PortraitRail>
    );

  const togglePill = (next: HandoverPill) => {
    setPill((current) => (current === next ? null : next));
    setTab("pts");
    setSheetOpen(false);
  };
  const toggleChip = (chip: HandoverChip) =>
    setChips((current) => {
      const next = new Set(current);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  const clearHighlight = () => {
    setPill(null);
    setChips(new Set());
  };

  /* shared controls */
  // ROLE BRANCH (ward): one ward named, no scope picker, and no Declined or Escalated chip (FD-23).
  const scopeControl = ownWard ? null : (
    <HandoverScopeControl value={scopeValue} onChange={setScopeValue} units={units} />
  );
  const deskChips = desk.deskChips(HANDOVER_CHIPS, ownWard !== undefined);
  const groupingControl = (
    <Select
      aria-label="Group by"
      boxClassName={styles.barSelect}
      value={grouping}
      onChange={(event) => setGrouping(event.target.value as HandoverGrouping)}
    >
      {(Object.keys(GROUPING_LABEL) as HandoverGrouping[]).map((id) => (
        <option key={id} value={id}>
          {GROUPING_LABEL[id]}
        </option>
      ))}
    </Select>
  );
  const sortControl = (
    <Select
      aria-label="Sort"
      boxClassName={styles.barSelect}
      value={sort}
      onChange={(event) => setSort(event.target.value as HandoverSort)}
    >
      {(Object.keys(SORT_LABEL) as HandoverSort[]).map((id) => (
        <option key={id} value={id}>
          {SORT_LABEL[id]}
        </option>
      ))}
    </Select>
  );
  const densityControl = (
    <Segmented
      label="Columns shown"
      value={customColumns === null ? density : ("custom" as HandoverDensity)}
      onChange={(id) => {
        setDensity(id);
        setCustomColumns(null);
      }}
      items={(Object.keys(DENSITY_LABEL) as HandoverDensity[]).map((id) => ({ id, label: DENSITY_LABEL[id] }))}
    />
  );
  const columnsControl = (
    <Popover
      label="Choose columns"
      align="end"
      trigger={(props) => (
        <Button {...props} variant="sec" size="sm" icon={Columns3} count={columns.length}>
          Columns
        </Button>
      )}
    >
      {() => (
        <div className={styles.keys}>
          {densityControl}
          {HANDOVER_COLUMNS.map((column) => (
            <Checkbox
              key={column.id}
              label={column.locked ? `${column.header}, always shown` : column.header}
              checked={columnIds.includes(column.id)}
              disabled={column.locked}
              onChange={() => {
                const next = columnIds.includes(column.id)
                  ? columnIds.filter((id) => id !== column.id)
                  : [...columnIds, column.id];
                setCustomColumns(HANDOVER_COLUMNS.map((c) => c.id).filter((id) => next.includes(id)));
              }}
            />
          ))}
          {customColumns !== null ? (
            <Button variant="ghost" size="sm" onClick={() => setCustomColumns(null)}>
              Back to {DENSITY_LABEL[density]}
            </Button>
          ) : null}
        </div>
      )}
    </Popover>
  );
  const chipControls = deskChips.map((chip) => (
    <FilterChip
      key={chip.id}
      pressed={chips.has(chip.id)}
      onPressedChange={() => toggleChip(chip.id)}
      count={rows.filter((row) => chip.test(row, now)).length}
    >
      {chip.label}
    </FilterChip>
  ));

  if (isPhoneWidth) {
    return (
      <main id="main-content" data-testid="ward-handover-page" data-ward-design="v6">
        <HandoverPhone
          shift={shift}
          onShift={setShift}
          now={now}
          scopeLabel={scopeLabel}
          groups={groups}
          rows={rows}
          wards={wards}
          ctx={ctx}
          pill={pill}
          onPill={togglePill}
          isHighlighted={isHighlighted}
          onClearHighlight={clearHighlight}
          signedAt={signedAt}
          onCopySummary={copySummary}
          copied={copied}
          onShowSignOff={showSignOff}
          onPick={pick}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
          flowPanel={flowPanel}
          signOffPanel={signOffPanel}
          outsideAct={scope.kind !== "network" ? outsideAct : []}
          selected={selected}
          onCopyIsbar={copyIsbar}
          patientHrefOf={(row) => (row.patientId ? patientHref(row.patientId) : undefined)}
          since={formatInstantWithDay(newSince, now)}
          sinceItems={sinceItems}
          carryOver={<HandoverOpenPromises referrals={referrals} units={units} now={now} layout="phone" />}
          onCopySince={copySince}
          chips={deskChips.map((chip) => ({
            id: chip.id,
            label: chip.label,
            count: rows.filter((row) => chip.test(row, now)).length,
            pressed: chips.has(chip.id),
            onToggle: () => toggleChip(chip.id),
          }))}
          meetingOn={meetingStartedAt !== null}
          onToggleMeeting={toggleMeeting}
          history={
            <HandoverHistory signOffs={handoverSignOffs} meetings={meetings} preparedAt={preparedAt} now={now} />
          }
        />
        <WardPrototypeFooter
          testId="ward-handover-governance"
          note="Synthetic data · Not approved for clinical use · Print copies carry their preparation time"
        />
      </main>
    );
  }

  const tabs = (
    <Tabs
      label="Handover views"
      idPrefix="ward-handover-tab"
      value={tab}
      onChange={(id) => {
        setTab(id);
        setSheetOpen(false);
      }}
      items={[
        { id: "pts", label: "Patients", count: rows.length },
        // ROLE BRANCH (ed): an ED holds no ward, so there is no Beds tab.
        ...(edDesk ? [] : [{ id: "beds" as const, label: "Beds", count: `${readyTotal} ready` }]),
        { id: "hist", label: "History" },
      ]}
    />
  );

  const shiftClock = formatInstantWithDay(shiftAt, now);
  const signOffButton = (
    <Button
      variant="light"
      size="sm"
      icon={StatusCheckIcon(signedAt !== null)}
      onClick={showSignOff}
      data-testid="ward-handover-hero-sign-off"
    >
      {signedAt !== null ? `Signed ${formatInstantWithDay(signedAt, now)}` : "Sign off"}
    </Button>
  );
  /*
   * v10 (build guide Handover): the title is the answer. NA2-01 (audit 24 Oct 2026): it counts every
   * row listed under Act now, Flagged urgent and Due by, the same sum the phone title uses
   * (`handover-phone.tsx`), so the two never disagree and an Act now row is never left out. The
   * eyebrow names the shift; five chips highlight rows; the foot holds the shift switch, the
   * countdown and the bed meter. Sign off is the one light primary.
   */
  const hero = (
    <Hero
      level={1}
      testId="ward-handover-hero"
      eyebrow={`Handover · ${shiftClock} ${shiftInfo.label}`}
      // H-0887: the page heading names the page, not only the count.
      title={
        <>
          <SrOnly>Handover:</SrOnly>{" "}
          {ownWard
            ? desk.peopleToHandOver(counts.act + counts.urg + counts.due)
            : `${counts.act + counts.urg + counts.due} to hand over`}
        </>
      }
      titleMeta={scopeLabel}
      aside={
        <>
          <LiveChip state="live" onHero />
          <Button
            variant="onHero"
            size="sm"
            icon={TimerIcon}
            aria-pressed={meetingStartedAt !== null}
            onClick={toggleMeeting}
          >
            {meetingStartedAt !== null ? <HandoverMeetingTimer startedAt={meetingStartedAt} /> : "Start meeting"}
          </Button>
          {/* Present and Print sit behind More, so the band carries one primary (device audit 11 Oct 2026). */}
          <Menu
            label="More handover actions"
            align="end"
            items={[
              {
                id: "present",
                label: present ? "Exit present" : "Present",
                icon: MonitorPlay,
                onSelect: () => setPresent((on) => !on),
              },
              {
                id: "print",
                label: "Print handover",
                icon: Printer,
                onSelect: () => setSheetOpen((open) => !open),
              },
            ]}
            trigger={(props) => (
              <Button {...props} variant="onHero" size="sm" icon={MoreHorizontal} data-testid="ward-handover-more">
                More
              </Button>
            )}
          />
          {/* With the rail beside the table its Sign off is the one; below 1201px the rail is a
              drawer and this opens it. */}
          {signOffInRail || tab === "pts" || edDesk ? null : signOffButton}
        </>
      }
      bar={
        <div
          className={styles.heroTools}
          data-testid="ward-handover-kpi-strip"
          role="group"
          aria-label="Handover counts"
        >
          {(ownWard ? desk.WARD_DESK_PILLS : desk.COORDINATOR_PILLS).map((id) => (
            <button
              key={id}
              type="button"
              className={styles.heroPill}
              aria-pressed={pill === id}
              aria-label={ownWard && id === "act" ? desk.actNowChipLabel(counts.act, actNowAlertCount) : undefined}
              onClick={() => togglePill(id)}
            >
              <span className={styles.heroPillCount}>{counts[id]}</span>
              <StatusGlyph tone={PILL_TONE[id]} size={9} />
              {id === "act" && ownWard
                ? "Act now"
                : id === "act"
                  ? `Act now (${counts.act} ${counts.act === 1 ? "person" : "people"}, ${actNowAlertCount} ${actNowAlertCount === 1 ? "alert" : "alerts"})`
                  : id === "urg"
                    ? "Flagged urgent"
                    : id === "due"
                      ? `Due by ${formatInstantWithDay(cutoff, now)}`
                      : id === "bed"
                        ? "Finding a ward"
                        : "Moving"}
            </button>
          ))}
        </div>
      }
      barAside={
        <button
          type="button"
          className={styles.heroChip}
          aria-expanded={sinceOpen}
          aria-controls="ward-handover-since"
          onClick={() => setSinceOpen((open) => !open)}
          data-testid="ward-handover-since-chip"
        >
          <Icon icon={Sparkles} size={14} />
          Changed since previous handover
          <span className={styles.heroCount}>{sinceTotal}</span>
        </button>
      }
      foot={
        <div className={styles.heroTools}>
          <HeroTrack
            label="Which handover"
            className={styles.shiftTrack}
            value={shift}
            onChange={setShift}
            items={HANDOVER_SHIFTS.map((option) => ({
              id: option.id,
              label: (
                <>
                  <b className={styles.shiftTime}>{formatInstantWithDay(handoverAt(option.id, now), now)}</b>
                  {option.label}
                </>
              ),
            }))}
          />
          <span className={styles.countdown}>
            <Icon icon={Clock} size={14} />
            {passed ? (
              <>
                Passed <b>{durMinutes(now - shiftAt)}</b> ago
              </>
            ) : (
              <>
                Starts in <b>{durMinutes(shiftAt - now)}</b>
              </>
            )}
          </span>
          {/* ROLE BRANCH (ed): the one quiet line on sign-off, beside the countdown it belongs to. */}
          {edDesk ? (
            <span className={styles.countdown} data-testid="ward-handover-sign-off-note">
              <Icon icon={Lock} size={14} />
              {signedAt !== null
                ? `Signed off ${formatInstantWithDay(signedAt, now)}`
                : "Coordinator or ward signs off"}
            </span>
          ) : null}
        </div>
      }
      // ROLE BRANCH (ward, ed): the statewide finding-a-ward meter is the coordinator's; a ward's ready
      // beds are its Beds tab's own count, and an ED holds no ward.
      footAside={
        ownWard || edDesk ? undefined : (
          <span className={styles.gap}>
            <span>
              <b>{readyTotal}</b> beds ready for <b>{counts.bed}</b> finding a ward
            </span>
            <span className={styles.gapBar} aria-hidden="true">
              {readyTotal > 0 ? <i className={styles.gapReady} style={{ flex: readyTotal }} /> : null}
              {counts.bed > readyTotal ? (
                <i className={styles.gapWaiting} style={{ flex: counts.bed - readyTotal }} />
              ) : null}
            </span>
          </span>
        )
      }
    />
  );

  const toolbar = (
    <div className={styles.toolbar}>
      {tabs}
      <span className={styles.toolbarNote}>
        {tab === "beds" ? "Ward feeds as recorded" : ownWard ? "" : "Scope narrows, chips only highlight"}
      </span>
      <Button variant="ghost" size="sm" icon={ClipboardCopy} onClick={copySummary}>
        {copied ? "Copied" : "Copy summary"}
      </Button>
      <Link href="/ward-flow/reports/downtime" className={buttonClass({ variant: "ghost", size: "sm" })}>
        Downtime pack
      </Link>
      {/* B4: act now and due before the next handover, as Delays' For handover view. */}
      <Link href={waitingHref("handover")} className={buttonClass({ variant: "ghost", size: "sm" })}>
        Open in Waiting
      </Link>
      <Popover
        label="Keyboard shortcuts"
        align="end"
        trigger={(props) => (
          <Button
            {...props}
            ref={(node: HTMLButtonElement | null) => {
              props.ref.current = node;
              keysTriggerRef.current = node;
            }}
            variant="sec"
            size="sm"
            iconOnly
            icon={Keyboard}
            aria-label="Keyboard shortcuts"
          />
        )}
      >
        {() => (
          <HandoverKeysHelp
            enabled={singleKeyShortcutsEnabled}
            onEnabledChange={setSingleKeyShortcutsEnabled}
            signOff={!edDesk}
          />
        )}
      </Popover>
    </div>
  );

  const pastBanner = passed ? (
    <div className={styles.banner} role="status">
      <StatusGlyph tone="neutral" size={9} />
      <span>
        The {formatInstantWithDay(shiftAt, now)} handover has passed
        {signedAt === null ? " and no sign-off was recorded" : ""}. The sheet shows the board now, with due times read
        to {formatInstantWithDay(cutoff, now)}.
      </span>
      <Button variant="ghost" size="sm" onClick={() => setTab("hist")}>
        History
      </Button>
      <Button variant="sec" size="sm" onClick={() => setShift(defaultHandoverShift(now))}>
        Go to {formatInstantWithDay(handoverAt(defaultHandoverShift(now), now), now)} handover
      </Button>
    </div>
  ) : null;

  const table = (
    <Card
      as="section"
      className={`${styles.tableCard} ${present ? styles.present : ""}`}
      aria-label="Handover sheet"
      data-testid="ward-handover-sheet"
    >
      <div className={styles.bar}>
        {scopeControl}
        {groupingControl}
        {sortControl}
        <span className={styles.spacer} />
        {columnsControl}
      </div>
      <div className={styles.bar}>
        <span className={styles.label}>Highlight</span>
        <div className={styles.chips}>{chipControls}</div>
      </div>
      {wardAllShown && !anyHighlight ? null : (
        <div className={styles.scopeLine} data-testid="ward-handover-scope-line">
          <StatusGlyph tone="neutral" size={8} />
          <span data-testid="ward-handover-scope-summary">
            Showing <b>{scopeLabel}</b>, <b>{rows.length}</b> of {allRows.length} open
          </span>
          {scope.kind !== "network" ? (
            <span data-testid="ward-handover-scope-excluded">
              {outside.length} outside this scope
              {outsideAct.length ? (
                <>
                  , <b className={styles.urgentOut}>{outsideAct.length} act now or flagged urgent</b> listed under the
                  sheet
                </>
              ) : (
                ", none act now or flagged urgent"
              )}
            </span>
          ) : null}
          {anyHighlight ? (
            <>
              <span className={styles.spacer} />
              <span>
                <b>{rows.filter(isHighlighted).length}</b> highlighted, all rows stay
              </span>
              <Button variant="ghost" size="sm" onClick={clearHighlight}>
                Clear
              </Button>
            </>
          ) : null}
        </div>
      )}
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Handover patients">
        <table
          className={cx(tableClasses.table, styles.sheetTable, compact && styles.compact, fitted && styles.fitted)}
        >
          <colgroup>
            {columns.map((column) => (
              <col
                key={column.id}
                style={{
                  width: fitted
                    ? `${((column.width / columns.reduce((sum, entry) => sum + entry.width, 0)) * 100).toFixed(2)}%`
                    : column.width,
                }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => {
            if (ownWard && group.rows.length === 0) return null;
            const isCollapsed = collapsed.has(group.id);
            return (
              <tbody key={group.id} data-testid={`ward-handover-group-${group.id}`}>
                <tr className={styles.groupRow}>
                  <td colSpan={columns.length}>
                    <button
                      type="button"
                      className={styles.groupButton}
                      aria-expanded={!isCollapsed}
                      onClick={() =>
                        setCollapsed((current) => {
                          const next = new Set(current);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        })
                      }
                    >
                      <ChevronDown size={14} aria-hidden="true" />
                      {group.tone ? <StatusGlyph tone={GROUP_TONE[group.tone]} size={9} /> : null}
                      <span>{group.title}</span>
                      <span className={styles.groupCount}>{group.rows.length}</span>
                      <span className={styles.why}>{group.rows.length === 0 ? "None" : group.why}</span>
                    </button>
                  </td>
                </tr>
                {isCollapsed
                  ? null
                  : (group.id === "due" && !dueAll ? group.rows.slice(0, DUE_FIRST) : group.rows).map((row) => {
                      const isSelected = row.id === selectedId;
                      return (
                        <tr
                          key={row.id}
                          data-row-id={row.id}
                          tabIndex={0}
                          aria-selected={isSelected}
                          className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                          data-highlighted={isHighlighted(row) ? "true" : undefined}
                          data-dim={anyHighlight && !isHighlighted(row) ? "true" : undefined}
                          data-act={isActOrUrgent(row, now) ? "true" : undefined}
                          onClick={() => pick(row.id)}
                          onKeyDown={(event: ReactKeyboardEvent<HTMLTableRowElement>) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              pick(row.id);
                            }
                          }}
                        >
                          {columns.map((column) => (
                            <td key={column.id}>{column.cell(row, ctx)}</td>
                          ))}
                        </tr>
                      );
                    })}
                {group.id === "due" && !isCollapsed ? (
                  <ShowMoreRow
                    hidden={group.rows.length - DUE_FIRST}
                    span={columns.length}
                    open={dueAll}
                    what={`due by ${shiftClock}`}
                    onToggle={() => setDueAll((all) => !all)}
                  />
                ) : null}
              </tbody>
            );
          })}
        </table>
      </div>
      {scope.kind !== "network" && outsideAct.length ? (
        <div className={styles.tableFoot} data-testid="ward-handover-urgent-outside-filter">
          <StatusGlyph tone="danger" size={9} />
          <b>Act now or flagged urgent outside this scope</b>
          {outsideAct.map((row) => (
            <Button key={row.id} variant="ghost" size="sm" onClick={() => pick(row.id)}>
              {row.name} <span className={styles.mono}>{row.umrn}</span>
            </Button>
          ))}
        </div>
      ) : null}
      {ownWard ? <desk.WardDeskEmptyGroups groups={groups} /> : null}
      <div className={styles.tableFoot}>
        <StatusGlyph tone="neutral" size={8} />
        <span>Form times are as typed, not legally checked</span>
        <span className={styles.spacer} />
        <span>{wide ? "The patient opens in a drawer" : "J and K step through patients"}</span>
      </div>
    </Card>
  );

  let body;
  if (sheetOpen) {
    body = (
      <HandoverPrintSheet
        groups={groups}
        columns={columns}
        ctx={ctx}
        wards={wards}
        held={held}
        outsideAct={scope.kind !== "network" ? outsideAct : []}
        isHighlighted={isHighlighted}
        anyHighlight={anyHighlight}
        scopeLabel={scopeLabel}
        shiftLabel={`${shiftInfo.label}, ${formatInstantWithDay(shiftAt, now)}`}
        densityLabel={customColumns === null ? DENSITY_LABEL[density] : "Chosen"}
        dayZero={dayZero}
        options={printOptions}
        onOptionsChange={setPrintOptions}
        controls={
          <>
            {scopeControl}
            {densityControl}
            {groupingControl}
            {sortControl}
          </>
        }
        highlightControls={<div className={styles.chips}>{chipControls}</div>}
        onOpenPatient={(id) => {
          setSheetOpen(false);
          setTab("pts");
          pick(id);
        }}
        onBack={() => setSheetOpen(false)}
        onPrintPrepared={(at) => setPreparedAt(at)}
        preparedAt={preparedAt}
        now={now}
      />
    );
  } else if (tab === "beds") {
    body = (
      <TabPanel idPrefix="ward-handover-tab" id="beds">
        <HandoverBeds
          rows={rows}
          wards={wards}
          held={held}
          now={now}
          waitingForBed={counts.bed}
          onOpenPatient={(id) => {
            setTab("pts");
            pick(id);
          }}
        />
        <LongStaySummary
          admissions={admissions.filter((admission) => wards.some((ward) => ward.id === admission.unitId))}
          bedReleases={bedReleases}
          now={now}
          nameFor={(admission) => resolveAdmissionPatient(admission, patients, referrals).name}
          wardFor={(unitId) => wardOf(unitId)?.name ?? "Ward not recorded"}
        />
      </TabPanel>
    );
  } else if (tab === "hist") {
    body = (
      <TabPanel idPrefix="ward-handover-tab" id="hist">
        <HandoverHistory signOffs={handoverSignOffs} meetings={meetings} preparedAt={preparedAt} now={now} />
      </TabPanel>
    );
  } else if (portrait) {
    const signedLine = signedAt !== null ? `Signed ${formatInstantWithDay(signedAt, now)}` : null;
    const checksDone = signChecks.filter((check) => check.done).length;
    body = (
      <TabPanel idPrefix="ward-handover-tab" id="pts">
        <div className={styles.portraitTools}>
          <span className={styles.portraitNote}>
            <b>{rows.length}</b> of {allRows.length} open · {scopeLabel}
          </span>
          {portraitRail(signedLine, checksDone)}
        </div>
        <PortraitList
          label="Handover patients"
          onOpen={pick}
          groups={groups.map((group) => ({
            id: group.id,
            title: group.title,
            tone: group.tone ? GROUP_TONE[group.tone] : undefined,
            note: group.rows.length === 0 ? undefined : group.why,
            rows: group.rows.map((row) => {
              const next = nextStep(row, now, cutoff, readyBeds);
              return {
                id: row.id,
                name: row.name,
                sub: `${row.umrn} · T${row.tier} · ${STAGE_LABEL[row.stage]}`,
                figure: durMinutes(now - row.openedAt),
                figureNote: "waiting",
                tone: rowTone(row, ctx),
                next: next.text,
                actNow: isActOrUrgent(row, now),
                selected: row.id === selectedId,
                dim: anyHighlight && !isHighlighted(row),
              };
            }),
          }))}
          footer={<span>Form times are as typed, not legally checked</span>}
        />
      </TabPanel>
    );
  } else {
    body = (
      <TabPanel idPrefix="ward-handover-tab" id="pts">
        <div className={`${styles.split} ${wide || !(flowPanel ?? signOffPanel) ? styles.splitFull : ""}`}>
          {table}
          {wide || !(flowPanel ?? signOffPanel) ? null : (
            <aside className={styles.side} aria-label={selected ? "Patient flow" : "Sign off"} data-wf-rail="1201">
              {flowPanel ?? signOffPanel}
            </aside>
          )}
        </div>
      </TabPanel>
    );
  }

  const sinceStrip = sinceOpen ? (
    <div id="ward-handover-since">
      <SinceLine since={formatInstantWithDay(newSince, now)} items={sinceItems} />
    </div>
  ) : null;
  // One Sign off on screen: the bar shows only when the rail's own panel is not beside the table.
  const signBar =
    tab === "pts" && !sheetOpen && !signOffInRail && !edDesk ? (
      <SignOffBar
        title={`${shiftClock} handover`}
        checks={signChecks}
        signedLine={signedAt !== null ? `Signed ${formatInstantWithDay(signedAt, now)}` : null}
        cannotSignReason={canSignOff ? undefined : cannotSignReason}
        onSignOff={handleSignOff}
        onOpenPanel={showSignOff}
      />
    ) : null;

  return (
    <main
      ref={shortcutScopeRef}
      id="main-content"
      className={styles.page}
      data-testid="ward-handover-page"
      data-ward-design="v6"
    >
      {hero}
      {pastBanner}
      {sheetOpen ? null : sinceStrip}
      {sheetOpen ? null : <HandoverOpenPromises referrals={referrals} units={units} now={now} />}
      {sheetOpen ? null : toolbar}
      {body}
      {signBar}
      {wide && !portrait ? (
        <Drawer
          open={drawerOpen && (flowPanel ?? signOffPanel) !== null}
          onClose={() => setDrawerOpen(false)}
          title={selected ? selected.name : "Sign off"}
        >
          {flowPanel ?? signOffPanel}
        </Drawer>
      ) : null}
      <WardPrototypeFooter
        testId="ward-handover-governance"
        note="Synthetic data · Not approved for clinical use · Print copies carry their preparation time"
      />
    </main>
  );
}
