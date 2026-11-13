"use client";

import { useMemo, useState } from "react";
import { BellPlus, X } from "lucide-react";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { edById } from "@/components/ward-management/ward-sites";
import { Button, ChipGroup, FilterChip, Segmented, ShowMoreRow, foldHidden, foldLimit } from "@/components/wf";
import {
  DEVICE_ONLY_LABEL,
  REMIND_REASONS,
  addReminder,
  removeReminder,
  useReminders,
  type RemindKind,
  type RemindReason,
  wardNames,
} from "./ward-tool-remind-store";
import styles from "./ward-tool-remind-me.module.css";

/** Reminders the person has set, for the Tools row count. */
export function useReminderCount(): number {
  return useReminders().length;
}

type WhenId = "30" | "60" | "120" | "shift";
const WHEN_ITEMS: { id: WhenId; label: string }[] = [
  { id: "30", label: "30m" },
  { id: "60", label: "1h" },
  { id: "120", label: "2h" },
  { id: "shift", label: "Shift end" },
];
const KIND_ITEMS: { id: RemindKind; label: string }[] = [
  { id: "ward", label: "Ward" },
  { id: "bed", label: "Bed" },
  { id: "movement", label: "Movement" },
];
const WARD_LIMIT = 6;
const MOVE_LIMIT = 5;

function dueAtFor(when: WhenId, now: number): number {
  return when === "shift" ? shiftEndInstant(now) : now + Number(when);
}

function bedText(bed: number): string {
  return String(bed).padStart(2, "0");
}

/** Q323: a reminder on a ward, a bed or an open movement, picked from lists only (no typed text). */
function movementFrom(edId: string | undefined): string {
  const ed = edById(edId);
  return ed ? `From ${ed.name}` : "From another site";
}

