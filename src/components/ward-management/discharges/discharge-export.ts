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
