"use client";
// Copied from src/components/ward-management/referrals/referral-match-not-a-bed.tsx (Referrals redesign).
// Final round (31 Oct 2026): reason and recipient choices use the kit Select, same options, nothing pre-chosen (D-71).

import { type Dispatch, type ReactNode } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { RadioGroup } from "@/components/wf";
import { type Instant } from "@/components/ward-management/ward-clock";
import { type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  COMMUNITY_DECLINE_REASONS,
  ED_DECLINE_REASONS,
  type CommunityDeclineReason,
  type Referral,
  type ReferralDeclineReason,
  type ReferralDestinationKind,
} from "@/components/ward-management/ward-model";
import { formatUmrn } from "@/components/ward-management/ward-patients";
import {
  COMMUNITY_DECLINE_REASON_LABELS,
  DECLINE_REASON_LABELS,
  communityPurposeOf,
  communityReferralPurposeLabel,
  referralDestinationLabels,
} from "@/components/ward-management/ward-referrals";
import styles from "./referrals.module.css";
import ph from "./referral-match-phone.module.css";
import { Select } from "@/components/wf";
// Final round: the kit Select box sizing for this panel (see the file).
import rs from "./referral-match.module.css";
import {
  DECLINE_REASON_UNCHOSEN_ED,
  DECLINE_REASON_UNCHOSEN_COMMUNITY,
  MATCH_VIEW_DECISION_EVENTS,
  REJECTED_DECISION_LABELS,
  revealConfirmRow,
} from "./referral-match-model";
import { Disclosure, FoldedHistory } from "./folded-history";
import type { ReferralMatchState } from "./use-referral-match-state";

/*
 * The match view's two not-a-bed returns, moved unchanged from `referral-match.tsx`. They are
 * render helpers called from the view's own early returns rather than components, so the element
 * tree, and with it every piece of DOM and child state, is exactly what the view rendered before.
 */

