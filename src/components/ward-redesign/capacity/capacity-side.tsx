import Link from "next/link";

import { Button, buttonClass, Card, CardHead, StatusGlyph } from "@/components/wf";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";

import { Kicker } from "../parts/how-worked-out";
import { HELD_UP_HREF, HELD_UP_LINK_LABEL } from "./held-up";
import type { CapacityModel } from "./use-capacity-model";
import styles from "./capacity-redesign.module.css";

/**
 * Polish (Josh, 31 Oct 2026): "Confirmed this shift" and "Held-up releases" are one card, "This
 * shift", in the row under the bed map. Who has not confirmed is one line with its button beside
 * it; held-up releases keep Discharges' two groups and names (Josh, 30 Oct 2026) and its link.
 */
export function ShiftChecks({ model, onAskWard }: { model: CapacityModel; onAskWard: (unitId: string) => void }) {
  const { confirmations, heldUp, now } = model;
  const first = confirmations.waiting[0];
  return (
    <Card aria-labelledby="capacity-shift-title">
      <CardHead id="capacity-shift-title" title="This shift" />
      <div className={styles.shiftRow}>
        <div className={styles.shiftMain}>
          <span className={styles.shiftLabel}>
            Confirmed
            <span className={confirmations.waiting.length ? styles.warnInk : styles.okInk}>
              <StatusGlyph tone={confirmations.waiting.length ? "warning" : "success"} size={9} />{" "}
              {confirmations.confirmed} of {confirmations.total} wards
            </span>
          </span>
          <span className={styles.mutedXs}>
            {first ? (
              <>
                <SpelledCodes text={first.name} /> not since {formatInstant(first.allocatable.confirmedAt)}
                {confirmations.waiting.length > 1 ? `, and ${confirmations.waiting.length - 1} more` : ""}
              </>
            ) : (
              "Every open ward has confirmed since the shift began"
            )}
          </span>
        </div>
        {first ? (
          <Button size="sm" variant="sec" onClick={() => onAskWard(first.id)} aria-haspopup="dialog">
            Ask the ward
          </Button>
        ) : null}
      </div>
      <div className={styles.shiftRow}>
        <span className={styles.shiftLabel}>
          Held-up releases <span className={styles.muted}>{heldUp.total}</span>
        </span>
        <Link href={HELD_UP_HREF} className={buttonClass({ variant: "ghost", size: "sm" })}>
          {HELD_UP_LINK_LABEL}
        </Link>
      </div>
      {heldUp.total === 0 ? (
        <p className={`${styles.sideBody} ${styles.shiftFlush}`}>No bed release has a recorded blocker.</p>
      ) : (
        <div className={`${styles.sideBody} ${styles.blockers} ${styles.shiftFlush}`}>
          {[
            { title: "Same day", rows: heldUp.sameDay },
            { title: "Escalate", rows: heldUp.escalate },
          ].map((group) => (
            <div key={group.title}>
              <Kicker>
                {group.title} · {group.rows.reduce((sum, row) => sum + row.count, 0)}
              </Kicker>
              <ul className={styles.kvList}>
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <span>{row.label}</span>
                    <b>{row.count}</b>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className={styles.cardFoot}>
        <span>Held-up releases count only in the best case.</span>
      </div>
      <p className={styles.srOnly}>Figures as at {formatInstant(now)}.</p>
    </Card>
  );
}
