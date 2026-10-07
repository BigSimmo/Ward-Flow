import styles from "./status-glyph.module.css";

/**
 * v6 rule 7: each tone has one shape everywhere. Triangle act now, filled amber circle at risk,
 * tick done, dot moving, ring waiting, cross declined or closed. The glyph is decoration: the word
 * or value beside it carries the meaning, so it is always `aria-hidden`.
 */
export type WfTone = "danger" | "warning" | "success" | "info" | "neutral" | "closed";

export function StatusGlyph({ tone, size = 10, className }: { tone: WfTone; size?: number; className?: string }) {
  const cls = [styles.glyph, styles[tone], className].filter(Boolean).join(" ");
  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      {tone === "danger" && <path d="M5 0.8 9.6 9.2H0.4Z" fill="currentColor" />}
      {tone === "warning" && <circle cx="5" cy="5" r="4" fill="currentColor" />}
      {tone === "success" && (
        <path
          d="M1.4 5.4 3.9 7.8 8.6 2.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {tone === "info" && <circle cx="5" cy="5" r="3.4" fill="currentColor" />}
      {tone === "neutral" && <circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {tone === "closed" && (
        <path d="M2 2 8 8M8 2 2 8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** An 8px status dot in the same shape language, for meters and legends. */
export function Dot({ tone, className }: { tone: WfTone; className?: string }) {
  return <StatusGlyph tone={tone} size={8} className={[styles.dot, className].filter(Boolean).join(" ")} />;
}
