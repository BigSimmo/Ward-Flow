"use client";

import { useState, type FormEvent } from "react";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import { allEmergencyDepartments } from "../ward-sites";
import { useDeskInScope } from "../shell/ward-access";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "../ward-legal-forms";
import { useWardCommandCompletion, wardCommandFailure } from "./use-ward-command-completion";
import type { LegalStatus } from "../ward-model";
import { legalStatusMismatchWarning } from "../ward-eligibility";
import styles from "./ward.module.css";
import {
  INTERMITTENT_INTERVAL_MINUTES,
  OBSERVATION_LEVELS,
  observationAt,
  observationLevelName,
  type ObservationLevel,
} from "@/components/ward-management/ward-observation";

/** Every `LegalStatus`, hand-listed like the shortlist panel's: importing the ED screen model for
 *  it pulled the coordinator queue and ED derivations into every ward page's phone script budget. */
const LEGAL_STATUS_OPTIONS: LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];

export function WardAcceptedReferralPlacementForm({
  unitId,
  onMessage,
  onStarted,
}: {
  unitId: string;
  onMessage: (message: string) => void;
  onStarted: () => void;
}) {
  const { movements, wardReferralInbox, resolvePatientIdentity } = useWardFlowSelect(
    "movements",
    "wardReferralInbox",
    "resolvePatientIdentity",
  );
  const inboxEntries = wardReferralInbox(unitId);
  const raise = useWardRaise("ward");
  const completeCommand = useWardCommandCompletion();
  // Starting an ED journey raises it for the source ED, so a desk scoped to its own ward(s) only is refused
  // by the engine. Send that desk to the coordinator instead of offering a button that cannot succeed.
  // A community journey (D-76) names no ED, so the accepting ward may start it.
  const deskInScope = useDeskInScope();
  const [placementDraft, setPlacementDraft] = useState<{
    referralId: string;
    legalStatus: string;
    legalFormCode: string;
    /** Fix plan item 10: unanswered ("") until the ward chooses a level. */
    observation: ObservationLevel | "";
    /** Intermittent only: minutes between checks, as the ED intake form asks. */
    intervalMinutes: number;
  } | null>(null);
  // Acceptance is a decision only. Starting its separate journey consumes no bed.
  const acceptedToStart = inboxEntries
    .filter(
      (entry) =>
        entry.state === "accepted" &&
        entry.withdrawnAt === undefined &&
        (entry.source === "ed_medical" || entry.source === "community") &&
        !movements.some(
          (movement) => movement.referralId === entry.id && movement.closure?.outcome !== "did_not_proceed",
        ),
    )
    .flatMap((entry) => {
      // D-76: an accepted community referral starts its journey at the referring team, with no ED.
      const ed =
        entry.source === "community"
          ? undefined
          : allEmergencyDepartments().find((place) => place.siteCode === entry.originSiteCode);
      return entry.ageBand && (ed || entry.source === "community") ? [{ entry, cohort: entry.ageBand, ed }] : [];
    });
  function startAcceptedPlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!placementDraft) return;
    const current = acceptedToStart.find(({ entry }) => entry.id === placementDraft.referralId);
    const legalStatus = LEGAL_STATUS_OPTIONS.find((status) => status === placementDraft.legalStatus);
    const observationLevel = placementDraft.observation;
    if (!current || !legalStatus || !placementDraft.legalFormCode || observationLevel === "") return;
    const { entry, cohort, ed } = current;
    const mismatch = legalStatusMismatchWarning(entry.destination.involuntaryBedNeeded, legalStatus);
    completeCommand(
      `start:${entry.id}`,
      () =>
        raise("RAISE_REFERRAL", {
          ...(ed ? { edId: ed.id } : {}),
          referralId: entry.id,
          acceptedUnitId: unitId,
          actingUnitId: unitId,
          draft: {
            cohort,
            security: entry.destination.secureBedNeeded ? "Secure" : "Open",
            sex: entry.destination.sex,
            gender: entry.destination.gender,
            highAcuity: entry.destination.highAcuityNursingNeeded === true,
            observation:
              observationLevel === "intermittent"
                ? { ...observationAt(observationLevel), intervalMinutes: placementDraft.intervalMinutes }
                : observationAt(observationLevel),
            legalStatus,
            legalFormCode: placementDraft.legalFormCode === "none" ? null : placementDraft.legalFormCode,
            urgency: entry.urgency,
            atsCategory: entry.atsCategory,
          },
        }),
      (outcome) => {
        const failure = wardCommandFailure(outcome);
        const started = "Placement started. Open Ward flow, Admissions, then choose Pull a bed.";
        onMessage(failure ?? (mismatch ? `${started} ${mismatch}` : started));
        if (!failure) {
          setPlacementDraft(null);
          onStarted();
        }
      },
    );
  }

  return acceptedToStart.length > 0 ? (
    <section aria-label="Accepted referrals awaiting placement" className={styles.unitCard}>
      <h2 className={styles.sectionHeading}>Accepted referrals awaiting placement</h2>
      <p className={styles.cardMeta}>Start the accepted journey, then pull a bed. Starting does not reserve a bed.</p>
      {acceptedToStart.map(({ entry, ed }) => (
        <div key={entry.id}>
          <p>{resolvePatientIdentity(entry).displayName}</p>
          {placementDraft?.referralId === entry.id ? (
            <form onSubmit={startAcceptedPlacement} className={styles.placementForm}>
              <label>
                Legal status
                <select
                  value={placementDraft.legalStatus}
                  onChange={(event) => setPlacementDraft({ ...placementDraft, legalStatus: event.target.value })}
                  required
                >
                  <option value="">Choose a legal status</option>
                  {LEGAL_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              {(() => {
                const chosen = LEGAL_STATUS_OPTIONS.find((status) => status === placementDraft.legalStatus);
                const warning = chosen && legalStatusMismatchWarning(entry.destination.involuntaryBedNeeded, chosen);
                return warning ? (
                  <p role="alert" className={styles.cardMeta} data-testid="ward-accepted-placement-legal-mismatch">
                    {warning} You can still start the placement.
                  </p>
                ) : null;
              })()}
              <label>
                Legal form
                <select
                  value={placementDraft.legalFormCode}
                  onChange={(event) => setPlacementDraft({ ...placementDraft, legalFormCode: event.target.value })}
                  required
                >
                  <option value="">Choose a legal form or no form</option>
                  <option value="none">No form</option>
                  {SELECTABLE_LEGAL_FORMS.map((form) => (
                    <option key={form.code} value={form.code}>
                      {legalFormName(form)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Observation level
                <select
                  value={placementDraft.observation}
                  onChange={(event) =>
                    setPlacementDraft({ ...placementDraft, observation: event.target.value as ObservationLevel | "" })
                  }
                >
                  <option value="">Choose an observation level</option>
                  {OBSERVATION_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {observationLevelName(level)}
                    </option>
                  ))}
                </select>
              </label>
              {placementDraft.observation === "intermittent" ? (
                <label>
                  Check every
                  <select
                    value={placementDraft.intervalMinutes}
                    onChange={(event) =>
                      setPlacementDraft({ ...placementDraft, intervalMinutes: Number(event.target.value) })
                    }
                  >
                    {INTERMITTENT_INTERVAL_MINUTES.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className={styles.placementActions}>
                <button
                  type="submit"
                  className={styles.btnActionSec}
                  disabled={!placementDraft.legalStatus || !placementDraft.legalFormCode || !placementDraft.observation}
                >
                  Confirm and start placement
                </button>
                <button type="button" className={styles.btnActionSec} onClick={() => setPlacementDraft(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : ed && deskInScope && !deskInScope(ed.id) ? (
            <p className={styles.cardMeta} data-testid="ward-accepted-placement-coordinator">
              This desk cannot start a placement from {ed.name}. Ask the bed coordinator to start it.
            </p>
          ) : (
            <button
              type="button"
              className={styles.btnActionSec}
              onClick={() =>
                setPlacementDraft({
                  referralId: entry.id,
                  legalStatus: LEGAL_STATUS_OPTIONS.find((status) => status === entry.intake?.legalStatus) ?? "",
                  legalFormCode: "",
                  observation: "",
                  intervalMinutes: INTERMITTENT_INTERVAL_MINUTES[0],
                })
              }
            >
              Start placement
            </button>
          )}
        </div>
      ))}
    </section>
  ) : null;
}
