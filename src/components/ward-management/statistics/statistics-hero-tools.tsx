"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import styles from "./statistics-hero-tools.module.css";

/** One page tool on the hero band: a link or a button, dark-band styling. */
export function HeroTool({
  href,
  onClick,
  icon,
  children,
  testId,
}: {
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  const className = styles.tool;
  // The label hides on narrower desktops, leaving the icon, so the name stays as a tooltip.
  const label = typeof children === "string" ? children : undefined;
  if (href) {
    return (
      <Link href={href} className={className} title={label} data-testid={testId}>
        {icon}
        <span className={styles.toolLabel}>{children}</span>
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} title={label} data-testid={testId}>
      {icon}
      <span className={styles.toolLabel}>{children}</span>
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
