"use client";

import { NotWiredButton } from "@/components/ward-management/not-wired-button";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { isOfficerJob, officerCancellationNotices } from "./officer-jobs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Copy, Lock, MapPin, Search, ShieldCheck, Truck, X } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  EmptyState,
  FilterChip,
  Hero,
  HeroChip,
  HeroChips,
  LiveChip,
  HeroStat,
  Icon,
  Kbd,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  StatusLine,
  TabPanel,
  Tabs,
  TextInput,
  Timeline,
  cx,
  durMinutes,
  tableClasses,
  useModalFocus,
  type TimelineItem,
  type WfTone,
} from "@/components/wf";
import {
  EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE,
  examinationRevokedWhileBedHeld,
  stageCopy,
  transportLeg,
} from "@/components/ward-management/ward-derivations";
import { STAGE_TRANSITION_BLOCKERS } from "@/components/ward-management/ward-flow-reducer";
import { movementUmrn, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { dayOf, formatInstantWithDay, formatSheetMoment, type Instant } from "@/components/ward-management/ward-clock";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  TRANSPORT_PROVIDERS,
  type Movement,
  type TransportJob,
  type Unit,
} from "@/components/ward-management/ward-model";
import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import { edById, edShortName, siteByCode } from "@/components/ward-management/ward-sites";
import { referenceDistance } from "@/components/ward-management/reference/ward-reference-distances";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  DIVERSION_REASONS,
  TRANSPORT_WHEREABOUTS,
  changeReasonLabels,
  type DiversionReason,
  type TransportWhereabouts,
} from "@/components/ward-management/ward-change-reasons";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
  UNDO_TOAST_MS,
} from "@/components/ward-management/ward-operational-defaults";

import {
  FormsPack,
  PACK_SLOTS,
  packCount,
  packForm,
  packNeedsForms,
  packOutstanding,
  packRequired,
} from "./officer-forms-pack";
import styles from "./officer.module.css";
import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import type { TransportExceptionInput } from "@/components/ward-management/ward-flow-events";
import {
  collectionGaps,
  holdEndsBeforeEta,
  legalNowText,
  transportExceptionText,
  transportStatusClashes,
} from "@/components/ward-management/ward-transport-checks";

/**
 * `TRANSPORT_ACCEPTED`'s own preconditions (`ward-flow-reducer.ts`), named here so the Accepted
 * button can never advertise an action the reducer would refuse — the same discipline
 * `ward-screen.tsx`'s `referralAnswerBlocked`/`holdBlockedReason` and `shortlist-panel.tsx`'s
 * `canRefer` already hold to. The two branches below are read straight off the reducer's own
 * `case "TRANSPORT_ACCEPTED"`, in the same order, so the two can never silently drift apart.
 */
/**
 * The four actions this screen dispatches, read back as THE WORDS ALREADY ON THE BUTTON.
 *
 * ⚠️ `Rejection.attempted` is the event's own type string verbatim (see `makeRejection` in
 * `ward-flow-reducer.ts`) — `PATIENT_COLLECTED`, not "Collected". Rendering it raw would put a
 * SCREAMING_CASE token in front of a clinician, which this repository has already had to repair
 * once on a clinical heading. Same shape and same reason as `WARD_ACTION_REJECTION_LABELS` in
 * `ward-screen.tsx`.
 *
 * 🔴 THIS MAP IS ALSO THE SCOPE FILTER, AND THAT IS DELIBERATE. A refusal whose `attempted` is not
 * one of these four is not this screen's business — and because an unknown key is dropped rather
 * than displayed, no event type added later can render as a raw token here by default. The filter
 * and the anti-token guarantee are the same line of code.
 *
 * ⚠️ IT FILTERS BY ACTION, NEVER BY THE JOBS VISIBLE ABOVE. The refusal this surface exists for
 * happens exactly when somebody else has closed the movement, which REMOVES it from the job list.
 * Scoping to what is on screen is the intuitive choice and would hide the motivating case.
 *
 * ⚠️ And `Rejection.movementId` holds a REFERRAL id for the referral events, so showing everything
 * would print referral ids under a movement label. These four are all movement-scoped.
 */
const OFFICER_ACTION_REJECTION_LABELS: Record<string, string> = {
  TRANSPORT_ACCEPTED: "Accepted",
  TRANSPORT_EN_ROUTE: "En route",
  PATIENT_COLLECTED: "Collected",
  // Item 31 (owner's 17 September answers): the officer's own "Arrived" becomes "Delivered" —
  // the button, this rejection label and the guard bullet below. The event dispatched stays
  // `PATIENT_ARRIVED`; the ward, tracker and movements screens keep "Arrived" for that same
  // event, since this map and its neighbours are scoped to this screen alone.
  PATIENT_ARRIVED: "Delivered",
};

/*
 * 🔴 EVERY PREDICATE BELOW MUST CHECK `movement.closure` FIRST, AND THAT CHECK WAS MISSING FROM ALL
 * FOUR UNTIL 2026-09-04.
 *
 * The four reducer cases these mirror — TRANSPORT_ACCEPTED, TRANSPORT_EN_ROUTE, PATIENT_COLLECTED,
 * PATIENT_ARRIVED — each reject a closed movement before anything else. These predicates mirrored
 * the stage and transport preconditions and omitted the closure one. So on a movement an ED user
 * had closed, the officer's button RENDERED ENABLED, the press produced a rejection, and the
 * movement came back byte-identical. A clinician pressed a button on a phone and nothing happened
 * and nothing said why.
 *
 * ⚠️ CLOSURE IS CHECKED FIRST HERE BECAUSE IT IS CHECKED FIRST THERE. Order is not cosmetic: a
 * closed movement also fails the stage guard, so putting closure second would show the clinician a
 * stage message for a movement that has ENDED — true, and the wrong reason.
 *
 * ⚠️ AND READ THIS BEFORE TRUSTING A COMMENT ON ONE OF THESE. Each of these functions carried a
 * comment saying it "mirrors `case X` exactly"; the arrival one went further and named the floor
 * guard on empty beds as its evidence of completeness. Every word of that was TRUE, and all four
 * omitted closure. A COMMENT THAT ENUMERATES WHAT IT COVERS READS AS AN INVENTORY, and `ed-screen.tsx`
 * then cited these four as the convention to hold to. The enumeration is what stopped anyone looking.
 *
 * `tests/ward-officer-blocked-reason-parity.test.ts` now DRIVES every movement each predicate
 * permits through the matching reducer case and asserts none is rejected. That is the check that
 * cannot be satisfied by a comment: it never reads either implementation.
 */
/**
 * The WLQ-4 guard `TRANSPORT_ACCEPTED` and `TRANSPORT_EN_ROUTE` both apply right after closure: an
 * examination revoked (or turned into a community order) while the bed is still held, or the
 * movement's blocker saying it awaits that release. Added 25 Sept 2026 (live walkthrough): these
 * two predicates omitted it, so the officer was offered buttons the reducer then refused.
 */
function revokedHoldingBedReason(movement: Movement, action: string, who?: string): string | undefined {
  if (
    examinationRevokedWhileBedHeld(movement) ||
    movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease
  ) {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return `${who ?? "This patient"} cannot be ${action}: ${EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE.charAt(0).toLowerCase()}${EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE.slice(1)}`;
  }
  return undefined;
}

export function acceptedBlockedReason(movement: Movement, who?: string): string | undefined {
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  if (movement.closure) {
    return `${who ?? "This patient"} has already closed (${movement.closure.reason}). Transport cannot be accepted for a movement that has ended.`;
  }
  const revoked = revokedHoldingBedReason(movement, "accepted for transport", who);
  if (revoked) return revoked;
  if (movement.stage !== "handover_ready" || !movement.transport) {
    return `${who ?? "This patient"} is ${stageCopy[movement.stage].label.toLowerCase()}, not ready for a transport handover.`;
  }
  if (movement.transport.acceptedAt !== undefined) {
    return `Transport for ${who ?? "this patient"} was already accepted.`;
  }
  return undefined;
}

/** Mirrors `case "TRANSPORT_EN_ROUTE"`, closure guard first. See the block above the group. */
export function enRouteBlockedReason(movement: Movement, who?: string): string | undefined {
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  if (movement.closure) {
    return `${who ?? "This patient"} has already closed (${movement.closure.reason}). Transport cannot be moved for a movement that has ended.`;
  }
  const revoked = revokedHoldingBedReason(movement, "sent en route", who);
  if (revoked) return revoked;
  if (movement.stage !== "handover_ready" || movement.transport?.acceptedAt === undefined) {
    return (
      `Transport for ${who ?? "this patient"} cannot go en route: the movement must be at ` +
      `${stageCopy.handover_ready.label} with transport accepted (it is at ` +
      `${stageCopy[movement.stage].label}, transport ` +
      `${movement.transport?.acceptedAt === undefined ? "not accepted" : "accepted"}).`
    );
  }
  if (movement.transport.enRouteAt !== undefined) {
    return `Transport for ${who ?? "this patient"} is already en route.`;
  }
  return undefined;
}

/** Mirrors `case "PATIENT_COLLECTED"`, closure guard first. The reducer carries no "already
 * collected" check of its own — collecting moves the stage to `moving`, so the stage guard already
 * covers a second attempt — and this stays a faithful mirror rather than adding a check the reducer
 * lacks. ⚠️ That sentence was true while the function omitted closure entirely; it describes one
 * deliberate omission and was silent about an accidental one. See the block above the group. */
export function collectedBlockedReason(movement: Movement, who?: string): string | undefined {
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  if (movement.closure) {
    return `${who ?? "This patient"} has already closed (${movement.closure.reason}). A patient cannot be collected for a movement that has ended.`;
  }
  if (examinationRevokedWhileBedHeld(movement)) {
    return `${who ?? "This patient"} cannot be collected: ${EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE.charAt(0).toLowerCase()}${EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE.slice(1)}`;
  }
  if (movement.stage !== "handover_ready" || movement.transport?.enRouteAt === undefined) {
    return (
      `${who ?? "This patient"} cannot be marked collected: the movement must be at ` +
      `${stageCopy.handover_ready.label} with transport en route (it is at ` +
      `${stageCopy[movement.stage].label}, transport ` +
      `${movement.transport?.enRouteAt === undefined ? "not en route" : "en route"}).`
    );
  }
  return undefined;
}

/**
 * Mirrors `case "PATIENT_ARRIVED"`, closure guard first. There is deliberately NO empty-bed guard:
 * the reducer accepts an arrival into a full ward and records it as "Arrived — Bed Turnaround", so
 * refusing it here stopped the officer recording a patient who had physically arrived (live
 * walkthrough, 25 Sept 2026).
 */
