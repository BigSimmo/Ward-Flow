"use client";
import { useState } from "react";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import type { Movement } from "../ward-model";
import { CONTINUATION_LEGAL_FORMS, countryExtensionEligible } from "../ward-legal-forms";
import { RELEASE_PULL_REASONS, type ReleasePullReason } from "../ward-change-reasons";
import { isArrivalLate, leaveBedNeedsOpenWarning } from "../ward-legal-clock";
import styles from "./movement-workspace-cockpit.module.css";

export function MovementWorkflowActions({ movement }: { movement: Movement }) {
  const { dispatch, units, leaveBeds, rejections, dayZero } = useWardFlow();
  const now = useWardFlowClock();
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [reason, setReason] = useState<ReleasePullReason | "">("");
  const [form, setForm] = useState("");
  const [written, setWritten] = useState("");
  const [expiry, setExpiry] = useState("");
  const unit = units.find((u) => u.id === movement.acceptedUnitId);
  const mismatch =
    unit && movement.legalStatus !== "Voluntary" && !unit.authorised
      ? "involuntary_on_voluntary_ward"
      : unit && movement.legalStatus === "Voluntary" && unit.lockedBeds > 0 && unit.beds - unit.lockedBeds <= 0
        ? "voluntary_on_locked_ward"
        : null;
  const started = written ? (new Date(written).getTime() - dayZero.getTime()) / 60_000 : NaN;
  const due = expiry ? (new Date(expiry).getTime() - dayZero.getTime()) / 60_000 : NaN;
  const before = () => {
    setSubmitted(rejections.length);
    setLocalError(null);
  };
  const open = !movement.closure;
  return (
    <section className={styles.panelCardBody} aria-label="Movement workflow actions">
      <h3>Movement workflow actions</h3>
      <p>These controls record local workflow facts. Paper authority and expiry are entered from the checked form.</p>
      {localError && <p role="alert">{localError}</p>}
      {submitted !== null && rejections.length > submitted && <p role="alert">{rejections.at(-1)?.reason}</p>}
      <div>
        {open && (
          <button
            type="button"
            onClick={() => {
              before();
              if (movement.expectFlag && movement.expectFlag.clearedAt === undefined) {
                dispatch({ type: "CLEAR_EXPECT_FLAG", role: "coordinator", now, movementId: movement.id });
              } else {
                dispatch({
                  type: "RAISE_EXPECT_FLAG",
                  role: "coordinator",
                  now,
                  movementId: movement.id,
                  kind: movement.legalStatus === "Voluntary" ? "voluntary_48h" : "involuntary_7d",
                });
              }
            }}
          >
            {movement.expectFlag && movement.expectFlag.clearedAt === undefined
              ? "Clear expectation review flag"
              : "Raise expectation review flag"}
          </button>
        )}
        <button
          type="button"
          disabled={
            !open ||
            !!movement.arrivalLateNotifiedAt ||
            !isArrivalLate(movement.arrivalDetails?.estimatedArrivalAt, movement.stage, now)
          }
          onClick={() => {
            before();
            dispatch({ type: "EVALUATE_ARRIVAL_LATENESS", role: "coordinator", now, movementId: movement.id });
          }}
        >
          Review late arrival
        </button>
        <button
          type="button"
          disabled={!leaveBeds.some((b) => leaveBedNeedsOpenWarning(b.confirmedAt, b.openWarningAt, now))}
          onClick={() => {
            before();
            dispatch({ type: "EVALUATE_LEAVE_BED_WARNINGS", role: "coordinator", now });
          }}
        >
          Review leave bed warnings
        </button>
        <button
          type="button"
          disabled={!open || !mismatch || !unit}
          onClick={() => {
            if (!unit || !mismatch) return;
            before();
            dispatch({
              type: "FLAG_LEGAL_MISMATCH",
              role: "coordinator",
              now,
              movementId: movement.id,
              unitId: unit.id,
              kind: mismatch,
            });
          }}
        >
          Flag current legal placement mismatch
        </button>
        {unit && (
          <button
            type="button"
            onClick={() => {
              before();
              dispatch({
                type: "SEND_WARD_BUZZ",
                role: "coordinator",
                now,
                unitId: unit.id,
                message: "Please review and confirm ward capacity.",
                urgent: false,
              });
            }}
          >
            Request ward capacity review
          </button>
        )}
        <p>A capacity request appears in the ward’s local request list. It does not send an external message.</p>
      </div>
      {open && ["pulled", "accepted_awaiting_bed"].includes(movement.stage) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return;
            before();
            dispatch({
              type: "RELEASE_AND_REOPEN_SEARCH",
              role: "coordinator",
              now,
              movementId: movement.id,
              actingUnitId: movement.acceptedUnitId ?? "",
              reason,
            });
          }}
        >
          <label>
            Release and reopen reason
            <select
              value={reason}
              onChange={(e) =>
                setReason(
                  RELEASE_PULL_REASONS.includes(e.target.value as ReleasePullReason)
                    ? (e.target.value as ReleasePullReason)
                    : "",
                )
              }
              required
            >
              <option value="">Choose reason</option>
              {RELEASE_PULL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={!reason || (!!movement.transport && movement.transport.cancelledAt === undefined)}
          >
            Release held bed and reopen search
          </button>
          {movement.transport && movement.transport.cancelledAt === undefined && (
            <p>Cancel the active transport booking before releasing the bed.</p>
          )}
        </form>
      )}
      {open && (
        <details>
          <summary>Record paper continuation or country extension</summary>
          <label>
            Continuation form
            <select value={form} onChange={(e) => setForm(e.target.value)}>
              <option value="">Choose form</option>
              {CONTINUATION_LEGAL_FORMS.map((f) => (
                <option key={f.code} value={f.code} disabled={f.code === "5B" && movement.legalForm?.code !== "5A"}>
                  {f.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Form written date and time
            <input type="datetime-local" value={written} onChange={(e) => setWritten(e.target.value)} />
          </label>
          <label>
            Expiry written on paper
            <input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={!form || !written || (form === "5B" && movement.legalForm?.code !== "5A")}
            onClick={() => {
              if (!Number.isFinite(started) || (expiry && !Number.isFinite(due))) {
                setLocalError("Enter the date and time written on the form.");
                return;
              }
              before();
              dispatch({
                type: "RECORD_LEGAL_FORM_CONTINUATION",
                role: "coordinator",
                now,
                movementId: movement.id,
                formCode: form,
                startedAt: started,
                ...(expiry ? { paperExpiresAt: due } : {}),
              });
            }}
          >
            Record legal form continuation
          </button>
          <button
            type="button"
            disabled={!countryExtensionEligible(movement) || !expiry}
            onClick={() => {
              if (!Number.isFinite(due)) {
                setLocalError("Enter the new expiry written on the extension form.");
                return;
              }
              before();
              dispatch({
                type: "RECORD_COUNTRY_EXTENSION",
                role: "coordinator",
                now,
                movementId: movement.id,
                paperExpiresAt: due,
              });
            }}
          >
            Record country paper extension
          </button>
          {!countryExtensionEligible(movement) && (
            <p>
              A country extension requires a current Form 1A. Record its country paper setting in{" "}
              <a href="/mockups/ward-flow/legal-forms">Legal forms</a> first.
            </p>
          )}
          <p>A missing expiry stays unknown. No statutory interval is calculated.</p>
        </details>
      )}
    </section>
  );
}
