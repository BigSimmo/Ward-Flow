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

export function pageDrawsOwnActivity(): boolean {
  return typeof document !== "undefined" && document.querySelector(OWN_ACTIVITY_PANEL) !== null;
}

export function openPageActivity() {
  window.dispatchEvent(new Event(OPEN_ACTIVITY_EVENT));
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

/** The quiet "›" between the place and the page name ("Statewide › Capacity"). */
export function CrumbSeparator() {
  return (
    <span className={parts.crumbSep} aria-hidden="true">
      ›
    </span>
  );
}