export function arrivedBlockedReason(movement: Movement, unit: Unit | undefined, who?: string): string | undefined {
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  if (movement.closure) {
    return `${who ?? "This patient"} has already closed (${movement.closure.reason}). A patient cannot be marked arrived for a movement that has ended.`;
  }
  if (movement.transport?.diversion) {
    return `${who ?? "This patient"} was diverted; release the held bed rather than recording delivery.`;
  }
  // A4-16: Delivered ends the transport leg once; the receiving ward then confirms arrival.
  if (movement.transport?.arrivedAt !== undefined) {
    return `${who ?? "This patient"} was already delivered. The receiving ward confirms arrival.`;
  }
  if (movement.stage !== "moving" || movement.transport?.collectedAt === undefined) {
    return `${who ?? "This patient"} cannot be marked arrived before the patient has been collected.`;
  }
  if (!movement.acceptedUnitId) {
    return `${who ?? "This patient"} has no accepted destination unit recorded.`;
  }
  if (!unit) {
    return `${who ?? "This patient"}'s accepted destination is ${wardLabel(movement.acceptedUnitId, undefined)}.`;
  }
  return undefined;
}

function formRequiredLabel(transport: TransportJob): string {
  // Recorded code only — do not imply the officer holds a live MHA instrument.
  if (!transport.formRequired) return "No transport form recorded";
  const raw = transport.formRequired.trim();
  if (/^Form\s+/i.test(raw)) return `${raw} (recorded)`;
  if (/^[0-9A-Z]+$/i.test(raw)) return `Form ${raw} (recorded)`;
  return `${raw} (recorded)`;
}

/**
 * Owner's third ruling, 2026-09-17: the three facts logged from the phone call that made this
 * booking.
 */
function cadNumberLabel(transport: TransportJob): string {
  return transport.cadNumber ?? "No CAD (dispatch) number recorded";
}

function transportLegalStatusLabel(transport: TransportJob): string {
  if (transport.transportLegalStatus === "voluntary") return "Voluntary";
  if (transport.transportLegalStatus === "involuntary") return "Involuntary";
  return "Not recorded";
}

function estimatedTimeLabel(transport: TransportJob, now: Instant): string {
  if (transport.estimatedAt === undefined) return "Not recorded";
  const when = formatInstantWithDay(transport.estimatedAt, now);
  return `${when} · ${transportEtaRemainingLabel(transport.estimatedAt, now)}`;
}

/**
 * THE FOUR STAGES A TRANSPORT LEG PASSES THROUGH, in `transportLeg`'s own order.
 */
const OFFICER_LEG_STEPS = ["Requested", "Accepted", "En route", "Collected"] as const;
type OfficerLeg = (typeof OFFICER_LEG_STEPS)[number];

function officerLeg(transport: TransportJob): OfficerLeg | undefined {
  const leg = transportLeg(transport);
  return leg === "Requested" || leg === "Accepted" || leg === "En route" || leg === "Collected" ? leg : undefined;
}

function nextActionVerb(leg: OfficerLeg): string {
  if (leg === "Requested") return "Accepted";
  if (leg === "Accepted") return "En route";
  if (leg === "En route") return "Collected";
  return "Delivered";
}

// THE JOBS THIS PHONE SCREEN SHOWS: the predicate lives in `officer-jobs.ts` so Settings' workstation
// drawer counts the same jobs without importing this screen.
export { isOfficerJob };

type HighlightPill = "requested" | "accepted" | "en_route" | "collected" | "late" | "forms";
type SortKey = "next" | "wait" | "eta";
type JobsTab = "jobs" | "history";
type HistoryTab = "delivered" | "refused" | "cancelled";

/** The three hero figures a phone keeps (phone plan: title plus at most three figures). */
const PHONE_PILLS: HighlightPill[] = ["late", "forms", "requested"];

/** When the job reached its current leg, if the record says. A requested job carries no time. */
function stageStartedAt(movement: Movement): Instant | undefined {
  const transport = movement.transport;
  return transport?.collectedAt ?? transport?.enRouteAt ?? transport?.acceptedAt;
}

/** For sorting by longest wait: the leg's start, or when the movement opened. */
function stageSince(movement: Movement): Instant {
  return stageStartedAt(movement) ?? movement.openedAt;
}

/**
 * The ward ETA a job carries, if any: the arrival plan's time only. The time typed at booking is
 * the provider's estimate, not a ward ETA, so lateness is never measured against it.
 */
function wardEta(movement: Movement): Instant | undefined {
  return movement.arrivalDetails?.estimatedArrivalAt;
}

/** When a job is expected: its ward ETA, or else the time typed at booking, saying which. */
function expectedArrival(movement: Movement): { at: Instant; booked: boolean } | undefined {
  const ward = wardEta(movement);
  if (ward !== undefined) return { at: ward, booked: false };
  const booked = movement.transport?.estimatedAt;
  return booked === undefined ? undefined : { at: booked, booked: true };
}

/** True once a job is more than the grace past its recorded ward ETA and has not arrived. */
function pastWardEta(movement: Movement, now: Instant): boolean {
  return (
    movement.arrivalDetails !== undefined &&
    now > movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES
  );
}

const LEG_TONE: Record<OfficerLeg, WfTone> = {
  Requested: "neutral",
  Accepted: "info",
  "En route": "info",
  Collected: "success",
};

/**
 * TRANSPORT PAGE A, 9 October 2026 (Josh picked direction A of the Transport mockups). The hero
 * counts the jobs by what each is waiting on; its pills, the provider row, the chips and the search
 * HIGHLIGHT rows and never hide one. The jobs table runs the full width until a patient is chosen,
 * then the job panel opens beside it (a bottom sheet on a phone) with the route, the four stage
 * actions, the forms pack, the booking facts, the arrival plan and activity. Arrivals sits under
 * the table. Closed work (delivered today, refused, cancelled) lives in History.
 *
 * **Left out, because the app has no such action or record:** Dispatch comms and Call ward (no
 * call is placed from this prototype), Stand down (the officer may not cancel a transport — see
 * `EVENT_ROLE.CANCEL_TRANSPORT`), the receiving nurse and bed on the arrival plan. Log booking and
 * Send to officer are Preview: `BOOK_TRANSPORT` is the sending team's event, and no event sends a
 * forms pack yet.
 */
