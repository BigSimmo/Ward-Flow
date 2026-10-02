"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PhoneCall, Plus, Search, X } from "lucide-react";

import {
  EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE,
  elapsedLabel,
  examinationRevokedWhileBedHeld,
  stageCopy,
  transportLeg,
} from "@/components/ward-management/ward-derivations";
import { STAGE_TRANSITION_BLOCKERS } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  TRANSPORT_PROVIDERS,
  type Movement,
  type TransportJob,
  type Unit,
} from "@/components/ward-management/ward-model";
import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import { edById } from "@/components/ward-management/ward-sites";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  DIVERSION_REASONS,
  TRANSPORT_WHEREABOUTS,
  changeReasonLabels,
  type DiversionReason,
  type TransportWhereabouts,
} from "@/components/ward-management/ward-change-reasons";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { WardDynamicIsland } from "@/components/ward-management/shell/ward-dynamic-island";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";

import styles from "./officer.module.css";

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

/**
 * THE JOBS THIS PHONE SCREEN SHOWS, and the predicate its governance sentence describes.
 */
export function isOfficerJob(movement: Movement): boolean {
  return (
    movement.transport !== undefined && movement.transport.arrivedAt === undefined && movement.closure === undefined
  );
}

export function OfficerScreen() {
  const { movements, units, dispatch, rejections, patients, referrals } = useWardFlow();
  const officerPatientName = useCallback(
    (movement: Movement) => {
      const info = resolveSubjectPatient(movement, { patients, referrals, movements });
      return info.patient ? info.displayName : "Not recorded";
    },
    [patients, referrals, movements],
  );
  // Owner, 26 Sept 2026: undefined (not "Not recorded") lets the blocked-reason helpers below
  // fall back to their own "This patient" wording instead of printing a placeholder mid-sentence.
  const resolvedPatientName = (movement: Movement): string | undefined => {
    const info = resolveSubjectPatient(movement, { patients, referrals, movements });
    return info.patient ? info.displayName : undefined;
  };
  const patientNameForMovementId = (movementId: string) => {
    const movement = movements.find((candidate) => candidate.id === movementId);
    return movement ? officerPatientName(movement) : "Not recorded";
  };
  const now = useWardFlowClock();

  const jobs = movements.filter(isOfficerJob);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [escortFilter, setEscortFilter] = useState<boolean>(false);

  // Status and escort counts across all active officer jobs
  const statusCounts = useMemo(() => {
    const counts = { all: jobs.length, requested: 0, accepted: 0, en_route: 0, collected: 0 };
    for (const job of jobs) {
      if (!job.transport) continue;
      const leg = officerLeg(job.transport);
      if (leg === "Requested") counts.requested++;
      else if (leg === "Accepted") counts.accepted++;
      else if (leg === "En route") counts.en_route++;
      else if (leg === "Collected") counts.collected++;
    }
    return counts;
  }, [jobs]);

  const escortCount = useMemo(() => {
    return jobs.filter((j) => j.transport?.escortRequired).length;
  }, [jobs]);

  const isFiltered = searchQuery.trim() !== "" || statusFilter !== "all" || providerFilter !== "all" || escortFilter;
  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setProviderFilter("all");
    setEscortFilter(false);
  };

  // Filtered jobs derivation
  const filteredJobs = useMemo(() => {
    return jobs.filter((movement) => {
      const transport = movement.transport;
      if (!transport) return false;
      const leg = officerLeg(transport);

      // Status / Leg filter
      if (statusFilter !== "all") {
        if (statusFilter === "requested" && leg !== "Requested") return false;
        if (statusFilter === "accepted" && leg !== "Accepted") return false;
        if (statusFilter === "en_route" && leg !== "En route") return false;
        if (statusFilter === "collected" && leg !== "Collected") return false;
      }

      // Provider filter
      if (providerFilter !== "all" && transport.provider !== providerFilter) {
        return false;
      }

      // Escort filter
      if (escortFilter && !transport.escortRequired) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pName = officerPatientName(movement).toLowerCase();
        const mId = movement.id.toLowerCase();
        const originEd = edById(movement.originEdId);
        const originName = originEd ? `${originEd.name} ${originEd.siteCode}`.toLowerCase() : "";
        const destinationUnit = movement.acceptedUnitId
          ? units.find((unit) => unit.id === movement.acceptedUnitId)
          : undefined;
        const destName = destinationUnit ? destinationUnit.name.toLowerCase() : "";

        const matches =
          pName.includes(q) ||
          mId.includes(q) ||
          originName.includes(q) ||
          destName.includes(q) ||
          transport.provider.toLowerCase().includes(q) ||
          (transport.cadNumber && transport.cadNumber.toLowerCase().includes(q));

        if (!matches) return false;
      }

      return true;
    });
  }, [jobs, statusFilter, providerFilter, escortFilter, searchQuery, units, officerPatientName]);

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selectedJob = jobs.find((job) => job.id === selectedId) ?? filteredJobs[0] ?? jobs[0];

  // Modals & Toast State
  const [formModalJob, setFormModalJob] = useState<Movement | null>(null);
  const [handoverModalMovementId, setHandoverModalMovementId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [verifiedChecks, setVerifiedChecks] = useState<Record<string, boolean[]>>({});
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
  const handoverModalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!formModalJob) return;
    const modal = formModalRef.current;
    if (!modal) return;
    const firstFocusable = modal.querySelector<HTMLElement>(
      'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  }, [formModalJob]);

  useEffect(() => {
    if (!handoverModalMovementId) return;
    const modal = handoverModalRef.current;
    if (!modal) return;
    const firstFocusable = modal.querySelector<HTMLElement>(
      'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  }, [handoverModalMovementId]);

  const handleModalTabTrap = (modalElement: HTMLElement | null, event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !modalElement) return;
    const focusable = Array.from(
      modalElement.querySelectorAll<HTMLElement>(
        'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

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

  // KPI Calculations
  const activeRuns = jobs.filter(
    (job) => job.transport?.acceptedAt !== undefined && job.transport?.collectedAt === undefined,
  ).length;
  const inCustody = jobs.filter(
    (job) => job.transport?.collectedAt !== undefined && job.transport?.arrivedAt === undefined,
  ).length;
  const awaitingDeparture = jobs.filter((job) => job.transport?.acceptedAt === undefined).length;
  const escortRequired = jobs.filter((job) => job.transport?.escortRequired).length;

  // Escape and global / shortcut handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (formModalJob) {
          setFormModalJob(null);
          lastTriggerRef.current?.focus();
        } else if (handoverModalMovementId) {
          setHandoverModalMovementId(null);
          lastTriggerRef.current?.focus();
        }
      } else if (
        e.key === "/" &&
        !formModalJob &&
        !handoverModalMovementId &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formModalJob, handoverModalMovementId]);

  // Toast timeout
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  /*
   * `dispatch` never says whether the reducer accepted or refused, so the four transport buttons
   * used to announce success unconditionally ("Transport accepted for WF-…") even when the event
   * was refused (live walkthrough, 25 Sept 2026). Same pattern as the ward screen's `checkToken`:
   * note the refusal count before dispatching, then compare on the next render.
   */
  const priorRejectionCountRef = useRef(rejections.length);
  const [pendingOutcome, setPendingOutcome] = useState<{ success: string; refused: string } | null>(null);
  useEffect(() => {
    if (!pendingOutcome) return;
    setToastMessage(
      rejections.length > priorRejectionCountRef.current ? pendingOutcome.refused : pendingOutcome.success,
    );
    priorRejectionCountRef.current = rejections.length;
    setPendingOutcome(null);
  }, [pendingOutcome, rejections]);
  // Called straight after `dispatch` in the same handler, so `rejections` here is still the
  // pre-dispatch list. Each button calls `dispatch({ type: "..." })` itself, with a literal type,
  // so the override-surface guard can read every transport event.
  const reportOutcome = (success: string, action: string, who: string) => {
    priorRejectionCountRef.current = rejections.length;
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    setPendingOutcome({ success, refused: `${action} for ${who} was refused. See Refused actions below.` });
  };

  const openFormModal = (movement: Movement, e: React.MouseEvent<HTMLElement>) => {
    lastTriggerRef.current = e.currentTarget;
    setFormModalJob(movement);
  };

  const closeFormModal = () => {
    setFormModalJob(null);
    lastTriggerRef.current?.focus();
  };

  const openHandoverModal = (movementId: string | undefined, e: React.MouseEvent<HTMLElement>) => {
    if (!movementId) return;
    lastTriggerRef.current = e.currentTarget;
    setHandoverModalMovementId(movementId);
  };

  const closeHandoverModal = () => {
    setHandoverModalMovementId(null);
    lastTriggerRef.current?.focus();
  };

  const executeHandover = (movement: Movement) => {
    const destinationUnit = movement.acceptedUnitId
      ? units.find((unit) => unit.id === movement.acceptedUnitId)
      : undefined;
    const blocked = arrivedBlockedReason(movement, destinationUnit, resolvedPatientName(movement));
    if (blocked) {
      showToast(`Arrival blocked: ${blocked}`);
      return;
    }
    dispatch({
      type: "PATIENT_ARRIVED",
      role: "officer",
      now,
      movementId: movement.id,
    });
    closeHandoverModal();
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    reportOutcome(
      `Arrival submitted for ${officerPatientName(movement)}. No receiving nurse signature is recorded.`,
      "Arrival",
      officerPatientName(movement),
    );
  };

  const handoverJob = jobs.find((j) => j.id === handoverModalMovementId) ?? selectedJob;
  const handoverDestUnit = handoverJob?.acceptedUnitId
    ? units.find((unit) => unit.id === handoverJob.acceptedUnitId)
    : undefined;
  const handoverDestLabel = handoverJob?.acceptedUnitId
    ? wardLabel(handoverJob.acceptedUnitId, handoverDestUnit?.name)
    : "No destination recorded";

  return (
    <div className={styles.screen} data-testid="ward-officer-screen" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        <h1 className={styles.srOnly}>Transport Officer Console</h1>

        {/* Executive Flight Deck Header */}
        <div className={styles.flightDeckHeader}>
          <div className={styles.flightDeckTitleGroup}>
            <div className={styles.flightDeckBadge}>
              <span className={styles.livePulse} aria-hidden="true" />
              <span className={styles.flightDeckBadgeText}>TRANSIT DISPATCH COMMAND</span>
            </div>
            <span className={styles.flightDeckSep} aria-hidden="true">
              &middot;
            </span>
            <span className={styles.flightDeckCount}>
              <strong>{jobs.length}</strong> active patient transfers across statewide network
            </span>
          </div>
          <div className={styles.hdrEnd}>
            <button
              className={styles.btnActionGhost}
              type="button"
              onClick={() => showToast("Not wired in this prototype.")}
            >
              <PhoneCall size={13} aria-hidden="true" />
              <span>Dispatch Comms</span>
            </button>
            <button
              className={styles.btnActionPrimary}
              type="button"
              onClick={(e) => openHandoverModal(selectedJob?.id, e)}
            >
              <Plus size={14} aria-hidden="true" />
              <span>Transport Handover</span>
            </button>
          </div>
        </div>

        {/* Unified Operational Telemetry & Provider Strip */}
        <section className={styles.fleetPanel} aria-label="Transport jobs by provider">
          <div className={styles.telemetrySection} aria-label="Transport overview metrics and provider telemetry">
            <WardDynamicIsland
              testId="ward-officer-hud-island"
              title="Transport Dispatch"
              status={escortRequired > 0 || awaitingDeparture > 3 ? "warning" : "nominal"}
              statusText={
                escortRequired > 0
                  ? `${escortRequired} transfers require clinical escort`
                  : "Transport fleet dispatch nominal"
              }
              ariaLabel="Transport dispatch indicators"
              metrics={[
                {
                  id: "kpi-active-transit",
                  label: "Active Transit Runs",
                  value: activeRuns,
                  subtext: "Dispatched or In Transit",
                  tone: "accent",
                },
                {
                  id: "kpi-on-board",
                  label: "Patient On Board",
                  value: inCustody,
                  subtext: "Patient On-Board Vehicle",
                  tone: "good",
                },
                {
                  id: "kpi-awaiting-departure",
                  label: "Awaiting Departure",
                  value: awaitingDeparture,
                  subtext: "ED Handover Pending",
                  tone: awaitingDeparture > 0 ? "warn" : "good",
                },
                {
                  id: "kpi-escort-required",
                  label: "Escort Required",
                  value: escortRequired,
                  subtext: escortRequired > 0 ? "Mental Health Escort" : "Standard",
                  tone: escortRequired > 0 ? "danger" : "normal",
                },
              ]}
            />

            {/* Streamlined Provider Telemetry Row */}
            <div className={styles.providerStrip}>
              <div className={styles.providerStripHeader}>
                <div className={styles.providerStripTitleGroup}>
                  <span className={styles.providerStripTitle}>Fleet By Provider</span>
                  <span className={styles.providerStripHint}>Filter transfers by provider fleet</span>
                </div>
                {providerFilter !== "all" ? (
                  <button
                    type="button"
                    className={styles.providerClearFilterBtn}
                    onClick={() => setProviderFilter("all")}
                    aria-label={`Clear provider filter, currently showing ${providerFilter}`}
                  >
                    Clear provider ({providerFilter})
                  </button>
                ) : null}
              </div>
              <div className={styles.providerGrid}>
                {TRANSPORT_PROVIDERS.map((provider) => {
                  const providerJobs = movements.filter(
                    (movement) => !movement.closure && movement.transport?.provider === provider,
                  );
                  const moving = providerJobs.filter((movement) => {
                    const leg = transportLeg(movement.transport);
                    return leg === "En route" || leg === "Collected";
                  }).length;
                  const waiting = providerJobs.filter((movement) => {
                    const leg = transportLeg(movement.transport);
                    return leg === "Requested" || leg === "Accepted";
                  }).length;
                  const isSelected = providerFilter === provider;

                  return (
                    <button
                      key={provider}
                      type="button"
                      className={isSelected ? styles.providerCardActive : styles.providerCard}
                      onClick={() => setProviderFilter((prev) => (prev === provider ? "all" : provider))}
                      title={`Filter by ${provider}`}
                      aria-pressed={isSelected}
                    >
                      <div className={styles.providerCardHeader}>
                        <span className={styles.providerVehicleType}>{provider}</span>
                        <span className={styles.providerBadge} data-tone={moving > 0 ? "good" : "neutral"}>
                          {moving > 0 ? `${moving} Active` : "Standby"}
                        </span>
                      </div>
                      <div className={styles.providerCardStats}>
                        <span className={styles.providerStatPill}>
                          <strong>{moving}</strong> on road
                        </span>
                        <span className={styles.providerStatSep} aria-hidden="true">
                          &middot;
                        </span>
                        <span className={styles.providerStatPill}>
                          <strong>{waiting}</strong> booked
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Refused Actions Section */}
        {officerRefusals.length > 0 ? (
          <section className={styles.refusals} aria-label="Refused actions" data-testid="ward-officer-refusals">
            <header className={styles.panelHeader}>
              <div>
                <h2 className={styles.refusalsTitle}>Refused actions</h2>
                <p>Recorded refusals remain visible for this session.</p>
              </div>
              <span className={styles.refusalsCount}>{officerRefusals.length}</span>
            </header>
            <div className={styles.panelBody} role="region" aria-label="Refused actions list" tabIndex={0}>
              <ul className={styles.refusalsList}>
                {officerRefusals.map((rejection) => (
                  <li key={rejection.id} className={styles.refusalsItem}>
                    {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                    <strong>{patientNameForMovementId(rejection.movementId)}</strong> &mdash;{" "}
                    {OFFICER_ACTION_REJECTION_LABELS[rejection.attempted]} was refused: {rejection.reason}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* Cancelled Transports / Stand-Downs Section */}
        {cancelledTransports.length > 0 ? (
          <section
            className={styles.cancelledSection}
            aria-label="Cancelled transports"
            data-testid="ward-officer-cancelled-transports"
          >
            <header className={styles.panelHeader}>
              <div>
                <h2 className={styles.cancelledTitle}>Cancelled transports / Stand-downs</h2>
                <p>Cancelled dispatches and ambulance stand-downs for this session.</p>
              </div>
              <span className={styles.cancelledCount}>{cancelledTransports.length}</span>
            </header>
            <div className={styles.panelBody} role="region" aria-label="Cancelled transports list" tabIndex={0}>
              <ul className={styles.cancelledList}>
                {cancelledTransports.map((item, idx) => (
                  <li key={`${item.movementId}-${idx}`} className={styles.cancelledItem}>
                    <span className={styles.cancelledBadge}>STAND-DOWN</span>
                    {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                    <strong>{item.patientName}</strong> &mdash; CAD (dispatch) number: <code>{item.cadNumber}</code>
                    <span className={styles.cancelledNote}>({item.note})</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* Interactive Multi-Dimensional Filter Toolbar */}
        <div className={styles.filterToolbar} role="search" aria-label="Filter transport jobs">
          <div className={styles.searchBox}>
            <Search className={styles.searchIcon} size={15} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              id="officer-transfer-search"
              name="transferSearch"
              className={styles.searchInput}
              placeholder="Search patient, destination, ED, or CAD #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search transport jobs"
            />
            {!searchQuery ? (
              <kbd className={styles.searchKbd} aria-hidden="true" title="Press / to focus search">
                /
              </kbd>
            ) : (
              <button
                type="button"
                className={styles.searchClearBtn}
                onClick={() => setSearchQuery("")}
                aria-label="Clear search input"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className={styles.filterPills} role="group" aria-label="Filter by transport stage">
            {(
              [
                { id: "all", label: "All Stages", count: statusCounts.all },
                { id: "requested", label: "Requested", count: statusCounts.requested },
                { id: "accepted", label: "Accepted", count: statusCounts.accepted },
                { id: "en_route", label: "En route", count: statusCounts.en_route },
                { id: "collected", label: "Collected", count: statusCounts.collected },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={statusFilter === tab.id ? styles.filterPillActive : styles.filterPill}
                onClick={() => setStatusFilter(tab.id)}
                aria-pressed={statusFilter === tab.id}
              >
                <span>{tab.label}</span>
                <span className={styles.filterPillBadge}>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className={styles.filterAuxControls}>
            <div className={styles.selectFilterGroup}>
              <select
                id="officer-provider-filter"
                name="providerFilter"
                className={styles.filterSelect}
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                aria-label="Filter by transport provider"
              >
                <option value="all">All Providers ({jobs.length})</option>
                {TRANSPORT_PROVIDERS.map((p) => {
                  const pCount = jobs.filter((j) => j.transport?.provider === p).length;
                  return (
                    <option key={p} value={p}>
                      {p} ({pCount})
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              type="button"
              className={escortFilter ? styles.filterPillActive : styles.filterPill}
              onClick={() => setEscortFilter((prev) => !prev)}
              aria-pressed={escortFilter}
              title="Show only journeys requiring a mental health or clinical escort"
            >
              <span>Escort Only</span>
              <span className={styles.filterPillBadge}>{escortCount}</span>
            </button>

            {isFiltered ? (
              <button
                type="button"
                className={styles.resetFilterBtn}
                onClick={resetFilters}
                aria-label="Reset all filters"
              >
                Reset filters
              </button>
            ) : null}
          </div>

          <div className={styles.filterCountIndicator}>
            Showing <strong>{filteredJobs.length}</strong> of {jobs.length} transfers
          </div>
        </div>

        {/* Transport Jobs Section */}
        <section className={styles.jobsPanel} aria-labelledby="ward-officer-jobs-heading">
          <header className={styles.panelHeader}>
            <div>
              <h2 id="ward-officer-jobs-heading">Transport jobs</h2>
            </div>
            <span className={styles.jobsCountBadge}>{filteredJobs.length} Priority Transfers</span>
          </header>

          <div className={styles.panelBody}>
            {jobs.length === 0 ? (
              <p className={styles.placeholder} data-testid="ward-officer-empty">
                No transport job is currently outstanding &mdash; every job has either arrived or its movement has
                closed.
              </p>
            ) : filteredJobs.length === 0 ? (
              <div className={styles.filterEmptyState}>
                <p>No transport jobs match the selected filter criteria.</p>
                <button type="button" className={styles.resetFilterBtn} onClick={resetFilters}>
                  Clear all filters
                </button>
              </div>
            ) : (
              <ul className={styles.jobList} data-testid="ward-officer-joblist">
                {filteredJobs.map((movement) => {
                  const transport = movement.transport;
                  if (!transport) return null;

                  const active = movement.id === selectedJob?.id;
                  const originEd = edById(movement.originEdId);
                  const destinationUnit = movement.acceptedUnitId
                    ? units.find((unit) => unit.id === movement.acceptedUnitId)
                    : undefined;
                  const destinationLabel = movement.acceptedUnitId
                    ? wardLabel(movement.acceptedUnitId, destinationUnit?.name)
                    : "No accepted destination recorded";

                  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                  const patientName = resolvedPatientName(movement);
                  const acceptedBlocked = acceptedBlockedReason(movement, patientName);
                  const enRouteBlocked = enRouteBlockedReason(movement, patientName);
                  const collectedBlocked = collectedBlockedReason(movement, patientName);
                  const arrivedBlocked = arrivedBlockedReason(movement, destinationUnit, patientName);

                  const leg = officerLeg(transport);
                  const legIndex = leg ? OFFICER_LEG_STEPS.indexOf(leg) : -1;
                  const stepBlockedReason =
                    leg === "Requested"
                      ? acceptedBlocked
                      : leg === "Accepted"
                        ? enRouteBlocked
                        : leg === "En route"
                          ? collectedBlocked
                          : leg === "Collected"
                            ? arrivedBlocked
                            : undefined;
                  const stepStatusText = leg
                    ? stepBlockedReason
                      ? `blocked before ${nextActionVerb(leg).toLowerCase()}`
                      : `next ${nextActionVerb(leg).toLowerCase()}`
                    : undefined;

                  const tone =
                    leg === "Collected"
                      ? "good"
                      : leg === "En route"
                        ? "warn"
                        : leg === "Accepted"
                          ? "accent"
                          : "default";

                  return (
                    <li
                      key={movement.id}
                      data-testid={`ward-officer-job-${movement.id}`}
                      className={active ? styles.jobCardActive : styles.jobCard}
                    >
                      <div className={styles.jobTopHeader}>
                        <div className={styles.jobHeaderRibbon}>
                          <div className={styles.jobIdBadgeGroup}>
                            <span className={styles.jobIdTag}>#{movement.id}</span>
                            {/* Josh, 25 Sept 2026: the transport officer sees the patient's name. Same
                                resolver as the Referral board; "Not recorded" when no single patient
                                is linked, never a guess. */}
                            <strong
                              className={styles.jobPatientName}
                              data-testid={`ward-officer-patient-${movement.id}`}
                            >
                              {officerPatientName(movement)}
                            </strong>
                            <span className={styles.legBadge} data-tone={tone}>
                              {transportLeg(transport)}
                            </span>
                            {transport.escortRequired ? (
                              <span className={styles.escortBadge} data-tone="warn">
                                Clinical Escort
                              </span>
                            ) : null}
                          </div>

                          <div className={styles.jobHeaderActions}>
                            <span className={styles.jobMeta}>{elapsedLabel(movement, now)}</span>
                            <button
                              type="button"
                              className={styles.linkInspect}
                              data-testid={`ward-officer-inspect-form-${movement.id}`}
                              onClick={(e) => {
                                openFormModal(movement, e);
                              }}
                            >
                              Inspect Form
                            </button>
                          </div>
                        </div>

                        <div className={styles.routeCorridor}>
                          <div className={styles.routeCorridorOrigin}>
                            <span className={styles.routeCorridorLabel}>ORIGIN</span>
                            <strong className={styles.routeCorridorPlace}>
                              {departmentLabel(
                                movement.originEdId,
                                originEd && `${originEd.name} (${originEd.siteCode})`,
                              )}
                            </strong>
                          </div>
                          <span className={styles.routeCorridorArrow} aria-hidden="true">
                            &rarr;
                          </span>
                          <div className={styles.routeCorridorDest}>
                            <span className={styles.routeCorridorLabel}>DESTINATION</span>
                            <strong className={styles.routeCorridorPlace}>{destinationLabel}</strong>
                          </div>
                        </div>
                      </div>

                      {leg && stepStatusText ? (
                        <div className={styles.stepperWrapper}>
                          <div
                            className={styles.stepper}
                            role="img"
                            aria-label={`Transport stage: ${leg}, ${stepStatusText}`}
                            data-testid={`ward-officer-stepper-${movement.id}`}
                          >
                            {OFFICER_LEG_STEPS.map((step, index) => (
                              <span
                                key={step}
                                className={styles.stageBar}
                                data-s={index < legIndex ? "done" : index === legIndex ? "now" : "todo"}
                              />
                            ))}
                          </div>
                          <p className={styles.stageLine}>
                            <strong>{leg}</strong>
                            <span>, {stepStatusText}</span>
                          </p>
                        </div>
                      ) : null}

                      <dl className={styles.jobDetails}>
                        <div className={styles.jobDetailRow}>
                          <dt>Provider</dt>
                          <dd>{transport.provider}</dd>
                        </div>
                        <div className={styles.jobDetailRow}>
                          <dt>Escort required</dt>
                          <dd>{transport.escortRequired ? "Yes" : "No"}</dd>
                        </div>
                        <div className={styles.jobDetailRow}>
                          <dt>Form on file</dt>
                          <dd>{formRequiredLabel(transport)}</dd>
                        </div>
                        <div className={styles.jobDetailRow} data-testid={`ward-officer-cad-number-${movement.id}`}>
                          <dt>CAD (dispatch) number</dt>
                          <dd>{cadNumberLabel(transport)}</dd>
                        </div>
                        <div
                          className={styles.jobDetailRow}
                          data-testid={`ward-officer-transport-legal-status-${movement.id}`}
                        >
                          <dt>Transport logged as</dt>
                          <dd>{transportLegalStatusLabel(transport)}</dd>
                        </div>
                        <div className={styles.jobDetailRow} data-testid={`ward-officer-estimated-at-${movement.id}`}>
                          <dt>Estimated time</dt>
                          <dd>{estimatedTimeLabel(transport, now)}</dd>
                        </div>
                        {movement.arrivalDetails && (
                          <div
                            className={styles.jobDetailRow}
                            data-testid={`ward-officer-arrival-details-${movement.id}`}
                          >
                            <dt>Arrival Plan (Ward ETA)</dt>
                            <dd>
                              {formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} AWST · Mode:{" "}
                              {movement.arrivalDetails.mode}
                            </dd>
                          </div>
                        )}
                        {movement.uploadedForms && movement.uploadedForms.length > 0 && (
                          <div
                            className={styles.jobDetailRow}
                            data-testid={`ward-officer-uploaded-forms-${movement.id}`}
                          >
                            <dt>Document details ({movement.uploadedForms.length}) — file contents not stored</dt>
                            <dd>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {movement.uploadedForms.map((f) => (
                                  <span key={f.id} className={styles.uploadedFormTag}>
                                    📄 {f.formName} ({f.fileName})
                                  </span>
                                ))}
                              </div>
                            </dd>
                          </div>
                        )}
                      </dl>
                      {movement.arrivalDetails &&
                        now > movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES && (
                          <div
                            className={styles.officerOverdueAlert}
                            role="alert"
                            data-testid={`ward-officer-overdue-alert-${movement.id}`}
                            title={OPERATIONAL_DEFAULT_LABEL}
                          >
                            ⚠️ <strong>Arrival Overdue:</strong> Patient is &gt;{LATE_ARRIVAL_GRACE_MINUTES}m past
                            estimated arrival time (
                            {formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} AWST). Notification
                            is not recorded here.
                          </div>
                        )}

                      {active ? (
                        <>
                          <div className={styles.actionRow}>
                            <button
                              type="button"
                              data-testid={`ward-officer-accept-${movement.id}`}
                              aria-disabled={acceptedBlocked ? "true" : undefined}
                              aria-describedby={
                                acceptedBlocked ? `ward-officer-accept-unavailable-${movement.id}` : undefined
                              }
                              title={acceptedBlocked ?? undefined}
                              className={
                                !acceptedBlocked && leg === "Requested"
                                  ? `${styles.actionButton} ${styles.actionButtonPrimary}`
                                  : styles.actionButton
                              }
                              onClick={
                                acceptedBlocked
                                  ? ignoreUnavailableActivation
                                  : () => {
                                      dispatch({
                                        type: "TRANSPORT_ACCEPTED",
                                        role: "officer",
                                        now,
                                        movementId: movement.id,
                                      });
                                      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                                      reportOutcome(
                                        `Transport accepted for ${officerPatientName(movement)}.`,
                                        "Transport acceptance",
                                        officerPatientName(movement),
                                      );
                                    }
                              }
                            >
                              Accepted
                            </button>
                            <button
                              type="button"
                              data-testid={`ward-officer-enroute-${movement.id}`}
                              aria-disabled={enRouteBlocked ? "true" : undefined}
                              aria-describedby={
                                enRouteBlocked ? `ward-officer-enroute-unavailable-${movement.id}` : undefined
                              }
                              title={enRouteBlocked ?? undefined}
                              className={
                                !enRouteBlocked && leg === "Accepted"
                                  ? `${styles.actionButton} ${styles.actionButtonPrimary}`
                                  : styles.actionButton
                              }
                              onClick={
                                enRouteBlocked
                                  ? ignoreUnavailableActivation
                                  : () => {
                                      dispatch({
                                        type: "TRANSPORT_EN_ROUTE",
                                        role: "officer",
                                        now,
                                        movementId: movement.id,
                                      });
                                      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                                      reportOutcome(
                                        `Transport en route for ${officerPatientName(movement)}.`,
                                        "En route",
                                        officerPatientName(movement),
                                      );
                                    }
                              }
                            >
                              En route
                            </button>
                            <button
                              type="button"
                              data-testid={`ward-officer-collect-${movement.id}`}
                              aria-disabled={collectedBlocked ? "true" : undefined}
                              aria-describedby={
                                collectedBlocked ? `ward-officer-collect-unavailable-${movement.id}` : undefined
                              }
                              title={collectedBlocked ?? undefined}
                              className={
                                !collectedBlocked && leg === "En route"
                                  ? `${styles.actionButton} ${styles.actionButtonPrimary}`
                                  : styles.actionButton
                              }
                              onClick={
                                collectedBlocked
                                  ? ignoreUnavailableActivation
                                  : () => {
                                      dispatch({
                                        type: "PATIENT_COLLECTED",
                                        role: "officer",
                                        now,
                                        movementId: movement.id,
                                      });
                                      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                                      reportOutcome(
                                        `Patient collected for ${officerPatientName(movement)}. In transit.`,
                                        "Collection",
                                        officerPatientName(movement),
                                      );
                                    }
                              }
                            >
                              Collected
                            </button>
                            <button
                              type="button"
                              data-testid={`ward-officer-arrive-${movement.id}`}
                              aria-disabled={arrivedBlocked ? "true" : undefined}
                              aria-describedby={
                                arrivedBlocked ? `ward-officer-arrive-unavailable-${movement.id}` : undefined
                              }
                              title={arrivedBlocked ?? undefined}
                              className={
                                !arrivedBlocked && leg === "Collected"
                                  ? `${styles.actionButton} ${styles.actionButtonPrimary}`
                                  : styles.actionButton
                              }
                              onClick={
                                arrivedBlocked
                                  ? ignoreUnavailableActivation
                                  : () => {
                                      dispatch({
                                        type: "PATIENT_ARRIVED",
                                        role: "officer",
                                        now,
                                        movementId: movement.id,
                                      });
                                      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                                      reportOutcome(
                                        `Delivery recorded for ${officerPatientName(movement)}. Delivered to receiving unit.`,
                                        "Delivery",
                                        officerPatientName(movement),
                                      );
                                    }
                              }
                            >
                              Delivered
                            </button>
                          </div>
                          {!movement.closure &&
                          movement.transport?.collectedAt !== undefined &&
                          movement.transport.arrivedAt === undefined &&
                          movement.transport.diversion === undefined ? (
                            <div
                              className={styles.actionRow}
                              data-testid={`ward-officer-diversion-${movement.id}`}
                              style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}
                            >
                              <label htmlFor={`ward-officer-diversion-reason-${movement.id}`}>
                                Why was the journey diverted?
                              </label>
                              <select
                                id={`ward-officer-diversion-reason-${movement.id}`}
                                data-testid={`ward-officer-diversion-reason-${movement.id}`}
                                value={diversionReason ?? ""}
                                onChange={(chosen) => {
                                  const value = chosen.target.value;
                                  setDiversionReason(
                                    DIVERSION_REASONS.includes(value as DiversionReason)
                                      ? (value as DiversionReason)
                                      : undefined,
                                  );
                                }}
                              >
                                <option value="">Choose a reason…</option>
                                {DIVERSION_REASONS.map((reason) => (
                                  <option key={reason} value={reason}>
                                    {reason}
                                  </option>
                                ))}
                              </select>
                              <label htmlFor={`ward-officer-diversion-place-${movement.id}`}>
                                Where is the patient now?
                              </label>
                              <select
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
                              </select>
                              <button
                                type="button"
                                className={styles.actionButton}
                                data-testid={`ward-officer-record-diversion-${movement.id}`}
                                aria-disabled={
                                  diversionReason === undefined || diversionPlace === undefined ? "true" : undefined
                                }
                                aria-describedby={
                                  diversionReason === undefined || diversionPlace === undefined
                                    ? `ward-officer-diversion-blocked-${movement.id}`
                                    : undefined
                                }
                                title={
                                  diversionReason === undefined || diversionPlace === undefined
                                    ? "Choose a reason and where the patient is first."
                                    : undefined
                                }
                                onClick={
                                  diversionReason === undefined || diversionPlace === undefined
                                    ? ignoreUnavailableActivation
                                    : () => {
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
                                        // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                                        showToast(`Diversion recorded for ${officerPatientName(movement)}.`);
                                      }
                                }
                              >
                                Record a diversion
                              </button>
                              {diversionReason === undefined || diversionPlace === undefined ? (
                                <span id={`ward-officer-diversion-blocked-${movement.id}`} className="sr-only">
                                  Choose a reason and where the patient is first.
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          {movement.transport?.diversion ? (
                            <p className={styles.inactiveRow} data-testid={`ward-officer-diverted-${movement.id}`}>
                              Diverted — {movement.transport.diversion.reason}. Where they are:{" "}
                              {movement.transport.diversion.place}.
                            </p>
                          ) : null}
                          {acceptedBlocked ? (
                            <span id={`ward-officer-accept-unavailable-${movement.id}`} className="sr-only">
                              {acceptedBlocked}
                            </span>
                          ) : null}
                          {enRouteBlocked ? (
                            <span id={`ward-officer-enroute-unavailable-${movement.id}`} className="sr-only">
                              {enRouteBlocked}
                            </span>
                          ) : null}
                          {collectedBlocked ? (
                            <span id={`ward-officer-collect-unavailable-${movement.id}`} className="sr-only">
                              {collectedBlocked}
                            </span>
                          ) : null}
                          {arrivedBlocked ? (
                            <span id={`ward-officer-arrive-unavailable-${movement.id}`} className="sr-only">
                              {arrivedBlocked}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <div className={styles.inactiveRow}>
                          <button
                            type="button"
                            data-testid={`ward-officer-select-${movement.id}`}
                            className={styles.selectButton}
                            onClick={() => setSelectedId(movement.id)}
                          >
                            Work this job
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
        <WardPrototypeFooter
          testId="ward-officer-governance"
          note="All outstanding jobs; closed movements excluded · Providers identify organisations · Not a medical device"
        />
      </main>

      {/* Form Verification Modal */}
      {formModalJob ? (
        <div
          ref={formModalRef}
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-verify-title"
          onClick={closeFormModal}
          onKeyDown={(e) => handleModalTabTrap(formModalRef.current, e)}
        >
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <header className={styles.modalHead}>
              <h3 id="form-verify-title" className={styles.modalTitle}>
                {formRequiredLabel(formModalJob.transport!)} &mdash; Verification
              </h3>
              <button
                type="button"
                className={styles.btnSm}
                onClick={closeFormModal}
                aria-label="Close form verification dialog"
              >
                Close
              </button>
            </header>
            <div className={styles.modalBody}>
              <div className={styles.verificationBanner}>
                <strong>Transfer checks</strong>
                <p>
                  {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                  Confirm paperwork with the clinical team for {officerPatientName(formModalJob)}. These local checks do
                  not establish legal authorisation and are not saved to the movement record.
                </p>
              </div>

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
              <button type="button" className={styles.btnPrimary} onClick={closeFormModal}>
                Close checks
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {/* Handover Modal */}
      {handoverModalMovementId && handoverJob ? (
        <div
          ref={handoverModalRef}
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="handover-modal-title"
          onClick={closeHandoverModal}
          onKeyDown={(e) => handleModalTabTrap(handoverModalRef.current, e)}
        >
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <header className={styles.modalHead}>
              <h3 id="handover-modal-title" className={styles.modalTitle}>
                Record Arrival at Receiving Ward
              </h3>
              <button
                type="button"
                className={styles.btnSm}
                onClick={closeHandoverModal}
                aria-label="Close handover dialog"
              >
                Cancel
              </button>
            </header>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="officer-handover-movement">
                  Patient Movement Reference
                </label>
                <input
                  id="officer-handover-movement"
                  type="text"
                  className={styles.formInput}
                  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                  value={officerPatientName(handoverJob)}
                  readOnly
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="officer-handover-destination">
                  Destination Inpatient Unit
                </label>
                <input
                  id="officer-handover-destination"
                  type="text"
                  className={styles.formInput}
                  value={handoverDestLabel}
                  readOnly
                />
              </div>

              <div className={styles.formGroup}>
                <span className={styles.formLabel}>Receiving Registered Nurse Name</span>
                <p>Not recorded in this prototype.</p>
              </div>
            </div>
            <footer className={styles.modalFoot}>
              <button type="button" className={styles.btnSecondary} onClick={closeHandoverModal}>
                Cancel
              </button>
              <button type="button" className={styles.btnGood} onClick={() => executeHandover(handoverJob)}>
                Record Arrival
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {/* Accessible Toast Notification */}
      {toastMessage ? (
        <div className={styles.toast} role="status" aria-live="polite">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.toastIcon}
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
