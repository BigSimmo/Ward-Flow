"use client";

// Preview copy of My ward's Confirm capacity figures dialog: the frame from
// `ward/ward-screen-overlays.tsx` (`WardScreenCapacityModal`) and the form and its two handlers from
// `ward/ward-screen.tsx` (`capacityConfirmationForm`, `submitCapacity`,
// `handleConfirmBedsAndMorningRollup`). The wiring is unchanged; the layout is the redesign.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { releaseBand } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { dayOf, formatInstant } from "@/components/ward-management/ward-clock";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { formatWardOccupancy, wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { plural } from "@/components/ward-management/ward-plural";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import { useWardUnitQueues } from "@/components/ward-management/ward/use-ward-unit-queues";
import {
  useWardCommandCompletion,
  wardCommandFailure,
} from "@/components/ward-management/ward/use-ward-command-completion";
import { useWardPageToast, WardPageActionToast } from "@/components/ward-management/ward/ward-page-action-toast";
import { Button, Dialog } from "@/components/wf";
import type { DialogAction } from "@/components/wf/dialog";

import styles from "./confirm-beds.module.css";

/** The ward the mock-up draws, as the app's own example address does. */
const WARD_ID = "rph-adult-secure";

const beds = (count: number) => plural(count, "bed", "beds");

