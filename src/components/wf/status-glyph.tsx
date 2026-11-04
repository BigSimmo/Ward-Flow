import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./status-glyph.module.css";

/**
 * v6 rule 7: each tone has one shape everywhere. Triangle act now, filled amber circle at risk,
 * tick done, capsule moving, ring waiting, cross declined or closed. The glyph is decoration: the word
 * or value beside it carries the meaning, so it is always `aria-hidden`.
 */
export type WfTone = "danger" | "warning" | "success" | "info" | "neutral" | "closed";

const DANGER = "M4.13 1.4a1 1 0 0 1 1.74 0l3.6 6.3a1 1 0 0 1-.87 1.5H1.4a1 1 0 0 1-.87-1.5Z";
/** From 12px up there is room for the exclamation mark, cut out of the triangle as Home's hero draws it. */
const DANGER_MARKED = `${DANGER}M4.45 4.1a.55.55 0 0 1 1.1 0v1.9a.55.55 0 0 1-1.1 0ZM5 6.75a.62.62 0 1 0 0 1.24.62.62 0 1 0 0-1.24Z`;

// The geometry is immutable: share these elements instead of memoising six branches per glyph.
const SHAPES: Readonly<Record<WfTone, ReactNode>> = {
  // Icon audit (3 Nov 2026): softened corners, the way Apple and Home's own set draw the warning
  // triangle, so it reads as a crafted mark rather than a typed ▲.
  danger: <path d={DANGER} fill="currentColor" />,
  warning: <circle cx="5" cy="5" r="4" fill="currentColor" />,
  success: (
    <path
      d="M1.4 5.4 3.9 7.8 8.6 2.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  info: <rect x="0.6" y="2.9" width="8.8" height="4.2" rx="2.1" fill="currentColor" />,
  neutral: <circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  closed: <path d="M2 2 8 8M8 2 2 8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
};

export function StatusGlyph({ tone, size = 10, className }: { tone: WfTone; size?: number; className?: string }) {
  const cls = cx(styles.glyph, styles[tone], className);
  return (
    <svg
      className={cls}
      data-wf-glyph={tone}
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden="true"
      focusable="false"
    >
      {tone === "danger" && size >= 12 ? (
        <path d={DANGER_MARKED} fill="currentColor" fillRule="evenodd" />
      ) : Object.hasOwn(SHAPES, tone) ? (
        SHAPES[tone]
      ) : null}
    </svg>
  );
}

/** An 8px status dot in the same shape language, for meters and legends. */
export function Dot({ tone, className }: { tone: WfTone; className?: string }) {
  return <StatusGlyph tone={tone} size={8} className={cx(styles.dot, className)} />;
}
