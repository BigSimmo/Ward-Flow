"use client";
import { DischargeCareJourney } from "./discharge-care-journey";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, ClipboardList, Copy, List, OctagonAlert, Plus, Printer, Truck, X } from "lucide-react";
import { MissingValue } from "@/components/ui/missing-value";
import { RELEASE_BANDS, releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import {
  calendarDateOf,
  dayOf,
  formatInstant,
  formatInstantWithDay,
  formatSheetMoment,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { parseReleaseDayInstant } from "@/components/ward-management/ward/release-day";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import type {
  DischargeRecord,
  DischargeOpenHandle,
  WardRecordActor,
} from "@/components/ward-management/ward-discharge-records";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { bedReleaseStateLabels } from "@/components/ward-management/ward-derivations";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { DUE_SORT_OPTIONS, sortDueFirst, type DueSortMode } from "@/components/ward-management/ward-due-sort";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FilterChip,
  Hero,
  Select,
  StatusGlyph,
  TextInput,
  buttonClass,
  durMinutes,
  type WfTone,
} from "@/components/wf";

import { DischargeFollowUp } from "./discharge-follow-up";
import {
  DischargeBarrierBars,
  DischargeDayChart,
  type DischargeDay,
  type DischargeDayKey,
} from "./discharge-flow-charts";
import { SupportNotificationChecklist } from "../movements/support-notification-checklist";
import styles from "./discharges.module.css";
import pageStyles from "./discharges-third-edition.module.css";

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
type Highlight = { kind: "day"; day: DischargeDayKey } | { kind: "barrier"; id: string };
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
  if (highlight === null) return false;
  if (highlight.kind === "barrier") return blocker !== null && barrierCategory(blocker) === highlight.id;
  if (expectedAt === null || !Number.isFinite(expectedAt)) return false;
  if (highlight.day === "past") return dayOf(expectedAt) < dayOf(now);
  return dayOf(expectedAt) - dayOf(now) === highlight.day;
}

function perthDay(instant: Instant, dayZero: Date, options: Intl.DateTimeFormatOptions): string {
  return calendarDateOf(instant, dayZero).toLocaleDateString("en-AU", { ...options, timeZone: "Australia/Perth" });
}

