"use client";

import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { DisabledReason } from "@/components/wf";
import { GENDER_PLACEMENT_REASONS, GENDER_PLACEMENT_REFUSAL, type GenderPlacementReason } from "../ward-change-reasons";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { genderReviewNeeded, REFERRAL_DECLINE_REASONS, type ReferralDeclineReason } from "../ward-model";
import { DECLINE_REASON_LABELS, wardTransferNeedsCoordinator } from "../ward-referrals";
import { wardRouteUnitId } from "../ward-chrome-role";
import { useRouteRole } from "../ward-role-gate";
import { rolesOnlyReason } from "../ward-role-permissions";
import { referralInboxName } from "./referral-inbox";
import { ReferralIntakeSummary } from "./referral-intake-summary";
import { WardInformationNeedsPicker, useMarkReferralsOpened } from "./referral-information-needs-lazy";
import { useReferralDecisionUndo } from "./use-referral-decision-undo";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import styles from "./ward-referral-drawer.module.css";

/**
 * B1 (site review, 12 Oct 2026): the inbox answers as the route's own role. A ward route answers
 * for its own ward only (`actingUnitId`), and the coordinator answers for any ward, including the
 * D-30 transfers from another hospital and a gender placement that needs a recorded reason.
 */
export function WardReferralInbox({ unitId }: { unitId: string }) {
  const { wardReferralInbox, resolvePatientIdentity, dispatch, rejections, units } = useWardFlowSelect(
    "wardReferralInbox",
    "resolvePatientIdentity",
    "dispatch",
    "rejections",
    "units",
  );
  const now = useWardFlowClock();
  const routeRole = useRouteRole();
  const pathname = usePathname() ?? "";
  const reasonId = useId();
  const isCoordinator = routeRole === "coordinator";
  const actingUnitId = routeRole === "ward" ? wardRouteUnitId(pathname) : undefined;
  const unitName = units.find((unit) => unit.id === unitId)?.name ?? "This ward";
  // Mirrors the reducer's own `answerableBy` and acting-unit checks: only this ward or the
  // coordinator answers a ward referral.
  const roleRefusal =
    isCoordinator || (routeRole === "ward" && actingUnitId === unitId)
      ? undefined
      : routeRole === "ward"
        ? `${unitName} or coordinator only`
        : rolesOnlyReason(["ward", "coordinator"]);
  const [genderReasons, setGenderReasons] = useState<Record<string, GenderPlacementReason | "">>({});
  const [genderChecked, setGenderChecked] = useState<Record<string, boolean>>({});
  const [localNote, setLocalNote] = useState<{ id: string; text: string } | null>(null);
  const [attempt, setAttempt] = useState<{ id: string; count: number } | null>(null);
  const newestRejection = attempt && rejections.length > attempt.count ? rejections.at(-1) : undefined;
  const lastError = newestRejection?.movementId === attempt?.id ? newestRejection?.reason : null;
  const entries = wardReferralInbox?.(unitId) ?? [];
  const [reasons, setReasons] = useState<Record<string, ReferralDeclineReason | "">>({});
  // A ward undoes its own decision by naming itself (UNDO_REFERRAL_DECISION, v10 pass 2).
  const watchDecision = useReferralDecisionUndo(routeRole, isCoordinator ? undefined : unitId);
  const decisionBase = {
    role: routeRole,
    now,
    destinationKind: "psychiatric_ward" as const,
    unitId,
    ...(isCoordinator || actingUnitId === undefined ? {} : { actingUnitId }),
  };
  useMarkReferralsOpened(entries, unitId, actingUnitId);
  if (!entries.length) return null;
  return (
    <section className={styles.refCard} aria-label="Ward referral inbox">
      <h2 className={styles.refCardTitle}>Referral inbox · {entries.length}</h2>
      {lastError && (
        <p className={styles.flowError} role="alert">
          {lastError}
        </p>
      )}
      {entries.map((entry) => {
        const patient = resolvePatientIdentity({ patientId: entry.patientId });
        const live = entry.state === "queued" && entry.withdrawnAt === undefined;
        const coordinatorAccepts = wardTransferNeedsCoordinator(entry, unitId, units);
        // The inbox entry is ward-scoped and carries no earlier coordinator placement record, so a
        // gender or sex other than female or male is treated as still needing one here.
        const needsGenderPlacement = genderReviewNeeded(entry.destination.gender, entry.destination.sex);
        // Why Accept is greyed for this route, if it is. The coordinator is never refused.
        const acceptRefusal = isCoordinator
          ? undefined
          : (roleRefusal ??
            (coordinatorAccepts
              ? "Coordinator accepts transfers from another hospital"
              : needsGenderPlacement
                ? GENDER_PLACEMENT_REFUSAL
                : undefined));
        const genderReason = genderReasons[entry.id] ?? "";
        const genderTicked = genderChecked[entry.id] === true;
        const acceptReasonId = `${reasonId}-accept-${entry.id}`;
        const declineReasonId = `${reasonId}-decline-${entry.id}`;
        return (
          <article className={styles.refCard} key={entry.id}>
            <h3 className={styles.refCardTitle}>
              {referralInboxName(entry, patient.displayName)} · {patient.umrn}
            </h3>
            <p className={styles.refCardSubtitle}>
              {entry.withdrawnAt !== undefined
                ? "Withdrawn by referrer"
                : entry.waitlistedAt !== undefined && live
                  ? "Waitlisted"
                  : entry.state === "cancelled"
                    ? "Cancelled — accepted elsewhere"
                    : entry.state === "queued"
                      ? "Awaiting review"
                      : entry.state === "accepted"
                        ? "Accepted"
                        : `Declined · ${entry.declineReason ? DECLINE_REASON_LABELS[entry.declineReason as ReferralDeclineReason] : "Reason not recorded"}`}
            </p>
            <p className={styles.patientStory}>{entry.history || "Patient story not recorded"}</p>
            <ReferralIntakeSummary intake={entry.intake} />
            {live && (
              <div className={styles.answerOptions}>
                {isCoordinator && needsGenderPlacement ? (
                  <>
                    <p className={styles.refCardSubtitle}>Check with the ward first. A single room is preferred.</p>
                    <label className={styles.flowField}>
                      Placement reason
                      <select
                        className={styles.fieldSelect}
                        value={genderReason}
                        onChange={(event) => {
                          const chosen = event.target.value;
                          setGenderReasons((current) => ({
                            ...current,
                            [entry.id]: GENDER_PLACEMENT_REASONS.includes(chosen as GenderPlacementReason)
                              ? (chosen as GenderPlacementReason)
                              : "",
                          }));
                        }}
                      >
                        <option value="">Choose a reason</option>
                        {GENDER_PLACEMENT_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.flowField}>
                      <input
                        type="checkbox"
                        checked={genderTicked}
                        onChange={(event) =>
                          setGenderChecked((current) => ({ ...current, [entry.id]: event.target.checked }))
                        }
                      />
                      I have checked this placement with the ward
                    </label>
                  </>
                ) : null}
                <button
                  type="button"
                  className={styles.patientChipBtn}
                  aria-disabled={acceptRefusal !== undefined ? "true" : undefined}
                  aria-describedby={acceptRefusal ? acceptReasonId : undefined}
                  onClick={(e) => {
                    if (acceptRefusal) {
                      ignoreUnavailableActivation(e);
                      return;
                    }
                    if (isCoordinator && needsGenderPlacement && (genderReason === "" || !genderTicked)) {
                      setLocalNote({ id: entry.id, text: "Choose a placement reason and tick the ward check first." });
                      return;
                    }
                    setLocalNote(null);
                    setAttempt({ id: entry.id, count: rejections.length });
                    const completion = dispatch({
                      type: "ACCEPT_REFERRAL",
                      ...decisionBase,
                      referralId: entry.id,
                      ...(isCoordinator && needsGenderPlacement && genderReason !== ""
                        ? { genderPlacementReason: genderReason, genderPlacementChecked: true as const }
                        : {}),
                    });
                    watchDecision(entry.id, "Referral accepted", completion);
                  }}
                >
                  Accept referral
                </button>
                {acceptRefusal ? <DisabledReason id={acceptReasonId}>{acceptRefusal}</DisabledReason> : null}
                {localNote?.id === entry.id ? (
                  <p className={styles.flowError} role="status">
                    {localNote.text}
                  </p>
                ) : null}
                <button
                  type="button"
                  className={styles.patientChipBtn}
                  aria-disabled={roleRefusal !== undefined ? "true" : undefined}
                  aria-describedby={roleRefusal ? declineReasonId : undefined}
                  onClick={(e) => {
                    if (roleRefusal) {
                      ignoreUnavailableActivation(e);
                      return;
                    }
                    setAttempt({ id: entry.id, count: rejections.length });
                    const completion = dispatch({
                      type: "DECLINE_REFERRAL",
                      ...decisionBase,
                      referralId: entry.id,
                      reason: "no_suitable_bed",
                      waitlist: true,
                    });
                    watchDecision(entry.id, "Referral waitlisted", completion);
                  }}
                >
                  Waitlist
                </button>
                <label className={styles.flowField}>
                  Decline reason
                  <select
                    className={styles.fieldSelect}
                    value={reasons[entry.id] ?? ""}
                    onChange={(event) =>
                      setReasons((current) => ({
                        ...current,
                        [entry.id]: event.target.value as ReferralDeclineReason | "",
                      }))
                    }
                  >
                    <option value="">Choose a reason</option>
                    {REFERRAL_DECLINE_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {DECLINE_REASON_LABELS[reason]}
                      </option>
                    ))}
                  </select>
                </label>
                {(() => {
                  const declineRefusal = roleRefusal ?? (!reasons[entry.id] ? "Choose a decline reason" : undefined);
                  return (
                    <>
                      <button
                        type="button"
                        className={styles.patientChipBtn}
                        aria-disabled={declineRefusal !== undefined ? "true" : undefined}
                        aria-describedby={declineRefusal ? declineReasonId : undefined}
                        onClick={(e) => {
                          const reason = reasons[entry.id];
                          if (!reason || roleRefusal) {
                            ignoreUnavailableActivation(e);
                            return;
                          }
                          setAttempt({ id: entry.id, count: rejections.length });
                          const completion = dispatch({
                            type: "DECLINE_REFERRAL",
                            ...decisionBase,
                            referralId: entry.id,
                            reason,
                          });
                          watchDecision(entry.id, "Referral declined", completion);
                        }}
                      >
                        Decline referral
                      </button>
                      {declineRefusal ? <DisabledReason id={declineReasonId}>{declineRefusal}</DisabledReason> : null}
                    </>
                  );
                })()}
              </div>
            )}
            {live ? (
              <WardInformationNeedsPicker
                entry={entry}
                unitId={unitId}
                actingUnitId={actingUnitId}
                refusal={roleRefusal}
              />
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
