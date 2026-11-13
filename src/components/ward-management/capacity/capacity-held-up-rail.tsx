"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Card, CardHead, ShowMoreRow, foldHidden, foldLimit } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { formatInstantWithDay, perthDateLabel, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import type { BedRelease } from "@/components/ward-management/ward-model";
import {
  barrierCategory,
  barrierLabel,
  groupDischarges,
} from "@/components/ward-management/discharges/discharge-board-model";

import { HELD_UP_HREF } from "./capacity-held-up";
import styles from "./capacity-page.module.css";

/** About eight rows, then the kit's Show more (DESIGN-SYSTEM.md section 4). */
const HELD_ROWS = 8;

/**
 * Held up · by tomorrow (wave 4, notes item 2, ruling 5, D-191): open bed releases with a recorded
 * blocker, due by tomorrow (overdue, today and tomorrow). Read from Discharges' own grouping
 * (`groupDischarges` without `heldUpAnyDate`, the bed meeting's span), never counted again here.
 * `later` is the rest Discharges holds in its any-date Held up group, so the two numbers reconcile.
 */
export function heldUpByTomorrow(releases: readonly BedRelease[], now: Instant) {
  // Shown earliest due first (the mock-up's order), so an overdue bed leads the card.
  const byTomorrow = [...groupDischarges([...releases], now).blocked].sort((a, b) => a.expectedAt - b.expectedAt);
  const anyDate = groupDischarges([...releases], now, { heldUpAnyDate: true }).blocked.length;
  const byUnit = new Map<string, number>();
  for (const release of byTomorrow) byUnit.set(release.unitId, (byUnit.get(release.unitId) ?? 0) + 1);
  return { rows: byTomorrow, later: Math.max(0, anyDate - byTomorrow.length), byUnit };
}

/**
 * The rail's first card (the phone Overview's first card too): each held-up discharge due by
 * tomorrow as a row (surname first, ward, Discharges' short reason, the due date; a past date in
 * warning ink), and a foot that reconciles with Discharges' any-date count. A row opens the
 * person's record. The executive never sees this card (bed counts only).
 */
export function HeldUpCard({ releases, now }: { releases: readonly BedRelease[]; now: Instant }) {
  const { admissions, units, dayZero } = useWardFlowSelect("admissions", "units", "dayZero");
  const patientOf = usePatientOf();
  const canOpen = useCanOpenHref();
  const [showAll, setShowAll] = useState(false);
  const { rows, later } = heldUpByTomorrow(releases, now);
  const unitName = new Map(units.map((unit) => [unit.id, unit.name]));
  const admissionOf = new Map(admissions.map((admission) => [admission.id, admission]));
  const hidden = foldHidden(rows.length, HELD_ROWS);
  const shown = showAll || hidden === 0 ? rows : rows.slice(0, foldLimit(rows.length, HELD_ROWS));
  // "Due 14 Nov": a date said once. Without the session's day 0 (a partial test context) the
  // board's own day words stand in.
  const dueWords = (release: BedRelease) =>
    `Due ${
      dayZero
        ? perthDateLabel(release.expectedAt, dayZero, { day: "numeric", month: "short" })
        : formatInstantWithDay(release.expectedAt, now)
    }`;
  return (
    <Card aria-labelledby="capacity-held-up-title" data-testid="capacity-held-up-card">
      {/* PR E swap: WindowWord for the "· window" count title. */}
      <CardHead
        id="capacity-held-up-title"
        title={
          <span className={styles.countTitle}>
            <b className={styles.countN}>{rows.length}</b> Held up{" "}
            <span className={styles.countWin}>· by tomorrow</span>
          </span>
        }
      />
      {rows.length === 0 ? (
        <p className={styles.railEmpty}>No discharge due by tomorrow is held up.</p>
      ) : (
        <ul className={styles.railRows} id="capacity-held-up-list">
          {shown.map((release) => {
            const admission = admissionOf.get(release.admissionId);
            const person = patientOf(admission ?? null);
            const href = person.patient ? patientHref(person.patient.id) : undefined;
            const late = release.expectedAt < now;
            const body = (
              <>
                <span className={styles.railRowMain}>
                  <span className={styles.railName}>{person.formalName}</span>
                  <span className={styles.railSub}>
                    <SpelledCodes text={unitName.get(release.unitId) ?? "Ward not recorded"} /> ·{" "}
                    {barrierLabel(barrierCategory(release.blocker ?? ""))}
                  </span>
                </span>
                <span className={styles.railRowEnd}>
                  <span className={styles.railDue} data-late={late ? "" : undefined}>
                    {dueWords(release).replace(/ /g, " ")}
                  </span>
                  {href ? <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
                </span>
              </>
            );
            return (
              <li key={release.id} data-testid="capacity-held-up-row">
                {href && canOpen(href) ? (
                  <Link href={href} className={styles.railRow}>
                    {body}
                  </Link>
                ) : (
                  <span className={styles.railRow}>{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 ? (
        <ShowMoreRow onClick={() => setShowAll((all) => !all)} expanded={showAll} controls="capacity-held-up-list">
          {showAll ? "Show fewer" : `Show ${hidden} more`}
        </ShowMoreRow>
      ) : null}
      {canOpen(HELD_UP_HREF) ? (
        // A5-12: the visible words start the link's spoken name.
        <Link href={HELD_UP_HREF} className={styles.railFoot} data-testid="capacity-held-up-more">
          {later > 0 ? `${later} more due later · Discharges` : "All held up · Discharges"}
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      ) : null}
    </Card>
  );
}
