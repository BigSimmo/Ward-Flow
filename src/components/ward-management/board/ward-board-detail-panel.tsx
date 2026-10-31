"use client";

// Redesign (approved 31 Oct 2026): the kit's small close, and the inner cards on the card radius.

// The bed board's right column: the detail panel for the chosen tile, with the person's plan and
// the ward's recording controls. Split out of ward-board.tsx to keep that file under the line cap;
// WardBoard still owns every value and passes it in.
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { Button, Field, Select, TextInput, buttonClass, cx } from "@/components/wf";
import { X } from "lucide-react";
import {
  LEAVING_DESTINATIONS,
  DISCHARGE_BARRIERS,
  type Admission,
  type LeavingDestination,
  type DischargeBarrier,
} from "@/components/ward-management/ward-admissions";
import { calendarDateOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { parseReleaseDayInstant } from "@/components/ward-management/ward/release-day";
import styles from "./board.module.css";
import redesign from "./ward-board-panels.module.css";
import { departureTimeInputValue, type Occupant, type ShiftTileItem, type Tile } from "./ward-board-model";

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Patient } from "@/components/ward-management/ward-patients";
import { PersonEntry } from "./ward-board-person-entry";
import { WardDiagnosisControl } from "./ward-board-ward-diagnosis";

/** Redesign: the record's buttons are the kit's, so the panel matches the rest of the page. */
// Long labels ("Record that they have gone to an emergency department") wrap inside the panel
// instead of running past its edge (QA 31 Oct 2026).
const SEC_BUTTON = cx(buttonClass({ variant: "sec" }), redesign.detailButtonWrap);
const PRI_BUTTON = cx(buttonClass({ variant: "pri" }), redesign.detailButtonWide, redesign.detailButtonWrap);

