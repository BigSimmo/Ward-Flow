// Source: src/components/ward-redesign/capacity/capacity-side.tsx (role view: executive)
import Link from "next/link";

import { Button, buttonClass, Card, CardHead, StatusGlyph } from "@/components/wf";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { ReadyByRoadTime } from "@/components/ward-management/capacity/capacity-road-time";
import { shortBlocker } from "@/components/ward-management/forecast/forecast-levers";

import { Kicker } from "@/components/ward-redesign/parts/how-worked-out";
import type { CapacityModel } from "@/components/ward-redesign/capacity/use-capacity-model";
import styles from "@/components/ward-redesign/capacity/capacity-redesign.module.css";

/**
 * The column beside the bed map: nearest ready beds, who has not confirmed this shift, and beds
 * held up by a blocker. Each is a short card with one action, in that order.
 */
export function CapacitySide({
  model,
  selectedUnitId,
  onSelectWard,
  onAskWard,
  executive = false,
}: {
  model: CapacityModel;
  selectedUnitId?: string;
  onSelectWard: (unitId: string) => void;
  /** Role view (executive): absent, because asking a ward to confirm is the coordinator's step. */
  onAskWard?: (unitId: string) => void;
  /** Role view (executive): Waiting is not this desk's screen, so its link is left out. */
  executive?: boolean;
}) {
  const { networkRows, roadTimeFromEdId, confirmations, forecastModel, now } = model;
  const { blockers } = forecastModel;
  const first = confirmations.waiting[0];
  return (
    <div className={styles.sideColumn}>
      <ReadyByRoadTime
        rows={networkRows}
        defaultEdId={roadTimeFromEdId}
        selectedUnitId={selectedUnitId}
        onSelectUnit={(unitId) => onSelectWard(unitId)}
      />
      <Card aria-labelledby="capacity-confirmed-title">
        <CardHead
          id="capacity-confirmed-title"
          title="Confirmed this shift"
          aside={
            <span className={confirmations.waiting.length ? styles.warnInk : styles.okInk}>
              <StatusGlyph tone={confirmations.waiting.length ? "warning" : "success"} size={9} />{" "}
              {confirmations.confirmed} of {confirmations.total} wards
            </span>
          }
        />
        <div className={styles.sideBody}>
          {first ? (
            <>
              <p className={styles.small}>
                <SpelledCodes text={first.name} /> has not confirmed since{" "}
                {formatInstant(first.allocatable.confirmedAt)}
                {confirmations.waiting.length > 1 ? `, and ${confirmations.waiting.length - 1} more` : ""}.
              </p>
              {onAskWard ? (
                <Button size="sm" variant="sec" onClick={() => onAskWard(first.id)} aria-haspopup="dialog">
                  Ask the ward
                </Button>
              ) : null}
            </>
          ) : (
            <p className={styles.small}>Every open ward has confirmed its count since the shift began.</p>
          )}
        </div>
      </Card>
      <Card aria-labelledby="capacity-blockers-title">
        <CardHead id="capacity-blockers-title" title="Beds held up by a blocker" meta={`${blockers.total} recorded`} />
        <div className={`${styles.sideBody} ${styles.blockers}`}>
          {blockers.total === 0 ? (
            <p className={styles.small}>No bed has a recorded blocker.</p>
          ) : (
            [
              { title: "Same day", rows: blockers.sameDay },
              { title: "Escalate", rows: blockers.escalate },
            ].map((group) => (
              <div key={group.title}>
                <Kicker>
                  {group.title} · {group.rows.reduce((sum, row) => sum + row.count, 0)}
                </Kicker>
                <ul className={styles.kvList}>
                  {group.rows.map((row) => (
                    <li key={row.reason}>
                      <span>{shortBlocker(row.reason)}</span>
                      <b>{row.count}</b>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className={styles.cardFoot}>
          <span>Held-up beds count only in the best case.</span>
          {executive ? null : (
            <Link href="/ward-flow/waiting" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Open Waiting
            </Link>
          )}
        </div>
      </Card>
      <p className={styles.srOnly}>Figures as at {formatInstant(now)}.</p>
    </div>
  );
}
