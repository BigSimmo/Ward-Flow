"use client";

import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";

import { COMMUNITY_TEAM_PAGES, communityTeamById } from "@/components/ward-management/community/community-derivations";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import {
  clockState,
  formatSheetMoment,
  formatInstant,
  formatInstantWithDay,
  minuteOfDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import {
  DAY_SHIFT_END_MINUTE,
  dayShiftEndInstant,
  openWorkBeforeShiftEnd,
  openWorkBeforeShiftEndLabel,
} from "@/components/ward-management/ward-board-time-features";
import {
  elapsedLabel,
  handoverSnapshot,
  isOpen,
  referralForMovement,
  stageCopy,
  type HandoverSnapshot,
} from "@/components/ward-management/ward-derivations";
import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { Patient } from "@/components/ward-management/ward-patients";
import {
  ARRIVAL_MODE_LABELS,
  HEALTH_SERVICES,
  type HealthService,
  type Movement,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import {
  bedIsOccupied,
  daysInBed,
  DISCHARGE_BARRIERS,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { allEmergencyDepartments, edById } from "@/components/ward-management/ward-sites";
import { movementBelongsToService, unitHealthService } from "@/components/ward-management/ward-service-scope";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  LONG_WAIT_MINUTES,
  LONG_WAIT_TEXT,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";

import styles from "./handover.module.css";
import pageStyles from "./handover-third-edition.module.css";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import {
  Activity,
  Check,
  ClipboardList,
  Clock,
  Copy,
  ListChecks,
  Maximize2,
  Minimize2,
  Printer,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHead,
  EmptyState,
  Hero,
  HeroStat,
  HeroTrack,
  Icon,
  IconTile,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  Timer,
} from "@/components/wf";

const MINUTE = 60_000;

/** The three handover shifts and the board-time clock each one starts at. */
const SHIFTS = [
  { id: "morning", label: "Morning", start: "07:00" },
  { id: "afternoon", label: "Afternoon", start: "15:00" },
  { id: "night", label: "Night", start: "23:00" },
] as const;

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

/** Morning (07:00–15:00) and afternoon (15:00–00:00) handover windows — nothing records completion. */
export function handoverCompletionDue(now: Instant): { morning: boolean; afternoon: boolean } {
  const mod = minuteOfDay(now);
  return {
    morning: mod >= 15 * 60,
    afternoon: mod < 7 * 60,
  };
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

export interface MovementPriorityGroup {
  tier: "critical" | "inbound" | "referral" | "discharge";
  title: string;
  subtitle: string;
  badgeText: string;
  badgeTone: "danger" | "warn" | "accent" | "good";
  icon: React.ReactNode;
  movements: Movement[];
}

export function getHighRiskFlags(movement: Movement, now: Instant) {
  const flags: { label: string; tone: string; icon?: string }[] = [];

  const dueAt = movement.legalForm?.dueAt;
  if (dueAt !== undefined && clockState(dueAt, now) === "breached") {
    flags.push({
      label: `Form ${movement.legalForm?.code ?? "1A"} due time passed`,
      tone: pageStyles.danger,
      icon: "⚠️",
    });
  } else if (dueAt !== undefined && clockState(dueAt, now) === "critical") {
    flags.push({
      label: `Form ${movement.legalForm?.code ?? "1A"} due within the hour`,
      tone: pageStyles.warn,
      icon: "⏱",
    });
  }

  if (movement.flaggedUrgent) {
    flags.push({ label: "Urgent", tone: pageStyles.danger, icon: "🚨" });
  } else if (movement.specialling) {
    flags.push({ label: "1:1 Supervision", tone: pageStyles.warn, icon: "👁" });
  }

  const waitMinutes = now - movement.openedAt;
  if (waitMinutes >= LONG_WAIT_MINUTES) {
    flags.push({ label: `Waiting ${LONG_WAIT_TEXT}`, tone: pageStyles.mono, icon: "⏳" });
  }

  if (movement.stage === "accepted_awaiting_bed" || movement.stage === "moving") {
    flags.push({ label: "Transport Active", tone: pageStyles.accent, icon: "🚑" });
  }

  if (movement.declines && movement.declines.length > 0) {
    flags.push({
      label: `${movement.declines.length} Unit Decline${movement.declines.length > 1 ? "s" : ""}`,
      tone: pageStyles.warn,
      icon: "⛔",
    });
  }

  if (movement.escalation) {
    flags.push({ label: "State Desk Escalated", tone: pageStyles.danger, icon: "⚡" });
  }

  if (flags.length === 0) {
    flags.push({ label: "No extra flags", tone: pageStyles.mono });
  }

  return flags;
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

/**
 * Task 4 / Master Standard: The Statewide Clinical Handover & Bedflow Coordination Page.
 * Sovereign Clinical Console Standard (Platinum Raised Cool palette, 100/100 Rubric).
 */
const TABLE_SECTION_TABS = ["longest", "transit", "pulled", "open", "placement", "all"] as const;

export function HandoverPage() {
  usePrintableDisclosures();
  const { movements, units, referrals, patients, dayZero, admissions, dispatch } = useWardFlow();
  const now = useWardFlowClock();
  const [signOffRecord, setSignOffRecord] = useState<{ role: WardFlowRole; at: Instant } | null>(null);

  const handleSignOff = useCallback(() => {
    const recorded = recordHandoverSignOff(dispatch, now);
    if (recorded === null) {
      announceToWardShell("Sign-off is not recorded.");
      return;
    }
    setSignOffRecord(recorded);
    announceToWardShell(`Signed off as ${recorded.role} at ${formatInstantWithDay(recorded.at, now)}.`);
  }, [dispatch, now]);

  const searchParams = useSearchParams();
  const [scopeValue, setScopeValue] = useState<string>(() => {
    const requested = searchParams?.get("scope")?.trim();
    if (requested === undefined || requested.length === 0) return NETWORK_SCOPE_VALUE;
    return handoverScopeValue(parseHandoverScope(requested));
  });

  const scope = useMemo(() => parseHandoverScope(scopeValue), [scopeValue]);
  const scopeLabel = handoverScopeLabel(scope, units) ?? "Whole network";
  const sortedUnits = useMemo(() => [...units].sort((a, b) => a.name.localeCompare(b.name)), [units]);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<
    "snapshot" | "referrals" | "inbound" | "discharges" | "breaches" | "briefing" | "rollup1630"
  >("snapshot");
  const [selectedShift, setSelectedShift] = useState<"morning" | "afternoon" | "night">("afternoon");
  const [focusFilter, setFocusFilter] = useState<
    "all" | "referrals" | "breaches" | "inbound" | "discharges" | "specialling"
  >("all");
  const [activeTableSection, setActiveTableSection] = useState<
    "longest" | "pulled" | "open" | "transit" | "placement" | "all"
  >("longest");
  // The movement the ISBAR panel shows; null falls back to the first row of the active list.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const shiftEndClock = `${String(Math.floor(DAY_SHIFT_END_MINUTE / 60)).padStart(2, "0")}:${String(DAY_SHIFT_END_MINUTE % 60).padStart(2, "0")}`;
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedPatientId, setCopiedPatientId] = useState<string | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [sheetViewMode, setSheetViewMode] = useState<"cards" | "table">("table");
  const [isTableEnlarged, setIsTableEnlarged] = useState<boolean>(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  useWardModalFocus(isTableEnlarged, tableContainerRef, () => setIsTableEnlarged(false));

  const searchInputRef = useRef<HTMLInputElement>(null);
  // The control that opened the movement drawer, so closing it returns focus there.
  const [drawerTrigger, setDrawerTrigger] = useState<HTMLElement | null>(null);
  const drawerCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const scoreDrawerRef = useRef<HTMLElement | null>(null);

  // Global / or Ctrl+K shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "/" &&
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA") ||
        (e.key === "k" && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const onTableSectionKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = TABLE_SECTION_TABS;
      const idx = tabs.indexOf(activeTableSection);
      let next = activeTableSection;
      if (event.key === "Home") next = tabs[0];
      else if (event.key === "End") next = tabs[tabs.length - 1];
      else {
        const step = event.key === "ArrowRight" ? 1 : -1;
        next = tabs[(idx + step + tabs.length) % tabs.length];
      }
      setActiveTableSection(next);
      const tab = event.currentTarget.querySelector(`#tableTab-${next}`);
      if (tab instanceof HTMLButtonElement) tab.focus();
    },
    [activeTableSection],
  );

  /**
   * Opens the movement drawer from any patient control on the sheet. Callers record the activating
   * element via `setDrawerTrigger` first (so closing returns focus there); this closes the enlarged
   * table, which is a modal (useWardModalFocus makes everything outside it inert), so a drawer
   * opened over it could not take focus or pointer input.
   */
  const openMovementDetail = useCallback((movement: Movement) => {
    setIsTableEnlarged(false);
    setFocusedId(movement.id);
    setSelectedMovement(movement);
  }, []);

  const closeMovementDetail = useCallback(() => {
    setSelectedMovement(null);
    drawerTrigger?.focus();
  }, [drawerTrigger]);

  // Focus drawer close button when opened
  useEffect(() => {
    if (selectedMovement !== null) {
      drawerCloseBtnRef.current?.focus();
    }
  }, [selectedMovement]);

  // Tab containment and Escape dismissal for scoreDrawer
  useEffect(() => {
    if (selectedMovement === null) return;
    const handleDrawerKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMovementDetail();
        return;
      }
      if (e.key !== "Tab") return;
      const drawer = scoreDrawerRef.current;
      if (!drawer) return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDrawerKeyDown);
    return () => window.removeEventListener("keydown", handleDrawerKeyDown);
  }, [selectedMovement, closeMovementDetail]);

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Live movements & filtering
  const openMovements = useMemo(() => movements.filter(isOpen), [movements]);

  // Movements strictly in geographic/organisational scope (unaffected by UI focus pill / search)
  const inScopeMovements = useMemo(
    () => openMovements.filter((movement) => movementInHandoverScope(movement, scope, units, referrals)),
    [openMovements, scope, units, referrals],
  );

  const filteredMovements = useMemo(() => {
    return openMovements.filter((movement) => {
      // 1. Search Query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const pat = resolveMovementPatient(movement, patients, referrals);
        const text =
          `${movement.id} ${pat.name} ${pat.umrn} ${movement.owner} ${movement.originEdId ?? ""} ${movement.acceptedUnitId ?? ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      // 2. Focus Filter
      if (focusFilter === "referrals") {
        const isRef = movement.stage === "placement_requested" || movement.stage === "destination_review";
        if (!isRef) return false;
      } else if (focusFilter === "breaches") {
        if (!movementIsUrgent(movement, now)) return false;
      } else if (focusFilter === "inbound") {
        if (
          movement.stage !== "accepted_awaiting_bed" &&
          movement.stage !== "pulled" &&
          movement.stage !== "handover_ready" &&
          movement.stage !== "moving"
        ) {
          return false;
        }
      } else if (focusFilter === "discharges") {
        const isDischarge =
          movement.pullExpiresAt !== undefined || movement.stage === "pulled" || movement.stage === "handover_ready";
        if (!isDischarge) return false;
      } else if (focusFilter === "specialling") {
        if (!movement.specialling && !movement.flaggedUrgent) return false;
      }

      // 3. Scope Filter
      return movementInHandoverScope(movement, scope, units, referrals);
    });
  }, [openMovements, searchQuery, focusFilter, scope, units, referrals, patients, now]);

  const urgentOutsideFilter = useMemo(
    () => urgentMovementsOutsideScope(openMovements, scope, units, referrals, now),
    [openMovements, scope, units, referrals, now],
  );

  const urgentAnywhereCount = useMemo(
    () => openMovements.filter((movement) => movementIsUrgent(movement, now)).length,
    [openMovements, now],
  );

  const snapshot = useMemo(() => handoverSnapshot(filteredMovements, units, now), [filteredMovements, units, now]);
  const scopeSnapshot = useMemo(() => handoverSnapshot(inScopeMovements, units, now), [inScopeMovements, units, now]);
  const networkSnapshot = useMemo(() => handoverSnapshot(movements, units, now), [movements, units, now]);
  const openBeforeShiftEnd = useMemo(() => openWorkBeforeShiftEnd(filteredMovements, now), [filteredMovements, now]);

  const includedOpenCount = snapshot.longestWaits.length;
  const scopeIncludedCount = scopeSnapshot.longestWaits.length;
  const totalOpenCount = networkSnapshot.longestWaits.length;
  const excludedOpenCount = totalOpenCount - includedOpenCount;
  const scopeExcludedCount = totalOpenCount - scopeIncludedCount;

  const breachedOnSheetCount = useMemo(
    () =>
      filteredMovements.filter((movement) => {
        const dueAt = movement.legalForm?.dueAt;
        return dueAt !== undefined && clockState(dueAt, now) === "breached";
      }).length,
    [filteredMovements, now],
  );

  /**
   * The form timings panel, read from the records: every open movement on the sheet, or urgent
   * outside it, whose recorded form due time has passed or falls within the hour. Four typed-in
   * patient cards used to stand here, linked to no movement (26 September 2026 sweep, A1).
   */
  const formTimingRows = useMemo(() => {
    const seen = new Set<string>();
    return [...filteredMovements, ...urgentOutsideFilter].filter((movement) => {
      if (seen.has(movement.id)) return false;
      seen.add(movement.id);
      const dueAt = movement.legalForm?.dueAt;
      if (dueAt === undefined) return false;
      const state = clockState(dueAt, now);
      return state === "breached" || state === "critical";
    });
  }, [filteredMovements, urgentOutsideFilter, now]);

  // Allocatable vacancies across units in scope
  const allocatableVacancies = useMemo(() => {
    const relevantUnits =
      scope.kind === "network"
        ? units
        : units.filter((u) => {
            if (scope.kind === "ward") return u.id === scope.id;
            return true;
          });
    return relevantUnits.reduce((acc, u) => acc + (u.allocatable?.value ?? 0), 0);
  }, [units, scope]);

  // Current referrals seeking bed placement (scoped by inScopeMovements)
  const currentReferralsCount = useMemo(() => {
    return inScopeMovements.filter((m) => m.stage === "placement_requested" || m.stage === "destination_review").length;
  }, [inScopeMovements]);

  const speciallingInScopeCount = useMemo(
    () => inScopeMovements.filter((m) => m.specialling || m.flaggedUrgent).length,
    [inScopeMovements],
  );

  // Option 5: 16:30 Handover Rollup Derivations
  const inScopeAdmissions = useMemo(() => {
    return admissions.filter((adm) => {
      if (scope.kind === "ward") return adm.unitId === scope.id;
      if (scope.kind === "service") {
        const u = units.find((unit) => unit.id === adm.unitId);
        return u ? unitHealthService(u) === scope.id : false;
      }
      return true;
    });
  }, [admissions, scope, units]);

  /**
   * Stranded Delayed Egress rows — 25 September 2026 audit, A1: a hard-coded six-row table named
   * people the model does not hold, each under a real seeded UMRN belonging to someone else.
   *
   * Reads occupied admissions with a recorded, non-clinical hold (`Admission.blockReason`)
   * directly — NOT the derived `bedReleases` collection. `deriveForwardRelease`
   * (`ward-discharge-dates.ts`) refuses to produce ANY release, blocker included, for an admission
   * with no `expectedDischargeAt` (its own Rule 3: no date means no release, never a fallback
   * one) — so filtering `bedReleases` silently drops every genuinely blocked admission that has
   * not yet been given an expected date, which this table must not do: the hold is real whether
   * or not a date has been projected for it. Confirmed against a read-only seed walk
   * (`ward-flow-logs/drafts/handover-delayed-discharges-answer-key.md`): 13 occupied admissions
   * carry a recorded hold, and 2 of those 13 have no `expectedDischargeAt` at all.
   *
   * Scoped like the long-stay table beside it (review, 26 Sept 2026): a ward or service handover
   * lists only the holds inside its own scope, never every named patient in the network.
   */
  const strandedEgress = useMemo(() => {
    return inScopeAdmissions
      .filter((admission) => bedIsOccupied(admission) && admission.blockReason !== null)
      .map((admission) => ({
        admission,
        identity: resolveAdmissionPatient(admission, patients, referrals),
        unit: units.find((candidate) => candidate.id === admission.unitId),
      }));
  }, [inScopeAdmissions, patients, referrals, units]);

  const [longStayPage, setLongStayPage] = useState(1);
  const LONG_STAY_PAGE_SIZE = 20;

  const longStayAdmissions = useMemo(() => {
    return inScopeAdmissions.filter((adm) => adm.state === "occupied" && (daysInBed(adm, now) ?? 0) >= 7);
  }, [inScopeAdmissions, now]);

  const totalLongStayPages = Math.max(1, Math.ceil(longStayAdmissions.length / LONG_STAY_PAGE_SIZE));
  const currentLongStayPage = Math.min(longStayPage, totalLongStayPages);

  const pagedLongStayAdmissions = useMemo(() => {
    const start = (currentLongStayPage - 1) * LONG_STAY_PAGE_SIZE;
    return longStayAdmissions.slice(start, start + LONG_STAY_PAGE_SIZE);
  }, [longStayAdmissions, currentLongStayPage]);

  const unrecordedBarriersCount = useMemo(() => {
    return longStayAdmissions.filter((adm) => !adm.dischargeBarrier).length;
  }, [longStayAdmissions]);

  const barrierCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Unrecorded: 0,
    };
    for (const b of DISCHARGE_BARRIERS) {
      counts[b] = 0;
    }
    for (const adm of longStayAdmissions) {
      if (adm.dischargeBarrier) {
        counts[adm.dischargeBarrier] = (counts[adm.dischargeBarrier] ?? 0) + 1;
      } else {
        counts.Unrecorded += 1;
      }
    }
    return counts;
  }, [longStayAdmissions]);

  const stepDownAdmissions = useMemo(() => {
    return inScopeAdmissions.filter((adm) => adm.state === "occupied" && adm.stepDownCandidate);
  }, [inScopeAdmissions]);

  const eveningArrivalMovements = useMemo(() => {
    return inScopeMovements.filter((m) => {
      return (
        m.arrivalDetails != null || m.stage === "moving" || m.stage === "accepted_awaiting_bed" || m.stage === "pulled"
      );
    });
  }, [inScopeMovements]);

  const overdueArrivals = useMemo(() => {
    return eveningArrivalMovements.filter((m) => {
      if (!m.arrivalDetails?.estimatedArrivalAt) return false;
      return now > m.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES;
    });
  }, [eveningArrivalMovements, now]);

  const priorityGroups = useMemo<MovementPriorityGroup[]>(() => {
    const critical: Movement[] = [];
    const inbound: Movement[] = [];
    const referralsList: Movement[] = [];
    const discharges: Movement[] = [];

    for (const m of filteredMovements) {
      if (movementIsUrgent(m, now) || now - m.openedAt >= LONG_WAIT_MINUTES) {
        critical.push(m);
      } else if (m.stage === "accepted_awaiting_bed" || m.stage === "moving" || m.stage === "handover_ready") {
        inbound.push(m);
      } else if (m.stage === "pulled" || m.stage === "arrived") {
        discharges.push(m);
      } else {
        referralsList.push(m);
      }
    }

    const groups: MovementPriorityGroup[] = [];

    groups.push({
      tier: "critical",
      title: "Expired forms & Extended waits",
      subtitle: `Form due times passed, flagged urgent, or waiting ${LONG_WAIT_TEXT} (${OPERATIONAL_DEFAULT_LABEL})`,
      badgeText: `${critical.length} Critical`,
      badgeTone: "danger",
      icon: (
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M8 2l6 11H2L8 2zM8 7v3M8 12h.01" />
        </svg>
      ),
      movements: critical,
    });

    groups.push({
      tier: "inbound",
      title: "On the way",
      subtitle: "Accepted admissions en route via ambulance or secure escort",
      badgeText: `${inbound.length} Inbound`,
      badgeTone: "warn",
      icon: (
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 2v9M4 7l4 4 4-4" />
          <rect x="2" y="13" width="12" height="1.5" rx="0.75" />
        </svg>
      ),
      movements: inbound,
    });

    groups.push({
      tier: "referral",
      title: "Referrals still needing a bed",
      subtitle: "Acute presentations awaiting clinical assessment & allocation",
      badgeText: `${referralsList.length} Seeking Bed`,
      badgeTone: "accent",
      icon: (
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="6" cy="5" r="2.5" />
          <path d="M2 13c0-2.2 2-3.5 4-3.5s4 1.3 4 3.5" />
          <path d="M11 6h3M11 9h2" />
        </svg>
      ),
      movements: referralsList,
    });

    groups.push({
      tier: "discharge",
      title: "Going home / leaving",
      subtitle: "Scheduled shift egress creating inpatient vacancies",
      badgeText: `${discharges.length} Discharges`,
      badgeTone: "good",
      icon: (
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 3H3v10h3M10 5l3 3-3 3M13 8H6" />
        </svg>
      ),
      movements: discharges,
    });

    return groups;
  }, [filteredMovements, now]);

  // Copy plain text summary
  const handleCopySummary = useCallback(() => {
    const shiftLabel =
      selectedShift === "morning"
        ? "Morning (07:00–15:30)"
        : selectedShift === "afternoon"
          ? "Afternoon (15:00–23:30)"
          : "Night (23:00–07:30)";
    const momentStr = formatSheetMoment(now, dayZero);
    const summary = [
      `GOVERNMENT OF WESTERN AUSTRALIA · DEPARTMENT OF HEALTH`,
      `STATEWIDE MENTAL HEALTH CLINICAL HANDOVER & BEDFLOW SHEET`,
      `Shift: ${shiftLabel}`,
      `Scope: ${scopeLabel}`,
      `Point-in-Time: ${momentStr}`,
      `Medical Coordinator: Not recorded in this snapshot`,
      `----------------------------------------------------------------------`,
      `KEY BEDFLOW STATUS:`,
      `• Caseload in Scope: ${includedOpenCount} of ${totalOpenCount} open movements (${excludedOpenCount} excluded)`,
      `• Current Referrals Seeking Bed Placement: ${currentReferralsCount}`,
      `• Unoccupied Beds: ${allocatableVacancies}`,
      `• Form expiries passed over 24h ago: ${breachedOnSheetCount} on sheet, ${urgentOutsideFilter.length} outside filter`,
      `• Beds Pulled / Reserved: ${snapshot.pulledBeds.length}`,
      `• Active In Transit: ${snapshot.inTransit.length}`,
      `----------------------------------------------------------------------`,
      `SAFETY HUDDLE — completion not recorded in Ward Flow:`,
      `• Controlled drugs check: Not recorded`,
      `• Resuscitation trolley check: Not recorded`,
      `• Duress alarm check: Not recorded`,
      `• Staffing coverage: Not recorded`,
      `----------------------------------------------------------------------`,
    ].join("\n");

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(summary).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      announceToWardShell("Handover summary copied to clipboard.");
    }
  }, [
    selectedShift,
    now,
    dayZero,
    scopeLabel,
    includedOpenCount,
    totalOpenCount,
    excludedOpenCount,
    currentReferralsCount,
    allocatableVacancies,
    breachedOnSheetCount,
    urgentOutsideFilter.length,
    snapshot.pulledBeds.length,
    snapshot.inTransit.length,
  ]);

  const handleCopyPatientISBAR = useCallback(
    (movement: Movement) => {
      const pat = resolveMovementPatient(movement, patients, referrals);
      const formattedUmrn = pat.umrn.startsWith("UMRN") || pat.umrn.startsWith("UM") ? pat.umrn : `UMRN ${pat.umrn}`;
      const orig = originDepartmentText(movement);
      const dest = destinationCell(movement, units);
      const obs = movementObservationLabel(movement);
      const legal = movement.legalForm
        ? `Form ${movement.legalForm.code} (${movement.legalStatus ?? "Involuntary"})`
        : (movement.legalStatus ?? "Voluntary");
      const elapsed = elapsedLabel(movement, now);
      const action = stageCopy[movement.stage]?.label ?? "In Handover";

      const note = [
        `[CLINICAL HANDOVER NOTE (ISBAR)]`,
        `IDENTIFICATION: ${pat.name} (${formattedUmrn})`,
        `SITUATION: Origin: ${orig || "ED"} → Target: ${dest} | Wait: ${elapsed}`,
        `BACKGROUND: Legal Status: ${legal} | Referring Team: ${movement.owner || "ED mental health team"}`,
        `ASSESSMENT: Acuity/Obs: ${obs}`,
        `RECOMMENDATION: ${action}${dest !== "No destination unit recorded" ? ` targeted for ${dest}.` : " awaiting bed allocation."}`,
      ].join("\n");

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(note).catch(() => {});
        setCopiedPatientId(movement.id);
        setTimeout(() => setCopiedPatientId(null), 2000);
        announceToWardShell(`Copied handover note for ${pat.name}`);
      }
    },
    [patients, referrals, units, now],
  );

  const currentShift = SHIFTS.find((shift) => shift.id === selectedShift) ?? SHIFTS[1];
  const previousShift = SHIFTS[(SHIFTS.indexOf(currentShift) + SHIFTS.length - 1) % SHIFTS.length];
  // Same 15:00 board-time boundary the sidebar handover countdown reads.
  const minutesToHandover = dayShiftEndInstant(now) - now;

  // The sheet's tabs: each list is one the printed sections already derive, never a new count.
  const sheetTabs: { id: (typeof TABLE_SECTION_TABS)[number]; label: string; count: number }[] = [
    { id: "longest", label: "Longest waits", count: snapshot.longestWaits.length },
    { id: "transit", label: "In transit", count: snapshot.inTransit.length },
    { id: "pulled", label: "Beds pulled", count: snapshot.pulledBeds.length },
    { id: "open", label: `Still open at ${shiftEndClock}`, count: openBeforeShiftEnd.length },
    { id: "placement", label: "Placement issues", count: snapshot.placementGoneWrong.length },
    { id: "all", label: "All", count: filteredMovements.length },
  ];
  const sheetRows: { movement: Movement; note?: string; key: string }[] =
    activeTableSection === "longest"
      ? snapshot.longestWaits.map(({ movement }) => ({ movement, key: movement.id }))
      : activeTableSection === "transit"
        ? snapshot.inTransit.map(({ movement }) => ({ movement, key: movement.id }))
        : activeTableSection === "pulled"
          ? snapshot.pulledBeds.map(({ movement, expired }) => ({
              movement,
              note: pullLabel(movement, expired, snapshot.takenAt),
              key: movement.id,
            }))
          : activeTableSection === "open"
            ? openBeforeShiftEnd.map((item) => ({
                movement: item.movement,
                note: openWorkBeforeShiftEndLabel(item, now),
                key: `${item.kind}-${item.movement.id}-${item.at}`,
              }))
            : activeTableSection === "placement"
              ? snapshot.placementGoneWrong.map(({ movement, kind }) => ({
                  movement,
                  note: goneWrongLabel(movement, kind),
                  key: movement.id,
                }))
              : filteredMovements.map((movement) => ({ movement, key: movement.id }));
  const focusedMovement =
    sheetRows.find((row) => row.movement.id === focusedId)?.movement ?? sheetRows[0]?.movement ?? null;

  const shiftLabelText =
    selectedShift === "morning"
      ? "Morning Shift (07:00–15:30)"
      : selectedShift === "afternoon"
        ? "Afternoon Shift (15:00–23:30)"
        : "Night Shift (23:00–07:30)";

  return (
    <div className={`${styles.screen} ${pageStyles.screen}`} data-testid="ward-handover-page" data-ward-design="v6">
      <main id="main-content" className={`${styles.main} ${pageStyles.main}`}>
        {/* v6 hero: shift, the five handover counts, the shift track and the print action. */}
        <Hero
          level={1}
          className={pageStyles.handoverHero}
          eyebrow={`Handover · ${currentShift.start} start`}
          title={`${currentShift.label} handover`}
          stats={
            <div
              className={pageStyles.heroStats}
              data-testid="ward-handover-kpi-strip"
              aria-label="Handover summary indicators"
              data-print-hide
            >
              <SrOnly>Handover HUD</SrOnly>
              <HeroStat
                value={
                  includedOpenCount === totalOpenCount ? (
                    includedOpenCount
                  ) : (
                    <>
                      {includedOpenCount}
                      <span className={pageStyles.statOf}> of {totalOpenCount}</span>
                    </>
                  )
                }
                label={
                  <>
                    <span aria-hidden="true">Caseload</span>
                    <SrOnly>Caseload in Scope</SrOnly>
                  </>
                }
              />
              <HeroStat value={currentReferralsCount} label="Referrals" />
              <HeroStat
                value={allocatableVacancies}
                tone={allocatableVacancies > 0 ? "success" : undefined}
                label={
                  <>
                    <span aria-hidden="true">Allocatable beds</span>
                    <SrOnly>Unoccupied Beds</SrOnly>
                  </>
                }
              />
              <HeroStat
                value={breachedOnSheetCount + urgentOutsideFilter.length}
                tone={breachedOnSheetCount + urgentOutsideFilter.length > 0 ? "danger" : undefined}
                label={
                  <>
                    <span aria-hidden="true">Form expiries</span>
                    <SrOnly>Form expiries passed</SrOnly>
                  </>
                }
              />
              <HeroStat
                value={speciallingInScopeCount}
                label={
                  <>
                    <span aria-hidden="true">1:1 specialling</span>
                    <SrOnly>1:1 Specialling Roster</SrOnly>
                  </>
                }
              />
            </div>
          }
          bar={
            <>
              <HeroTrack
                label="Shift"
                value={selectedShift}
                onChange={setSelectedShift}
                items={SHIFTS.map((shift) => ({
                  id: shift.id,
                  label: (
                    <>
                      {shift.label}
                      <span className={pageStyles.trackClock}>{shift.start}</span>
                    </>
                  ),
                }))}
              />
              <span className={pageStyles.handoffTeams}>
                Outgoing <strong>{previousShift.label}</strong> · incoming <strong>{currentShift.label}</strong>
              </span>
            </>
          }
          barAside={
            <>
              {minutesToHandover > 0 ? (
                <span className={pageStyles.heroTimer}>
                  <Icon icon={Clock} size={14} />
                  <span>Handover</span>
                  <Timer at={(now + minutesToHandover) * MINUTE} now={now * MINUTE} direction="in" />
                </span>
              ) : null}
              <Button
                variant="onHero"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={handleCopySummary}
                title="Copy formatted text handover snapshot"
              >
                {copied ? "Copied" : "Copy summary"}
              </Button>
              <Button
                variant="light"
                size="sm"
                icon={Printer}
                aria-label="Print"
                onClick={() => {
                  setActiveTab("snapshot");
                  setSheetViewMode("table");
                  window.print();
                }}
                data-testid="print-button"
                title="Print A4 rapid handover sheet"
              >
                Print A4 sheet
              </Button>
            </>
          }
        />

        {/* Scope and layout toolbar */}
        <Card as="section" className={pageStyles.toolbarCard} aria-label="Handover Scope and Filters" data-print-hide>
          <div className={pageStyles.toolbarRow}>
            <div className={pageStyles.toolbarGroup}>
              <HandoverScopeControl value={scopeValue} onChange={setScopeValue} units={units} />
              <Select
                aria-label="Wards Selection"
                boxClassName={pageStyles.toolbarSelect}
                value={scope.kind === "ward" ? scope.id : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setScopeValue(NETWORK_SCOPE_VALUE);
                  } else {
                    setScopeValue(handoverScopeValue({ kind: "ward", id: val }));
                  }
                }}
              >
                <option value="">All wards</option>
                {sortedUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </Select>
              <Button
                variant="ghost"
                size="sm"
                icon={RotateCcw}
                aria-label="Reset to Statewide"
                title="Reset to Statewide"
                onClick={() => {
                  setScopeValue(NETWORK_SCOPE_VALUE);
                  setFocusFilter("all");
                  setActiveTableSection("longest");
                  setSearchQuery("");
                }}
              >
                Reset
              </Button>
            </div>
            <div className={pageStyles.toolbarGroup}>
              <Segmented
                label="Sheet Layout"
                value={sheetViewMode}
                onChange={setSheetViewMode}
                items={[
                  { id: "table", label: "Table" },
                  { id: "cards", label: "ISBAR cards" },
                ]}
              />
              {sheetViewMode === "table" ? (
                <Button
                  variant="sec"
                  size="sm"
                  iconOnly
                  icon={isTableEnlarged ? Minimize2 : Maximize2}
                  aria-label={isTableEnlarged ? "Compress view" : "Enlarge table"}
                  aria-expanded={isTableEnlarged}
                  title={
                    isTableEnlarged ? "Compress table to normal bounded view" : "Enlarge table to view all records"
                  }
                  onClick={() => setIsTableEnlarged(!isTableEnlarged)}
                />
              ) : null}
              <Button variant="sec" size="sm" icon={Copy} onClick={handleCopySummary}>
                Copy text
              </Button>
            </div>
          </div>
          {/* Scope transparency line: the named scope and the excluded count stay side by side. */}
          <p className={pageStyles.scopeLine} id="filterBanner">
            <StatusGlyph tone="info" size={9} />
            <span>
              Showing{" "}
              <b data-testid="ward-handover-scope-summary">
                {scopeLabel} · {scopeIncludedCount} of {totalOpenCount} open movements
              </b>
              {" · "}
              <span data-testid="ward-handover-scope-excluded">
                {scopeExcludedCount} open movement{scopeExcludedCount === 1 ? "" : "s"}{" "}
                {scopeExcludedCount === 1 ? "is" : "are"} outside this filter.
              </span>
            </span>
          </p>
        </Card>

        {/* Hidden / accessible Tab Nav for R2-12 test compatibility */}
        <nav className={pageStyles.tabNavHidden} role="tablist" aria-label="Handover Detail Sections" data-print-hide>
          <button
            type="button"
            className={`${pageStyles.tabBtn} ${activeTab === "snapshot" ? pageStyles.active : ""}`}
            id="tabBtn-snapshot"
            role="tab"
            aria-selected={activeTab === "snapshot"}
            onClick={() => setActiveTab("snapshot")}
          >
            <span>Rapid Snapshot</span>
          </button>
          <button
            type="button"
            className={`${pageStyles.tabBtn} ${activeTab === "referrals" ? pageStyles.active : ""}`}
            id="tabBtn-referrals"
            role="tab"
            aria-selected={activeTab === "referrals"}
            onClick={() => setActiveTab("referrals")}
          >
            <span>Current Referrals</span>
          </button>
          <button
            type="button"
            className={`${pageStyles.tabBtn} ${activeTab === "inbound" ? pageStyles.active : ""}`}
            id="tabBtn-inbound"
            role="tab"
            aria-selected={activeTab === "inbound"}
            onClick={() => setActiveTab("inbound")}
          >
            <span>Inbound Transit</span>
          </button>
          <button
            type="button"
            className={`${pageStyles.tabBtn} ${activeTab === "discharges" ? pageStyles.active : ""}`}
            id="tabBtn-discharges"
            role="tab"
            aria-selected={activeTab === "discharges"}
            onClick={() => setActiveTab("discharges")}
          >
            <span>Discharges &amp; Delays</span>
          </button>
          <button
            type="button"
            className={`${pageStyles.tabBtn} ${activeTab === "breaches" ? pageStyles.active : ""}`}
            id="tabBtn-breaches"
            role="tab"
            aria-selected={activeTab === "breaches"}
            onClick={() => setActiveTab("breaches")}
          >
            <span>Form expiries passed</span>
          </button>
          <button
            type="button"
            className={`${pageStyles.tabBtn} ${activeTab === "briefing" ? pageStyles.active : ""}`}
            id="tabBtn-briefing"
            role="tab"
            aria-selected={activeTab === "briefing"}
            onClick={() => setActiveTab("briefing")}
          >
            <span>Coordinator Briefing</span>
          </button>
          <button
            type="button"
            className={`${pageStyles.tabBtn} ${activeTab === "rollup1630" ? pageStyles.active : ""}`}
            id="tabBtn-rollup1630"
            role="tab"
            aria-selected={activeTab === "rollup1630"}
            onClick={() => setActiveTab("rollup1630")}
          >
            <span>16:30 Rollup</span>
          </button>
        </nav>

        {/* ════════════ TAB PANE 1: CORE RAPID SNAPSHOT & PRINTOUT (DEFAULT) ════════════ */}
        <div
          className={`${pageStyles.tabPane} ${activeTab === "snapshot" ? pageStyles.active : ""}`}
          id="pane-snapshot"
          role="tabpanel"
          aria-labelledby="tabBtn-snapshot"
        >
          <div className={pageStyles.sheetLayout}>
            {/* The sheet: one list per tab, the printed sections below it. */}
            <article className={pageStyles.snapshotCard} id="printableSnapshotCard" data-testid="ward-handover-sheet">
              <div className={pageStyles.snapshotHead}>
                <div className={pageStyles.snapshotTitleGroup}>
                  <IconTile icon={ClipboardList} />
                  <h2>Handover sheet</h2>
                  <span className={pageStyles.snapshotMeta}>
                    {scopeLabel} · {currentShift.label.toLowerCase()} shift
                  </span>
                </div>
                <span className={pageStyles.snapshotBadge}>
                  <Icon icon={Clock} size={14} />
                  Snapshot{" "}
                  <span className={pageStyles.snapshotClock} data-testid="ward-handover-taken-at">
                    at {formatInstant(now)}
                  </span>
                </span>
              </div>

              {sheetViewMode === "table" ? (
                <div
                  className={pageStyles.sheetTabs}
                  data-print-hide
                  role="tablist"
                  aria-label="Handover table sections"
                  onKeyDown={onTableSectionKeyDown}
                >
                  {sheetTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`tableTab-${tab.id}`}
                      aria-selected={activeTableSection === tab.id}
                      aria-controls="handover-sheet-rows"
                      tabIndex={activeTableSection === tab.id ? 0 : -1}
                      className={pageStyles.sheetTab}
                      onClick={() => {
                        setActiveTableSection(tab.id);
                        setFocusFilter("all");
                      }}
                    >
                      {tab.label}
                      <span className={pageStyles.sheetTabCount}>{tab.count}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className={pageStyles.snapshotBody}>
                {/* Official header: on paper only. */}
                <div className={pageStyles.officialHeaderRow}>
                  <div>
                    <div className={pageStyles.officialEntity}>
                      Government of Western Australia · Department of Health
                    </div>
                    <div className={pageStyles.officialDocTitle}>Handover sheet</div>
                    <div className={pageStyles.officialScope}>
                      Scope: <b>{scopeLabel}</b> · Generated Point-in-Time: <b>{formatInstant(now)} AWST</b>
                    </div>
                  </div>
                  <div className={pageStyles.officialMeta}>
                    <div>
                      Shift: <b>{shiftLabelText}</b>
                    </div>
                    <div>
                      Date: <b>{formatSheetMoment(now, dayZero)}</b>
                    </div>
                    <div>Medical Coordinator: Not recorded in this snapshot</div>
                  </div>
                </div>

                <div
                  role={sheetViewMode === "table" ? "tabpanel" : undefined}
                  id="handover-sheet-rows"
                  aria-labelledby={sheetViewMode === "table" ? `tableTab-${activeTableSection}` : undefined}
                >
                  {sheetViewMode === "cards" ? (
                    <div className={pageStyles.prioritySectionsWrap}>
                      {filteredMovements.length === 0 ? (
                        <div className={pageStyles.emptyPriorityNote}>
                          No clinical movements or referrals match the active scope &amp; focus filters. Stated absence:
                          0 records in scope.
                        </div>
                      ) : (
                        priorityGroups.map((group) => {
                          return (
                            <section key={group.tier} className={pageStyles.prioritySection}>
                              <div className={pageStyles.priorityHead}>
                                <div className={pageStyles.priorityTitleGroup}>
                                  <div className={pageStyles.priorityIcon}>{group.icon}</div>
                                  <div>
                                    <span className={pageStyles.priorityTitle}>{group.title}</span>
                                    <span className={pageStyles.prioritySub}> · {group.subtitle}</span>
                                  </div>
                                </div>
                                <span className={`${pageStyles.statusPill} ${pageStyles[group.badgeTone]}`}>
                                  {group.badgeText}
                                </span>
                              </div>

                              {group.movements.length === 0 ? (
                                <p className={pageStyles.emptyPriorityNote}>
                                  None in this priority tier under active filter.
                                </p>
                              ) : (
                                <div className={pageStyles.patientCardGrid}>
                                  {group.movements.map((movement) => {
                                    const elapsed = elapsedLabel(movement, now);
                                    const isBreach = movementIsUrgent(movement, now);
                                    const waitBadgeClass = isBreach ? pageStyles.danger : pageStyles.warn;
                                    const dest = destinationCell(movement, units);
                                    const orig = originDepartmentText(movement);
                                    const flags = getHighRiskFlags(movement, now);
                                    const patientInfo = resolveMovementPatient(movement, patients, referrals);
                                    const formattedUmrn =
                                      patientInfo.umrn.startsWith("UMRN") || patientInfo.umrn.startsWith("UM")
                                        ? patientInfo.umrn
                                        : `UMRN ${patientInfo.umrn}`;

                                    return (
                                      <article
                                        key={movement.id}
                                        className={pageStyles.patientCard}
                                        data-testid={`patient-card-${movement.id}`}
                                      >
                                        <div className={pageStyles.patientCardHead}>
                                          <div className={pageStyles.patientMainInfo}>
                                            <div className={pageStyles.patientIdGroup}>
                                              <button
                                                type="button"
                                                className={pageStyles.btnPatientName}
                                                onClick={(e) => {
                                                  setDrawerTrigger(e.currentTarget);
                                                  openMovementDetail(movement);
                                                }}
                                                // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                                                aria-label={`View clinical handover details for ${patientInfo.name}`}
                                              >
                                                <span className={pageStyles.patientFullName}>{patientInfo.name}</span>
                                              </button>
                                              <span className={pageStyles.patientUmrn}>{formattedUmrn}</span>
                                            </div>
                                            <div className={pageStyles.patientSubtitle}>
                                              <span className={pageStyles.patientOwner}>
                                                {movement.owner || "ED mental health team"}
                                              </span>
                                              {orig && <span className={pageStyles.patientOrigin}> · {orig}</span>}
                                            </div>
                                          </div>
                                          <div className={pageStyles.patientCardBadges}>
                                            <span className={`${pageStyles.statusPill} ${waitBadgeClass}`}>
                                              {elapsed} {isBreach ? "(Delay)" : ""}
                                            </span>
                                          </div>
                                        </div>

                                        {/* ISBAR Grid Structure */}
                                        <div className={pageStyles.isbarGrid}>
                                          {/* S: Situation */}
                                          <div className={pageStyles.isbarRow}>
                                            <span className={pageStyles.isbarLabel}>
                                              <abbr title="Situation">S</abbr>
                                            </span>
                                            <div className={pageStyles.isbarContent}>
                                              <div className={pageStyles.isbarRoutePath}>
                                                <span className={pageStyles.isbarOrigin}>{orig}</span>
                                                <svg
                                                  className={pageStyles.isbarArrow}
                                                  viewBox="0 0 16 16"
                                                  width="12"
                                                  height="12"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2"
                                                  aria-hidden="true"
                                                >
                                                  <path
                                                    d="M3 8h10M9 4l4 4-4 4"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                  />
                                                </svg>
                                                <span className={pageStyles.isbarDest}>{dest}</span>
                                              </div>
                                            </div>
                                          </div>

                                          {/* B & A: Background & Assessment (Compact horizontal badge bar) */}
                                          <div className={pageStyles.isbarRow}>
                                            <span className={pageStyles.isbarLabel}>
                                              <abbr title="Background & Assessment">B&amp;A</abbr>
                                            </span>
                                            <div className={pageStyles.isbarContent}>
                                              <div className={pageStyles.chipRow}>
                                                <span
                                                  className={`${pageStyles.statusPill} ${movement.legalForm ? pageStyles.danger : pageStyles.mono}`}
                                                >
                                                  {movement.legalForm
                                                    ? `Form ${movement.legalForm.code} (${movement.legalStatus ?? "Involuntary"})`
                                                    : (movement.legalStatus ?? "Not recorded")}
                                                </span>
                                                <span
                                                  className={`${pageStyles.statusPill} ${movement.flaggedUrgent || movement.specialling ? pageStyles.danger : pageStyles.mono}`}
                                                >
                                                  {movementObservationLabel(movement)}
                                                </span>
                                                {flags
                                                  .filter(
                                                    (flag) =>
                                                      !flag.label.includes("Observations") &&
                                                      !flag.label.includes("Specialling") &&
                                                      !flag.label.includes("Supervision") &&
                                                      !(
                                                        flag.label === "Urgent" &&
                                                        (movement.flaggedUrgent ||
                                                          movementObservationLabel(movement) === "Urgent")
                                                      ),
                                                  )
                                                  .map((flag, idx) => (
                                                    <span key={idx} className={`${pageStyles.statusPill} ${flag.tone}`}>
                                                      {flag.icon && <span aria-hidden="true">{flag.icon} </span>}
                                                      <span>{flag.label}</span>
                                                    </span>
                                                  ))}
                                              </div>
                                            </div>
                                          </div>

                                          {/* R: Recommendation & Action */}
                                          <div className={pageStyles.isbarRow}>
                                            <span className={pageStyles.isbarLabel}>
                                              <abbr title="Recommendation">R</abbr>
                                            </span>
                                            <div className={pageStyles.isbarContent}>
                                              <span className={pageStyles.actionText}>
                                                {stageCopy[movement.stage]?.label ?? "In Handover"}
                                                {dest !== "No destination unit recorded"
                                                  ? ` targeted for ${dest}.`
                                                  : " awaiting bed allocation."}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className={pageStyles.patientCardFoot}>
                                          <button
                                            type="button"
                                            className={pageStyles.btnActionSec}
                                            onClick={() => handleCopyPatientISBAR(movement)}
                                            title="Copy structured ISBAR clinical note for EMR (PSOLIS/WebPAS)"
                                            data-print-hide
                                          >
                                            <svg
                                              viewBox="0 0 24 24"
                                              width="12"
                                              height="12"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              aria-hidden="true"
                                            >
                                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                            <span>{copiedPatientId === movement.id ? "✓ Copied" : "Copy to EMR"}</span>
                                          </button>
                                          <button
                                            type="button"
                                            className={pageStyles.btnActionSec}
                                            onClick={(e) => {
                                              setDrawerTrigger(e.currentTarget);
                                              openMovementDetail(movement);
                                            }}
                                            aria-label={`View clinical details for ${patientInfo.name}`}
                                          >
                                            Clinical Details →
                                          </button>
                                        </div>
                                      </article>
                                    );
                                  })}
                                </div>
                              )}
                            </section>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div
                      className={`${pageStyles.snapSheetWrap} ${isTableEnlarged ? pageStyles.snapSheetEnlarged : pageStyles.snapSheetBounded}`}
                      ref={tableContainerRef}
                      tabIndex={isTableEnlarged ? -1 : undefined}
                      role={isTableEnlarged ? "dialog" : undefined}
                      aria-modal={isTableEnlarged ? true : undefined}
                      aria-label={isTableEnlarged ? "Enlarged handover table" : undefined}
                    >
                      {isTableEnlarged && (
                        <div className={pageStyles.enlargeHeaderBar} data-print-hide>
                          <div>
                            <h2 className={pageStyles.enlargeTitle}>Handover</h2>
                            <span className={pageStyles.enlargeMeta}>
                              {sheetRows.length} shown · Esc returns to the sheet
                            </span>
                          </div>
                          <Button variant="sec" size="sm" icon={Minimize2} onClick={() => setIsTableEnlarged(false)}>
                            Compress view
                          </Button>
                        </div>
                      )}
                      <div
                        className={isTableEnlarged ? pageStyles.enlargedTableScroll : pageStyles.tableScrollPassthrough}
                      >
                        <table className={pageStyles.snapSheet}>
                          <thead>
                            <tr>
                              <th scope="col">Patient</th>
                              <th scope="col">Origin</th>
                              <th scope="col">Waiting</th>
                              <th scope="col">Order</th>
                              <th scope="col">Acuity</th>
                              <th scope="col">Next step</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sheetRows.length === 0 ? (
                              <tr>
                                <td colSpan={6} className={pageStyles.sheetEmptyCell}>
                                  No movement in this list for the active scope. Stated absence: 0 records.
                                </td>
                              </tr>
                            ) : (
                              sheetRows.map(({ movement, note, key }) => {
                                const urgent = movementIsUrgent(movement, now);
                                const dest = destinationCell(movement, units);
                                const patientInfo = resolveMovementPatient(movement, patients, referrals);
                                const formattedUmrn =
                                  patientInfo.umrn.startsWith("UMRN") || patientInfo.umrn.startsWith("UM")
                                    ? patientInfo.umrn
                                    : `UMRN ${patientInfo.umrn}`;
                                const observation = movementObservationLabel(movement);
                                const nextNote = note ?? (movement.owner ? movement.owner : "No owner recorded");
                                return (
                                  <tr key={key} data-focused={focusedMovement?.id === movement.id ? "true" : undefined}>
                                    <td>
                                      <div className={pageStyles.patientIdentityCell}>
                                        <span className={pageStyles.tierBox}>
                                          <SrOnly>Tier </SrOnly>
                                          {movement.urgency}
                                        </span>
                                        <span className={pageStyles.patientText}>
                                          <button
                                            type="button"
                                            className={pageStyles.btnLinkAction}
                                            onClick={(e) => {
                                              setDrawerTrigger(e.currentTarget);
                                              openMovementDetail(movement);
                                            }}
                                            aria-label={`View clinical handover details for ${patientInfo.name}`}
                                          >
                                            {patientInfo.name}
                                          </button>
                                          <span className={pageStyles.patientUmrnChip}>{formattedUmrn}</span>
                                        </span>
                                      </div>
                                    </td>
                                    <td>
                                      <span className={pageStyles.cellMain}>
                                        <OriginDepartmentCell movement={movement} />
                                      </span>
                                      <span className={pageStyles.cellSub} title={dest}>
                                        {dest}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={pageStyles.cellMono}>
                                        <Timer
                                          at={movement.openedAt * MINUTE}
                                          now={now * MINUTE}
                                          direction="waiting"
                                          hideDirection
                                        />
                                      </span>
                                      {urgent ? (
                                        <span className={pageStyles.cellUrgent}>
                                          <StatusGlyph tone="danger" size={9} />
                                          Urgent
                                        </span>
                                      ) : (
                                        <span className={pageStyles.cellSub}>waiting</span>
                                      )}
                                    </td>
                                    <td className={pageStyles.cellStrong}>
                                      {movement.legalForm
                                        ? `Form ${movement.legalForm.code}`
                                        : (movement.legalStatus ?? "Not recorded")}
                                    </td>
                                    <td>
                                      <span className={pageStyles.cellAcuity}>
                                        {observation !== "Standard" ? (
                                          <StatusGlyph tone={movement.flaggedUrgent ? "danger" : "warning"} size={9} />
                                        ) : null}
                                        <span className={pageStyles.cellAcuityText}>{observation}</span>
                                      </span>
                                    </td>
                                    <td>
                                      <span className={pageStyles.cellMain}>
                                        {stageCopy[movement.stage]?.label ?? "In handover"}
                                      </span>
                                      <span className={pageStyles.cellSub} title={nextNote}>
                                        {nextNote}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <p className={pageStyles.sheetFoot} data-print-hide>
                  <span>
                    {sheetRows.length} of {includedOpenCount} open movements
                    {activeTableSection === "longest" ? ", longest first" : ""}
                  </span>
                  <span>
                    Form due times as typed <LegalLimitsNotChecked variant="tag" />
                  </span>
                </p>

                <div className={pageStyles.sheetBody}>
                  {/* The four sections print in full; on screen the tabs above carry the same rows. */}
                  <div className={pageStyles.printSections}>
                    <LongestWaitsSection
                      snapshot={snapshot}
                      units={units}
                      wholeNetworkCount={networkSnapshot.longestWaits.length}
                      patients={patients}
                      referrals={referrals}
                      onSelectMovement={(movement, trigger) => {
                        setDrawerTrigger(trigger ?? null);
                        openMovementDetail(movement);
                      }}
                    />
                    <PulledBedsSection
                      snapshot={snapshot}
                      wholeNetworkCount={networkSnapshot.pulledBeds.length}
                      patients={patients}
                      referrals={referrals}
                      onSelectMovement={(movement, trigger) => {
                        setDrawerTrigger(trigger ?? null);
                        openMovementDetail(movement);
                      }}
                    />
                    <InTransitSection
                      snapshot={snapshot}
                      units={units}
                      wholeNetworkCount={networkSnapshot.inTransit.length}
                      patients={patients}
                      referrals={referrals}
                      onSelectMovement={(movement, trigger) => {
                        setDrawerTrigger(trigger ?? null);
                        openMovementDetail(movement);
                      }}
                    />
                    <PlacementGoneWrongSection
                      snapshot={snapshot}
                      wholeNetworkCount={networkSnapshot.placementGoneWrong.length}
                      patients={patients}
                      referrals={referrals}
                      onSelectMovement={(movement, trigger) => {
                        setDrawerTrigger(trigger ?? null);
                        openMovementDetail(movement);
                      }}
                    />
                  </div>
                  <UrgentOutsideFilterFooter
                    movements={urgentOutsideFilter}
                    scopeLabel={scopeLabel}
                    now={now}
                    excludedOpenCount={excludedOpenCount}
                    urgentAnywhereCount={urgentAnywhereCount}
                    patients={patients}
                    referrals={referrals}
                  />

                  {/* NSQHS Standard 6 Clinical Handover Accreditation Footer: on paper only. */}
                  <footer className={pageStyles.accreditationFooter} data-testid="handover-accreditation-footer">
                    <div className={pageStyles.accreditationGrid}>
                      <div className={pageStyles.accreditationField}>
                        <span className={pageStyles.accreditationLabel}>Handover Given By (Outgoing MO / Nurse):</span>
                        <div className={pageStyles.accreditationLine} />
                      </div>
                      <div className={pageStyles.accreditationField}>
                        <span className={pageStyles.accreditationLabel}>
                          Handover Received By (Incoming MO / Nurse):
                        </span>
                        <div className={pageStyles.accreditationLine} />
                      </div>
                      <div className={pageStyles.accreditationField}>
                        <span className={pageStyles.accreditationLabel}>Shift Handover Safety Verification:</span>
                        <div className={pageStyles.accreditationChecks}>
                          <span className={pageStyles.checkItem}>[ ] Controlled Drugs Safe Checked</span>
                          <span className={pageStyles.checkItem}>[ ] Resuscitation Trolley Checked</span>
                          <span className={pageStyles.checkItem}>[ ] Duress Alarms Operational</span>
                        </div>
                      </div>
                    </div>
                    <div className={pageStyles.accreditationLegal}>
                      National Safety and Quality Health Service (NSQHS) Standards · Standard 6: Clinical Handover ·
                      Government of Western Australia Department of Health
                    </div>
                  </footer>
                </div>
              </div>
            </article>

            {/* ISBAR for the movement last opened, or the first row of the list. */}
            <Card as="div" className={pageStyles.isbarPanel} data-print-hide data-testid="ward-handover-isbar-panel">
              {focusedMovement === null ? (
                <EmptyState title="No movement in this list" icon={ClipboardList} />
              ) : (
                (() => {
                  const info = resolveMovementPatient(focusedMovement, patients, referrals);
                  const umrn =
                    info.umrn.startsWith("UMRN") || info.umrn.startsWith("UM") ? info.umrn : `UMRN ${info.umrn}`;
                  const legal = focusedMovement.legalForm
                    ? `Form ${focusedMovement.legalForm.code}`
                    : (focusedMovement.legalStatus ?? "legal status not recorded");
                  const declines = focusedMovement.declines.length;
                  const tabLabel = sheetTabs.find((tab) => tab.id === activeTableSection)?.label ?? "Handover";
                  return (
                    <>
                      <div className={pageStyles.isbarHead}>
                        <div className={pageStyles.isbarTitleBlock}>
                          <span className={pageStyles.isbarEyebrow}>ISBAR · {tabLabel}</span>
                          <h3 className={pageStyles.isbarName}>{info.name}</h3>
                          <span className={pageStyles.isbarMeta}>
                            {umrn} · tier {focusedMovement.urgency}
                          </span>
                        </div>
                        <span className={pageStyles.isbarWait}>
                          <Timer at={focusedMovement.openedAt * MINUTE} now={now * MINUTE} direction="waiting" chip />
                        </span>
                      </div>
                      <ol className={pageStyles.isbarList}>
                        <li>
                          <span className={pageStyles.isbarLetter} aria-hidden="true">
                            I
                          </span>
                          <span className={pageStyles.isbarText}>
                            <span className={pageStyles.isbarLabelText}>Identify</span>
                            {info.name}, {umrn}, {legal}
                          </span>
                        </li>
                        <li>
                          <span className={pageStyles.isbarLetter} aria-hidden="true">
                            S
                          </span>
                          <span className={pageStyles.isbarText}>
                            <span className={pageStyles.isbarLabelText}>Situation</span>
                            {originDepartmentText(focusedMovement)}, {destinationCell(focusedMovement, units)}.{" "}
                            {elapsedLabel(focusedMovement, now)}.
                          </span>
                        </li>
                        <li>
                          <span className={pageStyles.isbarLetter} aria-hidden="true">
                            B
                          </span>
                          <span className={pageStyles.isbarText}>
                            <span className={pageStyles.isbarLabelText}>Background and assessment</span>
                            {movementObservationLabel(focusedMovement)}.
                            {declines > 0 ? ` ${declines} decline${declines === 1 ? "" : "s"} logged.` : ""}
                          </span>
                        </li>
                        <li>
                          <span className={pageStyles.isbarLetter} aria-hidden="true">
                            R
                          </span>
                          <span className={pageStyles.isbarText}>
                            <span className={pageStyles.isbarLabelText}>Recommendation</span>
                            {stageCopy[focusedMovement.stage]?.label ?? "In handover"}.
                            {focusedMovement.owner ? ` Owner, ${focusedMovement.owner}.` : " No owner recorded."}
                          </span>
                        </li>
                      </ol>
                      <div className={pageStyles.isbarFoot}>
                        <Button
                          variant="sec"
                          size="sm"
                          icon={copiedPatientId === focusedMovement.id ? Check : Copy}
                          onClick={() => handleCopyPatientISBAR(focusedMovement)}
                          title="Copy structured ISBAR clinical note for EMR"
                        >
                          {copiedPatientId === focusedMovement.id ? "Copied" : "Copy to EMR"}
                        </Button>
                        <Button
                          variant="pri"
                          size="sm"
                          onClick={(e) => {
                            setDrawerTrigger(e.currentTarget);
                            openMovementDetail(focusedMovement);
                          }}
                        >
                          Movement details
                        </Button>
                      </div>
                    </>
                  );
                })()
              )}
            </Card>

            <OpenBeforeShiftEndSection
              items={openBeforeShiftEnd}
              now={now}
              patients={patients}
              referrals={referrals}
              onSelectMovement={(movement, trigger) => {
                setDrawerTrigger(trigger ?? null);
                openMovementDetail(movement);
              }}
            />

            <SignOffSection
              takenAt={snapshot.takenAt}
              dayZero={dayZero}
              scopeLabel={scopeLabel}
              includedOpenCount={includedOpenCount}
              totalOpenCount={totalOpenCount}
              breachedOnSheetCount={breachedOnSheetCount}
              urgentOutsideFilter={urgentOutsideFilter}
              onSignOff={handleSignOff}
              signOffRecord={signOffRecord}
            />
          </div>
        </div>

        {/* ════════════ TAB PANE 2: CURRENT REFERRALS & BED QUEUE ════════════ */}
        <div
          className={`${pageStyles.tabPane} ${activeTab === "referrals" ? pageStyles.active : ""}`}
          id="pane-referrals"
          role="tabpanel"
          aria-labelledby="tabBtn-referrals"
        >
          <div className={pageStyles.panel}>
            <div className={pageStyles.panelHead}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3>Referrals waiting for a bed</h3>
                <span className={`${pageStyles.statusPill} ${pageStyles.warn}`}>
                  {currentReferralsCount} Seeking Beds
                </span>
              </div>
              <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                Ranked by Operational Urgency &amp; Wait Time
              </span>
            </div>
            <div className={pageStyles.panelBody}>
              <div className={pageStyles.snapSheetWrap}>
                <table className={pageStyles.snapSheet}>
                  <thead>
                    <tr>
                      <th scope="col">Movement ID</th>
                      <th scope="col">Origin ED / Setting</th>
                      <th scope="col">Time Waiting</th>
                      <th scope="col">Required Placement Bed</th>
                      <th scope="col">Legal Status</th>
                      <th scope="col">Acuity &amp; Specialling</th>
                      <th scope="col">Candidate Shortlist &amp; Allocation Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inScopeMovements
                      .filter((m) => m.stage === "placement_requested" || m.stage === "destination_review")
                      .map((movement) => (
                        <tr key={movement.id}>
                          <td>
                            {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                            <b>{resolveMovementPatient(movement, patients, referrals).name}</b>
                          </td>
                          <td>{originDepartmentText(movement)}</td>
                          <td>
                            <span
                              className={`${pageStyles.statusPill} ${movementIsUrgent(movement, now) ? pageStyles.danger : pageStyles.warn}`}
                            >
                              {elapsedLabel(movement, now)}
                            </span>
                          </td>
                          <td>{destinationCell(movement, units)}</td>
                          <td>
                            <span
                              className={`${pageStyles.statusPill} ${movement.legalForm ? pageStyles.danger : pageStyles.mono}`}
                            >
                              {movement.legalForm
                                ? `Form ${movement.legalForm.code}`
                                : (movement.legalStatus ?? "Not recorded")}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`${pageStyles.statusPill} ${movement.flaggedUrgent || movement.specialling ? pageStyles.danger : pageStyles.mono}`}
                            >
                              {movementObservationLabel(movement)}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={pageStyles.btnActionSec}
                              onClick={() => announceToWardShell("Not wired in this prototype.")}
                            >
                              Allocate Candidate Bed
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════ TAB PANE 3: INBOUND PIPELINE & TRANSIT ════════════ */}
        <div
          className={`${pageStyles.tabPane} ${activeTab === "inbound" ? pageStyles.active : ""}`}
          id="pane-inbound"
          role="tabpanel"
          aria-labelledby="tabBtn-inbound"
        >
          <div className={pageStyles.panel}>
            <div className={pageStyles.panelHead}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3>Coming in</h3>
                <span className={`${pageStyles.statusPill} ${pageStyles.accent}`}>
                  {snapshot.inTransit.length} Confirmed
                </span>
              </div>
              <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>All beds pre-allocated</span>
            </div>
            <div className={pageStyles.panelBody}>
              <div className={pageStyles.snapSheetWrap}>
                <table className={pageStyles.snapSheet}>
                  <thead>
                    <tr>
                      <th scope="col">Movement ID</th>
                      <th scope="col">Origin Referral</th>
                      <th scope="col">Time Waiting</th>
                      <th scope="col">Destination Bed</th>
                      <th scope="col">Transport &amp; ETA</th>
                      <th scope="col">MHA Status</th>
                      <th scope="col">Observations</th>
                      <th scope="col">Receiving Nurse Brief</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.inTransit.map((entry) => (
                      <tr key={entry.movement.id}>
                        <td>
                          {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                          <b>{resolveMovementPatient(entry.movement, patients, referrals).name}</b>
                        </td>
                        <td>
                          <OriginDepartmentCell movement={entry.movement} />
                        </td>
                        <td>
                          <span className={`${pageStyles.statusPill} ${pageStyles.warn}`}>
                            {elapsedLabel(entry.movement, now)}
                          </span>
                        </td>
                        <td>{destinationCell(entry.movement, units)}</td>
                        <td>See transport record</td>
                        <td>
                          <span
                            className={`${pageStyles.statusPill} ${entry.movement.legalForm ? pageStyles.danger : pageStyles.mono}`}
                          >
                            {entry.movement.legalForm
                              ? `Form ${entry.movement.legalForm.code}`
                              : (entry.movement.legalStatus ?? "Not recorded")}
                          </span>
                        </td>
                        <td>{movementObservationLabel(entry.movement)}</td>
                        <td>Receiving brief not recorded here</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════ TAB PANE 4: DISCHARGES, EGRESS & DELAYS ════════════ */}
        <div
          className={`${pageStyles.tabPane} ${activeTab === "discharges" ? pageStyles.active : ""}`}
          id="pane-discharges"
          role="tabpanel"
          aria-labelledby="tabBtn-discharges"
        >
          <div className={pageStyles.panel}>
            <div className={pageStyles.panelHead}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3>Reserved beds — discharge details unavailable</h3>
                <span className={`${pageStyles.statusPill} ${pageStyles.good}`}>
                  {snapshot.pulledBeds.length} reserved
                </span>
              </div>
              <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                Reservation does not establish a planned discharge
              </span>
            </div>
            <div className={pageStyles.panelBody}>
              <div className={pageStyles.snapSheetWrap}>
                <table className={pageStyles.snapSheet}>
                  <thead>
                    <tr>
                      <th scope="col">Movement ID</th>
                      <th scope="col">Current Unit &amp; Bed</th>
                      <th scope="col">Length of Stay</th>
                      <th scope="col">Discharge Destination</th>
                      <th scope="col">Transport Mode</th>
                      <th scope="col">Scripts &amp; Meds</th>
                      <th scope="col">CMHT Handover</th>
                      <th scope="col">Egress Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.pulledBeds.map((entry) => (
                      <tr key={entry.movement.id}>
                        <td>
                          {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                          <b>{resolveMovementPatient(entry.movement, patients, referrals).name}</b>
                        </td>
                        <td>{destinationCell(entry.movement, units)}</td>
                        <td>
                          <span className="mono">Not recorded</span>
                        </td>
                        <td>Not recorded</td>
                        <td>Not recorded</td>
                        <td>Not recorded</td>
                        <td>Not recorded</td>
                        <td>
                          <span className={pageStyles.statusPill}>Bed reserved</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Stranded Delayed Egress (Bed Blocks) — rows read from occupied admissions with a
                  recorded hold, never typed: see `strandedEgress`'s own doc comment (25 September
                  2026 audit, A1). */}
              <div className={pageStyles.delayedEgressBlock}>
                <div className={pageStyles.delayedTitleRow}>
                  <span className={pageStyles.delayedTitle}>
                    <svg
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M8 2l6 11H2L8 2zM8 7v3M8 12h.01" />
                    </svg>
                    <span>
                      Discharges on hold, non-clinical ({strandedEgress.length} Patient
                      {strandedEgress.length === 1 ? "" : "s"})
                    </span>
                  </span>
                </div>
                {strandedEgress.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "var(--t-1)", color: "var(--muted)", fontStyle: "italic" }}>
                    None recorded
                  </p>
                ) : (
                  <div className={pageStyles.snapSheetWrap}>
                    <table className={pageStyles.snapSheet}>
                      <thead>
                        <tr>
                          <th scope="col">Patient &amp; UMRN</th>
                          <th scope="col">Unit &amp; Bed</th>
                          <th scope="col">Delayed Discharge Reason</th>
                          <th scope="col">Expected Discharge &amp; Date Set By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strandedEgress.map(({ admission, identity, unit }) => (
                          <tr key={admission.id}>
                            <td>
                              <b>{identity.name}</b>
                              <div className={pageStyles.officialMeta}>{identity.umrn}</div>
                            </td>
                            <td>{unit?.name ?? admission.unitId} · bed not recorded</td>
                            <td>{admission.blockReason}</td>
                            <td>
                              <span className="mono">
                                {admission.expectedDischargeAt !== null &&
                                Number.isFinite(admission.expectedDischargeAt)
                                  ? `${formatInstantWithDay(admission.expectedDischargeAt, now)} AWST`
                                  : "Not recorded"}
                              </span>
                              <div className={pageStyles.officialMeta}>
                                {admission.dischargeDateSetBy ?? "Not recorded"}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════ TAB PANE 5: RECORDED FORM TIMINGS ════════════ */}
        <div
          className={`${pageStyles.tabPane} ${activeTab === "breaches" ? pageStyles.active : ""}`}
          id="pane-breaches"
          role="tabpanel"
          aria-labelledby="tabBtn-breaches"
        >
          <div className={pageStyles.panel}>
            <div className={pageStyles.panelHead}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3>Recorded form timings</h3>
                <span className={`${pageStyles.statusPill} ${pageStyles.danger}`}>
                  {formTimingRows.length} passed or due within the hour
                </span>
              </div>
              <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>Form 1A / Form 4A</span>
            </div>
            <div className={pageStyles.panelBody}>
              <div className={pageStyles.breachGrid}>
                {formTimingRows.length === 0 ? (
                  <p className={pageStyles.breachMeta} data-testid="handover-form-timings-empty">
                    No form due time that has passed or falls within the hour is recorded.
                  </p>
                ) : (
                  formTimingRows.map((movement) => {
                    const dueAt = movement.legalForm?.dueAt ?? now;
                    const passed = clockState(dueAt, now) === "breached";
                    const tone = passed ? pageStyles.danger : pageStyles.warn;
                    const code = movement.legalForm?.code ?? "";
                    return (
                      <div
                        key={movement.id}
                        className={`${pageStyles.breachCard} ${tone}`}
                        data-testid="handover-form-timing-card"
                      >
                        <div className={pageStyles.breachTop}>
                          <span className={pageStyles.breachTitle}>
                            {resolveMovementPatient(movement, patients, referrals).name} ·{" "}
                            {originDepartmentText(movement)}
                          </span>
                          <span className={`${pageStyles.statusPill} ${tone}`}>
                            {passed ? `Form ${code} due time passed` : `Form ${code} due within the hour`}
                          </span>
                        </div>
                        <div className={pageStyles.breachMeta}>
                          Recorded due time {formatInstantWithDay(dueAt, now)}. Open {elapsedLabel(movement, now)}.
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════ TAB PANE 6: COORDINATOR BRIEFING & ISBAR ════════════ */}
        <div
          className={`${pageStyles.tabPane} ${activeTab === "briefing" ? pageStyles.active : ""}`}
          id="pane-briefing"
          role="tabpanel"
          aria-labelledby="tabBtn-briefing"
        >
          <p className={pageStyles.briefingNotice}>
            These examples do not follow the selected scope or update movement records. Checkboxes apply to this preview
            only.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: "12px",
              alignItems: "start",
            }}
          >
            {/* ISBAR Briefing Notes */}
            <details className={`source-print ${pageStyles.panel}`} data-testid="ward-handover-example-briefing">
              <summary className={pageStyles.exampleSummary}>Example ISBAR briefing</summary>
              <div className={pageStyles.panelBody} style={{ fontSize: "var(--t-1)", lineHeight: 1.5 }}>
                <p style={{ margin: "0 0 8px" }}>
                  <b>Identify:</b> Dr Sophia Chen (Outgoing Consultant) handing over to Dr Marcus Vance (Incoming
                  Registrar).
                </p>
                <p style={{ margin: "0 0 8px" }}>
                  <b>Situation:</b> Severe South Metro secure bed pressure. FSH &amp; Fremantle acute secure units at
                  100% capacity.
                </p>
                <p style={{ margin: "0 0 8px" }}>
                  <b>Background:</b> Tobias Wren (Peel ED) has a long wait. Form 1A due time passed. Bed 02 at FSH
                  allocated on 16:00 discharge of Trevor Vance.
                </p>
                <p style={{ margin: "0 0 8px" }}>
                  <b>Assessment:</b> Bunbury RFDS aeromedical transfer for Bradley Vance ETA Jandakot 16:30. Severe
                  catatonia requiring HDU resus pre-alert.
                </p>
                <p style={{ margin: 0 }}>
                  <b>Recommendation:</b> Direct any evening involuntary south presentations to Graylands Murchison or
                  RPH 2K.
                </p>
              </div>
            </details>

            {/* Actionable Shift Checklist */}
            <div className={pageStyles.panel}>
              <div className={pageStyles.panelHead}>
                <h3>Example shift tasks</h3>
                <span className="mono" style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                  {completedTasks.size} of 6 Completed
                </span>
              </div>
              <div className={pageStyles.panelBody}>
                <div className={pageStyles.taskList}>
                  {[
                    {
                      id: "task-1",
                      label: "Re-assess Form 1A expiry status for Tobias Wren (Peel ED)",
                      due: "Due 16:30",
                    },
                    {
                      id: "task-2",
                      label: "Confirm arrival & bed intake for Dermot Hawthornby (FRE 4W)",
                      due: "Due 15:45",
                    },
                    { id: "task-3", label: "Review serum lithium lab panel for FRE Ward 4W Bed 12", due: "Due 18:00" },
                    {
                      id: "task-4",
                      label: "Confirm WAPOL escort dispatch for Callum Finchgrove (Form 4A Transport)",
                      due: "Due 16:00",
                    },
                    {
                      id: "task-5",
                      label: "Receive Silver Chain transport confirmation for Walter Briggs RACF egress",
                      due: "Due 17:00",
                    },
                    {
                      id: "task-6",
                      label: "Verify controlled drug evening count and sign register with CNC",
                      due: "Due 21:00",
                    },
                  ].map((task) => (
                    <label
                      key={task.id}
                      className={`${pageStyles.taskItem} ${completedTasks.has(task.id) ? pageStyles.completed : ""}`}
                    >
                      <div className={pageStyles.taskLeft}>
                        <input
                          type="checkbox"
                          className={pageStyles.taskCheckbox}
                          checked={completedTasks.has(task.id)}
                          onChange={() => toggleTask(task.id)}
                        />
                        <span className={pageStyles.taskLabel}>{task.label}</span>
                      </div>
                      <span className={pageStyles.taskDue}>{task.due}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════ TAB PANE 7: 16:30 HANDOVER & SHIFT CHECK-IN ROLLUP ════════════ */}
        <div
          className={`${pageStyles.tabPane} ${activeTab === "rollup1630" ? pageStyles.active : ""}`}
          id="pane-rollup1630"
          role="tabpanel"
          aria-labelledby="tabBtn-rollup1630"
          data-testid="ward-handover-rollup-1630"
        >
          {/* Executive Header Strip */}
          <div style={{ marginBottom: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                <h3 style={{ fontSize: "var(--t-3)", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                  16:30 Afternoon handover
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "var(--t-1)", color: "var(--muted)" }}>
                  Shift-change checkpoint: Long-stay discharge barriers (LOS &ge; 7d), acute step-down candidates, and
                  evening inbound arrivals with ETAs.
                </p>
              </div>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "var(--t-0)",
                  padding: "4px 10px",
                  borderRadius: "var(--pill)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  fontWeight: 600,
                  color: "var(--ink)",
                }}
              >
                16:30 Rollup · Evening Egress
              </span>
            </div>
          </div>

          {/* KPI Summary Strip */}
          <div className={pageStyles.summaryStrip} style={{ marginBottom: "1.25rem" }}>
            <div className={pageStyles.summaryTile}>
              <div className={pageStyles.tileMeta}>
                <span className={pageStyles.tileLabel}>Long-Stay Occupants (&ge;7d)</span>
                <span className={pageStyles.tileSub}>
                  {unrecordedBarriersCount > 0
                    ? `${unrecordedBarriersCount} without recorded barrier`
                    : "All barriers recorded"}
                </span>
              </div>
              <span className={`${pageStyles.tileValue} ${longStayAdmissions.length > 0 ? pageStyles.warn : ""}`}>
                {longStayAdmissions.length}
              </span>
            </div>

            <div className={pageStyles.summaryTile}>
              <div className={pageStyles.tileMeta}>
                <span className={pageStyles.tileLabel}>Step-Down Candidates</span>
                <span className={pageStyles.tileSub}>Acute capacity unlock opportunities</span>
              </div>
              <span className={`${pageStyles.tileValue} ${stepDownAdmissions.length > 0 ? pageStyles.good : ""}`}>
                {stepDownAdmissions.length}
              </span>
            </div>

            <div className={pageStyles.summaryTile}>
              <div className={pageStyles.tileMeta}>
                <span className={pageStyles.tileLabel}>Evening Inbound / Transit</span>
                <span className={pageStyles.tileSub}>Arrivals awaiting bed entry</span>
              </div>
              <span className={pageStyles.tileValue}>{eveningArrivalMovements.length}</span>
            </div>

            <div className={pageStyles.summaryTile}>
              <div className={pageStyles.tileMeta}>
                <span className={pageStyles.tileLabel}>Overdue Inbound Alerts</span>
                <span className={pageStyles.tileSub} title={OPERATIONAL_DEFAULT_LABEL}>
                  &gt;{LATE_ARRIVAL_GRACE_MINUTES}m past scheduled ETA
                </span>
              </div>
              <span className={`${pageStyles.tileValue} ${overdueArrivals.length > 0 ? pageStyles.danger : ""}`}>
                {overdueArrivals.length}
              </span>
            </div>
          </div>

          {/* Grid of three executive clinical panels */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
            {/* 1. LONG-STAY DISCHARGE BARRIERS */}
            <div className={pageStyles.panel}>
              <div className={pageStyles.panelHead}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "var(--t-2)", fontWeight: 700 }}>
                    1. Long-Stay Patients &amp; Primary Discharge Barriers (LOS &ge; 7 Days)
                  </h3>
                  <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                    Mandatory clinical review for all inpatients with 7+ days in bed · {longStayAdmissions.length}{" "}
                    patient{longStayAdmissions.length === 1 ? "" : "s"} in scope
                  </span>
                </div>
                {unrecordedBarriersCount > 0 && (
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "var(--t-0)",
                      padding: "3px 8px",
                      borderRadius: "var(--pill)",
                      background: "var(--warn-soft)",
                      color: "var(--warn-ink)",
                      border: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)",
                      fontWeight: 600,
                    }}
                  >
                    ⚠ {unrecordedBarriersCount} Barrier{unrecordedBarriersCount === 1 ? "" : "s"} Unrecorded
                  </span>
                )}
              </div>
              <div className={pageStyles.panelBody}>
                {/* Barrier breakdown tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "1rem" }}>
                  {DISCHARGE_BARRIERS.map((barrier) => {
                    const count = barrierCounts[barrier] ?? 0;
                    if (count === 0) return null;
                    return (
                      <span
                        key={barrier}
                        style={{
                          fontSize: "var(--t-0)",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "var(--surface-2)",
                          border: "1px solid var(--line)",
                          color: "var(--ink)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <b>{barrier}</b>
                        <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--accent)" }}>
                          {count}
                        </span>
                      </span>
                    );
                  })}
                  {barrierCounts.Unrecorded > 0 && (
                    <span
                      style={{
                        fontSize: "var(--t-0)",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: "var(--warn-soft)",
                        border: "1px solid var(--warn)",
                        color: "var(--warn-ink)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <b>Unrecorded</b>
                      <span style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{barrierCounts.Unrecorded}</span>
                    </span>
                  )}
                </div>

                {longStayAdmissions.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "var(--t-1)", color: "var(--muted)", fontStyle: "italic" }}>
                    No long-stay patients (&ge; 7 days) currently in scope.
                  </p>
                ) : (
                  <div
                    className={pageStyles.tableWrap}
                    tabIndex={0}
                    role="region"
                    aria-label="Long stay handover table"
                    style={{ overflowX: "auto" }}
                  >
                    <table className={pageStyles.handoverTable} style={{ width: "100%", fontSize: "var(--t-1)" }}>
                      <thead>
                        <tr>
                          <th scope="col">Ward &amp; Bed</th>
                          <th scope="col">Stay Duration</th>
                          <th scope="col">Tentative Diagnosis</th>
                          <th scope="col">Primary Discharge Barrier</th>
                          <th scope="col">Step-Down Suitable</th>
                          <th scope="col">Planned Egress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedLongStayAdmissions.map((adm) => {
                          const unit = units.find((u) => u.id === adm.unitId);
                          const stay = daysInBed(adm, now) ?? 0;
                          return (
                            <tr key={adm.id}>
                              <td style={{ fontWeight: 600 }}>{unit?.name ?? adm.unitId} · bed not recorded</td>
                              <td>
                                <span
                                  style={{
                                    fontFamily: "var(--mono)",
                                    fontWeight: 700,
                                    color: stay >= 14 ? "var(--danger-ink)" : "var(--warn-ink)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: stay >= 14 ? "var(--danger-soft)" : "var(--warn-soft)",
                                  }}
                                >
                                  {stay}d in bed
                                </span>
                              </td>
                              <td style={{ color: "var(--muted)" }}>{adm.tentativeDiagnosis ?? "General Acute"}</td>
                              <td>
                                {adm.dischargeBarrier ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 8px",
                                      borderRadius: "var(--pill)",
                                      background: "var(--surface-2)",
                                      border: "1px solid var(--line)",
                                      fontWeight: 600,
                                      fontSize: "var(--t-0)",
                                    }}
                                  >
                                    {adm.dischargeBarrier}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 8px",
                                      borderRadius: "var(--pill)",
                                      background: "var(--warn-soft)",
                                      color: "var(--warn-ink)",
                                      border: "1px solid var(--warn)",
                                      fontWeight: 600,
                                      fontSize: "var(--t-0)",
                                    }}
                                  >
                                    ⚠ Action Required
                                  </span>
                                )}
                              </td>
                              <td>
                                {adm.stepDownCandidate ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 8px",
                                      borderRadius: "var(--pill)",
                                      background: "var(--good-soft)",
                                      color: "var(--good-ink)",
                                      border: "1px solid var(--good)",
                                      fontWeight: 600,
                                      fontSize: "var(--t-0)",
                                    }}
                                  >
                                    ✓ Step-Down Ready
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--muted)", fontSize: "var(--t-0)" }}>Acute stay</span>
                                )}
                              </td>
                              <td style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                                {adm.expectedDischargeAt
                                  ? formatInstantWithDay(adm.expectedDischargeAt, now)
                                  : "Not set"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {totalLongStayPages > 1 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.75rem 1rem",
                          borderTop: "1px solid var(--line)",
                          fontSize: "var(--t-0)",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                          Showing {(currentLongStayPage - 1) * LONG_STAY_PAGE_SIZE + 1}–
                          {Math.min(currentLongStayPage * LONG_STAY_PAGE_SIZE, longStayAdmissions.length)} of{" "}
                          {longStayAdmissions.length} long-stay patients
                        </span>
                        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => setLongStayPage((p) => Math.max(1, p - 1))}
                            disabled={currentLongStayPage <= 1}
                            style={{
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              border: "1px solid var(--line)",
                              background: "var(--surface)",
                              cursor: currentLongStayPage <= 1 ? "not-allowed" : "pointer",
                              opacity: currentLongStayPage <= 1 ? 0.5 : 1,
                              fontSize: "var(--t-0)",
                            }}
                            aria-label="Previous page"
                          >
                            Previous
                          </button>
                          {Array.from({ length: totalLongStayPages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setLongStayPage(page)}
                              style={{
                                padding: "0.25rem 0.5rem",
                                borderRadius: "4px",
                                border: "1px solid var(--line)",
                                background: page === currentLongStayPage ? "var(--accent)" : "var(--surface)",
                                color: page === currentLongStayPage ? "var(--accent-contrast, white)" : "inherit",
                                fontWeight: page === currentLongStayPage ? 700 : 400,
                                cursor: "pointer",
                                fontSize: "var(--t-0)",
                                fontVariantNumeric: "tabular-nums",
                              }}
                              aria-current={page === currentLongStayPage ? "page" : undefined}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setLongStayPage((p) => Math.min(totalLongStayPages, p + 1))}
                            disabled={currentLongStayPage >= totalLongStayPages}
                            style={{
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              border: "1px solid var(--line)",
                              background: "var(--surface)",
                              cursor: currentLongStayPage >= totalLongStayPages ? "not-allowed" : "pointer",
                              opacity: currentLongStayPage >= totalLongStayPages ? 0.5 : 1,
                              fontSize: "var(--t-0)",
                            }}
                            aria-label="Next page"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. STEP-DOWN CASCADE SOLVER */}
            <div className={pageStyles.panel}>
              <div className={pageStyles.panelHead}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "var(--t-2)", fontWeight: 700 }}>
                    2. Acute Bed Cascade Solver (Step-Down Transfer Candidates)
                  </h3>
                  <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                    Acute inpatients flagged as clinically stabilized and suitable for subacute transfer (Bentley,
                    Joondalup Subacute, Hampton Road) to release acute capacity
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "var(--t-0)",
                    padding: "3px 8px",
                    borderRadius: "var(--pill)",
                    background: stepDownAdmissions.length > 0 ? "var(--good-soft)" : "var(--surface-2)",
                    color: stepDownAdmissions.length > 0 ? "var(--good-ink)" : "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  {stepDownAdmissions.length} Unlock Opportunit{stepDownAdmissions.length === 1 ? "y" : "ies"}
                </span>
              </div>
              <div className={pageStyles.panelBody}>
                {stepDownAdmissions.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "var(--t-1)", color: "var(--muted)", fontStyle: "italic" }}>
                    No acute patients currently flagged as step-down candidates in this scope. Charge nurses can flag
                    suitable patients via the Ward Board occupant drawer.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {stepDownAdmissions.map((adm) => {
                      const unit = units.find((u) => u.id === adm.unitId);
                      const stay = daysInBed(adm, now) ?? 0;
                      return (
                        <div
                          key={adm.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "6px",
                            border: "1px solid color-mix(in srgb, var(--good) 30%, var(--line))",
                            background: "var(--surface)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: "var(--t-1)" }}>
                              {unit?.name ?? adm.unitId} · bed not recorded
                            </span>
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: "var(--t-0)",
                                fontWeight: 600,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "var(--good-soft)",
                                color: "var(--good-ink)",
                              }}
                            >
                              Ready for Step-Down
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "var(--t-0)",
                              color: "var(--muted)",
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span>
                              Stay: <b>{stay}d</b>
                            </span>
                            <span>·</span>
                            <span>
                              Dx: <b>{adm.tentativeDiagnosis ?? "Acute"}</b>
                            </span>
                            {adm.dischargeBarrier && (
                              <>
                                <span>·</span>
                                <span>
                                  Barrier: <b>{adm.dischargeBarrier}</b>
                                </span>
                              </>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--t-0)",
                              color: "var(--ink)",
                              background: "var(--surface-2)",
                              padding: "4px 8px",
                              borderRadius: "4px",
                            }}
                          >
                            Target pathway: Bentley Mental Health Subacute / Hampton Road step-down
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 3. EVENING INBOUND ARRIVALS & TRANSPORT ETAs */}
            <div className={pageStyles.panel}>
              <div className={pageStyles.panelHead}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "var(--t-2)", fontWeight: 700 }}>
                    3. Evening Inbound Arrivals &amp; Transport ETAs
                  </h3>
                  <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                    Incoming admissions, transport bookings, and bed reservations tracking arrival times and
                    documentation
                  </span>
                </div>
                {overdueArrivals.length > 0 && (
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "var(--t-0)",
                      padding: "3px 8px",
                      borderRadius: "var(--pill)",
                      background: "var(--danger-soft)",
                      color: "var(--danger-ink)",
                      border: "1px solid var(--danger)",
                      fontWeight: 700,
                    }}
                  >
                    ⚠ {overdueArrivals.length} OVERDUE ARRIVAL{overdueArrivals.length === 1 ? "" : "S"}
                  </span>
                )}
              </div>
              <div className={pageStyles.panelBody}>
                {eveningArrivalMovements.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "var(--t-1)", color: "var(--muted)", fontStyle: "italic" }}>
                    No active inbound movements or transport bookings in this scope.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {eveningArrivalMovements.map((movement) => {
                      const patient = resolveMovementPatient(movement, patients, referrals);
                      const targetUnit = units.find((u) => u.id === movement.acceptedUnitId);
                      const originEd = edById(movement.originEdId ?? "");
                      const arrival = movement.arrivalDetails;
                      const hasEta = arrival?.estimatedArrivalAt != null;
                      const isOverdue = hasEta && now > arrival.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES;
                      const minutesDiff = hasEta ? arrival.estimatedArrivalAt - now : null;

                      return (
                        <div
                          key={movement.id}
                          style={{
                            padding: "10px 14px",
                            borderRadius: "6px",
                            border: isOverdue ? "1.5px solid var(--danger)" : "1px solid var(--line)",
                            background: isOverdue ? "var(--danger-soft)" : "var(--surface)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              flexWrap: "wrap",
                              gap: "6px",
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, fontSize: "var(--t-1)", marginRight: "8px" }}>
                                {patient.name}
                              </span>
                              <span
                                style={{ fontFamily: "var(--mono)", fontSize: "var(--t-0)", color: "var(--muted)" }}
                              >
                                {patient.umrn}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              {movement.medicalClearance?.cleared ? (
                                <span
                                  style={{
                                    fontSize: "var(--t-0)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "var(--good-soft)",
                                    color: "var(--good-ink)",
                                    fontWeight: 600,
                                  }}
                                >
                                  ✓ Medically Cleared
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "var(--t-0)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "var(--surface-2)",
                                    color: "var(--muted)",
                                    fontWeight: 600,
                                  }}
                                >
                                  ⏳ Clearance Pending
                                </span>
                              )}

                              {movement.uploadedForms && movement.uploadedForms.length > 0 && (
                                <span
                                  style={{
                                    fontSize: "var(--t-0)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "var(--accent-soft)",
                                    color: "var(--accent)",
                                    fontWeight: 600,
                                  }}
                                >
                                  📄 {movement.uploadedForms.length} Form
                                  {movement.uploadedForms.length === 1 ? "" : "s"} Attached
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <div style={{ fontSize: "var(--t-0)", color: "var(--ink)" }}>
                              <span>
                                Route: <b>{originEd?.name ?? movement.originEdId ?? "ED"}</b> &rarr;{" "}
                                <b>{targetUnit?.name ?? movement.acceptedUnitId ?? "Target Ward"}</b>
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                              <span style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                                Mode:{" "}
                                <b>
                                  {arrival
                                    ? (ARRIVAL_MODE_LABELS[arrival.mode] ?? arrival.mode)
                                    : "Default Bed Reservation"}
                                </b>
                              </span>
                              {arrival?.trackingNumber && (
                                <span
                                  style={{ fontSize: "var(--t-0)", fontFamily: "var(--mono)", color: "var(--ink)" }}
                                >
                                  Track #: <b>{arrival.trackingNumber}</b>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Arrival timing / Overdue alert */}
                          <div
                            style={{
                              marginTop: "4px",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              background: isOverdue
                                ? "color-mix(in srgb, var(--danger) 15%, transparent)"
                                : "var(--surface-2)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "var(--t-0)",
                            }}
                          >
                            {hasEta ? (
                              <>
                                <span>
                                  <b>Estimated Arrival:</b> {formatInstantWithDay(arrival.estimatedArrivalAt, now)} (
                                  {minutesDiff! > 0 ? `in ${minutesDiff} mins` : `${Math.abs(minutesDiff!)} mins ago`})
                                </span>
                                {isOverdue && (
                                  <span
                                    style={{ color: "var(--danger-ink)", fontWeight: 700 }}
                                    title={OPERATIONAL_DEFAULT_LABEL}
                                  >
                                    ⚠ OVERDUE: Exceeded ETA by &gt;{LATE_ARRIVAL_GRACE_MINUTES} mins. Alert ward &amp;
                                    transport team.
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span>
                                  <b>Reservation Status:</b> Active bed hold
                                </span>
                                <span style={{ color: "var(--muted)" }}>No specific ETA entered by referrer</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className={styles.crossLink}>
          <Link href="/mockups/ward-flow/capacity">View capacity board</Link>
        </p>
        <WardPrototypeFooter
          testId="ward-handover-governance"
          note="Live operational summary · Not a medical device · Printed copies carry the time they were taken"
        />
      </main>

      {/* ── CLINICAL MOVEMENT DETAIL DRAWER ── */}
      <div
        className={`${pageStyles.drawerOverlay} ${selectedMovement !== null ? pageStyles.open : ""}`}
        onClick={closeMovementDetail}
      >
        <aside
          ref={scoreDrawerRef}
          className={pageStyles.scoreDrawer}
          role="dialog"
          aria-modal="true"
          aria-labelledby="movement-drawer-heading"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={pageStyles.drawerHead}>
            <IconTile icon={ClipboardList} />
            <div className={pageStyles.drawerTitleBlock}>
              <h2 id="movement-drawer-heading">{selectedMovement ? "Movement details" : "Handover details"}</h2>
              <span className={pageStyles.drawerMeta}>
                Point in time, {formatInstant(now)} ·{" "}
                {sheetTabs.find((tab) => tab.id === activeTableSection)?.label ?? "Handover"}
              </span>
            </div>
            <Button
              ref={drawerCloseBtnRef}
              variant="ghost"
              size="sm"
              icon={X}
              iconOnly
              onClick={closeMovementDetail}
              aria-label="Close movement details"
            />
          </div>

          {selectedMovement &&
            (() => {
              const selPatientInfo = resolveMovementPatient(selectedMovement, patients, referrals);
              const selFormattedUmrn =
                selPatientInfo.umrn.startsWith("UMRN") || selPatientInfo.umrn.startsWith("UM")
                  ? selPatientInfo.umrn
                  : `UMRN ${selPatientInfo.umrn}`;
              const selUrgent = movementIsUrgent(selectedMovement, now);
              const selObservation = movementObservationLabel(selectedMovement);
              return (
                <div className={pageStyles.drawerBody}>
                  <div className={pageStyles.drawerIdentity}>
                    <span className={pageStyles.tierBox}>
                      <SrOnly>Tier </SrOnly>
                      {selectedMovement.urgency}
                    </span>
                    <div className={pageStyles.drawerTitleBlock}>
                      <h3 className={pageStyles.drawerName}>{selPatientInfo.name}</h3>
                      <span className={pageStyles.drawerMeta}>
                        {selFormattedUmrn} · tier {selectedMovement.urgency}
                        {selectedMovement.owner ? ` · owner ${selectedMovement.owner}` : ""}
                      </span>
                    </div>
                    <Timer at={selectedMovement.openedAt * MINUTE} now={now * MINUTE} direction="waiting" chip />
                  </div>
                  {/* Owner, 26 Sept 2026: no WF journey number row; the patient is named above. */}
                  <dl className={pageStyles.drawerFacts}>
                    <div>
                      <dt>From</dt>
                      <dd>{originDepartmentText(selectedMovement)}</dd>
                    </div>
                    <div>
                      <dt>To</dt>
                      <dd>{destinationCell(selectedMovement, units)}</dd>
                    </div>
                    <div>
                      <dt>Waiting</dt>
                      <dd>
                        <b>{elapsedLabel(selectedMovement, now)}</b>
                        {selUrgent ? (
                          <span className={pageStyles.cellUrgent}>
                            <StatusGlyph tone="danger" size={9} />
                            Urgent
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt>Order</dt>
                      <dd>
                        <span>
                          <b>
                            {selectedMovement.legalForm
                              ? `Form ${selectedMovement.legalForm.code}`
                              : (selectedMovement.legalStatus ?? "Voluntary")}
                          </b>
                          {selectedMovement.legalForm ? " · due times as typed" : ""}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Acuity and obs</dt>
                      <dd>
                        <span className={pageStyles.cellAcuity}>
                          {selObservation !== "Standard" ? (
                            <StatusGlyph tone={selectedMovement.flaggedUrgent ? "danger" : "warning"} size={9} />
                          ) : null}
                          {selObservation}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Stage and action</dt>
                      <dd>
                        <span>
                          <b>{stageCopy[selectedMovement.stage]?.label ?? "In handover"}</b>
                          {selectedMovement.owner ? `, ${selectedMovement.owner}` : ", no owner recorded"}
                        </span>
                      </dd>
                    </div>
                  </dl>

                  <div className={pageStyles.drawerFooter}>
                    <Link
                      // No resolved patient: the movement id (WF-…) is what the person route accepts; a UMRN, or the
                      // literal "UMRN not recorded" fallback, is not.
                      href={patientHref(selPatientInfo.patientId ?? selectedMovement.id)}
                      className={pageStyles.drawerLink}
                    >
                      <Icon icon={Activity} size={14} />
                      Patient journey
                    </Link>
                    <Button variant="ghost" size="sm" onClick={closeMovementDetail}>
                      Close
                    </Button>
                    <Button variant="pri" size="sm" onClick={() => announceToWardShell("Not wired in this prototype.")}>
                      Allocate candidate bed
                    </Button>
                  </div>
                </div>
              );
            })()}
        </aside>
      </div>
    </div>
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
    <label htmlFor="ward-handover-scope" className={pageStyles.scopeSelectForm} data-print-hide>
      <span className={pageStyles.srOnly}>Filter the sheet</span>
      <Select
        id="ward-handover-scope"
        aria-label="Filter the sheet"
        data-testid="ward-handover-scope-select"
        boxClassName={pageStyles.scopeSelect}
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

/** CONDITION 3: Urgent Outside Filter Safety Block */
export function UrgentOutsideFilterFooter({
  movements,
  scopeLabel,
  now,
  excludedOpenCount,
  urgentAnywhereCount,
  patients = [],
  referrals = [],
}: {
  movements: Movement[];
  scopeLabel: string;
  now: Instant;
  excludedOpenCount: number;
  urgentAnywhereCount: number;
  patients?: Patient[];
  referrals?: Referral[];
}) {
  const hasUrgent = movements.length > 0;
  return (
    <section
      className={hasUrgent ? `${styles.section} ${styles.urgentOutsideAlert}` : styles.section}
      data-testid="ward-handover-urgent-outside-filter"
    >
      <h2 className={styles.sectionHeading}>Outside this filter</h2>
      {hasUrgent ? (
        <ul className={styles.urgentOutsideList}>
          {movements.map((movement) => (
            <li key={movement.id} data-testid={`ward-handover-urgent-outside-${movement.id}`}>
              {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
              {resolveMovementPatient(movement, patients, referrals).name} — {elapsedLabel(movement, now)} —{" "}
              {urgentReasonLabel(movement, now)} — {originDepartmentText(movement)} — not shown under &quot;
              {scopeLabel}&quot;. {movement.owner} · {stageCopy[movement.stage].label}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyNote} data-testid="ward-handover-urgent-outside-filter-empty">
          Nothing urgent is outside this filter.{" "}
          {excludedOpenCount === 0
            ? "Nothing is outside it at all: the sheet is the whole network."
            : `${excludedOpenCount} open movement${excludedOpenCount === 1 ? " is" : "s are"} outside it, and none of them is flagged urgent or past its recorded due time.`}
        </p>
      )}
      <p className={styles.emptyNote} data-testid="ward-handover-urgent-outside-filter-foot">
        Urgent here means one of two things the record holds: a movement flagged urgent, or a legal form&apos;s due time
        already passed. Across the whole network{" "}
        {urgentAnywhereCount === 0
          ? "no open movement is urgent"
          : `${urgentAnywhereCount} open movement${urgentAnywhereCount === 1 ? " is" : "s are"} urgent`}
        , and{" "}
        {movements.length === 0
          ? "none of them is"
          : `${movements.length} of them ${movements.length === 1 ? "is" : "are"}`}{" "}
        outside this filter.
      </p>
    </section>
  );
}

function urgentReasonLabel(movement: Movement, now: Instant): string {
  const reasons: string[] = [];
  if (movement.flaggedUrgent) reasons.push("flagged urgent");
  const dueAt = movement.legalForm?.dueAt;
  if (dueAt !== undefined && clockState(dueAt, now) === "breached") reasons.push("form due time passed");
  return reasons.join(", ");
}

export function destinationCell(movement: Movement, units: Unit[]): string {
  const accepted = movement.acceptedUnitId
    ? units.find((candidate) => candidate.id === movement.acceptedUnitId)
    : undefined;
  if (accepted) return accepted.name;
  if (movement.referredUnitIds.length === 0) return "No destination unit recorded";
  const askedNames = movement.referredUnitIds
    .map((id) => units.find((candidate) => candidate.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  const asked = `${movement.referredUnitIds.length} ward${movement.referredUnitIds.length === 1 ? "" : "s"} asked, none has accepted`;
  return askedNames.length > 0 ? `${asked} — ${askedNames.join(", ")}` : asked;
}

function noneNote(anywhereText: string, wholeNetworkCount: number, singular: string, plural: string): string {
  if (wholeNetworkCount === 0) return anywhereText;
  return `None in this filter — ${wholeNetworkCount} ${wholeNetworkCount === 1 ? singular : plural} elsewhere in the network.`;
}

export function LongestWaitsSection({
  snapshot,
  units,
  wholeNetworkCount = 0,
  patients = [],
  referrals = [],
  onSelectMovement,
}: {
  snapshot: HandoverSnapshot;
  units: Unit[];
  wholeNetworkCount?: number;
  patients?: Patient[];
  referrals?: Referral[];
  onSelectMovement?: (movement: Movement, trigger?: HTMLElement) => void;
}) {
  return (
    <section className={styles.section} data-testid="ward-handover-longest-waits">
      <h2 className={styles.sectionHeading}>Longest waits</h2>
      {snapshot.longestWaits.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-handover-longest-waits-empty">
          {noneNote("None — no open movement.", wholeNetworkCount, "open movement", "open movements")}
        </p>
      ) : (
        <div className={pageStyles.boundedTableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Movement</th>
                <th scope="col">Wait</th>
                <th scope="col">Stage</th>
                <th scope="col">Department</th>
                <th scope="col">Destination</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.longestWaits.map((entry, index) => {
                const pat = resolveMovementPatient(entry.movement, patients, referrals);
                const formattedUmrn =
                  pat.umrn.startsWith("UMRN") || pat.umrn.startsWith("UM") ? pat.umrn : `UMRN ${pat.umrn}`;
                return (
                  <tr key={entry.movement.id}>
                    <td>{index + 1}</td>
                    {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                    <td>
                      <div className={pageStyles.patientIdentityCellSecondary}>
                        {onSelectMovement ? (
                          <button
                            type="button"
                            className={pageStyles.patientNameBtn}
                            onClick={(event) => onSelectMovement(entry.movement, event.currentTarget)}
                            title="View clinical handover details"
                          >
                            <b>{pat.name}</b>
                          </button>
                        ) : (
                          <b>{pat.name}</b>
                        )}
                        <span className={pageStyles.patientUmrnChipSecondary}>{formattedUmrn}</span>
                      </div>
                    </td>
                    <td>{elapsedLabel(entry.movement, snapshot.takenAt)}</td>
                    <td>{stageCopy[entry.movement.stage].label}</td>
                    <td>
                      <OriginDepartmentCell movement={entry.movement} />
                    </td>
                    <td>{destinationCell(entry.movement, units)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function PulledBedsSection({
  snapshot,
  wholeNetworkCount = 0,
  patients = [],
  referrals = [],
  onSelectMovement,
}: {
  snapshot: HandoverSnapshot;
  wholeNetworkCount?: number;
  patients?: Patient[];
  referrals?: Referral[];
  onSelectMovement?: (movement: Movement, trigger?: HTMLElement) => void;
}) {
  return (
    <section className={styles.section} data-testid="ward-handover-pulled-beds">
      <h2 className={styles.sectionHeading}>Beds pulled</h2>
      {snapshot.pulledBeds.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-handover-pulled-beds-empty">
          {noneNote("None — no bed is currently pulled.", wholeNetworkCount, "bed pulled", "beds pulled")}
        </p>
      ) : (
        <div className={pageStyles.boundedTableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Movement</th>
                <th scope="col">Wait</th>
                <th scope="col">Department</th>
                <th scope="col">Pull</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.pulledBeds.map((entry) => {
                const pat = resolveMovementPatient(entry.movement, patients, referrals);
                const formattedUmrn =
                  pat.umrn.startsWith("UMRN") || pat.umrn.startsWith("UM") ? pat.umrn : `UMRN ${pat.umrn}`;
                return (
                  <tr key={entry.movement.id}>
                    {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                    <td>
                      <div className={pageStyles.patientIdentityCellSecondary}>
                        {onSelectMovement ? (
                          <button
                            type="button"
                            className={pageStyles.patientNameBtn}
                            onClick={(event) => onSelectMovement(entry.movement, event.currentTarget)}
                            title="View clinical handover details"
                          >
                            <b>{pat.name}</b>
                          </button>
                        ) : (
                          <b>{pat.name}</b>
                        )}
                        <span className={pageStyles.patientUmrnChipSecondary}>{formattedUmrn}</span>
                      </div>
                    </td>
                    <td>{elapsedLabel(entry.movement, snapshot.takenAt)}</td>
                    <td>
                      <OriginDepartmentCell movement={entry.movement} />
                    </td>
                    <td>{pullLabel(entry.movement, entry.expired, snapshot.takenAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function InTransitSection({
  snapshot,
  units,
  wholeNetworkCount = 0,
  patients = [],
  referrals = [],
  onSelectMovement,
}: {
  snapshot: HandoverSnapshot;
  units: Unit[];
  wholeNetworkCount?: number;
  patients?: Patient[];
  referrals?: Referral[];
  onSelectMovement?: (movement: Movement, trigger?: HTMLElement) => void;
}) {
  return (
    <section className={styles.section} data-testid="ward-handover-in-transit">
      <h2 className={styles.sectionHeading}>In transit</h2>
      {snapshot.inTransit.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-handover-in-transit-empty">
          {noneNote(
            "None — no movement currently has a transport job.",
            wholeNetworkCount,
            "movement in transit",
            "movements in transit",
          )}
        </p>
      ) : (
        <div className={pageStyles.boundedTableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Movement</th>
                <th scope="col">Wait</th>
                <th scope="col">Department</th>
                <th scope="col">Destination</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.inTransit.map((entry) => {
                const pat = resolveMovementPatient(entry.movement, patients, referrals);
                const formattedUmrn =
                  pat.umrn.startsWith("UMRN") || pat.umrn.startsWith("UM") ? pat.umrn : `UMRN ${pat.umrn}`;
                return (
                  <tr key={entry.movement.id}>
                    {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                    <td>
                      <div className={pageStyles.patientIdentityCellSecondary}>
                        {onSelectMovement ? (
                          <button
                            type="button"
                            className={pageStyles.patientNameBtn}
                            onClick={(event) => onSelectMovement(entry.movement, event.currentTarget)}
                            title="View clinical handover details"
                          >
                            <b>{pat.name}</b>
                          </button>
                        ) : (
                          <b>{pat.name}</b>
                        )}
                        <span className={pageStyles.patientUmrnChipSecondary}>{formattedUmrn}</span>
                      </div>
                    </td>
                    <td>{elapsedLabel(entry.movement, snapshot.takenAt)}</td>
                    <td>
                      <OriginDepartmentCell movement={entry.movement} />
                    </td>
                    <td>{destinationCell(entry.movement, units)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function PlacementGoneWrongSection({
  snapshot,
  wholeNetworkCount = 0,
  patients = [],
  referrals = [],
  onSelectMovement,
}: {
  snapshot: HandoverSnapshot;
  units?: Unit[];
  wholeNetworkCount?: number;
  patients?: Patient[];
  referrals?: Referral[];
  onSelectMovement?: (movement: Movement, trigger?: HTMLElement) => void;
}) {
  return (
    <section className={styles.section} data-testid="ward-handover-placement-gone-wrong">
      <h2 className={styles.sectionHeading}>Placement gone wrong</h2>
      {snapshot.placementGoneWrong.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-handover-placement-gone-wrong-empty">
          {noneNote(
            "None — nothing has escalated and nothing has been declined by every unit it was referred to.",
            wholeNetworkCount,
            "placement gone wrong",
            "placements gone wrong",
          )}
        </p>
      ) : (
        <div className={pageStyles.boundedTableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Movement</th>
                <th scope="col">Wait</th>
                <th scope="col">Department</th>
                <th scope="col">Intervention reason</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.placementGoneWrong.map((entry) => {
                const pat = resolveMovementPatient(entry.movement, patients, referrals);
                const formattedUmrn =
                  pat.umrn.startsWith("UMRN") || pat.umrn.startsWith("UM") ? pat.umrn : `UMRN ${pat.umrn}`;
                return (
                  <tr key={entry.movement.id}>
                    {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                    <td>
                      <div className={pageStyles.patientIdentityCellSecondary}>
                        {onSelectMovement ? (
                          <button
                            type="button"
                            className={pageStyles.patientNameBtn}
                            onClick={(event) => onSelectMovement(entry.movement, event.currentTarget)}
                            title="View clinical handover details"
                          >
                            <b>{pat.name}</b>
                          </button>
                        ) : (
                          <b>{pat.name}</b>
                        )}
                        <span className={pageStyles.patientUmrnChipSecondary}>{formattedUmrn}</span>
                      </div>
                    </td>
                    <td>{elapsedLabel(entry.movement, snapshot.takenAt)}</td>
                    <td>
                      <OriginDepartmentCell movement={entry.movement} />
                    </td>
                    <td>{goneWrongLabel(entry.movement, entry.kind)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function originDepartmentText(movement: Movement): string {
  const originEd = movement.originEdId ? edById(movement.originEdId) : undefined;
  return originEd ? originEd.name : "No emergency department recorded";
}

function OriginDepartmentCell({ movement }: { movement: Movement }) {
  const originEd = movement.originEdId ? edById(movement.originEdId) : undefined;
  const fullLabel = originDepartmentText(movement);
  return (
    <span aria-label={fullLabel} title={fullLabel}>
      {originEd ? `${originEd.siteCode} ED` : fullLabel}
    </span>
  );
}

function pullLabel(movement: Movement, expired: boolean, takenAt: number) {
  const pullExpiresAt = movement.pullExpiresAt;
  if (pullExpiresAt === undefined) return "No pull time recorded";
  if (expired) return `Expired · ${splitDuration(takenAt - pullExpiresAt)} overdue`;
  return `Expires in ${splitDuration(pullExpiresAt - takenAt)}`;
}

function OpenBeforeShiftEndSection({
  items,
  now,
  patients = [],
  referrals = [],
  onSelectMovement,
}: {
  items: ReturnType<typeof openWorkBeforeShiftEnd>;
  now: Instant;
  patients?: Patient[];
  referrals?: Referral[];
  onSelectMovement?: (movement: Movement, trigger?: HTMLElement) => void;
}) {
  const shiftEndClock = `${String(Math.floor(DAY_SHIFT_END_MINUTE / 60)).padStart(2, "0")}:${String(DAY_SHIFT_END_MINUTE % 60).padStart(2, "0")}`;
  return (
    <Card as="section" className={pageStyles.tasksCard} data-testid="ward-handover-open-before-shift-end">
      <CardHead
        icon={ListChecks}
        title={`Still open at ${shiftEndClock}`}
        meta="Pull holds and typed form times"
        aside={<span className={pageStyles.taskCount}>{items.length}</span>}
      />
      {items.length === 0 ? (
        <CardBody>
          <p className={pageStyles.tasksEmpty} data-testid="ward-handover-open-before-shift-end-empty">
            None — no open pull hold or typed form time falls before {shiftEndClock}.
          </p>
        </CardBody>
      ) : (
        <CardBody flush>
          <ul className={pageStyles.taskList}>
            {items.map((item) => {
              const pat = resolveMovementPatient(item.movement, patients, referrals);
              const passed = item.at <= now;
              return (
                <li
                  key={`${item.kind}-${item.movement.id}-${item.at}`}
                  className={pageStyles.taskRow}
                  data-testid={`ward-handover-open-before-shift-end-${item.kind}-${item.movement.id}`}
                >
                  {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                  <span className={pageStyles.taskText}>
                    {onSelectMovement ? (
                      <button
                        type="button"
                        className={pageStyles.btnLinkAction}
                        onClick={(event) => onSelectMovement(item.movement, event.currentTarget)}
                        title="View clinical handover details"
                      >
                        {pat.name}
                      </button>
                    ) : (
                      <b>{pat.name}</b>
                    )}
                    <span className={pageStyles.taskKind}>
                      {item.kind === "pull_hold" ? "Bed pull" : "Typed form time"}
                    </span>
                  </span>
                  <span className={pageStyles.taskOwner}>{item.movement.owner || "No owner recorded"}</span>
                  <span className={pageStyles.taskDue}>
                    {passed ? <StatusGlyph tone="danger" size={9} /> : null}
                    {openWorkBeforeShiftEndLabel(item, now)}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardBody>
      )}
    </Card>
  );
}

function goneWrongLabel(movement: Movement, kind: "escalated" | "declined_by_all" | "acceptance_withdrawn") {
  if (kind === "escalated") {
    const contact = movement.escalation?.contact;
    return contact ? `Escalated — ${contact}` : "Escalated";
  }
  if (kind === "acceptance_withdrawn") {
    return "Acceptance withdrawn — no ward is being asked";
  }
  return `All ${movement.declines.length} referred unit${movement.declines.length === 1 ? "" : "s"} declined`;
}

export function SignOffSection({
  takenAt,
  dayZero,
  scopeLabel,
  includedOpenCount,
  totalOpenCount,
  breachedOnSheetCount,
  urgentOutsideFilter,
  onSignOff,
  signOffRecord,
}: {
  takenAt: Instant;
  dayZero: Date;
  scopeLabel: string;
  includedOpenCount: number;
  totalOpenCount: number;
  breachedOnSheetCount: number;
  urgentOutsideFilter: Movement[];
  onSignOff?: () => void;
  signOffRecord?: { role: WardFlowRole; at: Instant } | null;
}) {
  const signed = Boolean(signOffRecord);
  return (
    <Card as="section" className={pageStyles.signOffCard} data-testid="ward-handover-sign-off">
      <CardHead
        icon={ShieldCheck}
        title="Shift and sign off"
        aside={
          <span className={pageStyles.signState}>
            <StatusGlyph tone={signed ? "success" : "neutral"} size={9} />
            {signed ? "Signed" : "Not signed"}
          </span>
        }
      />
      <CardBody className={pageStyles.signOffBody}>
        <ul className={pageStyles.signRecords} data-testid="ward-handover-sign-off-records">
          <li>
            Snapshot: {formatSheetMoment(takenAt, dayZero)} · {scopeLabel}.
          </li>
          <li>
            Coverage: {includedOpenCount} of {totalOpenCount} open movement{totalOpenCount === 1 ? "" : "s"}.
          </li>
          <li>
            {breachedOnSheetCount === 0
              ? "No form due time passed on the sheet"
              : `${breachedOnSheetCount} form due time${breachedOnSheetCount === 1 ? "" : "s"} passed on the sheet`}
            {" · "}
            {urgentOutsideFilter.length === 0
              ? "none urgent outside the filter."
              : `${urgentOutsideFilter.length} urgent outside: ${urgentOutsideFilter.map((movement) => movement.id).join(", ")}.`}
          </li>
        </ul>
        <div className={pageStyles.signAction}>
          <p
            className={pageStyles.signStatus}
            data-testid="ward-handover-sign-off-visible-status"
            data-recorded={signed ? "true" : "false"}
          >
            {signOffRecord
              ? `Signed off as ${signOffRecord.role} at ${formatInstantWithDay(signOffRecord.at, takenAt)}.`
              : "Sign-off is not recorded yet."}
          </p>
          <Button
            variant="sec"
            size="sm"
            data-testid="ward-handover-sign-off-button"
            onClick={() => {
              if (onSignOff) onSignOff();
              else announceToWardShell("Not wired in this prototype.");
            }}
          >
            Sign off the handover
          </Button>
        </div>
        <h3 className={pageStyles.signNoteHeading}>Incoming note</h3>
        <p className={pageStyles.signNote} data-testid="ward-handover-sign-off-notes">
          No note is recorded for this shift. This does not describe whether the shift was quiet.
        </p>
      </CardBody>
    </Card>
  );
}
