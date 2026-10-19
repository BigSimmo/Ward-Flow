"use client";

import { CheckCircle2, Copy, Eye, FileText, Info, ListChecks, Phone, Send, Users } from "lucide-react";
import Link from "next/link";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { OPERATIONAL_DEFAULT_LABEL } from "@/components/ward-management/ward-operational-defaults";
import styles from "./ward-referral-drawer.module.css";
import { ContactFields, UseMyDetailsButton, ReferralDocumentLinks } from "./referral-flow-panels";
import { referralIsbarText, referralLetterText } from "./referral-letter";
import { StatusGlyph } from "@/components/wf";
import { transportLabel, countOf, DESTINATION_LABELS } from "./ward-referral-drawer-model";
import { CardHead } from "./ward-referral-drawer-fields";
import type { WardReferralDrawerState } from "./use-ward-referral-drawer-state";

/** The read-only letter, as it will be sent. */
export function ReferralLetterPreview({ s }: { s: WardReferralDrawerState }) {
  const { now, totalNeeded, letterInput, copyText } = s;
  return (
    <section className={styles.refCard} data-testid="ward-referral-letter-preview">
      <CardHead icon={Eye} title="Letter preview">
        <button
          type="button"
          className={styles.btn}
          data-testid="ward-referral-copy-letter"
          onClick={() => copyText(referralLetterText(letterInput, formatInstant(now)), "Letter copied")}
        >
          <Copy aria-hidden="true" />
          Copy as text
        </button>
      </CardHead>
      <div className={styles.cardBody}>
        {totalNeeded ? (
          <p className={styles.bodyMeta}>
            <StatusGlyph tone="warning" size={9} />
            {totalNeeded} {totalNeeded === 1 ? "answer" : "answers"} still needed. Sent as written.
          </p>
        ) : null}
        <pre className={styles.letterText}>{referralLetterText(letterInput, formatInstant(now))}</pre>
      </div>
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
                  <CheckCircle2 aria-hidden="true" />
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
                <Link className={styles.btn} href="/ward-flow/referrals" onClick={onClose}>
                  <Users aria-hidden="true" />
                  View referrals board
                </Link>
              </div>
            </div>
          </section>
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
                    <dd>{sentDetails.catchment.teamName} · confirmed</dd>
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
                    <dd>
                      {sentDetails.referrer.phone} · {sentDetails.referrer.email}
                    </dd>
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
                        {sentDetails.arrival.estimatedAt?.replace("T", " ").replace("+08:00", "") ||
                          "time not recorded"}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {sentDetails.charts.length ? (
                  <div className={styles.documentsBlock}>
                    <p className={styles.eyebrow}>Documents</p>
                    <ReferralDocumentLinks charts={sentDetails.charts} />
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
                  <dd>{catchmentTeam}</dd>
                </div>
                <div>
                  <dt>Clearance</dt>
                  <dd>{isMedicalCleared ? "Cleared" : "Pending"}</dd>
                </div>
                <div>
                  <dt>Charts</dt>
                  <dd>{documentation.charts.length} attached</dd>
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
            Each location gets it in its inbox. Sending reserves no bed.
          </p>
        </>
      )}
    </form>
  );
}
