"use client";

// The Alerts screen's parts beside the queue. AL2 (Josh, 3 Nov 2026): the notices sit in Open, what
// this desk acted on and the notices already read sit in Cleared, and the live and past broadcasts
// sit in Broadcasts. Moved out of `alerts-screen.tsx` to keep it under the line cap; the screen keeps
// the state and the acts they call.
import { CheckCheck, Radio } from "lucide-react";
import { useState, type ReactNode } from "react";

import { EmptyState, PanelBoundary, StatusGlyph, TabPanel, cx } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { withUmrnInPlaceOfMovementIds } from "@/components/ward-management/ward-patient-resolver";

import { type BroadcastAlert, type getActiveBroadcastAlert } from "./ward-broadcast-model";
import { isAlertLive } from "./global-alert-view";
import { PullNowCard } from "./global-alert-panels";
import { GroupHead } from "./alerts-queue";
import { AlertsRemindersGroup } from "./alerts-reminders-group";
export { useDueReminderCount } from "./alerts-reminders-group";
import type { HistoryEntry } from "./alerts-history";
import { AddUnitsDialog, addableGroups } from "./broadcast-add-units";
import { BroadcastLiveCard, EarlierBroadcasts } from "./broadcast-live-card";
import styles from "./alerts.module.css";
import tab from "./broadcast-tab.module.css";

/** Broadcasts, at the top: Pull now and the live broadcast with its action bar; nothing when none is live. */
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
            addableGroups(activeBroadcast, units).length === 0 ? "Every desk is already asked." : undefined
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
              ok: `Added ${unitIds.length === 1 ? "1 desk" : `${unitIds.length} desks`} to "${activeBroadcast.title}".`,
              refused: "Adding desks was not accepted.",
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

/**
 * Open, after Act now and Waiting: the person's due reminders from Tools, then the unread notices
 * (Q181). Nothing when there are neither, or when the Open filter leaves them out.
 */
export function AlertsNoticesGroup({
  notices,
  now,
  umrnLookup,
  showReminders = true,
  showNotices = true,
}: {
  notices: WardFlowState["notices"];
  now: Instant;
  umrnLookup: Parameters<typeof withUmrnInPlaceOfMovementIds>[1];
  showReminders?: boolean;
  showNotices?: boolean;
}) {
  return (
    <>
      {showReminders ? <AlertsRemindersGroup now={now} /> : null}
      {notices.length === 0 || !showNotices ? null : (
        <section className={styles.group} aria-label="Notices" data-testid="ward-alerts-notices">
          <GroupHead tone="info" label="Notices" count={notices.length} aside="for information" />
          <NoticeRows notices={notices} now={now} umrnLookup={umrnLookup} />
        </section>
      )}
    </>
  );
}

/**
 * Cleared (AL2): what this desk acted on this session (acknowledged, taken, released, snoozed,
 * returned, beds released), newest first, then the notices already read. Broadcasts have their own
 * view. Each line reads as recorded; nothing here counts down.
 */
export function AlertsClearedPanel({
  history,
  readNotices,
  now,
  umrnLookup,
}: {
  history: HistoryEntry[];
  readNotices: WardFlowState["notices"];
  now: Instant;
  umrnLookup: Parameters<typeof withUmrnInPlaceOfMovementIds>[1];
}) {
  const acted = history.filter((entry) => entry.action);
  return (
    <TabPanel idPrefix="alerts" id="earlier" className={styles.tabBody}>
      {acted.length === 0 && readNotices.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="Nothing cleared this session"
          meta="Alerts you acknowledge, take, release or snooze are listed here, newest first."
        />
      ) : null}
      {acted.length > 0 ? (
        <section className={styles.group} aria-label="Acted on">
          <GroupHead label="Acted on" count={acted.length} aside="this session, newest first" />
          <ul className={styles.historyList} aria-label="Acted on this session">
            {acted.map((entry) => (
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
    </TabPanel>
  );
}

/**
 * Broadcasts (AL2): the live Pull now and broadcast cards, with their actions, then the broadcasts
 * that have ended or been stood down.
 */
export function AlertsBroadcastsPanel({
  live,
  anyLive,
  pastBroadcasts,
  units,
  movements,
  now,
}: {
  live: ReactNode;
  anyLive: boolean;
  pastBroadcasts: BroadcastAlert[];
  units: WardFlowState["units"];
  movements: WardFlowState["movements"];
  now: Instant;
}) {
  return (
    <TabPanel idPrefix="alerts" id="broadcasts" className={styles.tabBody}>
      <PanelBoundary label="Live broadcasts">{live}</PanelBoundary>
      {!anyLive && pastBroadcasts.length === 0 ? (
        <EmptyState icon={Radio} title="No broadcasts this session" meta="Nothing is live." />
      ) : null}
      {pastBroadcasts.length === 0 ? null : (
        <div className={tab.tabBody}>
          <PanelBoundary label="Earlier broadcasts">
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
          </PanelBoundary>
        </div>
      )}
    </TabPanel>
  );
}
