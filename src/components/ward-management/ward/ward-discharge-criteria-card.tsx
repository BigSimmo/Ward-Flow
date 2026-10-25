"use client";

import { useRef, useState } from "react";
import { Badge, Button, Checkbox, Field, TextInput } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  criteriaEligibilityRefusal,
  DISCHARGE_CRITERIA,
  dischargeCriteriaStatus,
  isDischargeCriterion,
  isPatientSpecificItem,
  PATIENT_SPECIFIC_CRITERIA_MAX,
  PATIENT_SPECIFIC_CRITERION_MAX_LENGTH,
  type CriteriaEligibility,
  type DischargeCriteriaRecord,
  type DischargeCriterion,
} from "@/components/ward-management/ward-discharge-criteria";
import type { WardCommandDispatch, WardCommandOutcome } from "../ward-shared-client";
import drawerStyles from "./ward-bed-dossier-drawer.module.css";
import styles from "./ward-discharge-criteria-card.module.css";

export type DischargeCriteriaUpdate = {
  criteria: string[] | null;
  met: string[];
  setByTreatingPsychiatrist: boolean;
  /** D-65: typed patient specific criteria, sent only when the treating psychiatrist sets the list. */
  patientSpecific?: string[];
  tick?: { criterion: string; met: boolean };
};

/** The one-line reason the bed panel shows when criteria cannot be set for this patient. */
const INELIGIBLE_SHORT: Record<CriteriaEligibility, string> = {
  voluntary: "",
  not_recorded: "Not available until legal status is recorded as voluntary.",
  involuntary: "Not available. Voluntary patients only.",
  cto: "Not available on a community treatment order.",
};

/**
 * Criteria led discharge on the bed panel's Plan to leave tab (Top 25 item 9, D-60, flag
 * `top25-criteria-led-discharge`). The ward records the criteria the treating psychiatrist set,
 * ticks them as they are met, and sees when the discharge can go ahead without another review.
 * Only a patient recorded as voluntary can have criteria. `onChange` is absent when the desk cannot
 * record criteria.
 */
