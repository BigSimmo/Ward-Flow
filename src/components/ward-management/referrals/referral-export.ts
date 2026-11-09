import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";

/** Where and when the file was taken, as `downloadCsv` writes it above the rows. */
export type ListExportProvenance = NonNullable<Parameters<typeof downloadCsv>[2]>;

/**
 * Export (feature 44): the referral queue as a spreadsheet. Record numbers, places, waits and
 * status labels only: never a name, initials or the referral's typed text. The board resolves the
 * UMRN, sending site, tier and needs and hands them in.
 */
export type ReferralExportRow = Pick<Referral, "id" | "raisedAt">;

export type ReferralExportContext<R extends ReferralExportRow = ReferralExportRow> = {
  readonly now: Instant;
  readonly umrnOf: (referral: R) => string;
  readonly tierOf: (referral: R) => string;
  readonly priorityOf: (referral: R) => string;
  readonly fromOf: (referral: R) => string;
  /** Fixed words for what was requested ("Locked", "Transport"), never typed text. */
  readonly needsOf: (referral: R) => readonly string[];
  readonly at: (instant: Instant) => string;
};

export const REFERRAL_EXPORT_HEADER = [
  "Referral",
  "UMRN",
  "Tier",
  "Priority",
  "Raised",
  "Since referral",
  "From",
  "Needs",
] as const;

export function referralExportLines<R extends ReferralExportRow>(
  referrals: readonly R[],
  ctx: ReferralExportContext<R>,
): (string | number)[][] {
  return [
    [...REFERRAL_EXPORT_HEADER],
    ...referrals.map((referral) => [
      referral.id,
      ctx.umrnOf(referral),
      ctx.tierOf(referral),
      ctx.priorityOf(referral),
      ctx.at(referral.raisedAt),
      splitDuration(Math.max(0, ctx.now - referral.raisedAt)),
      ctx.fromOf(referral),
      ctx.needsOf(referral).join("; ") || "None",
    ]),
  ];
}

/** Builds the rows and hands the browser the file. */
export function downloadReferralQueue<R extends ReferralExportRow>(
  referrals: readonly R[],
  ctx: ReferralExportContext<R>,
  provenance: ListExportProvenance,
): void {
  downloadCsv("ward-flow-synthetic-referral-queue.csv", referralExportLines(referrals, ctx), provenance);
}