function RecordedDischargeMilestones({
  milestones,
}: {
  milestones: { label: string; detail: string; state: "complete" | "pending" | "blocked" }[];
}) {
  return (
    <div className={pageStyles.milestones}>
      <span className={pageStyles.sectionLabel}>Recorded discharge milestones</span>
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
  const { bedReleases, units, dayZero, readDischargeRecords, openDischargeRecord, readDischargeRecord, dispatch } =
    useWardFlow();
  const now = useWardFlowClock();
  const [planningOpen, setPlanningOpen] = useState(false);
  const [planningUnitId, setPlanningUnitId] = useState("");
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
  const [drawerTab, setDrawerTab] = useState<"milestones" | "barriers" | "transport" | "dossier">("milestones");
  const [view, setView] = useState<TableView>("list");
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [copyNote, setCopyNote] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);
  const planDropdownRef = useRef<HTMLDivElement>(null);
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
  const recordLit = (record: DischargeRecord) =>
    recordStage(record) !== "departed" &&
    matchesHighlight(highlight, record.expectedDischargeAt, record.blockReason, now);
  const releaseLit = (release: BedRelease) =>
    release.state !== "discharged" && matchesHighlight(highlight, release.expectedAt, release.blocker, now);
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
  const selectedUnitId = activeRecord?.unitId ?? detailRelease?.unitId;
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
  useEffect(() => {
    if (!planningOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (planDropdownRef.current && !planDropdownRef.current.contains(e.target as Node)) {
        setPlanningOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPlanningOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [planningOpen]);
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
  const blockerCount = (category: string) =>
    bedReleases.filter(
      (release) =>
        inScope(release.unitId) &&
        release.blocker !== null &&
        release.state !== "discharged" &&
        (category === "all" || release.blocker.toLowerCase().includes(category.toLowerCase())),
    ).length;
  const destinationCount = (id: string) =>
    records.filter((record) => inScope(record.unitId) && (id === "all" || record.leavingDestination === id)).length;
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
    if (population !== "records") {
      setPopulation("records");
      clearSelection();
    }
    setStatus("all");
    // Highlighted people go to the top, so bring the top of the list into view.
    const list = listRef.current;
    if (list) {
      list.scrollTop = 0;
      if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 40rem)").matches) {
        list.scrollIntoView?.({ block: "start", behavior: "smooth" });
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
          eyebrow={population === "releases" ? "Bed release" : "Admission records"}
          title={`${openCount} ${openCount === 1 ? "discharge" : "discharges"} open`}
          stats={
            <div
              className={pageStyles.kpiStrip}
              data-testid="ward-discharge-kpi-strip"
              role="region"
              aria-label="Discharge pipeline summary filters"
            >
              {WORK_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  data-testid={`ward-discharge-kpi-${key}`}
                  className={pageStyles.kpi}
                  aria-pressed={status === key}
                  aria-label={`${kpiCardLabel(key, population)}: ${counts[key]}`}
                  onClick={() => {
                    setStatus(status === key ? "all" : key);
                    clearSelection();
                  }}
                >
                  <strong className={pageStyles.kpiValue}>{counts[key]}</strong>
                  <span className={pageStyles.kpiLabel}>
                    {key === "departed" ? null : <StatusGlyph tone={stageTone(key)} size={9} />}
                    <span>{kpiCardLabel(key, population)}</span>
                  </span>
                </button>
              ))}
            </div>
          }
          aside={
            <div className={pageStyles.heroTools}>
              <time className={pageStyles.asOf}>
                <span className="sr-only">Board time: </span>
                As of {formatInstantWithDay(now, now)}
              </time>
              <Button size="sm" variant="onHero" icon={Copy} onClick={copySummary} data-testid="ward-discharge-copy">
                Copy summary
              </Button>
              <Button
                size="sm"
                variant="onHero"
                icon={Printer}
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
            <div className={pageStyles.heroBar}>
              <div className={pageStyles.populationSwitch} role="group" aria-label="Discharge population">
                <button
                  type="button"
                  aria-pressed={population === "releases"}
                  onClick={() => {
                    setPopulation("releases");
                    setStatus("all");
                    setDestination("all");
                    setBlockerCategory("all");
                    setHighlight(null);
                    clearSelection();
                  }}
                >
                  Anonymous releases <span className={pageStyles.popCount}>{bedReleases.length}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={population === "records"}
                  onClick={() => {
                    setPopulation("records");
                    setStatus("all");
                    setDestination("all");
                    setBlockerCategory("all");
                    setHighlight(null);
                    clearSelection();
                  }}
                >
                  Admission records{" "}
                  <span className={pageStyles.popCount}>
                    {guarded.status === "allowed" ? records.length : "Unavailable"}
                  </span>
                </button>
              </div>
              <span className={pageStyles.bedDaysPast} data-testid="ward-discharge-bed-days-past">
                <strong>{bedDaysPast}</strong> bed {bedDaysPast === 1 ? "day" : "days"} past the ward&rsquo;s date
              </span>
            </div>
          }
          barAside={
            <div className={pageStyles.planActionWrapper} ref={planDropdownRef}>
              <Button
                variant="light"
                icon={Plus}
                data-testid="ward-discharge-plan-departure"
                aria-expanded={planningOpen}
                onClick={() => setPlanningOpen(!planningOpen)}
              >
                Plan departure
              </Button>
              {planningOpen && (
                <div className={pageStyles.planActionDropdown}>
                  <Field label="Ward for departure planning" id="discharges-plan-ward">
                    <Select value={planningUnitId} onChange={(event) => setPlanningUnitId(event.target.value)}>
                      <option value="">Choose ward</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unitLabel(unit, unit.id)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {planningUnitId && units.some((unit) => unit.id === planningUnitId) && (
                    <Link
                      className={buttonClass({ size: "sm", variant: "sec" })}
                      href={`/mockups/ward-flow/ward/${encodeURIComponent(planningUnitId)}?tab=departure-planning`}
                    >
                      Open ward departure planning
                    </Link>
                  )}
                  <p className={pageStyles.planActionNote}>
                    Choose the patient and departure time in the ward’s Decisions tab.
                  </p>
                </div>
              )}
            </div>
          }
        />
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
          {population === "records" ? (
            <div className={pageStyles.quickFilterBar} role="toolbar" aria-label="Quick destination filters">
              <span className={pageStyles.filterLabelText}>Destination</span>
              <FilterChip
                className={pageStyles.quickChip}
                pressed={destination === "all"}
                count={destinationCount("all")}
                onPressedChange={() => {
                  setDestination("all");
                  clearSelection();
                }}
              >
                All
              </FilterChip>
              {LEAVING_DESTINATIONS.slice(0, 4).map((item) => (
                <FilterChip
                  key={item.id}
                  className={pageStyles.quickChip}
                  pressed={destination === item.id}
                  count={destinationCount(item.id)}
                  onPressedChange={() => {
                    setDestination(destination === item.id ? "all" : item.id);
                    clearSelection();
                  }}
                >
                  {item.label}
                </FilterChip>
              ))}
            </div>
          ) : (
            <div className={pageStyles.quickFilterBar} role="toolbar" aria-label="Quick blocker filters">
              <span className={pageStyles.filterLabelText}>Blocker</span>
              <FilterChip
                className={pageStyles.quickChip}
                pressed={blockerCategory === "all"}
                count={blockerCount("all")}
                onPressedChange={() => {
                  setBlockerCategory("all");
                  clearSelection();
                }}
              >
                All
              </FilterChip>
              {BLOCKER_CATEGORIES.slice(0, 4).map((cat) => (
                <FilterChip
                  key={cat.id}
                  className={pageStyles.quickChip}
                  pressed={blockerCategory === cat.id}
                  count={blockerCount(cat.id)}
                  onPressedChange={() => {
                    setBlockerCategory(blockerCategory === cat.id ? "all" : cat.id);
                    clearSelection();
                  }}
                >
                  {cat.label}
                </FilterChip>
              ))}
            </div>
          )}
        </Card>
        <div className={pageStyles.workspace} data-detail-open={Boolean(selected || releaseId) || undefined}>
          <Card className={pageStyles.register} aria-labelledby="discharge-register-heading">
            <header className={pageStyles.panelHeader}>
              <h2 id="discharge-register-heading" className={pageStyles.localTitle}>
                {population === "releases" ? "Bed release worklist" : "Admission discharge records"}
              </h2>
              <div
                className={pageStyles.statusFilters}
                aria-label="Filter by discharge status"
                hidden={population === "records" && guarded.status === "denied"}
              >
                <button
                  type="button"
                  aria-pressed={status === "all"}
                  onClick={() => {
                    setStatus("all");
                    clearSelection();
                  }}
                >
                  <span>All</span> <strong className={pageStyles.tabCountBadge}>{total}</strong>
                </button>
                {WORK_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    data-status={key}
                    aria-pressed={status === key}
                    onClick={() => {
                      setStatus(key);
                      clearSelection();
                    }}
                  >
                    <span>
                      {population === "releases" && key === "departed" ? "Discharged · 24h" : WORK_STATUS_LABELS[key]}
                    </span>{" "}
                    <strong className={pageStyles.tabCountBadge}>{counts[key]}</strong>
                  </button>
                ))}
              </div>
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
                  {view === "barriers" ? barrierRows.filter((row) => row.lit).length : highlightedCount} highlighted
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
                {population === "records" && guarded.status === "denied" ? "Unavailable" : `${shown} shown`}
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
                          </th>
                        </tr>
                        {releaseGroups[key].length === 0 ? (
                          <tr>
                            <td colSpan={3} className={pageStyles.emptyGroup}>
                              None
                            </td>
                          </tr>
                        ) : (
                          litFirst(releaseGroups[key], releaseLit).map((release) => {
                            const unit = units.find((candidate) => candidate.id === release.unitId);
                            const linked = records.find((candidate) => candidate.admissionId === release.admissionId);
                            const overdue = release.state !== "discharged" && release.expectedAt < now;
                            return (
                              <tr
                                key={release.id}
                                data-release-id={release.id}
                                data-selected={releaseId === release.id}
                                data-highlighted={releaseLit(release) || undefined}
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
                                        <span aria-hidden="true"> · </span>
                                        <span className={pageStyles.patientHint}>{recordName(linked)}</span>
                                      </>
                                    ) : null}
                                  </span>
                                </td>
                                <td data-label="Timing" className={pageStyles.timingCell}>
                                  <strong className={pageStyles.band}>
                                    {overdue ? "Now" : BAND_LABELS[releaseBand(release, now) as ReleaseBand]}
                                  </strong>{" "}
                                  <span className={pageStyles.due}>
                                    {recordedMoment(
                                      release.state === "discharged" ? release.confirmedAt : release.expectedAt,
                                      dayZero,
                                    )}
                                  </span>
                                  {overdue ? (
                                    <span className={pageStyles.overdue}>
                                      <StatusGlyph tone="danger" size={9} />
                                      {durMinutes(now - release.expectedAt)} overdue
                                    </span>
                                  ) : null}
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
                    <div className={pageStyles.identity}>
                      <div className={pageStyles.identityText}>
                        <h3 className={pageStyles.patientFullName}>
                          {linkedReleaseRecord
                            ? recordName(linkedReleaseRecord)
                            : unitLabel(selectedUnit, detailRelease.unitId)}
                        </h3>
                        <p className={pageStyles.identityMeta}>
                          {linkedReleaseRecord?.identity.kind === "linked" && (
                            <span className={pageStyles.mono}>UMRN {linkedReleaseRecord.identity.patient.umrn}</span>
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
                            detailRelease.state === "discharged" ? detailRelease.confirmedAt : detailRelease.expectedAt,
                            dayZero,
                          )}
                        </dd>
                      </div>
                    </dl>

                    {linkedReleaseRecord ? (
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

                    {tabList(Boolean(detailRelease.blocker))}

                    <div className={drawerTab === "milestones" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                      <RecordedDischargeMilestones
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
                          {
                            label: "Recorded discharge blocker",
                            state: detailRelease.blocker ? "blocked" : "pending",
                            detail: detailRelease.blocker ?? "No discharge blocker recorded",
                          },
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
                    </div>

                    <div className={drawerTab === "barriers" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
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

                    <div className={drawerTab === "transport" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
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

                    <div className={drawerTab === "dossier" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
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
                  <Link
                    href={`/mockups/ward-flow/ward/${selectedUnitId}`}
                    className={buttonClass({ size: "sm", variant: "sec" })}
                  >
                    Open ward
                  </Link>
                </footer>
              )}
            </aside>
          </div>
        </div>
        {guarded.status === "allowed" ? (
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
                  const band = releaseBand(release, now) as ReleaseBand;
                  return (
                    <tr key={release.id}>
                      <td>{unitLabel(unit, release.unitId)}</td>
                      <td>{healthServiceLabel(unit)}</td>
                      <td className={styles.countdownBand}>{BAND_LABELS[band]}</td>
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
                const band = releaseBand(release, now) as ReleaseBand;
                return (
                  <li key={release.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardBand}>{BAND_LABELS[band]}</span>
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
