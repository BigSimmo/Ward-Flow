"use client";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { DischargeCareJourney } from "./discharge-care-journey";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Filter,
  List,
  OctagonAlert,
  Printer,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import { MissingValue } from "@/components/ui/missing-value";
import { RELEASE_BANDS, releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import {
  calendarDateOf,
  dayOf,
  formatInstant,
  formatSheetMoment,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { parseReleaseDayInstant } from "@/components/ward-management/ward/release-day";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import type {
  DischargeRecord,
  DischargeOpenHandle,
  WardRecordActor,
} from "@/components/ward-management/ward-discharge-records";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { roleLimitReason } from "@/components/ward-management/ward-role-permissions";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import { bedReleaseStateLabels } from "@/components/ward-management/ward-derivations";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { DUE_SORT_OPTIONS, sortDueFirst, type DueSortMode } from "@/components/ward-management/ward-due-sort";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { activeCommunityTreatmentOrder } from "@/components/ward-management/ward-patients";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Hero,
  LiveChip,
  PhoneSheet,
  Select,
  StatusGlyph,
  TextInput,
  buttonClass,
  durMinutes,
  useIsPhone,
  useOptionalToast,
  type WfTone,
} from "@/components/wf";

import { DischargeFollowUp } from "./discharge-follow-up";
import {
  ReadyToLeave,
  demoReadyTicks,
  type ReadyToLeaveItemId,
  type ReadyToLeaveUndo,
} from "./discharge-ready-to-leave";
import {
  DischargeBarrierBars,
  DischargeDayChart,
  type DischargeDay,
  type DischargeDayKey,
} from "./discharge-flow-charts";
import { SupportNotificationChecklist } from "../movements/support-notification-checklist";
import styles from "./discharges.module.css";
import pageStyles from "./discharges-third-edition.module.css";
import wardPin from "../ward-pinned-switch.module.css";

/**
 * Task 6, spec D9: the discharge and egress board. A coordinator's whole reason to open this
 * board is "which bed do I chase, and which one is simply on its way" — so releases are grouped
 * by how much work is left on them, worst first: a **blocked** release needs somebody to act on
 * it right now, a **confirmed** one is just waiting for the clock, a **expected** one is a
 * belief rather than a fact yet, and **discharged today** is done. Within a group, releases are
 * ordered by `releaseBand` — the same "now / by midday / by 1600 / tonight" ladder the capacity
 * board uses (`ward-bed-availability.ts`), so the two boards never disagree about how soon
 * "soon" is.
 *
 * This board is LIVE, unlike `HandoverPage` — it reads `useWardFlow()` on every render and never
 * freezes a snapshot. There is nothing here a coordinator needs to have held still while they
 * read it; the opposite is true, a discharge board that lagged reality would be actively
 * misleading about which bed is actually free to chase next.
 */

const GROUP_LABELS = {
  blocked: "Blocked",
  confirmed: "Confirmed",
  expected: "Expected",
  "discharged-today": "Discharged today",
} as const;

type GroupKey = keyof typeof GROUP_LABELS;

/** v10 phone group headers: one glyph and a short label per group. */
const PHONE_GROUP_TONES: Record<GroupKey, WfTone> = {
  blocked: "danger",
  confirmed: "success",
  expected: "neutral",
  "discharged-today": "closed",
};
const PHONE_GROUP_LABELS: Record<GroupKey, string> = {
  blocked: "Blocked",
  confirmed: "Confirmed",
  expected: "Expected",
  "discharged-today": "Discharged · 24h",
};

/** v10 phone: rows a group shows before its "Show N more" row. */
const PHONE_GROUP_CAP = 6;

/**
 * Every group, in the fixed scan order spec D9 names — blocked first because those are the rows
 * somebody must act on. Never reorder this array; `tests/ward-discharge-board.dom.test.tsx` pins
 * the rendered heading order against it.
 *
 * Bed-model rework (2026-08-28): these four groups are no longer four STATES. There are three
 * stages now, and `blocked` is a flag that sits on a expected or confirmed release. The board
 * keeps its four groups because they answer the coordinator's actual question — how much work is
 * left on this row — and a stuck release is the one that needs somebody whichever stage it is in.
 * `groupDischarges` therefore reads the FLAG first and the stage second, which is why a
 * blocked-but-confirmed release lands here rather than under Confirmed. Note the asymmetry with
 * `CapacityBreakdown.blockedToday`, and it is deliberate: the board is a work queue where each
 * release must appear exactly once, the breakdown is a set of counts where "how many confirmed"
 * and "how many stuck" are both wanted in full.
 */
const GROUP_ORDER: readonly GroupKey[] = ["blocked", "confirmed", "expected", "discharged-today"];

const BAND_LABELS: Record<ReleaseBand, string> = {
  now: "Now",
  "by-midday": "By midday",
  "by-1600": "By 4pm",
  tonight: "Tonight",
  tomorrow: "Tomorrow",
};

/** The timing word for a release: how far past its date when late, never "Now" for a late one. */
function releaseTimingWords(release: BedRelease, now: Instant): string {
  if (release.state !== "discharged" && release.expectedAt < now) return `${durMinutes(now - release.expectedAt)} past`;
  return BAND_LABELS[releaseBand(release, now) as ReleaseBand];
}

const EMPTY_REASON: Record<GroupKey, string> = {
  blocked: "release is currently blocked",
  confirmed: "release is confirmed, unreleased and not blocked",
  expected: "release is expected and not blocked",
  "discharged-today": "the person has been discharged today",
};

const GROUP_DESCRIPTIONS: Record<GroupKey, string> = {
  blocked: "These need someone to act on them now.",
  confirmed: "Waiting only on the clock, not blocked.",
  expected: "Not yet confirmed by the ward, and not blocked.",
  "discharged-today": "The bed is already free.",
};

export type DischargeGroups = {
  blocked: BedRelease[];
  confirmed: BedRelease[];
  expected: BedRelease[];
  "discharged-today": BedRelease[];
  /** Releases expected two or more days ahead (`releaseBand`'s "beyond-today") — never merged into a group,
   *  always counted. Silent truncation reads as "we counted everything" when we did not. */
  excludedBeyondToday: number;
  /**
   * ⚠️ **A SECOND POPULATION, COUNTED SEPARATELY BECAUSE ONE SENTENCE COULD NOT BE TRUE OF BOTH.**
   * A release discharged more than a day ago also leaves the four groups — but it is FINISHED, not
   * *expected beyond tonight*, and the footer used to declare it under that phrase.
   */
  completedBeforeToday: number;
};

/**
 * The one place this board's grouping and ordering rules live, so the component itself is pure
 * rendering. Pure function of the live `releases` and `now` the provider hands the board — takes
 * no fixture and no clock read of its own, per this phase's single-source rule.
 */
export function groupDischarges(releases: BedRelease[], now: Instant): DischargeGroups {
  const buckets: Record<GroupKey, BedRelease[]> = {
    blocked: [],
    confirmed: [],
    expected: [],
    "discharged-today": [],
  };
  let excludedBeyondToday = 0;
  let completedBeforeToday = 0;

  for (const release of releases) {
    const band = releaseBand(release, now);
    /*
     * ⚠️ **A COMPLETED DISCHARGE IS NEVER "EXPECTED BEYOND TONIGHT" — IT ALREADY HAPPENED.**
     *
     * The discharged test used to sit below the band test, so a release discharged more than a day
     * ago was counted into the footer's `excludedBeyondToday` and declared as *"expected beyond
     * tonight"*. It is not expected; it happened yesterday. `releaseBand` is recomputed on every
     * render from `now - confirmedAt` and never stored, and `RELEASE_BED` refuses to fire twice on
     * one release, so nothing can re-check the band — the state is reached by the app being open,
     * or reopened, more than a day after a discharge. The fixture count is nought today, which is
     * why no test caught it.
     *
     * ⚠️ **AND IT IS STILL DECLARED, IN ITS OWN WORDS — dropping it silently was considered and
     * rejected.** `tests/ward-discharge-board.dom.test.tsx` already carried the decision, written
     * by somebody who had thought about exactly this: *"Dropped from the group is not the same as
     * dropped from the board."* The defect was one sentence covering two populations, not the
     * declaration itself.
     */
    if (release.state === "discharged" && band === "beyond-today") {
      completedBeforeToday += 1;
      continue;
    }
    if (band === "beyond-today") {
      excludedBeyondToday += 1;
      continue;
    }
    // The flag is read BEFORE the stage (bed-model rework, 2026-08-28), so a confirmed discharge
    // that is stuck appears in the group a coordinator scans first rather than sitting quietly
    // under Confirmed. Order matters: swapping these two tests would bury exactly the row this
    // board exists to surface. `discharged` still wins over everything — a bed that is already
    // free is nobody's work, and the reducer clears the flag when it releases anyway.
    if (release.state === "discharged") buckets["discharged-today"].push(release);
    else if (release.blocker !== null) buckets.blocked.push(release);
    else if (release.state === "confirmed") buckets.confirmed.push(release);
    else buckets.expected.push(release);
  }

  const byBand = (list: BedRelease[]) =>
    [...list].sort(
      (a, b) =>
        RELEASE_BANDS.indexOf(releaseBand(a, now) as ReleaseBand) -
        RELEASE_BANDS.indexOf(releaseBand(b, now) as ReleaseBand),
    );

  return {
    blocked: byBand(buckets.blocked),
    confirmed: byBand(buckets.confirmed),
    expected: byBand(buckets.expected),
    "discharged-today": byBand(buckets["discharged-today"]),
    excludedBeyondToday,
    completedBeforeToday,
  };
}

function unitLabel(unit: Unit | undefined, unitId: string): string {
  // The unresolved sentence comes from `ward-absence-labels.ts` — Ward Lead's 2026-09-11 ruling.
  // This used to name handover-page as its precedent, which is a pointer that cannot follow.
  return wardLabel(unitId, unit?.name);
}

function healthServiceLabel(unit: Unit | undefined): string {
  const service = unit ? siteByCode(unit.siteCode)?.service : undefined;
  return service ?? "Service not recorded";
}

const RECORD_ACTOR: WardRecordActor = { role: "coordinator" };
type Population = "records" | "releases";
type WorkStatus = "blocked" | "confirmed" | "expected" | "departed";
const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  blocked: "Blocked",
  confirmed: "Confirmed",
  expected: "Expected",
  departed: "Departed",
};
const WORK_ORDER: WorkStatus[] = ["blocked", "confirmed", "expected", "departed"];

/**
 * The top KPI strip's four card labels, corrected 2026-09-16 (ward-audit-screens review) on two
 * counts: "Confirmed today" and "Discharged today" claimed a calendar-day scope neither
 * `groupDischarges`'s `confirmed`/`discharged-today` buckets nor `recordStatus`'s "confirmed"/
 * "departed" states actually enforce — the release/record table caption already says the discharged
 * bucket is a rolling last-24-hours window, not "today" — and "Blocked releases" kept the releases
 * noun even when `population === "records"`, so the card counted admission records under a title
 * naming a different population. "Blocked" and "Discharged" now match `population`; "Confirmed" and
 * "Expected" are true of both without inventing a day boundary or a workflow this model does not
 * carry ("on round"), so they reuse the same words the status filter and record badges already use.
 * "Discharged · 24h" for the releases view is the exact phrase the status-filter button below
 * already renders for this same population/status pair (`{population === "releases" && key ===
 * "departed" ? "Discharged · 24h" : …}`) — reused rather than re-invented.
 */
function kpiCardLabel(status: WorkStatus, population: Population): string {
  if (status === "blocked") return population === "releases" ? "Blocked releases" : "Blocked records";
  if (status === "departed") return population === "releases" ? "Discharged · 24h" : "Departed";
  return WORK_STATUS_LABELS[status];
}

function recordStage(record: DischargeRecord): "confirmed" | "expected" | "departed" {
  if (record.admissionState === "departed") return "departed";
  return record.dischargeConfirmedAt !== null && Number.isFinite(record.dischargeConfirmedAt)
    ? "confirmed"
    : "expected";
}
function recordStatus(record: DischargeRecord): WorkStatus {
  const stage = recordStage(record);
  return stage !== "departed" && record.blockReason !== null ? "blocked" : stage;
}
function recordName(record: DischargeRecord): string {
  return record.identity.kind === "linked"
    ? `${record.identity.patient.familyName}, ${record.identity.patient.givenName}`
    : record.identity.kind === "legacy-anonymous"
      ? "Patient not linked"
      : "Patient link unavailable";
}
function recordedMoment(value: Instant | null, dayZero: Date): string {
  return value !== null && Number.isFinite(value) ? formatSheetMoment(value, dayZero) : "Not recorded";
}

/** The calendar day alone ("Fri, 9 Oct"), for a release already past its date. */
function recordedDate(value: Instant, dayZero: Date): string {
  return calendarDateOf(value, dayZero).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Perth",
  });
}

