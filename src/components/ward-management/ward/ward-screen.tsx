"use client";

import {
  ArrowLeftRight,
  Bell,
  ChevronDown,
  ChevronLeft,
  Clock,
  FileText,
  ListChecks,
  MoreHorizontal,
  Printer,
  Search,
  Send,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { hasOpenSheet } from "@/components/ui/sheet-focus";
import { handoverScopeValue } from "@/components/ward-management/handover/handover-scope";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { useOnlineStatus } from "@/components/ward-management/use-online-status";
import { absentOnOrder } from "@/components/ward-management/ward-absence-tasks";
import {
  daysInBed as admissionStayDays,
  isPastExpectedDischarge,
  LEAVING_DESTINATIONS,
  type LeavingDestination,
  stayBand,
} from "@/components/ward-management/ward-admissions";
import {
  bedsPendingPreparation,
  capacityBreakdown,
  releaseBand,
} from "@/components/ward-management/ward-bed-availability";
import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import { bedHold as bedHoldOf } from "@/components/ward-management/ward-bed-hold";
import { BED_STATE_DETAILS, BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import {
  currentShift,
  dayShiftEndInstant,
  releasesDueByShiftEnd,
} from "@/components/ward-management/ward-board-time-features";
import {
  type BedReleaseBlocker,
  OVERRIDE_REASONS,
  type OverrideReason,
  type ReleasePullReason,
  wardIntakeConstraintLabels,
} from "@/components/ward-management/ward-change-reasons";
import {
  calendarDateOf,
  dayOf,
  formatInstant,
  formatInstantWithDay,
  formatRemaining,
  type Instant,
  minuteOfDay,
  minutesUntil,
} from "@/components/ward-management/ward-clock";
import {
  BED_RELEASE_BLOCKED_FIGURE_LABEL,
  isOpen,
  isStoppedTransportAwaitingRelease,
  overridesAgainstUnit,
  stageCopy,
  unitCapacity,
} from "@/components/ward-management/ward-derivations";
import { tentativeDiagnosisPhrase } from "@/components/ward-management/ward-diagnosis";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { HIGH_ACUITY_STAFFING_REFUSAL, OVERRIDE_REASON_REQUIRED } from "@/components/ward-management/ward-flow-reducer";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import {
  type DeclineReason,
  type Movement,
  RECORDED_SEXES,
  type RecordedSex,
  type Rejection,
} from "@/components/ward-management/ward-model";
import { formatWardOccupancy, wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { WARD_OFFLINE_SAVED_NOTE } from "@/components/ward-management/ward-offline-copy";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  LEAVE_BED_OPEN_WARNING_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
  UNDO_TOAST_MS,
} from "@/components/ward-management/ward-operational-defaults";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { patientAgeYears } from "@/components/ward-management/ward-patients";
import { referralSuburbIsKnown, wardTransferNeedsCoordinator } from "@/components/ward-management/ward-referrals";
import { setDeskRole, useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { roleLimitReason } from "@/components/ward-management/ward-role-permissions";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { edById, siteByCode, WARD_LOCKED_BED_SPLITS } from "@/components/ward-management/ward-sites";
import {
  buttonClass,
  CheckingFoot,
  durMinutes,
  Hero,
  LiveChip,
  Menu,
  ScrollRow,
  TextInput,
  useIsPhone,
  useOptionalToast,
} from "@/components/wf";
import { WardReferralInbox } from "../referrals/ward-referral-inbox";
import styles from "./ward.module.css";
import type { WaitingReferral } from "./ward-bed-board";
import {
  type BoardPick,
  bedFits,
  bedNumberLabel,
  fitCount,
  pickedUpSay,
  whyBedDoesNotFit,
} from "./ward-bed-board-logic";
import { layoutBedNumbers, seatStays } from "./ward-bed-layout";
import type { BedItem } from "./ward-beds-matrix";
import { openDecisionCount } from "./ward-decision-count";
import { type WardFlowTab, WardHomeTab, type WardShiftView, wardActNowCount } from "./ward-home-tab";
import { type WardBedFilter, WardTelemetryRibbon } from "./ward-telemetry-ribbon";

const WardDailySheetDialog = dynamic(
  () => import("@/components/ward-management/board/ward-daily-sheet").then((m) => m.WardDailySheetDialog),
  { ssr: false },
);
const WardBedDossierDrawer = dynamic(() => import("./ward-bed-dossier-drawer").then((m) => m.WardBedDossierDrawer), {
  ssr: false,
});
const WardNotificationCenter = dynamic(
  () => import("./ward-notification-center").then((m) => m.WardNotificationCenter),
  { ssr: false },
);
const WardAnswerView = dynamic(() => import("./ward-answer-view").then((m) => m.WardAnswerView), {
  ssr: false,
  // The loading state keeps the page's one main landmark and one h1; the loaded view replaces it
  // wholesale, so neither is ever duplicated.
  loading: () => (
    <main id="main-content" data-testid="ward-answer-screen">
      <h1>Ward answer</h1>
      <p role="status">Loading ward answer…</p>
    </main>
  ),
});
const WardDecisionsCockpit = dynamic(() => import("./ward-decisions-cockpit").then((m) => m.WardDecisionsCockpit), {
  ssr: false,
});
const WardArrivalsCorridor = dynamic(() => import("./ward-arrivals-corridor").then((m) => m.WardArrivalsCorridor), {
  ssr: false,
});
const WardDischargesMatrix = dynamic(() => import("./ward-discharges-matrix").then((m) => m.WardDischargesMatrix), {
  ssr: false,
});
const WardBedsMatrix = dynamic(() => import("./ward-beds-matrix").then((m) => m.WardBedsMatrix), { ssr: false });
const WardBedBoard = dynamic(() => import("./ward-bed-board").then((m) => m.WardBedBoard), { ssr: false });

/** What the Bed board is waiting to hear back from the engine after a place or an undo. */
type BoardCheck = {
  prior: number;
  bed: number;
  success: string;
  /** What Undo reverses; absent for an undo itself. */
  undo?:
    | { kind: "stay"; admissionId: string; unitId: string }
    | { kind: "referral"; referralId: string; unitId: string }
    | { kind: "movement"; movementId: string; unitId: string };
};

/** The undo event for what the Bed board placed or moved (v10 pass 2 and 3). */
function boardUndoEvent(undo: NonNullable<BoardCheck["undo"]>, now: Instant): WardFlowEvent {
  if (undo.kind === "stay")
    return {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      now,
      admissionId: undo.admissionId,
      actingUnitId: undo.unitId,
    };
  if (undo.kind === "movement")
    return {
      type: "UNDO_ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now,
      movementId: undo.movementId,
      actingUnitId: undo.unitId,
    };
  return {
    type: "UNDO_REFERRAL_DECISION",
    role: "ward",
    now,
    referralId: undo.referralId,
    actingUnitId: undo.unitId,
  };
}

/** The router, or null where the screen renders outside the app router (a test or preview). */
/** This ward's Handover page, scoped to the ward. */
function wardHandoverHref(unitId: string): string {
  return `/mockups/ward-flow/handover?scope=${encodeURIComponent(handoverScopeValue({ kind: "ward", id: unitId }))}`;
}

/** Set by the Census "Ward bed" link (patient-census-view.tsx): the exact `unit:bed` it opened. */
const CENSUS_BED_OPENER_TARGET = "wardflow:census-bed-opener-target";
const censusBedOpenerTarget = (unitId: string, bed: number) => `${unitId}:${bed}`;

/** history.state key marking the entry this screen pushed when a bed drawer opened. */
const WARD_BED_DRAWER_ENTRY = "wardBedDrawer";

/**
 * history.state without Next.js's own entries. Next's patched history methods skip syncing
 * `useSearchParams` and the router's URL for state carrying `__NA`, so writing it back would leave
 * the router on a stale `?bed=`; Next re-adds its entries itself when it sees our write.
 */
function ownHistoryState(state: unknown): Record<string, unknown> {
  if (!state || typeof state !== "object") return {};
  const own = { ...(state as Record<string, unknown>) };
  delete own.__NA;
  delete own.__PRIVATE_NEXTJS_INTERNALS_TREE;
  return own;
}

function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

/** The search params, or null where the screen renders outside the app router. */
function useOptionalSearchParams(): ReturnType<typeof useSearchParams> | null {
  try {
    return useSearchParams();
  } catch {
    return null;
  }
}

/** "Day shift 07:00 to 15:00" for the shift `now` falls in, read from the labelled default pattern. */
function shiftLine(now: Instant): string {
  const shift = currentShift(now);
  const clock = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const name = shift.name.charAt(0) + shift.name.slice(1).toLowerCase();
  return `${name} ${clock(shift.startMinute)} to ${clock(shift.endMinute)}`;
}

type WardScreenProps = {
  departurePlanning?: boolean;
  unitId: string;
  presentation?: "overview" | "answer";
};

function originPlaceLabel(originEdId: string): string {
  return edById(originEdId)?.name ?? originEdId;
}

function arrivalIsLate(movement: Movement, now: Instant): boolean {
  const estimatedArrivalAt = movement.arrivalDetails?.estimatedArrivalAt;
  if (estimatedArrivalAt === undefined) return false;
  return now > estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES;
}

/**
 * Task 8: one inpatient unit's own view — the ward answering what the coordinator refers,
 * never a filtered copy of the coordinator's statewide screen. Everything here is scoped to
 * exactly one `Unit`, resolved from the provider's live `units`. An id that resolves to nothing
 * renders an explicit empty state naming the id (Global Constraint, addendum R40) — never a
 * substituted unit, never `?? allUnits()[0]`.
 *
 * Every figure is derived fresh from the live `movements`/`units` the provider hands back on
 * every render, never cached in local state — the same discipline `ward-flow-queue-selection`
 * proves for the coordinator screen. Once a referral is accepted, it disappears from "incoming"
 * and appears under "accepted, pulled or en route" on the very next render, because both lists are
 * plain filters over the same live array; there is no local "it worked" flag anywhere in this
 * file for the reasons `shortlist-panel.tsx`'s own comment on `OverrideRecord` explains.
 *
 * Whole-branch review Critical 1: this screen used to resolve `unit` via `unitById(unitId)` —
 * `ward-sites.ts`'s frozen fixture — so this ward's own bed grid, its "Currently confirmed"
 * line, its capacity-input default and `pullBlockedReason`'s allocatable check never moved even
 * after this exact screen dispatched `CONFIRM_CAPACITY` against itself. `unit` now resolves from
 * the provider's live `units`, the same collection `CONFIRM_CAPACITY`/`PULL_PATIENT`/`PATIENT_ARRIVED`
 * all write to, so a ward reading its own action back is now structurally the same read as
 * anyone else reading it.
 */

export function WardScreen({ unitId, presentation = "overview", departurePlanning = false }: WardScreenProps) {
  if (presentation === "answer") {
    return <WardAnswerView unitId={unitId} />;
  }
  return (
    <WardOverviewScreen
      key={`${unitId}:${departurePlanning}`}
      unitId={unitId}
      presentation={presentation}
      departurePlanning={departurePlanning}
    />
  );
}
// Fail closed for older provider adapters/test doubles without the identity projection.
// Never reconstruct the missing lookup by reaching for the full referral array here.
const unavailablePatientIdentity = (): ResolvedPatientInfo => ({
  displayName: "Not recorded",
  formalName: "Not recorded",
  umrn: "UMRN not recorded",
  initials: "UP",
});

function WardOverviewScreen({ unitId, presentation = "overview", departurePlanning = false }: WardScreenProps) {
  const {
    movements,
    resolvePatientIdentity = unavailablePatientIdentity,
    units,
    bedReleases,
    leaveBeds,
    refreshRequests,
    dispatch,
    recordWardDeparture,
    rejections,
    admissions,
    notices,
    morningRollupConfirmations,
    configuration,
    dayZero,
    wardReferralInbox,
    patients,
  } = useWardFlow();
  const now = useWardFlowClock();

  // Feature 11: Raise referral dispatches as `community`; this ward route keeps it through the
  // listed cross-role pair in `ward-role-permissions.ts`.
  const raiseReferralGate = useRoleGate()("RECEIVE_REFERRAL");
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  // Phone (v10): This shift and Ward flow sit behind a chip and open as bottom sheets.
  const isPhone = useIsPhone();
  const [phonePanel, setPhonePanel] = useState<"shift" | "flow" | null>(null);
  // A sheet left open when the screen widens past the phone is closed, not reopened on return.
  const [panelWasPhone, setPanelWasPhone] = useState(isPhone);
  if (panelWasPhone !== isPhone) {
    setPanelWasPhone(isPhone);
    if (!isPhone) setPhonePanel(null);
  }
  const [phoneTodoCount, setPhoneTodoCount] = useState<number | undefined>(undefined);
  const [dismissedBuzzes, setDismissedBuzzes] = useState<number[]>([]);
  // Item 44, build plan task F3 (§2 "Bed board, ward page and all seven statistics screens: a
  // sentence only."). A hook, so it is read unconditionally, before the not-found early return
  // below — the same discipline this file's own comment already gives for `overrideReason`.
  const service = useServiceScope();
  // Resolved from the provider's live `units`, not the frozen `unitById()` fixture — after
  // `CONFIRM_CAPACITY` or `PULL_PATIENT` updates `state.units`, this screen must show the current
  // bed counts (and gate `pullBlockedReason` on them) rather than the stale fixture value.
  const unit = units.find((candidate) => candidate.id === unitId);

  // Declared unconditionally, before the early return below — React hooks must run in the same
  // order on every render, and the not-found branch never touches either of these.
  /**
   * The reason a ward is recording against a refusal it has just been given. ⚠️ REACTIVE, NEVER
   * PROACTIVE, and the owner's coordinator ruled the shape: nothing appears until the engine has
   * actually refused, so the ward sees the SPECIFIC gate it failed before choosing a reason —
   * which is the right order for a clinical decision. A reason control sitting on every row before
   * anything is pressed would ask a person to justify something before they know what it is, and
   * would read as a suggestion rather than a safeguard. The ordinary accept, which is nearly all
   * of them, is untouched.
   *
   * One value, not a map: `lastActionRejection` holds a single refusal, so at most one of these
   * forms can be open at a time by construction.
   */
  const [overrideReason, setOverrideReason] = useState<OverrideReason | undefined>(undefined);
  /**
   * The "Nurse unit manager consulted" tick (item 10, owner answers 17 September 2026) — a SECOND
   * fact the high-acuity staffing refusal needs beside the reason above, and neither answers for
   * the other. Shown only beside that one refusal (see `overrideReasonForm`'s own doc comment), so
   * it is one boolean rather than a map: at most one such form is open at a time, the same
   * reasoning `overrideReason` above already states.
   */
  const [numConsulted, setNumConsulted] = useState(false);
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  const [declineReason, setDeclineReason] = useState<DeclineReason | undefined>(undefined);
  const [capacityRevision, setCapacityRevision] = useState(() => unit?.allocatable.revision ?? 0);
  const [capacityValue, setCapacityValue] = useState<string>(() => String(unit?.allocatable.value ?? 0));

  // Task 3: the undo the prototype has never had. Keyed by movementId, same pattern as
  // `declineOpenFor`/`declineReason` above — at most one release form and one cancel form open
  // at a time.
  const [releaseOpenFor, setReleaseOpenFor] = useState<string | undefined>(undefined);
  const [releaseReason, setReleaseReason] = useState<ReleasePullReason | undefined>(undefined);
  const dischargeCheckRef = useRef<{
    prior: number;
    success: string;
    who: string;
    codes: string[];
    /** Audit A1-12: the stay a recorded departure can take back from its toast. */
    undoAdmissionId?: string;
  } | null>(null);
  const [dischargeToken, setDischargeToken] = useState(0);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"attn" | "board" | "coming" | "out" | "beds" | "return">(
    departurePlanning ? "return" : "attn",
  );
  const [selectedPod, setSelectedPod] = useState<string>("all");
  // Ward Hub (9 Oct 2026): the hero pills, the Find box and the home panels share this state.
  const [bedFilter, setBedFilter] = useState<WardBedFilter>("all");
  const [bedQuery, setBedQuery] = useState("");
  const [flowTab, setFlowTab] = useState<WardFlowTab>("referrals");
  const [shiftView, setShiftView] = useState<WardShiftView>("todo");
  const router = useOptionalRouter();
  const searchParams = useOptionalSearchParams();
  const bedParam = searchParams?.get("bed");
  const parsedBed =
    bedParam !== null && bedParam !== undefined && /^\d+$/.test(bedParam) ? Number.parseInt(bedParam, 10) : null;
  const [selectedBed, setSelectedBed] = useState<number | null>(parsedBed);
  // Bumped when a `?bed=` naming no bed on this ward is refused, so the URL sync below drops it.
  const [refusedBedParam, setRefusedBedParam] = useState(0);
  const [prevBedParam, setPrevBedParam] = useState<string | null | undefined>(bedParam);
  if (prevBedParam !== bedParam) {
    setPrevBedParam(bedParam);
    setSelectedBed(parsedBed);
  }
  // v10 pass 3, Bed board: who is picked up, what the board says and the bed placed last.
  const [boardPick, setBoardPick] = useState<BoardPick | null>(null);
  const [boardSay, setBoardSay] = useState("");
  const [placedBed, setPlacedBed] = useState<number | null>(null);
  const boardCheckRef = useRef<BoardCheck | null>(null);
  const [boardToken, setBoardToken] = useState(0);
  const toast = useOptionalToast();
  const pathname = usePathname() ?? "";
  const routeRole = useRouteRole();
  const setRole = useCallback(
    (nextRole: "ward") => {
      setDeskRole(nextRole, pathname);
    },
    [pathname],
  );
  const wardRoleLockNote =
    routeRole !== "ward" ? (
      <span className="lockline" data-testid="ward-role-lockline">
        Viewing as {routeRole} desk (ward actions are read-only) &middot;{" "}
        <button
          type="button"
          className="lockline"
          onClick={() => {
            setRole("ward");
          }}
          data-testid="ward-switch-to-ward-desk-btn"
        >
          Switch to Ward desk →
        </button>
      </span>
    ) : null;
  // The raised referral's form link belongs to that toast message and that bed only, so it cannot linger
  // on later toasts or on another patient's bed.
  const [raisedReferral, setRaisedReferral] = useState<{ href: string; message: string; bed: number | null } | null>(
    null,
  );
  // An Undo pressed seconds later sends the clock as it is then, not as it was at the placement.
  const nowRef = useRef(now);
  const rejectionCountRef = useRef(rejections.length);
  useEffect(() => {
    nowRef.current = now;
    rejectionCountRef.current = rejections.length;
  }, [now, rejections.length]);
  const online = useOnlineStatus();
  const [confirmNumbersOpen, setConfirmNumbersOpen] = useState(false);
  const [dailySheetOpen, setDailySheetOpen] = useState(false);
  const [drawerLeavingDestination, setDrawerLeavingDestination] =
    useState<LeavingDestination>("discharged-to-the-community");
  // A destination belongs to the bed it was chosen for: opening or stepping to another bed starts
  // from the default again, so one person's choice is never recorded against the next.
  const [destinationBed, setDestinationBed] = useState<number | null>(null);
  if (destinationBed !== selectedBed) {
    setDestinationBed(selectedBed);
    setDrawerLeavingDestination("discharged-to-the-community");
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const bed = params.get("bed");
      if (bed !== null && /^\d+$/.test(bed)) {
        setSelectedBed(Number.parseInt(bed, 10));
      } else {
        setSelectedBed(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get("bed");
    const next = selectedBed !== null ? String(selectedBed) : null;
    if (current === next) return;

    const state = ownHistoryState(window.history.state);
    if (next !== null) {
      url.searchParams.set("bed", next);
      // Only opening a drawer creates a navigation point, marked so closing can return through it.
      // Normalisation and bed-to-bed movement replace the current URL (keeping the marker) so Back
      // never reopens a closed/visited bed.
      if (current === null) window.history.pushState({ ...state, [WARD_BED_DRAWER_ENTRY]: true }, "", url.toString());
      else window.history.replaceState(state, "", url.toString());
    } else if (state[WARD_BED_DRAWER_ENTRY]) {
      // This screen pushed the drawer's entry: step back over it rather than adding another ward
      // entry, so one Back after closing leaves the ward instead of reopening the bed.
      window.history.back();
    } else {
      url.searchParams.delete("bed");
      window.history.replaceState(state, "", url.toString());
    }
  }, [selectedBed, refusedBedParam]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const bedTriggerRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const confirmTriggerRef = useRef<HTMLButtonElement | null>(null);
  const capacityModalRef = useRef<HTMLDivElement | null>(null);
  const bedDrawerRef = useRef<HTMLElement | null>(null);
  const notificationCenterRef = useRef<HTMLDivElement>(null);
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);

  // The outcome of "Discharged" (Josh, 1A): a refusal shows its reason; only an accepted departure
  // shows the success message.
  useEffect(() => {
    const check = dischargeCheckRef.current;
    if (dischargeToken === 0 || check === null) return;
    dischargeCheckRef.current = null;
    const refused = rejections.length > check.prior ? rejections[rejections.length - 1] : undefined;
    // A refusal names the person the way the success message does (Josh, 26 Sept 2026): the
    // engine's reason quotes record codes, so each code of this person's is shown as their name.
    const reason = refused
      ? check.codes.reduce((text, code) => text.split(code).join(check.who), refused.reason)
      : undefined;
    // Protected refusals deliberately omit identifiers; retain the name already shown on this scoped card.
    const namedReason =
      reason !== undefined && check.codes.length > 0 && !reason.includes(check.who)
        ? `${check.who}: ${reason}`
        : reason;
    if (namedReason !== undefined) {
      setToastMessage(`Not recorded: ${namedReason}. Nothing was changed.`);
      return;
    }
    // Audit A1-12: "Has left" offers Undo like Move bed, through the same toast.
    // A1-18 (audit 13 Oct 2026): a departure recorded offline says it has not gone anywhere.
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const successText =
      offline && toast?.savesOnDevice?.() ? `${check.success} ${WARD_OFFLINE_SAVED_NOTE}` : check.success;
    const undoAdmissionId = check.undoAdmissionId;
    if (!toast || undoAdmissionId === undefined) {
      setToastMessage(successText);
      return;
    }
    const undoLimit = roleLimitReason(routeRole, "UNDO_DEPARTURE");
    toast.push({
      tone: "success",
      title: successText,
      ...(undoLimit
        ? { body: `Undo: ${undoLimit}` }
        : {
            undo: {
              durationMs: UNDO_TOAST_MS,
              onUndo: () => {
                dischargeCheckRef.current = {
                  prior: rejectionCountRef.current,
                  success: `Undone. ${check.who} is back in their bed.`,
                  who: check.who,
                  codes: check.codes,
                };
                dispatch({
                  type: "UNDO_DEPARTURE",
                  role: "ward",
                  now: nowRef.current,
                  admissionId: undoAdmissionId,
                  actingUnitId: unitId,
                });
                setDischargeToken((token) => token + 1);
              },
            },
          }),
    });
    // `toast`, `routeRole`, `dispatch` and `unitId` are stable for the screen's life; the token drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dischargeToken, rejections]);

  // The outcome of a Bed board place or undo: a refusal says why on the board; a placement offers
  // Undo on the toast, gated by the route's role like any other control.
  useEffect(() => {
    const check = boardCheckRef.current;
    if (boardToken === 0 || check === null) return;
    boardCheckRef.current = null;
    const refused = rejections.length > check.prior ? rejections[rejections.length - 1] : undefined;
    if (refused) {
      const said = `Not recorded: ${refused.reason}. Nothing was changed.`;
      setBoardSay(said);
      if (toast) toast.push({ tone: "warning", title: said });
      return;
    }
    setBoardSay(check.success);
    setPlacedBed(check.undo ? check.bed : null);
    if (!toast) {
      setToastMessage(check.success);
      return;
    }
    const undo = check.undo;
    if (!undo) {
      toast.push({ tone: "info", title: check.success });
      return;
    }
    const undoLimit = roleLimitReason(routeRole, boardUndoEvent(undo, nowRef.current).type);
    toast.push({
      tone: "success",
      title: check.success,
      ...(undoLimit
        ? { body: `Undo: ${undoLimit}` }
        : {
            undo: {
              durationMs: UNDO_TOAST_MS,
              onUndo: () => {
                boardCheckRef.current = {
                  prior: rejectionCountRef.current,
                  bed: check.bed,
                  success: "Undone. The bed and the person are back where they were.",
                };
                // Literal types, one per kind, so the override-surface guard reads each one.
                const at = nowRef.current;
                if (undo.kind === "stay")
                  dispatch({
                    type: "UNDO_PLACE_IN_BED",
                    role: "ward",
                    now: at,
                    admissionId: undo.admissionId,
                    actingUnitId: undo.unitId,
                  });
                else if (undo.kind === "movement")
                  dispatch({
                    type: "UNDO_ACCEPT_IN_PRINCIPLE",
                    role: "ward",
                    now: at,
                    movementId: undo.movementId,
                    actingUnitId: undo.unitId,
                  });
                else
                  dispatch({
                    type: "UNDO_REFERRAL_DECISION",
                    role: "ward",
                    now: at,
                    referralId: undo.referralId,
                    actingUnitId: undo.unitId,
                  });
                setBoardToken((token) => token + 1);
              },
            },
          }),
    });
    // `toast`, `routeRole` and `dispatch` are stable for the screen's life; the token drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardToken, rejections]);

  useEffect(() => {
    function syncTabWithHash() {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (hash === "#bed-capacity") setActiveTab("attn");
      else if (hash === "#ward-daily-return") setActiveTab("return");
      else if (hash === "#ward-flag-bed-release" || hash === "#ward-leave-bed-form") setActiveTab("out");
    }
    syncTabWithHash();
    window.addEventListener("hashchange", syncTabWithHash);
    return () => {
      window.removeEventListener("hashchange", syncTabWithHash);
    };
  }, []);

  const prevSelectedBedRef = useRef<number | null>(selectedBed);
  const bedDrawerSteppedRef = useRef(false);
  useEffect(() => {
    if (prevSelectedBedRef.current !== selectedBed) {
      if (prevSelectedBedRef.current === null && selectedBed !== null) {
        bedDrawerSteppedRef.current = false;
      } else if (prevSelectedBedRef.current !== null && selectedBed !== null) {
        bedDrawerSteppedRef.current = true;
      }
      prevSelectedBedRef.current = selectedBed;
    }
  }, [selectedBed]);

  const closeBedDrawer = useCallback(
    (returnToCensus = true) => {
      if (selectedBed !== null) {
        if (typeof window !== "undefined") {
          // Return to Census only for the exact bed its link opened, and only with a router to go
          // back through; a stale or unrelated marker is dropped and the drawer closes normally.
          const target = window.sessionStorage.getItem(CENSUS_BED_OPENER_TARGET);
          const fromCensus = target !== null && target === censusBedOpenerTarget(unitId, selectedBed);
          window.sessionStorage.removeItem(CENSUS_BED_OPENER_TARGET);
          if (fromCensus && router && returnToCensus) {
            router.back();
            return;
          }
          if (target !== null) window.sessionStorage.removeItem("wardflow:census-bed-opener");
        }
        const bedNum = selectedBed;
        const stepped = bedDrawerSteppedRef.current;
        bedDrawerSteppedRef.current = false;
        setSelectedBed(null);
        // The drawer hands focus back to whatever opened it (a tile, a list row, a Ward flow row)
        // unless the user stepped to a different bed while inside the drawer or the opener is gone.
        setTimeout(() => {
          const active = document.activeElement;
          if (!stepped && active instanceof HTMLElement && active !== document.body && active.isConnected) return;
          const tile =
            activeTab === "board"
              ? (document.querySelector<HTMLElement>(`[data-testid="ward-board-bed-${bedNum}"]`) ??
                bedTriggerRefs.current.get(bedNum))
              : activeTab === "beds"
                ? (document.querySelector<HTMLElement>(`[data-testid="ward-bed-card-${bedNum}"]`) ??
                  bedTriggerRefs.current.get(bedNum))
                : (bedTriggerRefs.current.get(bedNum) ??
                  document.querySelector<HTMLElement>(
                    `[data-testid="ward-bed-card-${bedNum}"], [data-testid="ward-board-bed-${bedNum}"]`,
                  ));
          if (tile?.isConnected) tile.focus({ preventScroll: true });
        }, 0);
      }
    },
    [selectedBed, router, unitId, activeTab],
  );

  // Focus goes back to whichever control opened the modal (the header button or the home tab's),
  // and falls back to the header button only when that control is gone.
  const capacityOpenerRef = useRef<HTMLElement | null>(null);
  const openCapacityModal = useCallback(() => {
    capacityOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmNumbersOpen(true);
  }, []);
  const closeCapacityModal = useCallback(() => {
    setConfirmNumbersOpen(false);
    setTimeout(() => {
      const opener = capacityOpenerRef.current;
      (opener?.isConnected ? opener : confirmTriggerRef.current)?.focus({
        preventScroll: true,
      });
      capacityOpenerRef.current = null;
    }, 0);
  }, []);
  useWardModalFocus(confirmNumbersOpen, capacityModalRef, closeCapacityModal);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (notificationCenterOpen) {
          setNotificationCenterOpen(false);
          setTimeout(() => {
            notificationTriggerRef.current?.focus({ preventScroll: true });
          }, 0);
          return;
        }
        if (hasOpenSheet()) return;
        if (confirmNumbersOpen) {
          closeCapacityModal();
        } else if (dailySheetOpen) {
          setDailySheetOpen(false);
        } else if (boardPick !== null) {
          setBoardPick(null);
          setBoardSay("Put down. Nothing changed.");
        } else if (selectedBed !== null) {
          closeBedDrawer();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedBed,
    boardPick,
    dailySheetOpen,
    confirmNumbersOpen,
    notificationCenterOpen,
    closeBedDrawer,
    closeCapacityModal,
  ]);

  // Click-outside listener for floating notification center
  useEffect(() => {
    if (!notificationCenterOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        notificationCenterRef.current &&
        !notificationCenterRef.current.contains(target) &&
        // Phone and iPad portrait open it from the More menu, which has no trigger here.
        !notificationTriggerRef.current?.contains(target)
      ) {
        setNotificationCenterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notificationCenterOpen]);

  // Initial focus and focus trapping for Telemetry Drawer
  useEffect(() => {
    if (selectedBed !== null && bedDrawerRef.current) {
      const focusable = Array.from(
        bedDrawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      focusable[0]?.focus();
    }
  }, [selectedBed]);

  // Initial focus and focus trapping for Capacity Confirmation Modal
  useEffect(() => {
    if (confirmNumbersOpen && capacityModalRef.current) {
      const focusable = Array.from(
        capacityModalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      focusable[0]?.focus();
    }
  }, [confirmNumbersOpen]);

  function handleBedDrawerKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeBedDrawer();
      return;
    }
    if (event.key !== "Tab") return;
    const drawer = bedDrawerRef.current;
    if (!drawer) return;
    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute("disabled"));
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleCapacityModalKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeCapacityModal();
      return;
    }
    if (event.key !== "Tab") return;
    const modal = capacityModalRef.current;
    if (!modal) return;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute("disabled"));
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /*
   * THE WARD'S OWN REFUSAL SURFACE for `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` — until now this
   * screen dispatched both and never read `rejections` at all, so a ward whose accept or pull was
   * refused (the reducer's own bed-readiness, specialling or already-accepted gates, none of
   * which `referralAnswerBlocked`/`pullBlockedReason` above mirror) saw nothing happen and had no
   * way to tell a refusal from a slow render.
   *
   * Same async-detection pattern as `referral-match.tsx`'s `checkToken`/`priorRejectionCountRef`
   * pair and `ed-screen.tsx`'s `declineRejection`: `dispatch` never reports whether the reducer
   * accepted or refused an event, so the only way to know is to compare `rejections` before and
   * after, on the next render. `checkToken === 0` guards the same case `ed-screen.tsx`'s own
   * comment names — nothing has been dispatched from this screen yet, so a rejection already in
   * state belongs to somebody else and must not be surfaced here.
   *
   * Held as ONE `Rejection`, not two — a ward user presses one button at a time — and matched
   * everywhere it is rendered by `movementId` ALONE, never narrowed to "only in the section the
   * button that caused it lives in": `Rejection.movementId` is the movement id for both these
   * events (the default case of `subjectId` in `ward-flow-reducer.ts`), and a refusal does not
   * stop being true because the movement's row has since moved to the other list — the exact
   * shape of a second `ACCEPT_IN_PRINCIPLE` refused as already-accepted, which lands the movement
   * in "accepted" before its own refusal is even rendered.
   */
  const priorRejectionCountRef = useRef(rejections.length);
  const [checkToken, setCheckToken] = useState(0);
  const [lastActionRejection, setLastActionRejection] = useState<Rejection | undefined>(undefined);
  // A1-8 (audit round 2): an accept from the Ward flow list offers Undo on its toast, as the Ward
  // answer view and the Bed board already do. Set by the accept, read once by the check below.
  const acceptUndoRef = useRef<{ movementId: string; unitId: string } | null>(null);

  useEffect(() => {
    if (checkToken === 0) return;
    const acceptUndo = acceptUndoRef.current;
    acceptUndoRef.current = null;
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      setLastActionRejection(
        newest.attempted === "ACCEPT_IN_PRINCIPLE" ||
          newest.attempted === "PULL_PATIENT" ||
          newest.attempted === "RELEASE_HELD_BED"
          ? newest
          : undefined,
      );
    } else {
      setLastActionRejection(undefined);
      if (acceptUndo && toast) {
        const success = "Accepted in principle.";
        const undoLimit = roleLimitReason(routeRole, "UNDO_ACCEPT_IN_PRINCIPLE");
        toast.push({
          tone: "success",
          title: success,
          ...(undoLimit
            ? { body: `Undo: ${undoLimit}` }
            : {
                undo: {
                  durationMs: UNDO_TOAST_MS,
                  onUndo: () => {
                    boardCheckRef.current = {
                      prior: rejectionCountRef.current,
                      bed: 0,
                      success: "Acceptance undone. The referral is back with this ward.",
                    };
                    dispatch({
                      type: "UNDO_ACCEPT_IN_PRINCIPLE",
                      role: "ward",
                      now: nowRef.current,
                      movementId: acceptUndo.movementId,
                      actingUnitId: acceptUndo.unitId,
                    });
                    setBoardToken((token) => token + 1);
                  },
                },
              }),
        });
      }
    }
    priorRejectionCountRef.current = rejections.length;
    // `toast`, `routeRole` and `dispatch` are stable for the screen's life; the token drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejections, checkToken]);

  if (!unit) {
    return (
      <div className={styles.screen} data-testid="ward-unit-screen">
        <main id="main-content" className={styles.main}>
          <WardNotFoundBody
            title="Ward not found"
            testId="ward-unit-unresolved"
            list={{ href: "/mockups/ward-flow/wards", label: "All wards" }}
          >
            No ward matches this link. It never falls back to a different ward.
          </WardNotFoundBody>
        </main>
      </div>
    );
  }

  const site = siteByCode(unit.siteCode);
  const capacity = unitCapacity(unit, bedReleases);
  // The ruled four boxes — Ready · Pulled · Closed · Occupied — for every bed-state figure this
  // screen shows. `capacity.held` is NOT Closed (it still counts a live pull's empty bed), and
  // "Held" is reserved for a bed kept for a patient on leave.
  const states = bedStates(unit, admissions, bedReleases, leaveBeds);
  // The one occupancy figure (Occupied + Pulled, `ward-occupancy.ts`): the same percentage this
  // ward shows on Ward answer, the rail and Capacity.
  const occupancy = wardOccupancy([unit], admissions, bedReleases);
  // Visual-fix pass: the capacity board (`CapacityView` in `ward-management-modes.tsx`) was just
  // corrected to source Confirmed/Expected from `capacityBreakdown()` rather than `unitCapacity()`'s
  // raw, state-and-timing-blind `potential` count — this screen used to be the one place still
  // showing that raw count as "Potential", which is how the same unit could read "Potential 1" here
  // and "Confirmed 1, Expected 0" one screen over, for the exact same release. This screen now reads
  // the same breakdown so both screens describe the same beds the same way. `unitCapacity()` itself
  // is untouched — see its own doc comment on `potential` in `ward-derivations.ts`.
  const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
  // Owner ruling 2026-09-05: shown BESIDE the Ready figure, never subtracted from it. The
  // reducer's own helper, so this screen and the PULL_PATIENT refusal read one source.
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  // TypeScript's narrowing of `unit` above does not reach into the `submitDecline` /
  // `submitCapacity` closures defined further down (the same reason `shortlist-panel.tsx`'s
  // `handleRefer` closes over a plain `movementId` rather than re-checking `movement`), so this
  // plain string is what they close over instead.
  const wardUnitId = unit.id;

  // Task 5: this unit's own bed releases, still pending — `discharged` is terminal and drops off
  // this list (spec D10's "removes it from the pending list"), never rendered with dead controls.
  const pendingBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state !== "discharged",
  );

  // Task 5: this unit's beds held for people on approved leave, read from provider state.
  // Leave holds never count as available beds (spec D4). This screen can end a hold but has no
  // rendered recording control; that existing gap is tracked by the event-reachability test.
  const unitLeaveBeds = leaveBeds.filter((bed) => bed.unitId === unit.id);

  /**
   * The two beds-and-leave rows of the daily return (rows 4 and 5 of the panel below) each stamp
   * ONE record: the most recently created one.
   *
   * ⚠️ **`.at(-1)` and not a maximum of `confirmedAt`, deliberately — AND THE REASON FIRST WRITTEN
   * HERE WAS FALSE.** Corrected 2026-09-07 after an adversarial read.
   *
   * It said `Instant` is "minutes since midnight" and wraps at 24:00, so `Math.max` breaks across
   * midnight. **`ward-clock.ts:9-21` says the opposite as its own headline defect** — *"IT IS NOT A
   * TIME OF DAY, and reading it as one is the defect this comment exists to stop… 2082 is 10:42 the
   * NEXT morning."* `wallClockNow()` wraps; `Instant` does not, and differences across any number of
   * days are plain subtraction. So the original rationale restated the precise misconception that
   * file was written to kill, while reaching the right conclusion — which is how a wrong reason
   * survives: nobody argues with a conclusion they agree with.
   *
   * **The real reason, verified in the code rather than reasoned about.** `now` is anchored by
   * `anchorOffsetMinutes = wallClockNow() - NOW_ANCHOR` (`ward-flow-provider.tsx:193`) against
   * `NOW_ANCHOR = 642` (10:42). Open the app at 09:00 and `now` starts near 540 — **below** the
   * seeded `confirmedAt` values of 632, 617, 582. A release flagged at runtime is stamped
   * `confirmedAt: event.now` (`ward-flow-reducer.ts:2284`), so it gets a SMALLER instant than a
   * seeded one, and `Math.max` would name the seeded record while the sentence beside it says
   * "most recently". Reachable any morning before 10:42.
   *
   * Creation order sidesteps it entirely and needs no clock arithmetic: the reducer appends
   * (`[...state.bedReleases, release]`, `[...state.leaveBeds, created]`), updates map in place, and
   * nothing sorts, reverses, unshifts or splices either array — `END_LEAVE_BED` filters, which
   * preserves order. That is a weaker claim than "the newest confirmation", and it is the one the
   * wording beside it makes.
   *
   * ⚠️ **No test covers WHICH record the stamp names**, because no seeded unit has two releases or
   * two leave beds — so `.at(-1)` ≡ `.at(0)` ≡ `Math.max` on every unit the suite renders. Replacing
   * the stamp with `now` keeps all five tests green. Handed to Ward Lead; it needs a second seeded
   * release on one unit, which is a fixture change and not this change's to make.
   */
  /**
   * 🔴 **ROW 4 COUNTS WHAT THE BED FIGURES BELOW IT COUNT, AND THE FIRST VERSION DID NOT.**
   * Corrected 2026-09-07, before anyone read it.
   *
   * Row 4 originally showed `pendingBedReleases.length` — every non-discharged release. The
   * Expected/Confirmed chips further down the same screen come from `capacityBreakdown()`, which
   * SKIPS any release whose `releaseBand()` is `"beyond-today"` (`daysAhead >= 2`). Two
   * independent derivations of one population, on one screen.
   *
   * ⚠️ **STATED PRECISELY, BECAUSE THE FIRST VERSION OF THIS COMMENT OVERSTATED IT.** It claimed a
   * ward could flag a bed for the day after tomorrow and see the two numbers disagree. It cannot.
   * **Task F1 (owner answer 32) changed WHY, and this paragraph is corrected to say so rather than
   * quietly keep a reason that no longer held.** The form's input used to be `type="time"` alone,
   * so the old `parseTimeInputToInstant` returned a bare 0–1439 and `dayOf()` of the result always
   * matched `dayOf(now)` — no day-gap was even expressible. The form now also offers the Today/
   * Tomorrow chooser (`release-day.ts`), so `dayOf(release.expectedAt) - dayOf(now)` can genuinely
   * be 0 or 1 the moment a release is created — `releaseBand`'s `"tomorrow"` case exists for
   * exactly that gap, and it is still not `"beyond-today"`. The `"beyond-today"` gap (2 or more)
   * stays unreachable through this control for a different reason now: it only ever produces a
   * gap of 0 or 1 AT CREATION, and `now` only moves forward from there, so the gap measured on any
   * later render can only be smaller, never larger. And no seeded release is beyond today either —
   * measured across all 23 units with the old code, which counted beyond-today releases while the
   * chips did not: **zero mismatches**, on floors showing 8 units carried a non-zero count. So the
   * divergence was and remains **unreachable**, and nothing a reader has seen was ever wrong.
   *
   * It is corrected anyway, because the two numbers agreed by ACCIDENT — the accident being that
   * one input element is time-only. A date input, a feed, or a second producer makes them
   * disagree with no test going red. The count is now taken FROM `breakdown` rather than
   * re-derived, so there is one arithmetic instead of a faithful copy of it — the rule
   * `capacityBreakdown` states about itself: "the one number a coordinator acts on must not drift
   * from the five-state bed grid's own arithmetic". The band-filtered list exists only so the
   * stamp names a release from the same population as the number above it.
   */
  const releasesCountedToday = pendingBedReleases.filter((release) => releaseBand(release, now) !== "beyond-today");

  // Task 5, spec D12: every REQUEST_CAPACITY_REFRESH raised against this unit, live from the
  // provider. `refreshRequests` only ever grows (the reducer never removes an entry), so the last
  // one in array order is always the most recent ask.
  const unitRefreshRequests = refreshRequests.filter((request) => request.unitId === unit.id);
  const latestRefreshRequest =
    unitRefreshRequests.length > 0 ? unitRefreshRequests[unitRefreshRequests.length - 1] : undefined;

  // Awaiting an answer: this unit holds a live referral and nothing has been decided yet.
  // A1-9 (audit round 2): longest wait first, as the Referrals board orders its queue.
  const incoming = movements
    .filter(
      (movement) =>
        isOpen(movement) && movement.stage === "destination_review" && movement.referredUnitIds.includes(unit.id),
    )
    .sort((left, right) => left.openedAt - right.openedAt);
  const activeAnswerIndex = Math.min(answerIndex, Math.max(incoming.length - 1, 0));
  const visibleIncoming =
    presentation === "answer" ? incoming.slice(activeAnswerIndex, activeAnswerIndex + 1) : incoming;
  // Accepted, pulled, or en route: this unit is the recorded destination, at any stage from
  // acceptance through transport. `isOpen` excludes `arrived` — once a patient arrives the record
  // closes and the bed shows as occupied in the grid above, not as a card here. Stopped transport
  // movements awaiting bed release are tracked separately in `heldAfterStop` so the held bed
  // remains visible on both Home and All arrivals without adding closed records back to `accepted`.
  const accepted = movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId === unit.id);
  const heldAfterStop = movements.filter(
    (movement) => isStoppedTransportAwaitingRelease(movement) && movement.acceptedUnitId === unit.id,
  );
  const recentAnswers = movements
    .flatMap((movement) => {
      const wardAnswers: Array<{
        key: string;
        movementId: string;
        outcome: "Accepted" | "Declined";
        at?: Instant;
        reason?: DeclineReason;
      }> = [];

      if (movement.acceptedUnitId === unit.id) {
        wardAnswers.push({
          key: `${movement.id}-accepted`,
          movementId: movement.id,
          outcome: "Accepted",
          at: movement.acceptedAt,
        });
      }

      movement.declines
        .filter((decline) => decline.unitId === unit.id)
        .forEach((decline, index) => {
          wardAnswers.push({
            key: `${movement.id}-declined-${index}`,
            movementId: movement.id,
            outcome: "Declined",
            at: decline.at,
            reason: decline.reason,
          });
        });

      return wardAnswers;
    })
    .sort((left, right) => (right.at ?? Number.NEGATIVE_INFINITY) - (left.at ?? Number.NEGATIVE_INFINITY));
  // What was withdrawn from this ward specifically, and why — `withdrawnReferrals` is per
  // movement, so this reads each movement's own array rather than assuming only one entry exists.
  const withdrawn = movements.filter((movement) =>
    movement.withdrawnReferrals.some((entry) => entry.unitId === unit.id),
  );
  const blockedReleases = pendingBedReleases.filter((release) => release.blocker !== null);

  const rollupConfirmation = morningRollupConfirmations?.[unit.id];
  const isRollupConfirmedToday = Boolean(rollupConfirmation && dayOf(rollupConfirmation.confirmedAt) === dayOf(now));
  const morningRollupDeadlineMinutes = configuration?.morningRollupDeadlineMinutes ?? 570;
  const morningRollupDeadlinePassed = minuteOfDay(now) >= morningRollupDeadlineMinutes;
  const rollupHour = Math.floor(morningRollupDeadlineMinutes / 60);
  const rollupMin = morningRollupDeadlineMinutes % 60;
  const morningRollupTimeLabel = `${String(rollupHour).padStart(2, "0")}:${String(rollupMin).padStart(2, "0")}`;

  function handleConfirmMorningRollup() {
    if (!unit) return;
    dispatch({
      type: "CONFIRM_MORNING_ROLLUP",
      role: "ward",
      now,
      unitId: unit.id,
      actingUnitId: unit.id,
      expectedDischarges: releasesCountedToday.length,
    });
    setToastMessage(
      `${morningRollupTimeLabel} Morning Bed Rollup confirmed: ${releasesCountedToday.length} discharges planned today.`,
    );
  }

  function handleAcknowledgeNotice(noticeId: string) {
    if (!unit) return;
    dispatch({
      type: "MARK_NOTICE_READ",
      role: "ward",
      now,
      noticeId,
      actingPlaceId: unit.id,
    });
  }

  function handleDismissBuzz(buzzIndex: number) {
    setDismissedBuzzes((current) => [...current, buzzIndex]);
  }

  const unreadAlertsCount = (() => {
    if (!unit) return 0;
    let count = 0;
    if (!isRollupConfirmedToday && morningRollupDeadlinePassed) count += 1;
    const activeBuzzes = (refreshRequests ?? []).filter(
      (r, idx) => r.unitId === unit.id && !dismissedBuzzes.includes(idx),
    );
    count += activeBuzzes.length;
    const overdueArrivals = movements.filter(
      (m) =>
        m.acceptedUnitId === unit.id &&
        m.arrivalDetails?.estimatedArrivalAt &&
        now > m.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES,
    );
    count += overdueArrivals.length;
    return count;
  })();
  const staffedSpecialling = (admissions ?? []).filter(
    (admission) => admission.unitId === unit.id && admission.state === "occupied" && admission.specialling,
  ).length;
  const overdueLeaveBeds = unitLeaveBeds.filter(
    (leaveBed) => now - leaveBed.confirmedAt >= LEAVE_BED_OPEN_WARNING_MINUTES,
  );
  const liveFormAlerts = [
    ...incoming.map((movement) => ({
      key: `incoming-${movement.id}`,
      tone: "warning" as const,
      title: "Referral awaiting this ward's answer",
      countdown: stageCopy[movement.stage].label,
      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
      text: `${resolvePatientIdentity(movement).displayName} from ${originPlaceLabel(movement.originEdId)}.`,
      actionLabel: "Answer",
      actionTarget: "answer" as const,
    })),
    ...accepted.flatMap((movement) => {
      const alerts: Array<{
        key: string;
        tone: "critical" | "warning" | "info";
        title: string;
        countdown: string;
        text: string;
        actionLabel: string;
        actionTarget: "arrival";
        movementId: string;
      }> = [];
      const patientName = resolvePatientIdentity(movement).displayName;
      const dueAt = movement.legalForm?.dueAt;
      if (dueAt !== undefined) {
        const remaining = minutesUntil(dueAt, now);
        alerts.push({
          key: `form-${movement.id}`,
          tone: remaining <= 60 ? "critical" : "warning",
          title: movement.legalForm ? `Form ${movement.legalForm.code} recorded due time` : "Legal form due",
          countdown: remaining < 0 ? "Due time has passed" : formatRemaining(remaining),
          // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
          text: `${patientName}: recorded due ${formatInstantWithDay(dueAt, now)}.`,
          actionLabel: "Open arrival",
          actionTarget: "arrival",
          movementId: movement.id,
        });
      }
      if (arrivalIsLate(movement, now) && movement.arrivalDetails?.estimatedArrivalAt !== undefined) {
        alerts.push({
          key: `late-${movement.id}`,
          tone: "warning",
          title: "Estimated arrival time has passed",
          countdown: "Still inbound",
          text: `${patientName} was expected at ${formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} and has not arrived.`,
          actionLabel: "Open arrival",
          actionTarget: "arrival",
          movementId: movement.id,
        });
      }
      return alerts;
    }),
    ...overdueLeaveBeds.map((leaveBed) => ({
      key: `leave-${leaveBed.id}`,
      tone: "info" as const,
      title: `Leave bed open more than ${LEAVE_BED_OPEN_WARNING_MINUTES / 60} hours (${OPERATIONAL_DEFAULT_LABEL})`,
      countdown: formatRemaining(now - leaveBed.confirmedAt),
      text: leaveBed.absentWithoutLeave
        ? `A bed held for an absence without leave at ${unit.name} is still recorded. Absent since ${formatInstantWithDay(leaveBed.absentWithoutLeave.since, now)}.`
        : `A bed on leave at ${unit.name} is still recorded. Expected return ${formatInstant(leaveBed.expectedReturn)}.`,
      actionLabel: "Open discharges",
      actionTarget: "discharges" as const,
    })),
  ];

  // Derive bed roster & telemetry for Bed Board matrix
  // D-21 items 4A & 6A: HDU left off; show real recorded bed designations from WARD_LOCKED_BED_SPLITS.
  const lockedBeds = unit.lockedBeds ?? WARD_LOCKED_BED_SPLITS[unit.id] ?? 0;
  const openBedsCount = Math.max(0, unit.beds - lockedBeds);
  const isMixed = lockedBeds > 0 && openBedsCount > 0;

  // Josh, 26 Sept 2026 ("go ahead with all your recommendations"): a bed reads "On Leave" only for
  // the admission this ward's OWN leave records actually name — never whichever occupied
  // admission happened to sit first by position. `leaveAdmissionIds` is that ward-scoped set
  // (`unitLeaveBeds` is already filtered to `unit.id` above), and `otherOccupants` is every
  // occupied admission EXCEPT those — so nobody with a leave record is ever also handed an
  // ordinary "occupied" bed slot elsewhere on the same board. The leave slots below are built
  // straight from `unitLeaveBeds` itself, one bed per record, so the number of "On Leave" beds can
  // never drift from the number of leave records — there is no separate count to keep in step.
  const leaveAdmissionIds = new Set(unitLeaveBeds.map((leaveBed) => leaveBed.admissionId));
  const unitOccupantAdmissions = admissions?.filter((a) => a.unitId === unit.id && a.state === "occupied") ?? [];
  const otherOccupants = unitOccupantAdmissions.filter((a) => !leaveAdmissionIds.has(a.id));
  const unitPulledAdmissions = admissions?.filter((a) => a.unitId === unit.id && a.state === "pulled") ?? [];
  let otherOccupantCursor = 0;
  // A4-24: a vacated bed reads "Being made ready" until someone taps Ready. Each marker belongs to
  // one discharged release, oldest first; the tile it sits on is chosen once bed numbers are known
  // (below), so Ready on a bed clears that bed's own release.
  const preparingReleases = bedReleases
    .filter((r) => r.unitId === unit.id && r.state === "discharged" && r.preparing)
    .sort((left, right) => left.confirmedAt - right.confirmedAt);

  const rawBeds = Array.from({ length: unit.beds }, (_, i) => {
    const bedNumber = i + 1;
    const designation: "Locked" | "Open" | undefined = isMixed ? (i < lockedBeds ? "Locked" : "Open") : undefined;
    const podId = isMixed ? (i < lockedBeds ? "locked" : "open") : "all";
    const podLabel = isMixed ? `${unit.name} ${designation} Beds` : unit.name;
    const isHdu = false;

    // v10 "counts agree": the tiles follow the ruled four bed states (`bedStates`), the same
    // partition the hero, the key and the bed figures count. Ready first, then each leave record,
    // then the pulled beds, the occupied beds, and the closed beds last.
    const leaveSlotIndex = i - states.ready;
    const isLeaveSlot = leaveSlotIndex >= 0 && leaveSlotIndex < unitLeaveBeds.length;
    const pulledSlotIndex = i - states.ready - unitLeaveBeds.length;
    const isIncomingSlot = !isLeaveSlot && pulledSlotIndex >= 0 && pulledSlotIndex < states.pulled;
    const isClosedSlot = i >= unit.beds - states.closed && !isLeaveSlot && !isIncomingSlot && i >= states.ready;

    let status: "ready" | "occupied" | "leave" | "incoming" | "closed" = "occupied";
    let statusText = "Inpatient";
    if (i < states.ready) {
      status = "ready";
      statusText = "Ready Vacant";
    } else if (isLeaveSlot) {
      status = "leave";
      // D-38: a bed held for an absence without leave is never shown as approved leave.
      statusText = unitLeaveBeds[leaveSlotIndex].absentWithoutLeave ? "Absent without leave" : "On Leave";
    } else if (isIncomingSlot) {
      status = "incoming";
      statusText = "Inbound";
    } else if (isClosedSlot) {
      status = "closed";
      statusText = "Closed";
    }

    const incomingMovement = isIncomingSlot ? accepted[pulledSlotIndex] : undefined;
    // A pulled bed with no live movement is a seeded pull: name the pulled admission itself.
    const pulledAdmission =
      isIncomingSlot && incomingMovement === undefined
        ? unitPulledAdmissions[pulledSlotIndex - accepted.length]
        : undefined;
    // The person shown "On Leave" is whoever THIS leave record names, found by its own
    // `admissionId` — never by position. (Should the named admission ever not be among this
    // ward's occupied admissions, the slot is correctly left empty rather than borrowing someone
    // else's identity.)
    const leaveAdmission = isLeaveSlot
      ? unitOccupantAdmissions.find((a) => a.id === unitLeaveBeds[leaveSlotIndex].admissionId)
      : undefined;
    // An incoming referral has not been admitted to this ward yet, so it has no admission of its
    // own here — never one borrowed from whichever occupied admission next came up by position.
    // That borrowing used to hand an inbound person somebody else's length-of-stay and
    // specialling flag; each bed now shows only the facts that belong to the person shown in it.
    const admission: (typeof unitOccupantAdmissions)[number] | undefined =
      status === "leave"
        ? leaveAdmission
        : status === "occupied"
          ? otherOccupants[otherOccupantCursor++]
          : status === "incoming"
            ? pulledAdmission
            : undefined;
    const linkedMovement =
      incomingMovement ??
      (admission
        ? movements.find(
            (m) =>
              (admission.movementId !== null && m.id === admission.movementId) ||
              (admission.referralId !== null && m.referralId === admission.referralId),
          )
        : undefined);
    const recordedSubject = linkedMovement ?? admission;
    const patientInfo =
      status === "ready" || status === "closed" || recordedSubject === undefined
        ? undefined
        : resolvePatientIdentity(recordedSubject);
    const patientAlias = status === "ready" || status === "closed" ? undefined : patientInfo?.displayName;
    const stayDays = admission && status !== "incoming" ? admissionStayDays(admission, now) : null;
    const daysInBed = stayDays === null ? undefined : `${stayDays}d`;
    const isSpecialling = admission?.specialling === true;

    const patientLegalStatus = linkedMovement?.legalStatus;
    const patientLegalForm = linkedMovement?.legalForm;
    const legalStatusLabel = patientLegalForm
      ? `Form ${patientLegalForm.code}${patientLegalStatus ? ` ${patientLegalStatus}` : ""}`
      : patientLegalStatus;

    const stayBandObj = admission && stayDays !== null ? stayBand(admission, now) : null;
    const isPastDate = admission ? isPastExpectedDischarge(admission, now) : false;
    const awayHours =
      admission?.awayAtEmergencyDepartmentSince != null
        ? Math.max(0, Math.floor((now - admission.awayAtEmergencyDepartmentSince) / 60))
        : null;
    const expDays =
      admission?.expectedDischargeAt != null && Number.isFinite(admission.expectedDischargeAt)
        ? dayOf(admission.expectedDischargeAt) - dayOf(now)
        : null;
    const tentDiag = admission?.tentativeDiagnosis
      ? (tentativeDiagnosisPhrase(admission.tentativeDiagnosis) ?? undefined)
      : undefined;
    const patientAge = patientInfo?.patient
      ? patientAgeYears(patientInfo.patient, dayZero ? calendarDateOf(now, dayZero) : new Date())
      : null;
    const patientSex = patientInfo?.patient?.sex ?? patientInfo?.genderOrSex ?? null;
    const patientHomeRegion = admission?.homeRegion ?? null;

    const releaseBlocker = bedReleases.find(
      (r) => r.admissionId === admission?.id && r.state !== "discharged",
    )?.blocker;

    const patient = patientInfo?.patient;
    const expectedDischargeLabel =
      admission?.expectedDischargeAt != null && Number.isFinite(admission.expectedDischargeAt)
        ? formatInstantWithDay(admission.expectedDischargeAt, now)
        : null;

    return {
      bedNumber,
      bedLabel: `Bed ${String(bedNumber).padStart(2, "0")}`,
      podId,
      podLabel,
      designation,
      isHdu,
      status,
      statusText,
      patientAlias,
      patientInfo,
      umrn: patientInfo?.umrn,
      daysInBed,
      stayDays,
      stayBand: stayBandObj?.label,
      pastDate: isPastDate,
      awayAtEdHours: awayHours,
      expectedDays: expDays,
      tentativeDiagnosis: tentDiag,
      blockReason: releaseBlocker ?? admission?.blockReason ?? undefined,
      dischargeBarrier: admission?.dischargeBarrier ?? undefined,
      isSpecialling,
      legalStatus: patientLegalStatus,
      legalForm: patientLegalForm,
      legalStatusLabel,
      admissionId: admission?.id,
      stayAdmissionId:
        admission?.id ??
        (incomingMovement ? unitPulledAdmissions.find((a) => a.movementId === incomingMovement.id)?.id : undefined),
      heldFor: undefined as string | undefined,
      preparing: false,
      /** The discharged release this bed is being made ready for, set once bed numbers are known. */
      preparingReleaseId: undefined as string | undefined,
      age: patientAge,
      sex: patientSex,
      homeRegion: patientHomeRegion,
      preferredName: patient?.preferredName,
      gender: patient?.gender,
      suburb: patient?.suburb,
      generalPractitioner: patient?.generalPractitioner,
      catchmentCommunityTeam: patient?.catchmentCommunityTeam,
      highAcuity: admission?.highAcuity === true,
      dischargeDateMoves: admission ? admission.dischargeDateMoves : null,
      dischargeConfirmed: admission ? admission.dischargeConfirmedAt != null : null,
      dischargeConfirmedBy: admission?.dischargeConfirmedBy ?? null,
      expectedDischargeLabel,
      // Audit A1-3: a pulled bed carries its hold, so a lapsed hold reaches the ward's Act now.
      bedHold: status === "incoming" ? bedHoldOf(linkedMovement?.pullExpiresAt, now) : undefined,
    };
  });

  // v10 pass 3, Bed board: a bed held for an accepted referral (`heldBedNumber`) and a stay placed
  // in a numbered bed (`PLACE_IN_BED`) sit in that bed; every other tile keeps its place.
  // Read from this ward's own inbox projection (FD-23), never the full referrals array.
  const inboxEntries = wardReferralInbox?.(unit.id) ?? [];
  const heldBeds = [
    ...inboxEntries.flatMap((entry) =>
      entry.state === "accepted" && entry.heldBedNumber !== undefined
        ? [
            {
              bed: entry.heldBedNumber,
              name: resolvePatientIdentity(entry).displayName,
            },
          ]
        : [],
    ),
    // v10 pass 3: a coordinator-sent person this ward accepted into a numbered bed.
    ...accepted.flatMap((movement) =>
      movement.heldBedNumber !== undefined && movement.stage !== "moving"
        ? [
            {
              bed: movement.heldBedNumber,
              name: resolvePatientIdentity(movement).displayName,
            },
          ]
        : [],
    ),
  ];
  const recordedBeds = new Map(
    (admissions ?? []).flatMap((admission) =>
      admission.unitId === unit.id && admission.bedNumber !== undefined ? [[admission.id, admission.bedNumber]] : [],
    ) as [string, number][],
  );
  // Audit A1-1: every stay keeps a fixed bed, so a departure or absence never renumbers others.
  const seatedBeds = seatStays(
    unit.beds,
    (admissions ?? []).filter((admission) => admission.unitId === unit.id),
    isMixed ? lockedBeds : 0,
  );
  const bedNumbers = layoutBedNumbers(
    rawBeds.map((bed) => ({
      stayAdmissionId: bed.stayAdmissionId,
      free: bed.status === "ready",
    })),
    (admissionId) => recordedBeds.get(admissionId),
    heldBeds.map((held) => held.bed),
    (admissionId) => seatedBeds.get(admissionId),
  );
  // A4-24: place each "Being made ready" marker on the bed its stay vacated when that bed is now a
  // ready tile, then any remaining markers on the lowest-numbered ready beds, oldest release first.
  // The tile then carries its own release, so Ready clears the bed the user opened.
  const readyBedNumbers = rawBeds.flatMap((bed, index) => (bed.status === "ready" ? [bedNumbers[index]] : []));
  const preparingByBed = new Map<number, string>();
  const unplacedReleases: string[] = [];
  for (const release of preparingReleases) {
    const vacated = recordedBeds.get(release.admissionId) ?? seatedBeds.get(release.admissionId);
    if (vacated !== undefined && readyBedNumbers.includes(vacated) && !preparingByBed.has(vacated)) {
      preparingByBed.set(vacated, release.id);
    } else {
      unplacedReleases.push(release.id);
    }
  }
  for (const bedNumber of [...readyBedNumbers].sort((left, right) => left - right)) {
    const releaseId = preparingByBed.has(bedNumber) ? undefined : unplacedReleases.shift();
    if (releaseId !== undefined) preparingByBed.set(bedNumber, releaseId);
  }
  const bedsList = rawBeds
    .map((bed, index) => {
      const bedNumber = bedNumbers[index];
      const preparingReleaseId = bed.status === "ready" ? preparingByBed.get(bedNumber) : undefined;
      const designation: "Locked" | "Open" | undefined = isMixed
        ? bedNumber <= lockedBeds
          ? "Locked"
          : "Open"
        : undefined;
      return {
        ...bed,
        bedNumber,
        bedLabel: `Bed ${String(bedNumber).padStart(2, "0")}`,
        designation,
        podId: isMixed ? (bedNumber <= lockedBeds ? "locked" : "open") : "all",
        podLabel: isMixed ? `${unit.name} ${designation} Beds` : unit.name,
        heldFor: bed.status === "ready" ? heldBeds.find((held) => held.bed === bedNumber)?.name : undefined,
        preparing: preparingReleaseId !== undefined,
        preparingReleaseId,
        statusText: preparingReleaseId !== undefined ? BED_STATE_LABELS.beingMadeReady : bed.statusText,
      };
    })
    .sort((left, right) => left.bedNumber - right.bedNumber);
  // A `?bed=` from a stale or edited URL that names no bed on this ward opens nothing; clearing it
  // here (a render-phase update, like the bed-param sync above) also drops it from the URL.
  if (selectedBed !== null && !bedsList.some((bed) => bed.bedNumber === selectedBed)) {
    setSelectedBed(null);
    setRefusedBedParam((count) => count + 1);
  }

  function fullWardReferralHref(patientId?: string): string {
    return `/mockups/ward-flow/referrals/new?category=ward${patientId ? `&patientId=${encodeURIComponent(patientId)}` : ""}&site=${encodeURIComponent(unit?.siteCode ?? "")}`;
  }

  function handleRaiseWardReferral(bedOverride?: unknown) {
    if (!unit || !raiseReferralGate.allowed) return;
    const targetBed =
      bedOverride && typeof bedOverride === "object" && "bedNumber" in bedOverride
        ? (bedOverride as (typeof bedsList)[number])
        : selectedBed !== null
          ? bedsList.find((b) => b.bedNumber === selectedBed)
          : undefined;
    const stayAdmission = targetBed?.admissionId ? admissions.find((a) => a.id === targetBed.admissionId) : undefined;
    const stayMovement = stayAdmission
      ? movements.find(
          (m) =>
            (stayAdmission.movementId !== null && m.id === stayAdmission.movementId) ||
            (stayAdmission.referralId !== null && m.referralId === stayAdmission.referralId),
        )
      : undefined;
    const patientRecord = targetBed?.patientInfo?.patient;
    const verifiedPatientId =
      patientRecord && patients.some((p) => p.id === patientRecord.id) ? patientRecord.id : undefined;

    const derivedSex: RecordedSex = (() => {
      if (stayMovement?.sex && (RECORDED_SEXES as readonly string[]).includes(stayMovement.sex)) {
        return stayMovement.sex;
      }
      if (patientRecord?.sex && (RECORDED_SEXES as readonly string[]).includes(patientRecord.sex)) {
        return patientRecord.sex as RecordedSex;
      }
      if (targetBed?.gender === "Female") return "Female";
      if (targetBed?.gender === "Male") return "Male";
      if (targetBed?.gender === "Non-binary" || targetBed?.gender === "Different term") return "Another term";
      return "Not recorded";
    })();

    const legalBasisText = stayMovement?.legalStatus ?? targetBed?.legalStatus ?? targetBed?.legalStatusLabel ?? "";
    const involuntaryBedNeeded =
      /involuntary|form 6a|form 1a|order/i.test(legalBasisText) && !/^voluntary/i.test(legalBasisText);
    const secureBedNeeded = Boolean(stayMovement ? stayMovement.security === "Secure" : false);
    const highAcuityNursingNeeded = Boolean(
      stayAdmission?.highAcuity || stayAdmission?.specialling || targetBed?.highAcuity || targetBed?.isSpecialling,
    );
    const derivedHomeRegion = stayMovement?.homeRegion ?? stayAdmission?.homeRegion ?? "Perth Metropolitan";
    const derivedSuburb =
      patientRecord?.suburb && referralSuburbIsKnown(patientRecord.suburb)
        ? ({ kind: "named", name: patientRecord.suburb } as const)
        : ({ kind: "unknown", reason: "not_known" } as const);

    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ...(verifiedPatientId ? { patientId: verifiedPatientId } : {}),
      ageBand: unit.cohort,
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: derivedSex,
          ...(targetBed?.gender ? { gender: targetBed.gender } : {}),
          secureBedNeeded,
          involuntaryBedNeeded,
          highAcuityNursingNeeded,
        },
      ],
      homeRegion: derivedHomeRegion,
      suburb: derivedSuburb,
      source: "psychiatric_ward",
      originUnitId: unit.id,
      urgency: 2,
      originSiteCode: unit.siteCode,
      transportNeeded: false,
      history: "",
    });
    const referralFormHref = fullWardReferralHref(verifiedPatientId);
    const raisedMessage = targetBed?.patientAlias
      ? `Ward referral raised for ${targetBed.patientAlias} (${unit.cohort}, ${derivedSex}).`
      : `Ward referral raised from ${unit.name}.`;
    setRaisedReferral({ href: referralFormHref, message: raisedMessage, bed: selectedBed });
    setToastMessage(raisedMessage);
  }

  // Bed board: the referrals waiting for this ward that it can place, straight from the inbox,
  // then (v10 pass 3) the people the coordinator referred here, placed with ACCEPT_IN_PRINCIPLE.
  const boardWaiting: WaitingReferral[] = [
    ...inboxEntries
      .filter((entry) => entry.state === "queued" && entry.withdrawnAt === undefined)
      .map((entry) => ({
        id: entry.id,
        name: resolvePatientIdentity(entry).displayName,
        umrn: resolvePatientIdentity(entry).umrn,
        sex: entry.destination.sex === "Female" ? "F" : entry.destination.sex === "Male" ? "M" : entry.destination.sex,
        waitedMinutes: Math.max(0, now - entry.raisedAt),
        secureBedNeeded: entry.destination.secureBedNeeded === true,
        blockedReason: wardTransferNeedsCoordinator(entry, unit.id, units)
          ? "Coordinator accepts transfers from another hospital"
          : undefined,
      })),
    ...incoming.map((movement) => ({
      kind: "movement" as const,
      id: movement.id,
      name: resolvePatientIdentity(movement).displayName,
      umrn: resolvePatientIdentity(movement).umrn,
      sex: movement.sex === "Female" ? "F" : movement.sex === "Male" ? "M" : "Not recorded",
      waitedMinutes: Math.max(0, now - (movement.referredAt ?? movement.openedAt)),
      secureBedNeeded: movement.security === "Secure",
    })),
  ];

  const boardUnitId = unit.id;

  function pickOnBoard(pick: BoardPick | null) {
    if (pick === null) {
      if (boardPick !== null) setBoardSay("Put down. Nothing changed.");
      setBoardPick(null);
      return;
    }
    setBoardPick(pick);
    setPlacedBed(null);
    setBoardSay(pickedUpSay(pick, fitCount(bedsList, pick, isMixed)));
  }

  /** The bed panel's "Move to another bed": picks the stay up on the board. */
  function moveStayOnBoard(bedNumber: number) {
    const bed = bedsList.find((item) => item.bedNumber === bedNumber);
    if (!bed) return;
    const stayId = bed.stayAdmissionId;
    if (!stayId) return;
    const fromBed = Number(bed.bedNumber);
    closeBedDrawer(false);
    setActiveTab("board");
    pickOnBoard({
      kind: "stay",
      admissionId: stayId,
      fromBed,
      name: bed.patientAlias ?? `the person in bed ${bedNumberLabel(fromBed)}`,
    });
  }

  /** A bed pressed on the board: place what is picked up, or open the bed when nothing is. */
  function pressBoardBed(bed: BedItem) {
    const bedNumber = Number(bed.bedNumber);
    if (boardPick === null) {
      setSelectedBed(bedNumber);
      return;
    }
    if (boardPick.kind === "stay" && boardPick.fromBed === bedNumber) {
      pickOnBoard(null);
      return;
    }
    if (!bedFits(bed, boardPick, isMixed)) {
      setBoardSay(`Bed ${bedNumberLabel(bedNumber)} does not fit, ${whyBedDoesNotFit(bed, boardPick, isMixed)}.`);
      return;
    }
    const pick = boardPick;
    setBoardPick(null);
    if (pick.kind === "stay") {
      boardCheckRef.current = {
        prior: rejections.length,
        bed: bedNumber,
        success: `Moved ${pick.name} from bed ${bedNumberLabel(pick.fromBed)} to bed ${bedNumberLabel(bedNumber)}.`,
        undo: {
          kind: "stay",
          admissionId: pick.admissionId,
          unitId: boardUnitId,
        },
      };
      dispatch({
        type: "PLACE_IN_BED",
        role: "ward",
        now,
        admissionId: pick.admissionId,
        bedNumber,
        actingUnitId: boardUnitId,
      });
    } else if (pick.kind === "movement") {
      // v10 pass 3: a coordinator-sent person, accepted in principle into this numbered bed.
      boardCheckRef.current = {
        prior: rejections.length,
        bed: bedNumber,
        success: `Placed ${pick.name} in bed ${bedNumberLabel(bedNumber)}. Accepted in principle.`,
        undo: {
          kind: "movement",
          movementId: pick.movementId,
          unitId: boardUnitId,
        },
      };
      dispatch({
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now,
        movementId: pick.movementId,
        unitId: boardUnitId,
        actingUnitId: boardUnitId,
        bedNumber,
      });
    } else {
      boardCheckRef.current = {
        prior: rejections.length,
        bed: bedNumber,
        success: `Placed ${pick.name} in bed ${bedNumberLabel(bedNumber)}. Referral accepted.`,
        undo: {
          kind: "referral",
          referralId: pick.referralId,
          unitId: boardUnitId,
        },
      };
      dispatch({
        type: "ACCEPT_REFERRAL",
        role: "ward",
        now,
        referralId: pick.referralId,
        destinationKind: "psychiatric_ward",
        unitId: boardUnitId,
        actingUnitId: boardUnitId,
        bedNumber,
      });
    }
    setBoardToken((token) => token + 1);
  }

  /**
   * OD-3's read side, ward-scoped. **`overridesAgainstUnit`, never `allOverrides`** — the register
   * is filtered where it is READ, so another ward's override is never in this screen's scope at
   * all, and no future column, debug panel or stylesheet here can reveal what never arrived.
   * `tests/ward-override-register-render.dom.test.tsx` pins that structurally, by scanning this
   * file: it is not a convention anyone has to remember.
   *
   * ⚠️ **AND `unitIds` IS NARROWED TO THIS WARD, which is a second scoping and a separate rule.**
   * One override can name several units at once — the shortlist panel's refer control is a
   * multi-select, so a coordinator can refer to three wards in one act and override the gate for
   * all three. The stored `unitIds` then lists every one of them, and rendering that list here
   * would tell this ward WHERE ELSE the patient was referred: `FD-23`, the owner's ruling of
   * 2026-08-31, and the exact leak `ward-screen-fd23-leaks.dom.test.tsx` already guards on the
   * referral cards a few sections up. `ward-referral-visibility.ts` states it as "the count is as
   * forbidden as the list", so the co-addressees cannot be replaced with a number either.
   *
   * This is a PROJECTION, the same shape as `wardScopedReferral()` — the narrowing happens here,
   * before anything is rendered, so the presentation component is never handed the other wards'
   * ids and could not show them if it tried. It is not a filter applied at render.
   */
  const overridesHere = overridesAgainstUnit(movements, unit.id).map((entry) => ({
    movement: entry.movement,
    override: {
      ...entry.override,
      unitIds: entry.override.unitIds.filter((id) => id === unit.id),
    },
  }));

  function toggleDecline(movementId: string) {
    setDeclineOpenFor((current) => (current === movementId ? undefined : movementId));
    setDeclineReason(undefined);
  }

  function submitDecline(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!declineReason) return;
    dispatch({
      type: "DECLINE",
      role: "ward",
      now,
      movementId,
      unitId: wardUnitId,
      actingUnitId: wardUnitId,
      reason: declineReason,
    });
    setDeclineOpenFor(undefined);
    setDeclineReason(undefined);
  }

  /**
   * Re-runs the refused action, this time carrying the reason. ⚠️ IT RE-DISPATCHES THE EVENT THE
   * WARD ORIGINALLY PRESSED, read back from the refusal itself rather than remembered separately —
   * so the thing that gets overridden is provably the thing that was refused. Holding the intended
   * event in its own state would let the two drift apart, and a mismatch there would override a
   * different action than the one on screen.
   */
  function handleAcceptInPrinciple(movementId: string, unitId: string) {
    const targetUnit = units.find((u) => u.id === unitId);
    if (!targetUnit) return;
    priorRejectionCountRef.current = rejections.length;
    acceptUndoRef.current = { movementId, unitId };
    dispatch({
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now,
      movementId,
      unitId,
      actingUnitId: unitId,
    });
    setCheckToken((token) => token + 1);
  }

  function handlePullPatient(movementId: string, unitId: string) {
    const targetUnit = units.find((u) => u.id === unitId);
    if (!targetUnit) return;
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "PULL_PATIENT",
      role: "ward",
      now,
      movementId,
      unitId,
      actingUnitId: unitId,
    });
    setCheckToken((t) => t + 1);
  }

  function submitOverride(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!overrideReason || !lastActionRejection) return;
    const attempted = lastActionRejection.attempted;
    if (attempted !== "ACCEPT_IN_PRINCIPLE" && attempted !== "PULL_PATIENT") return;
    // Item 10, owner answers 17 September 2026: the high-acuity staffing refusal needs the tick as
    // well as the reason, and matched on the refusal's own text rather than assumed from
    // `attempted` alone — a PULL_PATIENT can still be refused on specialling, one guard above, and
    // that refusal must never be gated on a tick it does not ask for. See
    // `overrideReasonForm`'s own doc comment.
    const isAcuityRefusal = lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL);
    if (isAcuityRefusal && !numConsulted) return;
    priorRejectionCountRef.current = rejections.length;
    // ⚠️ TWO LITERAL DISPATCHES RATHER THAN ONE COMPUTED `type: attempted`, AND THE GUARD IS WHY.
    // The computed form was what I wrote first, and `ward-override-surfaces.test.ts` refused it on
    // the spot: a computed type is invisible to every literal scan, so this surface would have
    // become unreadable to the very check that decides whether it can record a reason — the
    // allowlist entry could never have come off, because nothing could see the fix. Verbosity here
    // buys visibility to the static guards, which is the trade this file should always take.
    if (attempted === "ACCEPT_IN_PRINCIPLE") {
      dispatch({
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now,
        movementId,
        unitId: wardUnitId,
        actingUnitId: wardUnitId,
        overrideReason,
      });
    } else {
      dispatch({
        type: "PULL_PATIENT",
        role: "ward",
        now,
        movementId,
        unitId: wardUnitId,
        actingUnitId: wardUnitId,
        overrideReason,
        // Absent, never `false`, when this refusal is not the one the tick answers — see
        // `Override.numConsulted`'s own doc comment on that discipline.
        numConsulted: isAcuityRefusal && numConsulted ? true : undefined,
      });
    }
    setCheckToken((token) => token + 1);
    setOverrideReason(undefined);
    setNumConsulted(false);
  }

  /**
   * ⚠️ RENDERED ONLY WHEN THE ENGINE SAYS A REASON IS THE WAY THROUGH, matched on the fragment the
   * reducer exports rather than on a literal of our own — see `OVERRIDE_REASON_REQUIRED`. A refusal
   * nothing can override (no bed, no specialling staff, a stale bed count) shows the refusal and NO
   * control, which is the honest rendering: offering a reason box against a physical fact would
   * promise something no reason can buy.
   *
   * ⚠️ ITEM 10, OWNER ANSWERS 17 SEPTEMBER 2026: THE "NURSE UNIT MANAGER CONSULTED" TICK SHOWS
   * ONLY BESIDE THE HIGH-ACUITY STAFFING REFUSAL, matched on `HIGH_ACUITY_STAFFING_REFUSAL` — the
   * reducer's own fragment, the same discipline `OVERRIDE_REASON_REQUIRED` already uses one level
   * up — never on `attempted` alone. `attempted === "PULL_PATIENT"` is also true for the
   * specialling refusal one guard above in the reducer, which asks for a reason only; showing the
   * tick there would ask for a fact the engine never reads and can never satisfy.
   *
   * ⚠️ PLACEHOLDER COPY. THE OWNER HAS NOT CHOSEN THESE WORDS. Marked here in the pattern
   * `ward-change-reasons.ts` uses, because a chosen value and a provisional value look identical in
   * code and the difference is whether anybody can find out. The SHAPE is decided; the WORDS are a
   * stand-in. `Select a reason` is a UI convention rather than a clinical statement and is mine.
   */
  function overrideReasonForm(movementId: string) {
    if (!lastActionRejection) return null;
    if (lastActionRejection.movementId !== movementId) return null;
    if (!lastActionRejection.reason.includes(OVERRIDE_REASON_REQUIRED)) return null;
    const isAcuityRefusal = lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL);
    return (
      <form
        className={styles.declineForm}
        onSubmit={(event) => {
          submitOverride(event, movementId);
        }}
        data-testid={`ward-override-form-${movementId}`}
      >
        <fieldset className={styles.declineFieldset}>
          {/* PLACEHOLDER WORDING — owner has not chosen this. */}
          <legend className={styles.declineLegend}>Record why this is going ahead anyway</legend>
          {/* Radios, not a dropdown, and not my preference — it is the idiom this screen already
              uses for choosing a clinical reason (the decline form directly below). It also shows
              all five at once: a collapsed list hides the alternatives at the moment somebody is
              deciding between them, and none of these five is a default. */}
          {OVERRIDE_REASONS.map((reason) => (
            <label key={reason} className={styles.declineOption}>
              <input
                type="radio"
                name={`ward-override-${movementId}`}
                value={reason}
                checked={overrideReason === reason}
                onChange={() => {
                  setOverrideReason(reason);
                }}
                data-testid={`ward-override-option-${movementId}`}
              />
              {reason}
            </label>
          ))}
          {isAcuityRefusal ? (
            <label className={styles.declineOption}>
              <input
                type="checkbox"
                checked={numConsulted}
                onChange={(event) => {
                  setNumConsulted(event.target.checked);
                }}
                data-testid={`ward-override-num-consulted-${movementId}`}
              />
              Nurse unit manager consulted
            </label>
          ) : null}
          {/* Native `disabled` is correct here and is NOT the forbidden case: this is transient
              inertness while the form waits for validity, not a control unavailable for a stated
              reason. See the button-wiring convention. */}
          <button
            type="submit"
            className={styles.acceptButton}
            disabled={!overrideReason || (isAcuityRefusal && !numConsulted)}
            data-testid={`ward-override-submit-${movementId}`}
          >
            {/* PLACEHOLDER WORDING — owner has not chosen this. */}
            Record reason and continue
          </button>
        </fieldset>
      </form>
    );
  }

  function submitCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(capacityValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    // `actingUnitId` is this screen's own route parameter — the unit this screen is displaying and
    // acting as. It states which ward the caller says it is; it does not prove it, and the
    // reducer's comment on the matching check says the same. On this screen the two ids are equal
    // by construction (`unit` was resolved by matching the route id), so this guard is not what
    // stops *this* caller misusing the event — it is what stops any other call site writing to a
    // unit it did not claim to be acting as, and what puts that claim on the event where the
    // reducer can compare it.
    dispatch({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now,
      unitId: wardUnitId,
      actingUnitId: unitId,
      value: Math.floor(parsed),
      expectedRevision: capacityRevision,
    });
  }

  function handleConfirmBedsAndMorningRollup() {
    if (!unit) return;
    const parsed = Number(capacityValue);
    if (capacityValue.trim() === "" || !Number.isInteger(parsed) || parsed < 0 || parsed > unit.beds) {
      setToastMessage(`Enter a whole number from 0 to ${unit.beds} beds.`);
      return;
    }
    if (capacityRevision !== (unit.allocatable.revision ?? 0)) {
      setToastMessage("Capacity has changed. Refresh the current bed count before confirming.");
      return;
    }
    if (Number.isFinite(parsed) && parsed >= 0) {
      dispatch({
        type: "CONFIRM_CAPACITY",
        role: "ward",
        now,
        unitId: wardUnitId,
        actingUnitId: unitId,
        value: Math.floor(parsed),
        expectedRevision: capacityRevision,
      });
    }
    if (!isRollupConfirmedToday) {
      dispatch({
        type: "CONFIRM_MORNING_ROLLUP",
        role: "ward",
        now,
        unitId: unit.id,
        actingUnitId: unit.id,
        expectedDischarges: releasesCountedToday.length,
      });
    }
    setToastMessage(
      `Capacity & ${morningRollupTimeLabel} morning roll-up confirmed (${releasesCountedToday.length} discharges planned today).`,
    );
  }

  const capacityConfirmationForm = () => {
    return (
      <form className={styles.capacityForm} onSubmit={submitCapacity} data-testid="ward-capacity-form">
        <label className={styles.capacityLabel} htmlFor="ward-capacity-input">
          Confirm allocatable beds for {unit.name}
        </label>
        <div className={styles.capacityRow}>
          <input
            id="ward-capacity-input"
            data-testid="ward-capacity-input"
            type="number"
            min={0}
            max={unit.beds}
            value={capacityValue}
            onChange={(event) => {
              setCapacityValue(event.target.value);
            }}
            className={styles.capacityInput}
            style={{
              minHeight: "var(--ward-tap, 48px)",
              fontFamily: "var(--mono, monospace)",
              fontVariantNumeric: "tabular-nums",
            }}
          />
          <button
            type="submit"
            data-testid="ward-capacity-submit"
            className={styles.capacitySubmit}
            style={{
              minHeight: "var(--ward-tap, 48px)",
              minWidth: "var(--ward-tap, 48px)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Confirm capacity
          </button>
          {!isRollupConfirmedToday ? (
            <button
              type="button"
              data-testid="ward-confirm-beds-and-rollup-btn"
              className={buttonClass({ variant: "sec", size: "sm" })}
              onClick={() => {
                handleConfirmBedsAndMorningRollup();
              }}
            >
              Confirm beds &amp; morning roll-up ({morningRollupTimeLabel})
            </button>
          ) : null}
          <button
            type="button"
            data-testid="ward-capacity-review-discharges-btn"
            className={buttonClass({ variant: "ghost", size: "sm" })}
            onClick={() => {
              closeCapacityModal();
              openDischargesTab();
            }}
          >
            Review today&apos;s expected discharges → ({releasesCountedToday.length})
          </button>
        </div>
        <p className={styles.capacityConfirmed} style={{ fontVariantNumeric: "tabular-nums" }}>
          {capacityRevision !== (unit.allocatable.revision ?? 0) && (
            <button
              type="button"
              onClick={() => {
                setCapacityValue(String(unit.allocatable.value));
                setCapacityRevision(unit.allocatable.revision ?? 0);
              }}
            >
              Start a new capacity observation from the current count
            </button>
          )}{" "}
          Currently confirmed {unit.allocatable.value} at {formatInstant(unit.allocatable.confirmedAt)}. Writes to{" "}
          {unit.name} only &mdash; never any other ward.
        </p>
      </form>
    );
  };

  // Task 5 (spec D10): the ward moving its OWN bed release through its own lifecycle —
  // `actingUnitId` is this screen's own route parameter, exactly like `submitCapacity` above.
  // `expected -> confirmed` is the only transition
  // CONFIRM_BED_RELEASE accepts; this is only ever rendered on a expected row (see the
  // legal-transition gating in the render below), so the reducer is never asked for a transition
  // the row does not itself offer.
  function confirmBedRelease(releaseId: string) {
    dispatch({
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now,
      releaseId,
      actingUnitId: unitId,
    });
  }

  // Bed-model rework (2026-08-28): lifting the blocked flag. The stage is untouched — a confirmed
  // discharge that becomes unstuck is still confirmed.
  function clearBedReleaseBlock(releaseId: string) {
    dispatch({
      type: "CLEAR_BED_RELEASE_BLOCK",
      role: "ward",
      now,
      releaseId,
      actingUnitId: unitId,
    });
  }

  // Josh, 26 Sept 2026 (1A). RELEASE_BED can no longer be accepted while the person is in the bed,
  // and a departure completes the release in the same write, so "Discharged" records the named
  // person leaving (RECORD_LEAVING) with the destination the ward chose. The refusal, if any, is
  // read back from `rejections` on the next render and shown, never replaced by a success message.
  // Josh, 26 Sept 2026 ("go ahead with all recommendations"): a bed release is named by its person,
  // never by an internal id. No bed number is recorded for a release (the Beds tab places occupants
  // by position, which is layout, not a record), so the label says so. Leave-bed rows show "Bed not
  // recorded" and no name: the leave list promises to show nothing about the person on leave. Beds
  // freed by someone who has already left (turnaround cards, the ward log) show no name either:
  // cleaning a bed needs none, and those rows stay for the whole session (privacy review, 26 Sept).
  function bedRecordLabel(admissionId: string): string {
    const who = resolvePatientIdentity(admissions.find((admission) => admission.id === admissionId)).displayName;
    return `${who} (bed not recorded)`;
  }

  function handleDrawerRecordLeft(admissionId: string, who: string) {
    if (!drawerLeavingDestination) return;
    const resolved = resolvePatientIdentity(admissions.find((admission) => admission.id === admissionId));
    const destinationLabel = LEAVING_DESTINATIONS.find(
      (destination) => destination.id === drawerLeavingDestination,
    )?.label;
    dischargeCheckRef.current = {
      prior: rejections.length,
      success: `Recorded: ${who} has left the ward${destinationLabel ? ` (${destinationLabel.toLowerCase()})` : ""}.`,
      who,
      codes: resolved.patient ? [resolved.patient.id, admissionId] : [],
      undoAdmissionId: admissionId,
    };
    if (recordWardDeparture) recordWardDeparture(admissionId, unitId, drawerLeavingDestination);
    else
      dispatch({
        type: "RECORD_LEAVING",
        role: "ward",
        now,
        admissionId,
        actingUnitId: unitId,
        leavingDestination: drawerLeavingDestination,
      });
    setDischargeToken((token) => token + 1);
    closeBedDrawer();
  }

  // Task 5 addendum (binding spec's Data flow section: "Leave beds follow the same path with a
  // two-state life: recorded, then ended on return."): the second half of that life. Same
  // claim-not-proof discipline as every other control on this screen — `actingUnitId` is this
  // screen's own route parameter, and the reducer compares it against the leave bed's own
  // `unitId` before ending it.
  function endLeaveBed(leaveBedId: string) {
    dispatch({
      type: "END_LEAVE_BED",
      role: "ward",
      now,
      leaveBedId,
      actingUnitId: unitId,
    });
  }

  // L2 (site review, 12 Oct 2026): only the discharges the ward figures count for today, from the
  // same `releaseBand` window as `capacityBreakdown` (Confirmed, Expected, Discharges held up). A
  // release dated beyond today is not a decision for this shift, so it no longer inflates the
  // Decisions badge past the ward's own expected discharges.
  const departureDecisions = pendingBedReleases
    .filter((release) => releaseBand(release, now) !== "beyond-today")
    .filter((release) => release.state === "expected" || release.blocker !== null)
    .map((release) => ({
      id: release.id,
      title: bedRecordLabel(release.admissionId),
      badge: (release.blocker ? "Blocked" : "Ready") as "Blocked" | "Ready",
      onConfirm:
        release.state === "expected"
          ? () => {
              confirmBedRelease(release.id);
            }
          : undefined,
      onClear: release.blocker
        ? () => {
            clearBedReleaseBlock(release.id);
          }
        : undefined,
    }));
  const leaveDecisions = unitLeaveBeds.map((leaveBed) => ({
    id: leaveBed.id,
    title: leaveBed.absentWithoutLeave
      ? `Bed held · absent without leave since ${formatInstantWithDay(leaveBed.absentWithoutLeave.since, now)}`
      : `Bed on leave · back ${formatInstant(leaveBed.expectedReturn)}`,
  }));
  const intakeDecisions = visibleIncoming.map((movement) => ({
    id: movement.id,
    title: resolvePatientIdentity(movement).displayName,
    onAccept: () => {
      handleAcceptInPrinciple(movement.id, unit.id);
    },
  }));
  // The same count the Decisions cockpit heading and windows show.
  const decisionsDue = openDecisionCount({
    intakes: intakeDecisions,
    departures: departureDecisions,
    rollupOverdue: !isRollupConfirmedToday && morningRollupDeadlinePassed,
    rollupConfirmed: isRollupConfirmedToday,
    rollupActionable: true,
  });
  const decisionsDueLabel =
    decisionsDue > 0 ? `${decisionsDue} decisions due this shift` : "No decisions due this shift";

  function toggleRelease(movementId: string) {
    setReleaseOpenFor((current) => (current === movementId ? undefined : movementId));
    setReleaseReason(undefined);
  }

  function submitRelease(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!releaseReason) return;
    // `actingUnitId` is this screen's own route parameter, exactly like `submitCapacity` above —
    // it states which ward the caller says it is; it does not prove it.
    dispatch({
      type: "RELEASE_PULL",
      role: "ward",
      now,
      movementId,
      actingUnitId: unitId,
      reason: releaseReason,
    });
    setReleaseOpenFor(undefined);
    setReleaseReason(undefined);
  }

  function openArrival(movementId: string) {
    setActiveTab("coming");
    window.requestAnimationFrame(() => {
      document.getElementById(`ward-arrival-${movementId}`)?.scrollIntoView({ block: "nearest" });
    });
  }

  function openDischargesTab() {
    setActiveTab("out");
  }

  /** Shows Home and brings one of its cards into view. */
  function showHome(targetId: string) {
    setActiveTab("attn");
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "nearest", behavior: wardScrollBehavior() });
    });
  }

  // Audit A3-1: this ward's absences on an order, the same rows the shared task list raises.
  const absencesOnOrder = absentOnOrder({
    leaveBeds: unitLeaveBeds,
    admissions,
    movements,
    patients,
  });
  const actNowCount = wardActNowCount({
    absences: absencesOnOrder.length,
    alerts: liveFormAlerts.length,
    incoming: incoming.length,
    heldUp: blockedReleases.length,
    rollupOverdue: !isRollupConfirmedToday && morningRollupDeadlinePassed,
    lapsedHolds: bedsList.filter((bed) => bed.status === "incoming" && bed.bedHold?.state === "lapsed").length,
    stoppedHolds: heldAfterStop.length,
  });
  const readyByShiftEnd = releasesDueByShiftEnd(bedReleases, unit.id, now).length;
  const bedCountsStale = now - unit.allocatable.confirmedAt > unit.allocatable.staleAfterMinutes;
  // The ward switch lists the other wards on this site, or failing that in this health service.
  const siteUnits = units.filter((candidate) => candidate.id !== unit.id && candidate.siteCode === unit.siteCode);
  const switchUnits =
    siteUnits.length > 0
      ? siteUnits
      : units.filter(
          (candidate) =>
            candidate.id !== unit.id &&
            unitHealthService(candidate) !== undefined &&
            unitHealthService(candidate) === unitHealthService(unit),
        );

  const wardSwitchMenu =
    switchUnits.length > 0 ? (
      <Menu
        label="Switch ward"
        align="start"
        items={switchUnits.map((candidate) => ({
          id: candidate.id,
          label: candidate.name,
          meta: candidate.siteCode,
          onSelect: () => {
            const href = unitHref(candidate.id);
            if (router) router.push(href);
            else window.location.assign(href);
          },
        }))}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            className={styles.wardSwitch}
            aria-label={`Switch ward, now ${unit.name}`}
            data-testid="ward-switch-btn"
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        )}
      />
    ) : null;
  const wardRibbon = (
    <WardTelemetryRibbon
      unit={unit}
      capacity={{ available: states.ready, occupied: states.occupied }}
      staffedSpecialling={staffedSpecialling}
      now={now}
      filter={activeTab === "attn" ? bedFilter : undefined}
      onFilter={(next) => {
        setBedFilter(next);
        if (next === "shift-end") setFlowTab("discharges");
        showHome("bed-capacity");
      }}
      actNow={actNowCount}
      onActNow={() => {
        setShiftView("todo");
        if (isPhone) {
          setActiveTab("attn");
          setPhonePanel("shift");
          return;
        }
        showHome("ward-this-shift");
      }}
      phone={isPhone}
    />
  );
  const wardHeroFoot = (
    <span className={styles.heroFootStack}>
      <span className={styles.heroMeta}>
        <Clock size={14} aria-hidden="true" className={styles.heroMetaIcon} />
        <span>{shiftLine(now)}</span>
        {" · "}
        {unit.cohort} · {designationSummary(unit).toLowerCase()} ·{" "}
        <Link
          className={styles.heroBedListLink}
          href="#bed-capacity"
          data-testid="ward-hero-open-bed-list"
          onClick={(event) => {
            event.preventDefault();
            setBedFilter("all");
            showHome("bed-capacity");
          }}
        >
          {unit.beds} beds · {capacity.available} ready
        </Link>
        {" · "}
        {/* The staffed figure is the bed count; no roster is held, and the screen says so. */}
        <span>Roster not recorded</span> · {staffedSpecialling} on 1:1 specialling ·{" "}
        {unit.authorised ? "authorised for involuntary" : "not set up for involuntary admissions (demo)"}
        {(unit.intakeConstraints ?? []).length > 0
          ? ` · ${(unit.intakeConstraints ?? [])
              .map((constraint) => wardIntakeConstraintLabels[constraint] ?? constraint)
              .join(", ")}`
          : ""}
      </span>
      <CheckingFoot
        items={[
          {
            id: "stale",
            label: `Bed counts older than ${durMinutes(unit.allocatable.staleAfterMinutes)}`,
            value: bedCountsStale ? 1 : 0,
            tone: bedCountsStale ? "warning" : undefined,
          },
          {
            id: "held",
            label: "Discharges held up",
            value: blockedReleases.length,
            tone: blockedReleases.length > 0 ? "danger" : undefined,
          },
          {
            id: "past",
            label: "Past expected date",
            value: bedsList.filter((bed) => bed.pastDate).length,
          },
        ]}
        notChecked={["roster, no feed"]}
      />
    </span>
  );
  const wardHeroFootAside = (
    <span>
      {unit.allocatable.source === "ward" ? "Confirmed" : "Last figure"} {formatInstant(unit.allocatable.confirmedAt)} ·{" "}
      {durMinutes(Math.max(0, now - unit.allocatable.confirmedAt))} ago
    </span>
  );

  // Audit 11 Oct 2026: the phone chip row and the iPad portrait toolbar keep their main views and
  // put the less used actions in one More menu, so nothing clips at the edge.
  const handoverHref = wardHandoverHref(unit.id);
  const wardMoreMenu = (triggerClassName: string, tablet: boolean) => (
    <Menu
      label="More ward actions"
      align="end"
      items={[
        {
          id: "notices",
          label: "Notices",
          icon: Bell,
          meta: unreadAlertsCount > 0 ? String(unreadAlertsCount) : undefined,
          onSelect: () => {
            setNotificationCenterOpen(true);
          },
        },
        {
          id: "brief",
          label: "Shift brief",
          icon: FileText,
          onSelect: () => {
            setDailySheetOpen(true);
          },
        },
        {
          id: "handover",
          label: "Handover",
          icon: Printer,
          onSelect: () => {
            if (router) router.push(handoverHref);
            else window.location.assign(handoverHref);
          },
        },
        ...(tablet
          ? []
          : [
              {
                id: "referral",
                label: "Raise referral",
                icon: Send,
                disabled: !raiseReferralGate.allowed,
                meta: raiseReferralGate.allowed ? undefined : raiseReferralGate.reason,
                onSelect: handleRaiseWardReferral,
              },
            ]),
      ]}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={triggerClassName}
          data-testid={tablet ? "ward-tools-more" : "ward-phone-chip-more"}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
          More
        </button>
      )}
    />
  );

  const tabHome = (
    <li role="presentation">
      <button
        type="button"
        className={styles.tabBtn}
        role="tab"
        id="tabBtn-attn"
        aria-selected={activeTab !== "return" && activeTab !== "board"}
        aria-controls={
          activeTab === "coming"
            ? "tab-coming"
            : activeTab === "out"
              ? "tab-out"
              : activeTab === "beds"
                ? "tab-beds"
                : "tab-attn"
        }
        aria-label="Home (Worth Your Attention)"
        onClick={() => {
          setActiveTab("attn");
        }}
      >
        <span>Home</span>
      </button>
    </li>
  );
  const tabBoard = (
    <li role="presentation">
      <button
        type="button"
        className={styles.tabBtn}
        role="tab"
        id="tabBtn-board"
        aria-selected={activeTab === "board"}
        aria-controls="tab-attn"
        aria-label="Bed board (pick up and place)"
        data-testid="ward-tab-board"
        onClick={() => {
          setActiveTab("board");
        }}
      >
        <span>Bed board</span>
        {boardWaiting.length > 0 ? (
          <span className={styles.tabBadge} aria-label={`${boardWaiting.length} waiting to be placed`}>
            {boardWaiting.length}
          </span>
        ) : null}
      </button>
    </li>
  );
  const tabDecisions = (
    <li role="presentation">
      <button
        type="button"
        className={styles.tabBtn}
        role="tab"
        id="tabBtn-return"
        aria-selected={activeTab === "return"}
        aria-controls="tab-return"
        aria-label="Decisions (Ward record)"
        onClick={() => {
          setActiveTab("return");
        }}
      >
        <span>Decisions</span>
        <span className={styles.tabBadge} id="badgeReturn" title={decisionsDueLabel} aria-label={decisionsDueLabel}>
          {decisionsDue > 0 ? (isPhone ? decisionsDue : `${decisionsDue} Due`) : "Done"}
        </span>
      </button>
    </li>
  );

  return (
    <div
      className={styles.screen}
      data-testid="ward-unit-screen"
      data-presentation={presentation}
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="ward"
    >
      <main id="main-content" className={styles.main}>
        <h1 className={styles.screenName}>{presentation === "answer" ? "Ward answer" : "Ward"}</h1>

        {/* Item 44, build plan task F3, §3 "Ward": this page is about ONE named place (§2 "Never
         *  hidden", S4) and is never itself narrowed by the chosen service — this states how the
         *  choice relates to it rather than changing anything below. `ownService` unresolved (no
         *  real seeded unit today) renders nothing rather than a sentence naming an unknown. */}
        {service !== null && unitHealthService(unit) !== undefined ? (
          <p className={styles.placeholder} data-testid="ward-unit-service-sentence">
            {`This ward is one unit in ${unitHealthService(unit)}, so its own figures below do not change with the service.`}
          </p>
        ) : null}

        <WardReferralInbox unitId={unit.id} />
        <section className={styles.topActionBarWrap} aria-label="This ward" data-testid={`ward-unit-card-${unit.id}`}>
          <h2 className={styles.srOnlyHeading}>This ward</h2>
          <Hero
            className={styles.wardHero}
            eyebrow={
              isPhone
                ? `${site ? site.name.replace(/\s+(Public Hospital|Hospital|Health Campus|Health Service)$/u, "") : unit.siteCode}${unitHealthService(unit) ? ` · ${unitHealthService(unit)}` : ""}`
                : `Ward · ${site ? site.name : unit.siteCode}${unitHealthService(unit) ? ` · ${unitHealthService(unit)}` : ""}`
            }
            title={
              isPhone ? (
                <span className={styles.phoneHeroTitle}>
                  <span className={styles.phoneHeroName}>{unit.name}</span>
                  {wardSwitchMenu}
                </span>
              ) : (
                unit.name
              )
            }
            titleMeta={
              isPhone
                ? `${unit.beds} beds · ${states.occupied} occupied · ${unit.allocatable.source === "ward" ? "confirmed" : "last figure"} ${formatInstant(unit.allocatable.confirmedAt)}`
                : wardSwitchMenu
            }
            aside={
              <>
                <LiveChip state={online ? "live" : "offline"} onHero age={formatInstant(now)} />
                <button
                  ref={confirmTriggerRef}
                  type="button"
                  className={buttonClass({ variant: "light", size: "sm" })}
                  onClick={() => {
                    openCapacityModal();
                  }}
                >
                  Confirm numbers
                </button>
              </>
            }
            stats={isPhone ? wardRibbon : undefined}
            bar={isPhone ? undefined : wardRibbon}
            foot={isPhone ? undefined : wardHeroFoot}
            footAside={isPhone ? undefined : wardHeroFootAside}
          />

          {isPhone ? (
            <>
              <ScrollRow className={styles.phoneChips} role="toolbar" aria-label="Ward actions">
                <button
                  type="button"
                  className={styles.phoneChip}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setActiveTab("attn");
                    setPhonePanel("shift");
                  }}
                  data-testid="ward-phone-chip-shift"
                >
                  <ListChecks size={16} aria-hidden="true" />
                  This shift
                  {phoneTodoCount !== undefined ? (
                    <span className={styles.phoneChipCount}>{phoneTodoCount}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={styles.phoneChip}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setActiveTab("attn");
                    setPhonePanel("flow");
                  }}
                  data-testid="ward-phone-chip-flow"
                >
                  <ArrowLeftRight size={16} aria-hidden="true" />
                  Ward flow
                </button>
                {wardMoreMenu(styles.phoneChip, false)}
              </ScrollRow>
              {raiseReferralGate.note}
              {wardRoleLockNote}
              {notificationCenterOpen ? (
                <div
                  ref={notificationCenterRef}
                  className={styles.phoneNotificationCenter}
                  data-testid="ward-notification-center-wrap"
                >
                  <WardNotificationCenter
                    unitId={unit.id}
                    unitName={unit.name}
                    now={now}
                    movements={movements}
                    notices={notices}
                    refreshRequests={refreshRequests}
                    morningRollupConfirmed={isRollupConfirmedToday}
                    morningRollupDeadlinePassed={morningRollupDeadlinePassed}
                    morningRollupDeadlineMinutes={morningRollupDeadlineMinutes}
                    onConfirmMorningRollup={handleConfirmMorningRollup}
                    onAcknowledgeNotice={handleAcknowledgeNotice}
                    onDismissBuzz={handleDismissBuzz}
                    onClose={() => {
                      setNotificationCenterOpen(false);
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : null}
          {isPhone ? null : (
            <nav className={styles.tabBarWrap} aria-label="Ward Operational Tabs">
              <ul className={styles.tabList} role="tablist" id="mainTabList" aria-label="Ward views">
                {isPhone ? (
                  <>
                    {tabHome}
                    {tabDecisions}
                    {tabBoard}
                  </>
                ) : (
                  <>
                    {tabHome}
                    {tabBoard}
                    {tabDecisions}
                  </>
                )}
              </ul>
              {isPhone ? null : (
                <div className={styles.tabTools} role="toolbar" aria-label="Ward actions">
                  <TextInput
                    type="search"
                    icon={Search}
                    boxClassName={styles.findBox}
                    aria-label="Find a bed or person on this ward"
                    placeholder="Find bed or person"
                    value={bedQuery}
                    onChange={(event) => {
                      setBedQuery(event.target.value);
                      if (activeTab !== "attn" && activeTab !== "board") setActiveTab("attn");
                    }}
                    onClear={() => {
                      setBedQuery("");
                    }}
                    data-testid="ward-find-input"
                  />
                  <div className={styles.notificationTriggerWrap}>
                    <button
                      ref={notificationTriggerRef}
                      type="button"
                      className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.toolSolo}`}
                      onClick={() => {
                        setNotificationCenterOpen((prev) => !prev);
                      }}
                      aria-expanded={notificationCenterOpen}
                      data-testid="ward-notifications-toggle-btn"
                      title="Buzzes, urgent tasks and notices"
                    >
                      <Bell size={16} aria-hidden="true" />
                      <span>Notices</span>
                      {unreadAlertsCount > 0 ? (
                        <span className={styles.notificationCountBadge} data-testid="ward-notification-count-badge">
                          {unreadAlertsCount}
                        </span>
                      ) : null}
                    </button>
                    {notificationCenterOpen ? (
                      <div
                        ref={notificationCenterRef}
                        className={styles.notificationCenterContainer}
                        data-testid="ward-notification-center-wrap"
                      >
                        <WardNotificationCenter
                          unitId={unit.id}
                          unitName={unit.name}
                          now={now}
                          movements={movements}
                          notices={notices}
                          refreshRequests={refreshRequests}
                          morningRollupConfirmed={isRollupConfirmedToday}
                          morningRollupDeadlinePassed={morningRollupDeadlinePassed}
                          morningRollupDeadlineMinutes={morningRollupDeadlineMinutes}
                          onConfirmMorningRollup={handleConfirmMorningRollup}
                          onAcknowledgeNotice={handleAcknowledgeNotice}
                          onDismissBuzz={handleDismissBuzz}
                          onClose={() => {
                            setNotificationCenterOpen(false);
                            setTimeout(() => {
                              notificationTriggerRef.current?.focus({
                                preventScroll: true,
                              });
                            }, 0);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.toolSolo}`}
                    onClick={() => {
                      setDailySheetOpen(true);
                    }}
                    title="Open this shift's brief."
                    data-testid="ward-open-daily-sheet-btn"
                  >
                    <FileText size={16} aria-hidden="true" />
                    Shift brief
                  </button>
                  <Link
                    className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.toolWide} ${styles.toolSolo}`}
                    href={handoverHref}
                  >
                    <Printer size={16} aria-hidden="true" />
                    Handover
                  </Link>
                  <span className={styles.toolMore}>
                    {wardMoreMenu(buttonClass({ variant: "ghost", size: "sm" }), true)}
                  </span>
                  <button
                    type="button"
                    className={buttonClass({ variant: "sec", size: "sm" })}
                    onClick={handleRaiseWardReferral}
                    title="Record a ward-to-ward referral with this ward as the sending ward."
                    {...raiseReferralGate.buttonProps}
                  >
                    <Send size={16} aria-hidden="true" />
                    Raise referral
                  </button>
                  <Link
                    className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.toolWide}`}
                    href={
                      (raisedReferral && raisedReferral.bed === selectedBed ? raisedReferral.href : null) ??
                      fullWardReferralHref(
                        selectedBed !== null
                          ? bedsList.find((b) => b.bedNumber === selectedBed)?.patientInfo?.patient?.id
                          : undefined,
                      )
                    }
                    data-testid="ward-open-full-referral-form-link"
                  >
                    Open full referral form…
                  </Link>
                  {raiseReferralGate.note}
                  {wardRoleLockNote}
                </div>
              )}
            </nav>
          )}
        </section>
        {isPhone ? (
          /* Phone (v10): the three views pin under the header as one segmented control, outside the
             ward card so they stay in place while the page scrolls. */
          <nav className={`${styles.tabBarWrap} ${styles.phoneTabBar}`} aria-label="Ward Operational Tabs">
            <ul className={styles.tabList} role="tablist" id="mainTabList" aria-label="Ward views">
              {tabHome}
              {tabDecisions}
              {tabBoard}
            </ul>
          </nav>
        ) : null}

        {/* ───────── TAB 1: WORTH YOUR ATTENTION ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-attn"
          role="tabpanel"
          aria-labelledby={activeTab === "board" ? "tabBtn-board" : "tabBtn-attn"}
          data-active={activeTab === "attn" || activeTab === "board"}
        >
          <WardHomeTab
            absencesOnOrder={absencesOnOrder}
            phonePanel={isPhone ? phonePanel : undefined}
            onPhonePanelChange={setPhonePanel}
            onTodoCount={setPhoneTodoCount}
            phoneShiftLabel={shiftLine(now)}
            phoneHeroFoot={
              isPhone ? (
                <>
                  {wardHeroFoot}
                  {wardHeroFootAside}
                </>
              ) : undefined
            }
            phoneFiguresSummary="Shift, roster, legal status and feeds"
            phoneFind={
              isPhone ? (
                <TextInput
                  type="search"
                  icon={Search}
                  boxClassName={styles.phoneFindBox}
                  aria-label="Find a bed or person on this ward"
                  placeholder="Find bed or person"
                  value={bedQuery}
                  onChange={(event) => {
                    setBedQuery(event.target.value);
                  }}
                  onClear={() => {
                    setBedQuery("");
                  }}
                  data-testid="ward-find-input"
                />
              ) : undefined
            }
            unit={unit}
            onAcceptInPrinciple={handleAcceptInPrinciple}
            units={units}
            capacity={capacity}
            accepted={accepted}
            heldAfterStop={heldAfterStop}
            incoming={incoming}
            withdrawn={withdrawn}
            overridesHere={overridesHere}
            now={now}
            presentation={presentation}
            activeAnswerIndex={activeAnswerIndex}
            setAnswerIndex={setAnswerIndex}
            visibleIncoming={visibleIncoming}
            declineOpenFor={declineOpenFor}
            toggleDecline={toggleDecline}
            declineReason={declineReason}
            setDeclineReason={setDeclineReason}
            submitDecline={submitDecline}
            priorRejectionCountRef={priorRejectionCountRef}
            rejections={rejections}
            dispatch={dispatch}
            setCheckToken={setCheckToken}
            recentAnswers={recentAnswers}
            breakdown={breakdown}
            capacityConfirmationForm={capacityConfirmationForm}
            pendingBedReleasesCount={pendingBedReleases.length}
            unitLeaveBedsCount={unitLeaveBeds.length}
            resolvePatientIdentity={resolvePatientIdentity}
            lastActionRejection={lastActionRejection}
            overrideReasonForm={overrideReasonForm}
            liveFormAlerts={liveFormAlerts}
            onOpenDecisions={() => {
              setActiveTab("return");
            }}
            morningRollupConfirmed={isRollupConfirmedToday}
            morningRollupTimeLabel={morningRollupTimeLabel}
            onConfirmMorningRollup={handleConfirmMorningRollup}
            onConfirmBedsAndMorningRollup={handleConfirmBedsAndMorningRollup}
            onOpenConfirmNumbers={() => {
              openCapacityModal();
            }}
            onOpenArrival={openArrival}
            onPullPatient={handlePullPatient}
            onOpenDischarges={openDischargesTab}
            bedsList={bedsList}
            onSelectBed={(bedNumber) => {
              setSelectedBed(bedNumber);
            }}
            bedFilter={bedFilter}
            onBedFilterChange={setBedFilter}
            bedQuery={bedQuery}
            flowTab={flowTab}
            onFlowTabChange={setFlowTab}
            shiftView={shiftView}
            onShiftViewChange={setShiftView}
            morningRollupOverdue={!isRollupConfirmedToday && morningRollupDeadlinePassed}
            onOpenArrivals={() => {
              setActiveTab("coming");
            }}
            onOpenBeds={() => {
              setActiveTab("beds");
            }}
            registerBedTrigger={(bedNumber, element) => {
              if (element) bedTriggerRefs.current.set(bedNumber, element);
              else bedTriggerRefs.current.delete(bedNumber);
            }}
            bedArea={
              activeTab === "board" ? (
                <WardBedBoard
                  unit={unit}
                  beds={bedsList}
                  isMixed={isMixed}
                  waiting={boardWaiting}
                  picked={boardPick}
                  onPick={pickOnBoard}
                  say={boardSay}
                  onBedPress={pressBoardBed}
                  placedBed={placedBed}
                  query={bedQuery}
                  onOpenList={() => {
                    setActiveTab("attn");
                  }}
                />
              ) : undefined
            }
            figures={
              <section aria-label="Ward figures, right now" className={styles.figuresFoot} data-ward-primitive="panel">
                <div className={styles.commandHeader} data-ward-primitive="panel-header">
                  <div className={styles.commandTitleGroup}>
                    <h2 className={styles.commandMainTitle}>
                      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="12" height="10" rx="1" />
                        <path d="M6 3v10M2 8h4" />
                      </svg>
                      <span>Ward figures, right now</span>
                    </h2>
                    <span className={styles.commandSubTitle}>Bed distribution · {unit.beds} Staffed Beds</span>
                  </div>
                  <div
                    className={styles.capacityFreshnessRow}
                    data-testid="ward-unit-capacity-freshness"
                    style={{ margin: 0 }}
                  >
                    <WardFreshness
                      confirmedAt={unit.allocatable.confirmedAt}
                      confirmedByRole={unit.allocatable.source === "ward" ? `NUM ${unit.name}` : undefined}
                      now={now}
                      derived={unit.allocatable.source !== "ward"}
                    />
                    {latestRefreshRequest ? (
                      <span className={styles.refreshRequestMark} data-testid="ward-refresh-request-mark">
                        Asked to refresh at {formatInstant(latestRefreshRequest.at)} by {latestRefreshRequest.byRole}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className={styles.capacitySection}>
                  <div className={styles.capacityTrackTitleRow}>
                    <span className={styles.capacityTrackLabel}>Capacity distribution</span>
                    <span className={styles.capacityTrackMeta}>
                      {states.ready} {BED_STATE_LABELS.ready} · {states.pulled} {BED_STATE_LABELS.pulled} ·{" "}
                      {states.closed} {BED_STATE_LABELS.closed} · {states.occupied} {BED_STATE_LABELS.occupied}
                    </span>
                  </div>

                  <div className={`${styles.bedGrid} ${styles.breakdownStatsGrid}`} data-testid="ward-unit-beds">
                    {/* The ruled four (`ward-bed-states.ts`). No Blocked box: out-of-service beds are
                        not recorded (owner ruling 2026-09-25) and are folded into Closed. */}
                    <span
                      className={`${styles.bedChip} ${styles.statBox}`}
                      data-ward-primitive="chip"
                      data-state="available"
                      title={BED_STATE_DETAILS.ready}
                    >
                      <span className={styles.statBoxLabel}>{BED_STATE_LABELS.ready}</span>{" "}
                      <strong className={styles.statBoxVal}>{states.ready}</strong>
                    </span>
                    <span
                      className={`${styles.bedChip} ${styles.statBox}`}
                      data-ward-primitive="chip"
                      data-state="pulled"
                      title={BED_STATE_DETAILS.pulled}
                    >
                      <span className={styles.statBoxLabel}>{BED_STATE_LABELS.pulled}</span>{" "}
                      <strong className={styles.statBoxVal}>{states.pulled}</strong>
                    </span>
                    <span
                      className={`${styles.bedChip} ${styles.statBox}`}
                      data-ward-primitive="chip"
                      data-state="closed"
                      title={BED_STATE_DETAILS.closed}
                    >
                      <span className={styles.statBoxLabel}>{BED_STATE_LABELS.closed}</span>{" "}
                      <strong className={styles.statBoxVal}>{states.closed}</strong>
                    </span>
                    <span
                      className={`${styles.bedChip} ${styles.statBox}`}
                      data-ward-primitive="chip"
                      data-state="occupied"
                      title={BED_STATE_DETAILS.occupied}
                    >
                      <span className={styles.statBoxLabel}>{BED_STATE_LABELS.occupied}</span>{" "}
                      <strong className={styles.statBoxVal}>{states.occupied}</strong>
                    </span>
                    <span
                      className={`${styles.bedChip} ${styles.statBox}`}
                      data-ward-primitive="chip"
                      data-state="confirmed"
                    >
                      <span className={styles.statBoxLabel}>Confirmed</span>{" "}
                      <strong className={styles.statBoxVal}>{breakdown.confirmedToday}</strong>
                    </span>
                    <span
                      className={`${styles.bedChip} ${styles.statBox}`}
                      data-ward-primitive="chip"
                      data-state="expected"
                    >
                      <span className={styles.statBoxLabel}>Expected</span>{" "}
                      <strong className={styles.statBoxVal}>{breakdown.expectedToday}</strong>
                    </span>
                    <span
                      className={`${styles.bedChip} ${styles.statBox}`}
                      data-ward-primitive="chip"
                      data-state="blocked-release"
                      data-testid="ward-unit-blocked-releases"
                    >
                      <span className={styles.statBoxLabel}>{BED_RELEASE_BLOCKED_FIGURE_LABEL}</span>{" "}
                      <strong className={styles.statBoxVal}>{blockedReleases.length}</strong>
                    </span>
                    <span
                      className={`${styles.bedChip} ${styles.statBox}`}
                      data-ward-primitive="chip"
                      data-state="leave"
                    >
                      <span className={styles.statBoxLabel}>On leave</span>{" "}
                      <strong className={styles.statBoxVal}>{breakdown.onLeave}</strong>
                    </span>
                  </div>

                  {pendingPreparation > 0 ? (
                    <div className={styles.pendingCleanBanner} data-testid="ward-unit-beds-pending">
                      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 5v3.5l2 1" />
                      </svg>
                      <span>
                        <strong>
                          {pendingPreparation} of the {capacity.available} ready{" "}
                          {capacity.available === 1 ? "bed" : "beds"} at {unit.name}{" "}
                          {pendingPreparation === 1 ? "is" : "are"} still being made ready.
                        </strong>{" "}
                        It is not offered until someone opens the bed and taps Ready.
                      </span>
                    </div>
                  ) : null}

                  <details className={styles.clinicalDisclosure}>
                    <summary>What these bed figures mean</summary>
                    <p className={styles.bedNote}>
                      Ready, pulled, closed and occupied total {unit.beds}. Closed means empty but not offered; pulled
                      means allocated to a patient who has not arrived yet. Beds being made ready are counted inside
                      Ready, and beds held for a patient on leave inside Occupied. Confirmed and expected count
                      discharges due by the end of tomorrow; held up counts every open discharge with a blocker, on any
                      day, as This shift and the Discharges tab do. They and leave are flow counts and are not added to
                      that total.
                    </p>
                  </details>
                </div>
              </section>
            }
          />
        </section>

        {/* ───────── TAB 5: TODAY'S DECISIONS & SHIFT COCKPIT ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-return"
          role="tabpanel"
          aria-labelledby="tabBtn-return"
          data-active={activeTab === "return"}
        >
          <WardDecisionsCockpit
            unit={unit}
            rollupOverdue={!isRollupConfirmedToday && morningRollupDeadlinePassed}
            rollupConfirmed={isRollupConfirmedToday}
            rollupTimeLabel={morningRollupTimeLabel}
            plannedDischarges={rollupConfirmation?.expectedDischarges ?? releasesCountedToday.length}
            onConfirmRollup={handleConfirmMorningRollup}
            staffingFact={`${unit.allocatable.value} allocatable`}
            intakes={intakeDecisions}
            departures={departureDecisions}
            leaves={leaveDecisions}
            projection={{
              freeNow: capacity.available,
              freeBy: capacity.available + readyByShiftEnd,
              byLabel: formatInstantWithDay(dayShiftEndInstant(now), now),
            }}
          />
          {/* U3: the page's prototype footer below carries this safety line; it is not repeated here. */}
        </section>

        {/* ───────── TAB 2: COMING IN ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-coming"
          role="tabpanel"
          aria-label="All arrivals"
          data-active={activeTab === "coming"}
        >
          <div className={styles.subViewBar} data-testid="ward-subview-bar-coming">
            <button
              type="button"
              className={buttonClass({ variant: "ghost", size: "sm" })}
              data-testid="ward-subview-back-btn"
              onClick={() => {
                setActiveTab("attn");
              }}
            >
              <ChevronLeft size={16} aria-hidden="true" />← Back to Ward overview
            </button>
            <span className={styles.statusPillBadge} data-testid="ward-subview-pill">
              Incoming arrivals
            </span>
            <h2 className={styles.subViewTitle}>All arrivals</h2>
            <button
              type="button"
              className={buttonClass({ variant: "sec", size: "sm" })}
              data-testid="ward-subview-open-board-btn"
              onClick={() => {
                setActiveTab("board");
              }}
            >
              Open visual Bed board →
            </button>
          </div>
          <WardArrivalsCorridor
            unit={unit}
            onPullPatient={handlePullPatient}
            accepted={accepted}
            heldAfterStop={heldAfterStop}
            now={now}
            resolvePatientIdentity={resolvePatientIdentity}
            releaseOpenFor={releaseOpenFor}
            toggleRelease={toggleRelease}
            releaseReason={releaseReason}
            setReleaseReason={setReleaseReason}
            submitRelease={submitRelease}
            lastActionRejection={lastActionRejection}
            dispatch={dispatch}
            setCheckToken={setCheckToken}
            priorRejectionCountRef={priorRejectionCountRef}
            rejections={rejections}
            overrideReasonForm={overrideReasonForm}
          />
        </section>

        {/* ───────── TAB 3: ON THE WAY OUT ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-out"
          role="tabpanel"
          aria-label="All discharges"
          data-active={activeTab === "out"}
        >
          <div className={styles.subViewBar} data-testid="ward-subview-bar-out">
            <button
              type="button"
              className={buttonClass({ variant: "ghost", size: "sm" })}
              data-testid="ward-subview-back-btn"
              onClick={() => {
                setActiveTab("attn");
              }}
            >
              <ChevronLeft size={16} aria-hidden="true" />← Back to Ward overview
            </button>
            <span className={styles.statusPillBadge} data-testid="ward-subview-pill">
              Discharges &amp; leave
            </span>
            <h2 className={styles.subViewTitle}>All discharges</h2>
            <button
              type="button"
              className={buttonClass({ variant: "sec", size: "sm" })}
              data-testid="ward-subview-open-board-btn"
              onClick={() => {
                setActiveTab("board");
              }}
            >
              Open visual Bed board →
            </button>
          </div>
          <WardDischargesMatrix
            unit={unit}
            releasesCountedToday={releasesCountedToday}
            unitLeaveBeds={unitLeaveBeds}
            blockedReleases={blockedReleases}
            now={now}
            confirmBedRelease={confirmBedRelease}
            clearBedReleaseBlock={clearBedReleaseBlock}
            endLeaveBed={endLeaveBed}
          />
        </section>

        {/* ───────── TAB 4: BED BOARD & ROSTER ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-beds"
          role="tabpanel"
          aria-label="Full bed list"
          data-active={activeTab === "beds"}
        >
          <div className={styles.subViewBar} data-testid="ward-subview-bar-beds">
            <button
              type="button"
              className={buttonClass({ variant: "ghost", size: "sm" })}
              data-testid="ward-subview-back-btn"
              onClick={() => {
                setActiveTab("attn");
              }}
            >
              <ChevronLeft size={16} aria-hidden="true" />← Back to Ward overview
            </button>
            <span className={styles.statusPillBadge} data-testid="ward-subview-pill">
              Bed matrix
            </span>
            <h2 className={styles.subViewTitle}>Full bed list</h2>
            <button
              type="button"
              className={buttonClass({ variant: "sec", size: "sm" })}
              data-testid="ward-subview-open-board-btn"
              onClick={() => {
                setActiveTab("board");
              }}
            >
              Open visual Bed board →
            </button>
          </div>
          <WardBedsMatrix
            unit={unit}
            bedsList={bedsList}
            selectedBed={selectedBed}
            setSelectedBed={setSelectedBed}
            selectedPod={selectedPod}
            setSelectedPod={setSelectedPod}
            isMixed={isMixed}
          />
        </section>

        {/* ───────── BED TELEMETRY & CLINICAL DOSSIER DRAWER ───────── */}
        {selectedBed !== null
          ? (() => {
              const selectedBedItem = bedsList.find((b) => b.bedNumber === selectedBed);
              return (
                <WardBedDossierDrawer
                  selectedBed={selectedBed}
                  bedItem={selectedBedItem}
                  unit={unit}
                  onClose={closeBedDrawer}
                  onPrevBed={() => {
                    const index = bedsList.findIndex((bed) => bed.bedNumber === selectedBed);
                    setSelectedBed(Number(bedsList[(index - 1 + bedsList.length) % bedsList.length].bedNumber));
                  }}
                  onNextBed={() => {
                    const index = bedsList.findIndex((bed) => bed.bedNumber === selectedBed);
                    setSelectedBed(Number(bedsList[(index + 1) % bedsList.length].bedNumber));
                  }}
                  drawerLeavingDestination={drawerLeavingDestination}
                  setDrawerLeavingDestination={setDrawerLeavingDestination}
                  onRecordLeft={(admissionId, who) => {
                    handleDrawerRecordLeft(admissionId, who);
                  }}
                  onUpdateBlocker={
                    !pathname || routeRole === "ward"
                      ? (admissionId, blocker) => {
                          const pendingRelease = pendingBedReleases.find((r) => r.admissionId === admissionId);
                          const stay = admissions?.find((a) => a.id === admissionId);
                          if (blocker === null) {
                            // A blocked release clears the stay's reason with it; otherwise the stay's own
                            // reason is cleared, so nothing is refused as a no-op.
                            if (pendingRelease && pendingRelease.blocker !== null) {
                              dispatch({
                                type: "CLEAR_BED_RELEASE_BLOCK",
                                role: "ward",
                                now,
                                releaseId: pendingRelease.id,
                                actingUnitId: unitId,
                              });
                            } else if (stay && stay.blockReason !== null) {
                              dispatch({
                                type: "CLEAR_STAY_DISCHARGE_BLOCKER",
                                role: "ward",
                                now,
                                admissionId,
                                actingUnitId: unitId,
                              });
                            }
                            setToastMessage("Discharge blocker cleared.");
                            return;
                          }
                          const validBlocker = blocker as BedReleaseBlocker;
                          // With a bed release the release event keeps the stay's reason in step; without
                          // one the stay records it directly.
                          if (pendingRelease) {
                            dispatch({
                              type: "BLOCK_BED_RELEASE",
                              role: "ward",
                              now,
                              releaseId: pendingRelease.id,
                              actingUnitId: unitId,
                              blocker: validBlocker,
                            });
                          } else {
                            dispatch({
                              type: "RECORD_STAY_DISCHARGE_BLOCKER",
                              role: "ward",
                              now,
                              admissionId,
                              actingUnitId: unitId,
                              blocker: validBlocker,
                            });
                          }
                          setToastMessage(`Discharge blocker recorded: ${blocker}`);
                        }
                      : undefined
                  }
                  onMarkAtEd={(bedNum) => {
                    if (!selectedBedItem?.admissionId) return;
                    // The engine refuses ED while the stay is on leave or absent, so say so here
                    // rather than report a change that did not happen.
                    const heldBed = leaveBeds.find((bed) => bed.admissionId === selectedBedItem.admissionId);
                    if (heldBed) {
                      setToastMessage(
                        `Not recorded: bed ${bedNum} patient is ${heldBed.absentWithoutLeave ? "absent without leave" : "on leave"}. Record their return first.`,
                      );
                      return;
                    }
                    dispatch({
                      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
                      role: "ward",
                      now,
                      admissionId: selectedBedItem.admissionId,
                      actingUnitId: unitId,
                    });
                    setToastMessage(`Bed ${bedNum} patient marked away at ED.`);
                  }}
                  onMarkBack={(bedNum) => {
                    if (selectedBedItem?.admissionId) {
                      dispatch({
                        type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
                        role: "ward",
                        now,
                        admissionId: selectedBedItem.admissionId,
                        actingUnitId: unitId,
                      });
                    }
                    setToastMessage(`Bed ${bedNum} patient marked returned to ward.`);
                  }}
                  onMarkReady={() => {
                    // A4-24: one tap clears the release this bed is being made ready for.
                    const releaseId = selectedBedItem?.preparingReleaseId;
                    if (!releaseId) return;
                    dispatch({
                      type: "SET_BED_PREPARATION",
                      role: "ward",
                      now,
                      releaseId,
                      actingUnitId: unitId,
                      preparing: false,
                    });
                    setToastMessage("Bed marked Ready. It is offered again.");
                  }}
                  bedDrawerRef={bedDrawerRef}
                  onKeyDown={handleBedDrawerKeyDown}
                  onMove={selectedBedItem?.stayAdmissionId ? () => moveStayOnBoard(selectedBed) : undefined}
                  onOpenBoard={() => {
                    closeBedDrawer(false);
                    setActiveTab("board");
                  }}
                  onRaiseReferral={
                    raiseReferralGate.allowed ? () => handleRaiseWardReferral(selectedBedItem) : undefined
                  }
                  fullReferralHref={fullWardReferralHref(selectedBedItem?.patientInfo?.patient?.id)}
                  roleLockNote={wardRoleLockNote}
                />
              );
            })()
          : null}

        {/* ─── Confirmation Modal (Confirm Capacity Figures) ───────────── */}
        {confirmNumbersOpen ? (
          <div
            className={`${styles.modalOverlay} ${styles.show}`}
            onClick={closeCapacityModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-capacity-title"
            aria-describedby="modal-capacity-desc"
          >
            <div
              ref={capacityModalRef}
              className={styles.modalBox}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onKeyDown={handleCapacityModalKeyDown}
            >
              <div className={styles.modalHead}>
                <h2 id="modal-capacity-title" className={styles.modalTitle}>
                  Confirm capacity figures — {unit.name}
                </h2>
                <button
                  type="button"
                  className={styles.drawerCloseBtn}
                  onClick={closeCapacityModal}
                  aria-label="Close capacity confirmation modal"
                  style={{
                    minHeight: "var(--ward-tap, 48px)",
                    minWidth: "var(--ward-tap, 48px)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  &times; Close
                </button>
              </div>
              <div className={styles.modalBody}>
                <p id="modal-capacity-desc" className={styles.blurb}>
                  Confirm or update the live operational figures for {unit.name}.
                </p>

                <div className={styles.unitCard}>
                  <div className={styles.unitCardHeader}>
                    <h3 className={styles.sectionHeading}>Bed roster &amp; census overview</h3>
                    <span
                      className={styles.statusPillBadge}
                      style={{
                        color: "var(--ink)",
                        borderColor: "var(--line-strong)",
                      }}
                    >
                      {unit.name}
                    </span>
                  </div>
                  <div className={styles.unitCardBody}>
                    <dl className={styles.unitFacts}>
                      <div>
                        <dt>Total Staffed Beds</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {unit.beds} {unit.beds === 1 ? "bed" : "beds"}
                        </dd>
                      </div>
                      <div>
                        <dt>Beds in use</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {occupancy.inUse} / {unit.beds} {unit.beds === 1 ? "bed" : "beds"} (
                          {formatWardOccupancy(occupancy)})
                        </dd>
                      </div>
                      <div>
                        <dt>Confirmed free</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {unit.allocatable.value} {unit.allocatable.value === 1 ? "bed" : "beds"}
                        </dd>
                      </div>
                      <div>
                        <dt>Ready Vacant</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {capacity.available} {capacity.available === 1 ? "bed" : "beds"}
                        </dd>
                      </div>
                      <div>
                        <dt>{BED_STATE_LABELS.pulled}, not arrived</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {states.pulled} {states.pulled === 1 ? "bed" : "beds"}
                        </dd>
                      </div>
                      <div>
                        <dt>{BED_STATE_LABELS.closed}, not offered</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {states.closed} {states.closed === 1 ? "bed" : "beds"}
                        </dd>
                      </div>
                      <div>
                        <dt>Unoccupied change</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {(() => {
                            const parsed = parseInt(capacityValue, 10);
                            if (isNaN(parsed)) return "Not recorded";
                            const delta = parsed - unit.allocatable.value;
                            const abs = Math.abs(delta);
                            const word = abs === 1 ? "bed" : "beds";
                            return delta > 0
                              ? `+${delta} ${word}`
                              : delta < 0
                                ? `${delta} ${word}`
                                : "0 beds (No change)";
                          })()}
                        </dd>
                      </div>
                      <div>
                        <dt>Physical Vacancy Delta</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {(() => {
                            const openVacant = Math.max(0, unit.beds - capacity.occupied - states.closed);
                            return `${openVacant} ${openVacant === 1 ? "bed" : "beds"} vacant${states.closed > 0 ? ` (${states.closed} closed)` : ""}`;
                          })()}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {capacityConfirmationForm()}
              </div>
              <div className={styles.modalFoot}>
                <button
                  type="button"
                  className={styles.btnActionSec}
                  onClick={closeCapacityModal}
                  style={{
                    minHeight: "var(--ward-tap, 48px)",
                    minWidth: "var(--ward-tap, 48px)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ─── Ward Daily Sheet Modal Overlay ───────────────────────────── */}
        {dailySheetOpen ? (
          <WardDailySheetDialog
            unit={unit}
            now={now}
            onClose={() => {
              setDailySheetOpen(false);
            }}
          />
        ) : null}

        {/* Action Toast (Owner Rule D4) */}
        <div className={`${styles.actionToast} ${toastMessage ? styles.show : ""}`} role="status" aria-live="polite">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
          {raisedReferral && raisedReferral.message === toastMessage ? (
            <Link
              href={raisedReferral.href}
              className={buttonClass({ variant: "ghost", size: "sm" })}
              data-testid="ward-toast-full-referral-link"
            >
              Open full referral form…
            </Link>
          ) : null}
        </div>
        <WardPrototypeFooter
          testId="ward-unit-governance"
          note={`Scoped to ${unit.name} · Bed decisions remain human-confirmed · Not a medical device`}
        />
      </main>
    </div>
  );
}
