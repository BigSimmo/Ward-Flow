"use client";

// The ward page's Referrals tab (Josh, 3 Nov 2026, WH7 and WH9). It reverses CRIT-07 (27 Oct): the
// referral inbox no longer sits as a full-width strip above the ward band, shown even when empty.
// It has its own tab, which says how referrals reach this ward before listing them.

import { ArrowLeftRight, Inbox } from "lucide-react";
import { buttonClass, EmptyState } from "@/components/wf";
import { useWardFlowSelect } from "../ward-flow-provider";
import type { Unit } from "../ward-model";
import styles from "./ward-screen-referrals-tab.module.css";
import wardStyles from "./ward.module.css";
import { WardReferralInbox } from "./ward-screen-lazy";
import { WardWaitList } from "./ward-wait-list";

type WardScreenReferralsTabProps = {
  active: boolean;
  unit: Unit;
  /** Referrals still waiting for this ward's answer. */
  waiting: number;
  /** Bed requests from an emergency department, answered in Coming and going on Ward home. */
  bedRequests: number;
  onOpenBedRequests: () => void;
};

export function WardScreenReferralsTab({
  active,
  unit,
  waiting,
  bedRequests,
  onOpenBedRequests,
}: WardScreenReferralsTabProps) {
  const { wardReferralInbox } = useWardFlowSelect("wardReferralInbox");
  const entries = wardReferralInbox?.(unit.id) ?? [];
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
        <div className={styles.wrap}>
          {/* Most urgent first: a bed request from an emergency department is answered in Coming and going. */}
          {bedRequests > 0 ? (
            <div className={styles.requestRow} data-testid="ward-referrals-bed-requests">
              <span className={styles.requestText}>
                <span className={styles.caps}>Bed request from ED</span>
                <span className={styles.requestLine}>
                  <b>{bedRequests}</b> waiting for this ward&rsquo;s answer
                </span>
              </span>
              <button
                type="button"
                className={buttonClass({ variant: "sec", size: "sm" })}
                onClick={onOpenBedRequests}
                data-testid="ward-referrals-open-bed-requests"
              >
                <ArrowLeftRight strokeWidth={1.75} size={14} aria-hidden="true" />
                Answer on Ward home
              </button>
            </div>
          ) : null}
          <div className={styles.listCard}>
            <div className={styles.listHead}>
              <h2 className={styles.caps} id="ward-referrals-heading">
                Referrals to {unit.name}
              </h2>
              <span className={styles.quiet}>
                <b>{waiting}</b> waiting
              </span>
            </div>
            {entries.length === 0 ? (
              <EmptyState icon={Inbox} title="No referrals yet." meta="Referrals sent to this ward show here." />
            ) : (
              <WardReferralInbox unitId={unit.id} embedded />
            )}
          </div>
          {/* Ward wait list (Josh, 9 Nov 2026): who this ward waitlisted, and its ready mark. */}
          <WardWaitList unit={unit} />
        </div>
      ) : null}
    </section>
  );
}
