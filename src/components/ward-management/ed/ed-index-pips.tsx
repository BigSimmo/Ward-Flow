import { StatusGlyph } from "@/components/wf";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { splitDuration } from "@/components/ward-management/ward-clock";

import { CLOCK_TONE, personDim, waitLine, type EdRow, type Highlight } from "./ed-index-parts";
import styles from "./ed-index.module.css";

// Shared by the phone list (`ed-index.tsx`) and the lazily loaded views (`ed-index-views.tsx`).
const PIPS_SHOWN = 12;

/** One pip per person waiting, longest first, shaped by how long they have waited. */
export function PeoplePips({ row, highlight }: { row: EdRow; highlight: Highlight | null }) {
  if (row.people.length === 0) return <p className={styles.noneWaiting}>Nobody waiting</p>;
  const shown = row.people.slice(0, PIPS_SHOWN);
  return (
    <div
      className={styles.pips}
      role="img"
      aria-label={`${row.summary.waiting} waiting: ${row.pastTarget} over target, ${row.severe} over ${waitLine(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`}
    >
      {shown.map((person) => (
        <span
          key={person.movement.id}
          className={styles.pip}
          data-dim={personDim(person, highlight) ? "true" : undefined}
          title={`${person.name} · ${splitDuration(person.wait)} · ${person.stage}`}
        >
          <StatusGlyph tone={CLOCK_TONE[person.clock]} size={8} />
        </span>
      ))}
      {/* CB-3: drawn from the attribute, so a row's visible words stay the ones its name says. */}
      {row.people.length > PIPS_SHOWN ? (
        <span className={styles.more} data-more={`+${row.people.length - PIPS_SHOWN}`} />
      ) : null}
    </div>
  );
}
