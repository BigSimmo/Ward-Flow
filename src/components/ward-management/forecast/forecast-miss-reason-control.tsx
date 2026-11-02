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
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";
import type { PendingForecastReason } from "./forecast-pending-reasons";

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
  pending = [],
  version = 0,
  writable = true,
  error,
  onRetry,
  onDiscard,
  legacy = [],
}: {
  day: number;
  now: Instant;
  entry: ForecastMissReasonEntry | undefined;
  candidates: readonly MissCandidate[];
  onRecord: (reason: ForecastMissReason, expectedDayVersion: number) => boolean | void;
  pending?: readonly (PendingForecastReason & { saving?: boolean })[];
  version?: number;
  writable?: boolean;
  error?: string | null;
  onRetry?: (operationId: string) => void;
  onDiscard?: (operationId: string) => void;
  legacy?: readonly ForecastMissReasonEntry[];
}) {
  const selectId = useId();
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<ForecastMissReason | "">("");
  const [basis, setBasis] = useState<number | null>(null);
  // The day version is held from the first edit, even when a later poll changes the shown reason.
  const heldScope = `forecast-miss:${day}`;
  useHoldOpenForm(editing || choice !== "", heldScope);
  const earlier =
    legacy.length && !editing ? (
      <div>
        {legacy.map((draft) => (
          <p role="status" key={`${draft.at}-${draft.reason}`}>
            Earlier local choice: {FORECAST_MISS_REASON_LABELS[draft.reason]}. Its desk was not recorded. Review before
            saving it here.
          </p>
        ))}
        <Button
          size="sm"
          variant="ghost"
          disabledReason={!writable ? "Reconnect before reviewing this choice" : undefined}
          onClick={() => {
            setChoice(legacy[legacy.length - 1]!.reason);
            setBasis(version);
            setEditing(true);
          }}
        >
          Review local choice
        </Button>
      </div>
    ) : null;

  const recorded = entry ? (
    <p className={styles.missReason} data-testid={`ward-forecast-miss-reason-${day}`}>
      Reason: {FORECAST_MISS_REASON_LABELS[entry.reason]}. Recorded by {WARD_FLOW_ROLE_LABELS[entry.by]} at{" "}
      {formatInstantWithDay(entry.at, now)}.
    </p>
  ) : null;
  if (pending.length)
    return (
      <div className={styles.missReason}>
        {recorded}
        {pending.map((draft) => (
          <div key={draft.operationId}>
            <p role="status">
              Your choice: {FORECAST_MISS_REASON_LABELS[draft.entry.reason]}.{" "}
              {draft.saving
                ? "Saving; not yet confirmed."
                : draft.status === "conflict"
                  ? "Another reason was recorded. Your choice was not applied. Review it before choosing again."
                  : draft.status === "failed"
                    ? "Save not confirmed. It may already have been accepted; retry checks the same save."
                    : "Waiting to save; not yet confirmed."}
            </p>
            {draft.status !== "conflict" ? (
              <Button
                size="sm"
                variant="ghost"
                disabledReason={draft.saving ? "Save in progress" : !writable ? "Reconnect before retrying" : undefined}
                onClick={() => onRetry?.(draft.operationId)}
              >
                Retry
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              disabledReason={draft.saving ? "Wait for this save to finish" : undefined}
              onClick={() => onDiscard?.(draft.operationId)}
            >
              Discard draft
            </Button>
            <p className={styles.caption}>Discarding stops retries. It does not undo a save already accepted.</p>
          </div>
        ))}
        {error ? <p role="status">{error}</p> : null}
      </div>
    );

  if (entry && !editing) {
    return (
      <div>
        {earlier}
        <p className={styles.missReason} data-testid={`ward-forecast-miss-reason-${day}`}>
          Reason: {FORECAST_MISS_REASON_LABELS[entry.reason]}. Recorded by {WARD_FLOW_ROLE_LABELS[entry.by]} at{" "}
          {formatInstantWithDay(entry.at, now)}.{" "}
          <Button
            variant="ghost"
            size="sm"
            disabledReason={!writable ? "Reconnect to save a shared reason safely" : undefined}
            onClick={() => {
              setChoice(entry.reason);
              setBasis(version);
              setEditing(true);
            }}
          >
            Change
          </Button>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.missReason} data-held-form={heldScope}>
      {earlier}
      <div className={styles.bedChange}>
        <label htmlFor={selectId}>Reason for the difference</label>
        <Select
          id={selectId}
          value={choice}
          onChange={(event) => {
            if (basis === null) setBasis(version);
            setChoice(event.currentTarget.value as ForecastMissReason | "");
            setEditing(true);
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
          disabledReason={
            choice === "" ? "Choose a reason first" : !writable ? "Reconnect to save a shared reason safely" : undefined
          }
          onClick={() => {
            if (choice === "") return;
            if (onRecord(choice, basis ?? version) === false) return;
            setEditing(false);
            setChoice("");
            setBasis(null);
          }}
          data-testid={`ward-forecast-miss-record-${day}`}
        >
          Record reason
        </Button>
        {editing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setChoice("");
              setBasis(null);
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      {!writable ? <p role="status">Shared saving is unavailable. Reconnect before recording this choice.</p> : null}
      {error ? <p role="status">{error}</p> : null}
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
