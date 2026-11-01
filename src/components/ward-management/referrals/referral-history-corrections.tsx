"use client";

import { useId, useState, type Dispatch } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { wardCommandFailure } from "@/components/ward-management/ward/use-ward-command-completion";
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
  dispatch: dispatchProp,
  readOnly = false,
}: {
  referral: Referral;
  now: Instant;
  /** Used only outside a provider (the match view's own tests); inside one the panel raises through it. */
  dispatch?: Dispatch<WardFlowEvent>;
  /** D-80: the history and corrections only, with no control to add one (a read-only board). */
  readOnly?: boolean;
}) {
  const routeRole = useRouteRole();
  const flow = useOptionalWardFlowSelect("dispatch", "units");
  const dispatch = flow?.dispatch ?? dispatchProp;
  const raise = wardRaise(dispatch ?? (() => undefined), routeRole, useWardFlowClock(now));
  const access = useEffectiveWardAccess();
  const sent =
    !readOnly &&
    dispatch !== undefined &&
    routeSentKind(routeRole, referral.source) &&
    referralSentByDesk(referral, access, wardPlaceLookup(flow?.units ?? []));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const noteId = useId();
  const trimmedNote = note.trim();

  /**
   * The local reducer refuses only a blank note (guarded by `aria-disabled` below), an over-limit
   * note (`maxLength` on the textarea) or an unknown referral. The shared workspace can still answer
   * `failed` (a lost response, a role change) or `cancelled` (workspace not ready), so the note is
   * cleared only once the correction is recorded; otherwise it stays with the reason beside the
   * button (production audit URE-05). A note edited while the save was pending is kept.
   */
  function handleAddCorrection() {
    if (trimmedNote.length === 0 || saving) return;
    setFailure(undefined);
    const submitted = note;
    const finish = (outcome?: WardCommandOutcome | void) => {
      setSaving(false);
      const message = wardCommandFailure(outcome ?? undefined);
      if (message) setFailure(message);
      else setNote((current) => (current === submitted ? "" : current));
    };
    const result = raise("ADD_REFERRAL_CORRECTION", { referralId: referral.id, note: submitted });
    if (result instanceof Promise) {
      setSaving(true);
      result.then(finish, () => finish({ commandId: "", status: "failed" }));
    } else finish(result);
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
                aria-disabled={trimmedNote.length === 0 || saving ? "true" : undefined}
                aria-describedby={trimmedNote.length === 0 ? `${noteId}-ward-referral-correction-blocked` : undefined}
                title={trimmedNote.length === 0 ? "Write a note before adding a correction." : undefined}
                onClick={trimmedNote.length === 0 || saving ? ignoreUnavailableActivation : handleAddCorrection}
              >
                Add a correction
              </button>
              <span className={styles.correctionDisclaimer}>The history sent is never changed.</span>
            </div>
            {failure ? (
              <p className={styles.rejection} role="alert" data-testid="ward-referral-correction-failure">
                {failure}
              </p>
            ) : null}
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
