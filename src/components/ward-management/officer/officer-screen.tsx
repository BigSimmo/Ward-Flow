"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, FileCheck, Lock, MapPin, Search, ShieldCheck, X } from "lucide-react";

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
  HeroStat,
  HeroTrack,
  Icon,
  Kbd,
  Select,
  SrOnly,
  StatusGlyph,
  StatusLine,
  TabPanel,
  Tabs,
  TextInput,
  Timeline,
  durMinutes,
  tableClasses,
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

type StatusFilter = "all" | "requested" | "accepted" | "en_route" | "collected";
type JobsTab = "active" | "refused" | "cancelled";

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
 * THE V6 REBUILD, 7 October 2026 — `design/pages-v6/TransportOfficer.png`. One hero band counts
 * the jobs (patients on board, accepted but not collected, not yet accepted, escort needed, past
 * the ward ETA), filters by stage on its track and by provider on its right. The "Jobs" card holds
 * the active list as a table with Refused and Cancelled tabs beside it; the job panel on the right
 * holds the selected job's route, the four stage actions, its recorded facts, arrival plan and
 * activity, with Inspect form and Divert at its foot. "Arrivals" sets each job's recorded ward ETA
 * on a time line.
 *
 * **Left out, because the app has no such action or record:** Dispatch comms and Call ward (no
 * call is placed from this prototype), Stand down (the officer may not cancel a transport — see
 * `EVENT_ROLE.CANCEL_TRANSPORT`), the booking script copy, the receiving nurse and bed on the
 * arrival plan, the before-departure checklist, the "over 4h waiting" marker (a threshold nobody
 * has set), the Longest wait sort and Delivered today.
 */
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
  // D-39: the patient's UMRN is shown wherever the WF journey number used to be.
  const umrnFor = (movement: Movement) => movementUmrn(movement, { patients, referrals, movements });
  const patientNameForMovementId = (movementId: string) => {
    const movement = movements.find((candidate) => candidate.id === movementId);
    return movement ? officerPatientName(movement) : "Not recorded";
  };
  const now = useWardFlowClock();

  const jobs = movements.filter(isOfficerJob);
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

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [escortFilter, setEscortFilter] = useState<boolean>(false);
  const [jobsTab, setJobsTab] = useState<JobsTab>("active");

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

      if (statusFilter !== "all") {
        if (statusFilter === "requested" && leg !== "Requested") return false;
        if (statusFilter === "accepted" && leg !== "Accepted") return false;
        if (statusFilter === "en_route" && leg !== "En route") return false;
        if (statusFilter === "collected" && leg !== "Collected") return false;
      }

      if (providerFilter !== "all" && transport.provider !== providerFilter) {
        return false;
      }

      if (escortFilter && !transport.escortRequired) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pName = officerPatientName(movement).toLowerCase();
        const umrn = umrnFor(movement).toLowerCase();
        const originEd = edById(movement.originEdId);
        const originName = originEd ? `${originEd.name} ${originEd.siteCode}`.toLowerCase() : "";
        const destinationUnit = movement.acceptedUnitId
          ? units.find((unit) => unit.id === movement.acceptedUnitId)
          : undefined;
        const destName = destinationUnit ? destinationUnit.name.toLowerCase() : "";

        const matches =
          pName.includes(q) ||
          umrn.includes(q) ||
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

  // Modals and toast state
  const [formModalJob, setFormModalJob] = useState<Movement | null>(null);
  const [handoverModalMovementId, setHandoverModalMovementId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<
    { message: string } | { success: string; refused: string; priorRejections: number } | null
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
  const handoverModalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const selectJob = (id: string) => {
    if (id !== selectedJob?.id) {
      setDiversionOpen(false);
      setDiversionReason(undefined);
      setDiversionPlace(undefined);
    }
    setSelectedId(id);
    if (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 1000px)").matches) {
      window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

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

  // Hero counts. Each label names exactly the population its count holds.
  const activeRuns = jobs.filter(
    (job) => job.transport?.acceptedAt !== undefined && job.transport?.collectedAt === undefined,
  ).length;
  const inCustody = jobs.filter(
    (job) => job.transport?.collectedAt !== undefined && job.transport?.arrivedAt === undefined,
  ).length;
  const awaitingDeparture = jobs.filter((job) => job.transport?.acceptedAt === undefined).length;
  const escortRequired = jobs.filter((job) => job.transport?.escortRequired).length;
  const pastEta = jobs.filter((job) => pastWardEta(job, now)).length;

  // Escape and "/" shortcut handler
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
        setJobsTab("active");
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formModalJob, handoverModalMovementId]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
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
  // pre-dispatch list. Each button calls `dispatch({ type: "..." })` itself, with a literal type,
  // so the override-surface guard can read every transport event.
  const reportOutcome = (success: string, action: string, who: string) => {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    setToastMessage({
      success,
      refused: `${action} for ${who} was refused. See the Refused tab.`,
      priorRejections: rejections.length,
    });
  };
  const toastText =
    toastMessage === null
      ? null
      : "message" in toastMessage
        ? toastMessage.message
        : rejections.length > toastMessage.priorRejections
          ? toastMessage.refused
          : toastMessage.success;

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
    const blocked = arrivedBlockedReason(movement, unitFor(movement), resolvedPatientName(movement));
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

  const stageItems: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: statusCounts.all },
    { id: "requested", label: "Requested", count: statusCounts.requested },
    { id: "accepted", label: "Accepted", count: statusCounts.accepted },
    { id: "en_route", label: "En route", count: statusCounts.en_route },
    { id: "collected", label: "Collected", count: statusCounts.collected },
  ];

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
    const eta = expectedArrival(movement)?.at;
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

    return (
      <>
        <div className={styles.route}>
          <div className={styles.routeLeg}>
            <StatusGlyph tone="neutral" size={9} />
            <span className={styles.routePlace}>{originLabelFor(movement)}</span>
            <span className={styles.routeTime}>
              {transport.collectedAt !== undefined ? `Left ${formatInstantWithDay(transport.collectedAt, now)}` : null}
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

        <div className={styles.actionRow}>
          {step(0, "Accepted", "ward-officer-accept", acceptedBlocked, () => {
            dispatch({ type: "TRANSPORT_ACCEPTED", role: "officer", now, movementId: movement.id });
            // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
            reportOutcome(
              `Transport accepted for ${officerPatientName(movement)}.`,
              "Transport acceptance",
              officerPatientName(movement),
            );
          })}
          {step(1, "En route", "ward-officer-enroute", enRouteBlocked, () => {
            dispatch({ type: "TRANSPORT_EN_ROUTE", role: "officer", now, movementId: movement.id });
            reportOutcome(
              `Transport en route for ${officerPatientName(movement)}.`,
              "En route",
              officerPatientName(movement),
            );
          })}
          {step(2, "Collected", "ward-officer-collect", collectedBlocked, () => {
            dispatch({ type: "PATIENT_COLLECTED", role: "officer", now, movementId: movement.id });
            reportOutcome(
              `Patient collected for ${officerPatientName(movement)}. In transit.`,
              "Collection",
              officerPatientName(movement),
            );
          })}
          {step(3, "Delivered", "ward-officer-arrive", arrivedBlocked, () => {
            dispatch({ type: "PATIENT_ARRIVED", role: "officer", now, movementId: movement.id });
            reportOutcome(
              `Delivery recorded for ${officerPatientName(movement)}. Delivered to receiving unit.`,
              "Delivery",
              officerPatientName(movement),
            );
          })}
        </div>
        {nextBlocked ? (
          <p className={styles.nextNote}>
            <Icon icon={Lock} size={14} />
            {nextBlocked}
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

        <dl className={styles.facts}>
          <div>
            <dt>Provider</dt>
            <dd>{transport.provider}</dd>
          </div>
          <div data-testid={`ward-officer-transport-legal-status-${movement.id}`}>
            <dt>Transport logged as</dt>
            <dd>{transportLegalStatusLabel(transport)}</dd>
          </div>
          <div data-testid={`ward-officer-cad-number-${movement.id}`}>
            <dt>CAD (dispatch) number</dt>
            <dd>{cadNumberLabel(transport)}</dd>
          </div>
          <div>
            <dt>Escort required</dt>
            <dd>{transport.escortRequired ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Form on file</dt>
            <dd>{formRequiredLabel(transport)}</dd>
          </div>
          <div data-testid={`ward-officer-estimated-at-${movement.id}`}>
            <dt>Estimated time</dt>
            <dd>{estimatedTimeLabel(transport, now)}</dd>
          </div>
        </dl>

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
            {pastWardEta(movement, now) ? (
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
          </section>
        ) : null}

        {movement.uploadedForms && movement.uploadedForms.length > 0 ? (
          <section className={styles.section} aria-label="Document details">
            <h3 className={styles.sectionTitle}>Documents</h3>
            <div className={styles.docs} data-testid={`ward-officer-uploaded-forms-${movement.id}`}>
              <span className={styles.docsNote}>
                Document details ({movement.uploadedForms.length}) — file contents not stored
              </span>
              {movement.uploadedForms.map((f) => (
                <Badge key={f.id} variant="default" size="sm">
                  {f.formName} ({f.fileName})
                </Badge>
              ))}
            </div>
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

  return (
    <div className={styles.screen} data-testid="ward-officer-screen" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow="Transport dispatch"
          title={`${inCustody} on board`}
          stats={
            <div className={styles.heroStats}>
              <HeroStat className={styles.heroStat} value={activeRuns} label="Accepted, not collected" />
              <HeroStat className={styles.heroStat} value={awaitingDeparture} label="Not yet accepted" />
              <HeroStat className={styles.heroStat} value={escortRequired} label="Escort required" />
              <HeroStat
                className={styles.heroStat}
                value={pastEta}
                label="Past ward ETA"
                tone={pastEta > 0 ? "warning" : undefined}
              />
            </div>
          }
          aside={
            <Button
              variant="light"
              size="sm"
              icon={FileCheck}
              onClick={(e) => openHandoverModal(selectedJob?.id, e)}
              disabled={!selectedJob}
            >
              Transport handover
            </Button>
          }
          bar={
            <div className={styles.trackScroll}>
              <HeroTrack
                label="Filter by transport stage"
                value={statusFilter}
                onChange={setStatusFilter}
                items={stageItems}
              />
            </div>
          }
          barAside={
            <div className={styles.fleetPanel} role="group" aria-label="Jobs by provider">
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
                    className={styles.fleetButton}
                    onClick={() => setProviderFilter((prev) => (prev === provider ? "all" : provider))}
                    title={isSelected ? `Show every provider` : `Filter by ${provider}`}
                    aria-pressed={isSelected}
                  >
                    <span className={styles.fleetName}>{provider.replace(/ service$/, "")}</span>
                    <SrOnly>{provider.endsWith(" service") ? " service" : ""}</SrOnly>
                    <span className={styles.fleetCounts}>
                      <span>{moving} on road</span>
                      <span className={styles.fleetDot} aria-hidden="true">
                        {" · "}
                      </span>
                      <span>{waiting} booked</span>
                    </span>
                  </button>
                );
              })}
            </div>
          }
        />

        <div className={styles.layout}>
          <div className={styles.leftColumn}>
            <Card className={styles.jobsPanel} aria-labelledby="ward-officer-jobs-heading">
              <CardHead
                id="ward-officer-jobs-heading"
                title="Jobs"
                eyebrow
                aside={
                  <span className={styles.headNote}>
                    <b>{filteredJobs.length}</b> of {jobs.length} active
                  </span>
                }
              />
              <div className={styles.tabsRow}>
                <Tabs
                  label="Job lists"
                  idPrefix="ward-officer-jobs"
                  value={jobsTab}
                  onChange={setJobsTab}
                  items={[
                    { id: "active", label: "Active", count: jobs.length },
                    { id: "refused", label: "Refused", count: officerRefusals.length },
                    { id: "cancelled", label: "Cancelled", count: cancelledTransports.length },
                  ]}
                />
              </div>

              <TabPanel idPrefix="ward-officer-jobs" id="active" hidden={jobsTab !== "active"}>
                <div className={styles.toolbar} role="search" aria-label="Filter transport jobs">
                  <TextInput
                    ref={searchInputRef}
                    icon={Search}
                    boxClassName={styles.searchBox}
                    id="officer-transfer-search"
                    name="transferSearch"
                    placeholder="Patient, UMRN, ED, ward or CAD number"
                    aria-label="Search transport jobs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery("")}
                    trailing={searchQuery ? undefined : <Kbd>/</Kbd>}
                  />
                  <FilterChip pressed={escortFilter} onPressedChange={setEscortFilter} count={escortCount}>
                    Escort only
                  </FilterChip>
                  {isFiltered ? (
                    <Button variant="ghost" size="sm" onClick={resetFilters} aria-label="Reset all filters">
                      Reset filters
                    </Button>
                  ) : null}
                </div>

                {jobs.length === 0 ? (
                  <p className={styles.placeholder} data-testid="ward-officer-empty">
                    No transport job is currently outstanding &mdash; every job has either arrived or its movement has
                    closed.
                  </p>
                ) : filteredJobs.length === 0 ? (
                  <div className={styles.filterEmpty}>
                    <EmptyState
                      icon={Search}
                      title="No transport jobs match the selected filters."
                      action={
                        <Button variant="sec" size="sm" onClick={resetFilters}>
                          Clear all filters
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className={styles.tableScroll}>
                    <table
                      className={`${tableClasses.table} ${styles.jobsTable}`}
                      aria-label="Outstanding transport jobs"
                    >
                      <thead>
                        <tr>
                          <th scope="col">UMRN</th>
                          <th scope="col">Patient and route</th>
                          <th scope="col">Provider</th>
                          <th scope="col">Stage</th>
                          <th scope="col">Escort</th>
                          <th scope="col">CAD</th>
                          <th scope="col" className={tableClasses.num}>
                            Waiting
                          </th>
                        </tr>
                      </thead>
                      <tbody data-testid="ward-officer-joblist">
                        {filteredJobs.map((movement) => {
                          const transport = movement.transport;
                          if (!transport) return null;
                          const active = movement.id === selectedJob?.id;
                          const patientName = resolvedPatientName(movement);
                          const leg = officerLeg(transport);
                          const legIndex = leg ? OFFICER_LEG_STEPS.indexOf(leg) : -1;
                          const stepBlockedReason =
                            leg === "Requested"
                              ? acceptedBlockedReason(movement, patientName)
                              : leg === "Accepted"
                                ? enRouteBlockedReason(movement, patientName)
                                : leg === "En route"
                                  ? collectedBlockedReason(movement, patientName)
                                  : leg === "Collected"
                                    ? arrivedBlockedReason(movement, unitFor(movement), patientName)
                                    : undefined;
                          const stepStatusText = leg
                            ? stepBlockedReason
                              ? `blocked before ${nextActionVerb(leg).toLowerCase()}`
                              : `next ${nextActionVerb(leg).toLowerCase()}`
                            : undefined;
                          return (
                            <tr
                              key={movement.id}
                              data-testid={`ward-officer-job-${movement.id}`}
                              className={active ? `${tableClasses.selected} ${styles.jobRow}` : styles.jobRow}
                              aria-selected={active}
                            >
                              <td className={styles.jobId}>{umrnFor(movement)}</td>
                              <td>
                                <button
                                  type="button"
                                  className={styles.selectButton}
                                  data-testid={`ward-officer-select-${movement.id}`}
                                  aria-current={active ? "true" : undefined}
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
                                  <span className={styles.jobRoute}>
                                    {originLabelFor(movement)} to {destinationLabelFor(movement)}
                                  </span>
                                </button>
                              </td>
                              <td className={styles.clip}>{transport.provider}</td>
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
                                  </span>
                                ) : (
                                  transportLeg(transport)
                                )}
                              </td>
                              <td>{transport.escortRequired ? "Escort" : "None"}</td>
                              <td className={styles.mono}>{transport.cadNumber ?? "None"}</td>
                              <td className={`${tableClasses.num} ${styles.waiting}`}>
                                {durMinutes(Math.max(0, now - movement.openedAt))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabPanel>

              <TabPanel idPrefix="ward-officer-jobs" id="refused" hidden={jobsTab !== "refused"}>
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

              <TabPanel idPrefix="ward-officer-jobs" id="cancelled" hidden={jobsTab !== "cancelled"}>
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
                    <p className={styles.panelNote}>Cancelled dispatches and ambulance stand-downs for this session.</p>
                  </section>
                ) : (
                  <div className={styles.filterEmpty}>
                    <EmptyState icon={Check} title="No transport has been cancelled this session." />
                  </div>
                )}
              </TabPanel>
            </Card>

            <Card className={styles.arrivalsCard} aria-labelledby="ward-officer-arrivals-heading">
              <CardHead
                id="ward-officer-arrivals-heading"
                title="Arrivals"
                eyebrow
                aside={<span className={styles.headNote}>Recorded ward ETA</span>}
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
                      {arrivals.map(({ movement, eta, booked }) => {
                        // Only a ward ETA can make a job late; a booking estimate says it is one.
                        const late = pastWardEta(movement, now);
                        return (
                          <li key={movement.id} className={styles.arrivalRow}>
                            <span className={styles.arrivalWho}>
                              <strong>{destinationLabelFor(movement)}</strong>
                              <span>
                                {umrnFor(movement)} · {originLabelFor(movement)}
                              </span>
                            </span>
                            <span className={styles.arrivalTrack}>
                              <span className={styles.arrivalMark} style={{ left: arrivalsLeft(eta) }}>
                                <StatusGlyph tone={late ? "warning" : "info"} size={9} />
                                <b>{formatInstantWithDay(eta, now)}</b>
                                <span>
                                  {late
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

          <div ref={detailRef} className={styles.side}>
            {selectedJob && selectedJob.transport ? (
              <Card
                className={styles.detail}
                aria-labelledby="ward-officer-detail-heading"
                data-testid="ward-officer-detail"
              >
                <CardHead
                  id="ward-officer-detail-heading"
                  title={officerPatientName(selectedJob)}
                  meta={<span className={styles.mono}>{umrnFor(selectedJob)}</span>}
                  aside={
                    <Badge
                      tone={
                        officerLeg(selectedJob.transport) ? LEG_TONE[officerLeg(selectedJob.transport)!] : "neutral"
                      }
                    >
                      {transportLeg(selectedJob.transport)}
                    </Badge>
                  }
                />
                <CardBody className={styles.detailBody}>{renderDetail(selectedJob)}</CardBody>
                <CardFoot className={styles.inactiveRow}>
                  <Button
                    variant="sec"
                    size="sm"
                    icon={ShieldCheck}
                    data-testid={`ward-officer-inspect-form-${selectedJob.id}`}
                    onClick={(e) => openFormModal(selectedJob, e)}
                  >
                    Inspect form
                  </Button>
                  {!selectedJob.closure &&
                  selectedJob.transport.collectedAt !== undefined &&
                  selectedJob.transport.arrivedAt === undefined &&
                  selectedJob.transport.diversion === undefined ? (
                    <Button
                      variant="sec"
                      size="sm"
                      icon={MapPin}
                      aria-expanded={diversionOpen}
                      data-testid={`ward-officer-divert-${selectedJob.id}`}
                      onClick={() => setDiversionOpen((open) => !open)}
                    >
                      Divert
                    </Button>
                  ) : null}
                </CardFoot>
              </Card>
            ) : (
              <Card className={styles.detail}>
                <CardBody>
                  <EmptyState
                    icon={Check}
                    title="No job to work"
                    meta="Every job has arrived or its movement has closed."
                  />
                </CardBody>
              </Card>
            )}
          </div>
        </div>

        <WardPrototypeFooter
          testId="ward-officer-governance"
          note="All outstanding jobs; closed movements excluded · Providers identify organisations · Not a medical device"
        />
      </main>

      {/* Form verification dialog */}
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
              <span className={styles.modalTile} aria-hidden="true">
                <Icon icon={ShieldCheck} size={16} />
              </span>
              <span className={styles.modalTitles}>
                <h3 id="form-verify-title" className={styles.modalTitle}>
                  Form verification
                </h3>
                <span className={styles.modalSub}>
                  {formRequiredLabel(formModalJob.transport!)} · {formModalJob.id} · {officerPatientName(formModalJob)}
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

      {/* Record arrival dialog */}
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
              <span className={styles.modalTile} aria-hidden="true">
                <Icon icon={FileCheck} size={16} />
              </span>
              <span className={styles.modalTitles}>
                <h3 id="handover-modal-title" className={styles.modalTitle}>
                  Record arrival at receiving ward
                </h3>
                <span className={styles.modalSub}>
                  {umrnFor(handoverJob)} · {originLabelFor(handoverJob)} to {destinationLabelFor(handoverJob)}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={X}
                onClick={closeHandoverModal}
                aria-label="Close handover dialog"
              />
            </header>
            <div className={styles.modalBody}>
              <div className={styles.modalFields}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel} htmlFor="officer-handover-movement">
                    Patient movement reference
                  </label>
                  <TextInput
                    id="officer-handover-movement"
                    locked
                    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                    value={officerPatientName(handoverJob)}
                  />
                </div>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel} htmlFor="officer-handover-destination">
                    Destination inpatient unit
                  </label>
                  <TextInput id="officer-handover-destination" locked value={destinationLabelFor(handoverJob)} />
                </div>
              </div>
              <dl className={styles.facts}>
                <div>
                  <dt>Collected</dt>
                  <dd>
                    {handoverJob.transport?.collectedAt !== undefined
                      ? formatInstantWithDay(handoverJob.transport.collectedAt, now)
                      : "Not collected"}
                  </dd>
                </div>
                <div>
                  <dt>Ward ETA</dt>
                  <dd>
                    {wardEta(handoverJob) !== undefined
                      ? formatInstantWithDay(wardEta(handoverJob)!, now)
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Receiving nurse</dt>
                  <dd>Not recorded in this prototype.</dd>
                </div>
              </dl>
            </div>
            <footer className={styles.modalFoot}>
              <Button variant="ghost" size="sm" onClick={closeHandoverModal}>
                Cancel
              </Button>
              <Button variant="pri" size="sm" onClick={() => executeHandover(handoverJob)}>
                Record arrival
              </Button>
            </footer>
          </div>
        </div>
      ) : null}

      {toastText ? (
        <div className={styles.toast}>
          <StatusLine tone="success" title={toastText} />
        </div>
      ) : null}
    </div>
  );
}
