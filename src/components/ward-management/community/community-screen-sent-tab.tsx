/*
 * The community team screen's Sent list: the referrals this team made and each place's answer.
 *
 * Fix plan item 17 (D-74) built the list. D-77 group A (Josh approved the mock-up, 21 Oct 2026)
 * moved it from the bottom of Expected back into its own first tab, as a table. Times stay
 * elapsed, because the team page never prints a date or a clock face.
 */

import { Fragment, useId, useState } from "react";
import styles from "./community.module.css";
import {
  type SentAnswerTone,
  type SentFilter,
  sentAgo,
  sentAnswer,
  sentAskedFor,
  sentMatches,
  sentPlaceLine,
  sentToLine,
  unattributedSentLine,
} from "./community-sent-referrals";
import type { CommunityScreenView } from "./community-screen";
import { SentReferralJourneyChanges } from "../movements/sent-journey-changes";

const FILTERS: { id: SentFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "waiting", label: "Waiting" },
  { id: "answered", label: "Answered" },
];

const TONE_CLASS: Record<SentAnswerTone, string> = {
  accepted: "good",
  declined: "warn",
  waiting: "neutral",
  withdrawn: "neutral",
};

export function CommunityScreenSentTab({ view }: { view: CommunityScreenView }) {
  const { activeTab, sentReferrals, team, units, now, identityOf } = view;
  const baseId = useId();
  const [filter, setFilter] = useState<SentFilter>("all");
  const visible = sentReferrals.sent.filter((referral) => sentMatches(referral, filter));
  return (
    <div
      className={activeTab === "tab-sent" ? styles.tabPanelActive : styles.tabPanelHidden}
      id="tab-sent"
      role="tabpanel"
      aria-labelledby="tabBtn-sent"
    >
      <section className={styles.caseloadSection} id="ward-community-sent" data-testid="ward-community-referrals">
        <div className={styles.caseloadHead}>
          <h3 className={styles.caseloadTitle}>
            <span id={`${baseId}-sentTitle`}>Referrals this team sent</span>
            <span className={styles.badgePill}>{sentReferrals.sent.length}</span>
          </h3>
          <div className={styles.filterChipsGroup}>
            {FILTERS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={styles.chipFilterBtn}
                aria-pressed={filter === chip.id}
                onClick={() => setFilter(chip.id)}
              >
                <span>{chip.label}</span>
                <span className={styles.badgePill}>
                  {sentReferrals.sent.filter((referral) => sentMatches(referral, chip.id)).length}
                </span>
              </button>
            ))}
          </div>
        </div>
        {sentReferrals.sent.length === 0 ? (
          <p className={`${styles.emptyNote} ${styles.sentEmpty}`} data-testid="ward-community-referrals-empty">
            No referral on record names {team.name} as the team that sent it.
          </p>
        ) : (
          <div className={styles.tableScroll}>
            <table
              className={`${styles.table} ${styles.sentTable}`}
              aria-labelledby={`${baseId}-sentTitle`}
              data-testid="ward-community-referrals-list"
            >
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Asked for</th>
                  <th scope="col">Sent to</th>
                  <th scope="col">Answer</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <p className={styles.emptyNote}>No referral this team sent matches this filter.</p>
                    </td>
                  </tr>
                ) : (
                  visible.map((referral) => {
                    const answer = sentAnswer(referral, units);
                    return (
                      <Fragment key={referral.id}>
                        <tr data-testid={`ward-community-sent-${referral.id}`}>
                          <td>
                            <strong>
                              {referral.patientId
                                ? identityOf({ patientId: referral.patientId })
                                : "Person not recorded"}
                            </strong>
                          </td>
                          <td>
                            {sentAskedFor(referral)}
                            <span className={styles.cellSub}>Sent {sentAgo(referral.raisedAt, now)}</span>
                          </td>
                          <td>{sentToLine(referral, units)}</td>
                          <td>
                            <span
                              className={`${styles.statusPillBadge} ${styles[TONE_CLASS[answer.tone]]} ${styles.sentAnswer}`}
                            >
                              {answer.text}
                            </span>
                            <ul className={styles.sentPlaces} aria-label="Where it was sent">
                              {referral.addressings.map((addressing, index) => (
                                <li key={`${referral.id}-${index}`} className={styles.cellSub}>
                                  {sentPlaceLine(addressing, units)}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                        {/* D-80: the team changes its own journey's urgency or legal status, on a row of its own. */}
                        <SentReferralJourneyChanges
                          referralId={referral.id}
                          patientWho={
                            referral.patientId ? identityOf({ patientId: referral.patientId }) : "this person"
                          }
                          wrap={(controls) => (
                            <tr data-testid={`ward-community-sent-journey-${referral.id}`}>
                              <td colSpan={4}>{controls}</td>
                            </tr>
                          )}
                        />
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {sentReferrals.unattributed > 0 ? (
          <p
            className={`${styles.footnote} ${styles.sentFootnote}`}
            data-testid="ward-community-referrals-unattributable"
          >
            {unattributedSentLine(sentReferrals.unattributed)}
          </p>
        ) : null}
      </section>
    </div>
  );
}