/** v10 phone, ED review: the not-a-bed question as one scrolling sheet, Decline and Accept pinned in the foot. */
export function renderNotABedPhoneReview({
  s,
  referral,
  patientInfo,
  phone,
  handleDecline,
  handleEdAccept,
}: {
  s: ReferralMatchState;
  referral: Referral;
  patientInfo: { displayName: string; umrn: string } | undefined;
  phone: ReactNode;
  handleDecline: (destinationKind: ReferralDestinationKind, reason?: ReferralDeclineReason) => void;
  handleEdAccept: () => void;
}) {
  const {
    edDeclineReason,
    setEdDeclineReason,
    edAcceptConfirmOpen,
    setEdAcceptConfirmOpen,
    lastRejection,
    phoneDeclining,
    setPhoneDeclining,
    gpSourceNotice,
    wholeWithdrawControl: withdrawDetails,
  } = s;
  const wholeWithdrawControl = <Disclosure>{withdrawDetails}</Disclosure>;
  return (
    <section
      className={`${styles.matchPanel} ${ph.sheet}`}
      data-testid="ward-referral-match-not-a-bed-question"
      data-phone="true"
    >
      <p className={ph.ch}>ED review</p>
      <div className={styles.v10AskCard}>
        <b className={styles.v10AskWhere}>{referralDestinationLabels(referral).join(" · ")}</b>
        <span className={styles.v10AskWhat}>Psychiatric review, not answered by a bed</span>
        <p className="sr-only">
          {patientInfo ? formatUmrn(patientInfo.umrn) : "This referral"} was sent to{" "}
          {referralDestinationLabels(referral).join(", ").toLowerCase()} — none of which is answered by matching a bed.
          There is no bed shortlist for this referral.
        </p>
      </div>
      {gpSourceNotice}
      {phoneDeclining ? (
        <>
          <p className={ph.ch}>Why decline?</p>
          <RadioGroup className={ph.cands} aria-label="Why decline?">
            {ED_DECLINE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                role="radio"
                aria-checked={edDeclineReason === reason}
                className={ph.cand}
                data-testid={`ward-referral-match-phone-decline-${reason}`}
                onClick={() => setEdDeclineReason(reason)}
              >
                <span className={edDeclineReason === reason ? `${ph.rad} ${ph.radOn}` : ph.rad} aria-hidden="true" />
                <span className={ph.nm}>{DECLINE_REASON_LABELS[reason] ?? reason}</span>
              </button>
            ))}
          </RadioGroup>
          <p className={ph.matchHint} id="ward-referral-match-decline-blocked-emergency_department">
            {edDeclineReason === undefined ? "Choose a reason to decline." : "Decline records this reason."}
          </p>
        </>
      ) : (
        <>
          <p className={ph.matchHint}>
            {edAcceptConfirmOpen
              ? "Confirm records the decision only. Nobody is moved."
              : "Decline needs a reason. Accept records the decision only."}
          </p>
          {wholeWithdrawControl}
        </>
      )}
      {lastRejection ? (
        <p className={styles.rejection} data-testid="ward-referral-match-rejection" role="alert">
          {REJECTED_DECISION_LABELS[lastRejection.attempted as (typeof MATCH_VIEW_DECISION_EVENTS)[number]]} not
          recorded: {lastRejection.reason}
        </p>
      ) : null}
      {phoneDeclining ? null : phone}
      <div className={ph.foot}>
        {phoneDeclining ? (
          <>
            <button type="button" className={ph.sec} onClick={() => setPhoneDeclining(false)}>
              Back
            </button>
            <button
              type="button"
              className={ph.pri}
              data-tone="danger"
              data-testid="ward-referral-match-decline-emergency_department"
              aria-disabled={edDeclineReason === undefined ? "true" : undefined}
              aria-describedby="ward-referral-match-decline-blocked-emergency_department"
              title={edDeclineReason === undefined ? DECLINE_REASON_UNCHOSEN_ED : undefined}
              onClick={
                edDeclineReason === undefined
                  ? ignoreUnavailableActivation
                  : () => {
                      handleDecline("emergency_department", edDeclineReason);
                      setPhoneDeclining(false);
                    }
              }
            >
              <span className={ph.ell}>Confirm decline</span>
            </button>
          </>
        ) : edAcceptConfirmOpen ? (
          <>
            <button
              type="button"
              className={ph.sec}
              data-testid="ward-referral-match-cancel-accept-emergency_department"
              onClick={() => setEdAcceptConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={ph.pri}
              data-testid="ward-referral-match-confirm-accept-emergency_department"
              onClick={handleEdAccept}
            >
              <span className={ph.ell}>Confirm acceptance</span>
            </button>
          </>
        ) : (
          <>
            {/* Referrals redesign (31 Oct 2026): the ward sheet's own Decline id, so the board's D key
                opens these reasons here too, now that desktop uses this ED review. */}
            <button
              type="button"
              className={ph.sec}
              data-testid="ward-referral-match-decline-open"
              onClick={() => setPhoneDeclining(true)}
            >
              Decline
            </button>
            <button
              type="button"
              className={ph.pri}
              data-testid="ward-referral-match-accept-emergency_department"
              onClick={() => setEdAcceptConfirmOpen(true)}
            >
              <span className={ph.ell}>Accept presentation</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** The not-a-bed question: an ED or community referral, answered by a person or a team, not a bed. */
export function renderNotABedPanel({
  s,
  referral,
  now,
  dispatch,
  patientInfo,
  phone,
  handleDecline,
  handleEdAccept,
  handleCommunityDecline,
  handleCommunityAccept,
  hideCommunityDecision = false,
}: {
  s: ReferralMatchState;
  referral: Referral;
  now: Instant;
  dispatch: Dispatch<WardFlowEvent>;
  patientInfo: { displayName: string; umrn: string } | undefined;
  phone: ReactNode;
  handleDecline: (destinationKind: ReferralDestinationKind, reason?: ReferralDeclineReason) => void;
  handleEdAccept: () => void;
  handleCommunityDecline: () => void;
  handleCommunityAccept: () => void;
  /** Josh, 31 Oct 2026 (answer 33): the community desk does not answer the community arm here,
      because the answer would be recorded as the coordinator's. */
  hideCommunityDecision?: boolean;
}) {
  const {
    edDeclineReason,
    setEdDeclineReason,
    communityDeclineReason,
    setCommunityDeclineReason,
    edAcceptConfirmOpen,
    setEdAcceptConfirmOpen,
    lastRejection,
    gpSourceNotice,
    edAddressing,
    communityAddressing,
    wholeWithdrawControl: withdrawDetails,
  } = s;
  const wholeWithdrawControl = <Disclosure>{withdrawDetails}</Disclosure>;
  return (
    <section className={styles.matchPanel} data-testid="ward-referral-match-not-a-bed-question">
      {/* v10: an eyebrow naming the ask, one plain card for where it went, then the decision. */}
      <p className={styles.v10AskEyebrow}>
        {edAddressing
          ? "ED review"
          : communityAddressing?.destination.kind === "community_team"
            ? communityReferralPurposeLabel(communityPurposeOf(communityAddressing.destination))
            : "Not a bed request"}
      </p>
      <div className={styles.v10AskCard}>
        <b className={styles.v10AskWhere}>{referralDestinationLabels(referral).join(" · ")}</b>
        <span className={styles.v10AskWhat}>
          {edAddressing ? "Psychiatric review, not answered by a bed" : "Answered by a team, not by a bed"}
        </span>
        <p className="sr-only">
          {patientInfo ? formatUmrn(patientInfo.umrn) : "This referral"} was sent to{" "}
          {referralDestinationLabels(referral).join(", ").toLowerCase()} — none of which is answered by matching a bed.
          There is no bed shortlist for this referral.
        </p>
      </div>
      {gpSourceNotice}

      <div className={styles.v10AskActions}>
        {edAddressing && edAddressing.state === "queued" ? (
          <div
            className={styles.declineControls}
            data-testid="ward-referral-match-decline-controls-emergency_department"
          >
            <label className={styles.fieldLegend} htmlFor="ward-referral-match-decline-reason-emergency_department">
              Decline reason (emergency department)
            </label>
            <div className={styles.selectWithActionRow}>
              <Select
                id="ward-referral-match-decline-reason-emergency_department"
                data-testid="ward-referral-match-decline-reason-emergency_department"
                boxClassName={rs.reasonSelect}
                value={edDeclineReason ?? ""}
                onChange={(event) => {
                  const chosen = event.target.value;
                  // Membership, never truthiness — same discipline as the ward select above.
                  setEdDeclineReason(
                    ED_DECLINE_REASONS.includes(chosen as ReferralDeclineReason)
                      ? (chosen as ReferralDeclineReason)
                      : undefined,
                  );
                }}
              >
                <option value="">Choose a reason…</option>
                {ED_DECLINE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {DECLINE_REASON_LABELS[reason] ?? reason}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                className={styles.declineButton}
                data-testid="ward-referral-match-decline-emergency_department"
                aria-disabled={edDeclineReason === undefined ? "true" : undefined}
                aria-describedby={
                  edDeclineReason === undefined ? "ward-referral-match-decline-blocked-emergency_department" : undefined
                }
                title={edDeclineReason === undefined ? DECLINE_REASON_UNCHOSEN_ED : undefined}
                onClick={
                  edDeclineReason === undefined
                    ? ignoreUnavailableActivation
                    : () => handleDecline("emergency_department", edDeclineReason)
                }
              >
                Decline referral
              </button>
            </div>
            {edDeclineReason === undefined ? (
              <span id="ward-referral-match-decline-blocked-emergency_department" className="sr-only">
                {DECLINE_REASON_UNCHOSEN_ED}
              </span>
            ) : null}
          </div>
        ) : null}

        {edAddressing && edAddressing.state === "queued" ? (
          <div
            className={styles.matchRowTop}
            data-confirming={edAcceptConfirmOpen ? "true" : undefined}
            data-testid="ward-referral-match-accept-controls-emergency_department"
          >
            {!edAcceptConfirmOpen ? (
              <button
                type="button"
                className={styles.acceptPresentationBtn}
                data-testid="ward-referral-match-accept-emergency_department"
                onClick={() => setEdAcceptConfirmOpen(true)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Accept presentation</span>
              </button>
            ) : (
              <div
                ref={revealConfirmRow}
                className={styles.confirmActionRow}
                data-testid="ward-referral-match-accept-confirm-group-emergency_department"
              >
                <button
                  type="button"
                  className={styles.acceptPresentationBtn}
                  data-testid="ward-referral-match-confirm-accept-emergency_department"
                  onClick={handleEdAccept}
                >
                  Confirm acceptance
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  data-testid="ward-referral-match-cancel-accept-emergency_department"
                  onClick={() => setEdAcceptConfirmOpen(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : null}

        {communityAddressing && communityAddressing.state === "queued" && !hideCommunityDecision ? (
          <div className={styles.declineControls} data-testid="ward-referral-match-decline-controls-community_team">
            <label className={styles.fieldLegend} htmlFor="ward-referral-match-decline-reason-community_team">
              Decline reason (community team)
            </label>
            <div className={styles.selectWithActionRow}>
              <Select
                id="ward-referral-match-decline-reason-community_team"
                data-testid="ward-referral-match-decline-reason-community_team"
                boxClassName={rs.reasonSelect}
                value={communityDeclineReason ?? ""}
                onChange={(event) => {
                  const chosen = event.target.value;
                  // Membership, never truthiness — same discipline as the ward and ED selects above.
                  setCommunityDeclineReason(
                    COMMUNITY_DECLINE_REASONS.includes(chosen as CommunityDeclineReason)
                      ? (chosen as CommunityDeclineReason)
                      : undefined,
                  );
                }}
              >
                <option value="">Choose a reason…</option>
                {COMMUNITY_DECLINE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {COMMUNITY_DECLINE_REASON_LABELS[reason]}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                className={styles.declineButton}
                data-testid="ward-referral-match-decline-community_team"
                aria-disabled={communityDeclineReason === undefined ? "true" : undefined}
                aria-describedby={
                  communityDeclineReason === undefined
                    ? "ward-referral-match-decline-blocked-community_team"
                    : undefined
                }
                title={communityDeclineReason === undefined ? DECLINE_REASON_UNCHOSEN_COMMUNITY : undefined}
                onClick={communityDeclineReason === undefined ? ignoreUnavailableActivation : handleCommunityDecline}
              >
                Decline referral
              </button>
            </div>
            {communityDeclineReason === undefined ? (
              <span id="ward-referral-match-decline-blocked-community_team" className="sr-only">
                {DECLINE_REASON_UNCHOSEN_COMMUNITY}
              </span>
            ) : null}
          </div>
        ) : null}

        {communityAddressing && communityAddressing.state === "queued" && !hideCommunityDecision ? (
          <div className={styles.matchRowTop} data-testid="ward-referral-match-accept-controls-community_team">
            {/*
             * RB5 (item 16, 2026-09-17) — "a community team may accept, for follow-up only". Same
             * button style as the ward bed accept above (`styles.acceptButton`), no reason and no
             * unit to gate on (see `handleCommunityAccept`'s own doc comment), so unlike every
             * decline control on this screen this one is never `aria-disabled`.
             */}
            <button
              type="button"
              className={styles.acceptPresentationBtn}
              data-testid="ward-referral-match-accept-community_team"
              onClick={handleCommunityAccept}
            >
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Accept referral</span>
            </button>
          </div>
        ) : null}
      </div>
      {/* B4 (review 12 Oct 2026): the note and the withdraw disclosure sit outside the pinned
            decision bar so the bar holds only Decline and Accept (or Confirm and Cancel). */}
      <p className={styles.v10AskNote}>Decline needs a reason first. Accept records the decision only.</p>
      {wholeWithdrawControl}

      {lastRejection ? (
        <p className={styles.rejection} data-testid="ward-referral-match-rejection" role="alert">
          {REJECTED_DECISION_LABELS[lastRejection.attempted as (typeof MATCH_VIEW_DECISION_EVENTS)[number]]} not
          recorded: {lastRejection.reason}
        </p>
      ) : null}
      <FoldedHistory referral={referral} now={now} dispatch={dispatch} />
      {phone}
    </section>
  );
}