export function WardBoardDetailPanel({
  admissions,
  blockedTileCount,
  closeDetail,
  closedTileCount,
  constraint,
  dateEdit,
  dayZero,
  dialogTriggerRef,
  dispatchAndReport,
  emptyTileCount,
  leavingDestination,
  movements,
  nameFor,
  now,
  patients,
  raise,
  recordDepartureAndReport,
  recordWardDeparture,
  requireConfirmation,
  resolvePatientIdentity,
  selectedOccupant,
  selectedTile,
  setBlockerDialogItem,
  setDateEdit,
  setLeavingDestination,
  setPendingConfirm,
  setSelectedBlocker,
  unit,
}: {
  admissions: Admission[];
  blockedTileCount: number;
  closeDetail: () => void;
  closedTileCount: number;
  constraint: string | null;
  dateEdit: { admissionId: string; time: string; day: "recorded" | "today" | "tomorrow" } | null;
  dayZero: Date;
  dialogTriggerRef: RefObject<HTMLElement | null>;
  dispatchAndReport: (record: () => ReturnType<WardCommandDispatch>, success: string) => void;
  emptyTileCount: number;
  leavingDestination: LeavingDestination | "";
  movements: Movement[];
  nameFor: (admissionId: string | undefined) => string;
  now: Instant;
  patients: Patient[];
  raise: WardRaise;
  recordDepartureAndReport: (
    record: () => ReturnType<WardCommandDispatch>,
    success: string,
    admissionId: string,
  ) => void;
  recordWardDeparture: (
    admissionId: string,
    actingUnitId: string,
    leavingDestination: LeavingDestination,
  ) => ReturnType<WardCommandDispatch>;
  requireConfirmation: boolean;
  resolvePatientIdentity: (subject: Parameters<typeof resolveSubjectPatient>[0]) => ResolvedPatientInfo;
  selectedOccupant: Occupant | null;
  selectedTile: Tile | null;
  setBlockerDialogItem: Dispatch<SetStateAction<ShiftTileItem | null>>;
  setDateEdit: Dispatch<
    SetStateAction<{ admissionId: string; time: string; day: "recorded" | "today" | "tomorrow" } | null>
  >;
  setLeavingDestination: (destination: LeavingDestination) => void;
  setPendingConfirm: Dispatch<
    SetStateAction<{ kind: "leaving" | "away_at_ed"; who: string; item?: ShiftTileItem; admissionId?: string } | null>
  >;
  setSelectedBlocker: Dispatch<SetStateAction<BedReleaseBlocker>>;
  unit: Unit;
}) {
  return (
    <aside
      className={cx(styles.detail, redesign.detail)}
      id="ward-board-detail"
      aria-labelledby="ward-board-detail-heading"
      data-testid="ward-board-detail"
      data-detail-kind={selectedTile?.kind ?? "none"}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable area: tabIndex lets keyboard users scroll it
      tabIndex={0}
    >
      <div className={cx(styles.detailBar, redesign.detailBar)}>
        <h2 id="ward-board-detail-heading" className={cx(styles.detailHeading, redesign.detailHeading)}>
          {selectedTile === null
            ? "Who is in a bed"
            : selectedTile.kind === "occupied" || selectedTile.kind === "waiting"
              ? "Who is in this bed"
              : selectedTile.kind === "empty"
                ? "An empty bed"
                : selectedTile.kind === "closed"
                  ? "A closed bed"
                  : "A bed out of service"}
        </h2>
        {/* No Close on an empty panel — there is nothing to close, and a control that does
                nothing is worse than no control. */}
        {selectedTile !== null && (
          // Redesign: the kit's small close (a ghost icon button with a 40px invisible tap area), in
          // place of the board's tall square Close.
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            // Today's accessible name, so it never doubles the phone sheet's own "Close bed record".
            aria-label="Close"
            className={redesign.detailClose}
            onClick={closeDetail}
            data-testid="ward-board-detail-close"
          />
        )}
      </div>

      {selectedTile === null ? (
        // Device audit, 11 Oct 2026: a one-line prompt, not a 360px dashed placeholder.
        <p className={styles.detailEmpty} data-testid="ward-board-select-hint">
          Choose a bed to view its record.
        </p>
      ) : (
        <>
          {selectedTile.kind === "occupied" || selectedTile.kind === "waiting" ? (
            selectedOccupant !== null ? (
              <div className={cx(styles.person, redesign.person)} data-testid="ward-board-detail-person">
                <PersonEntry
                  occupant={selectedOccupant}
                  idPrefix="ward-board-selected-person"
                  displayDate={calendarDateOf(now, dayZero)}
                  resolvedPatient={(() => {
                    // Walkthrough D9: a referral-linked stay read "Unknown Patient". Resolved
                    // through the ward-scoped identity projection (never the full referral
                    // array); still unresolved means the name is not recorded.
                    const selectedAdmission = admissions.find((a) => a.id === selectedTile.key);
                    const resolved = resolvePatientIdentity
                      ? resolvePatientIdentity(selectedAdmission)
                      : resolveSubjectPatient(selectedAdmission, { patients, movements });
                    return resolved.patient
                      ? resolved
                      : { ...resolved, displayName: "Not recorded", formalName: "Not recorded" };
                  })()}
                />
                {/* Rule 2 spelled out where a reader is looking at one person rather than at the
                      grid: this bed is gone from the ward's count, and the person is not here. */}
                {selectedTile.kind === "waiting" && (
                  <p className={styles.personLine}>
                    This ward has already given this bed away. It is taken, not free, and nobody has arrived.
                  </p>
                )}
                {selectedTile.kind === "occupied" && (
                  <div className={styles.leaving} data-testid="ward-board-record-leaving">
                    <LeavingDestinationField
                      id="ward-board-leaving-destination"
                      value={leavingDestination}
                      onChange={setLeavingDestination}
                    />
                    <button
                      type="button"
                      className={PRI_BUTTON}
                      data-testid="ward-board-record-leaving-submit"
                      onClick={(e) => {
                        const executeLeaving = (leavingDestination: LeavingDestination) => {
                          recordDepartureAndReport(
                            () =>
                              recordWardDeparture
                                ? recordWardDeparture(selectedTile.key, unit.id, leavingDestination)
                                : raise("RECORD_LEAVING", {
                                    admissionId: selectedTile.key,
                                    actingUnitId: unit.id,
                                    leavingDestination,
                                  }),
                            `Recorded departure: ${selectedTile.who || nameFor(selectedTile.key)} has left the ward.`,
                            selectedTile.key,
                          );
                          closeDetail();
                        };

                        // Audit CS3-07: with no destination chosen yet, the confirmation asks for one.
                        if (!requireConfirmation && leavingDestination !== "") {
                          executeLeaving(leavingDestination);
                          return;
                        }

                        dialogTriggerRef.current = e.currentTarget;
                        setPendingConfirm({
                          kind: "leaving",
                          who: selectedTile.who || nameFor(selectedTile.key),
                          admissionId: selectedTile.key,
                        });
                      }}
                    >
                      Record that they have left
                    </button>
                  </div>
                )}

                {/* Secondary action controls */}
                {selectedTile.kind === "occupied" && (
                  <div className={styles.detailSecondaryActions}>
                    <button
                      type="button"
                      className={SEC_BUTTON}
                      data-tone="warn"
                      onClick={() => {
                        dialogTriggerRef.current =
                          typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
                        setSelectedBlocker(BED_RELEASE_BLOCKERS[0]);
                        setBlockerDialogItem({
                          key: `occupant-${selectedOccupant.key}`,
                          selectableKey: selectedOccupant.key,
                          label: selectedOccupant.confirmed ? "Confirmed discharge" : "Expected discharge",
                          tone: "warn",
                          when: "Discharge",
                          chip: "Discharge blocker",
                          text: `Recording what is holding up departure for ${nameFor(selectedOccupant.key)}`,
                          acts: [],
                        });
                      }}
                    >
                      Record a blocker
                    </button>
                    {dateEdit?.admissionId === selectedTile.key ? (
                      <form
                        className={styles.dateEditForm}
                        onSubmit={(event) => {
                          event.preventDefault();
                          const admission = admissions.find((row) => row.id === selectedTile.key);
                          const today = parseReleaseDayInstant(
                            now,
                            dateEdit.day === "tomorrow" ? "tomorrow" : "today",
                            dateEdit.time,
                          );
                          if (!admission || today === undefined) return;
                          const expectedDischargeAt =
                            dateEdit.day === "recorded" && admission.expectedDischargeAt !== null
                              ? today +
                                (Math.floor(admission.expectedDischargeAt / MINUTES_PER_DAY) -
                                  Math.floor(now / MINUTES_PER_DAY)) *
                                  MINUTES_PER_DAY
                              : today;
                          dispatchAndReport(
                            () =>
                              raise("UPDATE_EXPECTED_DISCHARGE", {
                                actingUnitId: unit.id,
                                admissionId: admission.id,
                                expectedDischargeAt,
                              }),
                            "Expected departure updated.",
                          );
                          setDateEdit(null);
                        }}
                      >
                        <Field label="Departure day">
                          <Select
                            aria-label="Departure day"
                            value={dateEdit.day}
                            onChange={(event) =>
                              setDateEdit({
                                ...dateEdit,
                                day: event.target.value as "recorded" | "today" | "tomorrow",
                              })
                            }
                          >
                            <option value="recorded">Keep recorded day</option>
                            <option value="today">Today</option>
                            <option value="tomorrow">Tomorrow</option>
                          </Select>
                        </Field>
                        <Field label="Expected departure time">
                          <TextInput
                            aria-label="Expected departure time"
                            type="time"
                            required
                            value={dateEdit.time}
                            onChange={(event) => setDateEdit({ ...dateEdit, time: event.target.value })}
                          />
                        </Field>
                        <button type="submit" className={SEC_BUTTON}>
                          Save departure date
                        </button>
                        <button type="button" className={SEC_BUTTON} onClick={() => setDateEdit(null)}>
                          Cancel date change
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className={SEC_BUTTON}
                        onClick={() => {
                          const admission = admissions.find((row) => row.id === selectedTile.key);
                          if (admission)
                            setDateEdit({
                              admissionId: admission.id,
                              time: departureTimeInputValue(admission.expectedDischargeAt ?? now),
                              day: admission.expectedDischargeAt === null ? "today" : "recorded",
                            });
                        }}
                      >
                        Move the date
                      </button>
                    )}
                    <div data-testid="ward-board-away-at-ed" className={styles.awayAtEdBlock}>
                      {selectedOccupant.awayAtEdHours === null ? (
                        <button
                          type="button"
                          className={`${SEC_BUTTON} ${styles.fullWidthBtn}`}
                          data-testid="ward-board-record-away-submit"
                          onClick={(e) => {
                            const executeAway = () => {
                              dispatchAndReport(
                                () =>
                                  raise("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT", {
                                    admissionId: selectedTile.key,
                                    actingUnitId: unit.id,
                                  }),
                                `Recorded: ${nameFor(selectedTile.key)} is currently away at an emergency department. Their bed is still held.`,
                              );
                            };

                            if (!requireConfirmation) {
                              executeAway();
                              return;
                            }

                            dialogTriggerRef.current = e.currentTarget;
                            setPendingConfirm({
                              kind: "away_at_ed",
                              who: nameFor(selectedTile.key),
                              admissionId: selectedTile.key,
                            });
                          }}
                        >
                          Record that they have gone to an emergency department
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${SEC_BUTTON} ${styles.fullWidthBtn}`}
                          data-tone="good"
                          data-testid="ward-board-record-returned-submit"
                          onClick={() =>
                            dispatchAndReport(
                              () =>
                                raise("RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT", {
                                  admissionId: selectedTile.key,
                                  actingUnitId: unit.id,
                                }),
                              `Returned to ward: ${nameFor(selectedTile.key)} marked back from the emergency department.`,
                            )
                          }
                        >
                          Record that they are back on the ward
                        </button>
                      )}
                      <p className={`${styles.personLine} ${styles.awayAtEdNote}`}>This trip does not free the bed.</p>
                    </div>
                    <WardDiagnosisControl
                      key={selectedOccupant.key}
                      occupant={selectedOccupant}
                      unitId={unit.id}
                      raise={raise}
                      dispatchAndReport={dispatchAndReport}
                    />
                    <div data-testid="ward-board-stepdown-container" className={styles.fullRowSpaced}>
                      <button
                        type="button"
                        className={`${SEC_BUTTON} ${styles.fullWidthBtn}`}
                        data-tone={selectedOccupant.stepDownCandidate ? "good" : undefined}
                        data-testid="ward-board-stepdown-toggle"
                        onClick={() => {
                          const nextStepDown = !selectedOccupant.stepDownCandidate;
                          dispatchAndReport(
                            () =>
                              raise("SET_STEP_DOWN_CANDIDATE", {
                                actingUnitId: unit.id,
                                admissionId: selectedOccupant.key,
                                stepDownCandidate: nextStepDown,
                              }),
                            nextStepDown
                              ? `Marked ${nameFor(selectedOccupant.key)} as step-down candidate for subacute care.`
                              : `Removed step-down candidate flag for ${nameFor(selectedOccupant.key)}.`,
                          );
                        }}
                      >
                        {selectedOccupant.stepDownCandidate
                          ? "✓ Marked as Step-Down Candidate (Subacute Transfer)"
                          : "Mark as Step-Down Candidate (Subacute Transfer)"}
                      </button>
                    </div>
                    {selectedOccupant.days !== null &&
                      selectedOccupant.days >= CLINICAL_VALUES.longStayPrompt.value && (
                        <div
                          className={`${styles.barrierSelectGroup} ${styles.fullRowSpaced}`}
                          data-testid="ward-board-barrier-container"
                        >
                          <label
                            htmlFor="ward-board-barrier-select"
                            className={cx(styles.leavingLabel, redesign.fieldLabel)}
                          >
                            Primary Discharge Barrier (Stay: {selectedOccupant.days} days)
                          </label>
                          <Select
                            id="ward-board-barrier-select"
                            data-testid="ward-board-barrier-select"
                            value={selectedOccupant.dischargeBarrier ?? "None"}
                            onChange={(e) => {
                              const val = e.target.value;
                              dispatchAndReport(
                                () =>
                                  raise("SET_DISCHARGE_BARRIER", {
                                    actingUnitId: unit.id,
                                    admissionId: selectedOccupant.key,
                                    barrier: val === "None" ? null : (val as DischargeBarrier),
                                  }),
                                `Discharge barrier for ${nameFor(selectedOccupant.key)}: ${val}`,
                              );
                            }}
                          >
                            <option value="None">None / Clear barrier</option>
                            {DISCHARGE_BARRIERS.map((barrier) => (
                              <option key={barrier} value={barrier}>
                                {barrier}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                  </div>
                )}
              </div>
            ) : (
              /* Unreachable while the grid and the list are built from the same two calls, and
                   said rather than rendered blank if it ever is: an empty panel would read as a
                   loading failure, and inventing a person to fill it is the one thing this board
                   must never do. */
              <p className={styles.personLine}>No record could be read for this bed.</p>
            )
          ) : (
            <div data-testid="ward-board-detail-bed-class">
              <p className={styles.detailLead}>
                {selectedTile.kind === "empty"
                  ? `One of this ward's ${emptyTileCount} bed${emptyTileCount === 1 ? "" : "s"} a coordinator can fill right now.`
                  : selectedTile.kind === "closed"
                    ? `One of this ward's ${closedTileCount} bed${closedTileCount === 1 ? "" : "s"} that are empty but not offered by this ward.`
                    : `One of this ward's ${blockedTileCount} bed${blockedTileCount === 1 ? "" : "s"} that are out of service and cannot be filled today.`}
              </p>
              {/* The constraint the header already carries, repeated here only where it bites: a
                    reader looking at a fillable bed is exactly the reader who needs to know what
                    will and will not go in it. `constraintSentence` returns null rather than an
                    empty string when nothing constrains. */}
              {selectedTile.kind === "empty" && constraint !== null && (
                <p className={styles.personLine}>{constraint}</p>
              )}
              {/*
               * THE LINE THAT KEEPS SELECTION HONEST. `Unit.blocked` is a count and
               * the Closed/Ready split is derived from two more counts; no record
               * anywhere says WHICH bed. So a reader who has just clicked one of these tiles is
               * told, on the panel, that they have selected a class of bed and not a location.
               */}
              <p className={styles.detailNotLocation}>
                Bed location is not recorded; this tile represents part of a count.
              </p>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

/**
 * Where a person went when they left the ward (audit CS3-07): starts blank, with no default, so a
 * departure is never recorded to a destination nobody chose.
 */
export function LeavingDestinationField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: LeavingDestination | "";
  onChange: (destination: LeavingDestination) => void;
}) {
  return (
    <>
      <label className={cx(styles.leavingLabel, redesign.fieldLabel)} htmlFor={id}>
        Where are they going?
      </label>
      <Select
        id={id}
        data-testid={id}
        value={value}
        required
        onChange={(changed) => onChange(changed.target.value as LeavingDestination)}
      >
        <option value="" disabled>
          Choose where they are going
        </option>
        {LEAVING_DESTINATIONS.map((destination) => (
          <option key={destination.id} value={destination.id}>
            {destination.label}
          </option>
        ))}
      </Select>
    </>
  );
}
