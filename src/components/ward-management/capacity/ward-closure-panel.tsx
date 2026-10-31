"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button, Dialog, DisabledReason, Field, Select, StatusGlyph } from "@/components/wf";

import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import type { WardRecordActor } from "../ward-discharge-records";
import { useDirtyStateGuard } from "../use-dirty-state-guard";
import { useHoldOpenForm } from "../use-hold-open-form";
import { useWardSharedSave } from "../shell/ward-shared-save-context";
import { saveProblem } from "../ward-save-failure";
import { refusalReasonText } from "../ward-refusal-words";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { useUndoableStep } from "../use-undoable-step";
import type { Unit } from "../ward-model";
import { sessionDraftKey } from "../ward-session-drafts";
import {
  WARD_CLOSURE_REASON_IDS,
  WARD_CLOSURE_REASONS,
  WARD_REOPEN_AFTER_HOURS,
  wardClosureReasonLabel,
  wardReopeningDue,
  type WardClosureReason,
} from "./ward-closure";
import styles from "./ward-closure-panel.module.css";
// Closing the loop, package D (24 Oct 2026): restriction reviews and the closure transition list.
import { ClosureTransitionChecklist, WardRestrictionReviews } from "../loop-checks/loop-checks-lazy";

/**
 * P010 DRAFT WORDING, not yet approved by Josh (his approved text was not supplied): what a coordinator reads
 * when their close of a ward did not go through because it was already closed. Kept in one place so the
 * approved text replaces it here and nowhere else.
 */
const CLOSE_CONFLICT_DRAFT_WORDING = {
  /** The close was refused and the board has not yet shown why. `why` is the engine's reason in plain words. */
  refused: (why: string) => `Not recorded. ${why}. Nothing was changed.`,
  /** The board shows the ward closed with another reason than the one this person chose. */
  closedFirst: (ward: string, recorded: string, by: string, chosen: string) =>
    `Not recorded. ${ward} was closed first: ${recorded}, by ${by}. You chose ${chosen}. Nothing was changed.`,
  tryAgain: "Try again",
} as const;

/**
 * Smart features idea 7 (19 Oct 2026), the screen half: close a whole ward to admissions with a
 * listed reason, see what still points at it, and reopen it. Reopening is always a person's tap;
 * the expected time only prompts. Behind the `ward-closure-mode` switch.
 */
export function WardClosurePanel({ unit, now, actor }: { unit: Unit; now: Instant; actor: WardRecordActor }) {
  const enabled = useWardFeatureFlag("ward-closure-mode");
  if (!enabled) return null;
  return (
    <>
      <WardClosureControls unit={unit} now={now} actor={actor} />
      <WardRestrictionReviews unit={unit} now={now} actor={actor} />
    </>
  );
}

