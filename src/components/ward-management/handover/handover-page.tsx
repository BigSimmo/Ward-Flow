"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  Clock,
  Columns3,
  Keyboard,
  MonitorPlay,
  Printer,
  Sparkles,
  Timer as TimerIcon,
} from "lucide-react";

import { COMMUNITY_TEAM_PAGES, communityTeamById } from "@/components/ward-management/community/community-derivations";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, formatSheetMoment, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { Patient } from "@/components/ward-management/ward-patients";
import {
  HEALTH_SERVICES,
  type HealthService,
  type Movement,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { allEmergencyDepartments, edById } from "@/components/ward-management/ward-sites";
import { movementBelongsToService } from "@/components/ward-management/ward-service-scope";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { referralForMovement } from "@/components/ward-management/ward-derivations";
import { clockState } from "@/components/ward-management/ward-clock";
import {
  Button,
  Card,
  Checkbox,
  Drawer,
  FilterChip,
  HeroStat,
  HeroTrack,
  Hero,
  Icon,
  LiveChip,
  Popover,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  TabPanel,
  Tabs,
  buttonClass,
  cx,
  durMinutes,
  tableClasses,
} from "@/components/wf";

import {
  DENSITY_COLUMNS,
  DENSITY_LABEL,
  HANDOVER_COLUMNS,
  columnsFor,
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
  handoverAt,
  handoverCutoff,
  handoverNewSince,
  handoverShift,
  signOffMatchesHandover,
  heldDischarges,
  isActNow,
  isbarText,
  isMoving,
  isWaitingForBed,
  pillTest,
  summaryText,
  toHandoverRow,
  toHandoverWard,
  wardIsStale,
  type HandoverChip,
  type HandoverGrouping,
  type HandoverPill,
  type HandoverRow,
  type HandoverShiftId,
  type HandoverSort,
} from "./handover-model";
import { HandoverFlowPanel, HandoverSignOffPanel, type SignOffCheck } from "./handover-panels";
import { HandoverBeds } from "./handover-beds";
import { DEFAULT_PRINT_OPTIONS, HandoverPrintSheet } from "./handover-print-sheet";
import { HandoverPhone } from "./handover-phone";
import styles from "./handover-refined.module.css";

/**
 * THE FILTER — owner ruling 2026-09-09 (`docs/ward-flow/owner-decisions-2026-09-09.md` §1).
 *
 * "I want the handover to be a page that is completely filterable... filtered rapidly based on
 * Service, Ward, ED, Community, etc." Four dimensions, all verified against the live model —
 * a `HandoverScope` is the whole network, or exactly one of a health service, a ward, an ED,
 * or a community team.
 */
export type HandoverScope =
  | { kind: "network" }
  | { kind: "service"; id: HealthService }
  | { kind: "ward"; id: string }
  | { kind: "ed"; id: string }
  | { kind: "team"; id: string };

const NETWORK_SCOPE_VALUE = "network";

function isHealthService(value: string): value is HealthService {
  return (HEALTH_SERVICES as readonly string[]).includes(value);
}

const PHONE_WIDTH_QUERY = "(max-width: 48rem)";

function subscribePhoneWidth(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(PHONE_WIDTH_QUERY);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
}

function readPhoneWidth() {
  return typeof window.matchMedia === "function" && window.matchMedia(PHONE_WIDTH_QUERY).matches;
}

/** The `<select>`'s own value for a scope — round-tripped by `parseHandoverScope` below. */
export function handoverScopeValue(scope: HandoverScope): string {
  return scope.kind === "network" ? NETWORK_SCOPE_VALUE : `${scope.kind}:${scope.id}`;
}

/** The inverse of `handoverScopeValue`. */
export function parseHandoverScope(value: string): HandoverScope {
  if (value === NETWORK_SCOPE_VALUE) return { kind: "network" };
  const separator = value.indexOf(":");
  if (separator === -1) return { kind: "network" };
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (kind === "service" && isHealthService(id)) return { kind: "service", id };
  if (kind === "ward") return { kind: "ward", id };
  if (kind === "ed") return { kind: "ed", id };
  if (kind === "team") return { kind: "team", id };
  return { kind: "network" };
}

/** THE SCOPE'S NAME */
export function handoverScopeLabel(scope: HandoverScope, units: Unit[]): string | undefined {
  switch (scope.kind) {
    case "network":
      return "Whole network";
    case "service":
      return scope.id;
    case "ward":
      return units.find((unit) => unit.id === scope.id)?.name;
    case "ed":
      return edById(scope.id)?.name;
    case "team": {
      const team = communityTeamById(scope.id);
      return team === null ? undefined : team.name;
    }
  }
}

function movementTouchesUnit(movement: Movement, unitId: string): boolean {
  return movement.acceptedUnitId === unitId || movement.referredUnitIds.includes(unitId);
}

/** WHETHER AN OPEN MOVEMENT BELONGS TO THIS SCOPE */
export function movementInHandoverScope(
  movement: Movement,
  scope: HandoverScope,
  units: Unit[],
  referrals: Referral[],
): boolean {
  switch (scope.kind) {
    case "network":
      return true;
    case "ed":
      return movement.originEdId === scope.id;
    case "ward":
      return movementTouchesUnit(movement, scope.id);
    case "service":
      return movementBelongsToService(movement, scope.id, units);
    case "team": {
      const team = communityTeamById(scope.id);
      if (team === null) return false;
      const referral = referralForMovement(movement, referrals);
      if (referral === undefined) return false;
      return referral.destinations.some(
        (addressed) => addressed.destination.kind === "community_team" && addressed.destination.teamName === team.name,
      );
    }
  }
}

/** Observation / acuity label — urgent flag only, not invented observation cadence. */
export function movementObservationLabel(movement: Movement): string {
  if (movement.flaggedUrgent) return "Urgent";
  if (movement.specialling) return "1:1 Specialling";
  return "Standard";
}

/**
 * Shift handover sign-off. The engine stores role and time only. This helper dispatches first
 * and returns a record only when that call is allowed and does not throw — never a claim that
 * the sheet was signed before the reducer accepted it, and never a claim that anyone was notified.
 */
function recordHandoverSignOff(
  dispatch: Dispatch<WardFlowEvent>,
  now: Instant,
): { role: WardFlowRole; at: Instant } | null {
  const role: WardFlowRole = "coordinator";
  if (!EVENT_ROLE.RECORD_HANDOVER_SIGN_OFF.includes(role)) return null;
  try {
    dispatch({ type: "RECORD_HANDOVER_SIGN_OFF", role, now });
  } catch {
    return null;
  }
  return { role, at: now };
}

/** URGENT, FOR THE PURPOSE OF THE "OUTSIDE THIS FILTER" FOOTER */
export function movementIsUrgent(movement: Movement, now: Instant): boolean {
  if (movement.flaggedUrgent) return true;
  const dueAt = movement.legalForm?.dueAt;
  return dueAt !== undefined && clockState(dueAt, now) === "breached";
}

/** THE WHOLE OF CONDITION 3, AS ONE FUNCTION */
export function urgentMovementsOutsideScope(
  openMovements: Movement[],
  scope: HandoverScope,
  units: Unit[],
  referrals: Referral[],
  now: Instant,
): Movement[] {
  return openMovements.filter(
    (movement) => !movementInHandoverScope(movement, scope, units, referrals) && movementIsUrgent(movement, now),
  );
}

/**
 * The patient a handover row names, read only from the model's own links.
 *
 * A typed-in table of 35 names and record numbers keyed by movement id used to win over the
 * record here. None of its rows matched: 16 put another patient's name on the movement and the
 * rest invented a person the model does not hold (25 September 2026 audit, A1). A movement linked
 * to nobody now says so, in the resolver's own words.
 */
export function resolveMovementPatient(
  movement: Movement,
  patients: Patient[],
  referrals: Referral[],
): { name: string; umrn: string; patientId?: string } {
  const info = resolveSubjectPatient(movement, { patients, referrals });
  return {
    name: info.displayName,
    umrn: info.umrn,
    patientId: info.patient?.id,
  };
}

/**
 * The same resolver as `resolveMovementPatient` above, for a row keyed by an admission (a bed
 * release) rather than a movement — same A1 discipline: read only from the model's own link
 * (`Admission.patientId`/`referralId`), never a typed name table. Added for the Stranded Delayed
 * Egress table, which until 25 September 2026 named six patients nobody in this model holds, each
 * under a real seeded UMRN that belongs to someone else entirely (audit finding, same date).
 */
export function resolveAdmissionPatient(
  admission: Admission | undefined,
  patients: Patient[],
  referrals: Referral[],
): { name: string; umrn: string } {
  const info = resolveSubjectPatient(admission, { patients, referrals });
  return {
    name: info.displayName,
    umrn: info.umrn,
  };
}

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
  due: "warning",
  bed: "neutral",
  mov: "info",
};

