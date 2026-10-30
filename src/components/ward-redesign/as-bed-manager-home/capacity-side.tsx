// Fork of src/components/ward-redesign/capacity/capacity-side.tsx: a site bed manager branch.
import Link from "next/link";

import { Button, buttonClass, Card, CardHead, StatusGlyph } from "@/components/wf";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { ReadyByRoadTime } from "@/components/ward-management/capacity/capacity-road-time";

import { Kicker } from "@/components/ward-redesign/parts/how-worked-out";
import { HELD_UP_HREF, HELD_UP_LINK_LABEL } from "@/components/ward-redesign/capacity/held-up";
import type { CapacityModel } from "./use-capacity-model";
import styles from "@/components/ward-redesign/capacity/capacity-redesign.module.css";

/**
 * The column beside the bed map: nearest ready beds, who has not confirmed this shift, and beds
 * held up by a blocker. Each is a short card with one action, in that order. Held-up releases are
 * counted and named as Discharges counts them (Josh, 30 Oct 2026), and the link opens that list.
 */
export function CapacitySide({
  model,
  selectedUnitId,
  onSelectWard,
  onAskWard,
}: {
  model: CapacityModel;
  selectedUnitId?: string;
  onSelectWard: (unitId: string) => void;
  onAskWard: (unitId: string) => void;
}) {
  const { networkRows, roadTimeFromEdId, confirmations, heldUp, now, site, otherSiteRows } = model;
  const first = confirmations.waiting[0];
  // ROLE BRANCH (bed_manager): asking a ward to confirm is the coordinator's alone
  // (REQUEST_CAPACITY_REFRESH). A site bed manager confirms its own wards' beds itself, on the
  // ward's page (CONFIRM_CAPACITY), so the card opens that ward instead. Road time ranks every
  // site's ready beds from the site's own ED: counts and distance only, never a person.
  const siteDesk = site !== undefined;
  const roadRows = siteDesk ? [...networkRows, ...otherSiteRows] : networkRows;
  return (
    <div className={styles.sideColumn}>
      <ReadyByRoadTime
        rows={roadRows}
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
              {siteDesk ? (
                <Link href={`/ward-flow/ward/${first.id}`} className={buttonClass({ variant: "sec", size: "sm" })}>
                  Confirm beds on {first.name}
                </Link>
              ) : (
                <Button size="sm" variant="sec" onClick={() => onAskWard(first.id)} aria-haspopup="dialog">
                  Ask the ward
                </Button>
              )}
            </>
          ) : (
            <p className={styles.small}>
              {siteDesk
                ? `Every open ward at ${site.name} has confirmed its count since the shift began.`
                : "Every open ward has confirmed its count since the shift began."}
            </p>
          )}
        </div>
      </Card>
      <Card aria-labelledby="capacity-blockers-title">
        <CardHead id="capacity-blockers-title" title="Held-up releases" meta={`${heldUp.total} recorded`} />
        <div className={`${styles.sideBody} ${styles.blockers}`}>
          {heldUp.total === 0 ? (
            <p className={styles.small}>No bed release has a recorded blocker.</p>
          ) : (
            [
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
            ))
          )}
        </div>
        <div className={styles.cardFoot}>
          <span>Held-up releases count only in the best case.</span>
          <Link href={HELD_UP_HREF} className={buttonClass({ variant: "ghost", size: "sm" })}>
            {HELD_UP_LINK_LABEL}
          </Link>
        </div>
      </Card>
      <p className={styles.srOnly}>Figures as at {formatInstant(now)}.</p>
    </div>
  );
}
