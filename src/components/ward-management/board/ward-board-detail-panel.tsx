"use client";

// Drawer review (6 Nov 2026): the bed's record opens in the kit right drawer (PanelDrawer) at every
// width, as Transport, Out of area and Discharges do, so the bed grid keeps the page's full width and
// one scroll. A sheet rising from the foot on a phone. The drawer is titled with the person, not
// "Who is in this bed"; the one main action ("Record that they have left") is the foot's primary.
// Split out of ward-board.tsx to keep that file under the line cap; WardBoard still owns every value.
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import {
  DrawerFootRow,
  Field,
  PanelDrawer,
  Select,
  StatusGlyph,
  StatusPill,
  TIME_FIELD_ERROR,
  TimeField,
  buttonClass,
  cx,
} from "@/components/wf";
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

import { useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Patient } from "@/components/ward-management/ward-patients";
import { PersonEntry } from "./ward-board-person-entry";
import { WardDiagnosisControl } from "./ward-board-ward-diagnosis";
import { plural } from "@/components/ward-management/ward-plural";

/** Redesign: the record's buttons are the kit's, so the panel matches the rest of the page. */
// Long labels ("Gone to an ED" and others) wrap inside the panel
// instead of running past its edge (QA 31 Oct 2026).
const SEC_BUTTON = cx(buttonClass({ variant: "sec" }), redesign.detailButtonWrap);
/** The foot's buttons: one filled primary across the drawer, then equal-height quiet ones. */
const FOOT_PRIMARY = cx(buttonClass({ variant: "pri" }), redesign.footPrimary);
const FOOT_SECONDARY = buttonClass({ variant: "sec" });

/** The drawer's title for a tile that stands for a class of bed rather than a person. */
function bedClassTitle(kind: Tile["kind"]): string {
  if (kind === "empty") return "An empty bed";
  if (kind === "closed") return "A closed bed";
  return "A bed out of service";
}

/** One status tag in the head (D-94: tone lives in the tag, never in a banner or stripe). */
function recordTag(tile: Tile, occupant: Occupant | null): ReactNode {
  if (tile.kind === "empty") return <StatusPill tone="success">Free</StatusPill>;
  if (tile.kind === "closed") return <StatusPill tone="closed">Closed</StatusPill>;
  if (tile.kind !== "occupied" && tile.kind !== "waiting")
    return <StatusPill tone="neutral">Out of service</StatusPill>;
  if (tile.kind === "waiting") return <StatusPill tone="neutral">Not arrived</StatusPill>;
  if (occupant === null) return null;
  // The passed discharge date was a red "PAST DATE" badge; it is the head's status pill now.
  if (occupant.pastDate) return <StatusPill tone="warning">Past date</StatusPill>;
  if (occupant.awayAtEdHours !== null) return <StatusPill tone="info">At an ED</StatusPill>;
  if (occupant.expectedDays !== null && occupant.confirmed) return <StatusPill tone="success">Confirmed</StatusPill>;
  return null;
}

/** Parts of the one-line subtitle, joined by a quiet dot that never starts a wrapped line. */
function joinSubtitle(parts: ReactNode[]): ReactNode {
  return parts.filter(Boolean).flatMap((part, index) =>
    index === 0
      ? [part]
      : [
          <span key={`dot-${index}`} aria-hidden="true">
            ·
          </span>,
          part,
        ],
  );
}

