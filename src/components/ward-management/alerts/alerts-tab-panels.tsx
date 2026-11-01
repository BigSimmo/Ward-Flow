"use client";

// The Alerts screen's parts beside the queue (Q181, Josh 1 Nov 2026): the live broadcast and the
// notices sit in Now, and what this session recorded sits in Earlier today. Moved out of
// `alerts-screen.tsx` to keep it under the line cap; the screen keeps the state and the acts they call.
import { Clock } from "lucide-react";
import { useState } from "react";

import { EmptyState, StatusGlyph, TabPanel, cx } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { withUmrnInPlaceOfMovementIds } from "@/components/ward-management/ward-patient-resolver";

import { type BroadcastAlert, type getActiveBroadcastAlert } from "./ward-broadcast-model";
import { isAlertLive } from "./global-alert-view";
import { PullNowCard } from "./global-alert-panels";
import { GroupHead } from "./alerts-queue";
import type { HistoryEntry } from "./alerts-history";
import { AddUnitsDialog, addableGroups } from "./broadcast-add-units";
import { BroadcastLiveCard, EarlierBroadcasts } from "./broadcast-live-card";
import styles from "./alerts.module.css";
import tab from "./broadcast-tab.module.css";

/** Now, at the top: Pull now and the live broadcast with its action bar; nothing when none is live. */
export function AlertsLiveBroadcasts({
  livePullNows,
  handleStandDown,
  activeBroadcast,
  broadcastAcks,
  units,
  now,
  track,
  raise,
  deskRole,
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
  deskRole: string;
  onCopyAnswers: (text: string) => void;
}) {
  // Alerts redesign (1 Nov 2026): each live broadcast is a card with an action bar. Broadcast alert
  // itself is under the hero's More (Q184), so no empty state offers it here.
  // The broadcast Add units opened on: if another broadcast replaces it, the dialog closes rather than retarget.
  const [addingUnits, setAddingUnits] = useState<string | null>(null);
  if (livePullNows.length === 0 && !activeBroadcast) return null;
  return (
    <div id="alerts-live-broadcast" className={cx(styles.tabBody, tab.tabBody)} data-testid="ward-alerts-live">
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
          onAddUnits={() => setAddingUnits(activeBroadcast.id)}
          addUnitsDisabledReason={
            addableGroups(activeBroadcast, units).length === 0 ? "Every unit is already asked." : undefined
          }
          onCopyAnswers={onCopyAnswers}
          onStandDown={() => handleStandDown(activeBroadcast.id)}
        />
      ) : null}
      {activeBroadcast && addingUnits === activeBroadcast.id ? (
        <AddUnitsDialog
          alert={activeBroadcast}
          units={units}
          onClose={() => setAddingUnits(null)}
          onAdd={(unitIds) => {
            setAddingUnits(null);
            track({
              type: "ADD_BROADCAST_ALERT_UNITS",
              ok: `Added ${unitIds.length === 1 ? "1 unit" : `${unitIds.length} units`} to "${activeBroadcast.title}".`,
              refused: "Adding units was not accepted.",
            });
            raise("ADD_BROADCAST_ALERT_UNITS", { alertId: activeBroadcast.id, unitIds });
          }}
        />
      ) : null}
    </div>
  );
}

/** One notice line, as the old Notices tab drew it. */
function NoticeRows({
  notices,
  now,
  umrnLookup,
}: {
  notices: WardFlowState["notices"];
  now: Instant;
  umrnLookup: Parameters<typeof withUmrnInPlaceOfMovementIds>[1];
}) {
  return (
    <ul className={styles.historyList}>
      {notices.map((notice) => {
        const isRead = notice.readAt !== undefined;
        return (
          <li key={notice.id}>
            <span className={styles.mono}>{formatInstantWithDay(notice.raisedAt, now)}</span>
            <StatusGlyph tone={isRead ? "neutral" : "info"} size={9} />
            <span className={styles.historyText}>
              <span className={styles.historyTitle}>{withUmrnInPlaceOfMovementIds(notice.sentence, umrnLookup)}</span>
              <span className={styles.quiet}>To {WARD_FLOW_ROLE_LABELS[notice.to.role]}</span>
            </span>
            <span className={styles.quiet}>{isRead ? "Read" : "Unread"}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Now, after Act now and Waiting: the unread notices (Q181). Nothing when there are none. */
export function AlertsNoticesGroup({
  notices,
  now,
  umrnLookup,
}: {
  notices: WardFlowState["notices"];
  now: Instant;
  umrnLookup: Parameters<typeof withUmrnInPlaceOfMovementIds>[1];
}) {
  if (notices.length === 0) return null;
  return (
    <section className={styles.group} aria-label="Notices" data-testid="ward-alerts-notices">
      <GroupHead tone="info" label="Notices" count={notices.length} aside="for information" />
      <NoticeRows notices={notices} now={now} umrnLookup={umrnLookup} />
    </section>
  );
}

/**
 * Earlier today (Q181): what this session recorded, the notices already read and the broadcasts
 * that have ended.
 */
export function AlertsEarlierPanel({
  history,
  readNotices,
  pastBroadcasts,
  units,
  movements,
  now,
  umrnLookup,
}: {
  history: HistoryEntry[];
  readNotices: WardFlowState["notices"];
  pastBroadcasts: BroadcastAlert[];
  units: WardFlowState["units"];
  movements: WardFlowState["movements"];
  now: Instant;
  umrnLookup: Parameters<typeof withUmrnInPlaceOfMovementIds>[1];
}) {
  const nothing = history.length === 0 && readNotices.length === 0 && pastBroadcasts.length === 0;
  return (
    <TabPanel idPrefix="alerts" id="earlier" className={styles.tabBody}>
      {nothing ? <EmptyState icon={Clock} title="Nothing recorded this session" /> : null}
      {history.length > 0 ? (
        <section className={styles.group} aria-label="Recorded this session">
          <GroupHead label="Recorded this session" count={history.length} />
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
        </section>
      ) : null}
      {readNotices.length > 0 ? (
        <section className={styles.group} aria-label="Notices read">
          <GroupHead label="Notices read" count={readNotices.length} />
          <NoticeRows notices={readNotices} now={now} umrnLookup={umrnLookup} />
        </section>
      ) : null}
      <EarlierBroadcasts
        alerts={pastBroadcasts}
        units={units}
        now={now}
        status={(alert) =>
          alert.status === "stood_down"
            ? `stood down${alert.stoodDownAt !== undefined ? ` ${formatInstantWithDay(alert.stoodDownAt, now)}` : ""}`
            : isAlertLive(alert, movements, now)
              ? "still live"
              : "ended"
        }
      />
    </TabPanel>
  );
}
