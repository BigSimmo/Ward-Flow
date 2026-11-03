"use client";

import { useEffect, useState } from "react";
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

const KEYS: [string, string][] = [
  ["J K", "Step through patients"],
  ["P", "Print handover"],
  ["S", "Sign off"],
  ["M", "Start or stop the meeting timer"],
  ["Esc", "Close or go back"],
];

function mmss(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function HandoverMeetingTimer({ startedAt }: { startedAt: number }) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return <span className={refined.meeting}>Stop {mmss(tick - startedAt)}</span>;
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
  return (
    <>
      <Checkbox
        label="Enable single-key shortcuts"
        checked={enabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
      />
      <p>Applies across Ward Flow in this browser.</p>
      <dl className={refined.keys}>
        {KEYS.filter(([keys]) => signOff || keys !== "S").map(([keys, text]) => (
          <div key={keys}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
