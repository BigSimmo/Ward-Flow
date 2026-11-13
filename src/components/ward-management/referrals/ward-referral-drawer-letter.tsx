"use client";

import { CircleCheck, Copy, FileText, Info, ListChecks, Phone, Printer, Send, Users } from "lucide-react";
import Link from "next/link";
import { referralBoardHref } from "../ed/ed-bed-search-step";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { OPERATIONAL_DEFAULT_LABEL } from "@/components/ward-management/ward-operational-defaults";
import styles from "./ward-referral-drawer.module.css";
import { ContactFields, UseMyDetailsButton, ReferralDocumentLinks } from "./referral-flow-panels";
import { chartsCountText } from "./referral-document-links";
import { formatReferralIntakeTime } from "../ward-referral-seed-time";
import { referralIsbarText, referralLetterText } from "./referral-letter";
import { ReferralLetterDocument } from "./referral-letter-document";
import { StatusGlyph } from "@/components/wf";
import { countOf, DESTINATION_LABELS } from "./ward-referral-drawer-model";
import { referralCatchmentWords, referrerContactWords, transportLabel } from "./referral-submission";
import { CardHead } from "./ward-referral-drawer-fields";
import type { WardReferralDrawerState } from "./use-ward-referral-drawer-state";

/** The read-only letter, as it will be sent: styled paper, its copy text and its PDF (RF2). */
export function ReferralLetterPreview({
  s,
  stamp,
  hint = "This is the letter the receiving team reads.",
}: {
  s: WardReferralDrawerState;
  /** Overrides the draft stamp, for the letter as sent. */
  stamp?: string;
  hint?: string;
}) {
  const { now, letterInput, copyText } = s;
  const draftedAt = formatInstant(now);
  return (
    <section className={styles.letterSection} data-testid="ward-referral-letter-preview">
      <div className={styles.letterActions}>
        <p className={styles.letterHint}>{hint}</p>
        <button
          type="button"
          className={styles.btn}
          data-testid="ward-referral-copy-letter"
          onClick={() => {
            const text = referralLetterText(letterInput, draftedAt);
            // A sent letter copies with its referral ID and sent time, as it reads on screen.
            copyText(stamp ? text.replace(`Draft ${draftedAt} AWST`, stamp) : text, "Letter copied");
          }}
        >
          <Copy aria-hidden="true" />
          Copy text
        </button>
        <button
          type="button"
          className={styles.btn}
          data-testid="ward-referral-print-letter"
          onClick={() => window.print()}
        >
          <Printer aria-hidden="true" />
          Print or save PDF
        </button>
      </div>
      <ReferralLetterDocument input={letterInput} stamp={stamp ?? `Draft ${draftedAt} AWST`} />
    </section>
  );
}

