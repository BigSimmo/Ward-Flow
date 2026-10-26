/**
 * **BREAK GLASS ON THE COORDINATOR'S REVIEW LIST, AND WHO OPENED A RECORD (D-80 item 14, Option B
 * of the access review mock-up, approved by Josh 24 Oct 2026).**
 *
 * Each break glass opening becomes a row in Governance's "Waiting for review" list, counted under
 * Record access and marked Reviewed or Follow-up like any other row (`REVIEW_AUDIT_EVENT`, by its
 * review id in `ward-break-glass-review-id.ts`). Choosing a row with a record lists who opened that
 * record in the last 7 days. The Audit trail's Record views filter lists them all.
 *
 * Where the rows come from:
 * - The signed-in shared workspace reads the server's own append-only tables (break glass openings
 *   and record views) through `GET /v1/workspace/record-access`. The server keeps a service
 *   coordinator to the records in its own service.
 * - The local demo has no server, so it shows a few clearly synthetic openings and views derived
 *   from the seeded world each time they are read (never stored, like `ward-governance-seed.ts`),
 *   plus any opening made in this tab.
 *
 * A desk is its role and its place. More than 3 openings by one desk within 12 hours is a pattern
 * (`breakGlassPerShift`, `breakGlassShift`).
 */
import type { AuditEvent } from "./ward-audit";
import { CLINICAL_VALUES } from "./ward-clinical-values";
import type { Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";
import type { Unit } from "./ward-model";
import {
  ACCESS_ROLE_LABELS,
  BREAK_GLASS_REASONS,
  type BreakGlassReasonId,
  type WardAccess,
  type WardAccessRole,
} from "./ward-role-access";
import { allEmergencyDepartments, siteByCode } from "./ward-sites";
import { BREAK_GLASS_REVIEW_PREFIX } from "./ward-break-glass-review-id";
import type { SharedBreakGlassOpening, SharedRecordView } from "./ward-shared-client";
import { accessPlaceLabel } from "./shell/ward-access-labels";
import { parseStoredAccess } from "./shell/ward-access-store";

/** One break glass opening: which record, why, by which desk, and for how long. */
export type AccessOpening = {
  readonly key: string;
  readonly at: Instant;
  readonly until: Instant;
  readonly record: string;
  readonly reason: BreakGlassReasonId;
  readonly desk: WardAccessRole;
  readonly place: string;
  readonly otherText?: string;
};

export type RecordViewSurface = "patient" | "movement" | "referral";

/** One opening of a record's full page, as the record views log keeps it. */
export type RecordView = {
  readonly key: string;
  readonly at: Instant;
  readonly record: string;
  readonly desk: WardAccessRole;
  readonly place: string;
  readonly surface: RecordViewSurface;
  /** Opened through break glass: the same desk held an opening of this record at the time. */
  readonly breakGlass: boolean;
};

export const SURFACE_LABELS: Record<RecordViewSurface, string> = {
  patient: "Patient page",
  movement: "Movement page",
  referral: "Referral detail",
};

/** More than this many openings by one desk inside the window is a pattern. */
export const PATTERN_LIMIT = CLINICAL_VALUES.breakGlassPerShift.value;
/** The pattern window, in hours (12). */
export const PATTERN_HOURS = CLINICAL_VALUES.breakGlassShift.value;
/** How far back the record views list reaches. */
export const RECORD_VIEW_DAYS = 7;

export function reasonLabel(reason: BreakGlassReasonId | null | undefined): string {
  return BREAK_GLASS_REASONS.find((option) => option.id === reason)?.label ?? "Other";
}

/** The narrow By column: the two longest role names shortened, as the mock-up draws them. */
export function shortDeskLabel(role: WardAccessRole): string {
  return role === "coordinator" ? "Coordinator" : role === "ed" ? "ED clinician" : ACCESS_ROLE_LABELS[role];
}

const deskKey = (row: { desk: WardAccessRole; place: string }) => `${row.desk}|${row.place}`;

/** How many openings each opening's desk made in the 12 hours up to and including it. */
function deskCounts(openings: readonly AccessOpening[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const opening of openings)
    counts.set(
      opening.key,
      openings.filter(
        (other) =>
          deskKey(other) === deskKey(opening) && other.at <= opening.at && other.at > opening.at - PATTERN_HOURS * 60,
      ).length,
    );
  return counts;
}

/** An access role as the audit's actor role (the access admin has none there). */
function flowRole(role: WardAccessRole): WardFlowRole | null {
  return role === "admin" ? null : role;
}

/**
 * The openings as Governance review rows, oldest first like the captured log. `generation` is the
 * world's, so a review of an opening is read back as the current world's.
 */
export function openingEvents(openings: readonly AccessOpening[], generation: number): AuditEvent[] {
  const counts = deskCounts(openings);
  return [...openings]
    .sort((a, b) => a.at - b.at)
    .map((opening) => ({
      id: `${BREAK_GLASS_REVIEW_PREFIX}${opening.key}`,
      sequence: 0,
      generation,
      at: opening.at,
      actor: { role: flowRole(opening.desk), actingUnitId: null, attribution: "declared-prototype-role" },
      subject: { kind: "unresolved" },
      outcome: "accepted",
      reasonCode: "none",
      origin: "break-glass-opening",
      category: "record-access",
      action: "BREAK_GLASS",
      details: {
        record: opening.record,
        reason: opening.reason,
        until: opening.until,
        desk: opening.desk,
        place: opening.place,
        deskCount: counts.get(opening.key) ?? 1,
        ...(opening.otherText ? { otherText: opening.otherText } : {}),
      },
    }));
}

/** True when an opening's desk made more than the set number in 12 hours. */
export function isPattern(event: AuditEvent): boolean {
  return event.action === "BREAK_GLASS" && event.details.deskCount > PATTERN_LIMIT;
}

/** Each view marked when the same desk held a break glass opening of that record at the time. */
export function markBreakGlass(views: readonly RecordView[], openings: readonly AccessOpening[]): RecordView[] {
  return views.map((view) => ({
    ...view,
    breakGlass:
      view.breakGlass ||
      openings.some(
        (opening) =>
          opening.record === view.record &&
          deskKey(opening) === deskKey(view) &&
          view.at >= opening.at &&
          view.at <= opening.until,
      ),
  }));
}

/** Who opened this record in the last 7 days, newest first. */
export function viewsOfRecord(views: readonly RecordView[], records: readonly string[], now: Instant): RecordView[] {
  return views
    .filter((view) => records.includes(view.record) && view.at > now - RECORD_VIEW_DAYS * 24 * 60)
    .sort((a, b) => b.at - a.at);
}

const accessOf = (role: unknown, scope: unknown): WardAccess | null =>
  parseStoredAccess(JSON.stringify({ role, scope }));
const SURFACES = new Set<string>(Object.keys(SURFACE_LABELS));
const SERVER_ID = /^\d{1,18}$/;

/**
 * The server's openings on the demo clock (`at` is the clock when the list arrived). A row whose
 * desk, reason or times the screens would not accept is left out rather than guessed.
 */
export function serverOpenings(
  rows: readonly SharedBreakGlassOpening[],
  at: Instant,
  units: readonly Unit[],
): AccessOpening[] {
  return rows.flatMap((row) => {
    const access = accessOf(row?.actor_role, row?.actor_scope);
    const reason = BREAK_GLASS_REASONS.find((option) => option.id === row?.reason)?.id;
    const minutes = row?.minutes;
    if (
      !access ||
      !reason ||
      !SERVER_ID.test(String(row.id)) ||
      typeof row.patient_id !== "string" ||
      !Number.isFinite(minutes?.opened) ||
      !Number.isFinite(minutes?.until)
    )
      return [];
    return [
      {
        key: String(row.id),
        at: at + minutes.opened,
        until: at + minutes.until,
        record: row.patient_id,
        reason,
        desk: access.role,
        place: accessPlaceLabel(access, units),
      },
    ];
  });
}

/** The server's record views on the demo clock, as `serverOpenings`. */
export function serverViews(rows: readonly SharedRecordView[], at: Instant, units: readonly Unit[]): RecordView[] {
  return rows.flatMap((row) => {
    const access = accessOf(row?.actor_role, row?.actor_scope);
    if (!access || typeof row.patient_id !== "string" || !SURFACES.has(row.surface) || !Number.isFinite(row.minutes))
      return [];
    return [
      {
        key: `view-${String(row.id)}`,
        at: at + row.minutes,
        record: row.patient_id,
        desk: access.role,
        place: accessPlaceLabel(access, units),
        surface: row.surface as RecordViewSurface,
        breakGlass: false,
      },
    ];
  });
}

/**
 * **SYNTHETIC — the local demo's openings and views.** Timed before this session's capture started,
 * from the seeded world: one ward desk opens four records outside its care inside 12 hours (so the
 * newest reads as a pattern) and an ED desk opens one. `records` are people outside that ward, from
 * the caller. Derived each time, never stored, and the same world always gives the same rows.
 */
export function syntheticAccessReview(input: { start: Instant; units: readonly Unit[]; records: readonly string[] }): {
  openings: AccessOpening[];
  views: RecordView[];
} {
  const unit = input.units[0];
  const ed = allEmergencyDepartments().find((entry) => entry.siteCode !== unit?.siteCode);
  if (!unit || !ed || input.records.length < 5 || !Number.isFinite(input.start)) return { openings: [], views: [] };
  const ward = { desk: "ward" as const, place: unit.name };
  const plan: [number, typeof ward | { desk: "ed"; place: string }, BreakGlassReasonId][] = [
    [21, ward, "bed-search"],
    [54, { desk: "ed", place: ed.name }, "handover"],
    [72, ward, "transport-safety"],
    [107, ward, "other"],
    [182, ward, "bed-search"],
  ];
  const window = CLINICAL_VALUES.breakGlassWindow.value;
  const openings = plan.map(([before, desk, reason], index): AccessOpening => {
    const at = input.start - before;
    return { key: `seed-${index + 1}`, at, until: at + window, record: input.records[index], reason, ...desk };
  });
  const views: RecordView[] = openings.map((opening) => ({
    key: `view-${opening.key}`,
    at: opening.at,
    record: opening.record,
    desk: opening.desk,
    place: opening.place,
    surface: "patient",
    breakGlass: true,
  }));
  const site = siteByCode(unit.siteCode)?.name ?? unit.siteCode;
  const day = 24 * 60;
  const others: [number, number, WardAccessRole, string, RecordViewSurface][] = [
    [0, -3, "bed_manager", site, "patient"],
    [0, day + 150, "coordinator", "Statewide", "referral"],
    [0, 2 * day + 300, "ed", ed.name, "patient"],
    [1, day + 40, "coordinator", "Statewide", "movement"],
    [2, 2 * day + 90, "bed_manager", site, "patient"],
  ];
  for (const [index, before, desk, place, surface] of others)
    views.push({
      key: `view-seed-${views.length + 1}`,
      at: openings[index].at - before,
      record: openings[index].record,
      desk,
      place,
      surface,
      breakGlass: false,
    });
  return { openings, views };
}