function WardClosureControls({ unit, now, actor }: { unit: Unit; now: Instant; actor: WardRecordActor }) {
  const [reason, setReason] = useState<WardClosureReason | "">("");
  const [reopenAfter, setReopenAfter] = useState("");
  // DR-07 (design re-score, 24 Oct 2026): closing a ward asks once before it is recorded.
  const [confirming, setConfirming] = useState(false);
  // B2a P021 (27 Oct 2026): reopening asks once too.
  const [confirmingReopen, setConfirmingReopen] = useState(false);
  const reasonId = useId();
  // P010: a refused close, or a board that shows someone else closed this ward first, is said in an alert.
  const [refusedWords, setRefusedWords] = useState<string | null>(null);
  const [overtakenBy, setOvertakenBy] = useState<WardClosureReason | null>(null);
  const shared = useWardSharedSave();
  // Try again only reads the board again (a refused close leaves nothing waiting to send); it never sends the
  // close a second time. The chosen reason stays, so the coordinator redoes the close from what the board shows.
  const tryAgain = () => {
    if (shared?.unconfirmedSave) return;
    setRefusedWords(null);
    setOvertakenBy(null);
    shared?.retry();
  };
  const mayAct = actor.role === "coordinator" || (actor.role === "ward" && actor.actingUnitId === unit.id);
  const refusal = mayAct ? undefined : "Only this ward or the coordinator can close or reopen it.";
  const actingUnitId = actor.role === "ward" ? actor.actingUnitId : undefined;
  const role = actor.role === "ward" ? "ward" : "coordinator";
  // NB-01: the outcome is said on the toast, recorded or refused, not left to the panel changing.
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  // The live clock stamps the step; `now` may be a paused page clock, kept for display only.
  const at = useWardFlowClock();
  const { run } = useUndoableStep({ dispatch, rejections, now: at, routeRole: role });
  // B2a P086: the chosen (never typed) reason and time are kept in the session draft store.
  const world = useWardFlowSelect("scenario", "worldGeneration");
  const [storageKey] = useState(() =>
    sessionDraftKey(`${world.scenario}/${world.worldGeneration}`, "ward-closure", unit.id),
  );
  const { clearDraft } = useDirtyStateGuard({
    storageKey,
    isDirty: !unit.isClosed && (reason !== "" || reopenAfter !== ""),
    value: JSON.stringify({ reason, reopenAfter }),
    onRestore: (raw) => {
      try {
        const restored: unknown = JSON.parse(raw);
        if (!restored || typeof restored !== "object" || !("reason" in restored) || !("reopenAfter" in restored))
          return false;
        const { reason: r, reopenAfter: h } = restored;
        if (typeof r !== "string" || (r !== "" && !WARD_CLOSURE_REASON_IDS.includes(r))) return false;
        if (typeof h !== "string" || (h !== "" && !WARD_REOPEN_AFTER_HOURS.some((hours) => String(hours) === h)))
          return false;
        setReason(r as WardClosureReason | "");
        setReopenAfter(h);
        return true;
      } catch {
        return false;
      }
    },
  });
  // Audit CS3-01: a started close is checked against the board it opened on.
  useHoldOpenForm(!unit.isClosed && (reason !== "" || reopenAfter !== ""));
  // B2a P001: the inputs clear only once the ward is seen closed, so a refused close keeps them.
  const [seenClosed, setSeenClosed] = useState(unit.isClosed);
  if (seenClosed !== unit.isClosed) {
    setSeenClosed(unit.isClosed);
    if (unit.isClosed) {
      // P010: a different reason was chosen here; keep it, and say what is recorded instead.
      const recorded = unit.admissionsClosure?.reason;
      if (reason !== "" && recorded !== undefined && recorded !== reason) setOvertakenBy(reason);
      else setReason("");
      setReopenAfter("");
      setRefusedWords(null);
    } else {
      setOvertakenBy(null);
    }
  }
  // The saved draft goes once the choices are empty, whether the close was recorded or both selects were put
  // back. Clearing after the empty value is rendered makes the draft guard remember the empty value, so the
  // same choices made again after a reopen are saved as a new draft.
  const hasChoices = reason !== "" || reopenAfter !== "";
  const hadChoices = useRef(false);
  useEffect(() => {
    if (hasChoices) {
      hadChoices.current = true;
    } else if (hadChoices.current) {
      hadChoices.current = false;
      clearDraft();
    }
  }, [hasChoices, clearDraft]);

  if (!unit.isClosed) {
    const closeRefusal = refusal ?? (reason === "" ? "Choose a reason first." : undefined);
    return (
      <section
        className={styles.panel}
        aria-label={`Close ${unit.name} to admissions`}
        data-testid="ward-closure-panel"
      >
        {/* Audit 1 (WP-10, Josh 20 Oct): the panel names its ward, so a close is never for the wrong one. */}
        <h3 className={styles.heading}>Close {unit.name} to admissions</h3>
        <Field label="Reason">
          <Select
            value={reason}
            onChange={(event) => setReason(event.target.value as WardClosureReason | "")}
            data-testid="ward-closure-reason"
          >
            <option value="">Choose a reason</option>
            {WARD_CLOSURE_REASONS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Expected to reopen">
          <Select
            value={reopenAfter}
            onChange={(event) => setReopenAfter(event.target.value)}
            data-testid="ward-closure-reopen-after"
          >
            <option value="">Not known</option>
            {WARD_REOPEN_AFTER_HOURS.map((hours) => (
              <option key={hours} value={String(hours)}>
                In {hours} hours
              </option>
            ))}
          </Select>
        </Field>
        <p className={styles.note}>
          The ward stops being offered for new patients. Beds already pulled here, and patients already accepted here,
          stay until someone moves them.
        </p>
        <Button
          size="sm"
          variant="sec"
          aria-disabled={closeRefusal !== undefined ? "true" : undefined}
          aria-describedby={closeRefusal ? `${reasonId}-close` : undefined}
          onClick={() => {
            if (closeRefusal || reason === "") return;
            setConfirming(true);
          }}
          data-testid="ward-closure-close"
        >
          Close {unit.name} to admissions
        </Button>
        {/* Beneath the button, not beside it: the ward panel is too narrow for both on one line. */}
        {closeRefusal ? <DisabledReason id={`${reasonId}-close`}>{closeRefusal}</DisabledReason> : null}
        {refusedWords !== null ? (
          <ClosureAlert
            words={CLOSE_CONFLICT_DRAFT_WORDING.refused(refusedWords)}
            onTryAgain={tryAgain}
            pendingSave={shared?.unconfirmedSave}
          />
        ) : null}
        <Dialog
          open={confirming}
          onClose={() => setConfirming(false)}
          size="sm"
          title={`Close ${unit.name} to admissions?`}
          description={`Reason: ${reason === "" ? "none chosen" : wardClosureReasonLabel(reason)}. ${unit.name} stops being offered for new patients until a person reopens it. Beds already pulled here, and patients already accepted here, stay where they are.`}
          secondary={[{ label: "Cancel", onAction: () => setConfirming(false) }]}
          primary={{
            label: `Close ${unit.name}`,
            onAction: () => {
              setConfirming(false);
              if (closeRefusal || reason === "") return;
              run(
                {
                  type: "CLOSE_WARD_TO_ADMISSIONS",
                  role,
                  now: at,
                  unitId: unit.id,
                  ...(actingUnitId !== undefined ? { actingUnitId } : {}),
                  reason,
                  ...(reopenAfter !== "" ? { until: at + Number(reopenAfter) * 60 } : {}),
                },
                {
                  success: `${unit.name} closed to admissions: ${wardClosureReasonLabel(reason)}.`,
                  refusalShownInline: true,
                  onRefused: (why) => setRefusedWords(refusalReasonText(why).replace(/\.$/, "")),
                },
              );
            },
          }}
          data-testid="ward-closure-confirm"
        />
      </section>
    );
  }

  const closure = unit.admissionsClosure;
  const due = wardReopeningDue(unit, now);
  return (
    <section className={styles.panel} aria-label={`${unit.name} closed to admissions`} data-testid="ward-closure-panel">
      <h3 className={styles.heading}>
        <StatusGlyph tone="closed" size={8} /> {unit.name} closed to admissions
      </h3>
      {overtakenBy !== null && closure ? (
        <ClosureAlert
          words={CLOSE_CONFLICT_DRAFT_WORDING.closedFirst(
            unit.name,
            wardClosureReasonLabel(closure.reason),
            closure.by,
            wardClosureReasonLabel(overtakenBy),
          )}
          onTryAgain={tryAgain}
          pendingSave={shared?.unconfirmedSave}
        />
      ) : null}
      {closure ? (
        <p className={styles.line}>
          {wardClosureReasonLabel(closure.reason)} · since {formatInstantWithDay(closure.at, now)} · by {closure.by}
        </p>
      ) : null}
      {closure?.until !== undefined ? (
        <p className={due ? styles.due : styles.line} role={due ? "status" : undefined}>
          {due
            ? `Was expected to reopen ${formatInstantWithDay(closure.until, now)}. Reopen it when the ward is ready.`
            : `Expected to reopen ${formatInstantWithDay(closure.until, now)}.`}
        </p>
      ) : null}
      {/* Closing the loop D4: each item links to its record and is marked dealt with by a person. */}
      <ClosureTransitionChecklist unit={unit} now={now} actor={actor} />
      <Button
        size="sm"
        variant="sec"
        aria-disabled={refusal !== undefined ? "true" : undefined}
        aria-describedby={refusal ? `${reasonId}-reopen` : undefined}
        onClick={() => {
          if (refusal) return;
          setConfirmingReopen(true);
        }}
        data-testid="ward-closure-reopen"
      >
        Reopen {unit.name} to admissions
      </Button>
      {refusal ? <DisabledReason id={`${reasonId}-reopen`}>{refusal}</DisabledReason> : null}
      <Dialog
        open={confirmingReopen}
        onClose={() => setConfirmingReopen(false)}
        size="sm"
        title={`Reopen ${unit.name} to admissions?`}
        description={`${unit.name} is offered for new patients again straight away.`}
        secondary={[{ label: "Cancel", onAction: () => setConfirmingReopen(false) }]}
        primary={{
          label: `Reopen ${unit.name}`,
          onAction: () => {
            setConfirmingReopen(false);
            if (refusal) return;
            run(
              {
                type: "REOPEN_WARD_TO_ADMISSIONS",
                role,
                now: at,
                unitId: unit.id,
                ...(actingUnitId !== undefined ? { actingUnitId } : {}),
              },
              { success: `${unit.name} reopened to admissions.` },
            );
          },
        }}
        data-testid="ward-closure-reopen-confirm"
      />
    </section>
  );
}

function ClosureAlert({
  words,
  onTryAgain,
  pendingSave,
}: {
  words: string;
  onTryAgain: () => void;
  pendingSave?: boolean;
}) {
  return (
    <div className={styles.alert} role="alert" data-testid="ward-closure-alert">
      <p className={styles.alertText}>{words}</p>
      <Button
        size="sm"
        variant="sec"
        onClick={onTryAgain}
        disabledReason={pendingSave ? saveProblem("connectionLost") : undefined}
      >
        {CLOSE_CONFLICT_DRAFT_WORDING.tryAgain}
      </Button>
    </div>
  );
}
