"use client";

// The ward page's Referrals tab (Josh, 3 Nov 2026, WH7 and WH9). It reverses CRIT-07 (27 Oct): the
// referral inbox no longer sits as a full-width strip above the ward band, shown even when empty.
// It has its own tab, which says how referrals reach this ward before listing them.

import { Inbox } from "lucide-react";
import { EmptyState, WindowWord } from "@/components/wf";
import { useWardFlowSelect } from "../ward-flow-provider";
import type { Unit } from "../ward-model";
import styles from "./ward-screen-referrals-tab.module.css";
import wardStyles from "./ward.module.css";
import { WardAnswerInReferrals, WardReferralInbox } from "./ward-screen-lazy";
import { WardRecentAnswersFold, wardRecentAnswers } from "./ward-recent-answers";
import { WardWaitList, wardWaitList } from "./ward-wait-list";

type WardScreenReferralsTabProps = {
  active: boolean;
  unit: Unit;
  /** Referrals still waiting for this ward's answer. */
  waiting: number;
  /** Bed requests from an emergency department, answered here one by one. */
  bedRequests: number;
  /** A request a link names (`?movement=`), opened in place of the longest wait. */
  namedMovementId?: string;
};

export function WardScreenReferralsTab({
  active,
  unit,
  waiting,
  bedRequests,
  namedMovementId,
}: WardScreenReferralsTabProps) {
  const { wardReferralInbox, movements } = useWardFlowSelect("wardReferralInbox", "movements");
  const entries = wardReferralInbox?.(unit.id) ?? [];
  // Audit three #24 (28 Nov 2026): with nothing waiting, on the wait list or answered for an ED, the
  // tab says so once: one empty state with the ready mark, then "Show N answered" if any.
  const quiet =
    waiting === 0 &&
    bedRequests === 0 &&
    !namedMovementId &&
    wardWaitList(movements, unit.id).length === 0 &&
    wardRecentAnswers(movements, unit.id).length === 0;
  return (
    <section
      className={wardStyles.tabPanel}
      id="tab-referrals"
      role="tabpanel"
      aria-labelledby="tabBtn-referrals"
      data-active={active}
      data-testid="ward-referrals-tab"
    >
      {active ? (
        // Wave 4 (D-191, notes 3 and 6, review FS-12): the mock-up's two parts. The referrals to answer,
        // headed "N To answer · now", and a "This ward's answers" rail that holds the wait list
        // ("N Wait list · now"), each window the kit's WindowWord.
        <div className={styles.stack}>
          {/* Simplification 26 Nov 2026 (area 3, item 2): most urgent first, a bed request from an
            emergency department is answered here, one by one, so the separate Answer screen is
            not needed. A named request opens itself, or says it has gone; it never swaps. */}
          {bedRequests > 0 || namedMovementId ? (
            <div className={styles.answerCard} data-testid="ward-referrals-bed-requests">
              <WardAnswerInReferrals key={namedMovementId ?? "queue"} unitId={unit.id} movementId={namedMovementId} />
            </div>
          ) : null}
          <div className={styles.layout} data-quiet={quiet || undefined}>
            <div className={styles.wrap}>
              <div className={styles.listCard}>
                <div className={styles.listHead}>
                  <h2 className={styles.title} id="ward-referrals-heading">
                    Referrals to {unit.name}
                  </h2>
                  <span className={styles.quiet} data-testid="ward-referrals-to-answer">
                    <b>{waiting}</b> To answer
                    <WindowWord word="now" />
                  </span>
                </div>
                {quiet ? (
                  <>
                    <EmptyState
                      className={styles.quietEmpty}
                      icon={Inbox}
                      title="Nothing waiting for this ward's answer."
                      meta={`New referrals and bed requests to ${unit.name} show here.`}
                      action={<WardWaitList unit={unit} readyOnly />}
                    />
                    {entries.length > 0 ? <WardReferralInbox unitId={unit.id} embedded /> : null}
                  </>
                ) : entries.length === 0 ? (
                  <EmptyState icon={Inbox} title="No referrals yet." meta="Referrals sent to this ward show here." />
                ) : (
                  <>
                    {/* Simplification 26 Nov 2026 (perfection): with every referral answered, the card
                        says so in one plain sentence instead of showing only "Show N answered". */}
                    {waiting === 0 ? (
                      <EmptyState
                        icon={Inbox}
                        title="Nothing waiting for this ward's answer."
                        meta="New referrals to this ward show here."
                      />
                    ) : null}
                    <WardReferralInbox unitId={unit.id} embedded />
                  </>
                )}
              </div>
            </div>
            {quiet ? null : (
              <section
                className={styles.rail}
                aria-labelledby="ward-answers-heading"
                data-testid="ward-referrals-answers"
              >
                <div className={styles.listHead}>
                  <h2 className={styles.title} id="ward-answers-heading">
                    This ward&rsquo;s answers
                  </h2>
                </div>
                {/* Ward wait list (Josh, 9 Nov 2026): who this ward waitlisted, and its ready mark. */}
                <WardWaitList unit={unit} embedded />
                {/* Recent answers moved from the Answer screen, folded (area 3, item 2). */}
                <WardRecentAnswersFold unitId={unit.id} />
              </section>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