export function ToolRemindMe({ onNavigate }: { onNavigate: () => void }) {
  void onNavigate;
  const { units, movements } = useWardFlowSelect("units", "movements");
  const now = useWardFlowClock();
  const access = useEffectiveWardAccess();
  const reminders = useReminders();

  const [kind, setKind] = useState<RemindKind>("ward");
  const [wardId, setWardId] = useState<string | null>(null);
  const [bed, setBed] = useState<number | null>(null);
  const [movementId, setMovementId] = useState<string | null>(null);
  const [when, setWhen] = useState<WhenId>("60");
  const [reason, setReason] = useState<RemindReason | null>(null);
  const [allWards, setAllWards] = useState(false);
  const [allMoves, setAllMoves] = useState(false);

  // A ward desk's own ward comes first.
  const wards = useMemo(() => {
    const own = access.scope.kind === "ward" ? new Set(access.scope.unitIds) : new Set<string>();
    return [...units].sort((a, b) => Number(own.has(b.id)) - Number(own.has(a.id)));
  }, [units, access]);
  const names = useMemo(() => wardNames(units), [units]);
  const unitName = (id: string | undefined) => (id === undefined ? undefined : names.get(id));
  const openMoves = useMemo(() => movements.filter((move) => move.closure === undefined), [movements]);

  const ward = wards.find((unit) => unit.id === wardId);
  const folded = wards.slice(0, foldLimit(wards.length, WARD_LIMIT));
  // A picked ward stays in view when the list folds.
  const shownWards = allWards ? wards : ward && !folded.includes(ward) ? [...folded, ward] : folded;
  const hiddenWards = foldHidden(wards.length, WARD_LIMIT);
  const shownMoves = allMoves ? openMoves : openMoves.slice(0, foldLimit(openMoves.length, MOVE_LIMIT));
  const hiddenMoves = foldHidden(openMoves.length, MOVE_LIMIT);

  const target: { id: string; label: string } | null =
    kind === "ward" && ward
      ? { id: ward.id, label: unitName(ward.id) ?? ward.name }
      : kind === "bed" && ward && bed !== null
        ? { id: `${ward.id}:${bed}`, label: `Bed ${bedText(bed)}, ${unitName(ward.id) ?? ward.name}` }
        : kind === "movement" && movementId
          ? {
              id: movementId,
              label: `Movement ${movementFrom(movements.find((move) => move.id === movementId)?.originEdId).toLowerCase()}`,
            }
          : null;
  const missing = !target
    ? kind === "bed" && ward
      ? "Pick a bed"
      : kind === "movement"
        ? "Pick a movement"
        : "Pick a ward"
    : !reason
      ? "Pick a reason"
      : undefined;
  const dueAt = dueAtFor(when, now);

  function chooseKind(next: RemindKind) {
    setKind(next);
    setBed(null);
  }

  function save() {
    if (!target || !reason) return;
    addReminder({ kind, targetId: target.id, targetLabel: target.label, reason, dueAt });
    setReason(null);
  }

  return (
    <div className={styles.tool}>
      <div className={styles.step}>
        <span className={styles.label}>What</span>
        <Segmented items={KIND_ITEMS} value={kind} onChange={chooseKind} label="Remind me about" size="md" />
      </div>

      {kind === "movement" ? (
        <div className={styles.step}>
          <span className={styles.label} id="remind-which-move">
            Which movement
          </span>
          {openMoves.length === 0 ? (
            <p className={styles.quiet}>No open movements.</p>
          ) : (
            <>
              <ul className={styles.list} id="remind-move-list" aria-labelledby="remind-which-move">
                {shownMoves.map((move) => {
                  const picked = move.id === movementId;
                  const to = unitName(move.acceptedUnitId);
                  return (
                    <li key={move.id}>
                      <button
                        type="button"
                        className={styles.pick}
                        aria-pressed={picked}
                        onClick={() => setMovementId(picked ? null : move.id)}
                      >
                        {/* D-39: a movement is named by where it starts, never by its record id. */}
                        <span>{movementFrom(move.originEdId)}</span>
                        <span className={styles.meta}>{to ? `To ${to}` : "No bed yet"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {hiddenMoves > 0 ? (
                <ShowMoreRow onClick={() => setAllMoves(!allMoves)} expanded={allMoves} controls="remind-move-list">
                  {allMoves ? "Show fewer" : `Show ${hiddenMoves} more`}
                </ShowMoreRow>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className={styles.step}>
          <span className={styles.label}>Which ward</span>
          <ChipGroup label="Which ward" className={styles.chips}>
            {shownWards.map((unit) => (
              <FilterChip
                key={unit.id}
                pressed={unit.id === wardId}
                onPressedChange={(on) => {
                  setWardId(on ? unit.id : null);
                  setBed(null);
                }}
              >
                {unitName(unit.id) ?? unit.name}
              </FilterChip>
            ))}
          </ChipGroup>
          {hiddenWards > 0 ? (
            <ShowMoreRow onClick={() => setAllWards(!allWards)} expanded={allWards}>
              {allWards ? "Show fewer" : `Show ${hiddenWards} more`}
            </ShowMoreRow>
          ) : null}
        </div>
      )}

      {kind === "bed" && ward ? (
        <div className={styles.step}>
          <span className={styles.label}>Which bed</span>
          <ChipGroup label={`Which bed on ${unitName(ward.id) ?? ward.name}`} className={styles.chips}>
            {Array.from({ length: ward.beds }, (_, index) => index + 1).map((number) => (
              <FilterChip
                key={number}
                pressed={number === bed}
                onPressedChange={(on) => setBed(on ? number : null)}
                className={styles.bedChip}
              >
                {bedText(number)}
              </FilterChip>
            ))}
          </ChipGroup>
        </div>
      ) : null}

      <div className={styles.step}>
        <span className={styles.label}>
          When <span className={styles.at}>{formatInstantWithDay(dueAt, now)}</span>
        </span>
        <Segmented items={WHEN_ITEMS} value={when} onChange={setWhen} label="When" size="md" />
      </div>

      <div className={styles.step}>
        <span className={styles.label}>Reason</span>
        <ChipGroup label="Reason" className={styles.chips}>
          {REMIND_REASONS.map((item) => (
            <FilterChip key={item} pressed={item === reason} onPressedChange={(on) => setReason(on ? item : null)}>
              {item}
            </FilterChip>
          ))}
        </ChipGroup>
      </div>

      <div className={styles.actions}>
        <Button variant="pri" icon={BellPlus} disabledReason={missing} onClick={save}>
          Set reminder
        </Button>
      </div>

      <section className={styles.yours} aria-labelledby="remind-yours">
        <h4 className={styles.label} id="remind-yours">
          Your reminders
        </h4>
        <p className={styles.note} data-testid="remind-device-only">
          {DEVICE_ONLY_LABEL}. Not part of the shared record.
        </p>
        {reminders.length === 0 ? (
          <p className={styles.quiet}>None set.</p>
        ) : (
          <ul className={styles.list}>
            {reminders.map((item) => (
              <li key={item.id} className={styles.reminder}>
                <span className={styles.time}>{formatInstantWithDay(item.dueAt, now)}</span>
                <span className={styles.what}>
                  <span>{item.targetLabel}</span>
                  <span className={styles.meta}>{item.reason}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => removeReminder(item.id)}
                  aria-label={`Remove reminder for ${item.targetLabel} at ${formatInstantWithDay(item.dueAt, now)}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>Each one shows in Alerts when it is due.</p>
      </section>
    </div>
  );
}
