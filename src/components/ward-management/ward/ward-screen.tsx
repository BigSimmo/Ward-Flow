"use client";

import { Bell, ChevronDown, Clock, FileText, MoreHorizontal, Printer, Send } from "lucide-react";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { useAddressTab } from "@/components/ward-management/ward-url-state";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { useOnlineStatus } from "@/components/ward-management/use-online-status";
import { absentOnOrder } from "@/components/ward-management/ward-absence-tasks";
import {
  LEAVING_DESTINATIONS,
  observationStaffOnWard,
  type LeavingDestination,
} from "@/components/ward-management/ward-admissions";
import {
  bedsPendingPreparation,
  capacityBreakdown,
  releaseBand,
} from "@/components/ward-management/ward-bed-availability";
import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { releasesDueByShiftEnd } from "@/components/ward-management/ward-board-time-features";
import {
  OVERRIDE_REASONS,
  type OverrideReason,
  type ReleasePullReason,
  wardIntakeConstraintLabels,
} from "@/components/ward-management/ward-change-reasons";
import {
  dayOf,
  formatInstant,
  formatInstantWithDay,
  type Instant,
  minuteOfDay,
} from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import {
  BED_RELEASES_HELD_UP_ANY_DATE_LABEL,
  deriveAfternoonDischarges,
  isOpen,
  isStoppedTransportAwaitingRelease,
  overridesAgainstUnit,
  unitCapacity,
} from "@/components/ward-management/ward-derivations";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import {
  focusWardArrival,
  newWardMovementRefusal,
  useWardCommandCompletion,
  wardCommandFailure,
  wardCommandRefusal,
  wardCommandUndoSeq,
  wardUndoBlocked,
  type WardDischargeCheck,
  type WardMovementCheck,
  wardCommandKey,
} from "./use-ward-command-completion";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { HIGH_ACUITY_STAFFING_REFUSAL, OVERRIDE_REASON_REQUIRED } from "@/components/ward-management/ward-flow-reducer";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { type DeclineReason, type Rejection } from "@/components/ward-management/ward-model";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { WARD_OFFLINE_SAVED_NOTE } from "@/components/ward-management/ward-offline-copy";
import { LEAVE_BED_OPEN_WARNING_MINUTES, UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import { wardTransferNeedsCoordinator } from "@/components/ward-management/ward-referrals";
import { setDeskRole, useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { roleLimitReason } from "@/components/ward-management/ward-role-permissions";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { plural } from "@/components/ward-management/ward-plural";
import { buttonClass, CheckingFoot, durMinutes, Menu, useIsPhone, useOptionalToast } from "@/components/wf";
import { useWardPageToast, WardPageActionToast } from "./ward-page-action-toast";
import styles from "./ward.module.css";
import { wardClearanceAlerts } from "./ward-clearance-alerts";
import { noticeIsForWardChrome } from "@/components/ward-management/ward-chrome-role";
import type { WaitingReferral } from "./ward-bed-board";
import {
  type BoardPick,
  boardBedFits,
  bedNumberLabel,
  fitCount,
  pickedUpSay,
  whyBedDoesNotFit,
} from "./ward-bed-board-logic";
import { buzzKeys, capacityRequestIsOpen, refreshRequestIsOpen } from "./ward-buzz-keys";
import type { BedItem } from "./ward-beds-matrix";
import { openDecisionCount } from "./ward-decision-count";
import {
  canSubmitDecline,
  canSubmitOverride,
  OVERRIDE_SUBMIT_UNAVAILABLE_REASON,
  type WardFlowTab,
  type WardShiftView,
  wardActNowCount,
} from "./ward-home-tab";
import { type WardBedFilter, WardTelemetryRibbon } from "./ward-telemetry-ribbon";
import { type OpenBedAsk, WardBedMoveReasonForm } from "./ward-bed-move-reason-form";
import { OPEN_BED_MOVE_REASON_REQUIRED } from "@/components/ward-management/ward-bed-move-reason";
import {
  arrivalIsLate,
  type BoardCheck,
  boardUndoEvent,
  CENSUS_BED_OPENER_TARGET,
  censusBedOpenerTarget,
  ownHistoryState,
  shiftLine,
  unavailablePatientIdentity,
  useOptionalRouter,
  useOptionalSearchParams,
  WARD_BED_DRAWER_ENTRY,
  wardHandoverHref,
} from "./ward-screen-helpers";
import { WardAnswerFromLink, WardDailySheetDialog, WardDischargeNotices, WardReferralInbox } from "./ward-screen-lazy";
import { moveBetweenWardTabs, WardScreenTopBar } from "./ward-screen-top-bar";
import { wardBedRoster, wardLiveFormAlerts } from "./ward-screen-derivations";
import { WardAcceptedReferralPlacement } from "./ward-accepted-referral-placement";
import { WardScreenHomeSection } from "./ward-screen-home-section";
import { WardScreenBedDrawer, WardScreenCapacityModal } from "./ward-screen-overlays";
import { WardScreenTabSections } from "./ward-screen-tab-sections";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";

type WardScreenProps = {
  departurePlanning?: boolean;
  unitId: string;
  presentation?: "overview" | "answer";
};

/**
 * One inpatient unit's scoped view, derived from the provider's live records. Unknown units
 * render an explicit empty state. Command feedback waits for that command's confirmed outcome;
 * counters and patient lists continue to come from authoritative state.
 */

type WardTab = "attn" | "board" | "coming" | "out" | "beds" | "return";
const WARD_TABS: readonly WardTab[] = ["attn", "board", "coming", "out", "beds", "return"];
const WARD_FLOW_TABS: readonly WardFlowTab[] = ["referrals", "admissions", "discharges"];
const WARD_SHIFT_VIEWS: readonly WardShiftView[] = ["todo", "log", "stay"];

export function WardScreen({ unitId, presentation = "overview", departurePlanning = false }: WardScreenProps) {
  if (presentation === "answer") {
    return <WardAnswerFromLink key={unitId} unitId={unitId} />;
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
function WardOverviewScreen({ unitId, presentation = "overview", departurePlanning = false }: WardScreenProps) {
  const canOpenHref = useCanOpenHref();
  const thresholds = useDueSoonThresholds();
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
    plannedAdmissions,
  } = useWardFlowSelect(
    "movements",
    "resolvePatientIdentity",
    "units",
    "bedReleases",
    "leaveBeds",
    "refreshRequests",
    "dispatch",
    "recordWardDeparture",
    "rejections",
    "admissions",
    "notices",
    "morningRollupConfirmations",
    "configuration",
    "dayZero",
    "wardReferralInbox",
    "patients",
    "plannedAdmissions",
  );
  const now = useWardFlowClock();
  // D-80: a site bed manager on its own ward's page confirms beds, moves releases and records
  // blockers in its own name. Every other ward action stays gated to the ward.
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole === "bed_manager" ? "bed_manager" : "ward");
  const completeCommand = useWardCommandCompletion();

  // Feature 11: Raise referral is the ward's own act (role access plan, 15 Oct 2026). The reducer
  // takes it from a ward only as source `psychiatric_ward` with this ward as the sender.
  const raiseReferralGate = useRoleGate()("RECEIVE_REFERRAL");
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  // Phone (v10): This shift and Ward flow sit behind a chip and open as bottom sheets.
  const tvViewsOn = useWardFeatureFlag("bed-meeting-tv");
  const barrierGate = useRoleGate()("SET_DISCHARGE_BARRIER");
  const criteriaLedOn = useWardFeatureFlag("top25-criteria-led-discharge");
  const criteriaGate = useRoleGate()("SET_DISCHARGE_CRITERIA");
  // Top 25 item 1: confirming a discharge offers its pharmacy, transport and cleaning notices.
  const [noticesForRelease, setNoticesForRelease] = useState<string | null>(null);
  const isPhone = useIsPhone();
  const [phonePanel, setPhonePanel] = useState<"shift" | "flow" | null>(null);
  // A sheet left open when the screen widens past the phone is closed, not reopened on return.
  const [panelWasPhone, setPanelWasPhone] = useState(isPhone);
  if (panelWasPhone !== isPhone) {
    setPanelWasPhone(isPhone);
    if (!isPhone) setPhonePanel(null);
  }
  const [phoneWalking, setPhoneWalking] = useState(false);
  const [dismissedBuzzes, setDismissedBuzzes] = useState<string[]>([]);
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
  // Audit CS3-01: the decline and release forms are checked against the board they opened on.
  useHoldOpenForm(declineOpenFor !== undefined, declineOpenFor && `movement:${declineOpenFor}`);
  useHoldOpenForm(releaseOpenFor !== undefined, releaseOpenFor && `movement:${releaseOpenFor}`);
  const dischargeCheckRef = useRef<WardDischargeCheck | null>(null);
  const [dischargeToken, setDischargeToken] = useState(0);
  const [answerIndex, setAnswerIndex] = useState(0);
  // H-0186: the chosen tab, flow list and shift view stay in the address, so a reload opens the same
  // view. `?tab=board` from other screens' links is the same key.
  const [activeTab, chooseActiveTab] = useAddressTab("tab", WARD_TABS, departurePlanning ? "return" : "attn");
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const setActiveTab = useCallback<Dispatch<SetStateAction<WardTab>>>(
    (next) => chooseActiveTab(typeof next === "function" ? next(activeTabRef.current) : next),
    [chooseActiveTab],
  );
  const [selectedPod, setSelectedPod] = useState<string>("all");
  // Ward Hub (9 Oct 2026): the hero pills, the Find box and the home panels share this state.
  const [, startTransition] = useTransition();
  const [bedFilter, setBedFilter] = useState<WardBedFilter>("all");
  const [bedQuery, setBedQuery] = useState("");
  const deferredBedQuery = useDeferredValue(bedQuery);
  const [flowTab, setFlowTab] = useAddressTab<WardFlowTab>("flow", WARD_FLOW_TABS, "referrals");
  const [shiftView, setShiftView] = useAddressTab<WardShiftView>("shift", WARD_SHIFT_VIEWS, "todo");
  const selectActiveTab = useCallback(
    (next: "attn" | "board" | "coming" | "out" | "beds" | "return") => {
      startTransition(() => {
        setActiveTab(next);
      });
    },
    [startTransition, setActiveTab],
  );
  const selectBedFilter = useCallback(
    (next: WardBedFilter) => {
      startTransition(() => {
        setBedFilter(next);
      });
    },
    [startTransition],
  );
  const selectFlowTab = useCallback(
    (next: WardFlowTab) => {
      startTransition(() => {
        setFlowTab(next);
      });
    },
    [startTransition, setFlowTab],
  );
  const selectShiftView = useCallback(
    (next: WardShiftView) => {
      startTransition(() => {
        setShiftView(next);
      });
    },
    [startTransition, setShiftView],
  );
  const router = useOptionalRouter();
  const searchParams = useOptionalSearchParams();
  // A link from another screen asks for the board with `?tab=board`, the same key as the tab's own
  // address state (H-0186). Followed when the request arrives, as before.
  const boardTabRequested = searchParams?.get("tab") === "board";
  useEffect(() => {
    if (boardTabRequested) setActiveTab("board");
  }, [boardTabRequested, setActiveTab]);
  const bedParam = searchParams?.get("bed");
  const parseBed = (value: string | null | undefined) =>
    value !== null && value !== undefined && /^\d+$/.test(value) ? Number.parseInt(value, 10) : null;
  const parsedBed = parseBed(bedParam);
  const [selectedBed, setSelectedBed] = useState<number | null>(() => {
    if (parsedBed !== null) return parsedBed;
    if (typeof window !== "undefined") {
      return parseBed(new URLSearchParams(window.location.search).get("bed"));
    }
    return null;
  });
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
  const [openBedAsk, setOpenBedAsk] = useState<OpenBedAsk | null>(null);
  const [placedBed, setPlacedBed] = useState<number | null>(null);
  // Each settled place or undo waits here for the effect below, so two in flight both get their answer.
  const boardChecksRef = useRef<(BoardCheck & { outcome?: WardCommandOutcome })[]>([]);
  const [boardToken, setBoardToken] = useState(0);
  const toast = useOptionalToast();
  const pathname = usePathname() ?? "";
  const raiseAsRouteRole = useWardRaise(routeRole);
  const setRole = useCallback(
    (nextRole: "ward") => {
      setDeskRole(nextRole, pathname);
    },
    [pathname],
  );
  const wardRoleLockNote =
    // A bed manager cannot switch desks, and each button it may not use says so itself.
    routeRole !== "ward" && routeRole !== "bed_manager" ? (
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
  const [toastMessage, setToastMessage] = useWardPageToast();
  // Walk-through WT-10: a refusal or a step that did not go through shows as a warning.
  const warnToast = (text: string) => setToastMessage({ warning: text });
  const bedTriggerRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const confirmTriggerRef = useRef<HTMLButtonElement | null>(null);
  const capacityModalRef = useRef<HTMLDivElement | null>(null);
  const bedDrawerRef = useRef<HTMLElement | null>(null);
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);

  function runBoardCommand(record: () => ReturnType<WardCommandDispatch>, check: BoardCheck, onAccepted?: () => void) {
    // Keyed by subject: a repeat on the same bed or Undo says it is still saving; another bed is not held up.
    return completeCommand(check.key ?? wardCommandKey("board", check.bed), record, (outcome) => {
      boardChecksRef.current.push({ ...check, outcome });
      if (!outcome || outcome.status === "accepted") onAccepted?.();
      setBoardToken((token) => token + 1);
    });
  }

  // Departure feedback follows its confirmed command.
  useEffect(() => {
    const check = dischargeCheckRef.current;
    if (dischargeToken === 0 || check === null) return;
    dischargeCheckRef.current = null;
    if (check.outcome?.isCurrent && !check.outcome.isCurrent()) return;
    const failure = wardCommandFailure(check.outcome);
    if (failure && check.outcome?.status !== "refused") {
      warnToast(failure);
      return;
    }
    const refused = wardCommandRefusal(check.outcome, rejections, check.prior);
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
      warnToast(`Not recorded: ${namedReason.replace(/\.$/u, "")}. Nothing was changed.`);
      return;
    }
    // Audit A1-12: "Has left" offers Undo like Move bed, through the same toast.
    // A1-18 (audit 13 Oct 2026): a departure recorded offline says it has not gone anywhere.
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const successText =
      offline && toast?.savesOnDevice?.() ? `${check.success} ${WARD_OFFLINE_SAVED_NOTE}` : check.success;
    const undoAdmissionId = check.undoAdmissionId;
    const recordSeq =
      undoAdmissionId === undefined ? undefined : wardCommandUndoSeq(check.outcome, "UNDO_DEPARTURE", undoAdmissionId);
    if (!toast || undoAdmissionId === undefined || (check.outcome && recordSeq === undefined)) {
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
                if (wardUndoBlocked(check.outcome, warnToast)) return false;
                return completeCommand(
                  wardCommandKey("undo-departure", undoAdmissionId),
                  () =>
                    dispatch({
                      type: "UNDO_DEPARTURE",
                      role: "ward",
                      now: nowRef.current,
                      admissionId: undoAdmissionId,
                      recordSeq,
                      actingUnitId: unitId,
                    }),
                  (outcome) => {
                    dischargeCheckRef.current = {
                      prior: rejectionCountRef.current,
                      success: `Undone. ${check.who} is back in their bed.`,
                      who: check.who,
                      codes: check.codes,
                      outcome,
                    };
                    setDischargeToken((token) => token + 1);
                  },
                );
              },
            },
          }),
    });
    // `toast`, `routeRole`, `dispatch` and `unitId` are stable for the screen's life; the token drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dischargeToken, rejections]);

  // Board feedback follows this command, including its Undo.
  useEffect(() => {
    if (boardToken === 0) return;
    for (const check of boardChecksRef.current.splice(0)) reportBoardCheck(check);
    function reportBoardCheck(check: BoardCheck & { outcome?: WardCommandOutcome }) {
      if (check.outcome?.isCurrent && !check.outcome.isCurrent()) return;
      const notRecorded =
        check.outcome !== undefined && check.outcome.status !== "accepted" && check.outcome.status !== "failed";
      const failure = wardCommandFailure(check.outcome);
      if (failure && !notRecorded) {
        setBoardSay(failure);
        warnToast(failure);
        return;
      }
      const refused = wardCommandRefusal(check.outcome, rejections, check.prior, true);
      if (refused) {
        const said = `Not recorded: ${refused.reason.replace(/\.$/, "")}. Nothing was changed.`;
        setBoardSay(said);
        if (check.ask && refused.reason.includes(OPEN_BED_MOVE_REASON_REQUIRED)) setOpenBedAsk(check.ask);
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
      // H-0246: every kind sends its record's sequence, so an older toast cannot undo a newer change.
      const recordSeq =
        undo.kind === "movement"
          ? wardCommandUndoSeq(check.outcome, "UNDO_ACCEPT_IN_PRINCIPLE", undo.movementId)
          : undo.kind === "stay"
            ? wardCommandUndoSeq(check.outcome, "UNDO_PLACE_IN_BED", undo.admissionId)
            : wardCommandUndoSeq(check.outcome, "UNDO_REFERRAL_DECISION", undo.referralId);
      const undoLimit =
        roleLimitReason(routeRole, boardUndoEvent(undo, nowRef.current).type) ??
        (check.outcome && undo.kind === "movement" && recordSeq === undefined
          ? "No Undo record is available for this step."
          : undefined);
      toast.push({
        tone: "success",
        title: check.success,
        ...(undoLimit
          ? { body: `Undo: ${undoLimit}` }
          : {
              undo: {
                durationMs: UNDO_TOAST_MS,
                onUndo: () => {
                  if (wardUndoBlocked(check.outcome, warnToast)) return false;
                  return runBoardCommand(
                    () => {
                      // Literal types, one per kind, so the override-surface guard reads each one.
                      const at = nowRef.current;
                      if (undo.kind === "stay")
                        return dispatch({
                          type: "UNDO_PLACE_IN_BED",
                          role: "ward",
                          now: at,
                          admissionId: undo.admissionId,
                          ...(recordSeq === undefined ? {} : { recordSeq }),
                          actingUnitId: undo.unitId,
                        });
                      else if (undo.kind === "movement")
                        return dispatch({
                          type: "UNDO_ACCEPT_IN_PRINCIPLE",
                          role: "ward",
                          now: at,
                          movementId: undo.movementId,
                          recordSeq,
                          actingUnitId: undo.unitId,
                        });
                      else
                        return dispatch({
                          type: "UNDO_REFERRAL_DECISION",
                          role: "ward",
                          now: at,
                          referralId: undo.referralId,
                          ...(recordSeq === undefined ? {} : { recordSeq }),
                          actingUnitId: undo.unitId,
                        });
                    },
                    {
                      prior: rejectionCountRef.current,
                      bed: check.bed,
                      key: wardCommandKey("undo-board", check.bed),
                      success: "Undone. The bed and the person are back where they were.",
                    },
                  );
                },
              },
            }),
      });
    }
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
  }, [setActiveTab]);

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
          // H-0367: a blocked sessionStorage throws; treat it as no marker and close normally.
          let target: string | null = null;
          try {
            target = window.sessionStorage.getItem(CENSUS_BED_OPENER_TARGET);
            window.sessionStorage.removeItem(CENSUS_BED_OPENER_TARGET);
          } catch {
            target = null;
          }
          const fromCensus = target !== null && target === censusBedOpenerTarget(unitId, selectedBed);
          if (fromCensus && router && returnToCensus) {
            router.back();
            return;
          }
          if (target !== null) {
            try {
              window.sessionStorage.removeItem("wardflow:census-bed-opener");
            } catch {
              // Already treated as no marker above.
            }
          }
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
    [selectedBed, router, unitId, activeTab, setSelectedBed],
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
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        // The Notices drawer and sheet are Sheets (Notices option A), so they close themselves.
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
  }, [selectedBed, boardPick, dailySheetOpen, confirmNumbersOpen, closeBedDrawer, closeCapacityModal]);

  // Focus moves to the first control whenever the drawer shows a bed, including a step to another bed.
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

  // The bed drawer joins the shared modal contract itself (`useWardModalFocus` in the dossier),
  // which owns Tab and Escape; this only keeps a stray Escape on the drawer closing it.
  function handleBedDrawerKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      if (event.defaultPrevented || hasOpenSheet() || notificationCenterOpen || confirmNumbersOpen || dailySheetOpen) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closeBedDrawer();
    }
  }

  const priorRejectionCountRef = useRef(rejections.length);
  const [lastActionRejection, setLastActionRejection] = useState<Rejection | undefined>(undefined);
  const [checkToken, setCheckToken] = useState(0);
  const movementCheckRef = useRef<WardMovementCheck | null>(null);
  function runMovementCommand(
    movementId: string,
    attempted: string,
    record: () => ReturnType<WardCommandDispatch>,
    undo?: { movementId: string; unitId: string },
  ) {
    const prior = rejections.length;
    completeCommand(`movement:${movementId}`, record, (outcome) => {
      movementCheckRef.current = { prior, movementId, attempted, outcome, undo };
      setCheckToken((token) => token + 1);
    });
  }
  useEffect(() => {
    const check = movementCheckRef.current;
    if (checkToken === 0) return;
    if (!check) {
      const own = newWardMovementRefusal(rejections, priorRejectionCountRef.current);
      priorRejectionCountRef.current = rejections.length;
      if (own) setLastActionRejection(own);
      return;
    }
    movementCheckRef.current = null;
    priorRejectionCountRef.current = rejections.length;
    if (check.outcome?.isCurrent && !check.outcome.isCurrent()) return;
    const failure = wardCommandFailure(check.outcome);
    if (failure && check.outcome?.status !== "refused") {
      warnToast(failure);
      return;
    }
    const refusal = wardCommandRefusal(check.outcome, rejections, check.prior);
    const refused: Rejection | undefined =
      check.outcome && refusal
        ? {
            id: check.outcome.commandId,
            at: nowRef.current,
            attempted: check.attempted,
            movementId: check.movementId,
            reason: refusal.reason,
          }
        : (refusal as Rejection | undefined);
    setLastActionRejection(refused);
    // Design audit DA-11 (main): a pull says it worked, and focus stays with the arrival it changed.
    // Audit CS3-16: the message names who the bed was pulled for.
    if (!refused && check.attempted === "PULL_PATIENT") {
      const who = resolvePatientIdentity(movements.find((movement) => movement.id === check.movementId)).displayName;
      toast?.push({ tone: "success", title: `Bed pulled for ${who}.` });
      focusWardArrival(check.movementId);
    }
    if (!refused && check.undo && toast) {
      const undo = check.undo;
      const recordSeq = wardCommandUndoSeq(check.outcome, "UNDO_ACCEPT_IN_PRINCIPLE", undo.movementId);
      const undoLimit =
        roleLimitReason(routeRole, "UNDO_ACCEPT_IN_PRINCIPLE") ??
        (check.outcome && recordSeq === undefined ? "No Undo record is available for this step." : undefined);
      toast.push({
        tone: "success",
        title: "Accepted in principle.",
        ...(undoLimit
          ? { body: `Undo: ${undoLimit}` }
          : {
              undo: {
                durationMs: UNDO_TOAST_MS,
                onUndo: () => {
                  if (wardUndoBlocked(check.outcome, warnToast)) return false;
                  return runBoardCommand(
                    () =>
                      dispatch({
                        type: "UNDO_ACCEPT_IN_PRINCIPLE",
                        role: "ward",
                        now: nowRef.current,
                        movementId: undo.movementId,
                        recordSeq,
                        actingUnitId: undo.unitId,
                      }),
                    {
                      prior: rejectionCountRef.current,
                      bed: 0,
                      key: wardCommandKey("undo-accept", undo.movementId),
                      success: "Acceptance undone. The referral is back with this ward.",
                    },
                  );
                },
              },
            }),
      });
    }
    // Read the committed local fallback only after this command's completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejections, checkToken]);

  const pendingBedReleases = useMemo(
    () => (!unit ? [] : bedReleases.filter((release) => release.unitId === unit.id && release.state !== "discharged")),
    [bedReleases, unit],
  );
  const unitLeaveBeds = useMemo(
    () => (!unit ? [] : leaveBeds.filter((bed) => bed.unitId === unit.id)),
    [leaveBeds, unit],
  );
  const incoming = useMemo(
    () =>
      !unit
        ? []
        : movements
            .filter(
              (movement) =>
                isOpen(movement) &&
                movement.stage === "destination_review" &&
                movement.referredUnitIds.includes(unit.id),
            )
            .sort((left, right) => left.openedAt - right.openedAt),
    [movements, unit],
  );
  const accepted = useMemo(
    () => (!unit ? [] : movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId === unit.id)),
    [movements, unit],
  );
  const heldAfterStop = useMemo(
    () =>
      !unit
        ? []
        : movements.filter(
            (movement) => isStoppedTransportAwaitingRelease(movement) && movement.acceptedUnitId === unit.id,
          ),
    [movements, unit],
  );
  const recentAnswers = useMemo(
    () =>
      !unit
        ? []
        : movements
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
            .sort((left, right) => (right.at ?? Number.NEGATIVE_INFINITY) - (left.at ?? Number.NEGATIVE_INFINITY)),
    [movements, unit],
  );
  const withdrawn = useMemo(
    () =>
      !unit
        ? []
        : movements.filter((movement) => movement.withdrawnReferrals.some((entry) => entry.unitId === unit.id)),
    [movements, unit],
  );

  if (!unit) {
    return (
      <div className={styles.screen} data-testid="ward-unit-screen">
        <main id="main-content" className={styles.main}>
          <WardNotFoundBody
            title="Ward not found"
            testId="ward-unit-unresolved"
            list={{ href: "/ward-flow/wards", label: "All wards" }}
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

  // Spec D12 and DEC-L5-04: this unit's latest capacity ask that the ward has not yet answered.
  const latestRefreshRequest = refreshRequests
    .filter((request) => request.unitId === unit.id && capacityRequestIsOpen(request, unit.allocatable))
    .at(-1);

  const activeAnswerIndex = Math.min(answerIndex, Math.max(incoming.length - 1, 0));
  const visibleIncoming =
    presentation === "answer" ? incoming.slice(activeAnswerIndex, activeAnswerIndex + 1) : incoming;
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
    completeCommand(
      "rollup",
      () =>
        raise("CONFIRM_MORNING_ROLLUP", {
          unitId: unit.id,
          actingUnitId: unit.id,
          expectedDischarges: releasesCountedToday.length,
        }),
      (outcome) =>
        setToastMessage(
          wardCommandFailure(outcome) ??
            `Morning bed numbers confirmed (due ${morningRollupTimeLabel}): ${plural(releasesCountedToday.length, "discharge", "discharges")} planned today.`,
        ),
    );
  }

  function handleAcknowledgeNotice(noticeId: string) {
    if (!unit) return;
    // A notice sent to the ward is the ward's to acknowledge; the reducer refuses anyone else's.
    if (routeRole === "bed_manager") {
      warnToast("The ward acknowledges its own notices.");
      return;
    }
    raise("MARK_NOTICE_READ", {
      noticeId,
      actingPlaceId: unit.id,
    });
  }

  function handleDismissBuzz(buzzKey: string) {
    setDismissedBuzzes((current) => (current.includes(buzzKey) ? current : [...current, buzzKey]));
  }

  // A notice sent to the ward is the ward's to acknowledge, so a bed manager is not shown one it
  // cannot clear (it would keep the badge lit until the ward reads it).
  const wardNotices = routeRole === "bed_manager" ? [] : notices;

  const unreadAlertsCount = (() => {
    if (!unit) return 0;
    let count = 0;
    if (!isRollupConfirmedToday && morningRollupDeadlinePassed) count += 1;
    const keys = buzzKeys(refreshRequests);
    const undismissed = refreshRequests.filter(
      (r, i) => r.unitId === unit.id && !dismissedBuzzes.includes(keys[i] ?? ""),
    );
    count += undismissed.filter((r) => refreshRequestIsOpen(r, unit.allocatable)).length;
    const overdueArrivals = movements.filter((m) => m.acceptedUnitId === unit.id && arrivalIsLate(m, now));
    count += overdueArrivals.length;
    count += wardClearanceAlerts(movements, unit.id).count;
    // Notices option A (22 Oct 2026): unread coordinator notices count too, so the button matches the panel.
    count += wardNotices.filter((n) => noticeIsForWardChrome(n, "ward", unit.id, now) && n.readAt === undefined).length;
    return count;
  })();
  const staffedSpecialling = observationStaffOnWard(unit.id, admissions ?? []);
  const overdueLeaveBeds = unitLeaveBeds.filter(
    (leaveBed) => now - leaveBed.confirmedAt >= LEAVE_BED_OPEN_WARNING_MINUTES,
  );
  const { liveFormAlerts } = wardLiveFormAlerts({
    incoming,
    resolvePatientIdentity,
    accepted,
    now,
    thresholds,
    overdueLeaveBeds,
    unit,
  });

  const { bedsList, inboxEntries, isMixed } = wardBedRoster({
    unit,
    unitLeaveBeds,
    admissions,
    bedReleases,
    states,
    accepted,
    movements,
    resolvePatientIdentity,
    now,
    criteriaLedOn,
    patients,
    plannedAdmissions,
    dayZero,
    wardReferralInbox,
  });
  // A `?bed=` from a stale or edited URL that names no bed on this ward opens nothing; clearing it
  // here (a render-phase update, like the bed-param sync above) also drops it from the URL.
  if (selectedBed !== null && !bedsList.some((bed) => bed.bedNumber === selectedBed)) {
    setSelectedBed(null);
    setRefusedBedParam((count) => count + 1);
  }

  function fullWardReferralHref(patientId?: string): string {
    return `/ward-flow/referrals/new?category=ward${patientId ? `&patientId=${encodeRecordAddress(patientId)}` : ""}&site=${encodeURIComponent(unit?.siteCode ?? "")}`;
  }

  function handleRaiseWardReferral(bedOverride?: unknown) {
    if (!unit || !raiseReferralGate.allowed) return;
    const targetBed =
      bedOverride && typeof bedOverride === "object" && "bedNumber" in bedOverride
        ? (bedOverride as (typeof bedsList)[number])
        : selectedBed !== null
          ? bedsList.find((b) => b.bedNumber === selectedBed)
          : undefined;
    // Requirements and urgency need the referrer to confirm them in the full form.
    const patientId = targetBed?.patientInfo?.patient?.id;
    const href = fullWardReferralHref(patientId);
    if (router) router.push(href);
    else window.location.assign(href);
  }

  // Bed board: the referrals waiting for this ward that it can place, straight from the inbox,
  // then (v10 pass 3) the people the coordinator referred here, placed with ACCEPT_IN_PRINCIPLE.
  const boardWaiting: WaitingReferral[] = [
    ...inboxEntries
      .filter(
        (entry) =>
          (entry.state === "queued" || entry.state === "accepted") &&
          entry.withdrawnAt === undefined &&
          !movements.some((movement) => movement.referralId === entry.id) &&
          !admissions.some(
            (admission) =>
              admission.referralId === entry.id &&
              (admission.state === "pulled" || admission.state === "occupied" || admission.state === "departed"),
          ),
      )
      .map((entry) => ({
        id: entry.id,
        accepted: entry.state === "accepted",
        name: resolvePatientIdentity(entry).displayName,
        umrn: resolvePatientIdentity(entry).umrn,
        sex: entry.destination.sex === "Female" ? "F" : entry.destination.sex === "Male" ? "M" : entry.destination.sex,
        waitedMinutes: Math.max(0, now - entry.raisedAt),
        secureBedNeeded: entry.destination.secureBedNeeded === true,
        blockedReason:
          entry.state === "queued" && wardTransferNeedsCoordinator(entry, unit.id, units)
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
    setOpenBedAsk(null);
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

  /** A Bed board move; a refusal that asks for a reason opens the reason form (audit CS3-12). */
  function moveStay(move: OpenBedAsk, reason?: OverrideReason) {
    setOpenBedAsk(null);
    const check: BoardCheck = {
      prior: rejections.length,
      bed: move.bedNumber,
      success: `Moved ${move.name} from bed ${bedNumberLabel(move.fromBed)} to bed ${bedNumberLabel(move.bedNumber)}.`,
      undo: { kind: "stay", admissionId: move.admissionId, unitId: boardUnitId },
      ...(reason === undefined ? { ask: move } : {}),
    };
    runBoardCommand(
      () =>
        raise("PLACE_IN_BED", {
          admissionId: move.admissionId,
          bedNumber: move.bedNumber,
          actingUnitId: boardUnitId,
          ...(reason === undefined ? {} : { overrideReason: reason }),
        }),
      check,
    );
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
    if (!boardBedFits(bedsList, bed, boardPick, isMixed)) {
      setBoardSay(
        `Bed ${bedNumberLabel(bedNumber)} does not fit, ${whyBedDoesNotFit(bed, boardPick, isMixed, bedsList)}.`,
      );
      return;
    }
    const pick = boardPick;
    // Main (29215abf): the pick is released once sent, so another bed can be moved while this one
    // waits; its answer still arrives through the queued board check.
    setBoardPick(null);
    if (pick.kind === "stay") {
      moveStay({ admissionId: pick.admissionId, fromBed: pick.fromBed, bedNumber, name: pick.name });
    } else if (pick.kind === "movement") {
      // v10 pass 3: a coordinator-sent person, accepted in principle into this numbered bed.
      const check: BoardCheck = {
        prior: rejections.length,
        bed: bedNumber,
        success: `Placed ${pick.name} in bed ${bedNumberLabel(bedNumber)}. Accepted in principle.`,
        undo: {
          kind: "movement",
          movementId: pick.movementId,
          unitId: boardUnitId,
        },
      };
      runBoardCommand(
        () =>
          raise("ACCEPT_IN_PRINCIPLE", {
            movementId: pick.movementId,
            unitId: boardUnitId,
            actingUnitId: boardUnitId,
            bedNumber,
          }),
        check,
      );
    } else if (pick.accepted) {
      runBoardCommand(
        () =>
          raise("HOLD_REFERRAL_BED", {
            referralId: pick.referralId,
            unitId: boardUnitId,
            actingUnitId: boardUnitId,
            bedNumber,
          }),
        {
          prior: rejections.length,
          bed: bedNumber,
          success: `Pulled bed ${bedNumberLabel(bedNumber)} for ${pick.name}. Original acceptance kept.`,
        },
      );
    } else {
      const check: BoardCheck = {
        prior: rejections.length,
        bed: bedNumber,
        success: `Placed ${pick.name} in bed ${bedNumberLabel(bedNumber)}. Referral accepted.`,
        undo: {
          kind: "referral",
          referralId: pick.referralId,
          unitId: boardUnitId,
        },
      };
      runBoardCommand(
        () =>
          raise("ACCEPT_REFERRAL", {
            referralId: pick.referralId,
            destinationKind: "psychiatric_ward",
            unitId: boardUnitId,
            actingUnitId: boardUnitId,
            bedNumber,
          }),
        check,
      );
    }
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
    startTransition(() => {
      setDeclineOpenFor((current) => (current === movementId ? undefined : movementId));
      setDeclineReason(undefined);
    });
  }

  function submitDecline(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!canSubmitDecline(declineReason)) return;
    completeCommand(
      `movement:${movementId}`,
      () =>
        raise("DECLINE", {
          movementId,
          unitId: wardUnitId,
          actingUnitId: wardUnitId,
          reason: declineReason,
        }),
      (outcome) => {
        const failure = wardCommandFailure(outcome);
        if (failure) {
          warnToast(failure);
          return;
        }
        setDeclineOpenFor(undefined);
        setDeclineReason(undefined);
      },
    );
  }

  /**
   * Re-runs the refused action, this time carrying the reason. ⚠️ IT RE-DISPATCHES THE EVENT THE
   * WARD ORIGINALLY PRESSED, read back from the refusal itself rather than remembered separately —
   * so the thing that gets overridden is provably the thing that was refused. Holding the intended
   * event in its own state would let the two drift apart, and a mismatch there would override a
   * different action than the one on screen.
   */
  function handleAcceptInPrinciple(movementId: string, unitId: string) {
    if (!units.some((u) => u.id === unitId)) return;
    runMovementCommand(
      movementId,
      "ACCEPT_IN_PRINCIPLE",
      () =>
        raise("ACCEPT_IN_PRINCIPLE", {
          movementId,
          unitId,
          actingUnitId: unitId,
        }),
      { movementId, unitId },
    );
  }

  function handlePullPatient(movementId: string, unitId: string) {
    if (!units.some((u) => u.id === unitId)) return;
    runMovementCommand(movementId, "PULL_PATIENT", () =>
      raise("PULL_PATIENT", {
        movementId,
        unitId,
        actingUnitId: unitId,
      }),
    );
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
    if (!canSubmitOverride(overrideReason, isAcuityRefusal, numConsulted)) return;
    // Keep literal event names visible to the override-surface guards.
    runMovementCommand(
      movementId,
      attempted,
      () => {
        if (attempted === "ACCEPT_IN_PRINCIPLE") {
          return raise("ACCEPT_IN_PRINCIPLE", {
            movementId,
            unitId: wardUnitId,
            actingUnitId: wardUnitId,
            overrideReason,
          });
        }
        return raise("PULL_PATIENT", {
          movementId,
          unitId: wardUnitId,
          actingUnitId: wardUnitId,
          overrideReason,
          numConsulted: isAcuityRefusal && numConsulted ? true : undefined,
        });
      },
      attempted === "ACCEPT_IN_PRINCIPLE" ? { movementId, unitId: wardUnitId } : undefined,
    );
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
    const readyToSubmit = canSubmitOverride(overrideReason, isAcuityRefusal, numConsulted);
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
            disabled={!readyToSubmit}
            title={!readyToSubmit ? OVERRIDE_SUBMIT_UNAVAILABLE_REASON : undefined}
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
    raise("CONFIRM_CAPACITY", {
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
      warnToast(`Enter a whole number from 0 to ${unit.beds} beds.`);
      return;
    }
    if (capacityRevision !== (unit.allocatable.revision ?? 0)) {
      warnToast("Capacity has changed. Refresh the current bed count before confirming.");
      return;
    }
    completeCommand(
      "capacity-rollup",
      () =>
        raise("CONFIRM_CAPACITY", {
          unitId: wardUnitId,
          actingUnitId: unitId,
          value: parsed,
          expectedRevision: capacityRevision,
        }),
      (capacityOutcome) => {
        const failure = wardCommandFailure(capacityOutcome);
        if (failure) {
          warnToast(failure);
          return;
        }
        const confirmed = () =>
          setToastMessage(
            `Capacity and morning bed numbers confirmed (due ${morningRollupTimeLabel}): ${plural(releasesCountedToday.length, "discharge", "discharges")} planned today.`,
          );
        if (isRollupConfirmedToday) {
          confirmed();
          return;
        }
        completeCommand(
          "capacity-rollup",
          () =>
            raise("CONFIRM_MORNING_ROLLUP", {
              unitId: unit.id,
              actingUnitId: unit.id,
              expectedDischarges: releasesCountedToday.length,
            }),
          (rollupOutcome) => {
            const rollupFailure = wardCommandFailure(rollupOutcome);
            if (rollupFailure) warnToast(`Capacity saved. Morning bed numbers are not confirmed. ${rollupFailure}`);
            else confirmed();
          },
        );
      },
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
            className={`${styles.capacityInput} ${styles.capacityInputMono}`}
          />
          <button
            type="submit"
            data-testid="ward-capacity-submit"
            className={`${styles.capacitySubmit} ${styles.tapTarget}`}
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
              Confirm beds and morning bed numbers ({morningRollupTimeLabel})
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
        <p className={`${styles.capacityConfirmed} ${styles.tabularNums}`}>
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
    // Audit 24-3 SV-5: a shared refusal is said on this screen, not only in the status line.
    completeCommand(
      `release:${releaseId}`,
      () => raise("CONFIRM_BED_RELEASE", { releaseId, actingUnitId: unitId }),
      (outcome) => {
        const failure = wardCommandFailure(outcome);
        if (failure) warnToast(failure);
      },
    );
    setNoticesForRelease(releaseId);
  }

  // Bed-model rework (2026-08-28): lifting the blocked flag. The stage is untouched — a confirmed
  // discharge that becomes unstuck is still confirmed.
  function clearBedReleaseBlock(releaseId: string) {
    raise("CLEAR_BED_RELEASE_BLOCK", {
      releaseId,
      actingUnitId: unitId,
    });
  }

  // Name departures through the scoped resolver. Released beds retain no patient label.
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
    const check = {
      prior: rejections.length,
      success: `Recorded: ${who} has left the ward${destinationLabel ? ` (${destinationLabel.toLowerCase()})` : ""}.`,
      who,
      codes: resolved.patient ? [resolved.patient.id, admissionId] : [],
      undoAdmissionId: admissionId,
    };
    completeCommand(
      wardCommandKey("departure", admissionId),
      () =>
        recordWardDeparture
          ? recordWardDeparture(admissionId, unitId, drawerLeavingDestination)
          : raise("RECORD_LEAVING", {
              admissionId,
              actingUnitId: unitId,
              leavingDestination: drawerLeavingDestination,
            }),
      (outcome) => {
        dischargeCheckRef.current = { ...check, outcome };
        setDischargeToken((token) => token + 1);
        if (!outcome || outcome.status === "accepted") closeBedDrawer();
      },
    );
  }

  // Task 5 addendum (binding spec's Data flow section: "Leave beds follow the same path with a
  // two-state life: recorded, then ended on return."): the second half of that life. Same
  // claim-not-proof discipline as every other control on this screen — `actingUnitId` is this
  // screen's own route parameter, and the reducer compares it against the leave bed's own
  // `unitId` before ending it.
  function endLeaveBed(leaveBedId: string) {
    raise("END_LEAVE_BED", {
      leaveBedId,
      actingUnitId: unitId,
    });
  }

  // L2 (site review, 12 Oct 2026): only the discharges the ward figures count for today, from the
  // same `releaseBand` window as `capacityBreakdown` (Confirmed, Expected, Releases held up). A
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
  // The ward answers its own referrals: the site bed manager sees them but has no Accept (D-80).
  const answerBlockedReason = routeRole === "bed_manager" ? `${unit.name} answers its own referrals.` : undefined;
  const intakeDecisions = visibleIncoming.map((movement) => ({
    id: movement.id,
    title: resolvePatientIdentity(movement).displayName,
    onAccept:
      answerBlockedReason === undefined
        ? () => {
            handleAcceptInPrinciple(movement.id, unit.id);
          }
        : undefined,
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
    completeCommand(
      `movement:${movementId}`,
      () =>
        raise("RELEASE_PULL", {
          movementId,
          actingUnitId: unitId,
          reason: releaseReason,
        }),
      (outcome) => {
        const failure = wardCommandFailure(outcome);
        if (failure) {
          warnToast(failure);
          return;
        }
        setReleaseOpenFor(undefined);
        setReleaseReason(undefined);
      },
    );
  }

  function openArrival(movementId: string) {
    setActiveTab("coming");
    window.requestAnimationFrame(() => {
      document.getElementById(`ward-arrival-${movementId}`)?.scrollIntoView({ block: "nearest" });
    });
  }

  // Release gate (15 Oct 2026): on a phone, All discharges and All arrivals sit in the Ward flow
  // sheet. Close the sheet too, so the list is what the person lands on, not a tab behind the sheet
  // (the same reason A1-7 closes it before opening one arrival).
  function openDischargesTab() {
    setPhonePanel(null);
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
  const accessibleUnits = units.filter((candidate) => candidate.id !== unit.id && canOpenHref(unitHref(candidate.id)));
  const siteUnits = accessibleUnits.filter((candidate) => candidate.siteCode === unit.siteCode);
  const switchUnits =
    siteUnits.length > 0
      ? siteUnits
      : accessibleUnits.filter(
          (c) => unitHealthService(c) !== undefined && unitHealthService(c) === unitHealthService(unit),
        );

  const phoneCardOpen = isPhone && phoneWalking && activeTab === "attn"; // Option B: a bed's card has the page
  const wardSwitchMenu =
    switchUnits.length > 0 ? (
      <Menu
        label="Switch ward"
        align="start"
        className={styles.wardSwitchAnchor}
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
            className={isPhone ? styles.wardSwitchName : styles.wardSwitch}
            aria-label={`Switch ward, now ${unit.name}`}
            data-testid="ward-switch-btn"
          >
            {isPhone ? <span className={styles.phoneHeroName}>{unit.name}</span> : null}
            <ChevronDown size={isPhone ? 18 : 16} aria-hidden="true" />
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
          {unit.beds} beds · {states.ready} ready
        </Link>
        {" · "}
        {/* The staffed figure is the bed count; no roster is held, and the screen says so. */}
        <span>Roster not recorded</span> · {staffedSpecialling} staff on constant observation ·{" "}
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
            label: BED_RELEASES_HELD_UP_ANY_DATE_LABEL,
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
        // On a phone this line sits on the white "Ward details and checks" card, not the dark hero.
        surface={isPhone ? "page" : "hero"}
      />
    </span>
  );
  const wardHeroFootAside = (
    <span>
      {/* Walk-through WT-18: "Capacity", so it does not read as the morning bed numbers being confirmed. */}
      {unit.allocatable.source === "ward" ? "Capacity confirmed" : "Last capacity figure"}{" "}
      {formatInstant(unit.allocatable.confirmedAt)} · {durMinutes(Math.max(0, now - unit.allocatable.confirmedAt))} ago
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
      ].filter((item) => tablet || !isPhone || item.id !== "notices")}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={triggerClassName}
          aria-label={tablet ? undefined : "More ward actions"}
          data-testid={tablet ? "ward-tools-more" : "ward-phone-chip-more"}
        >
          <MoreHorizontal size={tablet ? 16 : 20} aria-hidden="true" />
          {tablet ? "More" : null}
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
        tabIndex={activeTab !== "return" && activeTab !== "board" ? 0 : -1}
        aria-controls={
          activeTab === "coming"
            ? "tab-coming"
            : activeTab === "out"
              ? "tab-out"
              : activeTab === "beds"
                ? "tab-beds"
                : "tab-attn"
        }
        // Simplification A8 (19 Oct 2026): "Ward home", as the bed board names this tab, so "Home"
        // means only the app's front page.
        aria-label="Ward home (Worth Your Attention)"
        onClick={() => {
          selectActiveTab("attn");
        }}
      >
        <span>Ward home</span>
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
        tabIndex={activeTab === "board" ? 0 : -1}
        aria-controls="tab-attn"
        aria-label={
          boardWaiting.length > 0
            ? `Bed board (pick up and place), ${boardWaiting.length} waiting to be placed`
            : "Bed board (pick up and place)"
        }
        data-testid="ward-tab-board"
        onClick={() => {
          selectActiveTab("board");
        }}
      >
        <span>Bed board</span>
        {boardWaiting.length > 0 ? (
          <span className={styles.tabBadge} aria-hidden="true">
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
        tabIndex={activeTab === "return" ? 0 : -1}
        aria-controls="tab-return"
        aria-label={`Decisions (Ward record), ${decisionsDueLabel}`}
        onClick={() => {
          selectActiveTab("return");
        }}
      >
        <span>Decisions</span>
        <span className={styles.tabBadge} id="badgeReturn" title={decisionsDueLabel} aria-hidden="true">
          {decisionsDue > 0 ? (isPhone ? decisionsDue : `${decisionsDue} Due`) : "Done"}
        </span>
      </button>
    </li>
  );

  // The service sentence and the referral inbox open the page on desktop. On a phone they sit
  // under the hero and the view tabs, so the dark hero still joins the header.
  const wardLead = (
    <>
      {service !== null && unitHealthService(unit) !== undefined ? (
        <p className={styles.placeholder} data-testid="ward-unit-service-sentence">
          {`This ward is one unit in ${unitHealthService(unit)}, so its own figures below do not change with the service.`}
        </p>
      ) : null}

      <WardReferralInbox unitId={unit.id} />
    </>
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
        {isPhone ? null : wardLead}
        {phoneCardOpen ? null : (
          <WardScreenTopBar
            unit={unit}
            isPhone={isPhone}
            site={site}
            wardSwitchMenu={wardSwitchMenu}
            states={states}
            online={online}
            now={now}
            confirmTriggerRef={confirmTriggerRef}
            openCapacityModal={openCapacityModal}
            wardRibbon={wardRibbon}
            wardHeroFoot={wardHeroFoot}
            wardHeroFootAside={wardHeroFootAside}
            selectActiveTab={selectActiveTab}
            wardMoreMenu={wardMoreMenu}
            raiseReferralGate={raiseReferralGate}
            wardRoleLockNote={wardRoleLockNote}
            notificationCenterOpen={notificationCenterOpen}
            movements={movements}
            notices={wardNotices}
            refreshRequests={refreshRequests}
            isRollupConfirmedToday={isRollupConfirmedToday}
            morningRollupDeadlinePassed={morningRollupDeadlinePassed}
            morningRollupDeadlineMinutes={morningRollupDeadlineMinutes}
            handleConfirmMorningRollup={handleConfirmMorningRollup}
            handleAcknowledgeNotice={handleAcknowledgeNotice}
            handleDismissBuzz={handleDismissBuzz}
            setNotificationCenterOpen={setNotificationCenterOpen}
            notificationTriggerRef={notificationTriggerRef}
            tabHome={tabHome}
            tabDecisions={tabDecisions}
            tabBoard={tabBoard}
            bedQuery={bedQuery}
            setBedQuery={setBedQuery}
            activeTab={activeTab}
            unreadAlertsCount={unreadAlertsCount}
            setDailySheetOpen={setDailySheetOpen}
            tvViewsOn={tvViewsOn}
            handoverHref={handoverHref}
            handleRaiseWardReferral={handleRaiseWardReferral}
            raisedReferral={null}
            selectedBed={selectedBed}
            fullWardReferralHref={fullWardReferralHref}
            bedsList={bedsList}
          />
        )}
        {isPhone && !phoneCardOpen ? (
          /* Phone (v10): the three views pin under the header as one segmented control, outside the
             ward card so they stay in place while the page scrolls. */
          <nav className={`${styles.tabBarWrap} ${styles.phoneTabBar}`} aria-label="Ward Operational Tabs">
            <ul
              className={styles.tabList}
              role="tablist"
              id="mainTabList"
              aria-label="Ward views"
              onKeyDown={moveBetweenWardTabs}
            >
              {tabHome}
              {tabDecisions}
              {tabBoard}
            </ul>
          </nav>
        ) : null}
        {isPhone ? wardLead : null}

        {(() => {
          // Top 25 item 1: shown only once the confirm was accepted, named by bed, never by person.
          const release =
            noticesForRelease !== null
              ? bedReleases.find((candidate) => candidate.id === noticesForRelease && candidate.state === "confirmed")
              : undefined;
          if (!release) return null;
          const stay = admissions.find((admission) => admission.id === release.admissionId);
          const bed = bedsList.find((item) => item.admissionId === release.admissionId);
          const dueSoon = stay !== undefined && deriveAfternoonDischarges([stay], now).length > 0;
          return (
            <WardDischargeNotices
              key={release.id}
              bedLabel={bed?.bedLabel ?? "this bed"}
              dueSoonHours={dueSoon ? Math.round(CLINICAL_VALUES.dischargePrepWindow.value / 60) : null}
              recorded={{ release, actingUnitId: unitId, onFailure: warnToast }}
              onClose={() => setNoticesForRelease(null)}
            />
          );
        })()}
        {activeTab === "board" ? (
          <WardAcceptedReferralPlacement
            unitId={unitId}
            onMessage={setToastMessage}
            onStarted={() => {
              setActiveTab("attn");
              setFlowTab("admissions");
            }}
          />
        ) : null}
        {/* ───────── TAB 1: WORTH YOUR ATTENTION ───────── */}
        <WardScreenHomeSection
          activeTab={activeTab}
          absencesOnOrder={absencesOnOrder}
          isPhone={isPhone}
          phonePanel={phonePanel}
          setPhonePanel={setPhonePanel}
          setPhoneWalking={setPhoneWalking}
          now={now}
          wardHeroFoot={wardHeroFoot}
          wardHeroFootAside={wardHeroFootAside}
          bedQuery={bedQuery}
          setBedQuery={setBedQuery}
          unit={unit}
          handleAcceptInPrinciple={handleAcceptInPrinciple}
          answerBlockedReason={answerBlockedReason}
          units={units}
          capacity={capacity}
          accepted={accepted}
          heldAfterStop={heldAfterStop}
          incoming={incoming}
          withdrawn={withdrawn}
          overridesHere={overridesHere}
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
          pendingBedReleases={pendingBedReleases}
          unitLeaveBeds={unitLeaveBeds}
          resolvePatientIdentity={resolvePatientIdentity}
          lastActionRejection={lastActionRejection}
          overrideReasonForm={overrideReasonForm}
          liveFormAlerts={liveFormAlerts}
          selectActiveTab={selectActiveTab}
          isRollupConfirmedToday={isRollupConfirmedToday}
          morningRollupTimeLabel={morningRollupTimeLabel}
          handleConfirmMorningRollup={handleConfirmMorningRollup}
          handleConfirmBedsAndMorningRollup={handleConfirmBedsAndMorningRollup}
          openCapacityModal={openCapacityModal}
          openArrival={openArrival}
          handlePullPatient={handlePullPatient}
          openDischargesTab={openDischargesTab}
          bedsList={bedsList}
          setSelectedBed={setSelectedBed}
          bedFilter={bedFilter}
          selectBedFilter={selectBedFilter}
          deferredBedQuery={deferredBedQuery}
          flowTab={flowTab}
          selectFlowTab={selectFlowTab}
          shiftView={shiftView}
          selectShiftView={selectShiftView}
          morningRollupDeadlinePassed={morningRollupDeadlinePassed}
          bedTriggerRefs={bedTriggerRefs}
          isMixed={isMixed}
          boardWaiting={boardWaiting}
          boardPick={boardPick}
          pickOnBoard={pickOnBoard}
          boardSay={boardSay}
          boardReasonForm={
            openBedAsk ? (
              <WardBedMoveReasonForm
                key={`${openBedAsk.admissionId}:${openBedAsk.bedNumber}`}
                ask={openBedAsk}
                onMove={(reason) => moveStay(openBedAsk, reason)}
                onCancel={() => setOpenBedAsk(null)}
              />
            ) : null
          }
          pressBoardBed={pressBoardBed}
          placedBed={placedBed}
          latestRefreshRequest={latestRefreshRequest}
          states={states}
          blockedReleases={blockedReleases}
          pendingPreparation={pendingPreparation}
        />

        {/* ───────── TAB 5: TODAY'S DECISIONS & SHIFT COCKPIT ───────── */}
        <WardScreenTabSections
          activeTab={activeTab}
          unit={unit}
          isRollupConfirmedToday={isRollupConfirmedToday}
          morningRollupDeadlinePassed={morningRollupDeadlinePassed}
          morningRollupTimeLabel={morningRollupTimeLabel}
          rollupConfirmation={rollupConfirmation}
          releasesCountedToday={releasesCountedToday}
          handleConfirmMorningRollup={handleConfirmMorningRollup}
          intakeDecisions={intakeDecisions}
          departureDecisions={departureDecisions}
          leaveDecisions={leaveDecisions}
          capacity={capacity}
          readyByShiftEnd={readyByShiftEnd}
          now={now}
          setActiveTab={setActiveTab}
          handlePullPatient={handlePullPatient}
          accepted={accepted}
          heldAfterStop={heldAfterStop}
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
          unitLeaveBeds={unitLeaveBeds}
          blockedReleases={blockedReleases}
          confirmBedRelease={confirmBedRelease}
          clearBedReleaseBlock={clearBedReleaseBlock}
          endLeaveBed={endLeaveBed}
          bedsList={bedsList}
          selectedBed={selectedBed}
          setSelectedBed={setSelectedBed}
          selectedPod={selectedPod}
          setSelectedPod={setSelectedPod}
          isMixed={isMixed}
        />

        {/* ───────── BED TELEMETRY & CLINICAL DOSSIER DRAWER ───────── */}
        <WardScreenBedDrawer
          selectedBed={selectedBed}
          bedsList={bedsList}
          admissions={admissions}
          unit={unit}
          closeBedDrawer={closeBedDrawer}
          setSelectedBed={setSelectedBed}
          drawerLeavingDestination={drawerLeavingDestination}
          setDrawerLeavingDestination={setDrawerLeavingDestination}
          handleDrawerRecordLeft={handleDrawerRecordLeft}
          pathname={pathname}
          routeRole={routeRole}
          pendingBedReleases={pendingBedReleases}
          raise={raise}
          unitId={unitId}
          setToastMessage={setToastMessage}
          leaveBeds={leaveBeds}
          bedDrawerRef={bedDrawerRef}
          handleBedDrawerKeyDown={handleBedDrawerKeyDown}
          moveStayOnBoard={moveStayOnBoard}
          setActiveTab={setActiveTab}
          raiseReferralGate={raiseReferralGate}
          handleRaiseWardReferral={handleRaiseWardReferral}
          fullWardReferralHref={fullWardReferralHref}
          wardRoleLockNote={wardRoleLockNote}
          barrierGate={barrierGate}
          dispatch={dispatch}
          now={now}
          criteriaLedOn={criteriaLedOn}
          criteriaGate={criteriaGate}
          raiseAsRouteRole={raiseAsRouteRole}
        />

        {/* ─── Confirmation Modal (Confirm Capacity Figures) ───────────── */}
        <WardScreenCapacityModal
          confirmNumbersOpen={confirmNumbersOpen}
          closeCapacityModal={closeCapacityModal}
          capacityModalRef={capacityModalRef}
          unit={unit}
          occupancy={occupancy}
          capacity={capacity}
          states={states}
          capacityValue={capacityValue}
          capacityConfirmationForm={capacityConfirmationForm}
        />

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

        <WardPageActionToast toast={toastMessage} onClose={() => setToastMessage(null)} />
        <WardPrototypeFooter
          testId="ward-unit-governance"
          note={`Scoped to ${unit.name} · Bed decisions remain human-confirmed · Not approved for clinical use`}
        />
      </main>
    </div>
  );
}
