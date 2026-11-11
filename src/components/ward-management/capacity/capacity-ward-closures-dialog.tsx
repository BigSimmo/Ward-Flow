"use client";

import { useMemo, useState } from "react";

import { Button, ChipGroup, Dialog, FilterChip, StatusGlyph } from "@/components/wf";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardRecordActor } from "@/components/ward-management/ward-discharge-records";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Unit } from "@/components/ward-management/ward-model";
import { activeClosedBeds } from "@/components/ward-management/ward-ready-beds";
import { wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";

import { bedReviewLine } from "../ward-bed-closure-review";
import { ClosureChoice, REVIEW_AFTER_CHOICES, reviewAtFrom } from "../ward-closure-choice";
import { WARD_CLOSURE_REASONS, wardClosureReasonLabel, type WardClosureReason } from "./ward-closure";
import { WardClosurePanel, type FootAction } from "./ward-closure-panel";
import styles from "./capacity-page.module.css";

/**
 * Capacity issue 4 (Josh, 3 Nov 2026): closing is a last resort, so it lives behind one quiet
 * button on the ward drawer and opens here. Two steps in one place: close or reopen one exact
 * empty bed (`SET_BED_CLOSED`, the same event as the ward's bed drawer), or close the whole ward to
 * admissions (the existing closure panel, unchanged). Reasons are chosen, never typed.
 */
export function WardClosuresDialog({
  open,
  onClose,
  unit,
  now,
  actor,
}: {
  open: boolean;
  onClose: () => void;
  unit: Unit;
  now: Instant;
  actor: WardRecordActor;
}) {
  const { admissions } = useWardFlowSelect("admissions");
  const raise = useWardRaise(actor.role);
  const [bed, setBed] = useState<number | null>(null);
  const [reason, setReason] = useState<WardClosureReason | null>(null);
  // Item 6: "Review in", "Not known" by default. The time only prompts; reopening needs a person.
  const [reviewAfter, setReviewAfter] = useState("");
  // The whole-ward close is the dialog's one primary action, in its foot (stress test, 3 Nov 2026).
  const [closeWard, setCloseWard] = useState<FootAction | null>(null);
  const closed = activeClosedBeds(unit);
  const taken = useMemo(() => {
    const seats = wardStaySeats(unit, admissions);
    const set = new Set<number>();
    for (const stay of admissions) {
      if (stay.unitId !== unit.id || !bedIsOccupied(stay)) continue;
      const seat = stay.bedNumber ?? seats.get(stay.id);
      if (seat !== undefined) set.add(seat);
    }
    return set;
  }, [unit, admissions]);
  const closedNumbers = new Set(closed.map((mark) => mark.bedNumber));
  const empty = Array.from({ length: unit.beds }, (_, index) => index + 1).filter(
    (number) => !taken.has(number) && !closedNumbers.has(number),
  );
  const setBedClosed = (bedNumber: number, close: boolean, why?: WardClosureReason, reviewAt?: Instant) =>
    raise("SET_BED_CLOSED", {
      unitId: unit.id,
      actingUnitId: unit.id,
      bedNumber,
      closed: close,
      ...(close && why ? { reason: why } : {}),
      ...(close && reviewAt !== undefined ? { reviewAt } : {}),
    });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Closures, ${unit.name}`}
      description="A last resort. A closed bed or ward is not offered until someone reopens it."
      size="md"
      data-testid="capacity-ward-closures"
      // One filled action: the whole-ward close while it can be done, otherwise Done.
      secondary={closeWard ? [{ label: "Done", onAction: onClose }] : undefined}
      primary={closeWard ?? { label: "Done", onAction: onClose }}
    >
      <div className={styles.popBody}>
        <section aria-labelledby="closures-bed" className={styles.popSection}>
          <h3 id="closures-bed" className={styles.popHead}>
            Close one bed <span className={styles.popCount}>{empty.length} empty</span>
          </h3>
          {empty.length === 0 ? (
            <p className={styles.popEmpty}>No empty bed to close on this ward.</p>
          ) : (
            <>
              <span className={styles.popLabel}>Which bed</span>
              <ChipGroup label="Empty beds" className={styles.popChips}>
                {empty.map((number) => (
                  <FilterChip
                    key={number}
                    pressed={bed === number}
                    onPressedChange={(pressed) => setBed(pressed ? number : null)}
                  >
                    {`Bed ${number}`}
                  </FilterChip>
                ))}
              </ChipGroup>
              <span className={styles.popLabel}>Why</span>
              <ChipGroup label="Reason" className={styles.popChips}>
                {WARD_CLOSURE_REASONS.map((entry) => (
                  <FilterChip
                    key={entry.id}
                    pressed={reason === entry.id}
                    onPressedChange={(pressed) => setReason(pressed ? entry.id : null)}
                  >
                    {entry.label}
                  </FilterChip>
                ))}
              </ChipGroup>
              <ClosureChoice
                label="Review in"
                testId="capacity-close-bed-review"
                value={reviewAfter}
                items={REVIEW_AFTER_CHOICES}
                onChange={setReviewAfter}
              />
              <div className={styles.popFoot}>
                <Button
                  size="sm"
                  variant="sec"
                  disabled={bed === null || reason === null}
                  onClick={() => {
                    if (bed === null || reason === null) return;
                    setBedClosed(bed, true, reason, reviewAtFrom(reviewAfter, now));
                    setBed(null);
                    setReason(null);
                    setReviewAfter("");
                  }}
                >
                  {bed === null ? "Choose a bed" : `Close bed ${bed}`}
                </Button>
              </div>
            </>
          )}
          {closed.length > 0 ? (
            <ul className={styles.popList}>
              {closed.map((mark) => (
                <li key={mark.bedNumber} className={styles.popRowWrap}>
                  <span className={styles.popRow}>
                    <StatusGlyph tone="neutral" size={8} />
                    <span className={styles.popMain}>
                      <span className={styles.popName}>Bed {mark.bedNumber} closed</span>
                      <span className={styles.mutedXs}>
                        {[
                          "reason" in mark && mark.reason ? wardClosureReasonLabel(mark.reason) : "Reason not recorded",
                          bedReviewLine(mark, now),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setBedClosed(mark.bedNumber, false)}>
                    Reopen
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section aria-labelledby="closures-ward" className={styles.popSection}>
          <h3 id="closures-ward" className={styles.popHead}>
            Close the whole ward to admissions
          </h3>
          <WardClosurePanel unit={unit} now={now} actor={actor} onFootAction={setCloseWard} />
        </section>
      </div>
    </Dialog>
  );
}
