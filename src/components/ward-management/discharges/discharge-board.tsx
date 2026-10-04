"use client";
import { DischargeCareJourney } from "./discharge-care-journey";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Phone,
  RefreshCw,
  ShieldAlert,
  Truck,
  X,
} from "lucide-react";
import { MissingValue } from "@/components/ui/missing-value";
import { RELEASE_BANDS, releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import {
  formatInstantWithDay,
  formatSheetMoment,
  splitDuration,
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
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import { DischargeFollowUp } from "./discharge-follow-up";
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
function getInitials(name: string): string {
  const parts = name.replace(/,/g, "").trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name.slice(0, 2) || "PT").toUpperCase();
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
] as const;

function RecordedDischargeMilestones({
  milestones,
}: {
  milestones: { label: string; detail: string; state: "complete" | "pending" | "blocked" }[];
}) {
  return (
    <div className={pageStyles.stepperCard}>
      <span className={pageStyles.stepperTitle}>Recorded discharge milestones</span>
      <div className={pageStyles.stepper}>
        {milestones.map((milestone, index) => (
          <div className={pageStyles.stepperGate} key={milestone.label}>
            <div
              className={`${pageStyles.gateIndicator} ${milestone.state === "complete" ? pageStyles.gateIndicatorComplete : milestone.state === "blocked" ? pageStyles.gateIndicatorBlocked : pageStyles.gateIndicatorPending}`}
            >
              {milestone.state === "complete" ? "✓" : milestone.state === "blocked" ? "!" : index + 1}
            </div>
            <div className={pageStyles.gateDetails}>
              <span className={pageStyles.gateTitle}>
                {index + 1}. {milestone.label}
              </span>
              <span className={pageStyles.gateActor}>{milestone.detail}</span>
            </div>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        Medical summary, pharmacy verification and transport booking are not recorded here. Departure does not verify
        bed preparation.
      </p>
    </div>
  );
}

export function DischargeBoard() {
  const { worldGeneration } = useWardFlow();
  // Remount clears every selected handle and DTO synchronously on a reset/scenario change.
  // This board has one fixed coordinator actor; it does not offer a role switch.
  return <DischargeWorkspace key={`${worldGeneration}:${RECORD_ACTOR.role}`} />;
}

function DischargeWorkspace() {
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
  const [selected, setSelected] = useState<{ admissionId: string; handle: DischargeOpenHandle } | null>(null);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [showUpdateDate, setShowUpdateDate] = useState(false);
  const [newTimeDraft, setNewTimeDraft] = useState<string>("");
  const [openError, setOpenError] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"milestones" | "barriers" | "transport" | "dossier">("milestones");
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const guarded = readDischargeRecords(RECORD_ACTOR);
  const records = guarded.status === "allowed" ? guarded.value : [];
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
  const releaseGroups = groupDischarges(scopedReleases, now);
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
  const visibleRecords = scopedRecords
    .filter((record) => status === "all" || recordStatus(record) === status)
    .sort(
      (a, b) =>
        WORK_ORDER.indexOf(recordStatus(a)) - WORK_ORDER.indexOf(recordStatus(b)) ||
        (a.expectedDischargeAt ?? Infinity) - (b.expectedDischargeAt ?? Infinity),
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
    (triggerRef.current ?? listRef.current)?.focus();
  };
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
  const badge = (stage: WorkStatus) => (
    <span className={pageStyles.badge} data-status={stage}>
      <span className={styles.badgeGlyph} aria-hidden="true">
        {stage === "blocked" ? "▲" : stage === "departed" ? "✓" : stage === "confirmed" ? "■" : "○"}
      </span>
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

  return (
    <div
      className={`${styles.screen} ${pageStyles.screen}`}
      data-testid="ward-discharge-board"
      data-ward-design="third-edition"
    >
      <main id="main-content" className={`${styles.main} ${pageStyles.main}`}>
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
        <header className={pageStyles.boardHeaderBanner}>
          <div className={pageStyles.boardHeaderLeft}>
            <h2 className={pageStyles.boardMainTitle}>Discharges &amp; Departure Trajectory</h2>
            <span className={pageStyles.contextBadge}>Chronological Discharge Waves</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className={pageStyles.populationSwitch} aria-label="Discharge population">
              <button
                type="button"
                aria-pressed={population === "releases"}
                onClick={() => {
                  setPopulation("releases");
                  setStatus("all");
                  setDestination("all");
                  setBlockerCategory("all");
                  clearSelection();
                }}
              >
                Anonymous releases <span className={styles.countBadge}>{bedReleases.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={population === "records"}
                onClick={() => {
                  setPopulation("records");
                  setStatus("all");
                  setDestination("all");
                  setBlockerCategory("all");
                  clearSelection();
                }}
              >
                Admission records{" "}
                <span className={styles.countBadge}>
                  {guarded.status === "allowed" ? records.length : "Unavailable"}
                </span>
              </button>
            </div>
            <time className={`${pageStyles.asOf} ${styles.asOf}`}>
              <span className={pageStyles.liveDot} aria-hidden="true" />
              <span className="sr-only">Live: </span>
              As of {formatSheetMoment(now, dayZero)}
            </time>
            <div className={pageStyles.planActionWrapper}>
              <button
                type="button"
                data-testid="ward-discharge-plan-departure"
                className={pageStyles.planActionBtn}
                aria-expanded={planningOpen}
                onClick={() => setPlanningOpen(!planningOpen)}
              >
                + Plan departure
              </button>
              {planningOpen && (
                <div className={pageStyles.filters}>
                  <label className={pageStyles.filterField}>
                    <span className={pageStyles.filterLabelText}>Ward for departure planning</span>
                    <select value={planningUnitId} onChange={(event) => setPlanningUnitId(event.target.value)}>
                      <option value="">Choose ward</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unitLabel(unit, unit.id)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {planningUnitId && units.some((unit) => unit.id === planningUnitId) && (
                    <Link
                      className={pageStyles.quietButton}
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
          </div>
        </header>
        <div
          className={pageStyles.telemetryGrid}
          data-testid="ward-discharge-kpi-strip"
          role="region"
          aria-label="Discharge pipeline summary filters"
        >
          <button
            type="button"
            data-testid="ward-discharge-kpi-blocked"
            className={pageStyles.telemetryCard}
            aria-pressed={status === "blocked"}
            aria-label={`${kpiCardLabel("blocked", population)}: ${counts.blocked}`}
            onClick={() => {
              setStatus(status === "blocked" ? "all" : "blocked");
              clearSelection();
            }}
          >
            <div className={pageStyles.telemetryCardTop}>
              <span className={pageStyles.telemetryWave}>Wave 1 · Immediate/Stuck</span>
              <span className={`${pageStyles.telemetryStatusPip} ${pageStyles.pipDanger}`} aria-hidden="true" />
            </div>
            <div className={pageStyles.telemetryValRow}>
              <strong className={pageStyles.telemetryValue}>{counts.blocked}</strong>
              <span className={pageStyles.telemetryLabel}>{kpiCardLabel("blocked", population)}</span>
            </div>
          </button>
          <button
            type="button"
            data-testid="ward-discharge-kpi-confirmed"
            className={pageStyles.telemetryCard}
            aria-pressed={status === "confirmed"}
            aria-label={`${kpiCardLabel("confirmed", population)}: ${counts.confirmed}`}
            onClick={() => {
              setStatus(status === "confirmed" ? "all" : "confirmed");
              clearSelection();
            }}
          >
            <div className={pageStyles.telemetryCardTop}>
              <span className={pageStyles.telemetryWave}>Wave 2 · Morning Discharges</span>
              <span className={`${pageStyles.telemetryStatusPip} ${pageStyles.pipGood}`} aria-hidden="true" />
            </div>
            <div className={pageStyles.telemetryValRow}>
              <strong className={pageStyles.telemetryValue}>{counts.confirmed}</strong>
              <span className={pageStyles.telemetryLabel}>{kpiCardLabel("confirmed", population)}</span>
            </div>
          </button>
          <button
            type="button"
            data-testid="ward-discharge-kpi-expected"
            className={pageStyles.telemetryCard}
            aria-pressed={status === "expected"}
            aria-label={`${kpiCardLabel("expected", population)}: ${counts.expected}`}
            onClick={() => {
              setStatus(status === "expected" ? "all" : "expected");
              clearSelection();
            }}
          >
            <div className={pageStyles.telemetryCardTop}>
              <span className={pageStyles.telemetryWave}>Wave 3 · Afternoon Discharges</span>
              <span className={`${pageStyles.telemetryStatusPip} ${pageStyles.pipWarn}`} aria-hidden="true" />
            </div>
            <div className={pageStyles.telemetryValRow}>
              <strong className={pageStyles.telemetryValue}>{counts.expected}</strong>
              <span className={pageStyles.telemetryLabel}>{kpiCardLabel("expected", population)}</span>
            </div>
          </button>
          <button
            type="button"
            data-testid="ward-discharge-kpi-departed"
            className={pageStyles.telemetryCard}
            aria-pressed={status === "departed"}
            aria-label={`${kpiCardLabel("departed", population)}: ${counts.departed}`}
            onClick={() => {
              setStatus(status === "departed" ? "all" : "departed");
              clearSelection();
            }}
          >
            <div className={pageStyles.telemetryCardTop}>
              <span className={pageStyles.telemetryWave}>Wave 4 · Cleared Today</span>
              <span className={`${pageStyles.telemetryStatusPip} ${pageStyles.pipAccent}`} aria-hidden="true" />
            </div>
            <div className={pageStyles.telemetryValRow}>
              <strong className={pageStyles.telemetryValue}>{counts.departed}</strong>
              <span className={pageStyles.telemetryLabel}>{kpiCardLabel("departed", population)}</span>
            </div>
          </button>
        </div>
        <div className={pageStyles.filterControlBar}>
          <div className={pageStyles.filters}>
            <label htmlFor="discharges-filter-service" className={pageStyles.filterField}>
              <span className={pageStyles.filterLabelText}>Service</span>
              <select
                id="discharges-filter-service"
                name="dischargesFilterService"
                value={service}
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
              </select>
            </label>
            <label htmlFor="discharges-filter-ward" className={pageStyles.filterField}>
              <span className={pageStyles.filterLabelText}>Ward</span>
              <select
                id="discharges-filter-ward"
                name="dischargesFilterWard"
                value={ward}
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
              </select>
            </label>
            {population === "records" && (
              <>
                <label htmlFor="discharges-filter-identity" className={pageStyles.filterField}>
                  <span className={pageStyles.filterLabelText}>Patient link</span>
                  <select
                    id="discharges-filter-identity"
                    name="dischargesFilterIdentity"
                    value={identity}
                    onChange={(event) => {
                      setIdentity(event.target.value);
                      clearSelection();
                    }}
                  >
                    <option value="all">All records</option>
                    <option value="linked">Linked patient</option>
                    <option value="missing">Missing or unavailable</option>
                  </select>
                </label>
                <label htmlFor="discharges-filter-destination" className={pageStyles.filterField}>
                  <span className={pageStyles.filterLabelText}>Destination</span>
                  <select
                    id="discharges-filter-destination"
                    name="dischargesFilterDestination"
                    value={destination}
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
                  </select>
                </label>
              </>
            )}
            {(service !== "all" ||
              ward !== "all" ||
              status !== "all" ||
              identity !== "all" ||
              destination !== "all" ||
              blockerCategory !== "all") && (
              <button type="button" className={pageStyles.quietButton} onClick={clearAllFilters}>
                Clear filters
              </button>
            )}
          </div>
          {population === "records" && (
            <div className={pageStyles.quickFilterBar} role="toolbar" aria-label="Quick destination filters">
              <span className={pageStyles.quickFilterTitle}>
                <Filter size={13} className={pageStyles.inlineIcon} aria-hidden="true" />
                Destinations:
              </span>
              <button
                type="button"
                className={`${pageStyles.quickFilterPill} ${destination === "all" ? pageStyles.quickFilterPillActive : ""}`}
                onClick={() => {
                  setDestination("all");
                  clearSelection();
                }}
              >
                All destinations
              </button>
              {LEAVING_DESTINATIONS.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${pageStyles.quickFilterPill} ${destination === item.id ? pageStyles.quickFilterPillActive : ""}`}
                  onClick={() => {
                    setDestination(destination === item.id ? "all" : item.id);
                    clearSelection();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {population === "releases" && (
            <div className={pageStyles.quickFilterBar} role="toolbar" aria-label="Quick blocker filters">
              <span className={pageStyles.quickFilterTitle}>
                <ShieldAlert size={13} className={pageStyles.inlineIcon} aria-hidden="true" />
                Blocker focus:
              </span>
              <button
                type="button"
                className={`${pageStyles.quickFilterPill} ${blockerCategory === "all" ? pageStyles.quickFilterPillActive : ""}`}
                onClick={() => {
                  setBlockerCategory("all");
                  clearSelection();
                }}
              >
                All blockers
              </button>
              {BLOCKER_CATEGORIES.slice(0, 4).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`${pageStyles.quickFilterPill} ${blockerCategory === cat.id ? pageStyles.quickFilterPillActive : ""}`}
                  onClick={() => {
                    setBlockerCategory(blockerCategory === cat.id ? "all" : cat.id);
                    clearSelection();
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={pageStyles.workspace}>
          <section className={pageStyles.register} aria-labelledby="discharge-register-heading">
            <header className={pageStyles.panelHeader}>
              <div className={pageStyles.panelTitleGroup}>
                <h2 id="discharge-register-heading">
                  {population === "releases" ? "Bed release worklist" : "Admission discharge records"}
                </h2>
                <span aria-live="polite" className={styles.countBadge}>
                  {population === "records" && guarded.status === "denied" ? "Unavailable" : `${shown} shown`}
                </span>
              </div>
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
                  All <strong className={styles.countBadge}>{total}</strong>
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
                    {population === "releases" && key === "departed" ? "Discharged · 24h" : WORK_STATUS_LABELS[key]}{" "}
                    <strong className={styles.countBadge}>{counts[key]}</strong>
                  </button>
                ))}
              </div>
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
              ) : (
                <table className={pageStyles.workTable}>
                  <caption className={pageStyles.localTitle}>
                    {population === "releases"
                      ? "Anonymous bed releases, blocked first. Completed releases cover the last 24 hours."
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
                        return (
                          <tr
                            key={record.id}
                            data-selected={selected?.admissionId === record.admissionId}
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
                                aria-pressed={selected?.admissionId === record.admissionId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRecord(record, e.currentTarget);
                                }}
                              >
                                {recordName(record)}
                              </button>
                              <span className={pageStyles.secondary}>
                                {record.identity.kind === "linked" ? record.identity.patient.umrn : record.admissionId}
                              </span>
                              <span className={pageStyles.secondary}>
                                {unitLabel(unit, record.unitId)} · {healthServiceLabel(unit)}
                              </span>
                            </td>
                            <td
                              data-label={recordStage(record) === "departed" ? "Departed" : "Expected"}
                              className={styles.timingCell}
                            >
                              {recordedMoment(
                                recordStage(record) === "departed" ? record.leftAt : record.expectedDischargeAt,
                                dayZero,
                              )}
                            </td>
                            <td data-label="Stage / blocker">
                              <div className={pageStyles.stageCluster}>
                                {badge(recordStage(record))}
                                {recordStatus(record) === "blocked" && (
                                  <span className={pageStyles.blocker}>{record.blockReason}</span>
                                )}
                                {record.leavingDestination && (
                                  <span className={pageStyles.destinationTag}>
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
                            <div className={pageStyles.waveSectionHeaderBox}>
                              <div className={pageStyles.waveSectionLeft}>
                                <h3>
                                  {key === "discharged-today" ? "Discharged in last 24 hours" : GROUP_LABELS[key]}{" "}
                                  <span className={styles.countBadge}>{releaseGroups[key].length}</span>
                                </h3>
                                <span className={pageStyles.waveSectionSubtitle}>
                                  {key === "blocked"
                                    ? "Wave 1 · Immediate Discharge Interventions"
                                    : key === "confirmed"
                                      ? "Wave 2 · Midday Scheduled Departures"
                                      : key === "expected"
                                        ? "Wave 3 · Afternoon Departures"
                                        : "Wave 4 · Cleared Today"}
                                </span>
                              </div>
                              <span
                                className={
                                  key === "blocked"
                                    ? pageStyles.waveTagDanger
                                    : key === "confirmed"
                                      ? pageStyles.waveTagTarget
                                      : key === "expected"
                                        ? pageStyles.waveTagTracked
                                        : pageStyles.waveTagCleared
                                }
                              >
                                {key === "blocked"
                                  ? "Priority Escalation"
                                  : key === "confirmed"
                                    ? "Target: 12:00 AWST"
                                    : key === "expected"
                                      ? "Trajectory Tracked"
                                      : "Departed Today"}
                              </span>
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
                          releaseGroups[key].map((release) => {
                            const unit = units.find((candidate) => candidate.id === release.unitId);
                            const linked = records.find((candidate) => candidate.admissionId === release.admissionId);
                            return (
                              <tr
                                key={release.id}
                                data-selected={releaseId === release.id}
                                onClick={(e) => {
                                  triggerRef.current = e.currentTarget;
                                  setSelected(null);
                                  setReleaseId(release.id);
                                  focusDetail();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    triggerRef.current = e.currentTarget;
                                    setSelected(null);
                                    setReleaseId(release.id);
                                    focusDetail();
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
                                      triggerRef.current = e.currentTarget;
                                      setSelected(null);
                                      setReleaseId(release.id);
                                      focusDetail();
                                    }}
                                  >
                                    {unitLabel(unit, release.unitId)}
                                  </button>
                                  <span className={pageStyles.secondary}>{healthServiceLabel(unit)}</span>
                                  {linked && <span className={pageStyles.patientHint}>{recordName(linked)}</span>}
                                </td>
                                <td data-label="Timing" className={styles.timingCell}>
                                  {release.state !== "discharged" && release.expectedAt < now ? (
                                    <strong className={`${styles.countdownBand} ${styles.overdueBand}`}>
                                      Now (Overdue {splitDuration(now - release.expectedAt)})
                                    </strong>
                                  ) : (
                                    <strong className={styles.countdownBand}>
                                      {BAND_LABELS[releaseBand(release, now) as ReleaseBand]}
                                    </strong>
                                  )}
                                  <span className={`${pageStyles.secondary} ${styles.secondaryMoment}`}>
                                    {recordedMoment(
                                      release.state === "discharged" ? release.confirmedAt : release.expectedAt,
                                      dayZero,
                                    )}
                                  </span>
                                </td>
                                <td data-label="Stage / blocker">
                                  <div className={pageStyles.stageCluster}>
                                    {badge(release.state === "discharged" ? "departed" : release.state)}
                                    {release.blocker && <span className={pageStyles.blocker}>{release.blocker}</span>}
                                    {release.waitingOn && (
                                      <span className={pageStyles.transportNote}>
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
                  <span className={styles.countBadge}>{releaseGroups.excludedBeyondToday} expected in 2+ days</span>
                  <span data-testid="ward-discharge-completed-before-today" className={styles.countBadge}>
                    {releaseGroups.completedBeforeToday} discharged 24h+ ago
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.countBadge}>
                    {scopedRecords.filter((record) => record.identity.kind === "linked").length} patient linked
                  </span>
                  <span className={styles.countBadge}>
                    {scopedRecords.filter((record) => record.identity.kind !== "linked").length} link missing /
                    unavailable
                  </span>
                  <span className={styles.countBadge}>
                    {scopedRecords.filter((record) => record.expectedDischargeAt === null).length} expected date not
                    recorded
                  </span>
                </>
              )}
            </footer>
          </section>
          {Boolean(selected || releaseId) && (
            <div
              className={`${styles.scrim} ${pageStyles.scrim}`}
              onClick={closeDrawer}
              aria-hidden="true"
              data-testid="ward-discharge-scrim"
            />
          )}
          <aside
            ref={detailRef}
            className={`${pageStyles.detail} ${styles.detailPanel}${selected || releaseId ? ` ${styles.open} ${pageStyles.open}` : ""}`}
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
            <header className={pageStyles.panelHeader}>
              <div className={pageStyles.drawerTopBar}>
                <h2 id="discharge-detail-heading" className={pageStyles.drawerTopTitle}>
                  {activeRecord || detailRelease ? "Discharge Trajectory & Logistics" : "Record detail"}
                </h2>
                {(selected || releaseId) && (
                  <button type="button" className={pageStyles.closeBtn} aria-label="Close" onClick={closeDrawer}>
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </header>
            <div className={pageStyles.detailBody} role="region" aria-label="Selected discharge details" tabIndex={0}>
              {activeRecord ? (
                <>
                  <div className={pageStyles.unifiedPatientCard}>
                    <div className={pageStyles.unifiedCardTop}>
                      <div className={pageStyles.unifiedIdentityRow}>
                        <div className={pageStyles.avatarSquare} aria-hidden="true">
                          {getInitials(recordName(activeRecord))}
                        </div>
                        <div className={pageStyles.unifiedNameGroup}>
                          <h3
                            className={pageStyles.patientFullName}
                            style={{ margin: 0, fontSize: "var(--t-3)", fontWeight: 700 }}
                          >
                            {recordName(activeRecord)}
                          </h3>
                          <div className={pageStyles.unifiedMetaRow}>
                            {activeRecord.identity.kind === "linked" && (
                              <span className={pageStyles.unifiedMetaBadge}>
                                UMRN {activeRecord.identity.patient.umrn}
                              </span>
                            )}
                            <span className={pageStyles.unifiedMetaBadge}>{activeRecord.admissionId}</span>
                            <span>{unitLabel(selectedUnit, activeRecord.unitId)}</span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={
                          recordStatus(activeRecord) === "blocked"
                            ? pageStyles.badgeBlocked
                            : recordStage(activeRecord) === "confirmed"
                              ? pageStyles.badgeConfirmed
                              : recordStage(activeRecord) === "departed"
                                ? pageStyles.badgeCleared
                                : pageStyles.badgeExpected
                        }
                      >
                        {recordStatus(activeRecord) === "blocked" ? "▲ Blocked" : recordStage(activeRecord)}
                      </span>
                    </div>
                  </div>

                  <div className={pageStyles.drawerTabs} role="tablist" aria-label="Discharge inspection sections">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={drawerTab === "milestones"}
                      className={`${pageStyles.drawerTab} ${drawerTab === "milestones" ? pageStyles.drawerTabActive : ""}`}
                      onClick={() => setDrawerTab("milestones")}
                    >
                      <Clock size={13} aria-hidden="true" />
                      Milestones
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={drawerTab === "barriers"}
                      className={`${pageStyles.drawerTab} ${drawerTab === "barriers" ? pageStyles.drawerTabActive : ""}`}
                      onClick={() => setDrawerTab("barriers")}
                    >
                      <ShieldAlert size={13} aria-hidden="true" />
                      Barriers
                      {activeRecord.blockReason && <span className={pageStyles.tabBadgeAlert}>!</span>}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={drawerTab === "transport"}
                      className={`${pageStyles.drawerTab} ${drawerTab === "transport" ? pageStyles.drawerTabActive : ""}`}
                      onClick={() => setDrawerTab("transport")}
                    >
                      <Truck size={13} aria-hidden="true" />
                      Transport
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={drawerTab === "dossier"}
                      className={`${pageStyles.drawerTab} ${drawerTab === "dossier" ? pageStyles.drawerTabActive : ""}`}
                      onClick={() => setDrawerTab("dossier")}
                    >
                      <FileText size={13} aria-hidden="true" />
                      Dossier
                    </button>
                  </div>

                  {/* Tab 1: Milestones (Option 2 Stepper) */}
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

                    <div className={pageStyles.transportCard}>
                      <div className={pageStyles.transportHeader}>
                        <span className={pageStyles.sectionTitle}>
                          <Truck size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                          Transport Trajectory
                        </span>
                        <span className={pageStyles.transportStatusBadge}>Not recorded</span>
                      </div>
                      <div className={pageStyles.transportInfoRow}>
                        <span className={pageStyles.transportLabel}>Destination:</span>
                        <span className={pageStyles.transportValue}>
                          {LEAVING_DESTINATIONS.find((item) => item.id === activeRecord.leavingDestination)?.label ??
                            "Not recorded"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tab 2: Barriers */}
                  <div className={drawerTab === "barriers" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                    {activeRecord.blockReason ? (
                      <div className={pageStyles.barrierActionBox}>
                        <div className={pageStyles.barrierTop}>
                          <span className={pageStyles.barrierCause}>
                            <ShieldAlert size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                            Barrier Mitigation
                          </span>
                          <span className={pageStyles.barrierUrgencyBadge}>Active Blocker</span>
                        </div>
                        <p className={pageStyles.barrierDesc}>{activeRecord.blockReason}</p>
                        <div className={pageStyles.actionDeck}>
                          <button
                            type="button"
                            className={pageStyles.deckButtonEscalate}
                            aria-disabled="true"
                            aria-describedby={`mitigate-note-${activeRecord.admissionId}`}
                            title="Not wired in this prototype."
                            onClick={ignoreUnavailableActivation}
                          >
                            <Phone size={14} aria-hidden="true" />
                            <span>Page Transport Dispatcher (Priority 1)</span>
                          </button>
                          <button
                            type="button"
                            className={pageStyles.deckButton}
                            aria-disabled="true"
                            aria-describedby={`mitigate-note-${activeRecord.admissionId}`}
                            title="Not wired in this prototype."
                            onClick={ignoreUnavailableActivation}
                          >
                            <RefreshCw size={14} aria-hidden="true" />
                            <span>Authorize Alternate Escort</span>
                          </button>
                          <span id={`mitigate-note-${activeRecord.admissionId}`} className="sr-only">
                            Not wired in this prototype.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={pageStyles.barrierActionBox}
                        style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
                      >
                        <div className={pageStyles.barrierTop}>
                          <span className={pageStyles.barrierCause} style={{ color: "var(--good)" }}>
                            <CheckCircle2 size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                            No discharge blocker recorded
                          </span>
                          <span className={pageStyles.transportStatusBadge}>Not recorded</span>
                        </div>
                        <p className={pageStyles.barrierDesc}>
                          No discharge blocker is recorded. Clinical, pharmacy and transit clearance are not recorded
                          here.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tab 3: Transport */}
                  <div className={drawerTab === "transport" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                    <div className={pageStyles.dispatchBox}>
                      <div className={pageStyles.transportHeader}>
                        <span className={pageStyles.sectionTitle}>
                          <Truck size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                          Transport Coordination & Route
                        </span>
                        <span
                          className={
                            activeRecord.blockReason ? pageStyles.badgeBlocked : pageStyles.transportStatusBadge
                          }
                        >
                          Not recorded
                        </span>
                      </div>
                      <div className={pageStyles.dispatchRow}>
                        <span className={pageStyles.dispatchLabel}>Logistics Ref:</span>
                        <span className={pageStyles.dispatchValue} style={{ fontFamily: "var(--mono)" }}>
                          Not recorded
                        </span>
                      </div>
                      <div className={pageStyles.dispatchRow}>
                        <span className={pageStyles.dispatchLabel}>Provider:</span>
                        <span className={pageStyles.dispatchValue}>Not recorded</span>
                      </div>
                      <div className={pageStyles.dispatchRow}>
                        <span className={pageStyles.dispatchLabel}>Origin to Destination:</span>
                        <span className={pageStyles.dispatchValue}>
                          {unitLabel(selectedUnit, activeRecord.unitId)} →{" "}
                          {LEAVING_DESTINATIONS.find((item) => item.id === activeRecord.leavingDestination)?.label ??
                            "Not recorded"}
                        </span>
                      </div>
                      <div className={pageStyles.actionDeck}>
                        <button
                          type="button"
                          className={`${pageStyles.btnDeck} ${pageStyles.btnDeckPrimary}`}
                          aria-disabled="true"
                          aria-describedby={`transport-note-${activeRecord.admissionId}`}
                          title="Not wired in this prototype."
                          onClick={ignoreUnavailableActivation}
                        >
                          Page Dispatch Desk
                        </button>
                        <button
                          type="button"
                          className={pageStyles.btnDeck}
                          aria-disabled="true"
                          aria-describedby={`transport-note-${activeRecord.admissionId}`}
                          title="Not wired in this prototype."
                          onClick={ignoreUnavailableActivation}
                        >
                          Re-assign Provider
                        </button>
                        <span id={`transport-note-${activeRecord.admissionId}`} className="sr-only">
                          Not wired in this prototype.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tab 4: Dossier (Full episode details & update date/time form) */}
                  <div className={drawerTab === "dossier" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                    <dl>
                      <dt>Expected discharge</dt>
                      <dd>
                        {recordedMoment(activeRecord.expectedDischargeAt, dayZero)}
                        {/* Walkthrough D8 (25 Sept 2026): not offered once the person has left, because the
                            reducer refuses a new date for a departed stay. */}
                        {recordStage(activeRecord) === "departed" ? null : !showUpdateDate ? (
                          <div style={{ marginTop: "0.5rem" }}>
                            <button
                              type="button"
                              className={pageStyles.actionBtn}
                              data-testid="ward-discharge-update-date-btn"
                              onClick={() => {
                                setShowUpdateDate(true);
                                setNewTimeDraft(
                                  activeRecord.expectedDischargeAt !== null
                                    ? formatInstantWithDay(activeRecord.expectedDischargeAt, now)
                                    : "14:00",
                                );
                              }}
                            >
                              Update expected departure
                            </button>
                          </div>
                        ) : (
                          <form
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
                            style={{
                              marginTop: "0.5rem",
                              display: "flex",
                              gap: "0.5rem",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <input
                              id="ward-discharge-new-time-input"
                              name="newExpectedDischargeTime"
                              type="time"
                              aria-label="New expected discharge time"
                              data-testid="ward-discharge-new-time-input"
                              value={newTimeDraft}
                              onChange={(e) => setNewTimeDraft(e.target.value)}
                              required
                            />
                            <button
                              type="submit"
                              className={pageStyles.actionBtn}
                              data-testid="ward-discharge-save-time-btn"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className={pageStyles.actionBtn}
                              data-testid="ward-discharge-cancel-time-btn"
                              onClick={() => setShowUpdateDate(false)}
                            >
                              Cancel
                            </button>
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
                    <DischargeCareJourney key={`care-${activeRecord.id}`} record={activeRecord} actor={RECORD_ACTOR} />
                  </div>
                </>
              ) : detailRelease ? (
                <>
                  <div className={pageStyles.unifiedPatientCard}>
                    <div className={pageStyles.unifiedCardTop}>
                      <div className={pageStyles.unifiedIdentityRow}>
                        <div className={pageStyles.avatarSquare} aria-hidden="true">
                          {linkedReleaseRecord
                            ? getInitials(recordName(linkedReleaseRecord))
                            : unitLabel(selectedUnit, detailRelease.unitId).slice(0, 2).toUpperCase()}
                        </div>
                        <div className={pageStyles.unifiedNameGroup}>
                          <h3
                            className={pageStyles.patientFullName}
                            style={{ margin: 0, fontSize: "var(--t-3)", fontWeight: 700 }}
                          >
                            {linkedReleaseRecord
                              ? recordName(linkedReleaseRecord)
                              : unitLabel(selectedUnit, detailRelease.unitId)}
                          </h3>
                          <div className={pageStyles.unifiedMetaRow}>
                            {linkedReleaseRecord?.identity.kind === "linked" && (
                              <span className={pageStyles.unifiedMetaBadge}>
                                UMRN {linkedReleaseRecord.identity.patient.umrn}
                              </span>
                            )}
                            <span className={pageStyles.unifiedMetaBadge}>
                              {unitLabel(selectedUnit, detailRelease.unitId)}
                            </span>
                            <span>{healthServiceLabel(selectedUnit)}</span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={
                          detailRelease.blocker
                            ? pageStyles.badgeBlocked
                            : detailRelease.state === "confirmed"
                              ? pageStyles.badgeConfirmed
                              : detailRelease.state === "discharged"
                                ? pageStyles.badgeCleared
                                : pageStyles.badgeExpected
                        }
                      >
                        {detailRelease.blocker
                          ? "▲ Blocked"
                          : detailRelease.state === "discharged"
                            ? "Departed"
                            : detailRelease.state}
                      </span>
                    </div>

                    {linkedReleaseRecord ? (
                      <div className={pageStyles.unifiedActionRow}>
                        <button
                          type="button"
                          className={pageStyles.viewPatientRecordBtn}
                          onClick={(e) => {
                            setPopulation("records");
                            openRecord(linkedReleaseRecord, e.currentTarget);
                          }}
                        >
                          View patient discharge record →
                        </button>
                      </div>
                    ) : (
                      <p className={pageStyles.secondary} style={{ margin: 0 }}>
                        Bed release ID: {detailRelease.id}
                      </p>
                    )}
                  </div>

                  <div className={pageStyles.drawerTabs} role="tablist" aria-label="Discharge inspection sections">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={drawerTab === "milestones"}
                      className={`${pageStyles.drawerTab} ${drawerTab === "milestones" ? pageStyles.drawerTabActive : ""}`}
                      onClick={() => setDrawerTab("milestones")}
                    >
                      <Clock size={13} aria-hidden="true" />
                      Milestones
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={drawerTab === "barriers"}
                      className={`${pageStyles.drawerTab} ${drawerTab === "barriers" ? pageStyles.drawerTabActive : ""}`}
                      onClick={() => setDrawerTab("barriers")}
                    >
                      <ShieldAlert size={13} aria-hidden="true" />
                      Barriers
                      {detailRelease.blocker && <span className={pageStyles.tabBadgeAlert}>!</span>}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={drawerTab === "transport"}
                      className={`${pageStyles.drawerTab} ${drawerTab === "transport" ? pageStyles.drawerTabActive : ""}`}
                      onClick={() => setDrawerTab("transport")}
                    >
                      <Truck size={13} aria-hidden="true" />
                      Transport
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={drawerTab === "dossier"}
                      className={`${pageStyles.drawerTab} ${drawerTab === "dossier" ? pageStyles.drawerTabActive : ""}`}
                      onClick={() => setDrawerTab("dossier")}
                    >
                      <FileText size={13} aria-hidden="true" />
                      Dossier
                    </button>
                  </div>

                  {/* Tab 1: Milestones */}
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
                      <p className={styles.note}>
                        Preparation recorded: {detailRelease.preparationNote ?? "Reason not recorded"}. This is
                        informational and does not establish completion.
                      </p>
                    ) : null}

                    <div className={pageStyles.transportCard}>
                      <div className={pageStyles.transportHeader}>
                        <span className={pageStyles.sectionTitle}>
                          <Truck size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                          Transit Logistics
                        </span>
                        <span className={pageStyles.transportStatusBadge}>Not recorded</span>
                      </div>
                      <div className={pageStyles.transportInfoRow}>
                        <span className={pageStyles.transportLabel}>Requirement:</span>
                        <span className={pageStyles.transportValue}>Not recorded</span>
                      </div>
                    </div>
                  </div>

                  {/* Tab 2: Barriers */}
                  <div className={drawerTab === "barriers" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                    {detailRelease.blocker ? (
                      <div className={pageStyles.barrierActionBox}>
                        <div className={pageStyles.barrierTop}>
                          <span className={pageStyles.barrierCause}>
                            <ShieldAlert size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                            Barrier Mitigation
                          </span>
                          <span className={pageStyles.barrierUrgencyBadge}>Active Blocker</span>
                        </div>
                        <p className={pageStyles.barrierDesc}>{detailRelease.blocker}</p>
                        <div className={pageStyles.actionDeck}>
                          <button
                            type="button"
                            className={pageStyles.deckButtonEscalate}
                            aria-disabled="true"
                            aria-describedby={`mitigate-rel-note-${detailRelease.id}`}
                            title="Not wired in this prototype."
                            onClick={ignoreUnavailableActivation}
                          >
                            Expedite Bed Release Clearance
                          </button>
                          <span id={`mitigate-rel-note-${detailRelease.id}`} className="sr-only">
                            Not wired in this prototype.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={pageStyles.barrierActionBox}
                        style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
                      >
                        <div className={pageStyles.barrierTop}>
                          <span className={pageStyles.barrierCause} style={{ color: "var(--good)" }}>
                            <CheckCircle2 size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                            No discharge blocker recorded
                          </span>
                          <span className={pageStyles.transportStatusBadge}>Not recorded</span>
                        </div>
                        <p className={pageStyles.barrierDesc}>
                          No discharge blocker is recorded. Clinical, pharmacy and transit clearance are not recorded
                          here.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tab 3: Transport */}
                  <div className={drawerTab === "transport" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                    <div className={pageStyles.dispatchBox}>
                      <div className={pageStyles.transportHeader}>
                        <span className={pageStyles.sectionTitle}>
                          <Truck size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                          Transit Coordination & Route
                        </span>
                        <span
                          className={detailRelease.blocker ? pageStyles.badgeBlocked : pageStyles.transportStatusBadge}
                        >
                          Not recorded
                        </span>
                      </div>
                      <div className={pageStyles.dispatchRow}>
                        <span className={pageStyles.dispatchLabel}>Logistics Ref:</span>
                        <span className={pageStyles.dispatchValue} style={{ fontFamily: "var(--mono)" }}>
                          Not recorded
                        </span>
                      </div>
                      <div className={pageStyles.dispatchRow}>
                        <span className={pageStyles.dispatchLabel}>Provider:</span>
                        <span className={pageStyles.dispatchValue}>Not recorded</span>
                      </div>
                      <div className={pageStyles.dispatchRow}>
                        <span className={pageStyles.dispatchLabel}>Unit:</span>
                        <span className={pageStyles.dispatchValue}>
                          {unitLabel(selectedUnit, detailRelease.unitId)}
                        </span>
                      </div>
                      <div className={pageStyles.actionDeck}>
                        <button
                          type="button"
                          className={`${pageStyles.btnDeck} ${pageStyles.btnDeckPrimary}`}
                          aria-disabled="true"
                          aria-describedby={`transport-rel-note-${detailRelease.id}`}
                          title="Not wired in this prototype."
                          onClick={ignoreUnavailableActivation}
                        >
                          Dispatch Patient Transport
                        </button>
                        <span id={`transport-rel-note-${detailRelease.id}`} className="sr-only">
                          Not wired in this prototype.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tab 4: Dossier */}
                  <div className={drawerTab === "dossier" ? pageStyles.tabPane : pageStyles.tabPaneHidden}>
                    <dl>
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
                    </dl>
                  </div>
                </>
              ) : selected || openError ? (
                <p className={pageStyles.emptyState}>This record could not be opened. Select it again to retry.</p>
              ) : (
                <div className={pageStyles.restingDashboard}>
                  <div className={pageStyles.restingCallout}>
                    <ClipboardList size={18} className={pageStyles.restingCalloutIcon} aria-hidden="true" />
                    <p className={pageStyles.restingCalloutText}>
                      Select a record to view dates, blockers and ward follow-up. Choose any bed release or admission
                      stay from the worklist to inspect milestones, barrier escalations, and transport logistics.
                    </p>
                  </div>

                  <div>
                    <h4 className={pageStyles.restingSectionTitle}>Active Discharge Trajectory</h4>
                    <div className={pageStyles.restingStatGrid}>
                      <div className={pageStyles.restingStatCard}>
                        <span className={pageStyles.restingStatVal} style={{ color: "var(--warn)" }}>
                          {counts.blocked}
                        </span>
                        <span className={pageStyles.restingStatLabel}>Blocked releases</span>
                      </div>
                      <div className={pageStyles.restingStatCard}>
                        <span className={pageStyles.restingStatVal} style={{ color: "var(--good)" }}>
                          {counts.confirmed}
                        </span>
                        <span className={pageStyles.restingStatLabel}>Confirmed midday</span>
                      </div>
                      <div className={pageStyles.restingStatCard}>
                        <span className={pageStyles.restingStatVal} style={{ color: "var(--accent)" }}>
                          {counts.expected}
                        </span>
                        <span className={pageStyles.restingStatLabel}>Expected afternoon</span>
                      </div>
                      <div className={pageStyles.restingStatCard}>
                        <span className={pageStyles.restingStatVal} style={{ color: "var(--muted)" }}>
                          {counts.departed}
                        </span>
                        <span className={pageStyles.restingStatLabel}>Discharged · 24h</span>
                      </div>
                    </div>
                  </div>

                  {releaseGroups.blocked.length > 0 && (
                    <div>
                      <h4 className={pageStyles.restingSectionTitle} style={{ color: "var(--warn)" }}>
                        Immediate Attention ({releaseGroups.blocked.length})
                      </h4>
                      <div className={pageStyles.restingPriorityQueue}>
                        {releaseGroups.blocked.slice(0, 4).map((rel) => {
                          const u = units.find((candidate) => candidate.id === rel.unitId);
                          const l = records.find((candidate) => candidate.admissionId === rel.admissionId);
                          return (
                            <button
                              key={rel.id}
                              type="button"
                              className={pageStyles.restingPriorityItem}
                              onClick={(e) => {
                                triggerRef.current = e.currentTarget;
                                setSelected(null);
                                setReleaseId(rel.id);
                                focusDetail();
                              }}
                            >
                              <div className={pageStyles.restingPriorityInfo}>
                                <span className={pageStyles.restingPriorityTitle}>
                                  {unitLabel(u, rel.unitId)} {l ? `· ${recordName(l)}` : ""}
                                </span>
                                <span className={pageStyles.restingPriorityBlocker}>{rel.blocker}</span>
                              </div>
                              <ArrowUpRight size={14} className={pageStyles.restingPriorityArrow} aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedUnitId && (
              <footer className={pageStyles.detailFooter}>
                <Link href={`/mockups/ward-flow/ward/${selectedUnitId}`} className={pageStyles.primaryLink}>
                  Open full ward <ArrowUpRight size={15} className={pageStyles.inlineIcon} aria-hidden="true" />
                </Link>
              </footer>
            )}
          </aside>
        </div>
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
