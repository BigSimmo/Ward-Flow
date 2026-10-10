"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { SrOnly, cx } from "@/components/wf";

import styles from "./statistics-hero-tools.module.css";

/** D4: the exact words for a control that is shown for review but not connected. */
const NOT_WIRED = "Not wired in this prototype.";

const RANGES = [
  { id: "now", label: "Now" },
  { id: "shift", label: "Shift" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
] as const;

/**
 * The time range on every statistics hero, as one compact pill that opens the choices. Only Now is
 * backed: the prototype keeps no history, so Shift, 7 days and 30 days are Preview (dashed) and say
 * so when pressed.
 */
export function StatisticsRange() {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  useEffect(() => {
    if (!said) return;
    const timer = window.setTimeout(() => setSaid(false), 4000);
    return () => window.clearTimeout(timer);
  }, [said]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className={styles.range} ref={rootRef} data-testid="ward-statistics-range">
      <button
        type="button"
        className={styles.tool}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <CalendarRange size={14} aria-hidden="true" />
        <SrOnly>Time range: </SrOnly>
        Now
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      <div id={listId} className={styles.rangeList} role="group" aria-label="Time range" hidden={!open}>
        {RANGES.map((range) =>
          range.id === "now" ? (
            <button
              key={range.id}
              type="button"
              className={cx(styles.rangeItem, styles.rangeOn)}
              aria-pressed="true"
              onClick={() => setOpen(false)}
            >
              {range.label}
            </button>
          ) : (
            <button
              key={range.id}
              type="button"
              className={cx(styles.rangeItem, styles.preview)}
              aria-pressed="false"
              aria-disabled="true"
              title={`Preview. History starts when the metrics store records. ${NOT_WIRED}`}
              onClick={() => setSaid(true)}
            >
              {range.label}
              <SrOnly>, Preview</SrOnly>
            </button>
          ),
        )}
      </div>
      <span className={styles.rangeSaid} role="status">
        {said ? `Preview. History starts when the metrics store records. ${NOT_WIRED}` : ""}
      </span>
    </div>
  );
}

/** One page tool on the hero band: a link or a button, dark-band styling. */
export function HeroTool({
  href,
  onClick,
  icon,
  children,
  preview,
  testId,
}: {
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Shown for review but not connected (dashed, D4 wording). */
  preview?: boolean;
  testId?: string;
}) {
  const className = cx(styles.tool, preview && styles.preview);
  if (href && !preview) {
    return (
      <Link href={href} className={className} data-testid={testId}>
        {icon}
        <span className={styles.toolLabel}>{children}</span>
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-disabled={preview || undefined}
      title={preview ? NOT_WIRED : undefined}
      data-testid={testId}
    >
      {icon}
      <span className={styles.toolLabel}>{children}</span>
      {preview ? <SrOnly>. {NOT_WIRED}</SrOnly> : null}
    </button>
  );
}

/** Previous and next unit beside the title: wraps at either end, so every unit is reachable. */
export function UnitStepper({
  items,
  currentId,
  noun,
}: {
  items: ReadonlyArray<{ id: string; href: string; label: string }>;
  currentId: string;
  /** "ward", "ED", "service" or "team", for the accessible names. */
  noun: string;
}) {
  const index = items.findIndex((item) => item.id === currentId);
  if (index < 0 || items.length < 2) return null;
  const previous = items[(index - 1 + items.length) % items.length];
  const next = items[(index + 1) % items.length];
  return (
    <span className={styles.stepper} data-testid="ward-statistics-unit-stepper">
      <Link href={previous.href} className={styles.stepLink} aria-label={`Previous ${noun}: ${previous.label}`}>
        <ChevronLeft size={14} aria-hidden="true" />
      </Link>
      <Link href={next.href} className={styles.stepLink} aria-label={`Next ${noun}: ${next.label}`}>
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </span>
  );
}
