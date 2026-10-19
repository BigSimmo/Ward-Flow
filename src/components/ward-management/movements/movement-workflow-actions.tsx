"use client";
import { useState } from "react";
import Link from "next/link";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import type { Movement } from "../ward-model";
import { CONTINUATION_LEGAL_FORMS, countryExtensionEligible } from "../ward-legal-forms";
import { RELEASE_PULL_REASONS, type ReleasePullReason } from "../ward-change-reasons";
import { isArrivalLate, isLegalClockFormCode, leaveBedNeedsOpenWarning } from "../ward-legal-clock";
import { perthDateTimeLocal } from "../ward-clock";
import styles from "./movement-workspace-cockpit.module.css";

export function MovementWorkflowActions({ movement }: { movement: Movement }) {
  const { units, leaveBeds, rejections, dayZero } = useWardFlowSelect("units", "leaveBeds", "rejections", "dayZero");
  const now = useWardFlowClock();
  const raise = useWardRaise("coordinator");
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
  // L7: a typed datetime-local value is Perth wall time, not the browser's zone.
  const writtenAt = written ? perthDateTimeLocal(written) : undefined;
  const expiryAt = expiry ? perthDateTimeLocal(expiry) : undefined;
  const started = writtenAt ? (writtenAt.getTime() - dayZero.getTime()) / 60_000 : NaN;
  const due = expiryAt ? (expiryAt.getTime() - dayZero.getTime()) / 60_000 : NaN;
  const before = () => {
    setSubmitted(rejections.length);
    setLocalError(null);
  };
  const open = !movement.closure;
  const lateArrivalUnavailable =
    !open ||
    !!movement.arrivalLateNotifiedAt ||
    !isArrivalLate(movement.arrivalDetails?.estimatedArrivalAt, movement.stage, now);
  const lateArrivalReason = !open
    ? "This movement is closed."
    : movement.arrivalLateNotifiedAt
      ? "Late arrival has already been reviewed."
      : "No overdue arrival plan to review right now.";
  const leaveWarningUnavailable = !leaveBeds.some((b) => leaveBedNeedsOpenWarning(b.confirmedAt, b.openWarningAt, now));
  const leaveWarningReason = "No leave bed currently needs an open warning review.";
  const mismatchUnavailable = !open || !mismatch || !unit;
  const mismatchReason = !open
    ? "This movement is closed."
    : !unit
      ? "No accepting ward is recorded yet."
      : "No legal status placement mismatch is detected on the accepting ward.";
  const releaseUnavailable = !reason || (!!movement.transport && movement.transport.cancelledAt === undefined);
  const releaseReason =
    movement.transport && movement.transport.cancelledAt === undefined
      ? "Cancel the active transport booking before releasing the bed."
      : "Choose a release and reopen reason first.";
  const unsupportedContinuation = !!form && !isLegalClockFormCode(form);
  const continuationUnavailable = !form || !written || unsupportedContinuation;
  const continuationReason = unsupportedContinuation
    ? `Form ${form} continuation is not recorded in this prototype.`
    : "Choose a continuation form and enter the written date and time first.";
  const countryExtensionUnavailable = !countryExtensionEligible(movement) || !expiry;
  const countryExtensionReason = !countryExtensionEligible(movement)
    ? "A country extension requires a current Form 1A with a country paper setting."
    : "Enter the new expiry written on the extension paper first.";

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
                raise("CLEAR_EXPECT_FLAG", { movementId: movement.id });
              } else {
                raise("RAISE_EXPECT_FLAG", {
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
          aria-disabled={lateArrivalUnavailable ? "true" : undefined}
          aria-describedby={lateArrivalUnavailable ? `workflow-late-arrival-reason-${movement.id}` : undefined}
          title={lateArrivalUnavailable ? lateArrivalReason : undefined}
          onClick={
            lateArrivalUnavailable
              ? ignoreUnavailableActivation
              : () => {
                  before();
                  raise("EVALUATE_ARRIVAL_LATENESS", { movementId: movement.id });
                }
          }
        >
          Review late arrival
        </button>
        {lateArrivalUnavailable ? (
          <span id={`workflow-late-arrival-reason-${movement.id}`} className="sr-only">
            {lateArrivalReason}
          </span>
        ) : null}
        <button
          type="button"
          aria-disabled={leaveWarningUnavailable ? "true" : undefined}
          aria-describedby={leaveWarningUnavailable ? `workflow-leave-warning-reason-${movement.id}` : undefined}
          title={leaveWarningUnavailable ? leaveWarningReason : undefined}
          onClick={
            leaveWarningUnavailable
              ? ignoreUnavailableActivation
              : () => {
                  before();
                  raise("EVALUATE_LEAVE_BED_WARNINGS");
                }
          }
        >
          Review leave bed warnings
        </button>
        {leaveWarningUnavailable ? (
          <span id={`workflow-leave-warning-reason-${movement.id}`} className="sr-only">
            {leaveWarningReason}
          </span>
        ) : null}
        <button
          type="button"
          aria-disabled={mismatchUnavailable ? "true" : undefined}
          aria-describedby={mismatchUnavailable ? `workflow-mismatch-reason-${movement.id}` : undefined}
          title={mismatchUnavailable ? mismatchReason : undefined}
          onClick={
            mismatchUnavailable
              ? ignoreUnavailableActivation
              : () => {
                  if (!unit || !mismatch) return;
                  before();
                  raise("FLAG_LEGAL_MISMATCH", {
                    movementId: movement.id,
                    unitId: unit.id,
                    kind: mismatch,
                  });
                }
          }
        >
          Flag current legal placement mismatch
        </button>
        {mismatchUnavailable ? (
          <span id={`workflow-mismatch-reason-${movement.id}`} className="sr-only">
            {mismatchReason}
          </span>
        ) : null}
        {unit && (
          <button
            type="button"
            onClick={() => {
              before();
              raise("SEND_WARD_BUZZ", {
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
            if (!reason || releaseUnavailable) return;
            before();
            raise("RELEASE_AND_REOPEN_SEARCH", {
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
            aria-disabled={releaseUnavailable ? "true" : undefined}
            aria-describedby={releaseUnavailable ? `workflow-release-reason-${movement.id}` : undefined}
            title={releaseUnavailable ? releaseReason : undefined}
            onClick={releaseUnavailable ? ignoreUnavailableActivation : undefined}
          >
            Release held bed and reopen search
          </button>
          {releaseUnavailable ? (
            <span id={`workflow-release-reason-${movement.id}`} className="sr-only">
              {releaseReason}
            </span>
          ) : null}
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
                <option key={f.code} value={f.code}>
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
            aria-disabled={continuationUnavailable ? "true" : undefined}
            aria-describedby={continuationUnavailable ? `workflow-continuation-reason-${movement.id}` : undefined}
            title={continuationUnavailable ? continuationReason : undefined}
            onClick={
              continuationUnavailable
                ? ignoreUnavailableActivation
                : () => {
                    if (!Number.isFinite(started) || (expiry && !Number.isFinite(due))) {
                      setLocalError("Enter the date and time written on the form.");
                      return;
                    }
                    before();
                    raise("RECORD_LEGAL_FORM_CONTINUATION", {
                      movementId: movement.id,
                      formCode: form,
                      startedAt: started,
                      ...(expiry ? { paperExpiresAt: due } : {}),
                    });
                  }
            }
          >
            Record legal form continuation
          </button>
          {continuationUnavailable ? (
            <span id={`workflow-continuation-reason-${movement.id}`} className="sr-only">
              {continuationReason}
            </span>
          ) : null}
          <button
            type="button"
            aria-disabled={countryExtensionUnavailable ? "true" : undefined}
            aria-describedby={
              countryExtensionUnavailable ? `workflow-country-extension-reason-${movement.id}` : undefined
            }
            title={countryExtensionUnavailable ? countryExtensionReason : undefined}
            onClick={
              countryExtensionUnavailable
                ? ignoreUnavailableActivation
                : () => {
                    if (!Number.isFinite(due)) {
                      setLocalError("Enter the new expiry written on the extension form.");
                      return;
                    }
                    before();
                    raise("RECORD_COUNTRY_EXTENSION", {
                      movementId: movement.id,
                      paperExpiresAt: due,
                    });
                  }
            }
          >
            Record country paper extension
          </button>
          {countryExtensionUnavailable ? (
            <span id={`workflow-country-extension-reason-${movement.id}`} className="sr-only">
              {countryExtensionReason}
            </span>
          ) : null}
          {!countryExtensionEligible(movement) && (
            <p>
              A country extension requires a current Form 1A. Record its country paper setting in{" "}
              <Link href="/ward-flow/legal-forms">Forms</Link> first.
            </p>
          )}
          <p>A missing expiry stays unknown. No statutory interval is calculated.</p>
        </details>
      )}
    </section>
  );
}