export function WardBoardDetailPanel({
  admissions,
  blockedTileCount,
  cardName,
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
  /** The tile's own card line (surname and initial), the title when no full name resolves. */
  cardName: string | undefined;
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
  const [dateTimeWrong, setDateTimeWrong] = useState(false);
  // Nothing chosen: no drawer. The bed grid itself is the prompt (drawer review, 6 Nov 2026).
  if (selectedTile === null) return null;

  const isPerson = selectedTile.kind === "occupied" || selectedTile.kind === "waiting";
  const tileWho = selectedTile.kind === "occupied" ? selectedTile.who : undefined;
  // Walkthrough D9: a referral-linked stay read "Unknown Patient". Resolved through the ward-scoped
  // identity projection (never the full referral array); still unresolved means the name is not
  // recorded, and the drawer falls back to the card's own line.
  const selectedAdmission = isPerson ? admissions.find((a) => a.id === selectedTile.key) : undefined;
  const resolved = isPerson
    ? resolvePatientIdentity
      ? resolvePatientIdentity(selectedAdmission)
      : resolveSubjectPatient(selectedAdmission, { patients, movements })
    : null;
  const resolvedForEntry =
    resolved === null
      ? undefined
      : resolved.patient
        ? resolved
        : { ...resolved, displayName: "Not recorded", formalName: "Not recorded" };
  const title = !isPerson
    ? bedClassTitle(selectedTile.kind)
    : resolved?.patient
      ? resolved.formalName
      : cardName || tileWho || nameFor(selectedTile.key);

  // One quiet line: the UMRN in Geist Mono, then the stay. Bed classes name the ward.
  const subtitle = isPerson
    ? joinSubtitle([
        resolved?.umrn ? (
          <span key="umrn" className={redesign.mono}>
            {resolved.umrn}
          </span>
        ) : null,
        selectedOccupant === null || selectedOccupant.days === null ? (
          <span key="stay">No stay yet</span>
        ) : (
          <span key="stay">
            <span className={redesign.mono} data-testid={`ward-board-selected-person-${selectedOccupant.key}-days`}>
              {selectedOccupant.days} day{selectedOccupant.days === 1 ? "" : "s"}
            </span>{" "}
            here
          </span>
        ),
      ])
    : unit.name;

  const editingDate = dateEdit?.admissionId === selectedTile.key;
  const occupied = selectedTile.kind === "occupied" && selectedOccupant !== null ? selectedOccupant : null;

  const startDateEdit = () => {
    if (editingDate) {
      setDateEdit(null);
      return;
    }
    const admission = admissions.find((row) => row.id === selectedTile.key);
    setDateTimeWrong(false);
    if (admission)
      setDateEdit({
        admissionId: admission.id,
        time: departureTimeInputValue(admission.expectedDischargeAt ?? now),
        day: admission.expectedDischargeAt === null ? "today" : "recorded",
      });
  };

  const foot =
    occupied !== null ? (
      <>
        <button
          type="button"
          className={FOOT_PRIMARY}
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
                `Recorded discharge: ${tileWho || nameFor(selectedTile.key)} has left the ward.`,
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
              who: tileWho || nameFor(selectedTile.key),
              admissionId: selectedTile.key,
            });
          }}
        >
          Record that they have left
        </button>
        <DrawerFootRow className={redesign.footRow}>
          <button
            type="button"
            className={FOOT_SECONDARY}
            onClick={() => {
              dialogTriggerRef.current =
                typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
              setSelectedBlocker(BED_RELEASE_BLOCKERS[0]);
              setBlockerDialogItem({
                key: `occupant-${occupied.key}`,
                selectableKey: occupied.key,
                label: occupied.confirmed ? "Confirmed discharge" : "Expected discharge",
                tone: "warn",
                when: "Discharge",
                chip: "Hold-up",
                text: `Recording what is holding up discharge for ${nameFor(occupied.key)}`,
                acts: [],
              });
            }}
          >
            Record hold-up
          </button>
          <button
            type="button"
            className={FOOT_SECONDARY}
            aria-expanded={editingDate}
            aria-controls={editingDate ? "ward-board-date-edit" : undefined}
            onClick={startDateEdit}
          >
            Move the date
          </button>
        </DrawerFootRow>
      </>
    ) : undefined;

  return (
    <PanelDrawer
      open
      onClose={closeDetail}
      title={title}
      titleId="ward-board-detail-heading"
      subtitle={<span className={redesign.drawerSubtitle}>{subtitle}</span>}
      tag={recordTag(selectedTile, selectedOccupant)}
      closeLabel="Close bed record"
      testId="ward-board-detail"
      className={redesign.recordDrawer}
      bodyClassName={redesign.recordDrawerBody}
      foot={foot}
    >
      {/* The drawer is portalled out of `.screen`, so this wrapper carries the Ward tokens the
          record's own styles read. */}
      <div className={styles.detailSheetBody} data-detail-kind={selectedTile.kind}>
        {isPerson ? (
          selectedOccupant !== null ? (
            <div className={redesign.record} data-testid="ward-board-detail-person">
              <PersonEntry
                occupant={selectedOccupant}
                idPrefix="ward-board-selected-person"
                displayDate={calendarDateOf(now, dayZero)}
                resolvedPatient={resolvedForEntry}
              />
              {/* Rule 2 spelled out where a reader is looking at one person rather than at the
                  grid: this bed is gone from the ward's count, and the person is not here. */}
              {selectedTile.kind === "waiting" && (
                <p className={styles.personLine}>Bed given away. Nobody has arrived yet.</p>
              )}
              {occupied !== null && (
                <section className={redesign.recordSection} aria-labelledby="ward-board-record-heading">
                  <h3 id="ward-board-record-heading" className={redesign.recordHeading}>
                    Record for this stay
                  </h3>
                  {editingDate && dateEdit !== null ? (
                    <form
                      id="ward-board-date-edit"
                      className={styles.dateEditForm}
                      onSubmit={(event) => {
                        event.preventDefault();
                        const admission = admissions.find((row) => row.id === selectedTile.key);
                        const today = parseReleaseDayInstant(
                          now,
                          dateEdit.day === "tomorrow" ? "tomorrow" : "today",
                          dateEdit.time,
                        );
                        if (!admission) return;
                        // An unfinished or not-real time stops the save with words (PR #1474 review).
                        if (today === undefined) {
                          setDateTimeWrong(true);
                          return;
                        }
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
                          "Expected discharge updated.",
                        );
                        setDateEdit(null);
                      }}
                    >
                      <Field label="Discharge day">
                        <Select
                          aria-label="Discharge day"
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
                      <Field
                        label="Expected discharge time"
                        hint="HH:MM"
                        error={dateTimeWrong ? TIME_FIELD_ERROR : undefined}
                      >
                        <TimeField
                          aria-label="Expected discharge time"
                          required
                          value={dateEdit.time}
                          onValueChange={(time) => {
                            setDateTimeWrong(false);
                            setDateEdit({ ...dateEdit, time });
                          }}
                        />
                      </Field>
                      <button type="submit" className={SEC_BUTTON}>
                        Save departure date
                      </button>
                      <button type="button" className={SEC_BUTTON} onClick={() => setDateEdit(null)}>
                        Cancel date change
                      </button>
                    </form>
                  ) : null}
                  <div data-testid="ward-board-away-at-ed" className={styles.awayAtEdBlock}>
                    {occupied.awayAtEdHours === null ? (
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
                        Gone to an ED
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`${SEC_BUTTON} ${styles.fullWidthBtn}`}
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
                    key={occupied.key}
                    occupant={occupied}
                    unitId={unit.id}
                    raise={raise}
                    dispatchAndReport={dispatchAndReport}
                  />
                  <div data-testid="ward-board-stepdown-container" className={styles.fullRowSpaced}>
                    <button
                      type="button"
                      className={`${SEC_BUTTON} ${styles.fullWidthBtn}`}
                      aria-pressed={occupied.stepDownCandidate}
                      data-testid="ward-board-stepdown-toggle"
                      onClick={() => {
                        const nextStepDown = !occupied.stepDownCandidate;
                        dispatchAndReport(
                          () =>
                            raise("SET_STEP_DOWN_CANDIDATE", {
                              actingUnitId: unit.id,
                              admissionId: occupied.key,
                              stepDownCandidate: nextStepDown,
                            }),
                          nextStepDown
                            ? `Marked ${nameFor(occupied.key)} as step-down candidate for subacute care.`
                            : `Removed step-down candidate flag for ${nameFor(occupied.key)}.`,
                        );
                      }}
                    >
                      {occupied.stepDownCandidate ? (
                        <>
                          <StatusGlyph tone="success" /> Marked for step-down
                        </>
                      ) : (
                        "Mark for step-down"
                      )}
                    </button>
                  </div>
                  {occupied.days !== null && occupied.days >= CLINICAL_VALUES.longStayPrompt.value && (
                    <div
                      className={`${styles.barrierSelectGroup} ${styles.fullRowSpaced}`}
                      data-testid="ward-board-barrier-container"
                    >
                      <label
                        htmlFor="ward-board-barrier-select"
                        className={cx(styles.leavingLabel, redesign.fieldLabel)}
                      >
                        Main discharge hold-up (stay: {plural(occupied.days, "day", "days")})
                      </label>
                      <Select
                        id="ward-board-barrier-select"
                        data-testid="ward-board-barrier-select"
                        value={occupied.dischargeBarrier ?? "None"}
                        onChange={(e) => {
                          const val = e.target.value;
                          dispatchAndReport(
                            () =>
                              raise("SET_DISCHARGE_BARRIER", {
                                actingUnitId: unit.id,
                                admissionId: occupied.key,
                                barrier: val === "None" ? null : (val as DischargeBarrier),
                              }),
                            `Hold-up for ${nameFor(occupied.key)}: ${val}`,
                          );
                        }}
                      >
                        <option value="None">None / Clear hold-up</option>
                        {DISCHARGE_BARRIERS.map((barrier) => (
                          <option key={barrier} value={barrier}>
                            {barrier}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </section>
              )}
              {/* Where they are going sits last in the body, right above the foot's primary that
                  records it. */}
              {occupied !== null && (
                <section className={cx(styles.leaving, redesign.recordSection)} data-testid="ward-board-record-leaving">
                  <LeavingDestinationField
                    id="ward-board-leaving-destination"
                    value={leavingDestination}
                    onChange={setLeavingDestination}
                  />
                </section>
              )}
            </div>
          ) : (
            /* Unreachable while the grid and the list are built from the same two calls, and said
               rather than rendered blank if it ever is: an empty panel would read as a loading
               failure, and inventing a person to fill it is the one thing this board must never do. */
            <p className={styles.personLine}>No record could be read for this bed.</p>
          )
        ) : (
          <div data-testid="ward-board-detail-bed-class">
            <p className={styles.detailLead}>
              {selectedTile.kind === "empty"
                ? `Free bed, one of ${emptyTileCount}.`
                : selectedTile.kind === "closed"
                  ? `Closed bed, one of ${closedTileCount}.`
                  : `Out of service, one of ${blockedTileCount}.`}
            </p>
            {/* The constraint the header already carries, repeated here only where it bites: a
                reader looking at a fillable bed is exactly the reader who needs to know what will
                and will not go in it. `constraintSentence` returns null when nothing constrains. */}
            {selectedTile.kind === "empty" && constraint !== null && <p className={styles.personLine}>{constraint}</p>}
            {/*
             * THE LINE THAT KEEPS SELECTION HONEST. `Unit.blocked` is a count and the Closed/Ready
             * split is derived from two more counts; no record anywhere says WHICH bed. So a reader
             * who has just clicked one of these tiles is told that they have selected a class of bed
             * and not a location.
             */}
            <p className={styles.detailNotLocation}>Bed location not recorded.</p>
          </div>
        )}
      </div>
    </PanelDrawer>
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
