import { Card, CardHead } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";

import { tonightIntakeWindowList } from "./ward-intake-window-list";
import styles from "./capacity-intake-windows-card.module.css";

/**
 * Feature item 13 (10 Nov 2026): "Tonight's intake windows" on the Capacity Overview, so night staff
 * see which wards said when they can take an admission before ringing round. Information only: the
 * wards are listed by health service then name, never by their hours, and nothing is blocked.
 */
export function CapacityIntakeWindowsCard({
  units,
  now,
  onWard,
}: {
  units: readonly Unit[];
  now: Instant;
  /** Opens the ward's panel; absent where the desk opens none. */
  onWard?: (unitId: string) => void;
}) {
  const { set, notSetCount } = tonightIntakeWindowList(units, now);
  return (
    <Card aria-labelledby="capacity-intake-windows-title" data-testid="capacity-intake-windows">
      <CardHead id="capacity-intake-windows-title" title="Tonight's intake windows" meta={String(set.length)} />
      {set.length > 0 ? (
        <ul className={styles.list} aria-label="Wards with intake hours tonight">
          {set.map(({ unit, intake }) => (
            <li key={unit.id} className={styles.row} data-testid="capacity-intake-window-row">
              {onWard ? (
                <button type="button" className={styles.ward} onClick={() => onWard(unit.id)}>
                  <SpelledCodes text={unit.name} />
                </button>
              ) : (
                <span className={styles.wardText}>
                  <SpelledCodes text={unit.name} />
                </span>
              )}
              <span className={styles.hours}>
                Admit {formatInstant(intake.from)} to {formatInstant(intake.to)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.muted} data-testid="capacity-intake-windows-not-set">
        {notSetCount === 0
          ? "Every ward has set a window."
          : `${notSetCount} ${notSetCount === 1 ? "ward hasn't" : "wards haven't"} set a window.`}{" "}
        For information only. Windows clear at 07:00.
      </p>
    </Card>
  );
}