export function ConfirmBedsDialog() {
  const { units, admissions, bedReleases, leaveBeds, movements, morningRollupConfirmations, configuration } =
    useWardFlowSelect(
      "units",
      "admissions",
      "bedReleases",
      "leaveBeds",
      "movements",
      "morningRollupConfirmations",
      "configuration",
    );
  const now = useWardFlowClock();
  const router = useRouter();
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole === "bed_manager" ? "bed_manager" : "ward");
  const completeCommand = useWardCommandCompletion();
  const [toastMessage, setToastMessage] = useWardPageToast();
  const warnToast = (text: string) => setToastMessage({ warning: text });
  const unit = units.find((candidate) => candidate.id === WARD_ID);
  const { pendingBedReleases } = useWardUnitQueues({ unit, bedReleases, leaveBeds, movements });
  const [open, setOpen] = useState(true);
  const [capacityRevision, setCapacityRevision] = useState(() => unit?.allocatable.revision ?? 0);
  const [capacityValue, setCapacityValue] = useState<string>(() => String(unit?.allocatable.value ?? 0));

  if (!unit) return null;
  const capacity = unitCapacity(unit, bedReleases);
  const states = bedStates(unit, admissions, bedReleases, leaveBeds);
  const occupancy = wardOccupancy([unit], admissions, bedReleases);
  const releasesCountedToday = pendingBedReleases.filter((release) => releaseBand(release, now) !== "beyond-today");
  const rollupConfirmation = morningRollupConfirmations?.[unit.id];
  const isRollupConfirmedToday = Boolean(rollupConfirmation && dayOf(rollupConfirmation.confirmedAt) === dayOf(now));
  const morningRollupDeadlineMinutes = configuration?.morningRollupDeadlineMinutes ?? 570;
  const rollupHour = Math.floor(morningRollupDeadlineMinutes / 60);
  const rollupMin = morningRollupDeadlineMinutes % 60;
  const morningRollupTimeLabel = `${String(rollupHour).padStart(2, "0")}:${String(rollupMin).padStart(2, "0")}`;
  const staleRevision = capacityRevision !== (unit.allocatable.revision ?? 0);
  const openVacant = Math.max(0, unit.beds - capacity.occupied - states.closed);
  const parsedValue = parseInt(capacityValue, 10);
  const change = (() => {
    if (isNaN(parsedValue)) return "Not recorded";
    const delta = parsedValue - unit.allocatable.value;
    const word = Math.abs(delta) === 1 ? "bed" : "beds";
    return delta > 0 ? `+${delta} ${word}` : delta < 0 ? `${delta} ${word}` : "No change";
  })();

  function submitCapacity() {
    if (!unit) return;
    const parsed = Number(capacityValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    // `actingUnitId` is the ward this screen acts as, as on the ward screen.
    completeCommand(
      "capacity",
      () =>
        raise("CONFIRM_CAPACITY", {
          unitId: unit.id,
          actingUnitId: unit.id,
          value: Math.floor(parsed),
          expectedRevision: capacityRevision,
        }),
      (outcome) => {
        const failure = wardCommandFailure(outcome);
        if (failure) warnToast(failure);
        else setToastMessage(`Capacity confirmed: ${beds(Math.floor(parsed))} free.`);
      },
    );
  }

  function handleConfirmBedsAndMorningRollup() {
    if (!unit) return;
    const parsed = Number(capacityValue);
    if (capacityValue.trim() === "" || !Number.isInteger(parsed) || parsed < 0 || parsed > unit.beds) {
      warnToast(`Enter a whole number from 0 to ${unit.beds} beds.`);
      return;
    }
    if (staleRevision) {
      warnToast("Capacity has changed. Refresh the current bed count before confirming.");
      return;
    }
    completeCommand(
      "capacity-rollup",
      () =>
        raise("CONFIRM_CAPACITY", {
          unitId: unit.id,
          actingUnitId: unit.id,
          value: parsed,
          expectedRevision: capacityRevision,
        }),
      (capacityOutcome) => {
        const failure = wardCommandFailure(capacityOutcome);
        if (failure) {
          warnToast(failure);
          return;
        }
        const confirmed = () =>
          setToastMessage(
            `Capacity and morning bed numbers confirmed (due ${morningRollupTimeLabel}): ${plural(releasesCountedToday.length, "discharge", "discharges")} planned today.`,
          );
        if (isRollupConfirmedToday) {
          confirmed();
          return;
        }
        completeCommand(
          "capacity-rollup",
          () =>
            raise("CONFIRM_MORNING_ROLLUP", {
              unitId: unit.id,
              actingUnitId: unit.id,
              expectedDischarges: releasesCountedToday.length,
            }),
          (rollupOutcome) => {
            const rollupFailure = wardCommandFailure(rollupOutcome);
            if (rollupFailure) warnToast(`Capacity saved. Morning bed numbers are not confirmed. ${rollupFailure}`);
            else confirmed();
          },
        );
      },
    );
  }

  const close = () => setOpen(false);
  const step = (by: number) => {
    const base = isNaN(parsedValue) ? unit.allocatable.value : parsedValue;
    setCapacityValue(String(Math.min(unit.beds, Math.max(0, base + by))));
  };
  // Redesign: one filled button. With the morning numbers still due, it confirms both together and
  // "Confirm beds only" sits beside Cancel; once they are in, it confirms the beds alone.
  const primary: DialogAction = isRollupConfirmedToday
    ? { label: "Confirm beds", onAction: submitCapacity }
    : {
        label: `Confirm beds and morning numbers (${morningRollupTimeLabel})`,
        onAction: handleConfirmBedsAndMorningRollup,
      };
  const secondary: DialogAction[] = [
    { label: "Cancel", onAction: close },
    ...(isRollupConfirmedToday ? [] : [{ label: "Confirm beds only", onAction: submitCapacity }]),
  ];

  const facts = [
    { label: "Staffed beds", value: String(unit.beds), sub: null },
    {
      label: "In use",
      value: `${occupancy.inUse} of ${unit.beds}`,
      sub: formatWardOccupancy(occupancy),
    },
    { label: "Ready", value: String(capacity.available), sub: "free to offer" },
    { label: `${BED_STATE_LABELS.closed}`, value: String(states.closed), sub: "not offered" },
  ];

  return (
    <>
      <Dialog
        open={open}
        onClose={close}
        // Redesign: wide enough for the three footer buttons on one row.
        size="lg"
        // Redesign: the ward is named once, in the title; the intro sentence repeated it.
        title={`Confirm capacity figures — ${unit.name}`}
        primary={primary}
        secondary={secondary}
        closeLabel="Close capacity confirmation"
        data-testid="ward-capacity-form"
      >
        <div className={styles.body}>
          {/* Redesign (review notes): the facts first, as four tiles, before the number to confirm. */}
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

          {/* Then the free-bed control. */}
          <div className={styles.control}>
            <label className={styles.controlLabel} htmlFor="ward-capacity-input">
              {/* Redesign: the tiles' own word ("free to offer"), not "allocatable". */}
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
              <button
                type="button"
                className={styles.linkish}
                onClick={() => {
                  setCapacityValue(String(unit.allocatable.value));
                  setCapacityRevision(unit.allocatable.revision ?? 0);
                }}
              >
                Start a new capacity observation from the current count
              </button>
            ) : null}
          </div>

          <button
            type="button"
            data-testid="ward-capacity-review-discharges-btn"
            className={styles.linkish}
            onClick={() => {
              close();
              router.push(wardBoardHref(unit.id));
            }}
          >
            {/* Redesign: the count names its noun, and the arrow comes last. */}
            Review {plural(releasesCountedToday.length, "expected discharge", "expected discharges")} today →
          </button>
        </div>
      </Dialog>
      <WardPageActionToast toast={toastMessage} onClose={() => setToastMessage(null)} />
    </>
  );
}
