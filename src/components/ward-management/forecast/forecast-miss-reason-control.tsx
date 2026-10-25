"use client";

// src/components/ward-management/forecast/forecast-miss-reason-control.tsx
//
// One missed day's reason (closing-the-loop features, Josh, 24 Oct 2026). A person chooses a reason
// from the closed list and records it; until then the day counts as unexplained. Recorded events
// from the same span are listed as links to look at. None is ever chosen for the person.
import Link from "next/link";
import { useId, useState } from "react";

import { Button, Select } from "@/components/wf";
import { dischargeHref, movementHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import {
  FORECAST_MISS_REASON_LABELS,
  FORECAST_MISS_REASONS,
  type ForecastMissReason,
  type ForecastMissReasonEntry,
  type MissCandidate,
} from "./forecast-miss-reasons";
import styles from "./forecast.module.css";

function candidateHref(candidate: MissCandidate): string {
  return candidate.source.kind === "movement"
    ? movementHref(candidate.source.id)
    : dischargeHref(candidate.source.admissionId);
}

export function ForecastMissReasonControl({
  day,
  entry,
  candidates,
  now,
  onRecord,
}: {
  day: number;
  now: Instant;
  entry: ForecastMissReasonEntry | undefined;
  candidates: readonly MissCandidate[];
  onRecord: (reason: ForecastMissReason) => void;
}) {
  const selectId = useId();
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<ForecastMissReason | "">("");

  if (entry && !editing) {
    return (
      <p className={styles.missReason} data-testid={`ward-forecast-miss-reason-${day}`}>
        Reason: {FORECAST_MISS_REASON_LABELS[entry.reason]}. Recorded by {WARD_FLOW_ROLE_LABELS[entry.by]} at{" "}
        {formatInstantWithDay(entry.at, now)}.{" "}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setChoice(entry.reason);
            setEditing(true);
          }}
        >
          Change
        </Button>
      </p>
    );
  }

  return (
    <div className={styles.missReason}>
      <div className={styles.bedChange}>
        <label htmlFor={selectId}>Reason for the difference</label>
        <Select
          id={selectId}
          value={choice}
          onChange={(event) => setChoice(event.currentTarget.value as ForecastMissReason | "")}
          data-testid={`ward-forecast-miss-select-${day}`}
        >
          <option value="">Not recorded</option>
          {FORECAST_MISS_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {FORECAST_MISS_REASON_LABELS[reason]}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          disabledReason={choice === "" ? "Choose a reason first" : undefined}
          onClick={() => {
            if (choice === "") return;
            onRecord(choice);
            setEditing(false);
          }}
          data-testid={`ward-forecast-miss-record-${day}`}
        >
          Record reason
        </Button>
        {editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
      {candidates.length > 0 ? (
        <>
          <p className={styles.caption}>Recorded events in this span, to look at. None is chosen for you.</p>
          <ul className={styles.missCandidates}>
            {candidates.map((candidate) => (
              <li key={candidate.key}>
                <Link href={candidateHref(candidate)}>{candidate.label}</Link>
                <span className={styles.caption}> · may fit {FORECAST_MISS_REASON_LABELS[candidate.fits]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
