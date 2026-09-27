"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Filter, ShieldAlert, Truck, X } from "lucide-react";
import { MissingValue } from "@/components/ui/missing-value";
import { RELEASE_BANDS, releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import {
  formatInstant,
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
] as const;

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
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
  const detailRelease =
    population === "releases" && releaseId && visibleReleaseIds.includes(releaseId)
      ? scopedReleases.find((release) => release.id === releaseId)
      : undefined;
  const selectedUnitId = detailRecord?.unitId ?? detailRelease?.unitId;
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
  const shown = population === "records" ? visibleRecords.length : visibleReleaseIds.length;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
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
        clearSelection();
        listRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, releaseId]);
  const focusDetail = () => detailRef.current?.focus();
  const openRecord = (record: DischargeRecord) => {
    setReleaseId(null);
    setOpenError(false);
    setShowUpdateDate(false);
    try {
      setSelected({ admissionId: record.admissionId, handle: openDischargeRecord(RECORD_ACTOR, record.admissionId) });
    } catch {
      setSelected(null);
      setOpenError(true);
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
        <header className={pageStyles.workspaceHeader}>
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
              <span className={styles.countBadge}>{guarded.status === "allowed" ? records.length : "Unavailable"}</span>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <time className={`${pageStyles.asOf} ${styles.asOf}`}>
              <span className={pageStyles.liveDot} aria-hidden="true" />
              <span className="sr-only">Live: </span>
              As of {formatSheetMoment(now, dayZero)}
            </time>
            {/*
             * D4: this button dispatched nothing — Save and Cancel both only closed a dialog that
             * claimed to record a departure forecast into the census and preserve invariant I-05,
             * defaulted to a barrier ("NDIS Accommodation") and offered a second ("State
             * Administrative Tribunal (SAT) Guardianship") that BED_RELEASE_BLOCKERS
             * (ward-change-reasons.ts) does not accept. Rather than fix a dialog that could still
             * offer an excluded reason, the control stays visible (so a coordinator can see the
             * feature exists) and states plainly that it is not wired, the same convention
             * `ward-flow-sign-in-screen.tsx` and `ward-bar.tsx` already use elsewhere in this app.
             */}
            <button
              type="button"
              data-testid="ward-discharge-plan-departure"
              className={pageStyles.planActionBtn}
              aria-disabled="true"
              aria-describedby="ward-discharge-plan-departure-note"
              title="Not wired in this prototype."
              onClick={ignoreUnavailableActivation}
            >
              + Plan departure
            </button>
            <span id="ward-discharge-plan-departure-note" className={pageStyles.planActionNote}>
              Not wired in this prototype.
            </span>
          </div>
        </header>
        <div className={`${pageStyles.kpiStrip} ${styles.kpiStrip}`} data-testid="ward-discharge-kpi-strip">
          <div
            className={`${pageStyles.kpiCard} ${styles.kpiCard}`}
            data-tone="danger"
            data-testid="ward-discharge-kpi-blocked"
          >
            <span className={pageStyles.kpiLabel}>
              <span className={styles.statusIndicator} aria-hidden="true">
                ▲
              </span>
              <span className="sr-only">Urgent: </span>
              <span>{kpiCardLabel("blocked", population)}</span>
            </span>
            <span className={`${pageStyles.kpiVal} ${styles.kpiVal}`} id="kpiBlocked">
              {counts.blocked}
            </span>
            <span className={pageStyles.kpiSub}>Immediate egress attention</span>
          </div>
          <div
            className={`${pageStyles.kpiCard} ${styles.kpiCard}`}
            data-tone="good"
            data-testid="ward-discharge-kpi-confirmed"
          >
            <span className={pageStyles.kpiLabel}>
              <span className={styles.statusIndicator} aria-hidden="true">
                ■
              </span>
              <span className="sr-only">Confirmed: </span>
              <span>{kpiCardLabel("confirmed", population)}</span>
            </span>
            <span className={`${pageStyles.kpiVal} ${styles.kpiVal}`} id="kpiConfirmed">
              {counts.confirmed}
            </span>
            <span className={pageStyles.kpiSub}>Awaiting scheduled clock</span>
          </div>
          <div
            className={`${pageStyles.kpiCard} ${styles.kpiCard}`}
            data-tone="warn"
            data-testid="ward-discharge-kpi-expected"
          >
            <span className={pageStyles.kpiLabel}>
              <span className={styles.statusIndicator} aria-hidden="true">
                ○
              </span>
              <span className="sr-only">Expected: </span>
              <span>{kpiCardLabel("expected", population)}</span>
            </span>
            <span className={`${pageStyles.kpiVal} ${styles.kpiVal}`}>{counts.expected}</span>
            <span className={pageStyles.kpiSub}>Clinical review pending</span>
          </div>
          <div
            className={`${pageStyles.kpiCard} ${styles.kpiCard}`}
            data-tone="accent"
            data-testid="ward-discharge-kpi-departed"
          >
            <span className={pageStyles.kpiLabel}>
              <span className={styles.statusIndicator} aria-hidden="true">
                ✓
              </span>
              <span className="sr-only">Departed: </span>
              <span>{kpiCardLabel("departed", population)}</span>
            </span>
            <span className={`${pageStyles.kpiVal} ${styles.kpiVal}`}>{counts.departed}</span>
            {/* The hours come from the same window that sorts a release into "discharged today"
                (releaseBand: now - confirmedAt < MINUTES_PER_DAY), so the label cannot drift from
                the count. It still reads "24h". */}
            <span className={pageStyles.kpiSub}>Departures finalised · {MINUTES_PER_DAY / 60}h</span>
          </div>
        </div>
        <div className={pageStyles.filters}>
          <label htmlFor="discharges-filter-service">
            Service
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
          <label htmlFor="discharges-filter-ward">
            Ward
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
          <label htmlFor="discharges-filter-blocker">
            Blocker focus
            <select
              id="discharges-filter-blocker"
              name="dischargesFilterBlocker"
              value={blockerCategory}
              onChange={(event) => {
                setBlockerCategory(event.target.value);
                clearSelection();
              }}
            >
              <option value="all">All blocker categories</option>
              {BLOCKER_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>
          {population === "records" && (
            <>
              <label htmlFor="discharges-filter-identity">
                Patient link
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
              <label htmlFor="discharges-filter-destination">
                Destination
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
        <div className={pageStyles.workspace}>
          <section className={pageStyles.register} aria-labelledby="discharge-register-heading">
            <header className={pageStyles.panelHeader}>
              <h2 id="discharge-register-heading">
                {population === "releases" ? "Bed release worklist" : "Admission discharge records"}
              </h2>
              <span aria-live="polite" className={styles.countBadge}>
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
                          <tr key={record.id} data-selected={selected?.admissionId === record.admissionId}>
                            <td data-label="Patient / ward">
                              <button
                                type="button"
                                className={pageStyles.recordButton}
                                aria-pressed={selected?.admissionId === record.admissionId}
                                onClick={() => openRecord(record)}
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
                            <h3>
                              {key === "discharged-today" ? "Discharged in last 24 hours" : GROUP_LABELS[key]}{" "}
                              <span className={styles.countBadge}>{releaseGroups[key].length}</span>
                            </h3>
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
                            return (
                              <tr key={release.id} data-selected={releaseId === release.id}>
                                <td data-label="Ward / service">
                                  <button
                                    type="button"
                                    className={pageStyles.recordButton}
                                    aria-pressed={releaseId === release.id}
                                    onClick={() => {
                                      setSelected(null);
                                      setReleaseId(release.id);
                                      focusDetail();
                                    }}
                                  >
                                    {unitLabel(unit, release.unitId)}
                                  </button>
                                  <span className={pageStyles.secondary}>{healthServiceLabel(unit)}</span>
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
              onClick={() => {
                clearSelection();
                listRef.current?.focus();
              }}
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
                clearSelection();
                listRef.current?.focus();
              }
            }}
          >
            <header className={pageStyles.panelHeader}>
              <h2 id="discharge-detail-heading">
                {detailRecord ? "Admission record" : detailRelease ? "Anonymous release" : "Record detail"}
              </h2>
              {(selected || releaseId) && (
                <button
                  type="button"
                  className={pageStyles.quietButton}
                  onClick={() => {
                    clearSelection();
                    listRef.current?.focus();
                  }}
                >
                  <X size={15} className={pageStyles.inlineIcon} aria-hidden="true" /> Close
                </button>
              )}
            </header>
            <div className={pageStyles.detailBody} role="region" aria-label="Selected discharge details" tabIndex={0}>
              {detailRecord ? (
                <>
                  <span className={pageStyles.eyebrow}>{detailRecord.admissionId}</span>
                  <h3>{recordName(detailRecord)}</h3>
                  {detailRecord.identity.kind === "linked" && (
                    <p className={pageStyles.mono}>UMRN {detailRecord.identity.patient.umrn}</p>
                  )}
                  <p>{unitLabel(selectedUnit, detailRecord.unitId)}</p>
                  <div className={pageStyles.detailStatus}>
                    {badge(recordStage(detailRecord))}
                    {recordStatus(detailRecord) === "blocked" && badge("blocked")}
                  </div>
                  <dl>
                    <dt>Expected discharge</dt>
                    <dd>
                      {recordedMoment(detailRecord.expectedDischargeAt, dayZero)}
                      {/* Walkthrough D8 (25 Sept 2026): not offered once the person has left, because the
                          reducer refuses a new date for a departed stay. */}
                      {recordStage(detailRecord) === "departed" ? null : !showUpdateDate ? (
                        <div style={{ marginTop: "0.5rem" }}>
                          <button
                            type="button"
                            className={pageStyles.actionBtn}
                            data-testid="ward-discharge-update-date-btn"
                            onClick={() => {
                              setShowUpdateDate(true);
                              setNewTimeDraft(
                                detailRecord.expectedDischargeAt !== null
                                  ? formatInstantWithDay(detailRecord.expectedDischargeAt, now)
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
                              // Walkthrough D8: a new time keeps the recorded discharge's own day
                              // (the discharge record is the truth, Josh 25 Sept); it used to move the
                              // date to today. With no date recorded yet, today.
                              const today = parseReleaseDayInstant(now, "today", newTimeDraft);
                              const recorded = detailRecord.expectedDischargeAt;
                              parsed =
                                today === undefined || recorded === null
                                  ? today
                                  : today + (Math.floor(recorded / MINUTES_PER_DAY) - Math.floor(now / MINUTES_PER_DAY)) * MINUTES_PER_DAY;
                            }
                            if (parsed !== undefined) {
                              dispatch({
                                type: "UPDATE_EXPECTED_DISCHARGE",
                                role: "coordinator",
                                admissionId: detailRecord.admissionId,
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
                      {recordedMoment(detailRecord.dischargeDateSetAt, dayZero)}
                      <span className={pageStyles.secondary}>
                        {detailRecord.dischargeDateSetBy ?? "Role not recorded"}
                      </span>
                    </dd>
                    <dt>Discharge confirmation</dt>
                    <dd>
                      {detailRecord.dischargeConfirmedAt === null
                        ? "Not confirmed"
                        : recordedMoment(detailRecord.dischargeConfirmedAt, dayZero)}
                      <span className={pageStyles.secondary}>
                        {detailRecord.dischargeConfirmedBy ?? "Role not recorded"}
                      </span>
                    </dd>
                    {detailRecord.blockReason && (
                      <>
                        <dt>Recorded blocker</dt>
                        <dd className={pageStyles.blocker}>{detailRecord.blockReason}</dd>
                      </>
                    )}
                    <dt>Recorded departure</dt>
                    <dd>{recordedMoment(detailRecord.leftAt, dayZero)}</dd>
                    <dt>Destination</dt>
                    <dd>
                      {LEAVING_DESTINATIONS.find((item) => item.id === detailRecord.leavingDestination)?.label ??
                        "Not recorded"}
                    </dd>
                  </dl>
                  {detailRecord.blockReason && (
                    <div className={pageStyles.drawerSection}>
                      <h4 className={pageStyles.drawerSubheading}>
                        <ShieldAlert size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                        Barrier Mitigation
                      </h4>
                      <p className={pageStyles.barrierHighlight}>{detailRecord.blockReason}</p>
                      <p className={pageStyles.drawerInfoText}>
                        Active discharge barrier registered. Cross-service coordination required to clear egress path.
                      </p>
                      <div className={pageStyles.unwiredActionRow}>
                        <button
                          type="button"
                          className={pageStyles.actionBtnDisabled}
                          aria-disabled="true"
                          aria-describedby={`mitigate-note-${detailRecord.admissionId}`}
                          title="Not wired in this prototype."
                          onClick={ignoreUnavailableActivation}
                        >
                          + Mitigate barrier
                        </button>
                        <span id={`mitigate-note-${detailRecord.admissionId}`} className={pageStyles.planActionNote}>
                          Not wired in this prototype.
                        </span>
                      </div>
                    </div>
                  )}
                  <div className={pageStyles.drawerSection}>
                    <h4 className={pageStyles.drawerSubheading}>
                      <Truck size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                      Transport Coordination
                    </h4>
                    <p className={pageStyles.drawerInfoText}>
                      {detailRecord.leavingDestination
                        ? `Target egress: ${
                            LEAVING_DESTINATIONS.find((item) => item.id === detailRecord.leavingDestination)?.label ??
                            "Not recorded"
                          }`
                        : "No departure destination recorded yet for this admission."}
                    </p>
                    <div className={pageStyles.unwiredActionRow}>
                      <button
                        type="button"
                        className={pageStyles.actionBtnDisabled}
                        aria-disabled="true"
                        aria-describedby={`transport-note-${detailRecord.admissionId}`}
                        title="Not wired in this prototype."
                        onClick={ignoreUnavailableActivation}
                      >
                        + Book transport
                      </button>
                      <span id={`transport-note-${detailRecord.admissionId}`} className={pageStyles.planActionNote}>
                        Not wired in this prototype.
                      </span>
                    </div>
                  </div>
                </>
              ) : detailRelease ? (
                <>
                  <span className={pageStyles.eyebrow}>{detailRelease.id}</span>
                  <h3>{unitLabel(selectedUnit, detailRelease.unitId)}</h3>
                  <p>{healthServiceLabel(selectedUnit)}</p>
                  <p className={pageStyles.secondary}>No patient link</p>
                  <div className={pageStyles.detailStatus}>
                    {badge(detailRelease.state === "discharged" ? "departed" : detailRelease.state)}
                    {detailRelease.blocker && badge("blocked")}
                  </div>
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
                      <span className={pageStyles.secondary}>{recordedMoment(detailRelease.confirmedAt, dayZero)}</span>
                    </dd>
                    {detailRelease.preparing && (
                      <>
                        <dt>Bed preparation</dt>
                        <dd>{detailRelease.preparationNote ?? "In progress · reason not recorded"}</dd>
                      </>
                    )}
                  </dl>
                  {detailRelease.blocker && (
                    <div className={pageStyles.drawerSection}>
                      <h4 className={pageStyles.drawerSubheading}>
                        <ShieldAlert size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                        Barrier Mitigation
                      </h4>
                      <p className={pageStyles.barrierHighlight}>{detailRelease.blocker}</p>
                      <p className={pageStyles.drawerInfoText}>
                        Active bed release barrier registered. Escalation required to restore egress flow.
                      </p>
                      <div className={pageStyles.unwiredActionRow}>
                        <button
                          type="button"
                          className={pageStyles.actionBtnDisabled}
                          aria-disabled="true"
                          aria-describedby={`mitigate-rel-note-${detailRelease.id}`}
                          title="Not wired in this prototype."
                          onClick={ignoreUnavailableActivation}
                        >
                          + Mitigate barrier
                        </button>
                        <span id={`mitigate-rel-note-${detailRelease.id}`} className={pageStyles.planActionNote}>
                          Not wired in this prototype.
                        </span>
                      </div>
                    </div>
                  )}
                  <div className={pageStyles.drawerSection}>
                    <h4 className={pageStyles.drawerSubheading}>
                      <Truck size={14} className={pageStyles.inlineIcon} aria-hidden="true" />
                      Transport Coordination
                    </h4>
                    {/* A bed release records no transport need. This line used to print the
                        release's `waitingOn` as a "transit requirement" and, when that was blank,
                        claim none was flagged; both were made up (coordinator decision, 25 Sept). */}
                    <p className={pageStyles.drawerInfoText}>Not recorded</p>
                    <div className={pageStyles.unwiredActionRow}>
                      <button
                        type="button"
                        className={pageStyles.actionBtnDisabled}
                        aria-disabled="true"
                        aria-describedby={`transport-rel-note-${detailRelease.id}`}
                        title="Not wired in this prototype."
                        onClick={ignoreUnavailableActivation}
                      >
                        + Book transport
                      </button>
                      <span id={`transport-rel-note-${detailRelease.id}`} className={pageStyles.planActionNote}>
                        Not wired in this prototype.
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className={pageStyles.emptyState}>
                  {selected || openError
                    ? "This record could not be opened. Select it again to retry."
                    : "Select a record to view dates, blockers and ward follow-up."}
                </p>
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
