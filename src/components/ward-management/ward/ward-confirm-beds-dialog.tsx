"use client";

// My ward's Confirm capacity figures dialog (redesign approved 31 Oct 2026), in the shared dialog.
// The ward screen keeps the draft figure and the two confirm handlers; this draws them: the facts
// first as four tiles, then the free-bed control, then one filled button in the dialog's footer.

import { Minus, Plus } from "lucide-react";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_LABELS, type BedStateCounts } from "@/components/ward-management/ward-bed-states";
import { formatInstant } from "@/components/ward-management/ward-clock";
import type { unitCapacity } from "@/components/ward-management/ward-derivations";
import type { Unit } from "@/components/ward-management/ward-model";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { formatWardOccupancy, type OccupancyFigure } from "@/components/ward-management/ward-occupancy";
import { plural } from "@/components/ward-management/ward-plural";
import { wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import { Button, Dialog } from "@/components/wf";

import styles from "./ward-confirm-beds-dialog.module.css";
import { useOptionalRouter } from "./ward-screen-helpers";

const beds = (count: number) => plural(count, "bed", "beds");

/** One footer button, as the kit Dialog takes it. */
type DialogAction = NonNullable<Parameters<typeof Dialog>[0]["secondary"]>[number];

export type WardConfirmBedsDialogProps = {
  open: boolean;
  onClose: () => void;
  unit: Unit;
  occupancy: OccupancyFigure;
  capacity: ReturnType<typeof unitCapacity>;
  states: BedStateCounts;
  /** The draft figure, as typed. */
  capacityValue: string;
  setCapacityValue: (next: string) => void;
  /** True when the confirmed figure changed after this draft began. */
  staleRevision: boolean;
  /** Starts a new draft from the current confirmed figure. */
  onStartFromCurrent: () => void;
  isRollupConfirmedToday: boolean;
  morningRollupTimeLabel: string;
  /** Expected discharges counted today (Review … today). */
  releasesTodayCount: number;
  /** Confirms the free beds alone. */
  onConfirmBeds: () => void;
  /** Confirms the free beds and the morning bed numbers together. */
  onConfirmBedsAndRollup: () => void;
};

export function WardConfirmBedsDialog({
  open,
  onClose,
  unit,
  occupancy,
  capacity,
  states,
  capacityValue,
  setCapacityValue,
  staleRevision,
  onStartFromCurrent,
  isRollupConfirmedToday,
  morningRollupTimeLabel,
  releasesTodayCount,
  onConfirmBeds,
  onConfirmBedsAndRollup,
}: WardConfirmBedsDialogProps) {
  const router = useOptionalRouter();
  // The Ready figure stays as it is while beds are cleaned (owner ruling); the tile says how many
  // of them are still being made ready, as the other ward screens do.
  const { bedReleases } = useWardFlowSelect("bedReleases");
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  const openVacant = Math.max(0, unit.beds - capacity.occupied - states.closed);
  const parsedValue = parseInt(capacityValue, 10);
  const change = (() => {
    if (isNaN(parsedValue)) return "Not recorded";
    const delta = parsedValue - unit.allocatable.value;
    const word = Math.abs(delta) === 1 ? "bed" : "beds";
    return delta > 0 ? `+${delta} ${word}` : delta < 0 ? `${delta} ${word}` : "No change";
  })();
  const step = (by: number) => {
    const base = isNaN(parsedValue) ? unit.allocatable.value : parsedValue;
    setCapacityValue(String(Math.min(unit.beds, Math.max(0, base + by))));
  };
  // One filled button. With the morning numbers still due, it confirms both together and "Confirm
  // beds only" sits beside Cancel; once they are in, it confirms the beds alone.
  const primary: DialogAction = isRollupConfirmedToday
    ? { label: "Confirm beds", onAction: onConfirmBeds }
    : {
        label: `Confirm beds and morning numbers (${morningRollupTimeLabel})`,
        onAction: onConfirmBedsAndRollup,
      };
  const secondary: DialogAction[] = [
    { label: "Cancel", onAction: onClose },
    ...(isRollupConfirmedToday ? [] : [{ label: "Confirm beds only", onAction: onConfirmBeds }]),
  ];
  const facts = [
    { label: "Staffed beds", value: String(unit.beds), sub: null },
    { label: "In use", value: `${occupancy.inUse} of ${unit.beds}`, sub: formatWardOccupancy(occupancy) },
    {
      label: "Ready",
      value: String(capacity.available),
      sub: pendingPreparation > 0 ? `${pendingPreparation} still being made ready` : "free to offer",
    },
    { label: BED_STATE_LABELS.closed, value: String(states.closed), sub: "not offered" },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      // Wide enough for the three footer buttons on one row.
      size="lg"
      // The ward is named once, in the title.
      title={`Confirm capacity figures — ${unit.name}`}
      primary={primary}
      secondary={secondary}
      closeLabel="Close capacity confirmation"
      data-testid="ward-capacity-form"
    >
      <div className={styles.body}>
        <section aria-label="Bed roster and census">
          <dl className={styles.tiles}>
            {facts.map((fact) => (
              <div key={fact.label} className={styles.tile}>
                <dt className={styles.tileLabel}>{fact.label}</dt>
                <dd className={styles.tileValue}>{fact.value}</dd>
                {fact.sub ? <dd className={styles.tileSub}>{fact.sub}</dd> : null}
              </div>
            ))}
          </dl>
          <p className={styles.more}>
            {BED_STATE_LABELS.pulled}, not arrived: <b>{beds(states.pulled)}</b> · Open and vacant:{" "}
            <b>{beds(openVacant)}</b>
          </p>
        </section>

        <div className={styles.control}>
          <label className={styles.controlLabel} htmlFor="ward-capacity-input">
            Beds free to offer
          </label>
          <div className={styles.stepper}>
            <Button
              variant="sec"
              size="lg"
              iconOnly
              icon={Minus}
              aria-label="One bed fewer"
              reasonDisplay="tooltip"
              disabledReason={!isNaN(parsedValue) && parsedValue <= 0 ? "Already 0 beds." : undefined}
              onClick={() => step(-1)}
            />
            <input
              id="ward-capacity-input"
              data-testid="ward-capacity-input"
              type="number"
              inputMode="numeric"
              min={0}
              max={unit.beds}
              value={capacityValue}
              onChange={(event) => setCapacityValue(event.target.value)}
              aria-describedby="ward-capacity-now"
              className={styles.input}
            />
            <Button
              variant="sec"
              size="lg"
              iconOnly
              icon={Plus}
              aria-label="One bed more"
              reasonDisplay="tooltip"
              disabledReason={!isNaN(parsedValue) && parsedValue >= unit.beds ? `All ${unit.beds} beds.` : undefined}
              onClick={() => step(1)}
            />
            <span className={styles.change} aria-live="polite">
              {change}
            </span>
          </div>
          <p id="ward-capacity-now" className={styles.now}>
            Currently confirmed {unit.allocatable.value} at {formatInstant(unit.allocatable.confirmedAt)}. Writes to{" "}
            {unit.name} only &mdash; never any other ward.
          </p>
          {staleRevision ? (
            <button type="button" className={styles.linkish} onClick={onStartFromCurrent}>
              Start a new capacity observation from the current count
            </button>
          ) : null}
        </div>

        <button
          type="button"
          data-testid="ward-capacity-review-discharges-btn"
          className={styles.linkish}
          onClick={() => {
            onClose();
            const href = wardBoardHref(unit.id);
            if (router) router.push(href);
            else window.location.assign(href);
          }}
        >
          Review {plural(releasesTodayCount, "expected discharge", "expected discharges")} today →
        </button>
      </div>
    </Dialog>
  );
}
