"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { splitDuration } from "@/components/ward-management/ward-clock";

import { HELD_UP_BY_TOMORROW_LABEL } from "@/components/ward-management/ward-held-up";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import type { ClinicalFact, EdClinicalRow, WardClinicalRow } from "./tv-clinical-derivations";
import { Fact, Summary } from "./tv-clinical-views";
import styles from "./tv-function.module.css";

/**
 * THE TASK BOARDS (Josh, 4 Nov 2026: "add different types/versions based on the function
 * required"). Each board answers one job's question in four lanes: the nurse in charge (Obs and
 * leave), the doctors and ward clerk (Legal), the shift coordinator (Today) and the ED liaison
 * (Bed search). Read only, built from the same rows as the Clinical boards, so a figure never
 * disagrees between boards. A lane that runs out of room ends in "and N more", never scrolls.
 */

type Card = { key: string; bed?: string; name: string; fact?: ClinicalFact | null; note?: string };
type Lane = { id: string; title: string; hint: string; tone?: "danger" | "warning"; cards: Card[] };

/**
 * How many cards fit the lane. Every card is laid out once, then the lane counts the ones whose
 * bottom edge is inside its box, keeping one line for "and N more" when some are cut. A resize or
 * a change in the list lays them all out again.
 */
function useFit(count: number) {
  const ref = useRef<HTMLOListElement>(null);
  const [fit, setFit] = useState<{ count: number; shown: number } | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || (fit !== null && fit.count === count)) return;
    const frame = window.requestAnimationFrame(() => {
      const bottom = element.getBoundingClientRect().top + element.clientHeight;
      const cards = [...element.children] as HTMLElement[];
      const inside = cards.filter((card) => card.getBoundingClientRect().bottom <= bottom + 1).length;
      // A cut lane gives its last card's room to "and N more".
      setFit({ count, shown: inside >= count ? count : Math.max(1, inside - 1) });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [count, fit]);
  useEffect(() => {
    const reset = () => setFit(null);
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, []);
  return { ref, shown: fit !== null && fit.count === count ? fit.shown : count };
}

function LaneView({ lane }: { lane: Lane }) {
  const { ref, shown: visible } = useFit(lane.cards.length);
  const hidden = lane.cards.length - visible;
  return (
    <section
      className={styles.lane}
      aria-labelledby={`tv-lane-${lane.id}`}
      data-lane={lane.id}
      data-tone={lane.cards.length > 0 ? lane.tone : undefined}
      data-empty={lane.cards.length === 0 ? "" : undefined}
      data-testid="tv-lane"
    >
      <h2 id={`tv-lane-${lane.id}`} className={styles.laneTitle}>
        {lane.title} <span className={styles.count}>{lane.cards.length}</span>
      </h2>
      <p className={styles.hint}>{lane.hint}</p>
      <ol ref={ref} className={styles.cards}>
        {lane.cards.length === 0 ? <li className={styles.none}>None</li> : null}
        {lane.cards.slice(0, visible).map((card) => (
          <li key={card.key} className={styles.card} data-testid="tv-lane-card">
            <span className={styles.who}>
              {card.bed ? <span className={styles.bed}>{card.bed}</span> : null}
              <span className={styles.name}>{card.name}</span>
              {card.note ? <span className={styles.note}>{card.note}</span> : null}
            </span>
            {card.fact ? (
              <span className={styles.line}>
                <Fact fact={card.fact} />
              </span>
            ) : null}
          </li>
        ))}
        {hidden > 0 ? <li className={styles.more}>and {hidden} more</li> : null}
      </ol>
    </section>
  );
}

function Lanes({ lanes, label, testId }: { lanes: Lane[]; label: string; testId: string }) {
  return (
    <div className={styles.lanes} aria-label={label} data-testid={testId}>
      {lanes.map((lane) => (
        <LaneView key={lane.id} lane={lane} />
      ))}
    </div>
  );
}

const wardCard = (row: WardClinicalRow, fact?: ClinicalFact | null, note?: string): Card => ({
  key: row.key,
  bed: row.bed,
  name: row.name,
  fact,
  note,
});

/* --------------------------------------------------------------------------------------------- *
 * Ward: Obs and leave, for the nurse in charge allocating staff.
 * --------------------------------------------------------------------------------------------- */

export function WardObsLeaveTvView({ rows, footer }: { rows: WardClinicalRow[]; footer: ReactNode }) {
  const onWard = rows.filter((row) => row.where === "ward");
  const away = rows.filter((row) => row.where === "leave" || row.where === "awol" || row.where === "ed");
  // Absent without leave first, then whoever is due back soonest.
  away.sort((left, right) => Number(right.where === "awol") - Number(left.where === "awol"));
  const lanes: Lane[] = [
    {
      id: "constant",
      title: "Constant observation",
      // Review question 8 (D-189 item 2): the sample day's observation levels, labelled as on the ward page.
      hint: `One nurse each, all shift · ${SAMPLE_OBSERVATION_MIX_LABEL}`,
      tone: "warning",
      cards: onWard.filter((row) => row.constantObs).map((row) => wardCard(row, row.obs)),
    },
    {
      id: "ward",
      title: "On the ward",
      hint: "Obs level as staffed",
      cards: onWard.filter((row) => !row.constantObs).map((row) => wardCard(row, row.obs)),
    },
    {
      id: "away",
      title: "Off the ward",
      hint: "Leave, absent without leave or at an ED",
      tone: away.some((row) => row.where === "awol") ? "danger" : undefined,
      cards: away.map((row) => wardCard(row, row.whereabouts)),
    },
    {
      id: "incoming",
      title: "Coming in",
      hint: "Bed pulled for them",
      cards: rows.filter((row) => row.where === "incoming").map((row) => wardCard(row, row.whereabouts)),
    },
  ];
  return (
    <>
      {/* TV polish (Josh, 9 Nov 2026): each count lives in one place. A lane's own count sits in its
          heading, so the row above keeps only what no lane shows. */}
      <Summary
        items={[
          { label: "absent without leave", value: rows.filter((row) => row.where === "awol").length, tone: "danger" },
        ]}
      />
      <Lanes lanes={lanes} label="Obs and leave" testId="ward-obs-board" />
      {footer}
    </>
  );
}

/* --------------------------------------------------------------------------------------------- *
 * Ward: Legal, for the doctors and the ward clerk. Times as typed (D-93), nothing calculated.
 * --------------------------------------------------------------------------------------------- */

export function WardLegalTvView({ rows, footer }: { rows: WardClinicalRow[]; footer: ReactNode }) {
  const here = rows.filter((row) => row.where !== "incoming");
  const lanes: Lane[] = [
    {
      id: "now",
      title: "Act now",
      // D-210 (Josh, 14 Nov 2026), ruling 3: red from the Settings urgent warning on, as Forms and Delays.
      hint: "Ended, ending within the urgent warning, or the next form to record",
      tone: "danger",
      cards: here.filter((row) => row.legal?.tone === "danger").map((row) => wardCard(row, row.legal)),
    },
    {
      id: "soon",
      title: "Ending soon",
      hint: "End time as typed on the form",
      tone: "warning",
      cards: here.filter((row) => row.legal?.tone === "warning").map((row) => wardCard(row, row.legal)),
    },
    {
      id: "held",
      title: "Status recorded",
      hint: "Form or status in force",
      cards: here.filter((row) => row.legal && !row.legal.tone).map((row) => wardCard(row, row.legal)),
    },
    {
      id: "none",
      title: "Nothing recorded",
      hint: "Check and record the status",
      cards: here.filter((row) => !row.legal).map((row) => wardCard(row)),
    },
  ];
  return (
    <>
      <Lanes lanes={lanes} label="Legal" testId="ward-legal-board" />
      {footer}
    </>
  );
}

/* --------------------------------------------------------------------------------------------- *
 * Ward: Today, for the shift coordinator and ward clerk. Who comes, who goes, who is stuck.
 * --------------------------------------------------------------------------------------------- */

export function WardTodayTvView({ rows, footer }: { rows: WardClinicalRow[]; footer: ReactNode }) {
  const lanes: Lane[] = [
    {
      id: "arriving",
      title: "Arriving today",
      hint: "On the way, pulled or arrived",
      cards: rows
        .filter((row) => row.arrivedToday)
        .map((row) => wardCard(row, row.where === "incoming" ? row.whereabouts : { text: "Arrived today" })),
    },
    {
      id: "going",
      title: "Going home today",
      hint: "Expected date is today",
      cards: rows.filter((row) => row.goingToday).map((row) => wardCard(row, row.plan)),
    },
    {
      id: "stuck",
      // D-197 item 6: the same by-tomorrow held-up window as the ward TV and the Ward page (D-191 item 5).
      title: `${HELD_UP_BY_TOMORROW_LABEL}, or overdue`,
      hint: "What is holding up the discharge",
      tone: "warning",
      cards: rows.filter((row) => row.stuck).map((row) => wardCard(row, row.plan)),
    },
    {
      id: "nodate",
      title: "No date set",
      hint: "Set an expected date",
      cards: rows
        .filter((row) => row.plan?.text === "No date set")
        .map((row) => wardCard(row, null, row.dayNumber === null ? undefined : `Day ${row.dayNumber}`)),
    },
  ];
  return (
    <>
      <Lanes lanes={lanes} label="Today" testId="ward-today-board" />
      {footer}
    </>
  );
}

/* --------------------------------------------------------------------------------------------- *
 * ED: Bed search, for the mental health liaison. Each person in the step they are at, longest first.
 * --------------------------------------------------------------------------------------------- */

const edCard = (row: EdClinicalRow, fact: ClinicalFact): Card => ({
  key: row.id,
  bed: row.bay || undefined,
  name: row.name,
  fact,
  note: `${splitDuration(row.waitMinutes)}${row.underForm ? ", form" : ""}`,
});

export function EdBedSearchTvView({
  rows,
  accessTargetMinutes,
  footer,
}: {
  rows: EdClinicalRow[];
  accessTargetMinutes: number;
  footer: ReactNode;
}) {
  const late = (row: EdClinicalRow): ClinicalFact => ({
    text: row.band === "over" ? `Past ${Math.round(accessTargetMinutes / 60)} hours` : row.next.text,
    tone: row.band === "over" ? "danger" : row.next.tone,
  });
  const step = (id: EdClinicalRow["step"]) => rows.filter((row) => row.step === id);
  const lanes: Lane[] = [
    {
      id: "review",
      title: "Waiting for review",
      hint: "Psychiatry review next",
      cards: step("review").map((row) => edCard(row, late(row))),
    },
    {
      id: "bed",
      title: "Needs a bed",
      hint: "Reviewed, no ward has said yes",
      tone: "warning",
      cards: step("bed").map((row) => edCard(row, row.band === "over" ? late(row) : row.referral)),
    },
    {
      id: "book",
      title: "Bed agreed",
      hint: "Book transport",
      tone: "warning",
      cards: step("book").map((row) => edCard(row, row.referral)),
    },
    {
      id: "transport",
      title: "Transport",
      hint: "Booked or leaving now",
      cards: step("transport").map((row) => edCard(row, row.next)),
    },
  ];
  return (
    <>
      <Summary
        items={[
          { label: "waiting", value: rows.length },
          {
            label: `past ${Math.round(accessTargetMinutes / 60)} hours`,
            value: rows.filter((row) => row.band === "over").length,
            tone: "danger",
          },
        ]}
      />
      <Lanes lanes={lanes} label="Bed search" testId="ed-beds-board" />
      {footer}
    </>
  );
}
