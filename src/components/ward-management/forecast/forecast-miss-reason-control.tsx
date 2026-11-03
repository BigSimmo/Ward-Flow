"use client";

// src/components/ward-management/forecast/forecast-miss-reason-control.tsx
//
// One missed day's reason (closing-the-loop features, Josh, 24 Oct 2026). A person chooses a reason
// from the closed list and records it; until then the day counts as unexplained. Recorded events
// from the same span are listed as links to look at. None is ever chosen for the person.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

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
import type { ForecastReasonRefreshOutcome, ForecastReasonSaveOutcome } from "./forecast-shared-history";
import styles from "./forecast.module.css";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";

function candidateHref(candidate: MissCandidate): string {
  return candidate.source.kind === "movement"
    ? movementHref(candidate.source.id)
    : dischargeHref(candidate.source.admissionId);
}

export function ForecastMissReasonControl(props: Parameters<typeof ForecastMissReasonForm>[0]) {
  return <ForecastMissReasonForm key={`${props.scopeKey ?? "local"}:${props.day}`} {...props} />;
}

function ForecastMissReasonForm({
  day,
  entry,
  candidates,
  now,
  onRecord,
  expectedVersion = null,
  disabledReason,
  onRefresh,
}: {
  day: number;
  now: Instant;
  entry: ForecastMissReasonEntry | undefined;
  candidates: readonly MissCandidate[];
  onRecord: (reason: ForecastMissReason, expectedVersion: string | null) => Promise<ForecastReasonSaveOutcome>;
  expectedVersion?: string | null;
  disabledReason?: string;
  onRefresh?: () => Promise<ForecastReasonRefreshOutcome>;
  scopeKey?: string;
}) {
  const selectId = useId();
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<ForecastMissReason | "">("");
  const [basis, setBasis] = useState(expectedVersion);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const lifetime = useRef({ attempt: 0, pending: false });
  useEffect(() => {
    const held = lifetime.current;
    return () => {
      held.attempt++;
      held.pending = false;
    };
  }, []);
  // The auxiliary forecast endpoint uses its own captured reason version. A board hold alone
  // cannot stop another desk changing that reason.
  const heldScope = `forecast-miss:${day}`;
  useHoldOpenForm(editing || choice !== "", heldScope);
  const submit = async () => {
    if (lifetime.current.pending || choice === "" || disabledReason || needsReview) return;
    const ticket = ++lifetime.current.attempt;
    lifetime.current.pending = true;
    setBusy(true);
    setMessage(null);
    let result: ForecastReasonSaveOutcome;
    try {
      result = await onRecord(choice, basis);
    } catch {
      result = {
        status: "uncertain",
        message: "This reason is not confirmed saved. Review the latest record before trying again.",
      };
    }
    if (ticket !== lifetime.current.attempt) return;
    lifetime.current.pending = false;
    setBusy(false);
    if (result.status === "accepted") {
      setEditing(false);
      setChoice("");
    } else {
      setMessage(result.message);
      setNeedsReview(true);
    }
  };
  const review = async () => {
    if (lifetime.current.pending) return;
    const ticket = ++lifetime.current.attempt;
    lifetime.current.pending = true;
    setBusy(true);
    let result: ForecastReasonRefreshOutcome;
    try {
      result = (await onRefresh?.()) ?? {
        status: "unavailable",
        message: "Close and reopen the forecast record to check the latest reason. Your choice is still here.",
      };
    } catch {
      result = { status: "unavailable", message: "The latest record could not be checked. Your choice is still here." };
    }
    if (ticket !== lifetime.current.attempt) return;
    lifetime.current.pending = false;
    setBusy(false);
    if (result.status === "ready") {
      setBasis(result.version);
      setNeedsReview(false);
      setMessage(null);
    } else setMessage(result.message);
  };

  if (entry && !editing) {
    return (
      <p className={styles.missReason} data-testid={`ward-forecast-miss-reason-${day}`}>
        Reason: {FORECAST_MISS_REASON_LABELS[entry.reason]}. Recorded by {WARD_FLOW_ROLE_LABELS[entry.by]} at{" "}
        {formatInstantWithDay(entry.at, now)}.{" "}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setBasis(expectedVersion);
            setChoice(entry.reason);
            setMessage(null);
            setNeedsReview(false);
            setEditing(true);
          }}
        >
          Change
        </Button>
      </p>
    );
  }

  return (
    <div className={styles.missReason} data-held-form={heldScope}>
      <div className={styles.bedChange}>
        <label htmlFor={selectId}>Reason for the difference</label>
        <Select
          id={selectId}
          value={choice}
          disabled={busy}
          onChange={(event) => {
            if (!editing) setBasis(expectedVersion);
            setEditing(true);
            setChoice(event.currentTarget.value as ForecastMissReason | "");
          }}
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
          loading={busy}
          disabledReason={
            disabledReason ??
            (needsReview
              ? "Review the latest reason before recording again"
              : choice === ""
                ? "Choose a reason first"
                : undefined)
          }
          onClick={() => void submit()}
          data-testid={`ward-forecast-miss-record-${day}`}
        >
          Record reason
        </Button>
        {editing ? (
          <Button
            variant="ghost"
            size="sm"
            disabledReason={busy ? "Wait for this save to finish" : undefined}
            onClick={() => {
              lifetime.current.attempt++;
              setEditing(false);
              setChoice("");
              setMessage(null);
              setNeedsReview(false);
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className={styles.caption}>
          {message}
        </p>
      ) : null}
      {needsReview ? (
        <>
          {entry ? (
            <p className={styles.caption}>
              Latest recorded reason: {FORECAST_MISS_REASON_LABELS[entry.reason]}, {formatInstantWithDay(entry.at, now)}
              .
            </p>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            disabledReason={busy ? "Checking the latest record" : undefined}
            onClick={() => void review()}
          >
            Review latest reason
          </Button>
        </>
      ) : null}
      {candidates.length > 0 ? (
        <>
          <p className={styles.caption}>Recorded events in this span. None is chosen for you.</p>
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
