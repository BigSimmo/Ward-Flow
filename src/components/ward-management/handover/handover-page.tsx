"use client";
import { useCharacterShortcutsPreference } from "@/components/ward-management/shell/ward-character-shortcuts";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ChevronDown,
  ClipboardCopy,
  SlidersHorizontal,
  Keyboard,
  MonitorPlay,
  Printer,
  FileText,
  Share2,
} from "lucide-react";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen, isStoppedTransportAwaitingRelease } from "@/components/ward-management/ward-derivations";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { accessIsWholeNetwork, unitInScope } from "@/components/ward-management/ward-role-access";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { useWardPartialDisplay, useWardPartialDisplayHost } from "@/components/ward-management/ward-partial-view";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  Drawer,
  FilterChip,
  FolderTabs,
  Hero,
  HeroAct,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  heroChipClassName,
  folderTabClasses,
  Icon,
  Menu,
  Popover,
  PortraitList,
  PortraitRail,
  Segmented,
  StatusGlyph,
  TabPanel,
  Tabs,
  cx,
  durMinutes,
  tableClasses,
  useIsPhone,
  useIsTabletPortrait,
  useMediaQuery,
  SrOnly,
  AppliedFilter,
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
  defaultHandoverShift,
  openingHandoverShift,
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
  handoverStatusLabel,
  nextStep,
  type HandoverChip,
  type HandoverGrouping,
  type HandoverPill,
  type HandoverRow,
  type HandoverShiftId,
  type HandoverSort,
  type HeldHandover,
} from "./handover-model";
import {
  HandoverFlowPanel,
  HandoverSignOffPanel,
  HandoverSiteSignOffSlot,
  signOffSignerLabel,
} from "./handover-panels";
import { handoverSignOffChecks, sheetSignOff } from "./handover-sign-off-checks";
import { HandoverKeysHelp, ShowMoreRow, handoverMeetingMinutes, signOffWaitReason } from "./handover-sheet-parts";
import * as desk from "./handover-desk";
import { HandoverBeds } from "./handover-beds";
import { LongStaySummary } from "./long-stay-summary";
// Closing-the-loop package A (24 Oct 2026): open promises and callbacks carried over.
import { HandoverOpenPromises, promisesHeroAct, promisesPhoneAct, useCarerDue } from "./handover-open-promises";
import {
  HandoverMeetingChip,
  HandoverShiftMenu,
  HandoverSignOffChip,
  HandoverSinceLine,
  actNowLabel,
} from "./handover-glance";
import pageTop from "../page-top-title.module.css";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { screenColumnsFor } from "./handover-screen-columns";
import { DEFAULT_PRINT_OPTIONS, HandoverPrintSheet } from "./handover-print-sheet";
import { HandoverPhone } from "./handover-phone";
import { BeforeHandoverReview } from "@/components/ward-management/review/todays-review-screen";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import styles from "./handover-refined.module.css";

import { NETWORK_SCOPE_VALUE, handoverScopeValue, parseHandoverScope } from "./handover-scope";
import { HandoverChoiceMenu, HandoverHistory, HandoverScopeControl } from "./handover-page-parts";
import {
  allRecordsScopeLabel,
  handoverScopeLabel,
  movementInHandoverScope,
  handoverSignOffUnitId,
  recordHandoverSignOff,
  resolveAdmissionPatient,
} from "./handover-scope-rules";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { HandoverDigestSlot, useHandoverDigestOpen } from "./handover-digest-slot";
import { handoverSinceItems } from "./handover-since-items";
import { useDigestNight } from "./handover-digest-first-look";
import { useClockZoneLabel } from "@/components/ward-management/use-clock-zone-label";

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

