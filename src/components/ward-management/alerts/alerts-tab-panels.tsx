"use client";

// The Alerts screen's Broadcast, Notices and History tab panels. Moved out of `alerts-screen.tsx`
// to keep it under the line cap; the screen keeps the state and the acts they call.
import { Clock, Radio, X } from "lucide-react";

import { Badge, Button, EmptyState, StatusGlyph, TabPanel, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { withUmrnInPlaceOfMovementIds } from "@/components/ward-management/ward-patient-resolver";

import {
  broadcastKind,
  type BroadcastAlert,
  type BroadcastSeverity,
  type getActiveBroadcastAlert,
} from "./ward-broadcast-model";
import { isAlertLive } from "./global-alert-view";
import { PullNowCard, ReplyBoardList } from "./global-alert-panels";
import { minutesText } from "./alerts-model";
import { GroupHead } from "./alerts-queue";
import { TimeRing } from "./alerts-visuals";
import type { HistoryEntry } from "./alerts-history";
import styles from "./alerts.module.css";

export function AlertsBroadcastPanel({
  livePullNows,
  handleStandDown,
  activeBroadcast,
  directiveTone,
  severityLabel,
  broadcastAcks,
  units,
  now,
  track,
  raise,
  pastBroadcasts,
  movements,
}: {
  livePullNows: BroadcastAlert[];
  handleStandDown: (alertId: string) => void;
  activeBroadcast: ReturnType<typeof getActiveBroadcastAlert>;
  directiveTone: WfTone;
  severityLabel: (severity: BroadcastSeverity) => string;
  broadcastAcks: { acknowledged: number; of: number } | undefined;
  units: WardFlowState["units"];
  now: Instant;
  track: (request: { type: string; ok: string; refused: string }) => void;
  raise: ReturnType<typeof useWardRaise>;
  pastBroadcasts: BroadcastAlert[];
  movements: WardFlowState["movements"];
}) {
  return (
    <TabPanel idPrefix="alerts" id="broadcast" className={styles.tabBody}>
      {livePullNows.length > 0 ? (
        <section className={styles.group} aria-label="Pull now">
          <GroupHead label="Pull now" count={livePullNows.length} />
          {livePullNows.map((alert) => (
            <PullNowCard key={alert.id} alert={alert} onStandDown={handleStandDown} />
          ))}
        </section>
      ) : null}
      {activeBroadcast ? (
        <div
          className={styles.directive}
          data-severity={activeBroadcast.severity}
          role="group"
          aria-live="assertive"
          aria-atomic="true"
          aria-label="Current broadcast"
        >
          {/* The acknowledged-units count below is announced; this sentence travels with it
                          (tests/ward-announced-figures-carry-their-marker, tier b). Screen readers only. */}
          <span className="sr-only">These counts are invented figures.</span>
          <div className={styles.directiveMain}>
            <div className={styles.directiveHead}>
              <StatusGlyph tone={directiveTone} />
              <strong className={styles.directiveTitle}>{activeBroadcast.title}</strong>
              <Badge tone={directiveTone}>{severityLabel(activeBroadcast.severity)}</Badge>
            </div>
            <p className={styles.directiveMessage}>{activeBroadcast.message}</p>
            <dl className={styles.facts}>
              <div>
                <dt>Sent to</dt>
                <dd>{activeBroadcast.targetScopeLabel}</dd>
              </div>
              <div>
                <dt>Sent</dt>
                <dd>
                  <span className={styles.mono}>{formatInstantWithDay(activeBroadcast.dispatchedAt, now)}</span> by{" "}
                  {activeBroadcast.dispatchedByName}
                </dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>
                  <span className={styles.mono}>{formatInstantWithDay(activeBroadcast.expiresAt, now)}</span>, in{" "}
                  <span className={styles.mono}>{minutesText(Math.max(0, activeBroadcast.expiresAt - now))}</span>
                </dd>
              </div>
              {broadcastAcks ? (
                <div>
                  <dt>Acknowledged</dt>
                  <dd>
                    <span>
                      {broadcastAcks.acknowledged} of {broadcastAcks.of} units{" "}
                      {broadcastKind(activeBroadcast) === "directive" ? "acknowledged" : "answered"}
                    </span>
                  </dd>
                </div>
              ) : null}
            </dl>
            {broadcastKind(activeBroadcast) === "bed_call" ? (
              <ReplyBoardList alert={activeBroadcast} units={units} now={now} />
            ) : null}
            <div className={styles.directiveActions}>
              <Button
                size="sm"
                icon={X}
                className={styles.btn}
                aria-label="Stand down this alert"
                onClick={() => handleStandDown(activeBroadcast.id)}
              >
                Stand down
              </Button>
              <Button
                size="sm"
                icon={Clock}
                onClick={() => {
                  // The notice reads the reducer's verdict from the event log, as every
                  // other act on this page does, so a refused extension is not reported.
                  track({
                    type: "EXTEND_BROADCAST_ALERT",
                    ok: `Extended "${activeBroadcast.title}".`,
                    refused: "Extension was not accepted.",
                  });
                  raise("EXTEND_BROADCAST_ALERT", { alertId: activeBroadcast.id });
                }}
              >
                Extend
              </Button>
            </div>
          </div>
          <div className={styles.directiveRing}>
            <TimeRing from={activeBroadcast.dispatchedAt} until={activeBroadcast.expiresAt} now={now} size={96} />
            <span className={styles.quiet}>time left</span>
          </div>
        </div>
      ) : (
        <EmptyState icon={Radio} title="No broadcast live" meta={`Checked ${formatInstantWithDay(now, now)}`} />
      )}
      {pastBroadcasts.length > 0 ? (
        <section className={styles.group} aria-label="Earlier broadcasts">
          <GroupHead label="Earlier this session" count={pastBroadcasts.length} />
          <ul className={styles.historyList}>
            {pastBroadcasts.map((alert) => (
              <li key={alert.id}>
                <span className={styles.mono}>{formatInstantWithDay(alert.dispatchedAt, now)}</span>
                <StatusGlyph tone="neutral" size={9} />
                <span className={styles.historyText}>
                  <span className={styles.historyTitle}>{alert.title}</span>
                  <span className={styles.quiet}>
                    {alert.status === "stood_down"
                      ? "Stood down"
                      : isAlertLive(alert, movements, now)
                        ? "Still live"
                        : "Ended"}{" "}
                    · {alert.targetScopeLabel}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
        <EmptyState
          icon={Clock}
          title="Nothing recorded this session"
          meta="Acknowledgements, takes, snoozes, bed releases and broadcasts"
        />
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
