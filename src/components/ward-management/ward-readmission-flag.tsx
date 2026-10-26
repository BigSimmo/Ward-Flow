"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { StatusGlyph } from "@/components/wf";
import { canSeeReadmissionFlag, wardChromeRole } from "./ward-chrome-role";
import { useWardFlowSelect } from "./ward-flow-provider";
import { READMISSION_WINDOW_DAYS, type ReadmissionFlag as ReadmissionFlagValue } from "./ward-readmission";

import styles from "./ward-readmission-flag.module.css";

const LABEL = `${READMISSION_WINDOW_DAYS}d readmission`;

/** What a ward's own copy carries (D-80): the discharge time only, never the other ward. */
type ShownFlag = Pick<ReadmissionFlagValue, "dischargedAt" | "daysBefore"> & { unitName?: string };

/** "Discharged 3 Oct from Moodjar · 6d before", or "from a psychiatric ward" on a ward's copy. */
function readmissionDetailText(flag: ShownFlag, dayZero: Date): string {
  const date = new Date(dayZero.getTime() + flag.dischargedAt * 60_000).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "Australia/Perth",
  });
  const gap = flag.daysBefore === 0 ? "same day" : `${flag.daysBefore}d before`;
  return `Discharged ${date} from ${flag.unitName ?? "a psychiatric ward"} · ${gap}`;
}

/**
 * The ED index (`/ward-flow/ed`, every emergency department listed). `wardChromeRole`
 * deliberately gives it the coordinator's chrome, as All wards has: only `/ed/[edId]` is an ED
 * desk, and the header, desk, nav counts, search and role switcher all read that answer. It is
 * still an ED screen, so the flag is hidden there here rather than by changing the chrome role.
 */
const ED_INDEX_PATH = /\/ward-flow\/ed\/?$/u;

/** Whether the flag shows on this route: the coordinator's routes only, never the ED index. */
export function readmissionFlagVisibleOn(pathname: string): boolean {
  if (ED_INDEX_PATH.test(pathname)) return false;
  return canSeeReadmissionFlag(wardChromeRole(pathname));
}

/** Whether this route's role sees the flag: the coordinator only (`canSeeReadmissionFlag`). */
export function useReadmissionFlagVisible(): boolean {
  return readmissionFlagVisibleOn(usePathname() ?? "");
}

/**
 * Compact 28 day readmission flag. Shown on the coordinator's screens (Josh, 9 October 2026), and
 * as `wardCopy` on a ward's own accepted journey (D-80), whose scoped copy carries the discharge
 * time only; on any other role's route it renders nothing, wherever it is placed. The prior discharge date and ward show on hover (`title`) and,
 * where `expandable`, on pressing the flag. Inside another control (a row that is itself a
 * button) pass `expandable={false}`: the detail is then hover text plus screen-reader text.
 */
export function ReadmissionFlag({
  flag,
  expandable = true,
  wardCopy = false,
  testId,
}: {
  flag: ShownFlag | null;
  expandable?: boolean;
  wardCopy?: boolean;
  testId?: string;
}) {
  const { dayZero } = useWardFlowSelect("dayZero");
  const [open, setOpen] = useState(false);
  const visible = useReadmissionFlagVisible() || wardCopy;
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
