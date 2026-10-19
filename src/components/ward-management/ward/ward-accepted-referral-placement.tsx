"use client";

import { useState, type FormEvent } from "react";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import { allEmergencyDepartments } from "../ward-sites";
import { LEGAL_STATUS_OPTIONS } from "../ed/ed-screen-model";
import { useDeskInScope } from "../shell/ward-access";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "../ward-legal-forms";
import { useWardCommandCompletion, wardCommandFailure } from "./use-ward-command-completion";
import styles from "./ward.module.css";

export function WardAcceptedReferralPlacement({
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
  // Starting the journey raises it for the source ED, so a desk scoped to its own ward(s) only is refused
  // by the engine. Send that desk to the coordinator instead of offering a button that cannot succeed.
  const deskInScope = useDeskInScope();
  const [placementDraft, setPlacementDraft] = useState<{
    referralId: string;
    legalStatus: string;
    legalFormCode: string;
    specialling: boolean;
  } | null>(null);
  // Acceptance is a decision only. Starting its separate journey consumes no bed.
  const acceptedToStart = inboxEntries
    .filter(
      (entry) =>
        entry.state === "accepted" &&
        entry.withdrawnAt === undefined &&
        entry.source === "ed_medical" &&
        !movements.some(
          (movement) => movement.referralId === entry.id && movement.closure?.outcome !== "did_not_proceed",
        ),
    )
    .flatMap((entry) => {
      const ed = allEmergencyDepartments().find((place) => place.siteCode === entry.originSiteCode);
      return entry.ageBand && ed ? [{ entry, cohort: entry.ageBand, ed }] : [];
    });
  function startAcceptedPlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!placementDraft) return;
    const current = acceptedToStart.find(({ entry }) => entry.id === placementDraft.referralId);
    const legalStatus = LEGAL_STATUS_OPTIONS.find((status) => status === placementDraft.legalStatus);
    if (!current || !legalStatus || !placementDraft.legalFormCode) return;
    const { entry, cohort, ed } = current;
    completeCommand(
      `start:${entry.id}`,
      () =>
        raise("RAISE_REFERRAL", {
          edId: ed.id,
          referralId: entry.id,
          acceptedUnitId: unitId,
          actingUnitId: unitId,
          draft: {
            cohort,
            security: entry.destination.secureBedNeeded ? "Secure" : "Open",
            sex: entry.destination.sex,
            gender: entry.destination.gender,
            highAcuity: entry.destination.highAcuityNursingNeeded === true,
            specialling: placementDraft.specialling,
            legalStatus,
            legalFormCode: placementDraft.legalFormCode === "none" ? null : placementDraft.legalFormCode,
            urgency: entry.urgency,
            atsCategory: entry.atsCategory,
          },
        }),
      (outcome) => {
        const failure = wardCommandFailure(outcome);
        onMessage(failure ?? "Placement started. Open Ward flow, Admissions, then choose Pull a bed.");
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
      <p className={styles.cardMeta}>Start the accepted journey, then hold a bed. Starting does not reserve a bed.</p>
      {acceptedToStart.map(({ entry, ed }) => (
        <div key={entry.id}>
          <p>{resolvePatientIdentity(entry).displayName}</p>
          {placementDraft?.referralId === entry.id ? (
            <form onSubmit={startAcceptedPlacement}>
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
                <input
                  type="checkbox"
                  checked={placementDraft.specialling}
                  onChange={(event) => setPlacementDraft({ ...placementDraft, specialling: event.target.checked })}
                />
                Specialling needed
              </label>
              <button
                type="submit"
                className={styles.btnActionSec}
                disabled={!placementDraft.legalStatus || !placementDraft.legalFormCode}
              >
                Confirm and start placement
              </button>
              <button type="button" className={styles.btnActionSec} onClick={() => setPlacementDraft(null)}>
                Cancel
              </button>
            </form>
          ) : deskInScope && !deskInScope(ed.id) ? (
            <p className={styles.cardMeta} data-testid="ward-accepted-placement-coordinator">
              This desk cannot start a placement from {ed.name}. Ask the flow coordinator to start it.
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
                  specialling: false,
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
