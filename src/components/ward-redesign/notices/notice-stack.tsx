"use client";

import { ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { WfTone } from "@/components/wf";

import { NoticeCard } from "./notice-card";
import { toastStackLayout } from "./notice-stack-layout";
import styles from "./notices.module.css";

/** One notice as the mock-up holds it. Oldest first, as #1124's provider renders them. */
export type MockNotice = {
  id: string;
  tone: WfTone;
  title: string;
  body?: string;
  action?: { label: string; onAction: () => void };
  /** A success or info notice closes itself in the app; a warning or danger stays until closed. */
  autoDismiss?: boolean;
};

/** #1124's exit time (`--wf-t-exit`): a closed card plays out before it is removed. */
const EXIT_MS = 160;

/**
 * Mock-up copy of draft PR #1124's toast region (`ToastRegion` in `src/components/wf/toast-provider.tsx`)
 * for the redesign preview: the polite live region, the folded stack and the "+N more" control, drawn
 * from a fixed list so the stack can be reviewed before it is built (D-91). The real wf toast is not
 * touched and nothing is saved.
 *
 * As in #1124: three or more self-closing notices fold behind the newest; a warning keeps its own row;
 * "+N more" pins the stack open and "Show fewer" folds it again; focus inside the cards opens it; a
 * pinned stack folds again once it no longer needs folding. The control sits outside the live region,
 * so it is never read aloud as an outcome.
 *
 * Redesign changes from #1124 (D-91):
 * - The fold control heads the column, folded or open, so the count sits at one end of one tidy stack
 *   (never between a warning and the folded cards). Folded cards are not drawn behind the newest.
 * - No hover-open. With the control beside the cards, opening on hover moved the control as the
 *   pointer went to it, and the stack folded again under the pointer. Click or focus opens it.
 * - No Recent chip: missed notices go into Activity's "Recent activity" tab.
 * - Desktop cards share one width, so the folded cards line up behind the newest.
 * - On a phone the stack rests clear of the dock and its + (notices.module.css `.region`).
 */
export function NoticeStack({ notices: initial }: { notices: readonly MockNotice[] }) {
  const [notices, setNotices] = useState<readonly (MockNotice & { leaving?: boolean })[]>(initial);
  const [pinned, setPinned] = useState(false);
  const [focused, setFocused] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const close = (id: string) => {
    setNotices((list) => list.map((notice) => (notice.id === id ? { ...notice, leaving: true } : notice)));
    timers.current.push(
      window.setTimeout(() => setNotices((list) => list.filter((notice) => notice.id !== id)), EXIT_MS),
    );
  };

  const expanded = pinned || focused;
  const layout = toastStackLayout(notices, expanded);
  const needsPin = toastStackLayout(notices, false).folded;
  if (pinned && !needsPin) setPinned(false);
  const showControl = layout.folded || (expanded && needsPin);
  // Redesign (final round): the control heads the whole column, folded or open, so the count sits at
  // one end of one stack rather than between two cards.
  const rowOf = (row: number) => (layout.folded ? row + 1 : row);

  if (notices.length === 0) return null;

  return (
    <div className={styles.region} data-notice-stack="">
      <div className={styles.list} data-stack={layout.folded ? "folded" : undefined}>
        {showControl ? (
          <div className={styles.fold} style={layout.folded ? { gridRow: 1 } : undefined}>
            <button
              type="button"
              className={styles.foldButton}
              aria-expanded={!layout.folded}
              onClick={() => setPinned((open) => !open)}
            >
              {layout.folded ? (
                <>
                  <span className={styles.foldCount}>+{layout.hiddenCount}</span> more
                </>
              ) : (
                <>
                  <ChevronUp aria-hidden="true" size={14} className={styles.foldChevron} />
                  Show fewer
                </>
              )}
            </button>
          </div>
        ) : null}
        <div
          className={styles.live}
          role="status"
          aria-live="polite"
          aria-relevant="additions text"
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
          }}
        >
          {notices.map((notice) => {
            const slot = layout.slots.get(notice.id);
            const style: CSSProperties | undefined = slot
              ? ({
                  gridRow: rowOf(slot.row),
                  zIndex: 10 - slot.depth,
                  "--notice-depth": slot.depth,
                  opacity: slot.faded ? 0 : undefined,
                } as CSSProperties)
              : undefined;
            return (
              <NoticeCard
                key={notice.id}
                tone={notice.tone}
                title={notice.title}
                body={notice.body}
                action={notice.action}
                autoDismiss={notice.autoDismiss}
                leaving={notice.leaving}
                depth={slot?.depth}
                faded={slot?.faded}
                style={style}
                onClose={() => close(notice.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
