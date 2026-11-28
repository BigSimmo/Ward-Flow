"use client";

import type { Instant } from "@/components/ward-management/ward-clock";
import { shortcutSectionsForDesk } from "@/components/ward-management/help/ward-help-content";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { Checkbox, ShowMoreRow as OneShowMoreRow } from "@/components/wf";

import styles from "./handover-sheet-parts.module.css";
import refined from "./handover-refined.module.css";

/** The row under a long group that shows the rest of it. Nothing when nothing is hidden. */
export function ShowMoreRow({
  hidden,
  span,
  open,
  what,
  onToggle,
}: {
  hidden: number;
  span: number;
  open: boolean;
  what: string;
  onToggle: () => void;
}) {
  if (hidden <= 0) return null;
  return (
    <tr className={styles.moreRow}>
      <td colSpan={span}>
        <OneShowMoreRow expanded={open} onClick={onToggle}>
          {open ? "Show fewer" : `Show ${hidden} more`}
          <span className="sr-only"> {what}</span>
        </OneShowMoreRow>
      </td>
    </tr>
  );
}

/** Why sign-off waits, in the panel's own words: a passed handover, or one not next in line. */
export function signOffWaitReason(passed: boolean, nextShift: boolean): string | undefined {
  if (passed) return "This handover has passed. Choose the next one.";
  if (!nextShift) return "Opens after the previous handover";
  return undefined;
}

/**
 * A handover meeting's length on the board clock, in the whole minutes History records (time audit
 * C9; mechanics and clock audit CC-6, 14 Nov 2026). The chip and History read this one rule, so a
 * moved demo clock never shows one length on the chip and another in History. At least 1 minute.
 */
export function handoverMeetingMinutes(startedAt: Instant, now: Instant): number {
  return Math.max(1, now - startedAt);
}

/** The running meeting's label: the length History would record if it stopped now. */
export function HandoverMeetingTimer({ startedAt, now }: { startedAt: Instant; now: Instant }) {
  return <span className={refined.meeting}>Stop {handoverMeetingMinutes(startedAt, now)} min</span>;
}

/** The keyboard shortcuts popover: the single-key setting and the keys. `signOff` lists S. */
export function HandoverKeysHelp({
  enabled,
  onEnabledChange,
  signOff,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  signOff: boolean;
}) {
  const sections = shortcutSectionsForDesk(useEffectiveWardAccess().role, "Handover", { signOff });
  return (
    <>
      <Checkbox
        label="Enable single-key shortcuts"
        checked={enabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
      />
      <p>Applies across BedChart in this browser.</p>
      {/* Audit two (#82): the one shared list, this page's keys first; the switch above stays here. */}
      <div className={refined.keysScroll}>
        {sections.map((section) => (
          <section key={section.group} aria-label={section.group}>
            <h3 className={refined.keysGroup}>{section.group}</h3>
            <dl className={refined.keys}>
              {section.rows.map(({ keys, short }) => (
                <div key={keys}>
                  <dt>
                    {keys.split(" ").map((part) => (
                      <kbd key={part}>{part}</kbd>
                    ))}
                  </dt>
                  <dd>{short}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}
