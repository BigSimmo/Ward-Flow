"use client";

import { useState } from "react";
import Link from "next/link";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen, referralForMovement, stageCopy } from "@/components/ward-management/ward-derivations";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { patientDisplayName, type Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import {
  URGENT_MARK_REASONS,
  changeReasonLabels,
  type UrgentMarkReason,
} from "@/components/ward-management/ward-change-reasons";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";

import styles from "./movements.module.css";

/**
 * Review fix-forward item 10 (2026-09-17): the same accessible-reason discipline
 * `ward-management-console.tsx`'s own `URGENT_FLAG_UNCHOSEN` already holds to — an `aria-disabled`
 * button with no further explanation tells an assistive-technology reader the button exists and
 * nothing about why it does not respond, the same shape `CANCEL_TRANSPORT_UNCHOSEN` fixed on the
 * console page first.
 */
const URGENT_FLAG_UNCHOSEN = "Choose why this patient is being flagged urgent first.";

/**
 * **TASK M6 — the per-movement detail drawer.**
 *
 * **SIX of the drawing's seven sections ship here.** *Watch and flag* is still held: nothing in this
 * model records that somebody is watching a movement, so the section has no state to read. 🔴 **It
 * is not stubbed** — a section heading over nothing reads as a category that exists and happens to
 * be empty, which is the opposite of what is true. **It is named in the footer instead, so a reader
 * comparing this against the drawing does not have to guess whether it was dropped, forgotten, or
 * refused.**
 *
 * **M7 ships *What you can do*, and it carries ONE action out of the drawing's four — OWNER RULING
 * 2026-09-12.** He accepted the recommendation on all three that had one:
 *
 *   - ✅ **Flag as urgent** — built below. The field, the event and the ranking rule already existed.
 *   - ❌ **Chase the ward** — declined. It is probably the same act as escalating, in softer words,
 *     and two controls for one act teach a coordinator that one of them does something else.
 *   - ❌ **Add to a shortlist** — declined. A stored list can disagree with the derived one the
 *     engine trusts, and then a coordinator is holding two answers to the same question.
 *   - ❌ **Record an override** — DECLINED, and it needed a second round to get there. The owner's
 *     blanket "yes to all your recommendations" covered the three above, which were recommendations;
 *     **this one was a QUESTION back to him, and a yes does not answer a question.** It was put to
 *     him again on its own and he ruled *"drop it as you recommend"*, 2026-09-12.
 *
 *     🔴 **The reason, because it is the part that could change — and it was stated WRONG first
 *     time.** This said an override is attached to *a placement*. **There is no placement in this
 *     model.** `Override` hangs off a `Movement`, and its keyed field is `unitIds` — the model's own
 *     words, *"the units referred to despite a failing gate — THE PARTIES OVERRIDDEN"*. **So an
 *     override records a REFERRAL made against a failing gate, and names the wards it was made to.**
 *     ⚠️ **Corrected after an adversarial review, which is the right outcome for a reason stated as
 *     "the part that can change": it is the part that most needs to be right.**
 *
 *     **The conclusion survives the correction intact** — a standalone control still has nothing to
 *     attach to. It would record that somebody overrode something, without the something. ⚠️ **And this system cannot yet say WHICH
 *     check was overridden even when one happens properly** — the Alerts screen renders that gap by
 *     name. A way to create overrides pointing at nothing would widen it.
 *
 *     ✅ **So this is worth revisiting on one trigger and no other: the day an override records the
 *     gate it overrode.** Until then the answer stays no.
 *
 * ⚠️ **THE DRAWER DOES NOT REPLACE THE WORKSPACE ROUTE, IT LINKS TO IT** (Q-4). The row keeps its
 * existing "Review patient" link unchanged; this is a second, faster face on the same record. **The
 * urgent flag is now the one thing it can change** — it was true until M7 that this drawer recorded
 * nothing at all, and that sentence has been removed from the footer rather than left to age.
 */

/**
 * 🔴 **THE PERSON SECTION NAMES THE PATIENT — OWNER RULING O-16.3, 2026-09-11: *"Yes show the
 * patient name."*** **It did not, until he ruled.**
 *
 * **What happened, because the sequence is the point:** the drawer originally read
 * `Referral.patientId` and `tests/ward-patient-link-default-deny.test.ts` refused it — *"a ward
 * learning where else a patient has been is exactly what this guard exists to stop. Hand this back
 * to Ward Lead rather than deciding it is fine and widening the allowlist yourself."* ✅ **The read
 * was removed, the conflict was put to the owner, and he decided.** 🔴 **The allowlist entry exists
 * because he overruled the recommendation to keep it denied — not because the guard was found
 * inconvenient.**
 *
 * **So ruling ② — a coordinator sees who the patient is wherever they are SELECTING or ACTING ON
 * that person — wins over D-14's default-deny ON THIS SCREEN, and on no other by implication.**
 *
 * ⚠️ **THE GRANULARITY IS THE BOUND THAT KEEPS THIS COMPATIBLE WITH FD-23:** one movement's OWN
 * linked referral and the person it names. **Never a list of a person's referrals, never where else
 * they have been referred, never a count.** FD-23 protects disclosure of WHERE; this discloses no
 * place, no ward and no other episode.
 *
 * 🔴 **AND THIS IS NOT GRANDFATHERED PAST THE SEED. EVERY PATIENT IN THIS APP TODAY IS INVENTED.**
 * ⚠️ **The moment real data reaches it, rendering a name on a coordinator's board is a live privacy
 * decision that needs its own review. This ruling was made about synthetic data and says nothing
 * about real data.** **It will stop being obvious that these are not real people, and this comment
 * is where somebody should find that out.**
 *
 * **The three absences stay, and they are still three different facts.** A movement with no
 * referral, a referral that names nobody, and a referral naming somebody this system does not hold
 * are not the same situation, and a coordinator can act on the difference. **None is a blank and
 * none is the word "unknown".**
 *
 * ⚠️ **Measured on this seed: 24 referrals, 2 carrying a `patientId`, 2 movements carrying a
 * `referralId`, 0 reaching a person** — the two linked referrals are not the two pointed at. **So
 * the NAMED branch is unreachable from the seed and is tested with a hand-built fixture;
 * `RAISE_REFERRAL` links one raised live, so it is unreachable-from-the-seed, not dead.**
 */
export function personLine(movement: Movement, referrals: Referral[], patients: readonly Patient[]): string {
  const referral = referralForMovement(movement, referrals);
  if (referral === undefined) {
    return "No referral is recorded against this movement, so there is no person to name.";
  }
  if (referral.patientId === undefined) {
    return `Referral ${referral.id} raised this movement and names no person, so nobody can be identified from it.`;
  }
  const patient = patients.find((candidate) => candidate.id === referral.patientId);
  if (patient === undefined) {
    return `Referral ${referral.id} names ${referral.patientId}, and this system holds no record under that.`;
  }
  return patient.umrn ? `${patientDisplayName(patient)} · UMRN: ${patient.umrn}` : patientDisplayName(patient);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.drawerSection}>
      <h3 className={styles.drawerSectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

export function MovementDrawer({
  movement,
  now,
  units,
  referrals,
  patients,
  dispatch,
  onClose,
}: {
  movement: Movement | undefined;
  now: Instant;
  /** Threaded from the screen for the same reason `units` is — one provider reader per screen. */
  referrals: Referral[];
  patients: readonly Patient[];
  /**
   * The LIVE units, threaded from the screen rather than read from the fixture here.
   *
   * The one-source-of-truth guard reddened on this file the moment M6 met the fold. It was right
   * to: `unitById` reads the module fixture, and a drawer that names a ward from the fixture while
   * the board behind it names the same ward from reducer state will disagree with itself the first
   * time a unit changes - with every other gate green, because both calls return a `Unit`.
   *
   * Threaded as a prop rather than pulled with `useWardFlow` here, matching `TransportRow` on the
   * screen that owns this drawer: the parent already holds the live array, and one reader of the
   * provider per screen keeps the source obvious.
   */
  units: Unit[];
  /**
   * Threaded from the screen for the same reason `units` and `referrals` are — one provider reader
   * per screen, so the thing this drawer writes to is visibly the same store the board behind it
   * reads from.
   */
  dispatch: (event: WardFlowEvent) => void;
  onClose: () => void;
}) {
  // Item 37 (2026-09-17): the flag now needs a reason chosen from URGENT_MARK_REASONS, same
  // draft-until-dispatched discipline as every other reason picker in this codebase. Declared
  // before the early return below so hook order never depends on whether `movement` resolves.
  const [urgentFlagReason, setUrgentFlagReason] = useState<UrgentMarkReason | undefined>(undefined);

  if (movement === undefined) return null;

  const open = isOpen(movement);
  const originEd = edById(movement.originEdId);
  const accepted =
    movement.acceptedUnitId === undefined
      ? undefined
      : units.find((candidate) => candidate.id === movement.acceptedUnitId);

  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  const subjectPatient = resolveSubjectPatient(movement, { patients, referrals });

  return (
    <Sheet open onClose={onClose} title={`${subjectPatient.formalName} — what is recorded`}>
      <Section title="Person">
        <p className={styles.drawerLine}>{personLine(movement, referrals, patients)}</p>
        <ul className={styles.drawerList}>
          <li>Sex recorded as {movement.sex}</li>
          <li>
            {movement.cohort} · {movement.security === "Secure" ? "needs a locked bed" : "open ward"}
          </li>
          <li>Urgency {movement.urgency} of 3</li>
          <li>Owned by {movement.owner}</li>
        </ul>
        <p className={styles.drawerAbsent}>
          Every person in this prototype is invented. Nobody named here is a real patient.
        </p>
      </Section>

      <Section title="Journey">
        <p className={styles.drawerLine}>
          {stageCopy[movement.stage].label} · opened {formatInstantWithDay(movement.openedAt, now)} · from{" "}
          {departmentLabel(movement.originEdId, originEd?.name)}
        </p>
        {movement.stageChanges.length === 0 ? (
          <p className={styles.drawerAbsent}>
            No stage change has been recorded, so this movement has not moved since it opened.
          </p>
        ) : (
          <ul className={styles.drawerList}>
            {movement.stageChanges.map((change) => (
              <li key={`${change.at} ${change.to}`}>
                {change.from === undefined ? "Opened" : stageCopy[change.from].label} → {stageCopy[change.to].label} ·{" "}
                {formatInstantWithDay(change.at, now)} · {change.by}
                {change.reason === undefined ? "" : ` · ${change.reason}`}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/*
        ⚠️ **ASKED, ACCEPTED and REFUSED are three states and a coordinator acts on the difference.**
        Collapsing them into one "wards involved" list would lose the only fact that matters —
        whether anybody said no, and why. `referredUnitIds` names who was asked at all; `declines`
        names who answered and with what reason.
      */}
      <Section title="Which wards were asked">
        {movement.referredUnitIds.length === 0 ? (
          <p className={styles.drawerAbsent}>No ward has been asked yet.</p>
        ) : (
          <ul className={styles.drawerList}>
            {movement.referredUnitIds.map((unitId) => {
              const unit = units.find((candidate) => candidate.id === unitId);
              const decline = movement.declines.find((entry) => entry.unitId === unitId);
              return (
                <li key={unitId}>
                  {wardLabel(unitId, unit?.name)}
                  {movement.acceptedUnitId === unitId
                    ? " · accepted"
                    : decline
                      ? ` · refused — ${decline.reason}`
                      : " · no answer yet"}
                </li>
              );
            })}
          </ul>
        )}
        {accepted === undefined ? null : (
          <p className={styles.drawerLine}>
            Accepted destination: {accepted.name}{" "}
            <Link
              href={`/mockups/ward-flow/board/${accepted.id}`}
              className={styles.jumpToWardLink}
              title={`Open ${accepted.name} Bed Board`}
            >
              Open on Ward Board →
            </Link>
          </p>
        )}
      </Section>

      <Section title="Escalation">
        {movement.escalation === undefined ? (
          <p className={styles.drawerAbsent}>
            Nothing has been escalated on this movement. That is a record, not a gap.
          </p>
        ) : (
          <p className={styles.drawerLine}>
            Escalated to {movement.escalation.contact} on {formatInstantWithDay(movement.escalation.at, now)}, after{" "}
            {movement.escalation.triedUnitIds.length}{" "}
            {movement.escalation.triedUnitIds.length === 1 ? "ward was" : "wards were"} tried.
          </p>
        )}
      </Section>

      <Section title="Transport leg">
        {movement.transport === undefined ? (
          <p className={styles.drawerAbsent}>
            No transport leg has been booked, so there is nothing to say about a vehicle.
          </p>
        ) : (
          <p className={styles.drawerLine}>
            {movement.transport.provider}
            {movement.transport.escortRequired ? " · escort required" : ""}
            {movement.transport.formRequired ? " · a form is required" : ""}
            {movement.transport.acceptedAt === undefined
              ? ""
              : ` · accepted ${formatInstantWithDay(movement.transport.acceptedAt, now)}`}
          </p>
        )}
        {movement.legalForm === undefined ? null : (
          <p className={styles.drawerLine}>Legal authority: {legalFormName(movement.legalForm)}</p>
        )}
      </Section>

      {/*
        **WHAT YOU CAN DO — M7, and it is one action rather than four.**

        🔴 **THE STATE IS SAID IN WORDS, NEVER LEFT TO THE BUTTON'S LABEL.** There is no urgent badge
        in this drawer — the badge lives on the coordinator queue — so a reader here has only this
        sentence to tell them that a flagged patient outranks every tier, including tier 1. A button
        reading "Remove the urgent flag" is not a statement that the patient currently leads the
        queue; it is an instruction, and the two are not the same thing to somebody scanning.

        ⚠️ **A CLOSED MOVEMENT IS OFF THE QUEUE ENTIRELY**, so the reducer refuses to flag one. The
        control is not silently hidden and the refusal is not discovered by pressing: the sentence
        says the flag would order nothing, and the button is only withheld in the one case where it
        could do nothing at all (closed AND unflagged). Clearing an existing flag stays available on
        a closed movement — the reducer permits it, and a flag nobody can remove is the permanent
        state this pair exists to prevent.

        ⚠️ **A REASON IS NOW ASKED FOR, on raising the flag only — item 37, 2026-09-17.** Chosen
        from `URGENT_MARK_REASONS`, the same fixed list the console's own control offers. Clearing
        still asks for nothing: taking a flag back down cannot promote anybody.
      */}
      <Section title="What you can do">
        <p className={styles.drawerLine}>
          {movement.flaggedUrgent
            ? open
              ? "Flagged urgent. This patient leads the queue ahead of every urgency tier, including tier 1."
              : "Flagged urgent. This movement is no longer in the queue, so the flag orders nothing now — removing it changes only the record."
            : open
              ? "Not flagged. This patient is ordered by urgency tier and waiting time, like everybody else."
              : "Not flagged — and this movement is no longer running, so it is not in the queue at all. Flagging it would change nothing."}
        </p>
        {!open && !movement.flaggedUrgent ? null : movement.flaggedUrgent ? (
          <button
            type="button"
            className={styles.action}
            data-testid="ward-movement-drawer-urgent-toggle"
            onClick={() =>
              dispatch({
                /* Dispatched as the coordinator because this is the statewide movements board. The
                   event also permits `ed`, so a referring department can flag from its own screen —
                   that control is not this one and must not be implied by it. */
                type: "CLEAR_MOVEMENT_URGENT_FLAG",
                role: "coordinator",
                now,
                movementId: movement.id,
              })
            }
          >
            Remove the urgent flag
          </button>
        ) : (
          <div className={styles.drawerReasonRow}>
            <label className={styles.drawerReasonLabel} htmlFor="ward-movement-drawer-urgent-reason">
              Why is this urgent?
            </label>
            <select
              id="ward-movement-drawer-urgent-reason"
              className={styles.drawerReasonSelect}
              data-testid="ward-movement-drawer-urgent-reason"
              value={urgentFlagReason ?? ""}
              onChange={(chosen) => {
                const value = chosen.target.value;
                setUrgentFlagReason(
                  URGENT_MARK_REASONS.includes(value as UrgentMarkReason) ? (value as UrgentMarkReason) : undefined,
                );
              }}
            >
              <option value="">Choose a reason…</option>
              {URGENT_MARK_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {changeReasonLabels[reason]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.action}
              data-testid="ward-movement-drawer-urgent-toggle"
              aria-disabled={urgentFlagReason === undefined ? "true" : undefined}
              aria-describedby={urgentFlagReason === undefined ? "ward-movement-drawer-urgent-blocked" : undefined}
              title={urgentFlagReason === undefined ? URGENT_FLAG_UNCHOSEN : undefined}
              onClick={
                urgentFlagReason === undefined
                  ? ignoreUnavailableActivation
                  : () => {
                      dispatch({
                        /* Dispatched as the coordinator, for the reason given above. */
                        type: "FLAG_MOVEMENT_URGENT",
                        role: "coordinator",
                        now,
                        movementId: movement.id,
                        reason: urgentFlagReason,
                      });
                      setUrgentFlagReason(undefined);
                    }
              }
            >
              Flag this patient as urgent
            </button>
            {urgentFlagReason === undefined ? (
              <span id="ward-movement-drawer-urgent-blocked" className="sr-only">
                {URGENT_FLAG_UNCHOSEN}
              </span>
            ) : null}
          </div>
        )}
        <p className={styles.drawerAbsent}>
          This is the only thing this drawer changes. Everything else about this movement is done in the full workspace.
        </p>
      </Section>

      <p className={styles.drawerFoot}>
        <strong>One section the drawing carries is not built</strong> — <em>Watch and flag</em>. Nothing in this system
        records that somebody is watching a movement, so there is no state for it to show;{" "}
        <Link className={styles.action} href={`/mockups/ward-flow/movements/${movement.id}`}>
          the full workspace
        </Link>{" "}
        is where this movement is worked on.
      </p>
    </Sheet>
  );
}
