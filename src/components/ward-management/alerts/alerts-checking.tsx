"use client";

// The Alerts screen's Checking list, its chip and one-tap card, and the nurse in charge's quiet side
// panel (Alerts redesign, approved by Josh 31 Oct 2026). Split from `alerts-screen.tsx` for the line cap.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Activity, Bell, CheckCircle2, ChevronDown, ChevronRight, X } from "lucide-react";

import type { WardAccess } from "@/components/ward-management/ward-role-access";
import type { Unit } from "@/components/ward-management/ward-model";
import { EmptyState, SrOnly } from "@/components/wf";

import type { AlertKind } from "./alerts-model";
import type { alertChecks } from "./alerts-checks";
import styles from "./alerts.module.css";
import parts from "./alerts-screen-parts.module.css";

type Checks = ReturnType<typeof alertChecks>;

/**
 * Every condition the screen looks at, by name with its count, zero included (ruling 2026-09-12),
 * and the one it cannot check. A watched kind highlights its rows; the rest link to their page.
 */
export function CheckingList({
  checks,
  watchHighlight,
  onWatch,
  showLabel = true,
}: {
  checks: Checks;
  watchHighlight: AlertKind | null;
  onWatch: (kind: AlertKind | undefined) => void;
  showLabel?: boolean;
}) {
  return (
    <div className={styles.checking}>
      {showLabel ? <span className={styles.checkingLabel}>Checking</span> : null}
      <ul className={styles.checkList} aria-label="Conditions checked">
        {checks.map((check) => {
          const scopeId = `alerts-check-${check.key}`;
          const body = (
            <>
              <span className={styles.mono}>{check.n}</span>
              {check.label}
            </>
          );
          return (
            <li key={check.key} aria-label={check.label} data-zero={check.n === 0 ? "true" : undefined}>
              {!check.href && !check.kind ? (
                <span className={styles.check} title={check.scope} aria-describedby={scopeId}>
                  {body}
                </span>
              ) : check.href ? (
                <Link className={styles.check} href={check.href} title={check.scope} aria-describedby={scopeId}>
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.check}
                  title={check.scope}
                  aria-pressed={watchHighlight === check.kind}
                  aria-describedby={scopeId}
                  onClick={() => onWatch(check.kind)}
                >
                  {body}
                </button>
              )}
              <SrOnly id={scopeId}>{check.scope}</SrOnly>
            </li>
          );
        })}
        <li aria-label="Not checked: handover sheets" className={styles.notChecked}>
          <span className={styles.check} title="Nothing in this system records when a shift hands over.">
            <X size={12} aria-hidden="true" />
            Not checked: handover sheets
          </span>
          <SrOnly>Handover sheets. Nothing in this system records when a shift hands over.</SrOnly>
        </li>
      </ul>
    </div>
  );
}

/**
 * The Checking strip as one dashed chip ("6 flagged · 7 clear") that opens the full list in place.
 * Every check is still there, one press away; thirteen counters, most of them 0, no longer take two
 * lines of the header.
 */
export function ChecksChip({ checks, children }: { checks: readonly { n: number }[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const flagged = checks.filter((check) => check.n > 0).length;
  return (
    <div className={parts.checks}>
      <button type="button" className={parts.checksChip} aria-expanded={open} onClick={() => setOpen((on) => !on)}>
        <span className={parts.checksLabel}>Checking</span> <b>{flagged}</b> flagged · <b>{checks.length - flagged}</b>{" "}
        clear
        <ChevronDown size={14} aria-hidden="true" className={open ? parts.flip : undefined} />
      </button>
      {open ? <div className={parts.checksList}>{children}</div> : null}
    </div>
  );
}

/** The one-tap Checking card that opens the Checking sheet, on a phone and in iPad portrait. */
export function ChecksCard({
  checks,
  className,
  onOpen,
}: {
  checks: readonly { n: number }[];
  className?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={className ? `${styles.phoneCard} ${className}` : styles.phoneCard}
      onClick={onOpen}
    >
      <Activity size={18} aria-hidden="true" />
      <span className={styles.phoneCardText}>
        <span className={styles.phoneCardTitle}>
          Checking <span className={styles.mono}>{checks.length}</span> conditions
        </span>
        <span className={styles.phoneCardMeta}>
          <b className={styles.mono}>{checks.filter((check) => check.n > 0).length}</b> flagged · handover sheets not
          checked
        </span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}

/** Nurse in charge: the ward's own name, or undefined on any other desk. */
export function ownWardName(access: WardAccess, units: readonly Unit[]): string | undefined {
  if (access.role !== "ward" || access.scope.kind !== "ward") return undefined;
  const ids = access.scope.unitIds;
  return units.find((unit) => ids.includes(unit.id))?.name;
}

/**
 * The side panel with no alert chosen. Nurse in charge: with no alert for the ward, it opens on what
 * was checked for it rather than "Pick an alert", so a quiet shift still shows what the screen watches.
 */
export function AlertsSidePanelEmpty({
  wardName,
  quiet,
  checks,
}: {
  wardName: string | undefined;
  quiet: boolean;
  checks: ReactNode;
}) {
  if (wardName === undefined || !quiet) return <EmptyState icon={Bell} title="Pick an alert to see it here" />;
  return (
    <section className={parts.deskClear} aria-label={`Checked for ${wardName}`}>
      <p className={parts.deskHead}>
        <CheckCircle2 size={16} aria-hidden="true" />
        {/* The page title already says no alert is for the ward; this panel says what was checked. */}
        {`Checked for ${wardName}`}
      </p>
      {checks}
    </section>
  );
}