const BLOCKER_CATEGORIES = [
  { id: "accommodation", label: "Accommodation" },
  { id: "transport", label: "Transport" },
  { id: "service coordination", label: "Coordination" },
  { id: "clean", label: "Clean / prep" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "placement", label: "Placement" },
  { id: "family", label: "Family / carer" },
  { id: "plan", label: "Funding / plan" },
  { id: "acceptance", label: "Receiving service" },
] as const;

/** The barrier category a recorded blocker belongs to, by the same text match the filters use. */
function barrierCategory(blocker: string): string {
  const text = blocker.toLowerCase();
  return BLOCKER_CATEGORIES.find((category) => text.includes(category.id))?.id ?? "other";
}
function barrierLabel(id: string): string {
  return BLOCKER_CATEGORIES.find((category) => category.id === id)?.label ?? "Other barrier";
}

/** Days the chart covers after today; the column before them gathers every date already passed. */
const CHART_DAYS_AHEAD = 14;
/* v10: the hero status chips highlight too ("status"); only the tabs over the table narrow. */
type Highlight =
  { kind: "day"; day: DischargeDayKey } | { kind: "barrier"; id: string } | { kind: "status"; status: WorkStatus };
type TableView = "list" | "barriers";

/**
 * A click on the day chart or the barrier bars HIGHLIGHTS the matching people and moves them to
 * the top of their group. It never hides a row (Discharges direction A, 9 Oct 2026).
 */
function matchesHighlight(
  highlight: Highlight | null,
  expectedAt: Instant | null,
  blocker: string | null,
  now: Instant,
): boolean {
  if (highlight === null || highlight.kind === "status") return false;
  if (highlight.kind === "barrier") return blocker !== null && barrierCategory(blocker) === highlight.id;
  if (expectedAt === null || !Number.isFinite(expectedAt)) return false;
  // Whole calendar days: an earlier time today stays in Today, Passed is an earlier date.
  if (highlight.day === "past") return dayOf(expectedAt) < dayOf(now);
  return dayOf(expectedAt) - dayOf(now) === highlight.day;
}

function perthDay(instant: Instant, dayZero: Date, options: Intl.DateTimeFormatOptions): string {
  return calendarDateOf(instant, dayZero).toLocaleDateString("en-AU", { ...options, timeZone: "Australia/Perth" });
}

