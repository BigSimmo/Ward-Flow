"use client";

/*
 * Redesign (31 Oct 2026): "Journey so far" was a near-empty bar ("7h 0m", "stage times not recorded"). It is now
 * the list of what this movement actually recorded, newest first: opened, referred, examination,
 * form, declines, escalation, acceptance, clearance, stage changes, transport and closure. The
 * events are read the same way as the History tab's log (`movementEvents` in
 * patient-dossier-tabs.tsx); nothing is inferred between them and no time is computed from them.
 */

import { useState } from "react";
import { Button, ShowMoreRow, StatusGlyph, type WfTone } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { originName } from "@/components/ward-management/ward-movement-origin";
import { STAGES } from "./patient-now-records";
import styles from "./patient-journey-timeline.module.css";

type JourneyEvent = { at: number; tone: WfTone; text: string };

/** Owner rule: a list longer than about eight rows opens on its first rows, then "Show more". */
const LONG_LIST = 8;
const FIRST_ROWS = 6;

/** The movement's recorded events, newest first. Copied from the History tab's `movementEvents`. */
function journeyEvents(movement: Movement, unitName: (id: string) => string | undefined): JourneyEvent[] {
  const events: JourneyEvent[] = [
    { at: movement.openedAt, tone: "neutral", text: `Opened at ${originName(movement) ?? "an origin not recorded"}` },
  ];
  if (movement.examination)
    events.push({ at: movement.examination.at, tone: "success", text: "Psychiatric examination recorded" });
  const formAt = movement.legalFormReceivedAt ?? movement.formedAt;
  if (movement.legalForm && formAt !== undefined)
    events.push({ at: formAt, tone: "success", text: `Form ${movement.legalForm.code} recorded` });
  // No ward count: `referredUnitIds` shrinks as wards answer, so it cannot say how many were asked then.
  if (movement.referredAt !== undefined)
    events.push({ at: movement.referredAt, tone: "info", text: "Referred for a bed" });
  for (const decline of movement.declines)
    events.push({ at: decline.at, tone: "closed", text: `Declined by ${unitName(decline.unitId) ?? decline.unitId}` });
  if (movement.escalation)
    events.push({
      at: movement.escalation.at,
      tone: "info",
      text: `Escalated after ${movement.escalation.triedUnitIds.length} ${movement.escalation.triedUnitIds.length === 1 ? "ward" : "wards"} tried`,
    });
  if (movement.acceptedAt !== undefined && movement.acceptedUnitId)
    events.push({
      at: movement.acceptedAt,
      tone: "success",
      text: `Accepted by ${unitName(movement.acceptedUnitId) ?? movement.acceptedUnitId}`,
    });
  if (movement.medicalClearance)
    events.push({
      at: movement.medicalClearance.at,
      tone: movement.medicalClearance.cleared ? "success" : "danger",
      text: movement.medicalClearance.cleared ? "Cleared fit to travel" : "Not cleared to travel",
    });
  for (const change of movement.stageChanges)
    events.push({
      at: change.at,
      tone: "info",
      text: `${STAGES.find((s) => s.id === change.to)?.label ?? change.to}, by ${change.by}`,
    });
  for (const unwind of movement.unwinds) {
    if (unwind.kind !== "pull_released" && unwind.kind !== "acceptance_withdrawn") continue;
    const ward = unwind.unitId === undefined ? undefined : (unitName(unwind.unitId) ?? unwind.unitId);
    const fact = unwind.kind === "pull_released" ? "Pulled bed released" : "Acceptance withdrawn";
    events.push({ at: unwind.at, tone: "closed", text: `${fact}${ward ? `, ${ward}` : ""}, by ${unwind.by}` });
  }
  const job = movement.transport;
  if (job?.acceptedAt !== undefined) events.push({ at: job.acceptedAt, tone: "info", text: "Transport accepted" });
  if (job?.enRouteAt !== undefined) events.push({ at: job.enRouteAt, tone: "info", text: "Transport en route" });
  if (job?.collectedAt !== undefined) events.push({ at: job.collectedAt, tone: "info", text: "Collected" });
  if (job?.arrivedAt !== undefined) events.push({ at: job.arrivedAt, tone: "success", text: "Arrived" });
  if (movement.closure)
    events.push({
      at: movement.closure.at,
      tone: movement.closure.outcome === "arrived" ? "success" : "closed",
      text: movement.closure.outcome === "arrived" ? "Closed on arrival" : "Closed, did not proceed",
    });
  return events.sort((a, b) => b.at - a.at);
}

export function PatientJourneyTimeline({
  movement,
  now,
  onOpenHistory,
}: {
  movement: Movement;
  now: number;
  onOpenHistory: () => void;
}) {
  const { units } = useWardFlowSelect("units");
  const [expanded, setExpanded] = useState(false);
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name;
  const events = journeyEvents(movement, unitName);
  const long = events.length > LONG_LIST;
  const shown = expanded || !long ? events : events.slice(0, FIRST_ROWS);
  return (
    <section className={styles.journey} aria-labelledby="pn-journey-head">
      <div className={styles.journeyHead}>
        <h2 id="pn-journey-head" className={styles.journeyTitle}>
          Journey so far
        </h2>
        <span className={styles.journeyMeta}>
          {events.length} recorded {events.length === 1 ? "event" : "events"}, newest first
        </span>
        <Button size="sm" variant="ghost" onClick={onOpenHistory} className={styles.journeyLink}>
          Full history
        </Button>
      </div>
      <ol className={styles.timeline} data-testid="pn-journey-timeline">
        {shown.map((event, index) => (
          <li key={`${event.at}-${index}`} className={styles.timelineItem}>
            <span className={styles.timelineNode}>
              <StatusGlyph tone={event.tone} size={10} />
            </span>
            <span className={styles.timelineText}>{event.text}</span>
            <time className={styles.timelineTime} dateTime={new Date(event.at).toISOString()}>
              {formatInstantWithDay(event.at, now)}
            </time>
          </li>
        ))}
      </ol>
      {long ? (
        <ShowMoreRow onClick={() => setExpanded((value) => !value)} expanded={expanded}>
          {expanded ? "Show fewer" : `Show ${events.length - FIRST_ROWS} more`}
        </ShowMoreRow>
      ) : null}
    </section>
  );
}
