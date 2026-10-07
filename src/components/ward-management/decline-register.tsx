"use client";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { DeclineEntry } from "@/components/ward-management/ward-derivations";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import type { Unit } from "@/components/ward-management/ward-model";

import { StatusGlyph } from "@/components/wf";

import styles from "./decline-register.module.css";

/**
 * THE DECLINES REGISTER — Task 5's new register. Until this component existed there was no
 * screen anywhere that listed `Movement.declines` as its own accountability surface: Delays counts
 * them per row (`` `${declines} declined` ``) and the statistics screens roll them up by reason
 * (`statistics-decline-reporting.ts`), but nobody could see the individual record of who declined
 * what, when, and why — the same gap `OverrideRegister`'s own file comment closed for overrides.
 *
 * Modelled directly on `override-register.tsx`: an already-scoped list in, one presentation out,
 * no derivation call of its own. There is no ward-scoped counterpart to build here — see
 * `allDeclines`'s own comment in `ward-derivations.ts` for why OD-3's restriction has no analogue
 * for a decline.
 */

/** The empty state, in one place for the same reason `NO_OVERRIDE_RECORDED_NOTICE` is: "no rows"
 *  and "this surface is not wired up" look identical on screen, and only one of them is true. */
export const NO_DECLINE_RECORDED_NOTICE = "No decline has been recorded.";

type DeclineRegisterProps = {
  /** Already scoped by the caller — today always `allDeclines(movements)`, the coordinator's
   *  unrestricted read. See this file's header for why nothing here filters it. */
  entries: DeclineEntry[];
  /** Only for naming a unit id, the same as `OverrideRegister`'s `units` prop. */
  units: Unit[];
  now: Instant;
};

export function DeclineRegister({ entries, units, now }: DeclineRegisterProps) {
  const patientOf = usePatientOf();
  if (entries.length === 0) {
    return (
      <p className={styles.placeholder} data-testid="ward-decline-register-empty">
        {NO_DECLINE_RECORDED_NOTICE}
      </p>
    );
  }

  // Newest first, the same reading order `OverrideRegister` uses: a register is read to find out
  // what has just happened. Sorted on a copy — `allDeclines` returns entries in movement order and
  // a derivation's own array must not be reordered under it.
  const newestFirst = [...entries].sort((a, b) => b.decline.at - a.decline.at);

  return (
    <ul className={styles.list} data-testid="ward-decline-register">
      {newestFirst.map((entry, index) => {
        const unit = units.find((candidate) => candidate.id === entry.decline.unitId);
        return (
          // A movement can be declined by more than one unit, so the movement id alone is not a
          // key — same reasoning as `OverrideRegister`'s own key comment.
          <li
            key={`${entry.movement.id}-${entry.decline.unitId}-${entry.decline.at}-${index}`}
            className={styles.entry}
            data-testid={`ward-decline-entry-${entry.movement.id}-${index}`}
          >
            {/* v6 Home mockup: the declining ward leads, then patient and reason, then the time. */}
            <span className={styles.entryMain}>
              <strong className={styles.entryUnit}>
                {/* An id the live unit list cannot name still says the id rather than being
                    dropped — the same conservative-failure choice `OverrideRegister` makes. */}
                <span className="sr-only">Declined by </span>
                {unit ? unit.name : entry.decline.unitId}
              </strong>
              <span className={styles.entryMeta}>
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                {patientOf(entry.movement).formalName} ·{" "}
                {/* `DeclineReason` is a controlled-vocabulary identifier (`DECLINE_REASONS`), never
                    free text. The same `replace(/_/g, " ")` rendering the shortlist panel uses. */}
                <span className={styles.entryReason} data-testid={`ward-decline-reason-${entry.movement.id}-${index}`}>
                  {entry.decline.reason.replace(/_/g, " ")}
                </span>
              </span>
            </span>
            <span className={styles.entryTime}>
              <StatusGlyph tone="closed" size={9} />
              {formatInstantWithDay(entry.decline.at, now)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