const GROUP_TONE = { act: "danger", due: "warning", bed: "neutral", acc: "neutral", mov: "info" } as const;

const KEYS: [string, string][] = [
  ["J K", "Step through patients"],
  ["P", "Print handover"],
  ["S", "Sign off"],
  ["M", "Start or stop the meeting timer"],
  ["Esc", "Close or go back"],
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function mmss(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The Handover page, refined A (Josh, 9 Oct 2026). One grouped table in meeting order is the core,
 * held to a set height so it scrolls inside its card. The right panel is the sign-off sheet until a
 * patient is picked, then that patient's flow. Beds and History are tabs, and Print handover opens
 * the sheet builder, where what you see is what prints.
 */
export function HandoverPage() {
  const { movements, units, referrals, patients, admissions, bedReleases, dispatch, dayZero, handoverSignOffs } =
    useWardFlow();
  const now = useWardFlowClock();
  const isPhoneWidth = useSyncExternalStore(subscribePhoneWidth, readPhoneWidth, () => false);

  /* scope, read once from the URL */
  const searchParams = useSearchParams();
  const [scopeValue, setScopeValue] = useState<string>(() => {
    const requested = searchParams?.get("scope")?.trim();
    if (requested === undefined || requested.length === 0) return NETWORK_SCOPE_VALUE;
    return handoverScopeValue(parseHandoverScope(requested));
  });
  const scope = useMemo(() => parseHandoverScope(scopeValue), [scopeValue]);
  const scopeLabel = handoverScopeLabel(scope, units) ?? "Whole network";

  /* which handover */
  const [shift, setShift] = useState<HandoverShiftId>(() => defaultHandoverShift(now));
  const shiftInfo = handoverShift(shift);
  const shiftAt = handoverAt(shift, now);
  const passed = shiftAt <= now;
  const cutoff = handoverCutoff(shift, now);
  const newSince = handoverNewSince(shift, now);

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
  const [meetingTick, setMeetingTick] = useState(0);
  const [meetings, setMeetings] = useState<{ at: Instant; minutes: number }[]>([]);
  const [takenAt, setTakenAt] = useState<Instant | null>(null);
  const [printOptions, setPrintOptions] = useState(DEFAULT_PRINT_OPTIONS);
  const [copied, setCopied] = useState(false);
  const keysTriggerRef = useRef<HTMLButtonElement | null>(null);
  const signOffRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (meetingStartedAt === null) return;
    const id = window.setInterval(() => setMeetingTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [meetingStartedAt]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(id);
  }, [copied]);

  /* rows and wards */
  const allRows = useMemo(
    () => movements.filter(isOpen).map((movement) => toHandoverRow(movement, units, patients, referrals)),
    [movements, units, patients, referrals],
  );
  const rows = useMemo(
    () => allRows.filter((row) => movementInHandoverScope(row.movement, scope, units, referrals)),
    [allRows, scope, units, referrals],
  );
  const outside = useMemo(
    () => allRows.filter((row) => !movementInHandoverScope(row.movement, scope, units, referrals)),
    [allRows, scope, units, referrals],
  );
  const allWards = useMemo(
    () => units.map((unit) => toHandoverWard(unit, admissions, now, bedReleases)),
    [units, admissions, now, bedReleases],
  );
  const wards = useMemo(
    () =>
      allWards.filter((ward) => {
        if (scope.kind === "ward") return ward.id === scope.id;
        if (scope.kind === "service") return ward.service === scope.id;
        return true;
      }),
    [allWards, scope],
  );
  const held = useMemo(
    () => heldDischarges(admissions, wards, patients, referrals, now),
    [admissions, wards, patients, referrals, now],
  );
  const wardOf = useCallback((unitId: string) => allWards.find((ward) => ward.id === unitId), [allWards]);
  const readyBeds = useCallback(
    (unitId: string) => {
      const ward = wardOf(unitId);
      return ward === undefined ? 0 : Math.max(0, ward.ready - ward.pendingPreparation);
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

  const counts = useMemo(
    () => ({
      act: rows.filter((row) => groupOf(row, now, cutoff) === "act").length,
      due: rows.filter((row) => groupOf(row, now, cutoff) === "due").length,
      bed: rows.filter(isWaitingForBed).length,
      mov: rows.filter(isMoving).length,
      new: rows.filter((row) => row.openedAt >= newSince).length,
    }),
    [rows, now, cutoff, newSince],
  );
  const readyTotal = wards.reduce((sum, ward) => sum + ward.ready, 0);
  const staleWards = wards.filter((ward) => wardIsStale(ward, now));
  const outsideAct = outside.filter((row) => isActNow(row, now));

  /* columns */
  const columnIds = customColumns ?? DENSITY_COLUMNS[density];
  const columns = columnsFor(columnIds);
  const wide = present || columnIds.length > 8;
  const compact = customColumns === null && density === "min";

  /* selection */
  const selected = selectedId === null ? undefined : allRows.find((row) => row.id === selectedId);
  const pick = (id: string) => {
    setSelectedId(id);
    if (wide || isPhoneWidth) setDrawerOpen(true);
  };
  const step = useCallback(
    (direction: 1 | -1) => {
      if (visibleOrder.length === 0) return;
      const index = visibleOrder.findIndex((row) => row.id === selectedId);
      const next = index < 0 ? 0 : Math.max(0, Math.min(visibleOrder.length - 1, index + direction));
      const id = visibleOrder[next]!.id;
      setSelectedId(id);
      if (typeof document !== "undefined") {
        document.querySelector(`[data-row-id="${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: "nearest" });
      }
    },
    [visibleOrder, selectedId],
  );

  /* sign-off */
  const signedAt =
    [...handoverSignOffs].reverse().find((signOff) => signOffMatchesHandover(signOff, shift, now))?.at ?? null;
  const handleSignOff = useCallback(() => {
    const recorded = recordHandoverSignOff(dispatch, now);
    if (recorded === null) {
      announceToWardShell("Sign-off is not recorded.");
      return;
    }
    announceToWardShell(
      `Signed off as flow coordinator at ${formatInstantWithDay(recorded.at, now)}. Recorded in History.`,
    );
  }, [dispatch, now]);
  const showSignOff = () => {
    setSheetOpen(false);
    setTab("pts");
    setSelectedId(null);
    if (wide || isPhoneWidth) setDrawerOpen(true);
    window.requestAnimationFrame(() => signOffRef.current?.querySelector<HTMLElement>("button")?.focus());
  };

  /* meeting timer: session only, the length goes to History */
  const toggleMeeting = useCallback(() => {
    if (meetingStartedAt === null) {
      setMeetingStartedAt(Date.now());
      setMeetingTick(Date.now());
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
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        announceToWardShell(`Summary copied, ${rows.length} synthetic patients.`);
      },
      () => announceToWardShell("Copy was blocked by the browser."),
    );
  }, [groups, scopeLabel, shiftLine, now, rows.length]);
  const copyIsbar = useCallback(
    (row: HandoverRow) => {
      void navigator.clipboard?.writeText(isbarText(row, now)).then(
        () => announceToWardShell(`ISBAR for ${row.name} copied.`),
        () => announceToWardShell("Copy was blocked by the browser."),
      );
    },
    [now],
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
        else if (selectedId !== null) setSelectedId(null);
        else if (present) setPresent(false);
        else if (sheetOpen) setSheetOpen(false);
        return;
      }
      if (isPhoneWidth) return;
      if (key === "p") {
        event.preventDefault();
        setSheetOpen(true);
      } else if (key === "s") {
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
  }, [drawerOpen, selectedId, present, sheetOpen, isPhoneWidth, toggleMeeting, tab, step]);

  /* sign-off checks */
  const actRows = rows.filter((row) => groupOf(row, now, cutoff) === "act");
  const signChecks: SignOffCheck[] = [
    {
      id: "act",
      done: actRows.every((row) => row.owner !== "No owner recorded"),
      text: `${actRows.length} act now, ${actRows.every((row) => row.owner !== "No owner recorded") ? "each has an owner" : "some have no owner"}`,
    },
    { id: "due", done: true, text: `${counts.due} due by ${formatInstantWithDay(cutoff, now)} listed` },
    staleWards.length
      ? {
          id: "feeds",
          done: false,
          text: `${staleWards.length} ward feed${staleWards.length === 1 ? "" : "s"} older than 15 minutes`,
          action: { label: "Check beds", onClick: () => setTab("beds") },
        }
      : { id: "feeds", done: true, text: "Every ward feed is current" },
    takenAt !== null
      ? { id: "print", done: true, text: `Printed copy taken ${formatInstantWithDay(takenAt, now)}` }
      : {
          id: "print",
          done: false,
          text: "No printed copy yet",
          action: { label: "Print handover", onClick: () => setSheetOpen(true) },
        },
    meetings.length
      ? { id: "meet", done: true, text: `Meeting timed, ${meetings[0]!.minutes} min` }
      : {
          id: "meet",
          done: false,
          text: "Meeting not timed",
          action: { label: "Start timer", onClick: toggleMeeting },
        },
  ];
  const canSignOff = EVENT_ROLE.RECORD_HANDOVER_SIGN_OFF.includes("coordinator") && !passed;

  const signOffPanel = (
    <div ref={signOffRef}>
      <HandoverSignOffPanel
        title={`Sign off ${formatInstantWithDay(shiftAt, now)} handover`}
        subtitle={`${shiftInfo.label} · ${scopeLabel}`}
        checks={signChecks}
        signedAt={signedAt}
        now={now}
        canSignOff={canSignOff}
        cannotSignReason={passed ? "This handover has passed. Choose the next one." : undefined}
        onSignOff={handleSignOff}
      />
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
  const scopeControl = <HandoverScopeControl value={scopeValue} onChange={setScopeValue} units={units} />;
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
  const chipControls = HANDOVER_CHIPS.map((chip) => (
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
        { id: "beds", label: "Beds", count: `${readyTotal} ready` },
        { id: "hist", label: "History" },
      ]}
    />
  );

  const hero = (
    <Hero
      level={1}
      testId="ward-handover-hero"
      title={`${formatInstantWithDay(shiftAt, now)} handover`}
      titleMeta={scopeLabel}
      foot={
        <span className={styles.gap} aria-label={`${readyTotal} beds ready for ${counts.bed} waiting`}>
          <span>
            <b>{readyTotal}</b> beds ready for <b>{counts.bed}</b> waiting
          </span>
          <span className={styles.gapBar} aria-hidden="true">
            {readyTotal > 0 ? <i className={styles.gapReady} style={{ flex: readyTotal }} /> : null}
            {counts.bed > readyTotal ? (
              <i className={styles.gapWaiting} style={{ flex: counts.bed - readyTotal }} />
            ) : null}
          </span>
        </span>
      }
      stats={
        <div className={styles.heroTools} data-testid="ward-handover-kpi-strip" aria-label="Handover counts">
          {(["act", "due", "bed", "mov"] as const).map((id) => (
            <HeroStat
              key={id}
              value={counts[id]}
              tone={PILL_TONE[id]}
              label={
                id === "act"
                  ? "Act now"
                  : id === "due"
                    ? `Due by ${formatInstantWithDay(cutoff, now)}`
                    : id === "bed"
                      ? "Waiting for a bed"
                      : "Moving"
              }
              pressed={pill === id}
              onToggle={() => togglePill(id)}
            />
          ))}
        </div>
      }
      aside={
        <>
          <Button
            variant="onHero"
            size="sm"
            icon={StatusCheckIcon(signedAt !== null)}
            onClick={showSignOff}
            data-testid="ward-handover-hero-sign-off"
          >
            {signedAt !== null ? `Signed ${formatInstantWithDay(signedAt, now)}` : "Sign off"}
          </Button>
          <Button
            variant="light"
            size="sm"
            icon={Printer}
            aria-pressed={sheetOpen}
            onClick={() => setSheetOpen((open) => !open)}
            data-testid="ward-handover-print"
          >
            Print handover
          </Button>
        </>
      }
      bar={
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
          <button
            type="button"
            className={styles.heroChip}
            aria-pressed={pill === "new"}
            onClick={() => togglePill("new")}
          >
            <Icon icon={Sparkles} size={14} />
            New since {formatInstantWithDay(newSince, now)}
            <span className={styles.heroCount}>{counts.new}</span>
          </button>
        </div>
      }
      barAside={
        <>
          <Button
            variant="onHero"
            size="sm"
            icon={TimerIcon}
            aria-pressed={meetingStartedAt !== null}
            onClick={toggleMeeting}
          >
            {meetingStartedAt !== null ? (
              <span className={styles.meeting}>Stop {mmss(meetingTick - meetingStartedAt)}</span>
            ) : (
              "Start meeting"
            )}
          </Button>
          <Button
            variant="onHero"
            size="sm"
            icon={MonitorPlay}
            aria-pressed={present}
            onClick={() => setPresent((on) => !on)}
          >
            {present ? "Exit present" : "Present"}
          </Button>
          <LiveChip state="live" onHero />
        </>
      }
    />
  );

  const toolbar = (
    <div className={styles.toolbar}>
      {tabs}
      <span className={styles.toolbarNote}>
        {tab === "beds" ? "Ward feeds as recorded" : "Scope narrows, chips only highlight"}
      </span>
      <Button variant="ghost" size="sm" icon={ClipboardCopy} onClick={copySummary}>
        {copied ? "Copied" : "Copy summary"}
      </Button>
      <Link href="/mockups/ward-flow/reports/downtime" className={buttonClass({ variant: "ghost", size: "sm" })}>
        Downtime pack
      </Link>
      <Button variant="ghost" size="sm" icon={Activity} onClick={() => openWardDrawer("activity")}>
        Activity
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
            variant="sec"
            size="sm"
            iconOnly
            icon={Keyboard}
            aria-label="Keyboard shortcuts"
          />
        )}
      >
        {() => (
          <dl className={styles.keys}>
            {KEYS.map(([keys, text]) => (
              <div key={keys}>
                <dt>
                  <kbd>{keys}</kbd>
                </dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
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
                , <b className={styles.urgentOut}>{outsideAct.length} act now</b> listed under the sheet
              </>
            ) : (
              ", none act now"
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
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Handover patients">
        <table className={cx(tableClasses.table, styles.sheetTable, compact && styles.compact)}>
          <colgroup>
            {columns.map((column) => (
              <col key={column.id} style={{ width: column.width }} />
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
                  : group.rows.map((row) => {
                      const isSelected = row.id === selectedId;
                      return (
                        <tr
                          key={row.id}
                          data-row-id={row.id}
                          tabIndex={0}
                          aria-selected={isSelected}
                          className={`${styles.row} ${isHighlighted(row) ? styles.rowHighlighted : ""} ${
                            isSelected ? styles.rowSelected : ""
                          }`}
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
              </tbody>
            );
          })}
        </table>
      </div>
      {scope.kind !== "network" && outsideAct.length ? (
        <div className={styles.tableFoot} data-testid="ward-handover-urgent-outside-filter">
          <StatusGlyph tone="danger" size={9} />
          <b>Act now outside this scope</b>
          {outsideAct.map((row) => (
            <Button key={row.id} variant="ghost" size="sm" onClick={() => pick(row.id)}>
              {row.name} <span className={styles.mono}>{row.umrn}</span>
            </Button>
          ))}
        </div>
      ) : null}
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
        isHighlighted={isHighlighted}
        anyHighlight={anyHighlight}
        scopeLabel={scopeLabel}
        shiftLabel={`${shiftInfo.label}, ${formatInstantWithDay(shiftAt, now)}`}
        densityLabel={customColumns === null ? DENSITY_LABEL[density] : "Chosen"}
        sheetDate={formatSheetMoment(now, dayZero).split(",")[0] ?? ""}
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
        onPrinted={(at) => setTakenAt(at)}
        takenAt={takenAt}
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
          onOpenPatient={(id) => {
            setTab("pts");
            pick(id);
          }}
        />
      </TabPanel>
    );
  } else if (tab === "hist") {
    body = (
      <TabPanel idPrefix="ward-handover-tab" id="hist">
        <HandoverHistory signOffs={handoverSignOffs} meetings={meetings} takenAt={takenAt} now={now} />
      </TabPanel>
    );
  } else {
    body = (
      <TabPanel idPrefix="ward-handover-tab" id="pts">
        <div className={`${styles.split} ${wide ? styles.splitFull : ""}`}>
          {table}
          {wide ? null : (
            <aside className={styles.side} aria-label={selected ? "Patient flow" : "Sign off"}>
              {flowPanel ?? signOffPanel}
            </aside>
          )}
        </div>
      </TabPanel>
    );
  }

  return (
    <main id="main-content" className={styles.page} data-testid="ward-handover-page" data-ward-design="v6">
      {hero}
      {pastBanner}
      {sheetOpen ? null : toolbar}
      {body}
      {wide ? (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={selected ? selected.name : "Sign off"}>
          {flowPanel ?? signOffPanel}
        </Drawer>
      ) : null}
      <WardPrototypeFooter
        testId="ward-handover-governance"
        note="Synthetic data · Not a medical device · Printed copies carry the time they were taken"
      />
    </main>
  );
}

function StatusCheckIcon(signed: boolean) {
  return signed ? CheckCircle2 : Check;
}

/** History: past items only. Sign-offs come from the engine; the rest is this session only. */
function HandoverHistory({
  signOffs,
  meetings,
  takenAt,
  now,
}: {
  signOffs: readonly { at: Instant; by: WardFlowRole }[];
  meetings: { at: Instant; minutes: number }[];
  takenAt: Instant | null;
  now: Instant;
}) {
  const unsigned = HANDOVER_SHIFTS.filter((shift) => {
    const at = handoverAt(shift.id, now);
    return at <= now && !signOffs.some((record) => signOffMatchesHandover(record, shift.id, now));
  });
  return (
    <Card as="section" aria-label="Handover history" data-testid="ward-handover-history">
      <ul className={styles.history}>
        {[...signOffs].reverse().map((record) => (
          <li key={`sign-${record.at}-${record.by}`}>
            <span className={styles.mono}>{formatInstantWithDay(record.at, now)}</span>
            <StatusGlyph tone="success" size={9} />
            <span>Handover signed off as {record.by === "coordinator" ? "flow coordinator" : record.by}</span>
          </li>
        ))}
        {takenAt !== null ? (
          <li>
            <span className={styles.mono}>{formatInstantWithDay(takenAt, now)}</span>
            <StatusGlyph tone="success" size={9} />
            <span>Printed copy taken, this session only</span>
          </li>
        ) : null}
        {meetings.map((meeting) => (
          <li key={`meet-${meeting.at}-${meeting.minutes}`}>
            <span className={styles.mono}>{formatInstantWithDay(meeting.at, now)}</span>
            <StatusGlyph tone="success" size={9} />
            <span>Bed flow meeting, {meeting.minutes} min, this session only</span>
          </li>
        ))}
        {unsigned.map((shift) => (
          <li key={`unsigned-${shift.id}`}>
            <span className={styles.mono}>{formatInstantWithDay(handoverAt(shift.id, now), now)}</span>
            <StatusGlyph tone="neutral" size={9} />
            <span>No sign-off recorded for the {shift.label.toLowerCase()} handover</span>
          </li>
        ))}
        {signOffs.length === 0 && takenAt === null && meetings.length === 0 && unsigned.length === 0 ? (
          <li>
            <span />
            <StatusGlyph tone="neutral" size={9} />
            <span>Nothing has happened yet on this shift</span>
          </li>
        ) : null}
      </ul>
    </Card>
  );
}

/** THE ONE CONTROL — `<select aria-label="Filter the sheet">` */
export function HandoverScopeControl({
  value,
  onChange,
  units,
}: {
  value: string;
  onChange: (value: string) => void;
  units: Unit[];
}) {
  const sortedUnits = useMemo(() => [...units].sort((a, b) => a.name.localeCompare(b.name)), [units]);
  const sortedEds = useMemo(() => [...allEmergencyDepartments()].sort((a, b) => a.name.localeCompare(b.name)), []);
  const sortedTeams = useMemo(() => [...COMMUNITY_TEAM_PAGES].sort((a, b) => a.name.localeCompare(b.name)), []);

  return (
    <label htmlFor="ward-handover-scope" className={styles.barSelect} data-print-hide>
      <SrOnly>Filter the sheet</SrOnly>
      <Select
        id="ward-handover-scope"
        aria-label="Filter the sheet"
        data-testid="ward-handover-scope-select"
        boxClassName={styles.barSelect}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value={NETWORK_SCOPE_VALUE}>Whole network</option>
        <optgroup label="Service">
          {HEALTH_SERVICES.map((service) => (
            <option key={service} value={handoverScopeValue({ kind: "service", id: service })}>
              {service}
            </option>
          ))}
        </optgroup>
        <optgroup label="Ward">
          {sortedUnits.map((unit) => (
            <option key={unit.id} value={handoverScopeValue({ kind: "ward", id: unit.id })}>
              {unit.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Emergency department">
          {sortedEds.map((ed) => (
            <option key={ed.id} value={handoverScopeValue({ kind: "ed", id: ed.id })}>
              {ed.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Community team">
          {sortedTeams.map((team) => (
            <option key={team.id} value={handoverScopeValue({ kind: "team", id: team.id })}>
              {team.name}
            </option>
          ))}
        </optgroup>
      </Select>
    </label>
  );
}
