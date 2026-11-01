"use client";

import { useMemo, useState } from "react";

import { Button, Checkbox, Dialog, Field, Select, Stepper } from "@/components/wf";
import { BED_KIND_LABEL } from "@/components/ward-management/forecast/forecast-by-kind";
import {
  applyScenario,
  EMPTY_SCENARIO,
  scenarioIsEmpty,
  type ForecastScenario,
} from "@/components/ward-management/forecast/forecast-scenario";
import type { ForecastModel } from "@/components/ward-management/forecast/use-forecast-model";

import { gapWords } from "./capacity-range-line";
import styles from "./capacity-page.module.css";

type Toggle = "clearHeldUp" | "confirmDates" | "overdueGoAhead";

/**
 * "Try a scenario" as its own dialog instead of a box that pushes the forecast table down. The
 * answer sits at the top and changes as each box is ticked, so the reader never scrolls to see
 * what a choice did. Nothing is saved: closing the dialog forgets the scenario.
 */
export function ScenarioDialog({ open, onClose, model }: { open: boolean; onClose: () => void; model: ForecastModel }) {
  const { tomorrow, units } = model;
  const [scenario, setScenario] = useState<ForecastScenario>(EMPTY_SCENARIO);
  const [unitId, setUnitId] = useState("");
  const [delta, setDelta] = useState(-1);
  const openUnits = useMemo(
    () => units.filter((unit) => !unit.isClosed).sort((a, b) => a.name.localeCompare(b.name)),
    [units],
  );
  const result = applyScenario(tomorrow, scenario, units);
  const tightest = [...result.kinds].sort((a, b) => a.after - b.after)[0];
  const options: { key: Toggle; label: string; beds: number }[] = [
    { key: "clearHeldUp", label: "Held-up releases go ahead", beds: tomorrow.total.heldUp },
    { key: "confirmDates", label: "Planned dates are confirmed", beds: tomorrow.total.plannedNotFlagged },
    { key: "overdueGoAhead", label: "Overdue releases go ahead", beds: tomorrow.total.overdue },
  ];
  const close = () => {
    setScenario(EMPTY_SCENARIO);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Try a scenario"
      description="Nothing here is saved."
      size="md"
      primary={{ label: "Done", onAction: close }}
      secondary={[
        {
          label: "Clear",
          onAction: () => setScenario(EMPTY_SCENARIO),
          disabledReason: scenarioIsEmpty(scenario) ? "Nothing is ticked yet." : undefined,
        },
      ]}
      data-testid="ward-capacity-scenario-dialog"
    >
      <div className={styles.scenarioAnswer} aria-live="polite">
        <span className={styles.kickerInline}>Tomorrow</span>
        <span className={`${styles.scenarioFigure} ${result.after < 0 ? styles.warnInk : styles.okInk}`}>
          {gapWords(result.after)}
        </span>
        <span className={styles.mutedXs}>
          {scenarioIsEmpty(scenario)
            ? "Likely, from what is on record now."
            : `Instead of ${gapWords(result.before)}.${tightest ? ` ${BED_KIND_LABEL[tightest.id]} beds stay the tightest, ${gapWords(tightest.after)}.` : ""}`}
        </span>
      </div>
      <fieldset className={styles.scenarioSet}>
        <legend className={styles.kickerInline}>What might happen before tomorrow</legend>
        {options.map((option) => (
          <Checkbox
            key={option.key}
            label={`${option.label} (+${option.beds})`}
            checked={scenario[option.key]}
            disabled={option.beds === 0}
            onChange={() => setScenario((current) => ({ ...current, [option.key]: !current[option.key] }))}
          />
        ))}
        {scenario.bedChanges.map((change, index) => {
          const unit = units.find((candidate) => candidate.id === change.unitId);
          const beds = Math.abs(change.delta) === 1 ? "bed" : "beds";
          return (
            <Checkbox
              key={`${change.unitId}-${index}`}
              label={`${unit?.name ?? "Ward"} ${change.delta < 0 ? `closes ${-change.delta}` : `opens ${change.delta}`} ${beds}`}
              checked
              onChange={() =>
                setScenario((current) => ({
                  ...current,
                  bedChanges: current.bedChanges.filter((_, position) => position !== index),
                }))
              }
            />
          );
        })}
      </fieldset>
      <fieldset className={styles.scenarioSet}>
        <legend className={styles.kickerInline}>A ward opens or closes beds</legend>
        <div className={styles.scenarioRow}>
          <Field label="Ward">
            <Select value={unitId} onChange={(event) => setUnitId(event.target.value)}>
              <option value="">Choose a ward</option>
              {openUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Beds">
            <Stepper
              value={delta}
              onChange={setDelta}
              min={-10}
              max={10}
              noun="beds"
              valueText={delta < 0 ? `closes ${-delta} beds` : `opens ${delta} beds`}
              display={delta > 0 ? `+${delta}` : String(delta)}
            />
          </Field>
          <Button
            size="sm"
            variant="sec"
            disabledReason={unitId === "" ? "Choose a ward first." : delta === 0 ? "Choose how many beds." : undefined}
            onClick={() => {
              setScenario((current) => ({ ...current, bedChanges: [...current.bedChanges, { unitId, delta }] }));
              setUnitId("");
            }}
          >
            Add
          </Button>
        </div>
      </fieldset>
    </Dialog>
  );
}
