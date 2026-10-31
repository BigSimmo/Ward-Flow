"use client";

import { StatusGlyph, type WfTone } from "@/components/wf";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";

import styles from "./missed-notices.module.css";

/**
 * Preview only: the last few notices of this visit, synthetic, matching the Toast mock-up's stack
 * (pop-state-toast). Newest first. `minutesAgo` is counted back from the preview's pinned clock.
 */
const MISSED: readonly {
  id: string;
  minutesAgo: number;
  tone: WfTone;
  title: (name: (formal: string, umrn: string) => string) => string;
  body?: string;
}[] = [
  {
    id: "missed-pulled",
    minutesAgo: 1,
    tone: "success",
    title: (name) => `Bed pulled at Bunbury Acute Psychiatric Unit for ${name("Underbridge, Warrick", "UM100085")}`,
  },
  {
    id: "missed-refused",
    minutesAgo: 2,
    tone: "warning",
    title: (name) => `Bed not pulled for ${name("Cadwaller, Rhys", "UM100046")}`,
    body: "A bed is still pulled at BTY Adult Secure. Release it first.",
  },
  {
    id: "missed-handover",
    minutesAgo: 6,
    tone: "success",
    title: () => "Handover note saved for the night shift",
  },
  {
    id: "missed-note",
    minutesAgo: 9,
    tone: "success",
    title: (name) => `Note added for ${name("Wren, Tobias", "UM100023")}`,
  },
];

/**
 * Mock-up only (D-91): missed notices live in Activity's "Recent activity" tab, not a separate Recent
 * chip as draft PR #1124 drew it. A quiet group at the top of the tab lists the notices this visit
 * has shown, newest first, in memory only; they clear on idle lock and on a desk switch. Nothing is
 * announced again: the list is read only when the person opens the tab. No undo is offered here, as
 * in #1124's Recent list, because an expired Undo must never come back.
 */
export function MissedNotices({ now }: { now: Instant }) {
  const nameFor = usePatientNameDisplay();
  return (
    <section className={styles.group} aria-labelledby="home-activity-missed">
      <h3 id="home-activity-missed" className={styles.heading}>
        Missed notices <span className={styles.count}>{MISSED.length}</span>
      </h3>
      <p className={styles.note}>Cleared when the screen locks or you switch desk.</p>
      <ol className={styles.list} aria-label="Missed notices, newest first">
        {MISSED.map((notice) => (
          <li key={notice.id} className={styles.row}>
            <time className={styles.time}>{formatInstant(now - notice.minutesAgo)}</time>
            <StatusGlyph tone={notice.tone} size={9} className={styles.glyph} />
            <span className={styles.words}>
              {notice.title(nameFor)}
              {notice.body ? <span className={styles.body}>{notice.body}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
