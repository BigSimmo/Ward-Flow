"use client";

import { History } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { Popover } from "./menu";
import styles from "./overlay.module.css";
import { StatusGlyph } from "./status-glyph";
import { useMinuteNow } from "./use-minute-now";

/** How many outcomes the Recent list keeps. */
export const RECENT_TOAST_LIMIT = 10;

/** How long the Recent control stays on screen after the last notice leaves. */
export const RECENT_CHIP_MS = 30_000;

/**
 * An outcome that has left the screen. Kept in memory for this visit only, never in browser
 * storage, and with no callbacks: an Undo that has run out is never offered again.
 */
export type RecentToast = {
  id: string;
  tone: "success" | "info" | "warning" | "danger";
  title: string;
  body?: string;
  /** When it left the screen (ms). */
  at: number;
  /** The person pressed Undo on it. */
  undone: boolean;
};

function ago(at: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ago`;
}

function RecentList({ recent, onClear }: { recent: RecentToast[]; onClear: () => void }) {
  const now = useMinuteNow();
  return (
    <>
      <div className={styles.recentHead}>
        <span className={styles.heading}>Recent notices</span>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={recent.length === 0}>
          Clear list
        </Button>
      </div>
      {recent.length ? (
        <ol className={styles.recentList} data-testid="toast-recent-list">
          {recent.map((entry) => (
            <li key={entry.id} className={styles.recentItem}>
              {/* Nothing here needs action now, so red's act-now meaning is kept for live notices. */}
              <StatusGlyph tone={entry.tone === "danger" ? "warning" : entry.tone} />
              <span className={styles.recentWords}>
                <span>{entry.title}</span>
                {entry.body ? <span className={styles.recentBody}>{entry.body}</span> : null}
                {entry.undone ? <span className={styles.recentBody}>Undone</span> : null}
              </span>
              <span className={styles.recentWhen}>{ago(entry.at, now)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.recentEmpty}>No notices yet.</p>
      )}
      <p className={styles.recentEmpty}>This list is kept on this page only and clears when it reloads.</p>
    </>
  );
}

/**
 * The Recent control beside the toasts. It appears for half a minute once a notice has left the
 * screen and none is showing, so a notice that went before it was read can be found again. Alt+N
 * opens it at any time (`openRequest`). The list itself is the provider's memory-only `recent`.
 */
export function ToastRecent({
  recent,
  liveCount,
  onClear,
  openRequest,
}: {
  recent: RecentToast[];
  liveCount: number;
  onClear: () => void;
  /** Bumped to open the list from the keyboard. */
  openRequest: number;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const newest = recent[0]?.at ?? 0;
  const [shownFor, setShownFor] = useState(0);
  const [handledRequest, setHandledRequest] = useState(openRequest);
  const [opening, setOpening] = useState(false);
  const offered = newest !== 0 && shownFor === newest;

  // Offer the control when a notice leaves, then withdraw it after half a minute unless it is open.
  if (newest !== 0 && shownFor !== newest && shownFor !== -newest) setShownFor(newest);
  // Alt+N with no notice showing: show the control and open the list.
  if (openRequest !== handledRequest) {
    setHandledRequest(openRequest);
    if (newest !== 0) {
      setShownFor(newest);
      setOpening(true);
    }
  }

  useEffect(() => {
    if (!offered) return;
    let timer = 0;
    const withdraw = () => {
      const anchor = anchorRef.current;
      const trigger = anchor?.querySelector("button");
      if (trigger?.getAttribute("aria-expanded") === "true" || anchor?.contains(document.activeElement)) {
        timer = window.setTimeout(withdraw, RECENT_CHIP_MS);
        return;
      }
      setShownFor(-newest);
    };
    timer = window.setTimeout(withdraw, RECENT_CHIP_MS);
    return () => window.clearTimeout(timer);
  }, [offered, newest]);

  useEffect(() => {
    if (!opening) return;
    const frame = window.requestAnimationFrame(() => {
      setOpening(false);
      const trigger = anchorRef.current?.querySelector<HTMLButtonElement>("button");
      if (trigger && trigger.getAttribute("aria-expanded") !== "true") trigger.click();
      else trigger?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [opening]);

  const visible = offered && liveCount === 0;
  if (!visible || recent.length === 0) return null;

  return (
    <span ref={anchorRef} className={styles.recentAnchor} data-testid="toast-recent">
      <Popover
        label="Recent notices"
        align="end"
        panelClassName={styles.recentPanel}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            className={styles.toastToolButton}
            aria-label={`Recent notices, ${recent.length}`}
          >
            <History size={14} aria-hidden="true" />
            Recent
            <span className={styles.toastToolCount} aria-hidden="true">
              {recent.length}
            </span>
          </button>
        )}
      >
        {(close) => (
          <RecentList
            recent={recent}
            onClear={() => {
              onClear();
              close({ restoreFocus: false });
            }}
          />
        )}
      </Popover>
    </span>
  );
}