/** "Meeting order" from "Group: meeting order", for the arrange button and the Group menu. */
function groupingName(id: HandoverGrouping): string {
  return GROUPING_LABEL[id].replace("Group: ", "").replace(/^./, (first) => first.toUpperCase());
}

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
  const canOpenHref = useCanOpenHref();
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
    staffRequests,
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
    "staffRequests",
  );
  const now = useWardFlowClock();
  const router = useRouter();
  const zone = useClockZoneLabel();
  const carerDue = useCarerDue(now).length; // batch 3 item 23: carer call backs join the promises count
  const partialDisplay = useWardPartialDisplay();
  const partialHost = useWardPartialDisplayHost();
  const access = useEffectiveWardAccess();
  // Role branches: the nurse in charge's one ward (no scope picker, empty groups folded), and the ED
  // clinician's own department (no Beds tab, no bed counts, no sign-off).
  const { ownWard, edDesk, edName } = desk.handoverDeskOf(access, units);
  const allRecordsLabel = ownWard?.name ?? edName ?? allRecordsScopeLabel(access);
  // Page scores 16 Nov 2026 (Other prints, +3): an A4 page is phone-narrow, so a plain browser Print
  // swapped in the phone tree and printed almost nothing. While printing, the screen keeps the
  // desktop table, which prints every group.
  const printing = useMediaQuery("print");
  const isPhoneWidth = useIsPhone() && !printing;
  const isTabletPortrait = useIsTabletPortrait() && !printing;
  /* iPad portrait (820px, device audit 11 Oct 2026): list rows and the rail as a slide-over. */
  const portrait = isTabletPortrait && !isPhoneWidth;

  /* scope, read once from the URL */
  const searchParams = useSearchParams();
  const headerService = useServiceScope();
  const [scopeValue, setScopeValue] = useState<string>(() => {
    const requested = searchParams?.get("scope")?.trim();
    // Audit two (#64): with no link, the header's service is the scope; the menu only narrows it.
    if (requested === undefined || requested.length === 0)
      return headerService === null ? NETWORK_SCOPE_VALUE : handoverScopeValue({ kind: "service", id: headerService });
    // A link naming a ward, ED or team that does not exist falls back to the whole network: a
    // quiet empty sheet is the dangerous direction on a handover.
    const parsed = parseHandoverScope(requested);
    return handoverScopeLabel(parsed, units) === undefined ? NETWORK_SCOPE_VALUE : handoverScopeValue(parsed);
  });
  const scope = useMemo(() => parseHandoverScope(scopeValue), [scopeValue]);
  const scopeLabel = handoverScopeLabel(scope, units, allRecordsLabel) ?? allRecordsLabel;

  /* which handover */
  // Audit TC2-02: held as the instant it meant when chosen, so midnight cannot move it.
  const [heldChoice, setHeldChoice] = useState<HeldHandover>(() => holdHandover(openingHandoverShift(now), now));
  const { id: shift, at: shiftAt } = currentHeldHandover(heldChoice, now);
  const setShift = (id: HandoverShiftId) => setHeldChoice(holdHandover(id, now));
  const shiftInfo = handoverShift(shift);
  const passed = shiftAt <= now;
  const cutoff = heldHandoverCutoff(shiftAt, now);
  const newSince = heldHandoverNewSince(shiftAt, now);

  /* view state */
  const [tab, setTab] = useState<HandoverTab>("pts");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [phoneBedsAsk, setPhoneBedsAsk] = useState(0);
  const [promisesOpen, setPromisesOpen] = useState(false); // Note 12: hero strip opens the promises card
  // Feature 15: the Shift digest; `?digest=1` (the rail's "Read digest" near handover) opens it.
  const [digestOpen, setDigestOpen] = useHandoverDigestOpen(searchParams?.get("digest") === "1");
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
  // The board instant the meeting started: the chip and History both measure from it (C9, CC-6).
  const [meetingStartedAt, setMeetingStartedAt] = useState<Instant | null>(null);
  const [meetings, setMeetings] = useState<{ at: Instant; minutes: number }[]>([]);
  const [preparedAt, setPreparedAt] = useState<Instant | null>(null);
  const [printOptions, setPrintOptions] = useState(DEFAULT_PRINT_OPTIONS);
  const [copied, setCopied] = useState(false);
  const [singleKeyShortcutsEnabled, setSingleKeyShortcutsEnabled] = useCharacterShortcutsPreference();
  const shortcutScopeRef = useRef<HTMLElement | null>(null);
  const keysTriggerRef = useRef<HTMLButtonElement | null>(null);
  const signOffRef = useRef<HTMLDivElement | null>(null);
  const focusDepartedNotice = useCallback((node: HTMLParagraphElement | null) => node?.focus(), []);

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
        .map((movement) => {
          const sender = partialDisplay?.movements.find((row) => row.id === movement.id);
          return {
            ...toHandoverRow(
              movement,
              units,
              patients,
              referrals,
              admissions,
              sender?.kind === "sender" ? sender : partialHost.senderRequired ? null : undefined,
            ),
            actNow: actNowMovementIds.has(movement.id),
          };
        }),
    [movements, units, patients, referrals, admissions, partialDisplay, partialHost.senderRequired, actNowMovementIds],
  );
  const rows = useMemo(
    () => allRows.filter((row) => movementInHandoverScope(row.movement, scope, units, referrals, admissions)),
    [allRows, scope, units, referrals, admissions],
  );
  const outside = useMemo(
    () => allRows.filter((row) => !movementInHandoverScope(row.movement, scope, units, referrals, admissions)),
    [allRows, scope, units, referrals, admissions],
  );
  const deskPlaces = useMemo(() => wardPlaceLookup(units), [units]);
  const allWards = useMemo(
    () => units.map((unit) => toHandoverWard(unit, admissions, now, bedReleases, [...movements, ...referrals])),
    [units, admissions, now, bedReleases, movements, referrals],
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
  // The ward's Ready figure, which already leaves out beds still being made ready (D-179 item 8).
  const readyBeds = useCallback(
    (unitId: string) => {
      const ward = wardOf(unitId);
      return ward ? ward.ready : 0;
    },
    [wardOf],
  );
  const thresholds = useDueSoonThresholds();
  const ctx: ColumnContext = useMemo(
    // D-254: while the browser prints this screen, legal form times take the 24-hour sheet face.
    () => ({ now, cutoff, readyBeds, dayZero, thresholds, face: printing ? ("sheet" as const) : ("screen" as const) }),
    [now, cutoff, readyBeds, dayZero, thresholds, printing],
  );

  /* highlight, never hide */
  const anyHighlight = pill !== null || chips.size > 0;
  const isHighlighted = useCallback(
    (row: HandoverRow) => {
      if (pill === null && chips.size === 0) return false;
      if (pill !== null && !pillTest(pill, row, now, cutoff, newSince)) return false;
      for (const chip of chips) {
        const definition = HANDOVER_CHIPS.find((candidate) => candidate.id === chip);
        if (definition && !definition.test(row, now, access.role === "admin" ? undefined : access.role)) return false;
      }
      return true;
    },
    [pill, chips, now, cutoff, newSince, access.role],
  );
  const groups = useMemo(() => groupRows(rows, grouping, sort, now, cutoff), [rows, grouping, sort, now, cutoff]);
  const visibleOrder = useMemo(
    () => groups.filter((group) => !collapsed.has(group.id)).flatMap((group) => group.rows),
    [groups, collapsed],
  );

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

  // Changes since the preceding handover boundary (`handover-since-items.ts`).
  const sinceItems = useMemo(
    () => handoverSinceItems({ admissions, wards, units, rows, scopeKind: scope.kind, newSince, now, edDesk }),
    [admissions, wards, units, rows, scope.kind, newSince, now, edDesk],
  );
  const night = useDigestNight(digestOpen, sinceItems, { admissions, wards, units, rows, scope, now, edDesk });
  // L1 (site review, 12 Oct 2026): the chip counts each change once. "New act now" rows are already
  // among "new on the sheet", so adding them again made the chip read 35 beside a strip of 0, 1, 32.
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
  // iPad landscape (1001px and up) fits the Standard columns to the card too, so Next step is not cut
  // at the card edge behind a sideways scroll (layout sweep 25 Oct 2026).
  // While printing, the table fits the paper the same way it fits a wide card (page scores 16 Nov).
  const fitsCard = useMediaQuery("(min-width: 62.5625rem)") || printing;
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
  const compact = customColumns === null && density === "min";

  /* selection */
  const selected = selectedId === null ? undefined : allRows.find((row) => row.id === selectedId);
  // Drawer review (6 Nov 2026): a patient's flow opens in the kit drawer at every width.
  const pick = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };
  const step = useCallback(
    (direction: 1 | -1) => {
      if (visibleOrder.length === 0) return;
      const index = visibleOrder.findIndex((row) => row.id === selectedId);
      const next = index < 0 ? 0 : Math.max(0, Math.min(visibleOrder.length - 1, index + direction));
      const id = visibleOrder[next]!.id;
      setSelectedId(id);
      // The drawer owns the selection at every width, so the table row behind it is not revealed:
      // scrolling it would move the locked background behind the drawer.
      setDrawerOpen(true);
    },
    [visibleOrder, selectedId, setDrawerOpen],
  );

  /* sign-off */
  const routeRole = useRouteRole();
  const gate = useRoleGate();
  const signOffGate = gate("RECORD_HANDOVER_SIGN_OFF");
  // Lead-REC-E-1: like the ED desk, a desk that can never sign this handover off (the site bed
  // manager, which signs its site's handover off instead) is not offered the chip, panel or S key.
  const noWardSignOff = edDesk || signOffGate.never === true;
  // Decision 41 (Josh, 31 Oct 2026): a sign-off names its sheet's ward: a one-ward desk's own ward,
  // or the scope's ward when the desk holds it (a link never signs another ward's sheet). A wider
  // sheet's sign-off names none.
  const scopedWard = handoverSignOffUnitId(scope);
  const signOffUnitId =
    ownWard?.id ??
    (scopedWard !== undefined && (accessIsWholeNetwork(access) || unitInScope(access.scope, scopedWard, deskPlaces))
      ? scopedWard
      : undefined);
  const { signedAt, signedBy } = useMemo(
    () => sheetSignOff(handoverSignOffs, shiftAt, signOffUnitId),
    [handoverSignOffs, shiftAt, signOffUnitId],
  );
  const historyProps = { signOffs: handoverSignOffs, meetings, preparedAt, now, unitId: signOffUnitId };
  // Only a whole-network desk signs off a wider sheet; any other desk is sent back only its own
  // wards' sign-offs, so it signs off one ward's sheet at a time.
  const chooseWardFirst = !accessIsWholeNetwork(access) && signOffUnitId === undefined;
  // v10 pass 3: the sign-off is recorded at once and Undo takes it back (UNDO_HANDOVER_SIGN_OFF).
  const { run: runStep } = useUndoableStep({
    dispatch,
    rejections,
    now,
    routeRole,
    onMessage: announceToWardShell,
  });
  // D-179 Question 6: the sign-off records how many checks were still open (set below, with the checks).
  const openChecksRef = useRef(0);
  const handleSignOff = useCallback(() => {
    // Records contain role and time only, so only the current sign-off window can be signed.
    if (!signOffGate.allowed || chooseWardFirst) return;
    if (shiftAt <= now || shiftAt !== handoverAt(defaultHandoverShift(now), now)) return;
    const recorded = recordHandoverSignOff(
      (event) =>
        runStep(event, {
          // Audit S-31: one short toast; the panel's own line carries the time and the record.
          success: "Handover signed off",
          undo: (at) => ({ type: "UNDO_HANDOVER_SIGN_OFF", role: routeRole, now: at, unitId: signOffUnitId }),
          undone: "Undone: Handover signed off",
        }),
      now,
      routeRole,
      signOffUnitId,
      accessIsWholeNetwork(access),
      openChecksRef.current,
    );
    if (recorded === null) announceToWardShell("Sign-off is not recorded.");
  }, [runStep, now, routeRole, shiftAt, signOffGate.allowed, chooseWardFirst, signOffUnitId, access]);
  const handleUndoSignOff = useCallback(() => {
    runStep(
      { type: "UNDO_HANDOVER_SIGN_OFF", role: routeRole, now, unitId: signOffUnitId },
      { success: "Undone: Handover signed off" },
    );
  }, [runStep, now, routeRole, signOffUnitId]);
  const showSignOff = () => {
    setSheetOpen(false);
    setTab("pts");
    setSelectedId(null);
    setDrawerOpen(true);
    window.requestAnimationFrame(() => signOffRef.current?.querySelector<HTMLElement>("button")?.focus());
  };

  /* meeting timer: session only, the length goes to History */
  // Time audit C9 (13 Nov 2026): the length is measured on the board clock, the clock History shows
  // it against, so a moved demo clock does not stamp a real-time length with a board time.
  const toggleMeeting = useCallback(() => {
    if (meetingStartedAt === null) {
      setMeetingStartedAt(now);
      return;
    }
    const minutes = handoverMeetingMinutes(meetingStartedAt, now);
    setMeetings((list) => [{ at: now, minutes }, ...list]);
    setMeetingStartedAt(null);
    announceToWardShell(`Meeting took ${minutes} min. Added to History.`);
  }, [meetingStartedAt, now]);

  /* copy */
  const shiftLine = `${shiftInfo.label.toLowerCase()}, ${formatInstantWithDay(shiftAt, now)}`;
  const copySummary = useCallback(() => {
    const text = summaryText(groups, scopeLabel, shiftLine, now, now, zone, dayZero);
    void copyTextToClipboard(text).then(
      () => {
        setCopied(true);
        announceToWardShell(`Summary copied, ${rows.length} synthetic patients.`);
      },
      () => announceToWardShell("Copy was blocked by the browser."),
    );
  }, [groups, scopeLabel, shiftLine, now, zone, dayZero, rows.length]);
  const copyIsbar = useCallback(
    (row: HandoverRow) => {
      void copyTextToClipboard(isbarText(row, now, readyBeds, dayZero)).then(
        () => announceToWardShell(`ISBAR for ${row.name} copied.`),
        () => announceToWardShell("Copy was blocked by the browser."),
      );
    },
    [now, readyBeds, dayZero],
  );

  /* keyboard */
  const showSignOffRef = useRef(showSignOff);
  useEffect(() => {
    showSignOffRef.current = showSignOff;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A key the shell used (G's letter opened a page) or typed in an open menu is never a shortcut.
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || (event.target instanceof Element && event.target.closest('[role="menu"]')))
        return;
      const key = event.key.toLowerCase();
      // J and K keep stepping through the list while the patient flow drawer is open (drawer review,
      // 6 Nov 2026); every other letter waits until the dialog closes.
      const flowDrawer = document.querySelector('[data-testid="ward-handover-flow-panel"]');
      const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
      const steppingInFlow = modal !== null && modal === flowDrawer && (key === "j" || key === "k");
      if (modal && event.key !== "Escape" && !steppingInFlow) return;
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
      const inScope =
        active === null ||
        active === document.body ||
        shortcutScopeRef.current?.contains(active) ||
        (steppingInFlow && flowDrawer.contains(active));
      if (!singleKeyShortcutsEnabled || isPhoneWidth || !inScope) return;
      if (key === "p") {
        event.preventDefault();
        setSheetOpen(true);
      } else if (key === "s" && !noWardSignOff) {
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
    noWardSignOff,
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
    // Audit four item 20: the phone's amber check gets its step too, opening the phone's Beds tab.
    onCheckBeds: isPhoneWidth
      ? () => {
          setDrawerOpen(false);
          setPhoneBedsAsk((n) => n + 1);
        }
      : () => {
          setDrawerOpen(false);
          setTab("beds");
        },
    // Audit three #29: each unmet item carries its own step.
    onPrint: isPhoneWidth
      ? undefined
      : () => {
          setDrawerOpen(false);
          setSheetOpen(true);
        },
    onStartMeeting: meetingStartedAt === null ? () => toggleMeeting() : undefined,
    // Gate r10 (call 12, flip): the phone has no print step, so it shows no amber print row either.
    printable: !isPhoneWidth,
  });
  const openCheckCount = signChecks.filter((check) => !check.done).length;
  useEffect(() => {
    openChecksRef.current = openCheckCount;
  }, [openCheckCount]);
  const nextShift = shiftAt === handoverAt(defaultHandoverShift(now), now);
  const canSignOff = signOffGate.allowed && !passed && nextShift && !chooseWardFirst;
  const cannotSignReason =
    signOffGate.reason ??
    signOffWaitReason(passed, nextShift) ??
    (chooseWardFirst ? "Choose a ward to sign off its handover." : undefined);

  // ROLE BRANCH (ed): an ED desk never signs a handover off (RECORD_HANDOVER_SIGN_OFF is coordinator
  // or ward only), so the checklist, rail, bar, hero button and S shortcut are left out (Josh, 30 Oct
  // 2026). One quiet line in the hero foot says who signs off, or when it was signed.
  const signOffPanel = noWardSignOff ? null : (
    <div ref={signOffRef}>
      <HandoverSignOffPanel
        // Audit three #29: the drawer is titled Sign off, so the card names only the handover.
        title={`${formatInstantWithDay(shiftAt, now)} handover`}
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
  // Audit four item 37: on a tablet or desktop Sign off is a small kit dialog, the five checks in its
  // body and the filled Sign off in its foot. The phone keeps its short sheet (`signOffPanel`).
  const signOffDialogBody = noWardSignOff ? null : (
    <>
      <HandoverSignOffPanel
        inDialog
        title={`${formatInstantWithDay(shiftAt, now)} handover`}
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
    </>
  );
  const signOffSigner = signOffSignerLabel(signedAt, signedBy, routeRole);
  const departedPanel =
    selectedId !== null && !selected ? (
      <p ref={focusDepartedNotice} role="status" tabIndex={-1}>
        This journey is no longer open in Handover. Check the patient record for its latest status.
      </p>
    ) : null;
  const flowPanel = selected ? (
    <HandoverFlowPanel
      open={drawerOpen}
      row={selected}
      ctx={ctx}
      wardOf={wardOf}
      openPatientHref={selected.patientId ? patientHref(selected.patientId) : undefined}
      onClose={() => {
        setSelectedId(null);
        setDrawerOpen(false);
      }}
      onCopyIsbar={copyIsbar}
      onStep={step}
      position={{ index: visibleOrder.findIndex((row) => row.id === selected.id), total: visibleOrder.length }}
    />
  ) : null;

  /* iPad portrait: sign off (or a journey that has left) as a slide-over. The open patient has its
     own drawer at every width (drawer review, 6 Nov 2026), so an ED desk, with no sign-off rest
     state, shows this rail only for a journey that has left. */
  // Audit four item 37: Sign off opens its small dialog at 820 too, so the slide-over is left for a
  // journey that has left.
  const portraitRail = () =>
    !departedPanel ? null : (
      <PortraitRail
        title="Journey no longer open"
        summary="Check the patient record"
        open={drawerOpen && !selected}
        onOpenChange={(open) => {
          // The trigger opens the rest state (sign off); closing returns to it.
          setSelectedId(null);
          setDrawerOpen(open);
        }}
      >
        {departedPanel}
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
  const groupingMenu = (context?: string) => (
    <HandoverChoiceMenu
      label="Group by"
      context={context}
      value={grouping}
      choices={(Object.keys(GROUPING_LABEL) as HandoverGrouping[]).map((id) => ({ id, label: groupingName(id) }))}
      onChange={(id) => setGrouping(id as HandoverGrouping)}
    />
  );
  const sortMenu = (context?: string) => (
    <HandoverChoiceMenu
      label="Sort"
      context={context}
      value={sort}
      choices={(Object.keys(SORT_LABEL) as HandoverSort[]).map((id) => ({ id, label: SORT_LABEL[id] }))}
      onChange={(id) => setSort(id as HandoverSort)}
    />
  );
  const groupingControl = groupingMenu("Group");
  const sortControl = sortMenu("Sort");
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
  const chipControls = deskChips.map((chip) => (
    <FilterChip
      key={chip.id}
      pressed={chips.has(chip.id)}
      onPressedChange={() => toggleChip(chip.id)}
      count={rows.filter((row) => chip.test(row, now, access.role === "admin" ? undefined : access.role)).length}
    >
      {chip.label}
    </FilterChip>
  ));

  const activeHighlights = deskChips.filter((chip) => chips.has(chip.id)).length + (pill !== null ? 1 : 0);
  const viewControl = (
    <Popover
      label="Arrange the sheet"
      align="end"
      trigger={(props) => (
        <Button
          {...props}
          variant="ghost"
          size="sm"
          icon={SlidersHorizontal}
          count={activeHighlights > 0 ? activeHighlights : undefined}
          className={activeHighlights > 0 ? styles.barOn : undefined}
          data-testid="ward-handover-arrange"
        >
          Arrange
        </Button>
      )}
    >
      {() => (
        <div className={styles.viewPanel}>
          {/* Audit three #59: Highlight and the grouping join Arrange, one control for the one list. */}
          <span className={styles.viewHead}>Highlight rows</span>
          <div className={styles.hlChips}>{chipControls}</div>
          {/* Audit two (#63): Group, Sort and Detail are the sheet's three arrangements, one labelled row each. */}
          <div className={styles.viewRow}>
            <span className={styles.viewLabel}>Group</span>
            {groupingMenu()}
          </div>
          <div className={styles.viewRow}>
            <span className={styles.viewLabel}>Sort</span>
            {sortMenu()}
          </div>
          <div className={styles.viewRow}>
            <span className={styles.viewLabel}>Detail</span>
            {densityControl}
          </div>
          <span className={styles.viewHead}>Columns</span>
          <div className={styles.viewCols}>
            {HANDOVER_COLUMNS.filter((column) => !column.locked).map((column) => (
              <Checkbox
                key={column.id}
                label={column.header}
                checked={columnIds.includes(column.id)}
                onChange={() => {
                  const next = columnIds.includes(column.id)
                    ? columnIds.filter((id) => id !== column.id)
                    : [...columnIds, column.id];
                  setCustomColumns(HANDOVER_COLUMNS.map((c) => c.id).filter((id) => next.includes(id)));
                }}
              />
            ))}
          </div>
          {customColumns !== null ? (
            <Button variant="ghost" size="sm" onClick={() => setCustomColumns(null)}>
              Back to {DENSITY_LABEL[density]}
            </Button>
          ) : null}
        </div>
      )}
    </Popover>
  );

  const longest = rows.reduce<HandoverRow | null>(
    (best, row) => (best === null || row.openedAt < best.openedAt ? row : best),
    null,
  );
  // Feature 15: the Shift digest reads the hero's own figures, so the two never disagree.
  const digestSheet = (
    <HandoverDigestSlot
      input={
        digestOpen
          ? {
              now,
              shiftLabel: shiftInfo.label,
              shiftAt,
              cutoff,
              sinceAt: newSince,
              scopeLabel,
              ...night, // item 11: since items, widened to the night on the first morning read
              counts,
              referrals,
              units,
              admissions,
              scopedMovements: rows.map((row) => row.movement),
              staffRequestRecords: staffRequests ?? [],
              // An ED or team handover covers no ward's staffing, so it counts no staff requests.
              wardIds: scope.kind === "ed" || scope.kind === "team" ? [] : wards.map((ward) => ward.id),
              beds: ownWard || edDesk ? null : { ready: readyTotal, needed: counts.bed },
              longest: longest && { movementId: longest.id, openedAt: longest.openedAt, place: longest.edShort },
            }
          : null
      }
      onClose={() => setDigestOpen(false)}
      onAction={(action) => {
        setSheetOpen(false);
        setTab("pts");
        if (action.kind === "pill") setPill(action.pill);
        else if (action.kind === "patient") pick(action.movementId);
        else setPromisesOpen(true);
      }}
    />
  );
  // Batch 3: the review block is the coordinator's, the one desk that opened Today's review.
  const showReview = canOpenHref("/bedchart/review");
  const siteSignOff = <HandoverSiteSignOffSlot phone={isPhoneWidth} onScope={setScopeValue} />;
  if (isPhoneWidth) {
    return (
      <main id="main-content" data-testid="ward-handover-page" data-ward-design="v6">
        <HandoverPhone
          shift={shift}
          onShift={setShift}
          now={now}
          groups={groups}
          rows={rows}
          wards={wards}
          ctx={ctx}
          pill={pill}
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
          signOffPanel={departedPanel ?? signOffPanel}
          signOffOffered={!noWardSignOff}
          journeyUnavailable={!!departedPanel}
          outsideAct={scope.kind !== "network" ? outsideAct : []}
          selected={selected}
          onCopyIsbar={copyIsbar}
          patientHrefOf={(row) => (row.patientId ? patientHref(row.patientId) : undefined)}
          since={formatInstantWithDay(newSince, now)}
          sinceItems={sinceItems}
          carryOver={<HandoverOpenPromises referrals={referrals} units={units} now={now} layout="phone" />}
          // Batch 3: Today's review's "Before you hand over" follows the carry-over, on Patients only.
          patientsExtra={showReview ? <BeforeHandoverReview /> : null}
          onCallHref={canOpenHref("/bedchart/on-call") ? "/bedchart/on-call" : undefined}
          onCopySince={copySince}
          chips={deskChips.map((chip) => ({
            id: chip.id,
            label: chip.label,
            count: rows.filter((row) => chip.test(row, now, access.role === "admin" ? undefined : access.role)).length,
            pressed: chips.has(chip.id),
            onToggle: () => toggleChip(chip.id),
          }))}
          meetingOn={meetingStartedAt !== null}
          onToggleMeeting={toggleMeeting}
          onOpenDigest={() => setDigestOpen(true)}
          history={<HandoverHistory {...historyProps} />}
          siteSignOff={siteSignOff}
          promisesAct={promisesPhoneAct(referrals, now, carerDue)}
          bedsAsk={phoneBedsAsk}
          onPill={togglePill}
        />
        {digestSheet}
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
      className={folderTabClasses.switch}
      idPrefix="ward-handover-tab"
      value={tab}
      onChange={(id) => {
        setTab(id);
        setSheetOpen(false);
      }}
      items={[
        { id: "pts", label: "Patients", count: rows.length },
        // ROLE BRANCH (ed): an ED holds no ward, so there is no Beds tab.
        ...(edDesk ? [] : [{ id: "beds" as const, label: "Beds", count: readyTotal }]),
        { id: "hist", label: "History" },
      ]}
    />
  );

  const shiftClock = formatInstantWithDay(shiftAt, now);
  const checksDone = signChecks.filter((check) => check.done).length;
  /* Page tops (Josh, 9 Nov 2026). NA2-01: the title counts Act now, Flagged urgent and Due by, as the
   * phone title does. Sign off stays in the top on every tab (3 Nov) and opens the checklist drawer. */
  const promisesAct = sheetOpen ? undefined : promisesHeroAct(referrals, now, promisesOpen, setPromisesOpen, carerDue);
  const handoverCount = counts.act + counts.urg + counts.due;
  const hero = (
    <Hero
      level={1}
      className={cx(pageTop.hero, !sheetOpen && folderTabClasses.hero)}
      testId="ward-handover-hero"
      // H-0887: the page heading names the page, not only the count.
      title={
        <>
          <SrOnly>{`Handover, ${scopeLabel}:`}</SrOnly>{" "}
          {ownWard ? desk.peopleToHandOver(handoverCount) : `${handoverCount} to hand over`}
        </>
      }
      aside={
        <HandoverShiftMenu
          shift={shift}
          now={now}
          label={{ clock: shiftClock, words: shiftInfo.label }}
          onChange={setShift}
        />
      }
    >
      <HeroTop
        figures={
          <HeroFigures
            testId="ward-handover-kpi-strip" // Help's "Start with Act now" lights these.
            // Each figure highlights its rows (all rows stay); the sheet says how many and clears it.
            items={(
              [
                ["act", counts.act, actNowLabel(counts.act, actNowItems, rows, scope.kind === "network")],
                ["urg", counts.urg, "urgent"],
                ["due", counts.due, `due by ${formatInstantWithDay(cutoff, now)}`],
              ] as const
            ).map(([id, value, label]) => ({
              id,
              value,
              label,
              testId: `ward-handover-figure-${id}`,
              onClick: () => togglePill(id),
              pressed: pill === id,
            }))}
          />
        }
        act={promisesAct ? <HeroAct {...promisesAct} /> : undefined}
        chips={
          <HeroQuickChips
            label="Handover actions"
            items={[
              {
                id: "meeting",
                label: "Meeting timer",
                node: <HandoverMeetingChip startedAt={meetingStartedAt} now={now} onClick={toggleMeeting} />,
              },
              ...(noWardSignOff
                ? []
                : [
                    {
                      id: "sign",
                      label: "Sign off",
                      node: (
                        <HandoverSignOffChip
                          done={checksDone}
                          total={signChecks.length}
                          signed={signedAt === null ? null : formatInstantWithDay(signedAt, now)}
                          onClick={showSignOff}
                        />
                      ),
                    },
                  ]),
              {
                /* Audit three #28: the handover's outputs sit under one Share chip, as Discharges has.
                   Shift digest opens the sheet, which holds Copy digest; `?digest=1` still opens it. */
                id: "share",
                label: "Share",
                node: (
                  <Menu
                    label="Share"
                    align="end"
                    items={[
                      {
                        id: "copy",
                        label: copied ? "Copied" : "Copy for handover",
                        icon: ClipboardCopy,
                        onSelect: copySummary,
                      },
                      {
                        id: "print",
                        label: <span data-testid="ward-handover-print">Print handover</span>,
                        icon: Printer,
                        onSelect: () => setSheetOpen(true),
                      },
                      {
                        id: "digest",
                        label: <span data-testid="ward-handover-digest-open">Shift digest</span>,
                        icon: FileText,
                        onSelect: () => setDigestOpen(true),
                      },
                      {
                        id: "downtime",
                        label: "Downtime pack",
                        icon: Printer,
                        onSelect: () => router.push("/bedchart/reports/downtime"),
                      },
                    ]}
                    trigger={(props) => (
                      <button type="button" {...props} className={heroChipClassName} data-testid="ward-handover-share">
                        <Icon icon={Share2} size={16} />
                        <span>Share</span>
                        <Icon icon={ChevronDown} size={14} />
                      </button>
                    )}
                  />
                ),
              },
            ]}
          />
        }
      >
        <HandoverSinceLine
          since={formatInstantWithDay(newSince, now)}
          items={sinceItems}
          signOffNote={
            edDesk
              ? signedAt !== null
                ? `Signed off ${formatInstantWithDay(signedAt, now)}`
                : "Coordinator or ward signs off"
              : null
          }
        />
      </HeroTop>
    </Hero>
  );

  const toolbar = (
    <FolderTabs
      label="Handover views"
      value={tab}
      testId="ward-handover-tabs"
      more={
        <span className={styles.folderTools}>
          {/* Audit four item 6: the one-item dots menu is the Open on TV button itself, as on Capacity
              and ED (A2-80, one name, one door). Keyboard shortcuts stays an icon. */}
          <Button
            variant="ghost"
            size="sm"
            icon={MonitorPlay}
            className={`${folderTabClasses.more} ${folderTabClasses.moreOutlined}`}
            aria-pressed={present}
            onClick={() => setPresent((on) => !on)}
            data-testid="ward-handover-open-tv"
          >
            {present ? "Close TV view" : "Open on TV"}
          </Button>
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
                variant="ghost"
                size="sm"
                iconOnly
                icon={Keyboard}
                className={folderTabClasses.more}
                aria-label="Keyboard shortcuts"
              />
            )}
          >
            {() => (
              <HandoverKeysHelp
                enabled={singleKeyShortcutsEnabled}
                onEnabledChange={setSingleKeyShortcutsEnabled}
                signOff={!noWardSignOff}
              />
            )}
          </Popover>
        </span>
      }
    >
      {tabs}
    </FolderTabs>
  );

  const pastBanner = passed ? (
    <div className={styles.banner} role="status">
      <StatusGlyph tone="neutral" size={9} />
      <span>
        The {formatInstantWithDay(shiftAt, now)} handover has passed
        {signedAt === null ? " and no sign-off was recorded" : ""}. Showing the board now.
      </span>
      <Button variant="ghost" size="sm" onClick={() => setTab("hist")}>
        History
      </Button>
      <Button variant="sec" size="sm" onClick={() => setShift(defaultHandoverShift(now))}>
        Go to {formatInstantWithDay(handoverAt(defaultHandoverShift(now), now), now)} handover
      </Button>
    </div>
  ) : null;

  /* On screen, Next step leads and carries the status under it, so the eye reads the action first;
     the printed sheet keeps its own Status and Next step columns. */
  const screenColumns = screenColumnsFor(columns, columnIds);

  const table = (
    <Card
      as="section"
      className={`${styles.tableCard} ${present ? styles.present : ""}`}
      aria-label="Handover sheet"
      data-testid="ward-handover-sheet"
    >
      <div className={styles.bar} data-testid="ward-handover-prepare">
        {scopeControl}
        {viewControl}
        {/* Print handover sits under the top's Share chip (audit three #28). */}
      </div>
      {(scope.kind === "network" || wardAllShown) && !anyHighlight ? null : (
        <div className={styles.scopeLine} data-testid="ward-handover-scope-line">
          {scope.kind !== "network" ? (
            <span data-testid="ward-handover-scope-summary">
              <b>{rows.length}</b> of {allRows.length} open in <b>{scopeLabel}</b>
              {outsideAct.length ? (
                <>
                  {" · "}
                  <b className={styles.urgentOut}>{outsideAct.length} act now or urgent outside</b>
                </>
              ) : null}
            </span>
          ) : null}
          {anyHighlight ? (
            <>
              <span className={styles.hlChips}>
                {deskChips
                  .filter((chip) => chips.has(chip.id))
                  .map((chip) => (
                    <AppliedFilter
                      key={chip.id}
                      onRemove={() => toggleChip(chip.id)}
                      removeLabel={`Stop highlighting ${chip.label}`}
                    >
                      {chip.label}
                    </AppliedFilter>
                  ))}
              </span>
              <span className={styles.spacer} />
              <span className={styles.hlCount}>
                <b>{rows.filter(isHighlighted).length}</b> highlighted
              </span>
              <Button variant="ghost" size="sm" onClick={clearHighlight}>
                Clear
              </Button>
            </>
          ) : null}
        </div>
      )}
      <div
        className={cx(styles.tableScroll, fitted && styles.tableScrollFitted)}
        tabIndex={0}
        role="region"
        aria-label="Handover patients"
      >
        <table
          className={cx(tableClasses.table, styles.sheetTable, compact && styles.compact, fitted && styles.fitted)}
        >
          <colgroup>
            {screenColumns.map((column) => (
              <col
                key={column.id}
                style={{
                  width: fitted
                    ? `${((column.width / screenColumns.reduce((sum, entry) => sum + entry.width, 0)) * 100).toFixed(2)}%`
                    : column.width,
                }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {screenColumns.map((column) => (
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
                  <td colSpan={screenColumns.length}>
                    <button
                      type="button"
                      className={styles.groupButton}
                      aria-expanded={!isCollapsed}
                      title={group.why}
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
                      {group.rows.length === 0 ? <span className={styles.why}>None</span> : null}
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
                          onClick={() => pick(row.id)}
                          onKeyDown={(event: ReactKeyboardEvent<HTMLTableRowElement>) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              pick(row.id);
                            }
                          }}
                        >
                          {screenColumns.map((column) => (
                            <td key={column.id}>{column.cell(row, ctx)}</td>
                          ))}
                        </tr>
                      );
                    })}
                {group.id === "due" && !isCollapsed ? (
                  <ShowMoreRow
                    hidden={group.rows.length - DUE_FIRST}
                    span={screenColumns.length}
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
        <span className={styles.spacer} />
        <span>J and K step through patients</span>
      </div>
    </Card>
  );

  // Beside the table the rail carries the handover's context: what changed, what carries over, then sign-off.
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
        <HandoverHistory {...historyProps} />
      </TabPanel>
    );
  } else if (portrait) {
    // Audit four item 21 (A3-28, A2-64): no portrait-only filled Print (it is under Share) and no
    // second scope picker (the header sets the scope). The list head keeps Arrange, and says
    // "N of M open" beside it only when the list is narrowed; the Patients tab already counts it.
    const narrowed = rows.length !== allRows.length;
    body = (
      <TabPanel idPrefix="ward-handover-tab" id="pts">
        <div className={styles.portraitTools} data-testid="ward-handover-portrait-head">
          {narrowed ? (
            <span className={styles.portraitNote}>
              <b>{rows.length}</b> of {allRows.length} open
            </span>
          ) : (
            <span className={styles.portraitNote} />
          )}
          {viewControl}
          <span className={styles.portraitRailHost}>{portraitRail()}</span>
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
                sub: `${row.umrn} · T${row.tier} · ${handoverStatusLabel(row)}`,
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
        />
        {showReview ? <BeforeHandoverReview className={styles.reviewBlock} /> : null}
      </TabPanel>
    );
  } else {
    body = (
      <TabPanel idPrefix="ward-handover-tab" id="pts">
        <div className={styles.split}>{table}</div>
        {/* Batch 3 (one Handover): Today's review's "Before you hand over", under the grouped table. */}
        {showReview ? <BeforeHandoverReview className={styles.reviewBlock} /> : null}
      </TabPanel>
    );
  }

  return (
    <main
      ref={shortcutScopeRef}
      id="main-content"
      className={styles.page}
      data-testid="ward-handover-page"
      data-ward-design="v6"
    >
      {hero}
      {/* The folder tabs rise out of the hero, so they come straight after it. */}
      {sheetOpen ? null : toolbar}
      {sheetOpen ? null : <HandoverOpenPromises referrals={referrals} units={units} now={now} open={promisesOpen} />}
      {pastBanner}
      {sheetOpen || tab !== "pts" ? null : siteSignOff}
      {body}
      {flowPanel}
      {digestSheet}
      {!portrait ? (
        <Drawer
          open={drawerOpen && !selected && departedPanel !== null}
          onClose={() => setDrawerOpen(false)}
          title="Journey no longer open"
        >
          {departedPanel}
        </Drawer>
      ) : null}
      {signOffDialogBody ? (
        <Dialog
          open={drawerOpen && !selected && !departedPanel}
          onClose={() => setDrawerOpen(false)}
          // Gate r10 (1b upgrade 4): the next kit width, so a stale-ward check and the filled
          // "Sign off as … at …" label each hold one line.
          size="md"
          title="Sign off"
          description={`${formatInstantWithDay(shiftAt, now)} handover · ${shiftInfo.label} · ${scopeLabel}`}
          data-testid="ward-handover-sign-off-dialog"
          secondary={
            signedAt !== null
              ? [{ label: "Undo sign-off", onAction: handleUndoSignOff }]
              : [{ label: "Not now", onAction: () => setDrawerOpen(false) }]
          }
          primary={
            signedAt !== null
              ? { label: "Done", onAction: () => setDrawerOpen(false) }
              : {
                  label: `Sign off as ${signOffSigner} at ${formatInstant(now)}`,
                  onAction: handleSignOff,
                  disabledReason: !canSignOff
                    ? (cannotSignReason ?? "Complete sign-off checks first")
                    : cannotSignReason,
                }
          }
        >
          {signOffDialogBody}
        </Dialog>
      ) : null}
      <WardPrototypeFooter
        testId="ward-handover-governance"
        note="Synthetic data · Not approved for clinical use · Print copies carry their preparation time"
      />
    </main>
  );
}
