import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease } from "@/components/ward-management/ward-model-bed-release";
import type { DischargeRecord } from "@/components/ward-management/ward-discharge-records";
import type { FollowUpCheck } from "./discharge-follow-up-check";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";

/** Where and when the file was taken, as `downloadCsv` writes it above the rows. */
export type ListExportProvenance = NonNullable<Parameters<typeof downloadCsv>[2]>;

/**
 * Export (feature 44): the Discharges board as a spreadsheet, Now (bed releases) or Recorded
 * (discharges in the last days). Record numbers, wards, times and status labels only: never a name,
 * initials or a typed note. A release's hold-up and waiting-on are fixed lists, never free text; a
 * record's typed block reason is left out.
 */
export type DischargeExportRelease = Pick<
  BedRelease,
  "id" | "admissionId" | "unitId" | "expectedAt" | "blocker" | "waitingOn"
>;

export type DischargeReleaseExportContext<R extends DischargeExportRelease = DischargeExportRelease> = {
  readonly umrnOf: (release: R) => string;
  readonly wardName: (unitId: string) => string;
  readonly statusOf: (release: R) => string;
  readonly at: (instant: Instant) => string;
};

export const DISCHARGE_RELEASE_EXPORT_HEADER = [
  "Admission",
  "UMRN",
  "Ward",
  "Status",
  "Expected out",
  "Held up by",
  "Waiting on",
] as const;

export function dischargeReleaseExportLines<R extends DischargeExportRelease>(
  releases: readonly R[],
  ctx: DischargeReleaseExportContext<R>,
): (string | number)[][] {
  return [
    [...DISCHARGE_RELEASE_EXPORT_HEADER],
    ...releases.map((release) => [
      release.admissionId,
      ctx.umrnOf(release),
      ctx.wardName(release.unitId),
      ctx.statusOf(release),
      ctx.at(release.expectedAt),
      release.blocker ?? "",
      release.waitingOn ?? "",
    ]),
  ];
}

export type DischargeExportRecord = Pick<DischargeRecord, "admissionId" | "unitId" | "identity" | "leftAt">;

const FOLLOW_UP_WORDS: Record<FollowUpCheck["status"], string> = {
  booked_within: "Booked within the window",
  booked_outside: "Booked outside the window",
  arranged_no_date: "Arranged, no date",
  not_arranged: "Not arranged",
};

export type DischargeRecordExportContext<R extends DischargeExportRecord = DischargeExportRecord> = {
  readonly wardName: (unitId: string) => string;
  readonly destinationOf: (record: R) => string;
  readonly followUpOf: (record: R) => FollowUpCheck["status"];
  readonly at: (instant: Instant) => string;
};

export const DISCHARGE_RECORD_EXPORT_HEADER = [
  "Admission",
  "UMRN",
  "Ward",
  "Discharged",
  "Going to",
  "7 day follow-up",
] as const;

/** The UMRN of a linked record only; an unlinked record says so rather than guess. */
function recordUmrn(record: DischargeExportRecord): string {
  return record.identity.kind === "linked" ? record.identity.patient.umrn : "UMRN not recorded";
}

export function dischargeRecordExportLines<R extends DischargeExportRecord>(
  records: readonly R[],
  ctx: DischargeRecordExportContext<R>,
): (string | number)[][] {
  return [
    [...DISCHARGE_RECORD_EXPORT_HEADER],
    ...records.map((record) => [
      record.admissionId,
      recordUmrn(record),
      ctx.wardName(record.unitId),
      record.leftAt === null ? "Not recorded" : ctx.at(record.leftAt),
      ctx.destinationOf(record),
      FOLLOW_UP_WORDS[ctx.followUpOf(record)],
    ]),
  ];
}

/** Builds the Now rows and hands the browser the file. */
export function downloadDischargeReleases<R extends DischargeExportRelease>(
  releases: readonly R[],
  ctx: DischargeReleaseExportContext<R>,
  provenance: ListExportProvenance,
): void {
  downloadCsv("ward-flow-synthetic-discharges-now.csv", dischargeReleaseExportLines(releases, ctx), provenance);
}

/** Builds the Recorded rows and hands the browser the file. */
export function downloadDischargeRecords<R extends DischargeExportRecord>(
  records: readonly R[],
  ctx: DischargeRecordExportContext<R>,
  provenance: ListExportProvenance,
): void {
  downloadCsv("ward-flow-synthetic-discharges-recorded.csv", dischargeRecordExportLines(records, ctx), provenance);
}

/**
 * The board's Export button (feature 44): Now hands over the release groups the list shows, Recorded
 * the recorded discharges in scope; the header names which and whether filters narrowed it. Moved here
 * from discharge-board.tsx (page tops, 9 Nov 2026) so the board stays under its line cap.
 */
export function exportDischargeList<
  Rel extends DischargeExportRelease & { readonly statusWord: string },
  Rec extends DischargeExportRecord,
>(o: {
  readonly nowView: boolean;
  readonly narrowed: boolean;
  readonly recordedDays: number;
  readonly asAt: string;
  readonly at: (instant: Instant) => string;
  readonly wardName: (unitId: string) => string;
  readonly releases: readonly Rel[];
  readonly recorded: readonly Rec[];
  readonly records: readonly DischargeRecord[];
  readonly destinationOf: (record: Rec) => string;
  readonly followUpOf: (record: Rec) => FollowUpCheck["status"];
}): void {
  const what = o.nowView ? "Discharges, Now" : `Discharges, Recorded in the last ${o.recordedDays} days`;
  // Now exports the release groups the list shows, not every record in scope; the header says so.
  const shownWords = o.nowView
    ? `the discharges by bed ${o.narrowed ? "the current filters show" : "the list shows"}, by status`
    : o.narrowed
      ? "the recorded discharges the current filters show"
      : "every recorded discharge in this desk's scope";
  const provenance = { asAt: o.asAt, scope: `${what}; ${shownWords} (highlights do not narrow it)` };
  if (!o.nowView) {
    downloadDischargeRecords(
      o.recorded,
      { wardName: o.wardName, destinationOf: o.destinationOf, followUpOf: o.followUpOf, at: o.at },
      provenance,
    );
    return;
  }
  const umrnOf = (release: Rel) => {
    const record = o.records.find((candidate) => candidate.admissionId === release.admissionId);
    return record?.identity.kind === "linked" ? record.identity.patient.umrn : "UMRN not recorded";
  };
  downloadDischargeReleases(
    o.releases,
    { umrnOf, wardName: o.wardName, statusOf: (row) => row.statusWord, at: o.at },
    provenance,
  );
}