function RecordedDischargeMilestones({
  milestones,
  title = "Recorded discharge milestones",
}: {
  milestones: { label: string; detail: string; state: "complete" | "pending" | "blocked" }[];
  /** v10 phone sheet reads "Milestones". */
  title?: string;
}) {
  return (
    <div className={pageStyles.milestones}>
      <span className={pageStyles.sectionLabel}>{title}</span>
      <ol className={pageStyles.timeline}>
        {milestones.map((milestone) => (
          <li className={pageStyles.timelineItem} key={milestone.label} data-state={milestone.state}>
            <StatusGlyph
              tone={milestone.state === "complete" ? "success" : milestone.state === "blocked" ? "danger" : "neutral"}
              size={10}
            />
            <span className={pageStyles.timelineText}>
              <span className={pageStyles.timelineTitle}>{milestone.label}</span>
              <span className={pageStyles.secondary}>{milestone.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className={pageStyles.note}>
        Medical summary, pharmacy verification and transport booking are not recorded here. Departure does not verify
        bed preparation.
      </p>
    </div>
  );
}

/** `initialAdmissionId`: a Tasks link (`?admissionId=`) opens that stay's detail once on arrival. */
export function DischargeBoard({ initialAdmissionId }: { initialAdmissionId?: string } = {}) {
  const { worldGeneration } = useWardFlow();
  // Remount clears every selected handle and DTO synchronously on a reset/scenario change.
  // This board has one fixed coordinator actor; it does not offer a role switch.
  return <DischargeWorkspace key={`${worldGeneration}:${RECORD_ACTOR.role}`} initialAdmissionId={initialAdmissionId} />;
}

function DischargeWorkspace({ initialAdmissionId }: { initialAdmissionId?: string }) {
  const {
    bedReleases,
    units,
    patients,
    dayZero,
    readDischargeRecords,
    openDischargeRecord,
    readDischargeRecord,
    dispatch,
    recordWardDeparture,
    rejections,
  } = useWardFlow();
  const toast = useOptionalToast();
  const now = useWardFlowClock();
  const [population, setPopulation] = useState<Population>("releases");
  const [status, setStatus] = useState<WorkStatus | "all">("all");
  const [service, setService] = useState("all");
  const [ward, setWard] = useState("all");
  const [identity, setIdentity] = useState("all");
  const [destination, setDestination] = useState<string>("all");
  const [blockerCategory, setBlockerCategory] = useState<string>("all");
  const [sortMode, setSortMode] = useState<DueSortMode>("default");
  const [selected, setSelected] = useState<{ admissionId: string; handle: DischargeOpenHandle } | null>(null);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [showUpdateDate, setShowUpdateDate] = useState(false);
  const [newTimeDraft, setNewTimeDraft] = useState<string>("");
  const [openError, setOpenError] = useState(false);
  const isPhone = useIsPhone();
  const [phoneChart, setPhoneChart] = useState<"days" | "barriers" | null>(null);
  // v10 phone: the filters sit one tap away behind the filter button beside Now and History.
  const [phoneFiltersOpen, setPhoneFiltersOpen] = useState(false);
  // v10 phone: a long group shows its first rows and a "Show N more" row, not every row.
  // v10 phone: the release sheet scrolls as one; transport and dossier open under it on request.
  const [phoneReleaseMore, setPhoneReleaseMore] = useState(false);
  const [phoneGroupsOpen, setPhoneGroupsOpen] = useState<Partial<Record<GroupKey, boolean>>>({});
  // v10 phone: each group header folds its rows; "Discharged · 24h" starts folded.
  const [phoneGroupsFolded, setPhoneGroupsFolded] = useState<Partial<Record<GroupKey, boolean>>>({
    "discharged-today": true,
  });
  const [drawerTab, setDrawerTab] = useState<"milestones" | "barriers" | "transport" | "dossier">("milestones");
  const [view, setView] = useState<TableView>("list");
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [copyNote, setCopyNote] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);
  // A4-21 (audit 13 Oct 2026): a confirmed release records the departure from this sheet, with the
  // destination, through the same shared action the ward's bed drawer uses. The destination starts
  // from the default for each release, so one person's choice is never recorded against the next.
  const [departure, setDeparture] = useState<{ releaseId: string | null; destination: LeavingDestination }>({
    releaseId: null,
    destination: "discharged-to-the-community",
  });
  // `undoAdmissionId` is set for a recorded departure (its toast offers Undo, as on the ward's bed
  // drawer); an undo itself carries none, so its own toast offers nothing further.
  const departureCheckRef = useRef<{ prior: number; who: string; undoAdmissionId?: string } | null>(null);
  const [departureToken, setDepartureToken] = useState(0);
  const departureNowRef = useRef(now);
  const rejectionCountRef = useRef(rejections.length);
  useEffect(() => {
    departureNowRef.current = now;
    rejectionCountRef.current = rejections.length;
  }, [now, rejections.length]);
  useEffect(() => {
    const check = departureCheckRef.current;
    if (departureToken === 0 || check === null) return;
    departureCheckRef.current = null;
    const refused = rejections.length > check.prior ? rejections[rejections.length - 1] : undefined;
    const undoAdmissionId = check.undoAdmissionId;
    const said = refused
      ? `Not recorded: ${refused.reason}. Nothing was changed.`
      : undoAdmissionId === undefined
        ? `Undone. ${check.who} is back in their bed.`
        : `Recorded: ${check.who} has left the ward.`;
    if (!toast) {
      announceToWardShell(said);
      return;
    }
    if (refused || undoAdmissionId === undefined) {
      toast.push({ tone: refused ? "warning" : "success", title: said });
      return;
    }
    // Audit A1-12: a recorded departure offers Undo (`UNDO_DEPARTURE`), like the ward's bed drawer.
    const undoLimit = roleLimitReason("coordinator", "UNDO_DEPARTURE");
    toast.push({
      tone: "success",
      title: said,
      ...(undoLimit
        ? { body: `Undo: ${undoLimit}` }
        : {
            undo: {
              durationMs: UNDO_TOAST_MS,
              onUndo: () => {
                departureCheckRef.current = { prior: rejectionCountRef.current, who: check.who };
                dispatch({
                  type: "UNDO_DEPARTURE",
                  role: "coordinator",
                  now: departureNowRef.current,
                  admissionId: undoAdmissionId,
                });
                setDepartureToken((token) => token + 1);
              },
            },
          }),
    });
    // `dispatch` is stable for the board's life; the token drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureToken, rejections, toast]);
  const guarded = readDischargeRecords(RECORD_ACTOR);
  const records = guarded.status === "allowed" ? guarded.value : [];
  // Opens the linked stay once, on arrival; after that the coordinator's own choices stand.
  const openedFromLinkRef = useRef(false);
  const linkedRecordExists =
    initialAdmissionId !== undefined && records.some((record) => record.admissionId === initialAdmissionId);
  useEffect(() => {
    if (openedFromLinkRef.current || initialAdmissionId === undefined || !linkedRecordExists) return;
    openedFromLinkRef.current = true;
    // Opening is a guarded, audited receipt (an external write), so it cannot run during render;
    // the selection shows its outcome, once.
    let handle: DischargeOpenHandle;
    try {
      handle = openDischargeRecord(RECORD_ACTOR, initialAdmissionId);
    } catch {
      handle = { generation: -1, requestId: -1 };
    }
    setPopulation("records");
    setSelected({ admissionId: initialAdmissionId, handle });
  }, [initialAdmissionId, linkedRecordExists, openDischargeRecord]);
  const services = [...new Set(units.map(healthServiceLabel))].sort();
  const scopedUnits = units.filter((unit) => service === "all" || healthServiceLabel(unit) === service);
  const inScope = (unitId: string) => {
    const unit = units.find((candidate) => candidate.id === unitId);
    return (ward === "all" || ward === unitId) && (service === "all" || healthServiceLabel(unit) === service);
  };
  const scopedReleases = bedReleases.filter(
    (release) =>
      inScope(release.unitId) &&
      (blockerCategory === "all" ||
        (release.blocker !== null && release.blocker.toLowerCase().includes(blockerCategory.toLowerCase()))),
  );
  const groupedReleases = groupDischarges(scopedReleases, now);
  // Stream A, 9 Oct 2026: "Due first" orders each release group by its expected time, earliest
  // first; the groups themselves keep their order. Default keeps the band order.
  const releaseDue = (release: BedRelease) => release.expectedAt;
  const releaseGroups =
    sortMode === "due-first"
      ? {
          ...groupedReleases,
          blocked: sortDueFirst(groupedReleases.blocked, releaseDue),
          confirmed: sortDueFirst(groupedReleases.confirmed, releaseDue),
          expected: sortDueFirst(groupedReleases.expected, releaseDue),
        }
      : groupedReleases;
  const scopedRecords = records.filter(
    (record) =>
      inScope(record.unitId) &&
      (identity === "all" ||
        (identity === "linked" ? record.identity.kind === "linked" : record.identity.kind !== "linked")) &&
      (destination === "all" || record.leavingDestination === destination) &&
      (blockerCategory === "all" ||
        (record.blockReason !== null && record.blockReason.toLowerCase().includes(blockerCategory.toLowerCase()))),
  );
  const counts: Record<WorkStatus, number> =
    population === "releases"
      ? {
          blocked: releaseGroups.blocked.length,
          confirmed: releaseGroups.confirmed.length,
          expected: releaseGroups.expected.length,
          departed: releaseGroups["discharged-today"].length,
        }
      : (Object.fromEntries(
          WORK_ORDER.map((key) => [key, scopedRecords.filter((record) => recordStatus(record) === key).length]),
        ) as Record<WorkStatus, number>);
  const releaseStatus = new Map<string, WorkStatus>(
    GROUP_ORDER.flatMap((key) =>
      releaseGroups[key].map((release) => [release.id, key === "discharged-today" ? "departed" : key] as const),
    ),
  );
  const recordLit = (record: DischargeRecord) =>
    highlight?.kind === "status"
      ? recordStatus(record) === highlight.status
      : recordStage(record) !== "departed" &&
        matchesHighlight(highlight, record.expectedDischargeAt, record.blockReason, now);
  const releaseLit = (release: BedRelease) =>
    highlight?.kind === "status"
      ? releaseStatus.get(release.id) === highlight.status
      : release.state !== "discharged" && matchesHighlight(highlight, release.expectedAt, release.blocker, now);
  // Highlights dim the rest; every row stays.
  const dimmed = (lit: boolean) => (highlight !== null && !lit ? "true" : undefined);
  const statusHighlight = highlight?.kind === "status" ? highlight.status : null;
  const [readyTicks, setReadyTicks] = useState<Record<string, ReadyToLeaveItemId[]>>({});
  const [readyChange, setReadyChange] = useState<(ReadyToLeaveUndo & { releaseId: string }) | null>(null);
  const ticksFor = (id: string) => readyTicks[id] ?? demoReadyTicks(id);
  const setTick = (id: string, itemId: ReadyToLeaveItemId, on: boolean) =>
    setReadyTicks((current) => {
      const list = current[id] ?? demoReadyTicks(id);
      return {
        ...current,
        [id]: on ? [...list.filter((item) => item !== itemId), itemId] : list.filter((item) => item !== itemId),
      };
    });
  const litFirst = <T,>(list: T[], lit: (item: T) => boolean) =>
    highlight === null ? list : [...list.filter(lit), ...list.filter((item) => !lit(item))];
  const workOrderedRecords = scopedRecords
    .filter((record) => status === "all" || recordStatus(record) === status)
    .sort(
      (a, b) =>
        WORK_ORDER.indexOf(recordStatus(a)) - WORK_ORDER.indexOf(recordStatus(b)) ||
        (a.expectedDischargeAt ?? Infinity) - (b.expectedDischargeAt ?? Infinity),
    );
  // "Due first" is one list by expected discharge, earliest first. A record that has left, or has
  // no expected date, is not due and goes last in its work order.
  // Highlighted people (day chart or barrier bars) go first, then the chosen order.
  const visibleRecords = litFirst(
    sortMode === "due-first"
      ? sortDueFirst(workOrderedRecords, (record) =>
          recordStatus(record) === "departed" ? null : record.expectedDischargeAt,
        )
      : workOrderedRecords,
    recordLit,
  );
  const visibleReleaseGroups = GROUP_ORDER.filter(
    (key) => status === "all" || (key === "discharged-today" ? "departed" : key) === status,
  );
  const visibleReleaseIds = visibleReleaseGroups.flatMap((key) => releaseGroups[key].map((release) => release.id));
  const opened =
    selected && population === "records" && visibleRecords.some((record) => record.admissionId === selected.admissionId)
      ? readDischargeRecord(RECORD_ACTOR, selected.admissionId, selected.handle)
      : null;
  // Never retain the selected DTO: each render obtains a newly guarded current read.
  const detailRecord = opened?.status === "allowed" ? opened.value : null;
  const activeRecord = detailRecord;
  const detailRelease =
    population === "releases" && releaseId && visibleReleaseIds.includes(releaseId)
      ? scopedReleases.find((release) => release.id === releaseId)
      : undefined;
  const linkedReleaseRecord = detailRelease
    ? (records.find((record) => record.admissionId === detailRelease.admissionId) ?? null)
    : null;
  const releasePatientId =
    linkedReleaseRecord?.identity.kind === "linked" ? linkedReleaseRecord.identity.patient.id : null;
  // S-29 (Josh, audit round 2): a person on a CTO gets the community team or GP handover line.
  const releaseOnCto =
    releasePatientId !== null &&
    activeCommunityTreatmentOrder(patients.find((patient) => patient.id === releasePatientId)) !== undefined;
  const selectedUnitId = activeRecord?.unitId ?? detailRelease?.unitId;
  const canRecordDeparture = detailRelease?.state === "confirmed";
  const departureDestination: LeavingDestination =
    departure.releaseId === detailRelease?.id ? departure.destination : "discharged-to-the-community";
  // One primary per area: on a phone a blocked release keeps Clear blocker as the primary.
  const phoneClearBlocker = isPhone && !!detailRelease?.blocker && detailRelease.state !== "discharged";
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
  const shown = population === "records" ? visibleRecords.length : visibleReleaseIds.length;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const closeDrawer = () => {
    setSelected(null);
    setReleaseId(null);
    setOpenError(false);
    setShowUpdateDate(false);
    restoreFocusRef.current = true;
  };
  useEffect(() => {
    if (!restoreFocusRef.current || selected !== null || releaseId !== null) return;
    restoreFocusRef.current = false;
    const trigger = triggerRef.current;
    (trigger?.isConnected ? trigger : listRef.current)?.focus();
  }, [selected, releaseId]);
  const clearSelection = () => {
    setSelected(null);
    setReleaseId(null);
    setOpenError(false);
    setShowUpdateDate(false);
  };
  const clearAllFilters = () => {
    setService("all");
    setWard("all");
    setStatus("all");
    setIdentity("all");
    setDestination("all");
    setBlockerCategory("all");
    clearSelection();
  };
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (selected !== null || releaseId !== null)) {
        closeDrawer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, releaseId]);
  const focusDetail = () => {
    queueMicrotask(() => {
      const first = detailRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (first ?? detailRef.current)?.focus();
    });
  };
  const openRecord = (record: DischargeRecord, opener?: HTMLElement | null) => {
    if (opener) triggerRef.current = opener;
    setReleaseId(null);
    setOpenError(false);
    setShowUpdateDate(false);
    try {
      setSelected({ admissionId: record.admissionId, handle: openDischargeRecord(RECORD_ACTOR, record.admissionId) });
    } catch {
      setSelected({ admissionId: record.admissionId, handle: { generation: -1, requestId: -1 } });
      setOpenError(false);
    }
    focusDetail();
  };
  const stageTone = (stage: WorkStatus): WfTone =>
    stage === "blocked" ? "danger" : stage === "expected" ? "neutral" : "success";
  const badge = (stage: WorkStatus) => (
    <span className={pageStyles.badge} data-status={stage}>
      <StatusGlyph tone={stageTone(stage)} size={9} />
      <span className="sr-only">
        {stage === "blocked"
          ? "Blocked: "
          : stage === "departed"
            ? "Departed: "
            : stage === "confirmed"
              ? "Confirmed: "
              : "Expected: "}
      </span>
      <span>{WORK_STATUS_LABELS[stage]}</span>
    </span>
  );
  const selectRelease = (id: string, opener: HTMLElement) => {
    triggerRef.current = opener;
    setSelected(null);
    setPhoneReleaseMore(false);
    setReleaseId(id);
    focusDetail();
  };
  const filtersActive =
    service !== "all" ||
    ward !== "all" ||
    status !== "all" ||
    identity !== "all" ||
    destination !== "all" ||
    blockerCategory !== "all";
  const openCount = counts.blocked + counts.confirmed + counts.expected;
  /* The charts under the table count PEOPLE: the admission records in scope that have not left,
     so a click can highlight the same rows the Admission records list shows. */
  const openScopedRecords = scopedRecords.filter((record) => recordStage(record) !== "departed");
  const today = dayOf(now);
  const chartDays: DischargeDay[] = [
    {
      key: "past",
      label: "Passed",
      name: "Date already passed",
      expected: 0,
      blocked: 0,
      weekend: false,
    },
    ...Array.from({ length: CHART_DAYS_AHEAD }, (_, index): DischargeDay => {
      const noon = (today + index) * MINUTES_PER_DAY + 12 * 60;
      const weekday = perthDay(noon, dayZero, { weekday: "short" });
      return {
        key: index,
        label: index === 0 ? "Today" : `${weekday} ${perthDay(noon, dayZero, { day: "numeric" })}`,
        name: perthDay(noon, dayZero, { weekday: "long", day: "numeric", month: "long" }),
        expected: 0,
        blocked: 0,
        weekend: weekday === "Sat" || weekday === "Sun",
      };
    }),
  ];
  for (const record of openScopedRecords) {
    const day = chartDays.find((candidate) =>
      matchesHighlight({ kind: "day", day: candidate.key }, record.expectedDischargeAt, null, now),
    );
    if (!day) continue;
    if (recordStatus(record) === "blocked") day.blocked += 1;
    else day.expected += 1;
  }
  const barrierCounts = [...BLOCKER_CATEGORIES.map((category) => category.id), "other"]
    .map((id) => ({
      id,
      label: barrierLabel(id),
      count: openScopedRecords.filter(
        (record) => record.blockReason !== null && barrierCategory(record.blockReason) === id,
      ).length,
    }))
    .sort((a, b) => b.count - a.count);
  const highlightOn = (next: Highlight) => {
    setHighlight(next);
    // The charts count every open record in scope, so clear the list filters that could hide them.
    setStatus("all");
    setDestination("all");
    setBlockerCategory("all");
    if (population !== "records") {
      setPopulation("records");
      clearSelection();
    }
    // Highlighted people go to the top, so bring the top of the list into view.
    const list = listRef.current;
    if (list) {
      list.scrollTop = 0;
      if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 40rem)").matches) {
        list.scrollIntoView?.({ block: "start", behavior: wardScrollBehavior() });
      }
    }
  };
  const highlightedCount =
    population === "records"
      ? visibleRecords.filter(recordLit).length
      : visibleReleaseGroups.reduce((sum, key) => sum + releaseGroups[key].filter(releaseLit).length, 0);
  const datePassed =
    population === "records"
      ? openScopedRecords
          .filter((record) => record.expectedDischargeAt !== null && record.expectedDischargeAt < now)
          .map((record) => record.expectedDischargeAt as number)
      : scopedReleases
          .filter((release) => release.state !== "discharged" && release.expectedAt < now)
          .map((release) => release.expectedAt);
  const bedDaysPast = Math.round(datePassed.reduce((sum, at) => sum + (now - at), 0) / MINUTES_PER_DAY);
  const copySummary = () => {
    const text =
      `Discharges, ${population === "records" ? "admission records" : "bed releases"}, as of ${formatSheetMoment(now, dayZero)}. ` +
      `${openCount} open: ${counts.blocked} blocked, ${counts.confirmed} confirmed, ${counts.expected} expected. ` +
      `${datePassed.length} past the ward's date, ${bedDaysPast} bed days. ${counts.departed} departed.`;
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clipboard) {
      setCopyNote("Copying is not available in this browser.");
      return;
    }
    clipboard.writeText(text).then(
      () => setCopyNote("Summary copied."),
      () => setCopyNote("Copying is not available in this browser."),
    );
  };
  const detailTone: WfTone | null = activeRecord
    ? stageTone(recordStatus(activeRecord))
    : detailRelease
      ? detailRelease.blocker
        ? "danger"
        : detailRelease.state === "expected"
          ? "neutral"
          : "success"
      : null;
  const detailBadgeLabel = activeRecord
    ? recordStatus(activeRecord) === "blocked"
      ? "Blocked"
      : WORK_STATUS_LABELS[recordStage(activeRecord)]
    : detailRelease
      ? detailRelease.blocker
        ? "Blocked"
        : detailRelease.state === "discharged"
          ? "Departed"
          : WORK_STATUS_LABELS[detailRelease.state]
      : "";
  /* v10 phone: no tabs in the release sheet — milestones and the barrier always show, transport
     and dossier on request. Desktop and tablet keep the tabs. */
  const releasePaneClass = (tab: "milestones" | "barriers" | "transport" | "dossier") =>
    (isPhone ? tab === "milestones" || tab === "barriers" || phoneReleaseMore : drawerTab === tab)
      ? pageStyles.tabPane
      : pageStyles.tabPaneHidden;

  const tabList = (hasBlocker: boolean) => (
    <div className={pageStyles.drawerTabs} role="tablist" aria-label="Discharge inspection sections">
      {(
        [
          ["milestones", "Milestones"],
          ["barriers", "Barriers"],
          ["transport", "Transport"],
          ["dossier", "Dossier"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={drawerTab === id}
          className={`${pageStyles.drawerTab} ${drawerTab === id ? pageStyles.drawerTabActive : ""}`}
          onClick={() => setDrawerTab(id)}
        >
          {label}
          {id === "barriers" && hasBlocker ? <span className={pageStyles.tabBadgeAlert}>!</span> : null}
        </button>
      ))}
    </div>
  );
  type BarrierRow = {
    id: string;
    blocker: string;
    lit: boolean;
    selected: boolean;
    title: string;
    mono: string | null;
    sub: string;
    when: string;
    open: (opener: HTMLElement) => void;
  };
  const barrierRows: BarrierRow[] =
    population === "records"
      ? visibleRecords
          .filter((record) => recordStage(record) !== "departed" && record.blockReason !== null)
          .map((record) => {
            const unit = units.find((candidate) => candidate.id === record.unitId);
            return {
              id: record.id,
              blocker: record.blockReason as string,
              lit: recordLit(record),
              selected: selected?.admissionId === record.admissionId,
              title: recordName(record),
              mono: record.identity.kind === "linked" ? record.identity.patient.umrn : null,
              sub: `${unitLabel(unit, record.unitId)} · ${healthServiceLabel(unit)}`,
              when: recordedMoment(record.expectedDischargeAt, dayZero),
              open: (opener: HTMLElement) => openRecord(record, opener),
            };
          })
      : (visibleReleaseGroups.includes("blocked") ? releaseGroups.blocked : []).map((release) => {
          const unit = units.find((candidate) => candidate.id === release.unitId);
          const linked = records.find((candidate) => candidate.admissionId === release.admissionId);
          return {
            id: release.id,
            blocker: release.blocker as string,
            lit: releaseLit(release),
            selected: releaseId === release.id,
            title: unitLabel(unit, release.unitId),
            mono: null,
            sub: linked ? `${healthServiceLabel(unit)} · ${recordName(linked)}` : healthServiceLabel(unit),
            when: recordedMoment(release.expectedAt, dayZero),
            open: (opener: HTMLElement) => selectRelease(release.id, opener),
          };
        });
  const unblockedCount =
    population === "records"
      ? visibleRecords.filter((record) => recordStage(record) !== "departed" && record.blockReason === null).length
      : (["confirmed", "expected"] as const)
          .filter((key) => visibleReleaseGroups.includes(key))
          .reduce((sum, key) => sum + releaseGroups[key].length, 0);
  const barrierGroups = [...BLOCKER_CATEGORIES.map((category) => category.id), "other"]
    .map((id) => ({ id, rows: barrierRows.filter((row) => barrierCategory(row.blocker) === id) }))
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => b.rows.length - a.rows.length);
  const barrierMax = Math.max(1, ...barrierGroups.map((group) => group.rows.length));
  const barrierTable = (
    <table className={pageStyles.workTable} data-testid="ward-discharge-barrier-table">
      <caption className={pageStyles.localTitle}>
        Blocked discharges grouped by barrier, largest group first. Highlighted people come first in each group.
      </caption>
      <thead>
        <tr>
          <th scope="col">{population === "releases" ? "Ward / service" : "Patient / ward"}</th>
          <th scope="col">Expected</th>
          <th scope="col">Recorded blocker</th>
        </tr>
      </thead>
      {barrierGroups.map((group) => (
        <tbody key={group.id} data-testid={`ward-discharge-barrier-group-${group.id}`}>
          <tr className={pageStyles.groupRow}>
            <th colSpan={3} scope="rowgroup">
              <div className={pageStyles.groupHead}>
                <StatusGlyph tone="danger" size={9} />
                <h3>
                  {barrierLabel(group.id)} <span className={pageStyles.groupCount}>{group.rows.length}</span>
                </h3>
                <span className={pageStyles.barrierShare} aria-hidden="true">
                  <i style={{ width: `${Math.round((group.rows.length / barrierMax) * 100)}%` }} />
                </span>
              </div>
            </th>
          </tr>
          {litFirst(group.rows, (row) => row.lit).map((row) => (
            <tr
              key={row.id}
              data-selected={row.selected}
              data-highlighted={row.lit || undefined}
              data-dim={dimmed(row.lit)}
              className={pageStyles.interactiveRow}
              tabIndex={0}
              onClick={(e) => row.open(e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  row.open(e.currentTarget);
                }
              }}
            >
              <td data-label={population === "releases" ? "Ward / service" : "Patient / ward"}>
                <button
                  type="button"
                  className={pageStyles.recordButton}
                  aria-pressed={row.selected}
                  onClick={(e) => {
                    e.stopPropagation();
                    row.open(e.currentTarget);
                  }}
                >
                  {row.title}
                </button>
                {row.mono ? <span className={pageStyles.secondaryMono}>{row.mono}</span> : null}
                <span className={pageStyles.secondary}>{row.sub}</span>
              </td>
              <td data-label="Expected" className={pageStyles.timingCell}>
                <strong className={pageStyles.due}>{row.when}</strong>
              </td>
              <td data-label="Recorded blocker">
                <span className={pageStyles.blocker}>{row.blocker}</span>
              </td>
            </tr>
          ))}
        </tbody>
      ))}
      <tbody data-testid="ward-discharge-barrier-group-none">
        <tr className={pageStyles.groupRow}>
          <th colSpan={3} scope="rowgroup">
            <div className={pageStyles.groupHead}>
              <StatusGlyph tone="success" size={9} />
              <h3>
                No barrier recorded <span className={pageStyles.groupCount}>{unblockedCount}</span>
              </h3>
              <span className={pageStyles.groupSub}>These are listed in the List view.</span>
            </div>
          </th>
        </tr>
      </tbody>
    </table>
  );
  const notWired = (label: string, noteId: string, variant: "sec" | "ghost" = "sec") => (
    <button
      type="button"
      className={buttonClass({ size: "sm", variant, className: pageStyles.notWired })}
      aria-disabled="true"
      aria-describedby={noteId}
      title="Not wired in this prototype."
      onClick={ignoreUnavailableActivation}
    >
      {label}
    </button>
  );

  // Now and History: in the hero on desktop and tablet, under it on a phone (v10).
  const populationSwitch = (
    <div className={pageStyles.populationSwitch} role="group" aria-label="Now or history">
      <button
        type="button"
        aria-pressed={population === "releases"}
        data-testid="ward-discharge-now"
        onClick={() => {
          setPopulation("releases");
          setStatus("all");
          setDestination("all");
          setBlockerCategory("all");
          setHighlight(null);
          clearSelection();
        }}
      >
        Now
        <span className="sr-only">, anonymous releases {bedReleases.length}</span>
      </button>
      <button
        type="button"
        aria-pressed={population === "records"}
        data-testid="ward-discharge-history"
        onClick={() => {
          setPopulation("records");
          setStatus("all");
          setDestination("all");
          setBlockerCategory("all");
          setHighlight(null);
          clearSelection();
        }}
      >
        History
        <span className="sr-only">
          , admission records {guarded.status === "allowed" ? records.length : "unavailable"}
        </span>
      </button>
    </div>
  );
  const filterCard = (
    <Card as="div" className={pageStyles.filterCard} aria-label="Discharge filters" role="region">
      <div className={pageStyles.filters}>
        <label htmlFor="discharges-filter-service" className={pageStyles.filterField}>
          <span className={pageStyles.filterLabelText}>Service</span>
          <Select
            id="discharges-filter-service"
            name="dischargesFilterService"
            value={service}
            boxClassName={pageStyles.filterSelect}
            onChange={(event) => {
              setService(event.target.value);
              setWard("all");
              clearSelection();
            }}
          >
            <option value="all">All services</option>
            {services.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </label>
        <label htmlFor="discharges-filter-ward" className={pageStyles.filterField}>
          <span className={pageStyles.filterLabelText}>Ward</span>
          <Select
            id="discharges-filter-ward"
            name="dischargesFilterWard"
            value={ward}
            boxClassName={pageStyles.filterSelect}
            onChange={(event) => {
              setWard(event.target.value);
              clearSelection();
            }}
          >
            <option value="all">All wards</option>
            {scopedUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        </label>
        {/* Decision 5 (review 12 Oct 2026): one control per filter. Status narrows from this one
            dropdown (its counts are the hero chips' counts); the hero chips highlight. The tab
            row over the table and the blocker chip row are gone. */}
        <label htmlFor="discharges-filter-status" className={pageStyles.filterField}>
          <span className={pageStyles.filterLabelText}>Status</span>
          <Select
            id="discharges-filter-status"
            name="dischargesFilterStatus"
            value={status}
            boxClassName={pageStyles.filterSelect}
            data-testid="ward-discharge-filter-status"
            onChange={(event) => {
              const next = event.target.value;
              setStatus(WORK_ORDER.includes(next as WorkStatus) ? (next as WorkStatus) : "all");
              clearSelection();
            }}
          >
            <option value="all">{`All statuses · ${total}`}</option>
            {WORK_ORDER.map((key) => (
              <option key={key} value={key}>
                {`${population === "releases" && key === "departed" ? "Discharged · 24h" : WORK_STATUS_LABELS[key]} · ${counts[key]}`}
              </option>
            ))}
          </Select>
        </label>
        <label htmlFor="discharges-filter-blocker" className={pageStyles.filterField}>
          <span className={pageStyles.filterLabelText}>Blocker</span>
          <Select
            id="discharges-filter-blocker"
            name="dischargesFilterBlocker"
            value={blockerCategory}
            boxClassName={pageStyles.filterSelect}
            onChange={(event) => {
              setBlockerCategory(event.target.value);
              clearSelection();
            }}
          >
            <option value="all">All blockers</option>
            {BLOCKER_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </label>
        {population === "records" && (
          <>
            <label htmlFor="discharges-filter-identity" className={pageStyles.filterField}>
              <span className={pageStyles.filterLabelText}>Patient link</span>
              <Select
                id="discharges-filter-identity"
                name="dischargesFilterIdentity"
                value={identity}
                boxClassName={pageStyles.filterSelect}
                onChange={(event) => {
                  setIdentity(event.target.value);
                  clearSelection();
                }}
              >
                <option value="all">All records</option>
                <option value="linked">Linked patient</option>
                <option value="missing">Missing or unavailable</option>
              </Select>
            </label>
            <label htmlFor="discharges-filter-destination" className={pageStyles.filterField}>
              <span className={pageStyles.filterLabelText}>Destination</span>
              <Select
                id="discharges-filter-destination"
                name="dischargesFilterDestination"
                value={destination}
                boxClassName={pageStyles.filterSelect}
                onChange={(event) => {
                  setDestination(event.target.value);
                  clearSelection();
                }}
              >
                <option value="all">All destinations</option>
                {LEAVING_DESTINATIONS.map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.label}
                  </option>
                ))}
              </Select>
            </label>
          </>
        )}
        <label htmlFor="discharges-sort" className={pageStyles.filterField}>
          <span className={pageStyles.filterLabelText}>Sort</span>
          <Select
            id="discharges-sort"
            name="dischargesSort"
            value={sortMode}
            boxClassName={pageStyles.filterSelect}
            data-testid="ward-discharges-sort"
            onChange={(event) => {
              setSortMode(event.target.value as DueSortMode);
            }}
          >
            {DUE_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        {filtersActive && (
          <Button size="sm" variant="ghost" className={pageStyles.clearButton} onClick={clearAllFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className={`${styles.screen} ${pageStyles.screen}`} data-testid="ward-discharge-board" data-ward-design="v6">
      <main id="main-content" className={pageStyles.main}>
        <h1 className={pageStyles.localTitle}>Discharges</h1>
        <p className={pageStyles.printScope}>
          {population === "records" ? "Admission records" : "Anonymous releases"}
          {" · "}
          {service === "all" ? "All services" : service}
          {" · "}
          {ward === "all"
            ? "All wards"
            : unitLabel(
                units.find((unit) => unit.id === ward),
                ward,
              )}
          {" · "}
          {status === "all" ? "All statuses" : WORK_STATUS_LABELS[status]}
          {population === "records"
            ? ` · ${identity === "all" ? "All records" : identity === "linked" ? "Linked patient" : "Missing or unavailable"}`
            : ""}
          {" · "}As of {formatSheetMoment(now, dayZero)}
        </p>
        <Hero
          className={pageStyles.phoneHero}
          eyebrow={
            population === "releases"
              ? isPhone
                ? `Bed release · ${service === "all" ? "statewide" : service}`
                : "Bed release · all services"
              : "History · admission records"
          }
          // A4-22 (audit round 2): History counts admission records, not today's bed releases, so
          // its title says so rather than reading as the same figure jumping.
          title={
            population === "records"
              ? `${openCount} admission ${openCount === 1 ? "record" : "records"} open`
              : `${openCount} ${openCount === 1 ? "discharge" : "discharges"} open`
          }
          titleMeta={
            <span className={pageStyles.bedDaysPast} data-testid="ward-discharge-bed-days-past">
              <strong>{bedDaysPast}</strong> bed {bedDaysPast === 1 ? "day" : "days"} past the ward&rsquo;s date
            </span>
          }
          aside={
            <div className={pageStyles.heroTools}>
              <LiveChip state="live" onHero />
              {isPhone ? null : (
                <Button size="sm" variant="onHero" icon={Copy} onClick={copySummary} data-testid="ward-discharge-copy">
                  Copy summary
                </Button>
              )}
              <Button
                size="sm"
                variant="onHero"
                icon={Printer}
                className={pageStyles.desktopOnly}
                onClick={() => window.print()}
                data-testid="ward-discharge-print"
              >
                Print list
              </Button>
              <span className={pageStyles.copyNote} role="status" aria-live="polite">
                {copyNote}
              </span>
            </div>
          }
          bar={
            <>
              <div
                className={pageStyles.kpiStrip}
                data-testid="ward-discharge-kpi-strip"
                role="region"
                aria-label="Discharge pipeline highlights"
              >
                {WORK_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    data-testid={`ward-discharge-kpi-${key}`}
                    className={pageStyles.kpi}
                    aria-pressed={statusHighlight === key}
                    aria-label={`${kpiCardLabel(key, population)}: ${counts[key]}`}
                    onClick={() => {
                      setHighlight(statusHighlight === key ? null : { kind: "status", status: key });
                      setStatus("all");
                    }}
                  >
                    <strong className={pageStyles.kpiValue}>{counts[key]}</strong>
                    <span className={pageStyles.kpiLabel}>
                      {key === "departed" ? null : <StatusGlyph tone={stageTone(key)} size={9} />}
                      <span>
                        {isPhone && key === "blocked" && population === "releases"
                          ? "Blocked"
                          : kpiCardLabel(key, population)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {/* Device audit, 11 Oct 2026: no desk tools in the phone hero, so Copy summary
                  is off phone (it stays in the tablet and desktop hero). */}
            </>
          }
          barAside={isPhone ? undefined : populationSwitch}
        />
        {isPhone ? (
          <div className={`${pageStyles.phToolbar} ${wardPin.pinnedSwitch}`}>
            {populationSwitch}
            <button
              type="button"
              className={pageStyles.phFilterButton}
              aria-label={filtersActive ? "Filters, some applied" : "Filters"}
              aria-expanded={phoneFiltersOpen}
              data-active={filtersActive || undefined}
              onClick={() => setPhoneFiltersOpen(true)}
              data-testid="ward-discharge-phone-filters"
            >
              <Filter size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {isPhone ? (
          <PhoneSheet
            open={phoneFiltersOpen}
            onClose={() => setPhoneFiltersOpen(false)}
            title="Filters"
            description="Filters narrow the list. Highlights never hide anyone."
            height="tall"
          >
            {filterCard}
          </PhoneSheet>
        ) : (
          filterCard
        )}
        {guarded.status === "allowed" && isPhone ? (
          /* v10 phone: the two charts are one tap away as cards; each opens a sheet that scrolls
             sideways with 48px tap columns. A tap highlights rows and closes the sheet. */
          <div className={pageStyles.phChartCards} data-testid="ward-discharge-phone-chart-cards">
            <button
              type="button"
              className={pageStyles.phChartCard}
              aria-label={`Expected discharges per day, passed and the next ${chartDays.filter((day) => day.key !== "past").length} days`}
              onClick={() => setPhoneChart("days")}
            >
              <TrendingUp size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
              <span className={pageStyles.phChartText}>
                <span className={pageStyles.phChartTitle}>Per day</span>
                <span className={pageStyles.phChartMeta}>
                  <b>
                    {(() => {
                      const day = chartDays.find((candidate) => candidate.key === 0);
                      return day ? day.expected + day.blocked : 0;
                    })()}
                  </b>{" "}
                  today · <b>{chartDays[0] ? chartDays[0].expected + chartDays[0].blocked : 0}</b> past
                </span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
            </button>
            <button
              type="button"
              className={pageStyles.phChartCard}
              aria-label={`Blocked by barrier, ${barrierCounts.filter((barrier) => barrier.count > 0).length} barriers`}
              onClick={() => setPhoneChart("barriers")}
            >
              <OctagonAlert size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
              <span className={pageStyles.phChartText}>
                <span className={pageStyles.phChartTitle}>By barrier</span>
                <span className={pageStyles.phChartMeta}>
                  {barrierCounts[0] && barrierCounts[0].count > 0 ? `Most: ${barrierCounts[0].label}` : "None blocked"}
                </span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
            </button>
            <PhoneSheet
              open={phoneChart !== null}
              onClose={() => setPhoneChart(null)}
              title={phoneChart === "barriers" ? "Blocked by barrier" : "Expected discharges per day"}
              description="Tap to highlight people in the list. Nobody is hidden."
              height="tall"
              className={pageStyles.phChartSheet}
              data-testid="ward-discharge-phone-chart-sheet"
            >
              {phoneChart === "barriers" ? (
                <DischargeBarrierBars
                  barriers={barrierCounts}
                  selected={highlight?.kind === "barrier" ? highlight.id : null}
                  onSelect={(id) => {
                    highlightOn({ kind: "barrier", id });
                    setPhoneChart(null);
                  }}
                  onClear={() => setHighlight(null)}
                />
              ) : (
                <DischargeDayChart
                  days={chartDays}
                  selected={highlight?.kind === "day" ? highlight.day : null}
                  onSelect={(day) => {
                    highlightOn({ kind: "day", day });
                    setPhoneChart(null);
                  }}
                  onClear={() => setHighlight(null)}
                />
              )}
            </PhoneSheet>
          </div>
        ) : null}
        <div className={pageStyles.workspace} data-detail-open={Boolean(selected || releaseId) || undefined}>
          <Card className={pageStyles.register} aria-labelledby="discharge-register-heading">
            <header className={pageStyles.panelHeader}>
              <h2 id="discharge-register-heading" className={pageStyles.localTitle}>
                {population === "releases" ? "Bed release worklist" : "Admission discharge records"}
              </h2>
              <div className={pageStyles.viewSwitch} role="group" aria-label="Table view">
                <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
                  <List size={14} aria-hidden="true" />
                  List
                </button>
                <button
                  type="button"
                  aria-pressed={view === "barriers"}
                  onClick={() => setView("barriers")}
                  data-testid="ward-discharge-view-barriers"
                >
                  <OctagonAlert size={14} aria-hidden="true" />
                  Barriers
                </button>
              </div>
              {highlight !== null ? (
                <span className={pageStyles.highlightNote} data-testid="ward-discharge-highlight-note">
                  <StatusGlyph tone="info" size={9} />
                  {view === "barriers" ? barrierRows.filter((row) => row.lit).length : highlightedCount} of{" "}
                  {view === "barriers" ? barrierRows.length : shown} highlighted, all rows stay
                  <Button size="sm" variant="ghost" onClick={() => setHighlight(null)}>
                    Clear
                  </Button>
                </span>
              ) : null}
              <span
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                data-testid="discharge-pipeline-announcement"
              >
                {population === "releases" ? "Bed releases" : "Admission records"}: {counts.blocked} blocked,{" "}
                {counts.confirmed} confirmed, {counts.expected} expected, {counts.departed} departed.
              </span>
              <span aria-live="polite" className={pageStyles.shownCountBadge}>
                {/* Device audit, 11 Oct 2026: the hero says 53 open and the list holds 57, so the
                    list names both parts rather than a bare "57 shown". */}
                {population === "records" && guarded.status === "denied"
                  ? "Unavailable"
                  : population === "releases" && status === "all" && shown === total && counts.departed > 0
                    ? `${shown - counts.departed} open · ${counts.departed} discharged`
                    : `${shown} shown`}
              </span>
            </header>
            <div
              ref={listRef}
              className={pageStyles.listBody}
              role="region"
              aria-label="Discharge worklist"
              tabIndex={0}
            >
              {population === "records" && guarded.status === "denied" ? (
                <p className={pageStyles.emptyState}>Discharge records are unavailable for this role.</p>
              ) : shown === 0 ? (
                <p className={pageStyles.emptyState}>
                  No {population === "releases" ? "releases" : "records"} match these filters.
                </p>
              ) : view === "barriers" ? (
                barrierTable
              ) : (
                <table className={pageStyles.workTable}>
                  <caption className={pageStyles.localTitle}>
                    {population === "releases"
                      ? "Bed frees (no name), blocked first. Completed releases cover the last 24 hours."
                      : "Admission records, blocked first. Expected dates do not imply confirmation."}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{population === "releases" ? "Ward / service" : "Patient / ward"}</th>
                      <th scope="col">{population === "releases" ? "Timing" : "Expected / departed"}</th>
                      <th scope="col">Stage / blocker</th>
                    </tr>
                  </thead>
                  {population === "records" ? (
                    <tbody>
                      {visibleRecords.map((record) => {
                        const unit = units.find((candidate) => candidate.id === record.unitId);
                        const isSelected = selected?.admissionId === record.admissionId;
                        return (
                          <tr
                            key={record.id}
                            data-selected={isSelected}
                            data-highlighted={recordLit(record) || undefined}
                            data-dim={dimmed(recordLit(record))}
                            data-act={recordStatus(record) === "blocked" || undefined}
                            onClick={(e) => openRecord(record, e.currentTarget)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openRecord(record, e.currentTarget);
                              }
                            }}
                            className={pageStyles.interactiveRow}
                            tabIndex={0}
                          >
                            <td data-label="Patient / ward">
                              <button
                                type="button"
                                className={pageStyles.recordButton}
                                aria-pressed={isSelected}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRecord(record, e.currentTarget);
                                }}
                              >
                                {recordName(record)}
                              </button>
                              <span className={pageStyles.secondaryMono}>
                                {record.identity.kind === "linked" ? record.identity.patient.umrn : record.admissionId}
                              </span>
                              <span className={pageStyles.secondary}>
                                {unitLabel(unit, record.unitId)} · {healthServiceLabel(unit)}
                              </span>
                            </td>
                            <td
                              data-label={recordStage(record) === "departed" ? "Departed" : "Expected"}
                              className={pageStyles.timingCell}
                            >
                              <strong className={pageStyles.due}>
                                {recordedMoment(
                                  recordStage(record) === "departed" ? record.leftAt : record.expectedDischargeAt,
                                  dayZero,
                                )}
                              </strong>
                            </td>
                            <td data-label="Stage / blocker">
                              <div className={pageStyles.stageCluster}>
                                {badge(recordStage(record))}
                                {recordStatus(record) === "blocked" && (
                                  <span className={pageStyles.blocker}>{record.blockReason}</span>
                                )}
                                {record.leavingDestination && (
                                  <span className={pageStyles.secondary}>
                                    {LEAVING_DESTINATIONS.find((item) => item.id === record.leavingDestination)
                                      ?.label ?? "Not recorded"}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ) : (
                    visibleReleaseGroups.map((key) => (
                      <tbody
                        key={key}
                        data-testid={`ward-discharge-group-${key}`}
                        data-has-items={releaseGroups[key].length > 0}
                      >
                        <tr className={pageStyles.groupRow}>
                          <th colSpan={3} scope="rowgroup">
                            {isPhone ? (
                              <button
                                type="button"
                                className={pageStyles.phGroupToggle}
                                aria-expanded={!phoneGroupsFolded[key]}
                                data-testid={`ward-discharge-group-toggle-${key}`}
                                onClick={() => setPhoneGroupsFolded((folded) => ({ ...folded, [key]: !folded[key] }))}
                              >
                                <StatusGlyph tone={PHONE_GROUP_TONES[key]} size={10} />
                                <h3>
                                  {PHONE_GROUP_LABELS[key]}{" "}
                                  <span className={pageStyles.phGroupCount}>{releaseGroups[key].length}</span>
                                </h3>
                                {phoneGroupsFolded[key] ? (
                                  <ChevronRight size={16} aria-hidden="true" className={pageStyles.phGroupChevron} />
                                ) : (
                                  <ChevronDown size={16} aria-hidden="true" className={pageStyles.phGroupChevron} />
                                )}
                              </button>
                            ) : (
                              <div className={pageStyles.groupHead}>
                                <span className={pageStyles.groupGlyph}>
                                  <StatusGlyph tone="danger" size={9} />
                                </span>
                                <h3>
                                  {key === "discharged-today" ? "Discharged in last 24 hours" : GROUP_LABELS[key]}{" "}
                                  <span className={pageStyles.groupCount}>{releaseGroups[key].length}</span>
                                </h3>
                                <span className={pageStyles.groupSub}>{GROUP_DESCRIPTIONS[key]}</span>
                              </div>
                            )}
                          </th>
                        </tr>
                        {isPhone && phoneGroupsFolded[key] ? null : releaseGroups[key].length === 0 ? (
                          <tr>
                            <td colSpan={3} className={pageStyles.emptyGroup}>
                              None
                            </td>
                          </tr>
                        ) : (
                          (isPhone && !phoneGroupsOpen[key]
                            ? litFirst(releaseGroups[key], releaseLit).slice(0, PHONE_GROUP_CAP)
                            : litFirst(releaseGroups[key], releaseLit)
                          ).map((release, index) => {
                            const unit = units.find((candidate) => candidate.id === release.unitId);
                            const linked = records.find((candidate) => candidate.admissionId === release.admissionId);
                            const overdue = release.state !== "discharged" && release.expectedAt < now;
                            return (
                              <tr
                                key={release.id}
                                data-release-id={release.id}
                                data-selected={releaseId === release.id}
                                data-highlighted={releaseLit(release) || undefined}
                                data-dim={dimmed(releaseLit(release))}
                                // One thin red edge, on the first act-now row only (device audit,
                                // 11 Oct 2026: five stacked red outlines read as an error state).
                                data-act={(key === "blocked" && index === 0) || undefined}
                                onClick={(e) => selectRelease(release.id, e.currentTarget)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    selectRelease(release.id, e.currentTarget);
                                  }
                                }}
                                className={pageStyles.interactiveRow}
                                tabIndex={0}
                              >
                                <td data-label="Ward / service">
                                  <button
                                    type="button"
                                    className={pageStyles.recordButton}
                                    aria-pressed={releaseId === release.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectRelease(release.id, e.currentTarget);
                                    }}
                                  >
                                    {unitLabel(unit, release.unitId)}
                                  </button>
                                  <span className={pageStyles.secondary}>
                                    {healthServiceLabel(unit)}
                                    {linked ? (
                                      <>
                                        <span aria-hidden="true">{isPhone ? "\u00a0· " : " · "}</span>
                                        {/* Phone rows carry the UMRN only (device audit, 11 Oct
                                            2026); the sheet adds the name. */}
                                        <span className={isPhone ? pageStyles.mono : pageStyles.patientHint}>
                                          {isPhone && linked.identity.kind === "linked"
                                            ? linked.identity.patient.umrn
                                            : recordName(linked)}
                                        </span>
                                      </>
                                    ) : null}
                                  </span>
                                </td>
                                <td data-label="Timing" className={pageStyles.timingCell}>
                                  {/* Device audit, 11 Oct 2026: a release past its date says how far
                                      past, with the date alone; "Now" and the clock time read as
                                      due this minute on rows one to four days late. */}
                                  {overdue ? (
                                    <>
                                      <strong className={pageStyles.band}>
                                        <StatusGlyph tone="danger" size={9} />
                                        {durMinutes(now - release.expectedAt)} past
                                      </strong>{" "}
                                      <span className={pageStyles.due}>
                                        {recordedDate(release.expectedAt, dayZero)}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <strong className={pageStyles.band}>
                                        {BAND_LABELS[releaseBand(release, now) as ReleaseBand]}
                                      </strong>{" "}
                                      <span className={pageStyles.due}>
                                        {recordedMoment(
                                          release.state === "discharged" ? release.confirmedAt : release.expectedAt,
                                          dayZero,
                                        )}
                                      </span>
                                    </>
                                  )}
                                </td>
                                <td data-label="Stage / blocker">
                                  <div className={pageStyles.stageCluster}>
                                    {badge(release.state === "discharged" ? "departed" : release.state)}
                                    {release.blocker && <span className={pageStyles.blocker}>{release.blocker}</span>}
                                    {release.waitingOn && (
                                      <span className={pageStyles.secondary}>
                                        <Truck size={12} className={pageStyles.inlineIcon} aria-hidden="true" />{" "}
                                        {release.waitingOn}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {isPhone &&
                        !phoneGroupsFolded[key] &&
                        !phoneGroupsOpen[key] &&
                        releaseGroups[key].length > PHONE_GROUP_CAP ? (
                          <tr className={pageStyles.phMoreRow}>
                            <td colSpan={3}>
                              <button
                                type="button"
                                className={pageStyles.phMore}
                                data-testid={`ward-discharge-group-more-${key}`}
                                onClick={() => setPhoneGroupsOpen((open) => ({ ...open, [key]: true }))}
                              >
                                Show {releaseGroups[key].length - PHONE_GROUP_CAP} more{" "}
                                {(key === "discharged-today" ? "discharged" : GROUP_LABELS[key]).toLowerCase()}
                              </button>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    ))
                  )}
                </table>
              )}
            </div>
            <footer
              className={pageStyles.registerFooter}
              data-testid="ward-discharge-excluded"
              hidden={population === "records" && guarded.status === "denied"}
            >
              {population === "releases" ? (
                <>
                  <span>{releaseGroups.excludedBeyondToday} expected in 2+ days</span>
                  <span data-testid="ward-discharge-completed-before-today">
                    {releaseGroups.completedBeforeToday} discharged 24h+ ago
                  </span>
                  <span className={pageStyles.footNote}>No expected bed counts as ready</span>
                </>
              ) : (
                <>
                  <span>
                    {scopedRecords.filter((record) => record.identity.kind === "linked").length} patient linked
                  </span>
                  <span>
                    {scopedRecords.filter((record) => record.identity.kind !== "linked").length} link missing /
                    unavailable
                  </span>
                  <span>
                    {scopedRecords.filter((record) => record.expectedDischargeAt === null).length} expected date not
                    recorded
                  </span>
                </>
              )}
            </footer>
          </Card>
          {Boolean(selected || releaseId) && (
            <div
              className={pageStyles.scrim}
              onClick={closeDrawer}
              aria-hidden="true"
              data-testid="ward-discharge-scrim"
            />
          )}
          <div className={pageStyles.rightRail}>
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
            <aside
              ref={detailRef}
              className={`${pageStyles.detail}${selected || releaseId ? ` ${pageStyles.open}` : ""}`}
              tabIndex={-1}
              aria-labelledby="discharge-detail-heading"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeDrawer();
                  return;
                }
                if (event.key === "Tab") {
                  if (typeof window !== "undefined" && window.matchMedia("(min-width: 40rem)").matches) {
                    return;
                  }
                  const focusable = Array.from(
                    detailRef.current?.querySelectorAll<HTMLElement>(
                      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                    ) ?? [],
                  ).filter((el) => !el.hasAttribute("disabled"));
                  if (focusable.length === 0) return;
                  const first = focusable[0];
                  const last = focusable[focusable.length - 1];
                  if (!first || !last) return;
                  if (event.shiftKey && document.activeElement === first) {
                    last.focus();
                    event.preventDefault();
                  } else if (!event.shiftKey && document.activeElement === last) {
                    first.focus();
                    event.preventDefault();
                  }
                }
              }}
            >
              <header className={pageStyles.detailHeader}>
                <h2
                  id="discharge-detail-heading"
                  className={activeRecord || detailRelease ? pageStyles.localTitle : pageStyles.detailTitle}
                >
                  {activeRecord || detailRelease ? "Selected discharge" : "Record detail"}
                </h2>
                {(selected || releaseId) && (
                  <Button
                    iconOnly
                    icon={X}
                    variant="ghost"
                    size="sm"
                    aria-label="Close"
                    className={pageStyles.closeBtn}
                    onClick={closeDrawer}
                  />
                )}
              </header>
              <div className={pageStyles.detailBody} role="region" aria-label="Selected discharge details" tabIndex={0}>
                {activeRecord ? (
                  <>
                    <div className={pageStyles.identity}>
                      <div className={pageStyles.identityText}>
                        <h3 className={pageStyles.patientFullName}>{recordName(activeRecord)}</h3>
                        <p className={pageStyles.identityMeta}>
                          {activeRecord.identity.kind === "linked" && (
                            <span className={pageStyles.mono}>UMRN {activeRecord.identity.patient.umrn}</span>
                          )}
                          <span className={pageStyles.mono}>{activeRecord.admissionId}</span>
                          <span>{unitLabel(selectedUnit, activeRecord.unitId)}</span>
                        </p>
                      </div>
                      {detailTone ? (
                        <Badge tone={detailTone} size="sm">
                          {detailBadgeLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <dl className={pageStyles.detailStats}>
                      <div>
                        <dt>Expected out</dt>
                        <dd>{recordedMoment(activeRecord.expectedDischargeAt, dayZero)}</dd>
                      </div>
                      <div>
                        <dt>Blocker</dt>
                        <dd>{activeRecord.blockReason ? "Recorded" : "None"}</dd>
                      </div>
                    </dl>

                    {tabList(Boolean(activeRecord.blockReason))}

                    <div className={drawerTab === "milestones" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                      <RecordedDischargeMilestones
                        title={isPhone ? "Milestones" : undefined}
                        milestones={[
                          {
                            label: "Expected discharge date",
                            state: activeRecord.expectedDischargeAt === null ? "pending" : "complete",
                            detail:
                              activeRecord.expectedDischargeAt === null
                                ? "Not recorded"
                                : `${recordedMoment(activeRecord.expectedDischargeAt, dayZero)} · Set by ${activeRecord.dischargeDateSetBy ?? "role not recorded"}`,
                          },
                          {
                            label: "Discharge confirmation",
                            state: activeRecord.dischargeConfirmedAt === null ? "pending" : "complete",
                            detail:
                              activeRecord.dischargeConfirmedAt === null
                                ? "Not recorded"
                                : `${recordedMoment(activeRecord.dischargeConfirmedAt, dayZero)} · ${activeRecord.dischargeConfirmedBy ?? "Role not recorded"}`,
                          },
                          {
                            label: "Recorded discharge blocker",
                            state: activeRecord.blockReason ? "blocked" : "pending",
                            detail: activeRecord.blockReason ?? "No discharge blocker recorded",
                          },
                          {
                            label: "Physical departure",
                            state: activeRecord.leftAt === null ? "pending" : "complete",
                            detail:
                              activeRecord.leftAt === null
                                ? "Not recorded"
                                : recordedMoment(activeRecord.leftAt, dayZero),
                          },
                        ]}
                      />
                      <dl className={pageStyles.factList}>
                        <dt>Destination</dt>
                        <dd>
                          {LEAVING_DESTINATIONS.find((item) => item.id === activeRecord.leavingDestination)?.label ??
                            "Not recorded"}
                        </dd>
                      </dl>
                    </div>

                    <div className={drawerTab === "barriers" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                      {activeRecord.blockReason ? (
                        <div className={pageStyles.barrierBox}>
                          <div className={pageStyles.barrierText}>
                            <span className={pageStyles.barrierCause}>
                              <StatusGlyph tone="danger" size={9} />
                              {activeRecord.blockReason}
                            </span>
                            <span className={pageStyles.secondary}>Recorded discharge blocker</span>
                          </div>
                          <div className={pageStyles.actionDeck}>
                            {notWired("Page transport", `mitigate-note-${activeRecord.admissionId}`)}
                            {notWired("Alternate escort", `mitigate-note-${activeRecord.admissionId}`, "ghost")}
                            <span id={`mitigate-note-${activeRecord.admissionId}`} className="sr-only">
                              Not wired in this prototype.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className={pageStyles.barrierBox}>
                          <span className={pageStyles.barrierCause}>
                            <StatusGlyph tone="success" size={9} />
                            No discharge blocker recorded
                          </span>
                          <p className={pageStyles.note}>
                            Clinical, pharmacy and transit clearance are not recorded here.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className={drawerTab === "transport" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                      <dl className={pageStyles.factList}>
                        <dt>Booking reference</dt>
                        <dd>Not recorded</dd>
                        <dt>Provider</dt>
                        <dd>Not recorded</dd>
                        <dt>Route</dt>
                        <dd>
                          {unitLabel(selectedUnit, activeRecord.unitId)} →{" "}
                          {LEAVING_DESTINATIONS.find((item) => item.id === activeRecord.leavingDestination)?.label ??
                            "Not recorded"}
                        </dd>
                      </dl>
                      <div className={pageStyles.actionDeck}>
                        {notWired("Page dispatch desk", `transport-note-${activeRecord.admissionId}`)}
                        {notWired("Reassign provider", `transport-note-${activeRecord.admissionId}`, "ghost")}
                        <span id={`transport-note-${activeRecord.admissionId}`} className="sr-only">
                          Not wired in this prototype.
                        </span>
                      </div>
                    </div>

                    <div className={drawerTab === "dossier" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                      <dl className={pageStyles.factList}>
                        <dt>Expected discharge</dt>
                        <dd>
                          {recordedMoment(activeRecord.expectedDischargeAt, dayZero)}
                          {/* Walkthrough D8 (25 Sept 2026): not offered once the person has left, because the
                              reducer refuses a new date for a departed stay. */}
                          {recordStage(activeRecord) === "departed" ? null : !showUpdateDate ? (
                            <div className={pageStyles.inlineAction}>
                              <Button
                                size="sm"
                                data-testid="ward-discharge-update-date-btn"
                                onClick={() => {
                                  setShowUpdateDate(true);
                                  setNewTimeDraft(
                                    activeRecord.expectedDischargeAt !== null
                                      ? formatInstant(activeRecord.expectedDischargeAt)
                                      : "14:00",
                                  );
                                }}
                              >
                                Update expected departure
                              </Button>
                            </div>
                          ) : (
                            <form
                              className={pageStyles.timeForm}
                              onSubmit={(e) => {
                                e.preventDefault();
                                let parsed: number | undefined;
                                if (/^\d+$/.test(newTimeDraft.trim())) {
                                  parsed = Number(newTimeDraft.trim());
                                } else {
                                  const today = parseReleaseDayInstant(now, "today", newTimeDraft);
                                  const recorded = activeRecord.expectedDischargeAt;
                                  parsed =
                                    today === undefined || recorded === null
                                      ? today
                                      : today +
                                        (Math.floor(recorded / MINUTES_PER_DAY) - Math.floor(now / MINUTES_PER_DAY)) *
                                          MINUTES_PER_DAY;
                                }
                                if (parsed !== undefined) {
                                  dispatch({
                                    type: "UPDATE_EXPECTED_DISCHARGE",
                                    role: "coordinator",
                                    admissionId: activeRecord.admissionId,
                                    expectedDischargeAt: parsed,
                                    now,
                                  });
                                  setShowUpdateDate(false);
                                }
                              }}
                            >
                              <TextInput
                                id="ward-discharge-new-time-input"
                                name="newExpectedDischargeTime"
                                type="time"
                                aria-label="New expected discharge time"
                                data-testid="ward-discharge-new-time-input"
                                value={newTimeDraft}
                                onChange={(e) => setNewTimeDraft(e.target.value)}
                                required
                              />
                              <Button type="submit" size="sm" variant="pri" data-testid="ward-discharge-save-time-btn">
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                data-testid="ward-discharge-cancel-time-btn"
                                onClick={() => setShowUpdateDate(false)}
                              >
                                Cancel
                              </Button>
                            </form>
                          )}
                        </dd>
                        <dt>Date recorded</dt>
                        <dd>
                          {recordedMoment(activeRecord.dischargeDateSetAt, dayZero)}
                          <span className={pageStyles.secondary}>
                            {activeRecord.dischargeDateSetBy ?? "Role not recorded"}
                          </span>
                        </dd>
                        <dt>Discharge confirmation</dt>
                        <dd>
                          {activeRecord.dischargeConfirmedAt === null
                            ? "Not confirmed"
                            : recordedMoment(activeRecord.dischargeConfirmedAt, dayZero)}
                          <span className={pageStyles.secondary}>
                            {activeRecord.dischargeConfirmedBy ?? "Role not recorded"}
                          </span>
                        </dd>
                        {activeRecord.blockReason && (
                          <>
                            <dt>Recorded blocker</dt>
                            <dd className={pageStyles.blocker}>{activeRecord.blockReason}</dd>
                          </>
                        )}
                        <dt>Recorded departure</dt>
                        <dd>{recordedMoment(activeRecord.leftAt, dayZero)}</dd>
                        <dt>Destination</dt>
                        <dd>
                          {LEAVING_DESTINATIONS.find((item) => item.id === activeRecord.leavingDestination)?.label ??
                            "Not recorded"}
                        </dd>
                      </dl>
                      <DischargeFollowUp key={activeRecord.id} record={activeRecord} actor={RECORD_ACTOR} />
                      <DischargeCareJourney
                        key={`care-${activeRecord.id}`}
                        record={activeRecord}
                        actor={RECORD_ACTOR}
                      />
                      {/* Advisory carer/PSP/MHAS checklist: renders only for an involuntary patient's discharge. */}
                      <SupportNotificationChecklist
                        key={`notify-${activeRecord.id}`}
                        admissionId={activeRecord.admissionId}
                        role={RECORD_ACTOR.role}
                      />
                    </div>
                  </>
                ) : detailRelease ? (
                  <>
                    {isPhone ? (
                      <>
                        {/* v10 phone release sheet: the ward leads; person and UMRN on one subline. */}
                        <div className={pageStyles.phIdentity}>
                          <h3 className={pageStyles.patientFullName}>
                            {unitLabel(selectedUnit, detailRelease.unitId)}
                          </h3>
                          <p className={pageStyles.phIdentityMeta}>
                            {[
                              healthServiceLabel(selectedUnit),
                              linkedReleaseRecord ? recordName(linkedReleaseRecord) : null,
                              linkedReleaseRecord?.identity.kind === "linked"
                                ? linkedReleaseRecord.identity.patient.umrn
                                : null,
                            ]
                              .filter(Boolean)
                              .join("\u00a0· ")}
                          </p>
                          {detailTone ? (
                            <Badge tone={detailTone} size="sm">
                              {detailBadgeLabel}
                            </Badge>
                          ) : null}
                        </div>
                        <dl className={pageStyles.phFacts}>
                          <div>
                            <dt>{detailRelease.state === "discharged" ? "Released" : "Expected out"}</dt>
                            <dd className={pageStyles.mono}>
                              {recordedMoment(
                                detailRelease.state === "discharged"
                                  ? detailRelease.confirmedAt
                                  : detailRelease.expectedAt,
                                dayZero,
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>When</dt>
                            <dd>
                              {detailRelease.state === "discharged"
                                ? "Departed"
                                : detailRelease.expectedAt < now
                                  ? "Past the ward's date"
                                  : BAND_LABELS[releaseBand(detailRelease, now) as ReleaseBand]}
                            </dd>
                          </div>
                          <div>
                            <dt>Against date</dt>
                            <dd>
                              {detailRelease.state !== "discharged" && detailRelease.expectedAt < now ? (
                                <>
                                  <StatusGlyph tone="danger" size={9} /> {durMinutes(now - detailRelease.expectedAt)}{" "}
                                  past
                                </>
                              ) : detailRelease.state !== "discharged" ? (
                                `In ${durMinutes(detailRelease.expectedAt - now)}`
                              ) : (
                                "Met"
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Destination</dt>
                            <dd>
                              {LEAVING_DESTINATIONS.find((item) => item.id === linkedReleaseRecord?.leavingDestination)
                                ?.label ?? "Not recorded"}
                            </dd>
                          </div>
                        </dl>
                      </>
                    ) : (
                      <>
                        <div className={pageStyles.identity}>
                          <div className={pageStyles.identityText}>
                            <h3 className={pageStyles.patientFullName}>
                              {linkedReleaseRecord
                                ? recordName(linkedReleaseRecord)
                                : unitLabel(selectedUnit, detailRelease.unitId)}
                            </h3>
                            <p className={pageStyles.identityMeta}>
                              {linkedReleaseRecord?.identity.kind === "linked" && (
                                <span className={pageStyles.mono}>
                                  UMRN {linkedReleaseRecord.identity.patient.umrn}
                                </span>
                              )}
                              <span>{unitLabel(selectedUnit, detailRelease.unitId)}</span>
                              <span>{healthServiceLabel(selectedUnit)}</span>
                            </p>
                          </div>
                          {detailTone ? (
                            <Badge tone={detailTone} size="sm">
                              {detailBadgeLabel}
                            </Badge>
                          ) : null}
                        </div>
                        <dl className={pageStyles.detailStats}>
                          {detailRelease.state !== "discharged" && detailRelease.expectedAt < now ? (
                            <div>
                              <dt>Overdue</dt>
                              <dd>{durMinutes(now - detailRelease.expectedAt)}</dd>
                            </div>
                          ) : detailRelease.state !== "discharged" ? (
                            <div>
                              <dt>Due in</dt>
                              <dd>{durMinutes(detailRelease.expectedAt - now)}</dd>
                            </div>
                          ) : null}
                          <div>
                            <dt>{detailRelease.state === "discharged" ? "Released" : "Expected"}</dt>
                            <dd>
                              {recordedMoment(
                                detailRelease.state === "discharged"
                                  ? detailRelease.confirmedAt
                                  : detailRelease.expectedAt,
                                dayZero,
                              )}
                            </dd>
                          </div>
                        </dl>
                      </>
                    )}

                    {isPhone && linkedReleaseRecord?.identity.kind === "linked" ? (
                      // A4-22 (audit round 2): on the phone the link opens the person's own page
                      // rather than switching the board to History and losing the selection.
                      <Link
                        className={buttonClass({ variant: "ghost", size: "sm", className: pageStyles.bridgeButton })}
                        href={patientHref(linkedReleaseRecord.identity.patient.id)}
                      >
                        Patient page →
                      </Link>
                    ) : linkedReleaseRecord ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={pageStyles.bridgeButton}
                        onClick={(e) => {
                          setPopulation("records");
                          openRecord(linkedReleaseRecord, e.currentTarget);
                        }}
                      >
                        View patient discharge record →
                      </Button>
                    ) : null}

                    {isPhone ? null : tabList(Boolean(detailRelease.blocker))}

                    <div className={releasePaneClass("milestones")}>
                      <RecordedDischargeMilestones
                        title={isPhone ? "Milestones" : undefined}
                        milestones={[
                          {
                            label: "Expected discharge date",
                            state: "complete",
                            detail: recordedMoment(detailRelease.expectedAt, dayZero),
                          },
                          {
                            label: "Release stage recorded",
                            state: detailRelease.state === "expected" ? "pending" : "complete",
                            detail: `${detailRelease.state} · ${recordedMoment(detailRelease.confirmedAt, dayZero)}`,
                          },
                          // A4-23 (audit round 2): the phone shows the blocker panes together, so
                          // the blocker is said once, in its own box below, not again as a milestone.
                          ...(isPhone
                            ? []
                            : [
                                {
                                  label: "Recorded discharge blocker",
                                  state: detailRelease.blocker ? ("blocked" as const) : ("pending" as const),
                                  detail: detailRelease.blocker ?? "No discharge blocker recorded",
                                },
                              ]),
                          {
                            label: "Physical departure",
                            state: detailRelease.state === "discharged" ? "complete" : "pending",
                            detail:
                              linkedReleaseRecord?.leftAt != null
                                ? recordedMoment(linkedReleaseRecord.leftAt, dayZero)
                                : detailRelease.state === "discharged"
                                  ? "Departure recorded; time not recorded"
                                  : "Not recorded",
                          },
                        ]}
                      />
                      {detailRelease.preparing ? (
                        <p className={pageStyles.note}>
                          Preparation recorded: {detailRelease.preparationNote ?? "Reason not recorded"}. This is
                          informational and does not establish completion.
                        </p>
                      ) : null}
                      <ReadyToLeave
                        onCto={releaseOnCto}
                        ticked={ticksFor(detailRelease.id)}
                        onToggle={(itemId) => {
                          const on = !ticksFor(detailRelease.id).includes(itemId);
                          setTick(detailRelease.id, itemId, on);
                          setReadyChange({ releaseId: detailRelease.id, itemId, ticked: on });
                        }}
                        lastChange={readyChange?.releaseId === detailRelease.id ? readyChange : null}
                        onUndo={() => {
                          if (readyChange) setTick(readyChange.releaseId, readyChange.itemId, !readyChange.ticked);
                          setReadyChange(null);
                        }}
                        onDismiss={() => setReadyChange(null)}
                      />
                    </div>

                    <div className={releasePaneClass("barriers")}>
                      {detailRelease.blocker ? (
                        <div className={pageStyles.barrierBox}>
                          <div className={pageStyles.barrierText}>
                            <span className={pageStyles.barrierCause}>
                              <StatusGlyph tone="danger" size={9} />
                              {detailRelease.blocker}
                            </span>
                            <span className={pageStyles.secondary}>Recorded discharge blocker</span>
                          </div>
                          <div className={pageStyles.actionDeck}>
                            {notWired("Expedite", `mitigate-rel-note-${detailRelease.id}`)}
                            <span id={`mitigate-rel-note-${detailRelease.id}`} className="sr-only">
                              Not wired in this prototype.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className={pageStyles.barrierBox}>
                          <span className={pageStyles.barrierCause}>
                            <StatusGlyph tone="success" size={9} />
                            No discharge blocker recorded
                          </span>
                          <p className={pageStyles.note}>
                            Clinical, pharmacy and transit clearance are not recorded here.
                          </p>
                        </div>
                      )}
                    </div>

                    {isPhone ? (
                      <button
                        type="button"
                        className={pageStyles.phMore}
                        aria-expanded={phoneReleaseMore}
                        onClick={() => setPhoneReleaseMore((open) => !open)}
                      >
                        {phoneReleaseMore ? "Hide transport and dossier" : "Show transport and dossier"}
                      </button>
                    ) : null}
                    <div className={releasePaneClass("transport")}>
                      <dl className={pageStyles.factList}>
                        <dt>Booking reference</dt>
                        <dd>Not recorded</dd>
                        <dt>Provider</dt>
                        <dd>Not recorded</dd>
                        <dt>Unit</dt>
                        <dd>{unitLabel(selectedUnit, detailRelease.unitId)}</dd>
                      </dl>
                      <div className={pageStyles.actionDeck}>
                        {notWired("Dispatch transport", `transport-rel-note-${detailRelease.id}`)}
                        <span id={`transport-rel-note-${detailRelease.id}`} className="sr-only">
                          Not wired in this prototype.
                        </span>
                      </div>
                    </div>

                    <div className={releasePaneClass("dossier")}>
                      <dl className={pageStyles.factList}>
                        <dt>{detailRelease.state === "discharged" ? "Recorded release" : "Expected release"}</dt>
                        <dd>
                          {recordedMoment(
                            detailRelease.state === "discharged" ? detailRelease.confirmedAt : detailRelease.expectedAt,
                            dayZero,
                          )}
                        </dd>
                        {detailRelease.waitingOn && (
                          <>
                            <dt>Waiting on</dt>
                            <dd>{detailRelease.waitingOn}</dd>
                          </>
                        )}
                        {detailRelease.blocker && (
                          <>
                            <dt>Blocker</dt>
                            <dd className={pageStyles.blocker}>{detailRelease.blocker}</dd>
                          </>
                        )}
                        <dt>Last reported</dt>
                        <dd>
                          <WardFreshness
                            confirmedAt={detailRelease.confirmedAt}
                            confirmedByRole={detailRelease.confirmedBy}
                            now={now}
                          />
                          <span className={pageStyles.secondary}>
                            {recordedMoment(detailRelease.confirmedAt, dayZero)}
                          </span>
                        </dd>
                        {detailRelease.preparing && (
                          <>
                            <dt>Bed preparation</dt>
                            <dd>{detailRelease.preparationNote ?? "In progress · reason not recorded"}</dd>
                          </>
                        )}
                        {!linkedReleaseRecord ? (
                          <>
                            <dt>Release ID</dt>
                            <dd className={pageStyles.mono}>{detailRelease.id}</dd>
                          </>
                        ) : null}
                      </dl>
                    </div>
                  </>
                ) : selected || openError ? (
                  <p className={pageStyles.emptyState}>This record could not be opened. Select it again to retry.</p>
                ) : (
                  <div className={pageStyles.resting}>
                    <EmptyState
                      icon={ClipboardList}
                      title="Select a record to view dates, blockers and ward follow-up."
                    />
                    {population === "releases" &&
                      visibleReleaseGroups.includes("blocked") &&
                      releaseGroups.blocked.length > 0 && (
                        <div className={pageStyles.restingQueue}>
                          <h3 className={pageStyles.sectionLabel}>
                            Blocked <span className={pageStyles.groupCount}>{releaseGroups.blocked.length}</span>
                          </h3>
                          <ul>
                            {releaseGroups.blocked.slice(0, 4).map((rel) => {
                              const u = units.find((candidate) => candidate.id === rel.unitId);
                              const l = records.find((candidate) => candidate.admissionId === rel.admissionId);
                              return (
                                <li key={rel.id}>
                                  <button
                                    type="button"
                                    className={pageStyles.restingItem}
                                    onClick={(e) => selectRelease(rel.id, e.currentTarget)}
                                  >
                                    <StatusGlyph tone="danger" size={9} />
                                    <span className={pageStyles.restingItemText}>
                                      <span className={pageStyles.restingItemTitle}>
                                        {unitLabel(u, rel.unitId)} {l ? `· ${recordName(l)}` : ""}
                                      </span>
                                      <span className={pageStyles.secondary}>{rel.blocker}</span>
                                    </span>
                                    <ChevronRight size={16} aria-hidden="true" className={pageStyles.restingArrow} />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </div>
              {selectedUnitId && (
                <footer className={pageStyles.detailFooter}>
                  {canRecordDeparture ? (
                    <label className={pageStyles.departDest}>
                      <span>Going to</span>
                      <Select
                        aria-label="Where are they going?"
                        data-testid="ward-discharge-departure-destination"
                        value={departureDestination}
                        onChange={(event) =>
                          setDeparture({
                            releaseId: detailRelease?.id ?? null,
                            destination: event.target.value as LeavingDestination,
                          })
                        }
                      >
                        {LEAVING_DESTINATIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : null}
                  <Link
                    href={`/mockups/ward-flow/ward/${selectedUnitId}`}
                    className={buttonClass({ size: "sm", variant: "sec" })}
                  >
                    Open ward
                  </Link>
                  {canRecordDeparture && detailRelease ? (
                    <Button
                      variant={phoneClearBlocker ? "sec" : "pri"}
                      size="sm"
                      className={phoneClearBlocker ? undefined : pageStyles.departPri}
                      data-testid="ward-discharge-record-departure"
                      onClick={() => {
                        departureCheckRef.current = {
                          prior: rejections.length,
                          who: linkedReleaseRecord ? recordName(linkedReleaseRecord) : "The person",
                          undoAdmissionId: detailRelease.admissionId,
                        };
                        recordWardDeparture(detailRelease.admissionId, detailRelease.unitId, departureDestination);
                        setDepartureToken((token) => token + 1);
                      }}
                    >
                      Record departure
                    </Button>
                  ) : null}
                  {phoneClearBlocker && detailRelease ? (
                    <Button
                      variant="pri"
                      className={pageStyles.phFootPri}
                      data-testid="ward-discharge-clear-blocker"
                      onClick={() =>
                        dispatch({
                          type: "CLEAR_BED_RELEASE_BLOCK",
                          role: "coordinator",
                          now,
                          releaseId: detailRelease.id,
                          actingUnitId: detailRelease.unitId,
                        })
                      }
                    >
                      Clear blocker
                    </Button>
                  ) : null}
                </footer>
              )}
            </aside>
          </div>
        </div>
        {guarded.status === "allowed" && !isPhone ? (
          <div className={pageStyles.flowCharts}>
            <DischargeDayChart
              days={chartDays}
              selected={highlight?.kind === "day" ? highlight.day : null}
              onSelect={(day) => highlightOn({ kind: "day", day })}
              onClear={() => setHighlight(null)}
            />
            <DischargeBarrierBars
              barriers={barrierCounts}
              selected={highlight?.kind === "barrier" ? highlight.id : null}
              onSelect={(id) => highlightOn({ kind: "barrier", id })}
              onClear={() => setHighlight(null)}
            />
          </div>
        ) : null}
        <WardPrototypeFooter
          testId="ward-discharge-governance"
          note="This board shows only what a ward has recorded — a release expected, confirmed or discharged, and whether it is currently blocked — and it never adds an expected or unreleased bed into the Ready figure · Not a medical device"
        />
      </main>
    </div>
  );
}
/**
 * Exported for `tests/ward-discharge-blocked-emphasis.dom.test.tsx`, which has to render this
 * section with an EMPTY `releases` array — the arm that stops an empty Blocked group being the
 * loudest thing on a board where nothing is stuck. The seeded state always has blocked releases in
 * it, so through `DischargeBoard` that arm is unreachable and a guard over it would be true and
 * unfalsifiable. `groupDischarges` above is already exported on the same grounds.
 */
export function DischargeGroupSection({
  groupKey,
  releases,
  units,
  now,
}: {
  groupKey: GroupKey;
  releases: BedRelease[];
  units: Unit[];
  now: Instant;
}) {
  /*
   * ⚠️ **ONE ELEVATED PANEL ON THE BOARD, AND IT MARKS WORK RATHER THAN A HEADING.** The four
   * groups render in the fixed scan order `GROUP_ORDER` sets — blocked first, because those are
   * the rows somebody must act on — and until this pass nothing but that order said so. Measured
   * at 1100px: all four sections painted `rgb(251, 252, 253)` behind the same border, so the
   * stuck releases and the beds already free were indistinguishable as objects.
   *
   * ⚠️ **AND IT IS CONDITIONAL ON THERE BEING ROWS, WHICH IS THE WHOLE POINT.** Elevating the
   * Blocked heading unconditionally would make an EMPTY panel the loudest thing on a board where
   * nothing is stuck — an absence promoted to a headline, and the good day would look like the
   * urgent one. The lift says "there is work here", not "this heading matters", so it appears only
   * when the group has releases in it. On a board with nothing blocked, no panel is raised and the
   * four read flat, which is the truth of that morning.
   */
  const marksOutstandingWork = groupKey === "blocked" && releases.length > 0;

  /*
   * ⚠️ **THE BLOCKER COLUMN EXISTS IN THE BLOCKED GROUP AND NOWHERE ELSE** (Ward Lead ruling E16,
   * 2026-09-05). `groupDischarges` sends every release with a non-null blocker to `blocked`, so in
   * the other three groups `release.blocker` is `null` BY CONSTRUCTION — the cell read "Not
   * applicable" on every row, seven times on the seeded board, filling a sixth of the table with a
   * fact about the column rather than about the patient.
   *
   * **This is not a new position; it is making one board's two layouts agree.** The card list
   * below already renders `{release.blocker && …}` and has ALWAYS omitted the blocker when it is
   * null. The table restated it. Two renderings of one board disagreeing about whether an absence
   * is worth stating is a defect, and the deliberate one wins over the repeated one.
   *
   * ⚠️ **`Stage` STAYS ON ALL FOUR, THOUGH IT IS ALSO CONSTANT IN THREE OF THEM.** It is a genuine
   * per-row fact and it is cheap — and keeping it everywhere makes the Blocked group's Stage the
   * only VARYING one on the page (Confirmed or Expected, because the flag is read before the
   * stage), which puts the emphasis exactly where this board exists to put it. Dropping it too
   * would flatten that signal to save four words.
   *
   * ⚠️ **AND THE FIRST MEASUREMENT OF THIS SAID SIX COLUMNS, NOT TWO.** Read off the rendered
   * table, `discharged-today` showed every one of its six columns as constant — because it has ONE
   * seeded row — and `Health service` looked constant in `blocked` on two rows. **A rendered table
   * cannot tell a column that is constant by construction from one that is constant because the
   * group is small**, and acting on that reading would have deleted four columns carrying real
   * per-row facts. Only `Stage` and `Blocker` survive when the branches are read instead.
   */
  const showsBlocker = groupKey === "blocked";

  return (
    <section
      className={marksOutstandingWork ? `${styles.section} ${styles.sectionLive}` : styles.section}
      data-testid={`ward-discharge-group-${groupKey}`}
      data-has-items={releases.length > 0 ? "true" : "false"}
    >
      <div className={pageStyles.groupHeading}>
        <h2 className={styles.sectionHeading}>{GROUP_LABELS[groupKey]}</h2>
        <p>{GROUP_DESCRIPTIONS[groupKey]}</p>
        <span className={styles.countBadge}>{releases.length}</span>
      </div>
      <div
        className={pageStyles.groupBody}
        role="region"
        aria-label={`${GROUP_LABELS[groupKey]} discharge records`}
        tabIndex={0}
      >
        {releases.length === 0 ? (
          <p className={styles.emptyNote} data-testid={`ward-discharge-group-${groupKey}-empty`}>
            None. No {EMPTY_REASON[groupKey]}.
          </p>
        ) : (
          <>
            <WardTable
              className={styles.table}
              wrapperClassName={styles.tableScroll}
              testId={`ward-discharge-table-${groupKey}`}
            >
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col">Health service</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Stage</th>
                  {showsBlocker ? <th scope="col">Blocker</th> : null}
                  <th scope="col">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => {
                  const unit = units.find((candidate) => candidate.id === release.unitId);
                  return (
                    <tr key={release.id}>
                      <td>{unitLabel(unit, release.unitId)}</td>
                      <td>{healthServiceLabel(unit)}</td>
                      <td className={styles.countdownBand}>{releaseTimingWords(release, now)}</td>
                      {/* Bed-model rework (2026-08-28): the stage is rendered on every row, in
                          every group. Without it the Blocked group would swallow the one fact
                          this rework exists to preserve — that a stuck discharge is still a
                          DECIDED one — and a coordinator could not tell a blocked prediction
                          from a blocked confirmation. */}
                      <td>{bedReleaseStateLabels[release.state]}</td>
                      {showsBlocker ? (
                        <td>
                          {/* SPEC §11: `blocker` is non-null only in `blocked` (ward-model.ts), so
                              a null here is a release to which a blocker cannot apply — not one
                              whose blocker nobody wrote down. A dash collapsed those two into one
                              glyph.

                              ⚠️ THE FALLBACK IS KEPT THOUGH `groupDischarges` CANNOT PRODUCE IT.
                              Every release reaching this branch came through the `blocker !== null`
                              test, so via `DischargeBoard` the `??` arm is unreachable — but
                              `DischargeGroupSection` is exported and rendered directly by
                              `tests/ward-discharge-blocked-emphasis.dom.test.tsx` with arbitrary
                              lists, so this component no longer controls its own input. A defensive
                              branch on a component that can be handed anything is not dead code. */}
                          {release.blocker ?? <MissingValue reason="not_applicable" density="cell" />}
                        </td>
                      ) : null}
                      <td>
                        <WardFreshness
                          confirmedAt={release.confirmedAt}
                          confirmedByRole={release.confirmedBy}
                          now={now}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </WardTable>

            <ul className={styles.cardList} data-testid={`ward-discharge-cards-${groupKey}`}>
              {releases.map((release) => {
                const unit = units.find((candidate) => candidate.id === release.unitId);
                return (
                  <li key={release.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardBand}>{releaseTimingWords(release, now)}</span>
                      <span className={styles.cardUnit}>{unitLabel(unit, release.unitId)}</span>
                    </div>
                    <p className={styles.cardService}>{healthServiceLabel(unit)}</p>
                    <p className={styles.cardService}>{bedReleaseStateLabels[release.state]}</p>
                    {release.blocker && <p className={styles.cardBlocker}>{release.blocker}</p>}
                    <WardFreshness confirmedAt={release.confirmedAt} confirmedByRole={release.confirmedBy} now={now} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
