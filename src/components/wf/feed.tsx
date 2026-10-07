"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, Check, type LucideIcon } from "lucide-react";
import { Button } from "./button";
import { cx } from "./cx";
import { clk } from "./format";
import { Icon } from "./icon";
import { SrOnly } from "./primitives";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./feed.module.css";

export type TimelineItem = {
  id: string;
  /** Clock time (`Date` or epoch ms, shown as HH:MM) or a preformatted string. */
  at: Date | number | string;
  tone: WfTone;
  text: ReactNode;
  /** Right-aligned meta ("-1", "+1"). */
  meta?: ReactNode;
};

export type TimelineProps = {
  /** Newest first. */
  items: TimelineItem[];
  /**
   * Hold new items back behind an "N new" button so the list never reorders while someone is
   * reading. On by default.
   */
  holdNew?: boolean;
  /** Accessible name for the list. */
  label?: string;
  className?: string;
};

/**
 * Timeline with glyph nodes and mono times. Items that arrive after mount wait behind an
 * "N new" button; "Up to date" shows when nothing is waiting.
 */
export function Timeline({ items, holdNew = true, label = "Recent activity", className }: TimelineProps) {
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(items.map((item) => item.id)));
  const held = holdNew ? items.filter((item) => !seen.has(item.id)) : [];
  const shown = holdNew ? items.filter((item) => seen.has(item.id)) : items;
  return (
    <div className={cx(styles.tlWrap, className)}>
      {holdNew ? (
        held.length > 0 ? (
          <Button
            variant="sec"
            size="sm"
            icon={ChevronDown}
            className={styles.tlNew}
            onClick={() => setSeen(new Set(items.map((item) => item.id)))}
          >
            {held.length} new
          </Button>
        ) : (
          <span className={styles.upToDate}>
            <Icon icon={Check} size={14} />
            Up to date
          </span>
        )
      ) : null}
      <ol className={styles.tl} aria-label={label}>
        {shown.map((item) => (
          <li key={item.id} className={styles.ev}>
            <span className={styles.time}>{typeof item.at === "string" ? item.at : clk(item.at)}</span>
            <span className={styles.node}>
              <StatusGlyph tone={item.tone} size={10} />
            </span>
            <span className={styles.text}>{item.text}</span>
            {item.meta != null ? <span className={styles.evMeta}>{item.meta}</span> : <span />}
          </li>
        ))}
      </ol>
    </div>
  );
}

export type AvatarProps = {
  /** Full name, used for the accessible name and to derive initials. */
  name: string;
  initials?: string;
  me?: boolean;
  online?: boolean;
  size?: "md" | "lg";
  /** Set when the name is already written beside the avatar, so it is not read twice. */
  decorative?: boolean;
  className?: string;
};

function initialsOf(name: string): string {
  const parts = name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/** Round initials avatar. Names go in text too, not initials alone. */
export function Avatar({
  name,
  initials,
  me = false,
  online = false,
  size = "md",
  decorative = false,
  className,
}: AvatarProps) {
  return (
    <span
      className={cx(styles.av, size === "lg" && styles.lg, me && styles.me, className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : online ? `${name}, online` : name}
      aria-hidden={decorative || undefined}
      title={name}
    >
      <span aria-hidden="true">{initials ?? initialsOf(name)}</span>
      {online ? <span className={styles.online} aria-hidden="true" /> : null}
    </span>
  );
}

export function AvatarStack({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx(styles.stack, className)}>{children}</span>;
}

/** Shimmer block. Decorative: set `aria-busy` on the loading region. */
export function Skeleton({
  width = "100%",
  height = 12,
  radius,
  className,
}: {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  radius?: "xs" | "sm" | "pill";
  className?: string;
}) {
  return (
    <span
      className={cx(styles.sk, className)}
      style={{ width, height, borderRadius: radius ? `var(--wf-r-${radius})` : undefined }}
      aria-hidden="true"
    />
  );
}

/** A few skeleton lines with uneven widths. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["92%", "64%", "78%", "52%", "86%"];
  return (
    <span className={cx(styles.skLines, className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={widths[index % widths.length]} />
      ))}
    </span>
  );
}

export type EmptyStateProps = {
  /** Short and specific: "No delays waiting on you". */
  title: ReactNode;
  /** Age or scope only: "Checked at 10:42". No filler sentence. */
  meta?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

/** Empty state: one line and its age. Never a blank box, never an explanation. */
export function EmptyState({ title, meta, icon = Check, action, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      <span className={styles.emptyMark} aria-hidden="true">
        <Icon icon={icon} size={16} />
      </span>
      <span className={styles.emptyText}>
        <span className={styles.emptyTitle}>{title}</span>
        {meta ? <span className={styles.emptyMeta}>{meta}</span> : null}
      </span>
      {action}
    </div>
  );
}

export type StatusLineProps = {
  tone?: WfTone;
  /** Bold lead ("Stale", "Offline", "Transport did not load"). */
  title: ReactNode;
  /** Short meta after it ("as at 10:26"). */
  meta?: ReactNode;
  /** Actions: Refresh, Retry, Compare and Keep mine. */
  actions?: ReactNode;
  /** Use `alert` for a load error the user must act on; otherwise it is a polite status. */
  role?: "status" | "alert";
  className?: string;
};

/** One-line state: stale, offline, load error, edit conflict, view only, saving. */
export function StatusLine({ tone, title, meta, actions, role = "status", className }: StatusLineProps) {
  return (
    <div className={cx(styles.line, className)} role={role}>
      {tone ? <StatusGlyph tone={tone} /> : null}
      <span className={styles.lineText}>
        <span className={styles.lineTitle}>{title}</span>
        {meta ? (
          <>
            <SrOnly>, </SrOnly> {meta}
          </>
        ) : null}
      </span>
      {actions ? <span className={styles.lineActions}>{actions}</span> : null}
    </div>
  );
}
