"use client";

import { useId, useState, type Dispatch } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS, type Referral } from "@/components/ward-management/ward-model";
import { referralSentByDesk, routeSentKind } from "@/components/ward-management/ward-referral-sender";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import styles from "./referrals.module.css";

/**
 * RB7, build plan item 27 (2026-09-17). Shows the referrer's own written history unchanged, every
 * correction added on top of it since — each its own attributed, timestamped entry, never a
 * rewrite of the history above it — and a control to add one. See `Referral.corrections`'s own doc
 * comment (`ward-model.ts`) for why the two are held structurally apart, and
 * `tests/ward-referral-history-immutable.test.ts` for the reducer-level proof that
 * `ADD_REFERRAL_CORRECTION` never touches `history`.
 *
 * D-80: dispatches as the route desk, and offers the control only to the desk that sent the
 * referral (`referralSentByDesk`, the rule the server's write check uses), so a ward answering a
 * referral never adds a correction to it. The coordinator acts for every sender.
 *
 * Owns its own hooks (the draft note), independent of `ReferralMatchView`'s own strict hook order,
 * so it can be called from any of that component's three return branches without disturbing it.
 */
export function ReferralHistoryAndCorrections({
  referral,
  now,
}: {
  referral: Referral;
  now: Instant;
  /** Unused since D-80: the panel raises as the route desk. Kept so its mount sites stay as they are. */
  dispatch?: Dispatch<WardFlowEvent>;
}) {
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole);
  const access = useEffectiveWardAccess();
  const { units } = useWardFlowSelect("units");
  const sent =
    routeSentKind(routeRole, referral.source) && referralSentByDesk(referral, access, wardPlaceLookup(units));
  const [note, setNote] = useState("");
  const noteId = useId();
  const trimmedNote = note.trim();

  /**
   * ⚠️ NO REJECTION PATH REACHES THIS BUTTON. `ADD_REFERRAL_CORRECTION` refuses only a blank note
   * (guarded by `aria-disabled` below, the same belt-and-braces discipline `handleDecline` already
   * uses for its own guard), an over-limit note (prevented outright — `maxLength` on the textarea
   * makes typing past `REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS` impossible), or an unknown referral (this
   * component is only ever mounted on a referral that already exists). So a guarded dispatch here
   * always succeeds, and the draft is cleared unconditionally rather than built on the
   * rejection-tracking machinery `handleAccept`/`handleDecline` need for genuinely refusable acts.
   */
  function handleAddCorrection() {
    if (trimmedNote.length === 0) return;
    raise("ADD_REFERRAL_CORRECTION", { referralId: referral.id, note });
    setNote("");
  }

  return (
    <section className={styles.historyCorrectionsSection} data-testid="ward-referral-history-and-corrections">
      <div className={styles.historyCard}>
        <h3 className={styles.historySectionHeading}>Written history</h3>
        <div className={styles.historyTextContainer}>
          <p data-testid="ward-referral-history-text" className={styles.historyText}>
            {referral.history === "" ? "Not written yet." : referral.history}
          </p>
        </div>
      </div>

      <div className={styles.correctionsCard}>
        <h3 className={styles.historySectionHeading}>Corrections</h3>
        {referral.corrections === undefined || referral.corrections.length === 0 ? (
          <p data-testid="ward-referral-corrections-empty" className={styles.correctionsEmpty}>
            No corrections have been added.
          </p>
        ) : (
          <ul data-testid="ward-referral-corrections-list" className={styles.correctionsList}>
            {referral.corrections.map((correction, index) => (
              // Index key: corrections are append-only and never reordered or removed (see the type's
              // own doc comment), so position is a stable identity for this read-only list.
              <li key={index} className={styles.correctionItem}>
                <p className={styles.correctionNoteText}>{correction.note}</p>
                <p className={styles.correctionMetaText}>
                  {/* Corrections are append-only over the referral's whole life, so one added days
                      ago must say which day, not just the bare clock face — the same reason
                      ward-instant-display.test.ts moved history surfaces onto this helper. */}
                  {WARD_FLOW_ROLE_LABELS[correction.by]} at {formatInstantWithDay(correction.at, now)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {sent ? (
          <div className={styles.correctionControlsWrap} data-testid="ward-referral-correction-controls">
            <label className={styles.fieldLegend} htmlFor={noteId}>
              Add a correction note
            </label>
            <textarea
              id={noteId}
              data-testid="ward-referral-correction-note"
              className={styles.correctionNote}
              value={note}
              maxLength={REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS}
              placeholder="Document clinical addendum or update..."
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              data-gramm="false"
              data-enable-grammarly="false"
              spellCheck={false}
              autoComplete="off"
            />
            <div className={styles.correctionActionRow}>
              <button
                type="button"
                className={styles.addCorrectionBtn}
                data-testid="ward-referral-add-correction"
                aria-disabled={trimmedNote.length === 0 ? "true" : undefined}
                aria-describedby={trimmedNote.length === 0 ? `${noteId}-ward-referral-correction-blocked` : undefined}
                title={trimmedNote.length === 0 ? "Write a note before adding a correction." : undefined}
                onClick={trimmedNote.length === 0 ? ignoreUnavailableActivation : handleAddCorrection}
              >
                Add a correction
              </button>
              <span className={styles.correctionDisclaimer}>
                Corrections are added as new notes. The history sent with the referral is never changed.
              </span>
            </div>
            {trimmedNote.length === 0 ? (
              <span id={`${noteId}-ward-referral-correction-blocked`} className="sr-only">
                Write a note before adding a correction.
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
