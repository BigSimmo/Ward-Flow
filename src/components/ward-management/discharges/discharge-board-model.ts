import { RELEASE_BANDS, releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import { calendarDateOf, dayOf, formatSheetMoment, type Instant } from "@/components/ward-management/ward-clock";
import type { DischargeRecord } from "@/components/ward-management/ward-discharge-records";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { durMinutes, type WfTone } from "@/components/wf";
import { type DischargeDayKey } from "./discharge-flow-charts";

/**
 * The discharge board's groups, labels, types and pure helpers, moved unchanged from
 * `discharge-board.tsx` so its sections can share them.
 */

export const GROUP_LABELS = {
  blocked: "Blocked",
  confirmed: "Confirmed",
  expected: "Expected",
  "discharged-today": "Discharged today",
} as const;

export type GroupKey = keyof typeof GROUP_LABELS;

/** v10 phone group headers: one glyph and a short label per group. */
export const PHONE_GROUP_TONES: Record<GroupKey, WfTone> = {
  blocked: "danger",
  confirmed: "success",
  expected: "neutral",
  "discharged-today": "closed",
};
export const PHONE_GROUP_LABELS: Record<GroupKey, string> = {
  blocked: "Blocked",
  confirmed: "Confirmed",
  expected: "Expected",
  "discharged-today": "Discharged · 24h",
};

/** v10 phone: rows a group shows before its "Show N more" row. */
export const PHONE_GROUP_CAP = 6;

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
export const GROUP_ORDER: readonly GroupKey[] = ["blocked", "confirmed", "expected", "discharged-today"];

export const BAND_LABELS: Record<ReleaseBand, string> = {
  now: "Now",
  "by-midday": "By midday",
  "by-1600": "By 4pm",
  tonight: "Tonight",
  tomorrow: "Tomorrow",
};

/** The timing word for a release: how far past its date when late, never "Now" for a late one. */
export function releaseTimingWords(release: BedRelease, now: Instant): string {
  if (release.state !== "discharged" && release.expectedAt < now) return `${durMinutes(now - release.expectedAt)} past`;
  return BAND_LABELS[releaseBand(release, now) as ReleaseBand];
}

export const EMPTY_REASON: Record<GroupKey, string> = {
  blocked: "release is currently blocked",
  confirmed: "release is confirmed, unreleased and not blocked",
  expected: "release is expected and not blocked",
  "discharged-today": "the person has been discharged today",
};

export const GROUP_DESCRIPTIONS: Record<GroupKey, string> = {
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

export function unitLabel(unit: Unit | undefined, unitId: string): string {
  // The unresolved sentence comes from `ward-absence-labels.ts` — Ward Lead's 2026-09-11 ruling.
  // This used to name handover-page as its precedent, which is a pointer that cannot follow.
  return wardLabel(unitId, unit?.name);
}

export function healthServiceLabel(unit: Unit | undefined): string {
  const service = unit ? siteByCode(unit.siteCode)?.service : undefined;
  return service ?? "Service not recorded";
}

export type Population = "records" | "releases";
export type WorkStatus = "blocked" | "confirmed" | "expected" | "departed";
export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  blocked: "Blocked",
  confirmed: "Confirmed",
  expected: "Expected",
  departed: "Departed",
};
export const WORK_ORDER: WorkStatus[] = ["blocked", "confirmed", "expected", "departed"];

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
export function kpiCardLabel(status: WorkStatus, population: Population): string {
  // DA-16 (overall review, 20 Oct 2026): "Blocked releases" read as beds being blocked. The owner's
  // own words for this count, approved 6 Sept 2026 for the capacity figure, are "Discharges held up"
  // (`ward-derivations.ts`), so the board says the same.
  if (status === "blocked") return population === "releases" ? "Discharges held up" : "Records held up";
  if (status === "departed") return population === "releases" ? "Discharged · 24h" : "Departed";
  return WORK_STATUS_LABELS[status];
}

export function recordStage(record: DischargeRecord): "confirmed" | "expected" | "departed" {
  if (record.admissionState === "departed") return "departed";
  return record.dischargeConfirmedAt !== null && Number.isFinite(record.dischargeConfirmedAt)
    ? "confirmed"
    : "expected";
}
export function recordStatus(record: DischargeRecord): WorkStatus {
  const stage = recordStage(record);
  return stage !== "departed" && record.blockReason !== null ? "blocked" : stage;
}
export function recordName(record: DischargeRecord): string {
  return record.identity.kind === "linked"
    ? `${record.identity.patient.familyName}, ${record.identity.patient.givenName}`
    : record.identity.kind === "legacy-anonymous"
      ? "Patient not linked"
      : "Patient link unavailable";
}
export function recordedMoment(value: Instant | null, dayZero: Date): string {
  return value !== null && Number.isFinite(value) ? formatSheetMoment(value, dayZero) : "Not recorded";
}

/** The calendar day alone ("Fri, 9 Oct"), for a release already past its date. */
export function recordedDate(value: Instant, dayZero: Date): string {
  return calendarDateOf(value, dayZero).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Perth",
  });
}

export const BLOCKER_CATEGORIES = [
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
export function barrierCategory(blocker: string): string {
  const text = blocker.toLowerCase();
  return BLOCKER_CATEGORIES.find((category) => text.includes(category.id))?.id ?? "other";
}
export function barrierLabel(id: string): string {
  return BLOCKER_CATEGORIES.find((category) => category.id === id)?.label ?? "Other barrier";
}

/* v10: the hero status chips highlight too ("status"); only the tabs over the table narrow. */
export type Highlight =
  { kind: "day"; day: DischargeDayKey } | { kind: "barrier"; id: string } | { kind: "status"; status: WorkStatus };
export type TableView = "list" | "barriers";

/**
 * A click on the day chart or the barrier bars HIGHLIGHTS the matching people and moves them to
 * the top of their group. It never hides a row (Discharges direction A, 9 Oct 2026).
 */
export function matchesHighlight(
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

export function perthDay(instant: Instant, dayZero: Date, options: Intl.DateTimeFormatOptions): string {
  return calendarDateOf(instant, dayZero).toLocaleDateString("en-AU", { ...options, timeZone: "Australia/Perth" });
}

export const stageTone = (stage: WorkStatus): WfTone =>
  stage === "blocked" ? "danger" : stage === "expected" ? "neutral" : "success";
