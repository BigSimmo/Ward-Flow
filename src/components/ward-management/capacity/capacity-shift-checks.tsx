import Link from "next/link";

import { Button, buttonClass, Card, CardHead, StatusGlyph } from "@/components/wf";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";

import { HELD_UP_HREF, HELD_UP_LINK_LABEL } from "./capacity-held-up";
import type { CapacityModel } from "./capacity-model";
import { UNCHANGED_SHIFTS_LISTED } from "./shift-confirmations";
import styles from "./capacity-page.module.css";

/**
 * Polish (Josh, 31 Oct 2026): "Confirmed this shift" and "Held-up releases" are one card, "This
 * shift", in the row under the bed map. Who has not confirmed is one line with its button beside
 * it; held-up releases keep Discharges' two groups and names (Josh, 30 Oct 2026) and its link.
 */
export function ShiftChecks({
  model,
  onAskWard,
  siteName,
}: {
  model: CapacityModel;
  /** Absent for a desk that may not ask a ward to confirm (asking is the coordinator's step). */
  onAskWard?: (unitId: string) => void;
  /** Role view (site bed manager): the site whose wards this card counts. */
  siteName?: string;
}) {
  const { confirmations, heldUp, unchanged, now } = model;
  // Role view: a site bed manager confirms its own wards' beds on the ward's page, so it gets that
  // link instead of Ask; a desk that can open neither (executive) gets the figure alone.
  const canOpen = useCanOpenHref();
  const first = confirmations.waiting[0];
  const groups = [
    { title: "Same day", rows: heldUp.sameDay },
    { title: "Escalate", rows: heldUp.escalate },
  ];
  return (
    <Card aria-labelledby="capacity-shift-title">
      <CardHead id="capacity-shift-title" title="This shift" />
      {/* Polish (Josh, 31 Oct 2026): two short sections, each a headline figure with one line
          under it. The held-up reasons are small tags instead of an eight-row table. */}
      <section className={styles.shiftSection} aria-label="Bed counts confirmed">
        <div className={styles.shiftTop}>
          <span className={styles.shiftFigure}>
            <StatusGlyph tone={first ? "warning" : "success"} size={9} />
            {confirmations.confirmed} of {confirmations.total}
            <span className={styles.shiftNoun}>confirmed</span>
          </span>
          {first && onAskWard ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAskWard(first.id)}
              aria-haspopup="dialog"
              aria-label={`Ask ${first.name} to confirm its beds`}
            >
              Ask
            </Button>
          ) : first && canOpen(`/ward-flow/ward/${first.id}`) ? (
            <Link
              href={`/ward-flow/ward/${first.id}`}
              aria-label={`Confirm beds on ${first.name}`}
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              Confirm
            </Link>
          ) : null}
        </div>
        <p className={styles.mutedXs}>
          {first ? (
            <>
              Waiting on <SpelledCodes text={first.name} />, last at {formatInstant(first.allocatable.confirmedAt)}
              {confirmations.waiting.length > 1 ? `, and ${confirmations.waiting.length - 1} more` : ""}
            </>
          ) : (
            `Every open ward${siteName ? ` at ${siteName}` : ""} has confirmed since the shift began`
          )}
        </p>
        {/* Josh, 31 Oct 2026: a count confirmed unchanged for a day or more is worth a look. */}
        {unchanged.length > 0 ? (
          <div className={styles.shiftTags}>
            <span className={styles.shiftTagsLabel}>
              Same number confirmed {UNCHANGED_SHIFTS_LISTED} or more shifts in a row, worth a look
            </span>
            <ul className={styles.shiftTagList} aria-label="Same number confirmed shift after shift">
              {unchanged.map(({ unit, shifts }) => (
                <li key={unit.id} className={`${styles.tag} ${styles.tagWrap}`}>
                  <SpelledCodes text={unit.name} /> · {shifts} shifts
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      <section className={styles.shiftSection} aria-label="Held-up releases">
        <div className={styles.shiftTop}>
          <span className={styles.shiftFigure}>
            {heldUp.total}
            <span className={styles.shiftNoun}>held-up {heldUp.total === 1 ? "release" : "releases"}</span>
          </span>
          {canOpen(HELD_UP_HREF) ? (
            <Link
              href={HELD_UP_HREF}
              aria-label={HELD_UP_LINK_LABEL}
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              See all
            </Link>
          ) : null}
        </div>
        {heldUp.total === 0 ? (
          <p className={styles.mutedXs}>No bed release has a recorded blocker.</p>
        ) : (
          groups.map((group) =>
            group.rows.length === 0 ? null : (
              <div key={group.title} className={styles.shiftTags}>
                <span className={styles.shiftTagsLabel}>
                  {group.title} {group.rows.reduce((sum, row) => sum + row.count, 0)}
                </span>
                <ul className={styles.shiftTagList}>
                  {group.rows.map((row) => (
                    <li key={row.id} className={styles.tag}>
                      {row.label} {row.count}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )
        )}
      </section>
      <p className={styles.srOnly}>Figures as at {formatInstant(now)}.</p>
    </Card>
  );
}
