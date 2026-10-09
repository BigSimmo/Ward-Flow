"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { StatusGlyph } from "@/components/wf";
import { canSeeReadmissionFlag, wardChromeRole } from "./ward-chrome-role";
import { useWardFlow } from "./ward-flow-provider";
import { READMISSION_WINDOW_DAYS, type ReadmissionFlag as ReadmissionFlagValue } from "./ward-readmission";

import styles from "./ward-readmission-flag.module.css";

const LABEL = `${READMISSION_WINDOW_DAYS}d readmission`;

/** "Discharged 3 Oct from Moodjar · 6d before". */
export function readmissionDetailText(flag: ReadmissionFlagValue, dayZero: Date): string {
  const date = new Date(dayZero.getTime() + flag.dischargedAt * 60_000).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
  const gap = flag.daysBefore === 0 ? "same day" : `${flag.daysBefore}d before`;
  return `Discharged ${date} from ${flag.unitName} · ${gap}`;
}

/** Whether this route's role sees the flag: the coordinator only (`canSeeReadmissionFlag`). */
export function useReadmissionFlagVisible(): boolean {
  return canSeeReadmissionFlag(wardChromeRole(usePathname() ?? ""));
}

/**
 * Compact 28 day readmission flag. Shown on the coordinator's screens only (Josh, 9 October 2026);
 * on any other role's route it renders nothing, wherever it is placed. The prior discharge date and ward show on hover (`title`) and,
 * where `expandable`, on pressing the flag. Inside another control (a row that is itself a
 * button) pass `expandable={false}`: the detail is then hover text plus screen-reader text.
 */
export function ReadmissionFlag({
  flag,
  expandable = true,
  testId,
}: {
  flag: ReadmissionFlagValue | null;
  expandable?: boolean;
  testId?: string;
}) {
  const { dayZero } = useWardFlow();
  const [open, setOpen] = useState(false);
  const visible = useReadmissionFlagVisible();
  if (!flag || !visible) return null;
  const detail = readmissionDetailText(flag, dayZero);

  if (!expandable) {
    return (
      <span className={styles.flag} title={detail} data-testid={testId}>
        <StatusGlyph tone="warning" size={8} />
        {LABEL}
        <span className={styles.srOnly}>: {detail}</span>
      </span>
    );
  }

  return (
    <span className={styles.wrap} data-testid={testId}>
      <button
        type="button"
        className={styles.flagButton}
        title={detail}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <StatusGlyph tone="warning" size={8} />
        {LABEL}
      </button>
      {open ? <span className={styles.detail}>{detail}</span> : null}
    </span>
  );
}
