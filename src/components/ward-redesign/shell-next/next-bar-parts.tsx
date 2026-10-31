"use client";

// shell-next (Josh, 30 Oct 2026): the new parts of the redesigned app bar, kept beside the fork so
// `next-bar.tsx` stays under the line cap.

import { Segmented } from "@/components/wf";

import parts from "@/components/ward-redesign/shell-next/next-bar.module.css";

export type AlertsTab = "alerts" | "activity";

/**
 * A page that draws its own Activity panel (the Home and Activity mock-up) marks itself with this
 * attribute and listens for this event (`_preview/preview-shell.tsx`). The Activity tab opens that
 * panel there, as the old Activity button did.
 */
const OWN_ACTIVITY_PANEL = "[data-mockup-activity-panel]";
const OPEN_ACTIVITY_EVENT = "wf-mockup:open-activity";
const ALERTS_PANEL = '[data-testid="ward-bar-tasks-sheet"]';

/** Sent when a header action opens a sheet of its own, so the rail's More and Menu sheets close. */
export const CLOSE_MENUS_EVENT = "wf-next:close-menus";

export function pageDrawsOwnActivity(): boolean {
  return typeof document !== "undefined" && document.querySelector(OWN_ACTIVITY_PANEL) !== null;
}

/**
 * Opens the page's own Activity panel once the Alerts panel has gone, with focus back on the Alerts
 * button first, so the page's panel returns focus there on Escape (the tab it was opened from no
 * longer exists). Gives up waiting after about a second and opens the panel anyway.
 */
export function openPageActivity(returnTo: HTMLElement | null) {
  const started = performance.now();
  const step = () => {
    const alertsPanelOpen = document.querySelector(ALERTS_PANEL) !== null;
    if (alertsPanelOpen && performance.now() - started < 1000) {
      requestAnimationFrame(step);
      return;
    }
    returnTo?.focus();
    window.dispatchEvent(new Event(OPEN_ACTIVITY_EVENT));
  };
  requestAnimationFrame(step);
}

/**
 * One place for "what needs me": the Alerts (or Tasks) list and Activity are two tabs of one panel,
 * opened from the bar's one Alerts button. The alerts tab keeps its own words: a desk whose list is
 * the bed coordinator's says Tasks.
 */
export function NextAlertsTabs({
  current,
  alertsLabel,
  alertsCount,
  unreadNotices,
  onChoose,
}: {
  current: AlertsTab;
  alertsLabel: string;
  alertsCount: number;
  unreadNotices: number;
  onChoose: (tab: AlertsTab) => void;
}) {
  return (
    <div className={parts.alertsTabs} data-testid="next-bar-alerts-tabs">
      <Segmented<AlertsTab>
        label="Alerts and activity"
        value={current}
        onChange={(tab) => {
          if (tab !== current) onChoose(tab);
        }}
        items={[
          { id: "alerts", label: alertsLabel, count: alertsCount },
          {
            id: "activity",
            // The count here is unread notices only; recorded events are not counted.
            label: "Activity",
            count: unreadNotices > 0 ? unreadNotices : undefined,
          },
        ]}
      />
    </div>
  );
}
