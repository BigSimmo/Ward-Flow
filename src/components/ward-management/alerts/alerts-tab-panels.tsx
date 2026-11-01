"use client";

// The Alerts screen's Broadcast, Notices and History tab panels. Moved out of `alerts-screen.tsx`
// to keep it under the line cap; the screen keeps the state and the acts they call.
import { Clock } from "lucide-react";

import { EmptyState, StatusGlyph, TabPanel, cx } from "@/components/wf";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { withUmrnInPlaceOfMovementIds } from "@/components/ward-management/ward-patient-resolver";

import { type BroadcastAlert, type getActiveBroadcastAlert } from "./ward-broadcast-model";
import { isAlertLive } from "./global-alert-view";
import { PullNowCard } from "./global-alert-panels";
import { GroupHead } from "./alerts-queue";
import type { HistoryEntry } from "./alerts-history";
import { BroadcastLiveCard, EarlierBroadcasts, NoBroadcastLive } from "./broadcast-live-card";
import styles from "./alerts.module.css";
import tab from "./broadcast-tab.module.css";

export function AlertsBroadcastPanel({
  livePullNows,
  handleStandDown,
  activeBroadcast,
  broadcastAcks,
  units,
  now,
  track,
  raise,
  pastBroadcasts,
  movements,
  deskRole,
  onCompose,
  composeDisabledReason,
  onCopyAnswers,
}: {
  livePullNows: BroadcastAlert[];
  handleStandDown: (alertId: string) => void;
  activeBroadcast: ReturnType<typeof getActiveBroadcastAlert>;
  broadcastAcks: { acknowledged: number; of: number } | undefined;
  units: WardFlowState["units"];
  now: Instant;
  track: (request: { type: string; ok: string; refused: string }) => void;
  raise: ReturnType<typeof useWardRaise>;
  pastBroadcasts: BroadcastAlert[];
  movements: WardFlowState["movements"];
  deskRole: string;
  onCompose: (trigger: HTMLButtonElement) => void;
  composeDisabledReason: string | undefined;
  onCopyAnswers: (text: string) => void;
}) {
  // Alerts redesign (1 Nov 2026): each live broadcast is a card with an action bar; then the
  // earlier ones, or an empty state that offers Broadcast alert.
  return (
    <TabPanel idPrefix="alerts" id="broadcast" className={cx(styles.tabBody, tab.tabBody)}>
      {livePullNows.length > 0 ? (
        <section className={styles.group} aria-label="Pull now">
          <GroupHead label="Pull now" count={livePullNows.length} />
          {livePullNows.map((alert) => (
            <PullNowCard key={alert.id} alert={alert} onStandDown={handleStandDown} />
          ))}
        </section>
      ) : null}
      {activeBroadcast ? (
        <BroadcastLiveCard
          alert={activeBroadcast}
          units={units}
          now={now}
          sentByYou={activeBroadcast.dispatchedByRole === deskRole}
          acknowledgements={broadcastAcks}
          onExtend={() => {
            // The notice reads the reducer's verdict from the event log, as every
            // other act on this page does, so a refused extension is not reported.
            track({
              type: "EXTEND_BROADCAST_ALERT",
              ok: `Extended "${activeBroadcast.title}".`,
              refused: "Extension was not accepted.",
            });
            raise("EXTEND_BROADCAST_ALERT", { alertId: activeBroadcast.id });
          }}
          onCopyAnswers={onCopyAnswers}
          onStandDown={() => handleStandDown(activeBroadcast.id)}
        />
      ) : (
        <NoBroadcastLive onCompose={onCompose} composeDisabledReason={composeDisabledReason} />
      )}
      <EarlierBroadcasts
        alerts={pastBroadcasts}
        units={units}
        status={(alert) =>
          alert.status === "stood_down"
            ? `stood down${alert.stoodDownAt !== undefined ? ` ${formatInstant(alert.stoodDownAt)}` : ""}`
            : isAlertLive(alert, movements, now)
              ? "still live"
              : "ended"
        }
      />
    </TabPanel>
  );
}

export function AlertsNoticesPanel({
  feedNotices,
  now,
  umrnLookup,
}: {
  feedNotices: WardFlowState["notices"];
  now: Instant;
  umrnLookup: Parameters<typeof withUmrnInPlaceOfMovementIds>[1];
}) {
  return (
    <TabPanel idPrefix="alerts" id="notices">
      <section className={styles.tabBody} aria-label="Operational notices and shift communication feed">
        <GroupHead label="Role notices" count={feedNotices.length} />
        {feedNotices.length === 0 ? (
          <div className={styles.feedEmpty}>
            <p className={styles.none}>No notices have been raised this session.</p>
          </div>
        ) : (
          <ul className={styles.historyList}>
            {feedNotices.map((notice) => {
              const isRead = notice.readAt !== undefined;
              return (
                <li key={notice.id}>
                  <span className={styles.mono}>{formatInstantWithDay(notice.raisedAt, now)}</span>
                  <StatusGlyph tone={isRead ? "neutral" : "info"} size={9} />
                  <span className={styles.historyText}>
                    <span className={styles.historyTitle}>
                      {withUmrnInPlaceOfMovementIds(notice.sentence, umrnLookup)}
                    </span>
                    <span className={styles.quiet}>To {WARD_FLOW_ROLE_LABELS[notice.to.role]}</span>
                  </span>
                  <span className={styles.quiet}>{isRead ? "Read" : "Unread"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </TabPanel>
  );
}

export function AlertsHistoryPanel({ history, now }: { history: HistoryEntry[]; now: Instant }) {
  return (
    <TabPanel idPrefix="alerts" id="history" className={styles.tabBody}>
      {history.length === 0 ? (
        <EmptyState icon={Clock} title="Nothing recorded this session" />
      ) : (
        <ul className={styles.historyList} aria-label="Recorded this session">
          {history.map((entry) => (
            <li key={entry.id}>
              <span className={styles.mono}>{formatInstantWithDay(entry.at, now)}</span>
              <StatusGlyph tone={entry.tone} size={9} />
              <span className={styles.historyText}>
                <span className={styles.historyTitle}>{entry.title}</span>
                <span className={styles.quiet}>{entry.sub}</span>
              </span>
              <span className={styles.quiet}>{entry.by}</span>
            </li>
          ))}
        </ul>
      )}
    </TabPanel>
  );
}
