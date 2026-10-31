import Link from "next/link";

import { Button, buttonClass, Card, CardHead, StatusGlyph } from "@/components/wf";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";

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
          {first ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAskWard(first.id)}
              aria-haspopup="dialog"
              aria-label={`Ask ${first.name} to confirm its beds`}
            >
              Ask
            </Button>
          ) : null}
        </div>
        <p className={styles.mutedXs}>
          {first ? (
            <>
              Waiting on <SpelledCodes text={first.name} />, last at {formatInstant(first.allocatable.confirmedAt)}
              {confirmations.waiting.length > 1 ? `, and ${confirmations.waiting.length - 1} more` : ""}
            </>
          ) : (
            "Every open ward has confirmed since the shift began"
          )}
        </p>
      </section>
      <section className={styles.shiftSection} aria-label="Held-up releases">
        <div className={styles.shiftTop}>
          <span className={styles.shiftFigure}>
            {heldUp.total}
            <span className={styles.shiftNoun}>held-up {heldUp.total === 1 ? "release" : "releases"}</span>
          </span>
          <Link
            href={HELD_UP_HREF}
            aria-label={HELD_UP_LINK_LABEL}
            className={buttonClass({ variant: "ghost", size: "sm" })}
          >
            See all
          </Link>
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
        <p className={styles.mutedXs}>Held-up releases count only in the best case.</p>
      </section>
      <p className={styles.srOnly}>Figures as at {formatInstant(now)}.</p>
    </Card>
  );
}
