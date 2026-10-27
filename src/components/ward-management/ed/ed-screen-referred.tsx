"use client";

// "Referred": the patients this department referred onward who are still here, and its recently
// answered referrals. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { useState } from "react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { Dialog } from "@/components/wf";
import { formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import type { ReferralGender } from "@/components/ward-management/ward-model";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { referralPurposeLabel } from "@/components/ward-management/ward-referrals";
import {
  arrivalEtaLabel,
  arrivalModeLabel,
  canSetArrivalPlan,
  isArrivalLate,
} from "@/components/ward-management/referrals/arrival-time-modal";
import type { EdScreenContext } from "./ed-screen-context";
import { ANSWERED_VISIBLE_CAP, answeredAddressingLabel, GENDER_OPTIONS, urgencyGlyph } from "./ed-screen-model";
import { edStageLabel } from "./ed-referral-status";
import styles from "./ed.module.css";

export function EdReferredPanel({ ctx }: { ctx: EdScreenContext }) {
  const {
    now,
    department,
    raise,
    movements,
    units,
    referrals,
    registryPatients,
    departmentListTab,
    setArrivalPlanOpenFor,
    genderRecordDraft,
    setGenderRecordDraft,
    outbox,
    answeredAll,
    answered,
  } = ctx;
  // Audit 24-7 (CT-07): releasing a diverted journey's bed ends the journey, so it asks first,
  // naming the person and the ward holding the bed.
  const [releaseDivertedId, setReleaseDivertedId] = useState<string | null>(null);
  const releaseDiverted = outbox.find((movement) => movement.id === releaseDivertedId);
  const releaseDivertedPatient = releaseDiverted
    ? resolveSubjectPatient(releaseDiverted, { patients: registryPatients, referrals, movements })
    : undefined;
  const releaseDivertedUnit = releaseDiverted
    ? units.find((unit) => unit.id === releaseDiverted.acceptedUnitId)
    : undefined;
  /*
   * RECENTLY ANSWERED — owner ruling 7, 2026-09-01. Directly beneath the inbox because it is
   * the same clinician's own question a moment later: "what did I just decide, and why?" The
   * row a clinician just declined has already left the inbox above — that list is a worklist
   * — so without this section there is no undo, no record on this screen, and nothing to
   * check a mistake against.
   *
   * ⚠️ **`data-testid` VALUES ARE `ward-ed-answered-*`, NEVER `ward-ed-inbox-*`.** Two tests
   * in this suite assert an answered row DISAPPEARS from `ward-ed-inbox-row-<id>` — that is
   * "the only success signal on screen" for a decline, per their own comments — and
   * `getAllByTestId(/^ward-ed-inbox-row-/)` would silently grow to include this section's
   * rows too. Reusing the inbox's prefix here would turn both green tests red BECAUSE this
   * feature works; the distinct prefix is what keeps them passing while proving something new.
   *
   * Same structure and classes as the inbox section above, on purpose — a coordinator moving
   * between the two should not have to learn a second layout.
   */
  return (
    <section
      id="ward-ed-outbox-panel"
      role="tabpanel"
      aria-labelledby="ward-ed-referred-tab"
      hidden={departmentListTab !== "referred"}
      aria-label="Referred · Still to be moved"
      className={styles.lstWrap}
      tabIndex={0}
    >
      <div className={styles.referredSubSection} data-testid="ward-ed-outbox">
        <h2 className={styles.sectionHeading}>
          Still to be moved &middot; {outbox.length} patient{outbox.length === 1 ? "" : "s"}
        </h2>
        <p className={styles.unitMeta}>
          Patients referred onward who remain in {department.name}. Bed acceptance does not remove them; elapsed
          movement time starts at recorded acceptance.
        </p>
        {outbox.length === 0 ? (
          <p className={styles.placeholder} data-testid="ward-ed-outbox-empty">
            No patient here is waiting to be moved onward.
          </p>
        ) : (
          <ul className={styles.cardList}>
            {outbox.map((movement) => {
              // Resolved from the live `units`, never `unitById` — whole-branch review Critical 1,
              // the same correction the patients section below already carries.
              const acceptedUnit = units.find((unit) => unit.id === movement.acceptedUnitId);
              // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
              const patientInfo = resolveSubjectPatient(movement, {
                patients: registryPatients,
                referrals,
                movements,
              });
              return (
                <li
                  key={movement.id}
                  className={styles.card}
                  data-testid={`ward-ed-outbox-row-${movement.id}`}
                  data-stage={movement.stage}
                >
                  <header className={styles.cardHeader}>
                    <strong>{patientInfo.formalName}</strong>
                    <span className={styles.cardMeta}>{edStageLabel(movement.stage)}</span>
                    {/*
                     * THE URGENCY TIER, BESIDE THE STAGE, ON EVERY ROW — owner ruling, 2026-08-31.
                     *
                     * ⚠️ **UNCONDITIONAL, TIER 3 INCLUDED.** Showing it only on tiers 1 and 2 would
                     * make its ABSENCE the signal for tier 3, and this project has repeatedly proved
                     * that nobody reads an absence. Same position on every card, whatever the tier.
                     *
                     * `urgencyTierLabel`, never a second spelling: the boards, the pickers and this
                     * row must all say "Tier 3 · least urgent" in the same words.
                     *
                     * Neutral tone for all three tiers by design — see `.tierLabel` in ed.module.css.
                     */}
                    <span
                      className={styles.tierLabel}
                      data-testid={`ward-ed-outbox-tier-${movement.id}`}
                      data-urgency={movement.urgency}
                    >
                      <span className={styles.urgencyGlyph} aria-hidden="true">
                        {urgencyGlyph(movement.urgency)}
                      </span>{" "}
                      {urgencyTierLabel(movement.urgency)}
                    </span>
                  </header>
                  <p className={styles.cardMeta}>
                    {movement.cohort} &middot; {movement.security} &middot; {movement.sex} &middot;{" "}
                    {movement.legalStatus}
                  </p>
                  <div className={styles.outstandingItem}>
                    <span className={styles.outstandingLabel}>Going to</span>
                    {/* The unit's own name, or an honest statement that this state cannot name
                            one — never a substituted unit and never a bare id. */}
                    <span>{acceptedUnit ? acceptedUnit.name : "Accepted unit not resolved"}</span>
                  </div>
                  {movement.transport?.diversion !== undefined && movement.admissionId !== undefined ? (
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        data-testid={`ward-ed-release-diverted-bed-${movement.id}`}
                        className={styles.declineButton}
                        onClick={() => setReleaseDivertedId(movement.id)}
                      >
                        Release the pulled bed
                      </button>
                    </div>
                  ) : null}
                  {/*
                   * ⚠️ **NOT A REFERRAL CLOCK, AND `referralClocks` MUST NEVER BE REACHED FOR
                   * HERE.** This row is a `Movement`; `triagedAt` lives on a `Referral` and
                   * nothing joins the two. What a move being owed is counted from is
                   * `acceptedAt`, which `ACCEPT_IN_PRINCIPLE` writes (and, since v10 pass 3,
                   * the seed's synthetic `withDemoStageTimes`); a row without one still states
                   * the absence, and only the absence, in the same register the rest of the
                   * board uses for a fact it does not hold. Substituting
                   * `openedAt` here would answer a different question (how long they have been
                   * in the department) under this label, and read as plausible while doing it.
                   */}
                  <div className={styles.outstandingItem}>
                    <span className={styles.outstandingLabel}>Waiting to move</span>
                    <span>
                      {movement.acceptedAt === undefined
                        ? "Acceptance time not recorded"
                        : `${splitDuration(Math.max(now - movement.acceptedAt, 0))} since accepted`}
                    </span>
                  </div>
                  <div className={styles.outstandingItem}>
                    <span className={styles.outstandingLabel}>Gender</span>
                    <span data-testid={`ward-ed-gender-${movement.id}`}>{movement.gender ?? "Not yet recorded"}</span>
                  </div>
                  {movement.transportNeed?.needed === false ? (
                    <div className={styles.outstandingItem} data-testid={`ward-ed-outbox-no-transport-${movement.id}`}>
                      No transport needed
                    </div>
                  ) : null}
                  {movement.arrivalDetails ? (
                    <div className={styles.outstandingItem} data-testid={`ward-ed-outbox-arrival-plan-${movement.id}`}>
                      <span className={styles.outstandingLabel}>Arrival plan</span>
                      <span>
                        {arrivalModeLabel(movement.arrivalDetails.mode)} · ward{" "}
                        {arrivalEtaLabel(movement.arrivalDetails.estimatedArrivalAt, now)}
                        {movement.arrivalDetails.trackingNumber ? ` · ${movement.arrivalDetails.trackingNumber}` : ""}
                      </span>
                    </div>
                  ) : null}
                  {isArrivalLate(movement, now) ? (
                    <div
                      className={styles.arrivalLate}
                      role="status"
                      data-testid={`ward-ed-outbox-arrival-late-${movement.id}`}
                    >
                      Arrival late — more than {LATE_ARRIVAL_GRACE_MINUTES} minutes past the estimated ward time. Not
                      marked arrived.
                    </div>
                  ) : null}
                  {canSetArrivalPlan(movement) ? (
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        data-testid={`ward-ed-outbox-arrival-plan-toggle-${movement.id}`}
                        className={styles.acceptButton}
                        onClick={() => setArrivalPlanOpenFor(movement.id)}
                      >
                        {movement.arrivalDetails ? "Edit arrival plan" : "Set arrival plan"}
                      </button>
                    </div>
                  ) : null}
                  {movement.referralAbsence?.reason === "none_raised" ? (
                    <div className={styles.outstandingItem} data-testid={`ward-ed-outbox-no-referral-${movement.id}`}>
                      No referral raised
                    </div>
                  ) : null}
                  {!movement.closure && (
                    <div className={styles.tableActionGroup}>
                      <select
                        data-testid={`ward-ed-record-gender-${movement.id}`}
                        aria-label={`Record gender for ${patientInfo.displayName}`}
                        value={genderRecordDraft[movement.id] ?? ""}
                        onChange={({ target: { value } }) =>
                          setGenderRecordDraft((current) => ({
                            ...current,
                            [movement.id]: value as ReferralGender | "",
                          }))
                        }
                      >
                        <option value="">Choose…</option>
                        {GENDER_OPTIONS.map((gender) => (
                          <option key={gender} value={gender}>
                            {gender}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        data-testid={`ward-ed-record-gender-submit-${movement.id}`}
                        className={styles.acceptButton}
                        aria-disabled={
                          !genderRecordDraft[movement.id] || genderRecordDraft[movement.id] === movement.gender
                            ? "true"
                            : undefined
                        }
                        aria-describedby={
                          !genderRecordDraft[movement.id] || genderRecordDraft[movement.id] === movement.gender
                            ? `ward-ed-record-gender-reason-${movement.id}`
                            : undefined
                        }
                        title={
                          !genderRecordDraft[movement.id] || genderRecordDraft[movement.id] === movement.gender
                            ? "Choose a new gender value to record first."
                            : undefined
                        }
                        onClick={(event) => {
                          const gender = genderRecordDraft[movement.id];
                          if (!gender || gender === movement.gender) {
                            ignoreUnavailableActivation(event);
                            return;
                          }
                          raise("RECORD_MOVEMENT_GENDER", {
                            movementId: movement.id,
                            gender,
                          });
                          setGenderRecordDraft((current) => ({ ...current, [movement.id]: "" }));
                        }}
                      >
                        Record gender
                      </button>
                      {!genderRecordDraft[movement.id] || genderRecordDraft[movement.id] === movement.gender ? (
                        <span id={`ward-ed-record-gender-reason-${movement.id}`} className="sr-only">
                          Choose a new gender value to record first.
                        </span>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/*
       * RECENT DECISIONS (ANSWERED REFERRALS)
       *
       * ⚠️ **`data-testid` VALUES ARE `ward-ed-answered-*`, NEVER `ward-ed-inbox-*`.** Two tests
       * look for those rows: one asserts an answered row is here, and the other asserts an
       * answered row is NOT in the inbox. Both are `referral-row` tests; both match `WF-`
       * rows too. Reusing the inbox's prefix here would turn both green tests red BECAUSE this
       * feature works; the distinct prefix is what keeps them passing while proving something new.
       */}
      <div className={styles.referredSubSection} data-testid="ward-ed-answered">
        <h2 className={styles.sectionHeading}>
          Recent &middot;{" "}
          {answeredAll.length > ANSWERED_VISIBLE_CAP
            ? `${answered.length} of ${answeredAll.length}`
            : answeredAll.length}{" "}
          referral{answeredAll.length === 1 ? "" : "s"}
        </h2>
        <p className={styles.unitMeta}>
          Accepted, declined or cancelled referrals, most recently decided first. Shows the latest{" "}
          {ANSWERED_VISIBLE_CAP}; the heading counts all.
        </p>
        {answeredAll.length === 0 ? (
          <p className={styles.placeholder} data-testid="ward-ed-answered-empty">
            Nothing addressed to psychiatry at {department.name} has been answered yet.
          </p>
        ) : (
          <ul className={styles.cardList}>
            {answered.map(({ referral, addressing, destination }) => (
              <li
                key={`${referral.id}-${destination.edId}-${destination.purpose}`}
                className={styles.card}
                data-testid={`ward-ed-answered-row-${referral.id}`}
                data-purpose={destination.purpose}
                data-ed-id={destination.edId}
                data-state={addressing.state}
              >
                <header className={styles.cardHeader}>
                  <strong>
                    {patientIdentityLine(
                      resolveSubjectPatient(referral, { patients: registryPatients, referrals, movements }),
                    )}
                  </strong>
                  <span className={styles.cardMeta} data-testid={`ward-ed-answered-purpose-${referral.id}`}>
                    {referralPurposeLabel(destination.purpose)}
                  </span>
                </header>
                <p className={styles.referralState} data-testid={`ward-ed-answered-state-${referral.id}`}>
                  {answeredAddressingLabel(addressing)}
                </p>
                {addressing.decidedAt !== undefined ? (
                  <p className={styles.cardMeta} data-testid={`ward-ed-answered-decided-${referral.id}`}>
                    Decided {formatInstantWithDay(addressing.decidedAt, now)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog
        open={releaseDiverted !== undefined}
        onClose={() => setReleaseDivertedId(null)}
        size="sm"
        title="Release pulled bed?"
        description={`The bed pulled at ${releaseDivertedUnit?.name ?? "the accepting ward"} for ${releaseDivertedPatient?.formalName ?? "this patient"} is offered again and the diverted journey is closed. This cannot be undone.`}
        secondary={[{ label: "Cancel", onAction: () => setReleaseDivertedId(null) }]}
        primary={{
          label: "Release pulled bed",
          onAction: () => {
            setReleaseDivertedId(null);
            if (!releaseDiverted) return;
            raise("RELEASE_DIVERTED_BED", { movementId: releaseDiverted.id });
          },
        }}
        data-testid="ward-ed-release-diverted-confirm"
      >
        {releaseDivertedPatient ? (
          <p data-testid="ward-ed-release-diverted-identity">Check: {patientIdentityLine(releaseDivertedPatient)}</p>
        ) : null}
      </Dialog>
    </section>
  );
}
