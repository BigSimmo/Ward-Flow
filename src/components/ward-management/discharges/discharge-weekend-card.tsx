"use client";

import type { ReactNode } from "react";
import { Card, CardHead } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import { weekendPrepGroups } from "./discharge-weekend-prep";
import { weekendReviewSummary } from "./discharge-weekend-review-card";
import weekendReviewStyles from "./discharge-weekend-review.module.css";

type WeekendCardInput = Parameters<typeof weekendReviewSummary>;

/**
 * Thread C (26 Nov 2026): on Thu and Fri the people to review and the services closing over the
 * weekend are one card, review first. An empty section hides; other days are unchanged. Split out of
 * `discharge-board.tsx` to keep it under its line cap.
 */
export function DischargeWeekendCard({
  records,
  releases,
  weekendReleases,
  now,
  dayZero,
  review,
  prep,
}: {
  records: WeekendCardInput[0];
  releases: WeekendCardInput[1];
  weekendReleases: Parameters<typeof weekendPrepGroups>[0];
  now: Instant;
  dayZero: WeekendCardInput[3];
  review: ReactNode;
  prep: ReactNode;
}) {
  const summary = weekendReviewSummary(records, releases, now, dayZero);
  const anyClosed = weekendPrepGroups(weekendReleases, now, dayZero).length > 0;
  return (
    <Card
      as="section"
      className={weekendReviewStyles.card}
      aria-labelledby="discharge-weekend-heading"
      data-testid="ward-discharge-weekend"
    >
      <CardHead
        title={<span id="discharge-weekend-heading">Weekend discharges</span>}
        meta={summary.total > 0 ? `${summary.span} · ${summary.reviewed} of ${summary.total} reviewed` : summary.span}
      />
      {review}
      {anyClosed ? prep : null}
      {summary.total === 0 && !anyClosed ? (
        <p className={weekendReviewStyles.empty}>No expected discharges recorded for {summary.span}.</p>
      ) : null}
    </Card>
  );
}