export function WardDischargeCriteriaCard({
  record,
  eligibility,
  now,
  onChange,
}: {
  record: DischargeCriteriaRecord | null | undefined;
  eligibility: CriteriaEligibility;
  now: Instant;
  onChange?: (update: DischargeCriteriaUpdate) => ReturnType<WardCommandDispatch>;
}) {
  const [editing, setEditing] = useState(false);
  const draftRevision = useRef(0);
  // Counts editor openings and cancels only, so a failure from an earlier session never reaches a reopened editor.
  const editorSession = useRef(0);
  const editorOpen = useRef(false);
  // A save that fails after its editor was cancelled is reported on the card, outside any editor.
  const [closedSaveMessage, setClosedSaveMessage] = useState<string | null>(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [chosen, setChosen] = useState<DischargeCriterion[]>([]);
  // D-65: typed patient specific criteria (WACHS form MR28 Part B), up to the set number.
  const [typed, setTyped] = useState<string[]>([]);
  const [attested, setAttested] = useState(false);
  // WACHS CLD guideline s 2.2: a patient chosen for criteria led discharge must be told. Confirmed
  // here before saving, and not recorded, so the event carries nothing new.
  const [patientTold, setPatientTold] = useState(false);
  const status = dischargeCriteriaStatus(record, eligibility, now);
  // Paused criteria can also be past their validity. Ticks then read as lapsed, not as met now.
  const pastValidity = status.kind === "paused" && dischargeCriteriaStatus(record, "voluntary", now).kind === "lapsed";
  const ineligible = criteriaEligibilityRefusal(eligibility);
  const items = record?.items ?? [];
  const metList = items.filter((item) => item.metAt !== null).map((item) => item.criterion);

  const openEditor = () => {
    draftRevision.current += 1;
    editorSession.current += 1;
    editorOpen.current = true;
    setSaveMessage(null);
    setClosedSaveMessage(null);
    setChosen(items.map((item) => item.criterion).filter(isDischargeCriterion));
    setTyped(items.filter(isPatientSpecificItem).map((item) => item.criterion));
    setAttested(false);
    setPatientTold(false);
    setEditing(true);
  };

  const summary = (() => {
    switch (status.kind) {
      case "none":
        return ineligible ?? "No criteria set by the treating psychiatrist.";
      case "paused":
        return `Paused. ${ineligible ?? ""}`;
      case "lapsed":
        return "These criteria have lapsed. Ask the treating psychiatrist to review them before discharge.";
      case "in_progress":
        return `${status.met} of ${status.total} met. Review needed after ${formatInstantWithDay(status.lapsesAt, now)}.`;
      case "all_met":
        return "All criteria met. The ward can confirm the discharge without waiting for the next review.";
    }
  })();

  const canTick = onChange !== undefined && (status.kind === "in_progress" || status.kind === "all_met");
  const typedToSave = typed.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  const nothingChosen = chosen.length === 0 && typedToSave.length === 0;
  // The reducer refuses a typed criterion that repeats another or names a fixed one, so Save waits.
  const typedRepeats = typedToSave.some(
    (entry, index) => isDischargeCriterion(entry) || typedToSave.indexOf(entry) !== index,
  );
  const cannotSave = nothingChosen || typedRepeats || !attested || !patientTold;
  // Rows keep their place when one is cleared, so a focused field never shifts to another criterion.
  const typedRows = typed.length < PATIENT_SPECIFIC_CRITERIA_MAX && !typed.includes("") ? [...typed, ""] : typed;
  const setTypedAt = (index: number, value: string) => {
    draftRevision.current += 1;
    setTyped((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };
  const toggleMet = (criterion: string, met: boolean) => {
    onChange?.({
      criteria: items.map((item) => item.criterion),
      met: met ? [...metList, criterion] : metList.filter((entry) => entry !== criterion),
      setByTreatingPsychiatrist: false,
      tick: { criterion, met },
    });
  };

  // Nothing to set or tick: one line saying why, not a whole card. The rule itself is unchanged.
  // An editor or save message still open when legal status changes keeps the full card.
  if (status.kind === "none" && ineligible !== null && !editing && !closedSaveMessage) {
    return (
      <p className={styles.compact} data-testid="ward-drawer-discharge-criteria">
        <span className={styles.compactLabel}>Criteria led discharge:</span>
        <span data-testid="ward-drawer-criteria-status">{INELIGIBLE_SHORT[eligibility]}</span>
      </p>
    );
  }

  return (
    <section className={drawerStyles.card} data-testid="ward-drawer-discharge-criteria">
      <h3 className={drawerStyles.cardTitle}>Criteria led discharge</h3>
      <div className={styles.body}>
        <p className={styles.summary} data-testid="ward-drawer-criteria-status">
          {status.kind === "all_met" ? (
            <Badge tone="success" size="sm">
              Ready
            </Badge>
          ) : status.kind === "lapsed" || status.kind === "paused" ? (
            <Badge tone="warning" size="sm">
              {status.kind === "lapsed" ? "Review" : "Paused"}
            </Badge>
          ) : null}
          <span>{summary}</span>
        </p>
        {eligibility === "voluntary" ? <p className={styles.note}>Legal status recorded as voluntary.</p> : null}
        {status.kind === "in_progress" && !editing ? (
          <p className={styles.note} data-testid="ward-drawer-criteria-escalate">
            If a criterion cannot be met or there is a new concern, ask for a medical review.
          </p>
        ) : null}

        {!editing && items.length > 0 ? (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.criterion} className={styles.item}>
                {canTick ? (
                  <Checkbox
                    label={item.criterion}
                    className={styles.touchTarget}
                    checked={item.metAt !== null}
                    onChange={(event) => toggleMet(item.criterion, event.target.checked)}
                  />
                ) : (
                  <span className={styles.readOnly}>
                    {item.criterion}{" "}
                    {status.kind === "lapsed" || status.kind === "paused" ? (
                      <Badge size="sm" tone="neutral">
                        {item.metAt !== null
                          ? status.kind === "lapsed" || pastValidity
                            ? "Met before it lapsed"
                            : "Met"
                          : "Not met"}
                      </Badge>
                    ) : (
                      <Badge size="sm" tone={item.metAt !== null ? "success" : "neutral"}>
                        {item.metAt !== null ? "Met" : "Not met"}
                      </Badge>
                    )}
                  </span>
                )}
                {isPatientSpecificItem(item) ? (
                  <span className={canTick ? `${styles.metAt} ${styles.metAtIndent}` : styles.metAt}>
                    Patient specific
                  </span>
                ) : null}
                {item.metAt !== null ? (
                  <span className={canTick ? `${styles.metAt} ${styles.metAtIndent}` : styles.metAt}>
                    Ticked {formatInstantWithDay(item.metAt, now)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {editing && onChange ? (
          <fieldset
            className={styles.editor}
            onChange={() => {
              draftRevision.current += 1;
            }}
          >
            <legend className={styles.legend}>Criteria the treating psychiatrist set</legend>
            {DISCHARGE_CRITERIA.map((criterion) => (
              <Checkbox
                key={criterion}
                label={criterion}
                className={styles.touchTarget}
                checked={chosen.includes(criterion)}
                onChange={(event) =>
                  setChosen((current) =>
                    event.target.checked
                      ? DISCHARGE_CRITERIA.filter((entry) => entry === criterion || current.includes(entry))
                      : current.filter((entry) => entry !== criterion),
                  )
                }
              />
            ))}
            {typedRows.map((value, index) => (
              <Field
                key={index}
                label={`Patient specific criterion ${index + 1}, optional`}
                hint={`Up to ${PATIENT_SPECIFIC_CRITERION_MAX_LENGTH} characters`}
              >
                <TextInput
                  value={value}
                  maxLength={PATIENT_SPECIFIC_CRITERION_MAX_LENGTH}
                  autoComplete="off"
                  onChange={(event) => setTypedAt(index, event.target.value)}
                  onClear={() => setTypedAt(index, "")}
                  data-testid={`ward-drawer-criteria-typed-${index + 1}`}
                />
              </Field>
            ))}
            <fieldset className={styles.confirm}>
              <legend className={styles.legend}>Before saving, confirm</legend>
              <Checkbox
                label="Set by the treating psychiatrist"
                className={styles.touchTarget}
                checked={attested}
                onChange={(event) => setAttested(event.target.checked)}
              />
              <Checkbox
                label="Patient told they are on criteria led discharge"
                className={styles.touchTarget}
                checked={patientTold}
                onChange={(event) => setPatientTold(event.target.checked)}
              />
            </fieldset>
            <div className={styles.actions}>
              <Button
                className={styles.touchTarget}
                variant="sec"
                disabled={cannotSave || saving}
                onClick={() => {
                  if (savingRef.current) return;
                  const revision = draftRevision.current;
                  const session = editorSession.current;
                  savingRef.current = true;
                  setSaving(true);
                  setSaveMessage(null);
                  const finish = (result: void | WardCommandOutcome) => {
                    savingRef.current = false;
                    setSaving(false);
                    if (result?.status === "accepted" && result.isCurrent?.() !== false) {
                      if (draftRevision.current !== revision) return;
                      draftRevision.current += 1;
                      editorOpen.current = false;
                      setEditing(false);
                    } else {
                      if (editorSession.current !== session) {
                        // Never inside a reopened editor: that draft is not the one that failed.
                        if (!editorOpen.current)
                          setClosedSaveMessage(
                            result?.message ??
                              "Criteria were not confirmed saved. Review the board before setting them again.",
                          );
                        return;
                      }
                      setSaveMessage(
                        result?.message ??
                          "Criteria save is not confirmed. Your draft is still here. Check the board, then save again if the criteria are not there.",
                      );
                    }
                  };
                  try {
                    const completion = onChange({
                      criteria: chosen,
                      met: [],
                      setByTreatingPsychiatrist: true,
                      ...(typedToSave.length > 0 ? { patientSpecific: typedToSave } : {}),
                    });
                    if (completion && "then" in completion) void completion.then(finish, () => finish());
                    else finish(completion);
                  } catch {
                    finish();
                  }
                }}
              >
                {saving ? "Saving criteria…" : "Save criteria"}
              </Button>
              <Button
                className={styles.touchTarget}
                variant="ghost"
                onClick={() => {
                  draftRevision.current += 1;
                  editorSession.current += 1;
                  editorOpen.current = false;
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
            {saveMessage ? (
              <p className={styles.note} role="alert">
                {saveMessage}
              </p>
            ) : null}
            {typedRepeats ? (
              <p className={styles.note} data-testid="ward-drawer-criteria-typed-repeat">
                Each patient specific criterion must be different and not one of the listed criteria.
              </p>
            ) : null}
            {cannotSave ? (
              <p className={styles.note}>
                Choose or type at least one criterion, confirm the treating psychiatrist set them and that the patient
                was told.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {!editing && closedSaveMessage ? (
          <p className={styles.note} role="alert" data-testid="ward-drawer-criteria-save-notice">
            {closedSaveMessage}
          </p>
        ) : null}

        {!editing && onChange ? (
          <div className={styles.actions}>
            {ineligible === null ? (
              <Button className={styles.touchTarget} variant="sec" onClick={openEditor}>
                {items.length === 0 ? "Set criteria" : status.kind === "lapsed" ? "Review criteria" : "Change criteria"}
              </Button>
            ) : null}
            {items.length > 0 ? (
              <Button
                className={styles.touchTarget}
                variant="ghost"
                onClick={() => onChange({ criteria: null, met: [], setByTreatingPsychiatrist: false })}
              >
                Clear criteria
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