export function OfficerScreen() {
  const { movements, units, dispatch, rejections, patients, referrals, dayZero, notices } = useWardFlow();
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 48rem)");
    const sync = () => setIsPhone(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);
  const officerPatientName = useCallback(
    (movement: Movement) => {
      const info = resolveSubjectPatient(movement, { patients, referrals, movements });
      // Phone (v10) lists people surname first.
      return info.patient ? (isPhone ? info.formalName : info.displayName) : "Not recorded";
    },
    [patients, referrals, movements, isPhone],
  );
  // Owner, 26 Sept 2026: undefined (not "Not recorded") lets the blocked-reason helpers below
  // fall back to their own "This patient" wording instead of printing a placeholder mid-sentence.
  const resolvedPatientName = (movement: Movement): string | undefined => {
    const info = resolveSubjectPatient(movement, { patients, referrals, movements });
    return info.patient ? info.displayName : undefined;
  };
  // D-39: the patient's UMRN is shown wherever the WF journey number used to be.
  const umrnLookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const umrnFor = useCallback((movement: Movement) => movementUmrn(movement, umrnLookup), [umrnLookup]);
  const patientNameForMovementId = (movementId: string) => {
    const movement = movements.find((candidate) => candidate.id === movementId);
    return movement ? officerPatientName(movement) : "Not recorded";
  };
  const now = useWardFlowClock();

  const [collectCheckId, setCollectCheckId] = useState<string | null>(null);
  const jobs = movements.filter(isOfficerJob);
  const cancellations = officerCancellationNotices(notices ?? [], now);
  const collectCheck = collectCheckId ? movements.find((movement) => movement.id === collectCheckId) : undefined;
  const unitFor = (movement: Movement): Unit | undefined =>
    movement.acceptedUnitId ? units.find((unit) => unit.id === movement.acceptedUnitId) : undefined;
  const destinationLabelFor = (movement: Movement) =>
    movement.acceptedUnitId
      ? wardLabel(movement.acceptedUnitId, unitFor(movement)?.name)
      : "No accepted destination recorded";
  const originLabelFor = (movement: Movement) => {
    const originEd = edById(movement.originEdId);
    return departmentLabel(movement.originEdId, originEd && `${originEd.name} (${originEd.siteCode})`);
  };
  const originShortFor = (movement: Movement) => edById(movement.originEdId)?.siteCode ?? originLabelFor(movement);

  // Highlights (Josh, 9 Oct 2026, page A): a pill, chip, provider or search lights rows up. Nothing
  // here hides a job, so the officer never loses a job behind a filter they forgot was on.
  const [searchQuery, setSearchQuery] = useState("");
  const [pill, setPill] = useState<HighlightPill | null>(null);
  const [providerHighlight, setProviderHighlight] = useState<string | null>(null);
  const [escortHighlight, setEscortHighlight] = useState(false);
  const [involuntaryHighlight, setInvoluntaryHighlight] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("next");
  const [jobsTab, setJobsTab] = useState<JobsTab>("jobs");
  const [historyTab, setHistoryTab] = useState<HistoryTab>("delivered");

  const late = (movement: Movement) => pastWardEta(movement, now);
  // Audit round 2, S-14: "To accept" holds only jobs the officer can accept now. A job whose bed is
  // not yet at handover is waiting on the sending team, not on the officer.
  const readyToAccept = (movement: Movement) =>
    movement.transport !== undefined &&
    officerLeg(movement.transport) === "Requested" &&
    acceptedBlockedReason(movement) === undefined;
  const matchesPill = (movement: Movement, which: HighlightPill): boolean => {
    const leg = movement.transport ? officerLeg(movement.transport) : undefined;
    if (which === "requested") return readyToAccept(movement);
    if (which === "accepted") return leg === "Accepted";
    if (which === "en_route") return leg === "En route";
    if (which === "collected") return leg === "Collected";
    if (which === "late") return late(movement);
    return packNeedsForms(movement);
  };
  const query = searchQuery.toLowerCase().trim();
  const matchesSearch = (movement: Movement) => {
    if (!query) return false;
    const transport = movement.transport;
    const originEd = edById(movement.originEdId);
    const haystack = [
      officerPatientName(movement),
      umrnFor(movement),
      originEd ? `${originEd.name} ${originEd.siteCode}` : "",
      unitFor(movement)?.name ?? "",
      transport?.provider ?? "",
      transport?.cadNumber ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  };
  const isHighlighted = (movement: Movement) =>
    (pill !== null && matchesPill(movement, pill)) ||
    (providerHighlight !== null && movement.transport?.provider === providerHighlight) ||
    (escortHighlight && movement.transport?.escortRequired === true) ||
    (involuntaryHighlight && movement.transport?.transportLegalStatus === "involuntary") ||
    matchesSearch(movement);
  const anyHighlight =
    pill !== null || providerHighlight !== null || escortHighlight || involuntaryHighlight || query !== "";
  const highlightedCount = anyHighlight ? jobs.filter(isHighlighted).length : 0;
  const clearHighlights = () => {
    setSearchQuery("");
    setPill(null);
    setProviderHighlight(null);
    setEscortHighlight(false);
    setInvoluntaryHighlight(false);
  };

  // Next action first: late, then forms still to upload, then the jobs furthest along.
  const priority = (movement: Movement) => {
    // Audit round 2, A4-13 (phone): a job to accept is pinned to the top, oldest first, so a new
    // booking is the Next action rather than the last row.
    if (isPhone && readyToAccept(movement)) return -1;
    if (late(movement)) return 0;
    if (packOutstanding(movement)) return 1;
    const leg = movement.transport ? officerLeg(movement.transport) : undefined;
    return 2 + (3 - (leg ? OFFICER_LEG_STEPS.indexOf(leg) : 0));
  };
  const sortedJobs = [...jobs].sort((a, b) => {
    if (sortKey === "wait") return stageSince(a) - stageSince(b);
    if (sortKey === "eta") {
      return (
        (expectedArrival(a)?.at ?? Number.POSITIVE_INFINITY) - (expectedArrival(b)?.at ?? Number.POSITIVE_INFINITY)
      );
    }
    return priority(a) - priority(b) || stageSince(a) - stageSince(b);
  });

  // The panel opens only when a patient is chosen (Josh, 9 Oct 2026): until then the table runs
  // the full width of the page.
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selectedJob = selectedId === undefined ? undefined : jobs.find((job) => job.id === selectedId);

  const [formModalJob, setFormModalJob] = useState<Movement | null>(null);
  const [toastMessage, setToastMessage] = useState<
    | { message: string }
    | {
        success: string;
        refused: string;
        priorRejections: number;
        /** v10 pass 3: the journey whose transport step the toast's Undo takes back. */
        undoMovementId?: string;
        /** An Undo's own outcome: a refusal then gives the engine's reason. */
        withReason?: boolean;
      }
    | null
  >(null);
  const [verifiedChecks, setVerifiedChecks] = useState<Record<string, boolean[]>>({});
  const [diversionOpen, setDiversionOpen] = useState(false);
  const [diversionReason, setDiversionReason] = useState<DiversionReason | undefined>(undefined);
  const [diversionPlace, setDiversionPlace] = useState<TransportWhereabouts | undefined>(undefined);

  const toggleCheck = (movementId: string, index: number) => {
    setVerifiedChecks((prev) => {
      const currentList = prev[movementId] ?? [false, false, false, false];
      const updated = [...currentList];
      updated[index] = !updated[index];
      return { ...prev, [movementId]: updated };
    });
  };
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const formModalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const resetDiversion = () => {
    setDiversionOpen(false);
    setDiversionReason(undefined);
    setDiversionPlace(undefined);
  };
  const selectJob = (id: string) => {
    resetDiversion();
    setSelectedId((current) => (current === id ? undefined : id));
  };
  const openJob = (id: string) => {
    if (id !== selectedId) resetDiversion();
    setSelectedId(id);
  };
  const closeJob = () => {
    resetDiversion();
    setSelectedId(undefined);
  };
  // Between the phone sheet and the two-column layout the panel stacks above the lists, so a
  // newly chosen job is scrolled into view rather than opening off-screen.
  const sideRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId === undefined || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(min-width: 48.0625rem) and (max-width: 62.5rem)").matches) return;
    sideRef.current?.scrollIntoView?.({ behavior: wardScrollBehavior(), block: "start" });
  }, [selectedId]);
  // On a phone the panel is a modal bottom sheet, so it takes focus, traps Tab, isolates the page
  // behind it and hands focus back on close. Wider screens keep the side panel non-modal.
  // isPhone is declared above officerPatientName, which reads it.

  // The form check opens over the phone job sheet, so it joins the shared modal contract: the
  // sheet and page behind are inert, focus starts on the first control, Tab wraps inside, Escape
  // closes only this dialog (handled first, before this screen's own Escape shortcut), and focus
  // returns to the trigger once the stack has released it.
  useModalFocus({
    open: formModalJob !== null,
    onClose: () => setFormModalJob(null),
    panelRef: formModalRef,
    returnFocusRef: lastTriggerRef,
    focusOnOpen: "immediate",
    keyPhase: "capture",
  });

  // Newest first: `rejections` is appended in raise order
  const officerRefusals = [...rejections]
    .reverse()
    .filter((rejection) => OFFICER_ACTION_REJECTION_LABELS[rejection.attempted] !== undefined);

  const cancelledTransports = movements.flatMap((m) =>
    (m.unwinds ?? [])
      .filter((u) => u.kind === "transport_cancelled")
      .map((u) => ({
        movementId: m.id,
        // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
        patientName: officerPatientName(m),
        cadNumber: u.cadNumber ?? "CAD (dispatch) number not recorded",
        at: u.at,
        // A recorded reason is a code (e.g. `provider_unavailable`); show its plain label, never the code.
        note:
          (u.reason ? (changeReasonLabels[u.reason as keyof typeof changeReasonLabels] ?? u.reason) : undefined) ??
          "Cancelled transport / stand-down",
      })),
  );

  // Delivered today: closed jobs leave the live list and land here, newest first.
  const deliveredToday = movements
    .filter(
      (movement) => movement.transport?.arrivedAt !== undefined && dayOf(movement.transport.arrivedAt) === dayOf(now),
    )
    .sort((a, b) => b.transport!.arrivedAt! - a.transport!.arrivedAt!);

  // Hero counts. Each label names exactly the population its count holds.
  const legCount = (leg: OfficerLeg) => jobs.filter((job) => job.transport && officerLeg(job.transport) === leg).length;
  const inCustody = jobs.filter(
    (job) => job.transport?.collectedAt !== undefined && job.transport?.arrivedAt === undefined,
  ).length;
  const awaitingDeparture = jobs.filter(readyToAccept).length;
  const crewToSend = legCount("Accepted");
  const crewEnRoute = legCount("En route");
  const pastEta = jobs.filter(late).length;
  const formsOutstanding = jobs.filter(packNeedsForms).length;

  const nextArrival = jobs
    .map((movement) => ({ movement, at: expectedArrival(movement)?.at }))
    .filter((item): item is { movement: Movement; at: Instant } => item.at !== undefined && item.at >= now)
    .sort((a, b) => a.at - b.at)[0];

  // Escape and "/" shortcut handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (formModalJob) {
          setFormModalJob(null);
          lastTriggerRef.current?.focus();
        } else if (selectedId !== undefined && !document.querySelector('[role="dialog"][aria-modal="true"]')) {
          setSelectedId(undefined);
        }
      } else if (
        e.key === "/" &&
        !formModalJob &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        setJobsTab("jobs");
        // The field sits in the Jobs panel, which only renders once the tab switch commits.
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formModalJob, selectedId]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(
      () => {
        setToastMessage(null);
      },
      "undoMovementId" in toastMessage && toastMessage.undoMovementId ? UNDO_TOAST_MS : 3500,
    );
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const showToast = (msg: string) => {
    setToastMessage({ message: msg });
  };

  /*
   * `dispatch` never says whether the reducer accepted or refused, so the four transport buttons
   * used to announce success unconditionally ("Transport accepted for WF-…") even when the event
   * was refused (live walkthrough, 25 Sept 2026). Same pattern as the ward screen's `checkToken`:
   * note the refusal count before dispatching, then compare on the next render. The toast carries
   * both sentences and the count, and the render picks the true one.
   */
  // Called straight after `dispatch` in the same handler, so `rejections` here is still the
  // pre-dispatch list. Each action calls `dispatch({ type: "..." })` itself, with a literal type,
  // so the override-surface guard can read every transport event.
  const reportOutcome = (success: string, action: string, who: string, undoMovementId?: string) => {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    setToastMessage({
      success,
      refused: `${action} for ${who} was refused. See History, Refused.`,
      priorRejections: rejections.length,
      ...(undoMovementId ? { undoMovementId } : {}),
    });
  };
  // v10 pass 3: Undo takes back the step just recorded (UNDO_TRANSPORT_STEP, within the engine's window).
  const undoTransportStep = (movementId: string) => {
    const prior = rejections.length;
    dispatch({ type: "UNDO_TRANSPORT_STEP", role: "officer", now, movementId });
    setToastMessage({
      success: "Undone. Back as it was.",
      refused: "Undo was refused:",
      priorRejections: prior,
      withReason: true,
    });
  };
  const toastText =
    toastMessage === null
      ? null
      : "message" in toastMessage
        ? toastMessage.message
        : rejections.length > toastMessage.priorRejections
          ? toastMessage.withReason
            ? `${toastMessage.refused} ${rejections[rejections.length - 1]?.reason ?? ""}.`
            : toastMessage.refused
          : toastMessage.success;
  const toastUndoFor =
    toastMessage !== null &&
    "undoMovementId" in toastMessage &&
    toastMessage.undoMovementId !== undefined &&
    rejections.length === toastMessage.priorRejections
      ? toastMessage.undoMovementId
      : undefined;

  const runAccepted = (movement: Movement) => {
    dispatch({ type: "TRANSPORT_ACCEPTED", role: "officer", now, movementId: movement.id });
    reportOutcome(
      `Transport accepted for ${officerPatientName(movement)}.`,
      "Transport acceptance",
      officerPatientName(movement),
      movement.id,
    );
  };
  const runEnRoute = (movement: Movement) => {
    dispatch({ type: "TRANSPORT_EN_ROUTE", role: "officer", now, movementId: movement.id });
    reportOutcome(
      `Transport en route for ${officerPatientName(movement)}.`,
      "En route",
      officerPatientName(movement),
      movement.id,
    );
  };
  // Audit A4-11 / S-2: Collected with no Form 4A or no fit to travel warns and records a reason.
  const runCollected = (movement: Movement) => {
    if (collectionGaps(movement).length > 0) {
      setCollectCheckId(movement.id);
      return;
    }
    recordCollected(movement);
  };
  const recordCollected = (movement: Movement, exception?: TransportExceptionInput) => {
    dispatch({
      type: "PATIENT_COLLECTED",
      role: "officer",
      now,
      movementId: movement.id,
      ...(exception ? { exception } : {}),
    });
    reportOutcome(
      `Patient collected for ${officerPatientName(movement)}. In transit.`,
      "Collection",
      officerPatientName(movement),
      movement.id,
    );
  };
  const runDelivered = (movement: Movement) => {
    dispatch({ type: "PATIENT_ARRIVED", role: "officer", now, movementId: movement.id });
    reportOutcome(
      `Delivery recorded for ${officerPatientName(movement)}. Delivered to receiving unit.`,
      "Delivery",
      officerPatientName(movement),
      movement.id,
    );
  };

  /** The one action a job is waiting on, why it cannot be taken yet, and how to take it. */
  const nextStep = (movement: Movement) => {
    const transport = movement.transport;
    const leg = transport ? officerLeg(transport) : undefined;
    if (!leg) return undefined;
    const who = resolvedPatientName(movement);
    if (leg === "Requested") {
      return { leg, verb: "Accept", blocked: acceptedBlockedReason(movement, who), run: runAccepted };
    }
    if (leg === "Accepted") {
      return { leg, verb: "En route", blocked: enRouteBlockedReason(movement, who), run: runEnRoute };
    }
    if (leg === "En route") {
      return { leg, verb: "Collected", blocked: collectedBlockedReason(movement, who), run: runCollected };
    }
    return {
      leg,
      verb: "Delivered",
      blocked: arrivedBlockedReason(movement, unitFor(movement), who),
      run: runDelivered,
    };
  };

  /**
   * Audit round 2, S-14: why the next step cannot be taken yet, printed (not a hover title) on
   * phone. A job still short of handover is waiting on the sending team, so it says so plainly.
   */
  const blockedNote = (movement: Movement): string | undefined => {
    const step = nextStep(movement);
    if (!step?.blocked) return undefined;
    if (
      step.leg === "Requested" &&
      !movement.closure &&
      movement.stage !== "handover_ready" &&
      !revokedHoldingBedReason(movement, "accepted for transport")
    ) {
      const sender = edShortName(edById(movement.originEdId)) || "the sending team";
      return `Waiting for ${sender} to mark handover ready.`;
    }
    return step.blocked;
  };

  const nextButton = (
    movement: Movement,
    testId: string,
    variant: "pri" | "sec",
    size: "sm" | "md" | "lg",
    describedBy?: string,
    openAfter = false,
  ) => {
    const step = nextStep(movement);
    if (!step) return null;
    return (
      <Button
        variant={step.blocked ? "sec" : variant}
        size={size}
        data-testid={`${testId}-${movement.id}`}
        aria-disabled={step.blocked ? "true" : undefined}
        aria-describedby={step.blocked ? describedBy : undefined}
        title={step.blocked ?? undefined}
        aria-label={`${step.verb}, ${officerPatientName(movement)}`}
        onClick={(event) => {
          event.stopPropagation();
          if (step.blocked) return;
          step.run(movement);
          // Audit round 2, S-15 (phone): after advancing from the Next action card, the job's sheet
          // opens with its next milestone as the pinned primary, so the officer stays on this job.
          if (openAfter) openJob(movement.id);
        }}
      >
        {step.verb}
      </Button>
    );
  };

  const copyHandover = () => {
    const lines = sortedJobs.map((movement) => {
      const transport = movement.transport!;
      const expected = expectedArrival(movement);
      const eta = expected
        ? `${expected.booked ? "est." : "ward ETA"} ${formatSheetMoment(expected.at, dayZero)}${late(movement) ? ", late" : ""}`
        : "no ETA";
      return `${officerPatientName(movement)} (${umrnFor(movement)}): ${originShortFor(movement)} to ${destinationLabelFor(movement)}, ${transportLeg(transport)}, ${transport.provider}${transport.escortRequired ? ", escort" : ""}, ${eta}, ${packRequired(movement) ? `forms ${packCount(movement)} of ${PACK_SLOTS.length}` : "no forms needed"}`;
    });
    const text = [
      `Transport handover ${formatSheetMoment(now, dayZero)}. ${jobs.length} open, ${inCustody} on board, ${crewEnRoute} en route, ${pastEta} past ward ETA.`,
      ...lines,
    ].join("\n");
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard) {
      showToast("Copying is not available in this browser.");
      return;
    }
    clipboard.writeText(text).then(
      () => showToast(`Handover copied, ${jobs.length} open jobs.`),
      () => showToast("Copying is not available in this browser."),
    );
  };

  const openFormModal = (movement: Movement, e: React.MouseEvent<HTMLElement>) => {
    lastTriggerRef.current = e.currentTarget;
    setFormModalJob(movement);
  };

  const closeFormModal = () => {
    setFormModalJob(null);
  };

  // Every open job with a recorded ward ETA or booking estimate. The axis runs from the earlier of
  // now and the first to the later of now and the last, so no window length is invented.
  const arrivals = jobs
    .map((movement) => {
      const expected = expectedArrival(movement);
      return expected ? { movement, eta: expected.at, booked: expected.booked } : undefined;
    })
    .filter((item): item is { movement: Movement; eta: Instant; booked: boolean } => item !== undefined)
    .sort((a, b) => a.eta - b.eta);
  const arrivalsStart = Math.min(now, ...arrivals.map((item) => item.eta));
  const arrivalsEnd = Math.max(now, ...arrivals.map((item) => item.eta));
  const arrivalsSpan = Math.max(arrivalsEnd - arrivalsStart, 1);
  const arrivalsLeft = (at: Instant) => `${((at - arrivalsStart) / arrivalsSpan) * 100}%`;
  const hourTicks: Instant[] = [];
  for (let tick = Math.ceil(arrivalsStart / 60) * 60; tick <= arrivalsEnd; tick += 60) hourTicks.push(tick);
  const upcoming = arrivals.filter((item) => item.eta >= now).length;
  const firstUpcoming = arrivals.findIndex((item) => item.eta >= now);

  const topJob = sortedJobs[0];

  /** Inspect form and Divert: the panel foot on desktop, the end of the sheet body on phone. */
  function detailExtraActions(job: Movement) {
    if (!job.transport) return null;
    return (
      <>
        <Button
          variant="sec"
          size="sm"
          icon={ShieldCheck}
          data-testid={`ward-officer-inspect-form-${job.id}`}
          onClick={(e) => openFormModal(job, e)}
        >
          Inspect form
        </Button>
        {!job.closure &&
        job.transport.collectedAt !== undefined &&
        job.transport.arrivedAt === undefined &&
        job.transport.diversion === undefined ? (
          <Button
            variant="sec"
            size="sm"
            icon={MapPin}
            aria-expanded={diversionOpen}
            data-testid={`ward-officer-divert-${job.id}`}
            onClick={() => setDiversionOpen((open) => !open)}
          >
            Divert
          </Button>
        ) : null}
      </>
    );
  }

  /** v10 phone: the job sheet's four stage buttons, pinned to its foot; the next one is primary and
   * an unavailable one is greyed with its reason (build guide: "the four stage buttons pinned"). */
  function renderPhoneNextStep(movement: Movement) {
    const transport = movement.transport;
    if (!transport || movement.closure) return null;
    const leg = officerLeg(transport);
    const index = leg ? OFFICER_LEG_STEPS.indexOf(leg) : -1;
    if (index < 0) return null;
    const patientName = resolvedPatientName(movement);
    const steps = [
      {
        label: "Accepted",
        testId: "ward-officer-accept",
        run: () => runAccepted(movement),
        blocked: () => acceptedBlockedReason(movement, patientName),
      },
      {
        label: "En route",
        testId: "ward-officer-enroute",
        run: () => runEnRoute(movement),
        blocked: () => enRouteBlockedReason(movement, patientName),
      },
      {
        label: "Collected",
        testId: "ward-officer-collect",
        run: () => runCollected(movement),
        blocked: () => collectedBlockedReason(movement, patientName),
      },
      {
        label: "Delivered",
        testId: "ward-officer-arrive",
        run: () => runDelivered(movement),
        blocked: () => arrivedBlockedReason(movement, unitFor(movement), patientName),
      },
    ];
    // Device audit, 11 Oct 2026: one pinned primary for the next step, not four equal pills; the
    // Steps list above stays the record of what is done.
    const step = steps[index];
    if (!step) return null;
    const blocked = step.blocked();
    return (
      <div className={styles.phStageRow}>
        <Button
          variant="pri"
          size="lg"
          className={styles.phNextStep}
          data-testid={`${step.testId}-${movement.id}`}
          aria-disabled={blocked ? "true" : undefined}
          aria-describedby={blocked ? `${step.testId}-unavailable-${movement.id}` : undefined}
          title={blocked ?? undefined}
          onClick={blocked ? ignoreUnavailableActivation : step.run}
        >
          Mark {step.label.toLowerCase()}
        </Button>
        {/* Audit round 2, S-14: the reason is printed, since a touch user cannot see a title. */}
        {blocked ? (
          <p id={`${step.testId}-unavailable-${movement.id}`} className={styles.nextNote}>
            <Icon icon={Lock} size={14} />
            {blockedNote(movement) ?? blocked}
          </p>
        ) : null}
      </div>
    );
  }

  function renderDetail(movement: Movement) {
    const transport = movement.transport;
    if (!transport) return null;
    const destinationUnit = unitFor(movement);
    const patientName = resolvedPatientName(movement);
    const acceptedBlocked = acceptedBlockedReason(movement, patientName);
    const enRouteBlocked = enRouteBlockedReason(movement, patientName);
    const collectedBlocked = collectedBlockedReason(movement, patientName);
    const arrivedBlocked = arrivedBlockedReason(movement, destinationUnit, patientName);
    const leg = officerLeg(transport);
    const legIndex = leg ? OFFICER_LEG_STEPS.indexOf(leg) : -1;
    const nextBlocked =
      leg === "Requested"
        ? acceptedBlocked
        : leg === "Accepted"
          ? enRouteBlocked
          : leg === "En route"
            ? collectedBlocked
            : leg === "Collected"
              ? arrivedBlocked
              : undefined;
    const arrival = expectedArrival(movement);
    const eta = arrival?.at;
    const canDivert =
      !movement.closure &&
      transport.collectedAt !== undefined &&
      transport.arrivedAt === undefined &&
      transport.diversion === undefined;
    const diversionReady = diversionReason !== undefined && diversionPlace !== undefined;

    const activity: TimelineItem[] = [];
    if (transport.diversion) {
      activity.push({
        id: "diverted",
        at: "Diverted",
        tone: "warning",
        text: `Diverted, ${transport.diversion.reason.toLowerCase()}`,
      });
    }
    if (transport.collectedAt !== undefined) {
      activity.push({
        id: "collected",
        at: formatInstantWithDay(transport.collectedAt, now),
        tone: "success",
        text: `Collected from ${originLabelFor(movement)}`,
      });
    }
    if (transport.enRouteAt !== undefined) {
      activity.push({
        id: "en-route",
        at: formatInstantWithDay(transport.enRouteAt, now),
        tone: "info",
        text: "Crew en route",
      });
    }
    if (transport.acceptedAt !== undefined) {
      activity.push({
        id: "accepted",
        at: formatInstantWithDay(transport.acceptedAt, now),
        tone: "info",
        text: `Accepted by ${transport.provider}`,
      });
    }
    for (const form of [...(movement.uploadedForms ?? [])].reverse()) {
      activity.push({
        id: form.id,
        at: formatInstantWithDay(form.uploadedAt, now),
        tone: "success",
        text: `${form.formName} recorded (${form.fileName})`,
      });
    }

    const step = (index: number, label: string, testId: string, blocked: string | undefined, onRun: () => void) => {
      // Action `index` moves the leg to OFFICER_LEG_STEPS[index + 1]; it is done once the leg is there.
      const done = legIndex >= index + 1;
      const isNext = index === legIndex;
      return (
        <Button
          variant={isNext && !blocked ? "pri" : "sec"}
          className={done ? `${styles.actionButton} ${styles.actionDone}` : styles.actionButton}
          data-testid={`${testId}-${movement.id}`}
          aria-disabled={blocked ? "true" : undefined}
          aria-describedby={blocked ? `${testId}-unavailable-${movement.id}` : undefined}
          title={blocked ?? undefined}
          icon={done ? Check : undefined}
          onClick={blocked ? ignoreUnavailableActivation : onRun}
        >
          {label}
        </Button>
      );
    };

    // v10 phone: the four facts as a 2x2 grid and the leg as a Steps list; the four stage buttons
    // are pinned to the sheet's foot (see the panel foot).
    const roadRoute = referenceDistance(
      edById(movement.originEdId)?.referenceEdId,
      destinationUnit ? siteByCode(destinationUnit.siteCode)?.referenceSiteId : undefined,
    );
    const stepLabels = ["Accepted", "En route", "Collected", "Delivered"] as const;
    const phoneTop = (
      <>
        <dl className={styles.phGrid}>
          <div>
            {/* A booking estimate is the transport provider's, not a time the ward recorded. */}
            <dt>{arrival?.booked ? "Transport ETA" : "Ward ETA"}</dt>
            <dd className={styles.mono}>{eta !== undefined ? formatInstantWithDay(eta, now) : "Not recorded"}</dd>
          </div>
          <div>
            <dt>By road</dt>
            <dd className={styles.mono}>{roadRoute ? `${roadRoute.min} min` : "Not recorded"}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{transport.provider}</dd>
          </div>
          <div>
            <dt>CAD</dt>
            <dd className={styles.mono}>{transport.cadNumber ?? "Not recorded"}</dd>
          </div>
        </dl>
        <section className={styles.phCard} aria-label="Steps">
          <h3 className={styles.phCardHead}>
            Steps <span className={styles.mono}>{Math.max(0, legIndex)} of 4</span>
          </h3>
          <ol className={styles.phSteps}>
            {stepLabels.map((label, index) => {
              const done = legIndex >= index + 1;
              const current = index === legIndex;
              return (
                <li key={label} className={styles.phStep} data-state={done ? "done" : current ? "now" : undefined}>
                  <StatusGlyph tone={done ? "success" : current ? "info" : "neutral"} size={10} />
                  <span className={styles.phStepText}>
                    <span className={styles.phStepTitle}>{label}</span>
                  </span>
                  {done ? <span className={styles.phStepDone}>Done</span> : null}
                </li>
              );
            })}
          </ol>
        </section>
      </>
    );

    return (
      <>
        {isPhone ? phoneTop : null}
        {isPhone ? null : (
          <div className={styles.route}>
            <div className={styles.routeLeg}>
              <StatusGlyph tone="neutral" size={9} />
              <span className={styles.routePlace}>{originLabelFor(movement)}</span>
              <span className={styles.routeTime}>
                {transport.collectedAt !== undefined
                  ? `Left ${formatInstantWithDay(transport.collectedAt, now)}`
                  : null}
              </span>
            </div>
            <div className={styles.routeLeg}>
              <StatusGlyph tone="info" size={9} />
              <span className={styles.routePlace}>{destinationLabelFor(movement)}</span>
              <span className={styles.routeTime}>
                {eta !== undefined ? (
                  <>
                    {formatInstantWithDay(eta, now)} <span>{transportEtaRemainingLabel(eta, now)}</span>
                  </>
                ) : (
                  "No ETA recorded"
                )}
              </span>
            </div>
          </div>
        )}

        {isPhone ? null : (
          <div className={styles.actionRow}>
            {step(0, "Accepted", "ward-officer-accept", acceptedBlocked, () => runAccepted(movement))}
            {step(1, "En route", "ward-officer-enroute", enRouteBlocked, () => runEnRoute(movement))}
            {step(2, "Collected", "ward-officer-collect", collectedBlocked, () => runCollected(movement))}
            {step(3, "Delivered", "ward-officer-arrive", arrivedBlocked, () => runDelivered(movement))}
          </div>
        )}
        {nextBlocked && !isPhone ? (
          <p className={styles.nextNote}>
            <Icon icon={Lock} size={14} />
            {nextBlocked}
          </p>
        ) : null}
        {/* Audit round 2, A4-14: on phone only the pinned next step is a button, and it prints its
            own reason, so these reasons for done and future steps are desktop only. */}
        {acceptedBlocked && !isPhone ? (
          <span id={`ward-officer-accept-unavailable-${movement.id}`} className="sr-only">
            {acceptedBlocked}
          </span>
        ) : null}
        {enRouteBlocked && !isPhone ? (
          <span id={`ward-officer-enroute-unavailable-${movement.id}`} className="sr-only">
            {enRouteBlocked}
          </span>
        ) : null}
        {collectedBlocked && !isPhone ? (
          <span id={`ward-officer-collect-unavailable-${movement.id}`} className="sr-only">
            {collectedBlocked}
          </span>
        ) : null}
        {arrivedBlocked && !isPhone ? (
          <span id={`ward-officer-arrive-unavailable-${movement.id}`} className="sr-only">
            {arrivedBlocked}
          </span>
        ) : null}

        {pastWardEta(movement, now) && movement.arrivalDetails ? (
          <div
            className={styles.overdue}
            role="alert"
            data-testid={`ward-officer-overdue-alert-${movement.id}`}
            title={OPERATIONAL_DEFAULT_LABEL}
          >
            <StatusGlyph tone="warning" size={9} />
            <span>
              <strong>Arrival overdue.</strong> More than {LATE_ARRIVAL_GRACE_MINUTES}m past the ward ETA (
              {formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} AWST). Notification is not
              recorded here.
            </span>
          </div>
        ) : null}

        {packRequired(movement) ? (
          <FormsPack movement={movement} now={now} who={officerPatientName(movement)} />
        ) : (
          <section className={styles.section} aria-label="Forms">
            <h3 className={styles.sectionTitle}>Forms</h3>
            <span className={styles.muted}>None needed for a voluntary transfer.</span>
          </section>
        )}

        <section className={styles.section} aria-label="Booking">
          <h3 className={styles.sectionTitle}>Booking</h3>
          <dl className={styles.facts}>
            {isPhone ? null : (
              <>
                <div>
                  <dt>Provider</dt>
                  <dd>{transport.provider}</dd>
                </div>
                <div data-testid={`ward-officer-cad-number-${movement.id}`}>
                  <dt>CAD (dispatch) number</dt>
                  <dd>{cadNumberLabel(transport)}</dd>
                </div>
              </>
            )}
            <div data-testid={`ward-officer-transport-legal-status-${movement.id}`}>
              <dt>Transport logged as</dt>
              <dd>
                {transportStatusClashes(movement, transport.transportLegalStatus) ? (
                  <StatusGlyph tone="warning" size={9} />
                ) : null}
                {transportLegalStatusLabel(transport)}
                {transportStatusClashes(movement, transport.transportLegalStatus)
                  ? `, Legal now ${legalNowText(movement)}`
                  : null}
              </dd>
            </div>
            <div>
              <dt>Escort required</dt>
              <dd>{transport.escortRequired ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Form named at booking</dt>
              <dd>{formRequiredLabel(transport)}</dd>
            </div>
            <div data-testid={`ward-officer-estimated-at-${movement.id}`}>
              <dt>Estimated time</dt>
              <dd>{estimatedTimeLabel(transport, now)}</dd>
            </div>
            {/* Audit A4-2: the officer sees when the bed hold ends, and whether the ETA is after it. */}
            {movement.pullExpiresAt !== undefined && transport.collectedAt === undefined ? (
              <div data-testid={`ward-officer-hold-ends-${movement.id}`}>
                <dt>Bed held until</dt>
                <dd>
                  {holdEndsBeforeEta(movement, transport.estimatedAt) !== undefined ? (
                    <StatusGlyph tone="warning" size={9} />
                  ) : null}
                  {formatInstantWithDay(movement.pullExpiresAt, now)}
                  {holdEndsBeforeEta(movement, transport.estimatedAt) !== undefined ? ", before the ETA" : null}
                </dd>
              </div>
            ) : null}
            {(transport.exceptions ?? []).map((exception) => (
              <div key={`${exception.step}-${exception.at}`} data-testid={`ward-officer-exception-${movement.id}`}>
                <dt>
                  {exception.step === "collected" ? "Collected" : "Booked"} {formatInstantWithDay(exception.at, now)}{" "}
                  with
                </dt>
                <dd>{transportExceptionText(exception)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {movement.arrivalDetails ? (
          <section className={styles.section} aria-label="Arrival plan">
            <h3 className={styles.sectionTitle}>Arrival plan</h3>
            <dl className={styles.planGrid} data-testid={`ward-officer-arrival-details-${movement.id}`}>
              <div>
                <dt>Ward ETA</dt>
                <dd>{formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} AWST</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{movement.arrivalDetails.mode}</dd>
              </div>
              <div title={OPERATIONAL_DEFAULT_LABEL}>
                <dt>Late after</dt>
                <dd>
                  {formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES, now)}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        {transport.diversion ? (
          <p className={styles.diverted} data-testid={`ward-officer-diverted-${movement.id}`}>
            <StatusGlyph tone="warning" size={9} />
            Diverted — {transport.diversion.reason}. Where they are: {transport.diversion.place}.
          </p>
        ) : null}

        {canDivert && diversionOpen ? (
          <section className={styles.section} aria-label="Record a diversion">
            <h3 className={styles.sectionTitle}>Why divert</h3>
            <div className={styles.divertForm} data-testid={`ward-officer-diversion-${movement.id}`}>
              <label htmlFor={`ward-officer-diversion-reason-${movement.id}`}>Why was the journey diverted?</label>
              <Select
                id={`ward-officer-diversion-reason-${movement.id}`}
                data-testid={`ward-officer-diversion-reason-${movement.id}`}
                value={diversionReason ?? ""}
                onChange={(chosen) => {
                  const value = chosen.target.value;
                  setDiversionReason(
                    DIVERSION_REASONS.includes(value as DiversionReason) ? (value as DiversionReason) : undefined,
                  );
                }}
              >
                <option value="">Choose a reason…</option>
                {DIVERSION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </Select>
              <label htmlFor={`ward-officer-diversion-place-${movement.id}`}>Where is the patient now?</label>
              <Select
                id={`ward-officer-diversion-place-${movement.id}`}
                data-testid={`ward-officer-diversion-place-${movement.id}`}
                value={diversionPlace ?? ""}
                onChange={(chosen) => {
                  const value = chosen.target.value;
                  setDiversionPlace(
                    TRANSPORT_WHEREABOUTS.includes(value as TransportWhereabouts)
                      ? (value as TransportWhereabouts)
                      : undefined,
                  );
                }}
              >
                <option value="">Choose a place…</option>
                {TRANSPORT_WHEREABOUTS.map((place) => (
                  <option key={place} value={place}>
                    {place}
                  </option>
                ))}
              </Select>
              <span className={styles.divertActions}>
                <Button variant="ghost" size="sm" onClick={() => setDiversionOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="pri"
                  size="sm"
                  data-testid={`ward-officer-record-diversion-${movement.id}`}
                  aria-disabled={diversionReady ? undefined : "true"}
                  aria-describedby={diversionReady ? undefined : `ward-officer-diversion-blocked-${movement.id}`}
                  title={diversionReady ? undefined : "Choose a reason and where the patient is first."}
                  onClick={
                    diversionReady
                      ? () => {
                          dispatch({
                            type: "RECORD_DIVERSION",
                            role: "officer",
                            now,
                            movementId: movement.id,
                            reason: diversionReason,
                            place: diversionPlace,
                          });
                          setDiversionReason(undefined);
                          setDiversionPlace(undefined);
                          setDiversionOpen(false);
                          // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                          showToast(`Diversion recorded for ${officerPatientName(movement)}.`);
                        }
                      : ignoreUnavailableActivation
                  }
                >
                  Record diversion
                </Button>
              </span>
              {diversionReady ? null : (
                <span id={`ward-officer-diversion-blocked-${movement.id}`} className="sr-only">
                  Choose a reason and where the patient is first.
                </span>
              )}
            </div>
          </section>
        ) : null}

        {activity.length > 0 ? (
          <section className={styles.section} aria-label="Activity">
            <h3 className={styles.sectionTitle}>Activity</h3>
            <Timeline items={activity} holdNew={false} label={`Activity for ${officerPatientName(movement)}`} />
          </section>
        ) : null}
      </>
    );
  }

  // Larger screen: the shared hero chip every other page uses (site review U5). Phone keeps its own
  // v10 design of three plain figures, so it stays on `HeroStat` and its phone styles.
  const pillStat = (which: HighlightPill, value: number, label: string, short: string, tone?: WfTone) =>
    isPhone ? (
      <HeroStat
        className={cx(styles.heroPill, PHONE_PILLS.includes(which) ? undefined : styles.deskOnly)}
        value={value}
        label={
          <>
            <span className={styles.longLabel}>{label}</span>
            <span className={styles.shortLabel}>{short}</span>
          </>
        }
        tone={tone}
        pressed={pill === which}
        onToggle={() => setPill((current) => (current === which ? null : which))}
      />
    ) : (
      <HeroChip
        key={which}
        value={value}
        label={label}
        tone={tone}
        pressed={pill === which}
        onPress={() => setPill((current) => (current === which ? null : which))}
      />
    );

  const heroPillStats = (
    <>
      {pillStat("requested", awaitingDeparture, "To accept", "To accept", "neutral")}
      {pillStat("accepted", crewToSend, "Crew to send", "To send", "neutral")}
      {pillStat("en_route", crewEnRoute, "Crew en route", "En route", "info")}
      {pillStat("collected", inCustody, "On board", "On board", "info")}
      {pillStat("late", pastEta, "Past ward ETA", "Late", pastEta > 0 ? "warning" : "neutral")}
      {/* F-23 (phone review, Oct 2026): outstanding forms take the warning glyph on phone, not the
          grey circle "0 Late" shows. A warning only: En route is never blocked. */}
      {pillStat(
        "forms",
        formsOutstanding,
        "Jobs need forms",
        "Need forms",
        isPhone && formsOutstanding > 0 ? "warning" : "neutral",
      )}
    </>
  );

  // Hero tools: beside the title on the larger screen, under the figures on phone (v10).
  const heroTools = (
    <div className={styles.heroTools}>
      {nextArrival ? (
        <span className={styles.nextArrival} title="Next expected arrival">
          <Icon icon={Clock} size={14} />
          Next <b>{formatInstantWithDay(nextArrival.at, now)}</b>
          <span className={styles.nextArrivalPlace}>{destinationLabelFor(nextArrival.movement)}</span>
        </span>
      ) : null}
      <Button
        variant="onHero"
        size="sm"
        icon={Copy}
        className={styles.copyButton}
        onClick={copyHandover}
        aria-label="Copy handover"
        title="Copy a plain text summary of open jobs"
      >
        <span className={styles.longLabel}>Copy handover</span>
      </Button>
      {/* Phone (v10): Arrivals jumps to the arrivals list below the jobs. */}
      {isPhone && upcoming > 0 ? (
        <Button
          variant="onHero"
          size="sm"
          icon={Clock}
          className={styles.phArrivalsButton}
          onClick={() =>
            document
              .getElementById("ward-officer-arrivals-heading")
              ?.scrollIntoView({ block: "start", behavior: wardScrollBehavior() })
          }
        >
          Arrivals <span className={styles.phArrivalsCount}>{upcoming}</span>
        </Button>
      ) : null}
      <NotWiredButton variant="onHero" size="sm" icon={Truck} label="Log booking" wrapClassName={styles.deskOnly} />
    </div>
  );

  const panelOpen = selectedJob !== undefined && selectedJob.transport !== undefined;
  const anyJobEta = jobs.some((movement) => expectedArrival(movement) !== undefined);
  // Site review 12 Oct 2026: a column that says the same thing on every row ("0 of 3" thirteen
  // times) says nothing; the hero's "Jobs need forms" and the job sheet still carry the count.
  const formsVary =
    jobs.length < 2 || new Set(jobs.map((movement) => (packRequired(movement) ? packCount(movement) : -1))).size > 1;
  useWardModalFocus(isPhone && panelOpen, sideRef, closeJob);

  return (
    <div className={styles.screen} data-testid="ward-officer-screen" data-ward-design="v8">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          className={styles.dispatchHero}
          eyebrow="Transport dispatch"
          // S-17 (audit 13 Oct 2026): the on-board figure is a part of the jobs count, so it says so.
          title={`${inCustody} of ${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} on board`}
          aside={isPhone ? <LiveChip state="live" onHero /> : heroTools}
          barAside={isPhone ? heroTools : undefined}
          bar={
            isPhone ? (
              <div className={styles.heroPills} role="group" aria-label="Highlight jobs">
                {heroPillStats}
              </div>
            ) : (
              <HeroChips label="Highlight jobs">{heroPillStats}</HeroChips>
            )
          }
          foot={
            <div className={styles.fleetPanel} role="group" aria-label="Highlight jobs by provider">
              <span className={styles.fleetLabel}>Providers</span>
              {TRANSPORT_PROVIDERS.filter((provider) =>
                jobs.some((movement) => movement.transport?.provider === provider),
              ).map((provider) => {
                const providerJobs = jobs.filter((movement) => movement.transport?.provider === provider);
                const moving = providerJobs.filter((movement) => {
                  const leg = transportLeg(movement.transport);
                  return leg === "En route" || leg === "Collected";
                }).length;
                const waiting = providerJobs.length - moving;
                const isSelected = providerHighlight === provider;
                return (
                  <button
                    key={provider}
                    type="button"
                    className={styles.fleetButton}
                    onClick={() => setProviderHighlight((prev) => (prev === provider ? null : provider))}
                    title={isSelected ? "Stop highlighting this provider" : `Highlight ${provider} jobs`}
                    aria-pressed={isSelected}
                  >
                    <span className={styles.fleetName}>{provider.replace(/ service$/, "")}</span>
                    <SrOnly>{provider.endsWith(" service") ? " service" : ""}</SrOnly>
                    <span className={styles.fleetCounts}>
                      {moving} moving, {waiting} waiting
                    </span>
                  </button>
                );
              })}
            </div>
          }
        />

        {cancellations.length > 0 ? (
          <section
            className={styles.nextCard}
            aria-label="Cancelled transport"
            data-testid="officer-cancellation-notices"
          >
            <h2 className={styles.eyebrow}>Cancelled transport</h2>
            <ul>
              {cancellations.map((notice) => (
                <li key={notice.id}>{notice.sentence}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {topJob && topJob.transport ? (
          <Card className={styles.nextCard} aria-label="Next action">
            <div className={styles.nextCardHead}>
              <span className={styles.eyebrow}>Next action</span>
              <span className={styles.nextCardStage}>
                <StatusGlyph tone={LEG_TONE[officerLeg(topJob.transport) ?? "Requested"]} size={9} />
                {transportLeg(topJob.transport)}
              </span>
            </div>
            <strong className={styles.nextCardName}>{officerPatientName(topJob)}</strong>
            <span className={styles.nextCardLine}>
              <span className={styles.mono}>{umrnFor(topJob)}</span> · {originShortFor(topJob)} to{" "}
              {destinationLabelFor(topJob)}
            </span>
            {late(topJob) && topJob.arrivalDetails ? (
              <span className={cx(styles.nextCardLine, styles.warnText)}>
                <StatusGlyph tone="warning" size={9} /> Past ward ETA{" "}
                {formatInstantWithDay(topJob.arrivalDetails.estimatedArrivalAt, now)}
              </span>
            ) : packOutstanding(topJob) ? (
              <span className={cx(styles.nextCardLine, styles.warnText)}>
                <StatusGlyph tone="warning" size={9} /> {PACK_SLOTS.length - packCount(topJob)} of {PACK_SLOTS.length}{" "}
                forms still to upload
              </span>
            ) : null}
            <div className={styles.nextCardActions}>
              <Button variant="sec" size="lg" onClick={() => openJob(topJob.id)}>
                Open
              </Button>
              {nextButton(
                topJob,
                "ward-officer-nextcard",
                "pri",
                "lg",
                isPhone ? `ward-officer-nextcard-unavailable-${topJob.id}` : undefined,
                isPhone,
              )}
            </div>
            {isPhone && blockedNote(topJob) ? (
              <p id={`ward-officer-nextcard-unavailable-${topJob.id}`} className={styles.nextNote}>
                <Icon icon={Lock} size={14} />
                {blockedNote(topJob)}
              </p>
            ) : null}
          </Card>
        ) : null}

        {isPhone ? (
          <div className={styles.phProviders} role="group" aria-label="Highlight jobs by provider">
            {/* Zero providers are hidden (device audit, 11 Oct 2026): "0 Ambulance" took the row
                and pushed a real one off screen. */}
            {TRANSPORT_PROVIDERS.filter((provider) =>
              jobs.some((movement) => movement.transport?.provider === provider),
            ).map((provider) => {
              const isSelected = providerHighlight === provider;
              return (
                <button
                  key={provider}
                  type="button"
                  className={styles.phProvider}
                  onClick={() => setProviderHighlight((prev) => (prev === provider ? null : provider))}
                  title={isSelected ? "Stop highlighting this provider" : `Highlight ${provider} jobs`}
                  aria-pressed={isSelected}
                >
                  <span className={styles.phProviderCount}>
                    {jobs.filter((movement) => movement.transport?.provider === provider).length}
                  </span>
                  {provider.replace(/ service$/, "")}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className={styles.layout} data-open={panelOpen ? "true" : undefined}>
          <div className={styles.leftColumn}>
            <Card className={styles.jobsPanel} aria-label="Jobs">
              <div className={styles.tabsRow}>
                <Tabs
                  label="Job lists"
                  idPrefix="ward-officer-jobs"
                  value={jobsTab}
                  onChange={setJobsTab}
                  items={[
                    { id: "jobs", label: "Jobs", count: jobs.length },
                    {
                      id: "history",
                      label: "History",
                      count: deliveredToday.length + officerRefusals.length + cancelledTransports.length,
                    },
                  ]}
                />
                <span className={styles.headNote}>
                  {panelOpen ? "Highlights never hide a job" : "Choose a patient to open their job"}
                </span>
              </div>

              <TabPanel idPrefix="ward-officer-jobs" id="jobs" hidden={jobsTab !== "jobs"}>
                <div className={styles.toolbar} role="search" aria-label="Find transport jobs">
                  <TextInput
                    ref={searchInputRef}
                    icon={Search}
                    boxClassName={styles.searchBox}
                    id="officer-transfer-search"
                    name="transferSearch"
                    placeholder="Patient, UMRN, ED, ward or CAD"
                    aria-label="Highlight transport jobs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery("")}
                    trailing={searchQuery ? undefined : <Kbd>/</Kbd>}
                  />
                  <FilterChip
                    pressed={escortHighlight}
                    onPressedChange={setEscortHighlight}
                    count={jobs.filter((job) => job.transport?.escortRequired).length}
                  >
                    Escort
                  </FilterChip>
                  <FilterChip
                    pressed={involuntaryHighlight}
                    onPressedChange={setInvoluntaryHighlight}
                    count={jobs.filter((job) => job.transport?.transportLegalStatus === "involuntary").length}
                  >
                    Involuntary
                  </FilterChip>
                  {anyHighlight ? (
                    <span className={styles.highlightNote}>
                      <span aria-hidden="true">{highlightedCount} highlighted</span>
                      <span className="sr-only" role="status">
                        {highlightedCount} synthetic rows highlighted
                      </span>
                      <Button variant="ghost" size="sm" onClick={clearHighlights}>
                        Clear
                      </Button>
                    </span>
                  ) : null}
                  <span className={styles.toolbarSpacer} />
                  <span className={styles.sortLabel}>Sort</span>
                  <Segmented
                    className={styles.sortControl}
                    label="Sort jobs"
                    value={sortKey}
                    onChange={setSortKey}
                    items={[
                      { id: "next", label: "Next action" },
                      { id: "wait", label: "Longest wait" },
                      ...(anyJobEta ? [{ id: "eta" as const, label: "ETA" }] : []),
                    ]}
                  />
                </div>

                {jobs.length === 0 ? (
                  <p className={styles.placeholder} data-testid="ward-officer-empty">
                    No transport job is currently outstanding &mdash; every job has either arrived or its movement has
                    closed.
                  </p>
                ) : (
                  <div className={styles.tableScroll}>
                    <table
                      className={`${tableClasses.table} ${styles.jobsTable}`}
                      aria-label="Outstanding transport jobs"
                    >
                      <thead>
                        <tr>
                          <th scope="col">Patient</th>
                          <th scope="col">Route</th>
                          <th scope="col">Stage</th>
                          <th scope="col" className={formsVary ? undefined : styles.etaOff}>
                            Forms
                          </th>
                          {/* Device audit, 11 Oct 2026: the ETA column shows only when a job has one;
                              thirteen rows of "No ETA" said nothing. */}
                          <th scope="col" className={anyJobEta ? undefined : styles.etaOff}>
                            ETA
                          </th>
                          <th scope="col" className={tableClasses.num}>
                            Next
                          </th>
                        </tr>
                      </thead>
                      <tbody data-testid="ward-officer-joblist">
                        {sortedJobs.map((movement) => {
                          const transport = movement.transport;
                          if (!transport) return null;
                          const active = movement.id === selectedJob?.id;
                          const lit = anyHighlight && isHighlighted(movement);
                          const leg = officerLeg(transport);
                          const legIndex = leg ? OFFICER_LEG_STEPS.indexOf(leg) : -1;
                          const step = nextStep(movement);
                          const stepStatusText = leg
                            ? step?.blocked
                              ? `blocked before ${nextActionVerb(leg).toLowerCase()}`
                              : `next ${nextActionVerb(leg).toLowerCase()}`
                            : undefined;
                          const since = stageStartedAt(movement);
                          const expected = expectedArrival(movement);
                          const isLate = late(movement);
                          const forms = packCount(movement);
                          return (
                            <tr
                              key={movement.id}
                              data-testid={`ward-officer-job-${movement.id}`}
                              data-highlight={lit ? "true" : undefined}
                              className={active ? `${tableClasses.selected} ${styles.jobRow}` : styles.jobRow}
                              aria-selected={active}
                            >
                              <td>
                                <button
                                  type="button"
                                  className={styles.selectButton}
                                  data-testid={`ward-officer-select-${movement.id}`}
                                  aria-current={active ? "true" : undefined}
                                  aria-expanded={active}
                                  onClick={() => selectJob(movement.id)}
                                >
                                  {/* Josh, 25 Sept 2026: the transport officer sees the patient's name. Same
                                      resolver as the Referral board; "Not recorded" when no single patient is
                                      linked, never a guess. */}
                                  <strong
                                    className={styles.jobName}
                                    data-testid={`ward-officer-patient-${movement.id}`}
                                  >
                                    {officerPatientName(movement)}
                                  </strong>
                                  {isPhone && transport.escortRequired ? (
                                    <ShieldCheck size={14} className={styles.phEscort} aria-label="Escort required" />
                                  ) : null}
                                  <span className={styles.jobUmrn}>{umrnFor(movement)}</span>
                                </button>
                              </td>
                              <td>
                                {isPhone ? (
                                  // Phone (v10): from first, as the mockup's "ARM to ward" line reads.
                                  <span className={styles.jobRoute}>
                                    <b>{originShortFor(movement)}</b> to {destinationLabelFor(movement)}
                                  </span>
                                ) : (
                                  <span className={styles.jobRoute}>
                                    <span className={styles.jobRouteTo}>{destinationLabelFor(movement)}</span>
                                    <span className={styles.jobRouteFrom}> from {originShortFor(movement)}</span>
                                  </span>
                                )}
                                <span className={styles.jobMeta}>
                                  {transport.provider.replace(/ service$/, "")}
                                  {transport.escortRequired ? " · escort" : ""}
                                  {transport.transportLegalStatus === "voluntary" ? " · voluntary" : ""}
                                </span>
                                {transport.escortRequired ? <span className={styles.jobEscort}>Escort</span> : null}
                              </td>
                              <td>
                                {leg && stepStatusText ? (
                                  <span className={styles.stageCell}>
                                    <span
                                      className={styles.stepper}
                                      role="img"
                                      aria-label={`Transport stage: ${leg}, ${stepStatusText}`}
                                      data-testid={`ward-officer-stepper-${movement.id}`}
                                    >
                                      {OFFICER_LEG_STEPS.map((stepName, index) => (
                                        <span
                                          key={stepName}
                                          className={styles.stageDot}
                                          data-s={index < legIndex ? "done" : index === legIndex ? "now" : "todo"}
                                        />
                                      ))}
                                    </span>
                                    <p className={styles.stageLine}>
                                      <strong>{leg}</strong>
                                      <SrOnly>, {stepStatusText}</SrOnly>
                                    </p>
                                    {since !== undefined ? (
                                      <span className={styles.stageFor}>{durMinutes(Math.max(0, now - since))}</span>
                                    ) : null}
                                  </span>
                                ) : (
                                  transportLeg(transport)
                                )}
                              </td>
                              <td className={formsVary ? undefined : styles.etaOff}>
                                {!packRequired(movement) ? (
                                  <span className={styles.muted}>Not needed</span>
                                ) : (
                                  <span
                                    className={styles.formsCell}
                                    title={`${forms} of ${PACK_SLOTS.length} forms recorded`}
                                  >
                                    <span className={styles.formDots} aria-hidden="true">
                                      {PACK_SLOTS.map((slot) => (
                                        <StatusGlyph
                                          key={slot.key}
                                          tone={packForm(movement, slot.key) ? "success" : "neutral"}
                                          size={9}
                                        />
                                      ))}
                                    </span>
                                    <span data-complete={forms === PACK_SLOTS.length ? "true" : undefined}>
                                      {forms} of {PACK_SLOTS.length}
                                    </span>
                                  </span>
                                )}
                              </td>
                              <td className={anyJobEta ? undefined : styles.etaOff}>
                                {expected ? (
                                  <span className={styles.etaCell}>
                                    {isLate ? <StatusGlyph tone="warning" size={9} /> : null}
                                    <b>{formatInstantWithDay(expected.at, now)}</b>
                                    <span className={isLate ? styles.warnText : styles.etaNote}>
                                      {isLate
                                        ? `${durMinutes(Math.max(0, now - expected.at))} late`
                                        : expected.booked
                                          ? "est."
                                          : transportEtaRemainingLabel(expected.at, now)}
                                    </span>
                                  </span>
                                ) : (
                                  <span className={styles.etaNote}>No ETA</span>
                                )}
                              </td>
                              <td className={tableClasses.num}>
                                {nextButton(movement, "ward-officer-next", "sec", "sm")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabPanel>

              <TabPanel idPrefix="ward-officer-jobs" id="history" hidden={jobsTab !== "history"}>
                <div className={styles.historyHead}>
                  <span className={styles.muted}>Today, closed records</span>
                  <Tabs
                    label="History lists"
                    idPrefix="ward-officer-history"
                    value={historyTab}
                    onChange={setHistoryTab}
                    items={[
                      { id: "delivered", label: "Delivered today", count: deliveredToday.length },
                      { id: "refused", label: "Refused", count: officerRefusals.length },
                      { id: "cancelled", label: "Cancelled", count: cancelledTransports.length },
                    ]}
                  />
                </div>
                <TabPanel idPrefix="ward-officer-history" id="delivered" hidden={historyTab !== "delivered"}>
                  {deliveredToday.length > 0 ? (
                    <ul className={styles.plainList} data-testid="ward-officer-delivered">
                      {deliveredToday.map((movement) => (
                        <li key={movement.id} className={styles.plainItem}>
                          <StatusGlyph tone="success" size={9} />
                          <span>
                            <span className={styles.mono}>
                              {formatInstantWithDay(movement.transport!.arrivedAt!, now)}
                            </span>{" "}
                            <strong>{officerPatientName(movement)}</strong>{" "}
                            <span className={styles.mono}>{umrnFor(movement)}</span> · {destinationLabelFor(movement)}{" "}
                            <span className={styles.muted}>({movement.transport!.provider})</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={styles.filterEmpty}>
                      <EmptyState icon={Check} title="Nothing delivered yet today." />
                    </div>
                  )}
                </TabPanel>
                <TabPanel idPrefix="ward-officer-history" id="refused" hidden={historyTab !== "refused"}>
                  {officerRefusals.length > 0 ? (
                    <section className={styles.refusals} aria-label="Refused" data-testid="ward-officer-refusals">
                      <div className={styles.panelBody} role="region" aria-label="Refused list" tabIndex={0}>
                        <ul className={styles.plainList}>
                          {officerRefusals.map((rejection) => (
                            <li key={rejection.id} className={styles.plainItem}>
                              <Icon icon={X} size={14} />
                              <span>
                                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                                <strong>{patientNameForMovementId(rejection.movementId)}</strong> &mdash;{" "}
                                {OFFICER_ACTION_REJECTION_LABELS[rejection.attempted]} was refused: {rejection.reason}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className={styles.panelNote}>Recorded refusals remain visible for this session.</p>
                    </section>
                  ) : (
                    <div className={styles.filterEmpty}>
                      <EmptyState icon={Check} title="No action has been refused this session." />
                    </div>
                  )}
                </TabPanel>
                <TabPanel idPrefix="ward-officer-history" id="cancelled" hidden={historyTab !== "cancelled"}>
                  {cancelledTransports.length > 0 ? (
                    <section
                      className={styles.cancelledSection}
                      aria-label="Cancelled"
                      data-testid="ward-officer-cancelled-transports"
                    >
                      <div className={styles.panelBody} role="region" aria-label="Cancelled list" tabIndex={0}>
                        <ul className={styles.plainList}>
                          {cancelledTransports.map((item, idx) => (
                            <li key={`${item.movementId}-${idx}`} className={styles.plainItem}>
                              <StatusGlyph tone="closed" size={9} />
                              <span>
                                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                                <strong>{item.patientName}</strong> &mdash; stand-down, CAD (dispatch) number:{" "}
                                <code>{item.cadNumber}</code> <span className={styles.muted}>({item.note})</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className={styles.panelNote}>
                        Cancelled dispatches and ambulance stand-downs for this session.
                      </p>
                    </section>
                  ) : (
                    <div className={styles.filterEmpty}>
                      <EmptyState icon={Check} title="No transport has been cancelled this session." />
                    </div>
                  )}
                </TabPanel>
              </TabPanel>
            </Card>

            {/* An empty Arrivals card ("0 still to come") is hidden (device audit, 11 Oct 2026). */}
            <Card
              className={styles.arrivalsCard}
              aria-labelledby="ward-officer-arrivals-heading"
              hidden={arrivals.length === 0}
            >
              <CardHead
                id="ward-officer-arrivals-heading"
                title="Arrivals"
                icon={undefined}
                meta={`${upcoming} still to come`}
                aside={<span className={styles.headNote}>Ward ETA first, else booking estimate</span>}
              />
              <CardBody>
                {arrivals.length === 0 ? (
                  <EmptyState
                    icon={MapPin}
                    title="No open job carries a recorded ward ETA."
                    meta="An ETA appears here once it is recorded at booking or on the arrival plan."
                  />
                ) : (
                  <div className={styles.arrivals}>
                    <div className={styles.arrivalsAxis} aria-hidden="true">
                      {hourTicks.map((tick) => (
                        <span key={tick} className={styles.tick} style={{ left: arrivalsLeft(tick) }}>
                          {formatInstantWithDay(tick, now)}
                        </span>
                      ))}
                      <span className={styles.nowLine} style={{ left: arrivalsLeft(now) }} />
                    </div>
                    <ul className={styles.arrivalsList}>
                      {arrivals.map(({ movement, eta, booked }, index) => {
                        // Only a ward ETA can make a job late; a booking estimate says it is one.
                        const isLate = pastWardEta(movement, now);
                        return (
                          <li
                            key={movement.id}
                            className={styles.arrivalRow}
                            data-now-before={index === firstUpcoming ? "true" : undefined}
                          >
                            {index === firstUpcoming ? (
                              <span className={styles.arrivalNow} aria-hidden="true">
                                Now {formatInstantWithDay(now, now)}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className={styles.arrivalWho}
                              aria-label={`Open the job for ${officerPatientName(movement)}`}
                              onClick={() => openJob(movement.id)}
                            >
                              <b className={styles.arrivalTime}>{formatInstantWithDay(eta, now)}</b>
                              <StatusGlyph tone={isLate ? "warning" : booked ? "neutral" : "info"} size={9} />
                              <strong>{destinationLabelFor(movement)}</strong>
                              <span>
                                {officerPatientName(movement)} · {umrnFor(movement)}
                              </span>
                              <span className={cx(styles.arrivalKind, isLate && styles.warnText)}>
                                {isLate ? "Late" : booked ? "Est." : "Ward ETA"}
                              </span>
                            </button>
                            <span className={styles.arrivalTrack}>
                              <span className={styles.arrivalMark} style={{ left: arrivalsLeft(eta) }}>
                                <StatusGlyph tone={isLate ? "warning" : booked ? "neutral" : "info"} size={9} />
                                <b>{formatInstantWithDay(eta, now)}</b>
                                <span className={isLate ? styles.warnText : undefined}>
                                  {isLate
                                    ? "Late"
                                    : booked
                                      ? `Booking estimate · ${transportEtaRemainingLabel(eta, now)}`
                                      : transportEtaRemainingLabel(eta, now)}
                                </span>
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {panelOpen && selectedJob && selectedJob.transport ? (
            <>
              <div ref={sideRef} className={styles.side}>
                <div className={styles.scrim} aria-hidden="true" onClick={closeJob} />
                <Card
                  className={styles.detail}
                  role={isPhone ? "dialog" : undefined}
                  aria-modal={isPhone ? true : undefined}
                  aria-labelledby="ward-officer-detail-heading"
                  data-testid="ward-officer-detail"
                >
                  <span className={styles.grab} aria-hidden="true" />
                  <CardHead
                    id="ward-officer-detail-heading"
                    className={styles.detailHead}
                    title={officerPatientName(selectedJob)}
                    meta={
                      <>
                        <span className={styles.mono}>{umrnFor(selectedJob)}</span>
                        {isPhone ? (
                          <>
                            {"\u00a0· "}
                            {originShortFor(selectedJob)} to {destinationLabelFor(selectedJob)}
                            {selectedJob.transport.escortRequired ? "\u00a0· Escort" : ""}
                          </>
                        ) : (
                          <>
                            {" · "}
                            {transportLegalStatusLabel(selectedJob.transport)}
                            {selectedJob.transport.escortRequired ? " · Escort" : ""}
                          </>
                        )}
                      </>
                    }
                    aside={
                      <>
                        <Badge
                          tone={
                            officerLeg(selectedJob.transport) ? LEG_TONE[officerLeg(selectedJob.transport)!] : "neutral"
                          }
                        >
                          {transportLeg(selectedJob.transport)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={X}
                          onClick={closeJob}
                          aria-label="Close job panel"
                          data-testid="ward-officer-detail-close"
                        />
                      </>
                    }
                  />
                  <CardBody className={styles.detailBody}>
                    {renderDetail(selectedJob)}
                    {isPhone ? <div className={styles.phMoreActions}>{detailExtraActions(selectedJob)}</div> : null}
                  </CardBody>
                  {isPhone ? (
                    renderPhoneNextStep(selectedJob) ? (
                      <CardFoot className={styles.detailFooter}>{renderPhoneNextStep(selectedJob)}</CardFoot>
                    ) : null
                  ) : (
                    <CardFoot className={styles.inactiveRow}>{detailExtraActions(selectedJob)}</CardFoot>
                  )}
                </Card>
              </div>
            </>
          ) : null}
        </div>

        <WardPrototypeFooter
          testId="ward-officer-governance"
          note="All outstanding jobs; closed movements excluded · Providers identify organisations · Not a medical device"
        />
      </main>

      {/* Form verification dialog */}
      {formModalJob ? (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a backdrop click closes it for the pointer, and the shared modal focus helper closes it on Escape
        <div
          ref={formModalRef}
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-verify-title"
          onClick={closeFormModal}
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <header className={styles.modalHead}>
              <span className={styles.modalTile} aria-hidden="true">
                <Icon icon={ShieldCheck} size={16} />
              </span>
              <span className={styles.modalTitles}>
                <h3 id="form-verify-title" className={styles.modalTitle}>
                  Form verification
                </h3>
                <span className={styles.modalSub}>
                  {formRequiredLabel(formModalJob.transport!)} · {umrnFor(formModalJob)} ·{" "}
                  {officerPatientName(formModalJob)}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={X}
                onClick={closeFormModal}
                aria-label="Close form verification dialog"
              />
            </header>
            <div className={styles.modalBody}>
              <p className={styles.modalLead}>
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                Confirm paperwork with the clinical team for <strong>{officerPatientName(formModalJob)}</strong>. These
                local checks do not establish legal authorisation and are not saved to the movement record.
              </p>
              <h4 className={styles.sectionTitle}>Transfer checks</h4>
              <div className={styles.checklist}>
                {[
                  "Patient identity confirmed with ED clinical liaison nurse",
                  "Authorisation documentation intact with transfer manifest",
                  "Personal effects manifest signed and secured in transit lockbox",
                  "Destination receiving ward notified of vehicle dispatch departure",
                ].map((label, idx) => {
                  const isChecked = verifiedChecks[formModalJob.id]?.[idx] ?? false;
                  return (
                    <label key={idx} className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheck(formModalJob.id, idx)}
                        data-testid={`ward-officer-check-${idx}-${formModalJob.id}`}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <footer className={styles.modalFoot}>
              <span className={styles.muted}>
                <StatusGlyph tone="neutral" size={9} /> Not saved to the movement record
              </span>
              <Button variant="pri" size="sm" onClick={closeFormModal}>
                Close checks
              </Button>
            </footer>
          </div>
        </div>
      ) : null}

      {collectCheck ? (
        <TransportExceptionDialog
          open
          who={officerPatientName(collectCheck)}
          action="Collected"
          gaps={collectionGaps(collectCheck)}
          onClose={() => setCollectCheckId(null)}
          onConfirm={(reason) => {
            setCollectCheckId(null);
            recordCollected(collectCheck, { gaps: collectionGaps(collectCheck), reason });
          }}
          testId="ward-officer-collect-check"
        />
      ) : null}
      {toastText ? (
        <div className={styles.toast}>
          <StatusLine tone="success" title={toastText} />
          {toastUndoFor ? (
            <button
              type="button"
              className={styles.toastUndo}
              data-testid="ward-officer-toast-undo"
              onClick={() => undoTransportStep(toastUndoFor)}
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