/** Confirm and send, then the delivery, notes and submitted-details cards once sent. */
export function ReferralConfirmation({ s }: { s: WardReferralDrawerState }) {
  const {
    myProfile,
    now,
    sentReferralId,
    sentAt,
    confirmationHeadingRef,
    documentation,
    isMedicalCleared,
    contact,
    setContact,
    catchmentTeam,
    catchmentNotKnown,
    sourceKind,
    sendingWard,
    destType,
    legalStatus,
    currentPatient,
    recipientLabels,
    confirmAndSend,
    tier,
    contactErrors,
    sentDetails,
    decisionDueAt,
    letterInput,
    copyText,
    onClose,
  } = s;
  return (
    <form
      id="referralConfirmForm"
      onSubmit={confirmAndSend}
      className={styles.confirmationPanel}
      // The drawer's own check (`referralContactError`) gates the send and names each
      // missing field under it, so the browser's one-at-a-time bubble is not used.
      noValidate
    >
      {sentReferralId ? (
        <>
          <section className={styles.refCard}>
            <CardHead icon={Send} title="Delivery" />
            <div className={styles.cardBody}>
              <div className={styles.sentHead}>
                <span className={styles.sentIcon} aria-hidden="true">
                  <CircleCheck aria-hidden="true" />
                </span>
                <div>
                  <h3 ref={confirmationHeadingRef} tabIndex={-1} className={styles.sentTitle}>
                    Referral sent
                  </h3>
                  <p className={styles.sentMeta}>
                    <span className={styles.mono}>{sentReferralId}</span>
                    {sentAt !== null ? ` · sent ${formatInstantWithDay(sentAt, now)}` : ""}
                  </p>
                </div>
              </div>
              <p className={styles.eyebrow}>Sent to {countOf(recipientLabels.length, destType)}</p>
              <ul className={styles.recipientList}>
                {recipientLabels.map((label) => (
                  <li key={label}>
                    <StatusGlyph tone="neutral" size={10} />
                    <strong>{label}</strong>
                    <span title={OPERATIONAL_DEFAULT_LABEL}>
                      {sentAt !== null && decisionDueAt(sentAt)
                        ? `Awaiting review · due ${decisionDueAt(sentAt)}`
                        : "Awaiting review"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className={styles.cardActions}>
                <Link
                  className={styles.btn}
                  href={s.sentReferralId ? referralBoardHref(s.sentReferralId) : "/ward-flow/referrals"}
                  onClick={onClose}
                >
                  <Users aria-hidden="true" />
                  View referrals board
                </Link>
              </div>
            </div>
          </section>
          {/* RF2 (Josh, 4 Nov 2026): the letter as sent, to copy, print or save as a PDF. */}
          <ReferralLetterPreview
            s={s}
            stamp={`${sentReferralId} · sent ${sentAt === null ? formatInstant(now) : formatInstantWithDay(sentAt, now)} AWST`}
            hint="The letter as sent."
          />
          <section className={styles.refCard} data-testid="ward-referral-isbar">
            <CardHead icon={ListChecks} title="Copy to notes">
              <span className={styles.asideText}>ISBAR</span>
            </CardHead>
            <div className={styles.cardBody}>
              <pre className={styles.letterText}>
                {referralIsbarText(letterInput, {
                  referralId: sentReferralId,
                  sentAt: sentAt === null ? "" : formatInstantWithDay(sentAt, now),
                  decisionDue: sentAt === null ? undefined : decisionDueAt(sentAt),
                })}
              </pre>
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.btn}
                  data-testid="ward-referral-copy-notes"
                  onClick={() =>
                    copyText(
                      referralIsbarText(letterInput, {
                        referralId: sentReferralId,
                        sentAt: sentAt === null ? "" : formatInstantWithDay(sentAt, now),
                        decisionDue: sentAt === null ? undefined : decisionDueAt(sentAt),
                      }),
                      "Copied for the notes",
                    )
                  }
                >
                  <Copy aria-hidden="true" />
                  Copy to notes
                </button>
              </div>
            </div>
          </section>
          {sentDetails ? (
            <section className={styles.refCard}>
              <CardHead icon={FileText} title="Submitted details">
                <span className={styles.asideText}>Read-only</span>
              </CardHead>
              <div className={styles.cardBody}>
                <dl className={styles.factGrid} data-columns="2">
                  <div>
                    <dt>Catchment</dt>
                    <dd>{referralCatchmentWords(sentDetails.catchment)}</dd>
                  </div>
                  <div>
                    <dt>Medical clearance</dt>
                    <dd>{sentDetails.medicalClearance.cleared ? "Cleared" : "Pending"}</dd>
                  </div>
                  <div>
                    <dt>Triage and RAMP</dt>
                    <dd>{sentDetails.triageAndRampCompleted ? "Completed" : "Not completed"}</dd>
                  </div>
                  <div>
                    <dt>Referrer</dt>
                    <dd>
                      {sentDetails.referrer.name} · {sentDetails.referrer.role}
                    </dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>{referrerContactWords(sentDetails.referrer)}</dd>
                  </div>
                  <div>
                    <dt>Location or service</dt>
                    <dd>{sentDetails.referrer.location}</dd>
                  </div>
                  <div>
                    <dt>Reason for referral</dt>
                    <dd>{sentDetails.reasonForReferral || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Legal status</dt>
                    <dd>{sentDetails.legalStatus}</dd>
                  </div>
                  <div>
                    <dt>Risk flags</dt>
                    <dd>{sentDetails.riskFlags.join(", ") || "None selected"}</dd>
                  </div>
                  {sentDetails.arrival ? (
                    <div>
                      <dt>Proposed arrival</dt>
                      <dd>
                        {transportLabel(sentDetails.arrival.transport)} ·{" "}
                        {formatReferralIntakeTime(sentDetails.arrival.estimatedAt, sentDetails.arrival, s.dayZero, now)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {sentDetails.charts.length || sentDetails.chartsToFollow?.length ? (
                  <div className={styles.documentsBlock}>
                    <p className={styles.eyebrow}>Documents</p>
                    <ReferralDocumentLinks charts={sentDetails.charts} toFollow={sentDetails.chartsToFollow} />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <section className={styles.refCard}>
            <div className={styles.cardHead}>
              <span className={styles.cardIcon} aria-hidden="true">
                <Send aria-hidden="true" />
              </span>
              <h3 ref={confirmationHeadingRef} tabIndex={-1} className={styles.cardTitle}>
                Confirm and send
              </h3>
            </div>
            <div className={styles.cardBody}>
              <dl className={styles.factGrid}>
                <div>
                  <dt>Patient</dt>
                  <dd>{currentPatient.name}</dd>
                </div>
                <div>
                  <dt>Catchment</dt>
                  {/* C13: the side rail's words, never a blank line. */}
                  <dd>{catchmentNotKnown ? "Catchment not known" : catchmentTeam.trim() || "To confirm"}</dd>
                </div>
                <div>
                  <dt>Clearance</dt>
                  <dd>{isMedicalCleared ? "Cleared" : "Pending"}</dd>
                </div>
                <div>
                  <dt>Charts</dt>
                  <dd>{chartsCountText(documentation.charts.length, documentation.toFollow?.length ?? 0)}</dd>
                </div>
                <div>
                  <dt>Urgency</dt>
                  <dd>{tier === undefined ? "Not recorded" : `Tier ${tier}`}</dd>
                </div>
                <div>
                  <dt>Legal status</dt>
                  <dd>{legalStatus}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{sendingWard ? sendingWard.name : sourceKind === "ed" ? "Emergency" : "Community"}</dd>
                </div>
                <div>
                  <dt>Refer to</dt>
                  <dd>{DESTINATION_LABELS[destType]}</dd>
                </div>
              </dl>
              <p className={styles.eyebrow}>Recipients {recipientLabels.length}</p>
            </div>
            <ul className={styles.recipientList}>
              {recipientLabels.map((label) => (
                <li key={label}>
                  <StatusGlyph tone="success" size={10} />
                  <strong>{label}</strong>
                  <span>Will receive</span>
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.refCard}>
            <CardHead icon={Phone} title="Your contact details">
              <UseMyDetailsButton
                lookup={myProfile}
                onFill={(details) => {
                  setContact(details);
                  announceToWardShell("Your details filled from your profile.");
                }}
              />
            </CardHead>
            <div className={styles.cardBody}>
              <ContactFields contact={contact} onChange={setContact} errors={contactErrors} />
            </div>
          </section>
          <p className={styles.deliveryNote}>
            <Info aria-hidden="true" />
            Sending reserves no bed.
          </p>
        </>
      )}
    </form>
  );
}
