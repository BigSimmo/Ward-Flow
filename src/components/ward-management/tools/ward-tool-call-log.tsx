"use client";

import { useMemo, useState } from "react";
import { PhoneCall, X } from "lucide-react";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { dayOf, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { readyBedsNow } from "@/components/ward-management/ward-bed-states";
import { shiftConfirmations } from "@/components/ward-management/capacity/shift-confirmations";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import {
  Button,
  ChipGroup,
  FilterChip,
  Radio,
  Segmented,
  ShowMoreRow,
  SrOnly,
  Switch,
  foldHidden,
  foldLimit,
} from "@/components/wf";
import { addCallLog, removeCallLog, useCallLog, type CallOutcome } from "./ward-tool-call-log-store";
import { addReminder, wardNames } from "./ward-tool-remind-store";
import remind from "./ward-tool-remind-me.module.css";
import styles from "./ward-tool-call-log.module.css";

const WARD_LIMIT = 6;
/** "A bed later today": about when, as the next whole hours a ward usually names. */
const LATER_STEPS = ["1", "3", "5"] as const;
type LaterStep = (typeof LATER_STEPS)[number];

const OUTCOME_WORDS: Record<CallOutcome, string> = {
  "as-shown": "Beds as shown",
  later: "A bed later today",
  none: "No bed today",
  "no-answer": "No answer",
};

function laterAt(step: LaterStep, now: number): number {
  return (Math.floor(now / 60) + Number(step)) * 60;
}

/**
 * Call and log (Josh, 8 Nov 2026): after ringing a ward, the coordinator records what it said in
 * three taps, and can set a ring-back. Wards not confirmed this shift come first. Kept in this
 * browser only; it never changes a ward's figures, which only the ward confirms.
 */
export function ToolCallLog() {
  const { units, admissions, bedReleases, movements, referrals } = useWardFlowSelect(
    "units",
    "admissions",
    "bedReleases",
    "movements",
    "referrals",
  );
  const now = useWardFlowClock();
  const log = useCallLog();

  const [wardId, setWardId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [step, setStep] = useState<LaterStep>("3");
  const [ringBack, setRingBack] = useState(true);
  const [allWards, setAllWards] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const names = useMemo(() => wardNames(units), [units]);
  // Wards not confirmed this shift first (oldest first), then the rest by name.
  // Keyed on the shift's start, so a minute tick does not reshuffle it but a new shift does.
  const shiftStart = currentShiftStartInstant(now);
  const waiting = useMemo(() => shiftConfirmations(units, shiftStart).waiting, [units, shiftStart]);
  const unconfirmed = useMemo(() => new Set(waiting.map((unit) => unit.id)), [waiting]);
  const wards = useMemo(
    () => [
      ...waiting,
      ...[...units].filter((unit) => !unconfirmed.has(unit.id)).sort((a, b) => a.name.localeCompare(b.name)),
    ],
    [units, waiting, unconfirmed],
  );

  const ward = wards.find((unit) => unit.id === wardId);
  const folded = wards.slice(0, foldLimit(wards.length, WARD_LIMIT));
  const shownWards = allWards ? wards : ward && !folded.includes(ward) ? [...folded, ward] : folded;
  const hiddenWards = foldHidden(wards.length, WARD_LIMIT);
  const wardLabel = ward ? (names.get(ward.id) ?? ward.name) : "";

  // Only times still today: past midnight is not "later today" (review, 8 Nov 2026).
  const steps = LATER_STEPS.filter((id) => dayOf(laterAt(id, now)) === dayOf(now));
  const chosenStep = steps.includes(step) ? step : steps[0];
  const bedAt = outcome === "later" && chosenStep ? laterAt(chosenStep, now) : undefined;
  // A ring-back fits only when there is something to chase.
  const offersRingBack = outcome === "later" || outcome === "no-answer";
  const ringAt = outcome === "later" && bedAt !== undefined ? bedAt : now + 30;
  const missing = !ward ? "Pick a ward" : !outcome ? "Pick what the ward said" : undefined;

  function save() {
    if (!ward || !outcome) return;
    addCallLog({ wardId: ward.id, wardLabel, outcome, bedAt, at: now });
    if (offersRingBack && ringBack) {
      addReminder({ kind: "ward", targetId: ward.id, targetLabel: wardLabel, reason: "Call back", dueAt: ringAt });
    }
    setSaved(
      `Saved: ${wardLabel}, ${OUTCOME_WORDS[outcome].toLowerCase()}${offersRingBack && ringBack ? `. Ring-back set for ${formatInstantWithDay(ringAt, now)}` : ""}.`,
    );
    setWardId(null);
    setOutcome(null);
  }

  // The same Ready count as the Capacity page, never the raw ward observation (review, 8 Nov 2026).
  const free = ward ? readyBedsNow(ward, admissions, bedReleases, [...movements, ...referrals]) : 0;
  const detail: Record<CallOutcome, string> = {
    "as-shown": ward ? `The board shows ${free} free` : "The board is right",
    later: "One should free up today",
    none: "Nothing free today",
    "no-answer": "Try again later",
  };

  return (
    <div className={remind.tool}>
      <div className={remind.step}>
        <span className={remind.label}>Which ward</span>
        <ChipGroup label="Which ward" className={remind.chips}>
          {shownWards.map((unit) => (
            <FilterChip
              key={unit.id}
              pressed={unit.id === wardId}
              onPressedChange={(on) => {
                setWardId(on ? unit.id : null);
                setSaved(null);
              }}
            >
              {unconfirmed.has(unit.id) ? <span className={styles.due} aria-hidden="true" /> : null}
              {names.get(unit.id) ?? unit.name}
              {unconfirmed.has(unit.id) ? <SrOnly>, not confirmed this shift</SrOnly> : null}
            </FilterChip>
          ))}
        </ChipGroup>
        {hiddenWards > 0 ? (
          <ShowMoreRow onClick={() => setAllWards(!allWards)} expanded={allWards}>
            {allWards ? "Show fewer" : `Show ${hiddenWards} more`}
          </ShowMoreRow>
        ) : null}
      </div>

      <fieldset className={styles.said}>
        <legend className={remind.label}>What did the ward say?</legend>
        <div className={styles.card}>
          {(Object.keys(OUTCOME_WORDS) as CallOutcome[]).map((id) => (
            <Radio
              key={id}
              name="call-log-outcome"
              className={styles.option}
              checked={outcome === id}
              onChange={() => setOutcome(id)}
              disabledReason={id === "later" && steps.length === 0 ? "Too late in the day" : undefined}
              label={
                <span className={styles.optionText}>
                  <strong>{OUTCOME_WORDS[id]}</strong>
                  <span>{detail[id]}</span>
                </span>
              }
            />
          ))}
        </div>
      </fieldset>

      {outcome === "later" ? (
        <div className={remind.step}>
          <span className={remind.label}>About when</span>
          <Segmented
            items={steps.map((id) => ({ id, label: formatInstantWithDay(laterAt(id, now), now) }))}
            value={chosenStep ?? step}
            onChange={setStep}
            label="About when"
            size="md"
          />
        </div>
      ) : null}

      {offersRingBack ? (
        <Switch
          block
          checked={ringBack}
          onCheckedChange={setRingBack}
          label={
            <>
              Remind me to ring back at <span className={remind.mono}>{formatInstantWithDay(ringAt, now)}</span>
            </>
          }
        />
      ) : null}

      <div className={remind.actions}>
        <Button variant="pri" icon={PhoneCall} disabledReason={missing} onClick={save}>
          Save call
        </Button>
      </div>
      {saved ? (
        <p className={styles.saved} role="status">
          {saved}
        </p>
      ) : null}

      <section className={remind.yours} aria-labelledby="call-log-yours">
        <h4 className={remind.label} id="call-log-yours">
          Your calls
        </h4>
        {log.length === 0 ? (
          <p className={remind.quiet}>None logged.</p>
        ) : (
          <ul className={remind.list}>
            {log.map((entry) => (
              <li key={entry.id} className={remind.reminder}>
                <span className={`${remind.time} ${remind.mono}`}>{formatInstantWithDay(entry.at, now)}</span>
                <span className={remind.what}>
                  <span>{entry.wardLabel}</span>
                  <span className={remind.meta}>
                    {OUTCOME_WORDS[entry.outcome]}
                    {entry.bedAt !== undefined ? `, about ${formatInstantWithDay(entry.bedAt, now)}` : ""}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => removeCallLog(entry.id)}
                  aria-label={`Remove call to ${entry.wardLabel} at ${formatInstantWithDay(entry.at, now)}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className={remind.note}>
          Saved in this browser for your own follow-up. It does not change the ward&apos;s bed figures; only the ward
          confirms those.
        </p>
      </section>
    </div>
  );
}
