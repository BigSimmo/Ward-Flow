"use client";

import { useId, useState } from "react";
import { Button, Segmented, type ChoiceItem } from "@/components/wf";
import { crewArrivalMode, type CrewArrivalMode } from "@/components/ward-management/ward-crew-handover";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Movement } from "@/components/ward-management/ward-model";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import edStyles from "./ed.module.css";
import styles from "./ed-crew-times.module.css";

const CHOICES: ChoiceItem<CrewArrivalMode>[] = [
  { id: "police", label: "Police" },
  { id: "ambulance", label: "Ambulance" },
];

/**
 * D-141 (Josh, 11 Nov 2026): "Brought by: Police / Ambulance" on an ED arrival, so a person recorded
 * in the department without a seeded mode can have their crew's times typed. Optional, and nothing
 * is chosen for the person: the choice starts empty until it is recorded. Choosing does not save;
 * the Save button records it (`RECORD_ARRIVAL_MODE`), so an arrow key never changes the record.
 */
export function EdBroughtBy({ movement, raise }: { movement: Movement; raise: WardRaise }) {
  const baseId = useId();
  const recorded = crewArrivalMode(movement);
  const [draft, setDraft] = useState<CrewArrivalMode>();
  const [status, setStatus] = useState<string>();
  const save = useWardFormSave(`ed-brought-by:${movement.id}`);
  const chosen = draft ?? recorded;
  const changed = draft !== undefined && draft !== recorded;
  const submit = () => {
    const arrivalMode = draft;
    if (arrivalMode === undefined || !changed || save.pending) return;
    setStatus(undefined);
    save.submit(
      () => raise("RECORD_ARRIVAL_MODE", { movementId: movement.id, arrivalMode }),
      () => {
        setDraft(undefined);
        setStatus("Brought by saved.");
      },
    );
  };
  return (
    <section className={edStyles.pxBlock} aria-labelledby={`${baseId}-title`} data-testid="ward-ed-brought-by">
      <h3 id={`${baseId}-title`}>Brought by</h3>
      <div className={styles.broughtByRow}>
        <Segmented
          label="Brought by"
          items={CHOICES}
          // No pre-selection: an unanswered record matches neither choice (D-141).
          value={(chosen ?? "") as CrewArrivalMode}
          onChange={(id) => {
            setStatus(undefined);
            save.clearError();
            setDraft(id);
          }}
          size="md"
          className={styles.broughtBy}
        />
        {changed ? (
          <Button
            type="button"
            variant="pri"
            aria-disabled={save.pending ? "true" : undefined}
            onClick={submit}
            data-testid="ward-ed-brought-by-save"
          >
            Save
          </Button>
        ) : null}
      </div>
      {recorded === undefined && !changed ? (
        <p className={styles.note}>Optional. Mark it to type the crew&apos;s handover times.</p>
      ) : null}
      {save.error ? (
        <p className={styles.error} role="alert">
          {save.error}
        </p>
      ) : status ? (
        <p className={styles.note} role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}
