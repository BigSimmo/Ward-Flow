"use client";

import { downloadBlob } from "@/components/ward-management/ward-download";

import { type ChangeEvent, useId, useRef, useState } from "react";

import { WardDemoReset } from "../demo-reset/ward-demo-reset";
import { formatInstant } from "../ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { DEMO_CONTROLS_OFF, useDemoControlsAvailable, useWardRaise } from "../ward-flow-raise";
import { DEMO_RESET_SCENARIOS, WARD_SCENARIOS, scenarioLabels } from "../ward-scenarios";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import styles from "./ward-tools-sheet.module.css";

/**
 * Tools, Demo (Tools review item 9, 15 Oct 2026): the one place the prototype's scenario, clock and
 * scenario file are changed. It replaces the Shift desk "Scenario controls" menu and the footer clock
 * popover, which repeated the same controls, and holds the one tap Demo reset (`demo-reset` flag). Every event is
 * raised with `role: "demo"` exactly as before, and every string says demo, never clinical.
 */
export function WardDemoPanel() {
  const { scenario, saveScenarioFile, loadScenarioFile, savingOnDevice } = useWardFlowSelect(
    "scenario",
    "saveScenarioFile",
    "loadScenarioFile",
    "savingOnDevice",
  );
  const now = useWardFlowClock();
  const raise = useWardRaise("demo");
  const demoOn = useDemoControlsAvailable();
  const offId = useId();
  const lock = demoOn ? {} : { disabled: true, "aria-describedby": offId };
  const [message, setMessage] = useState<string | null>(null);
  // With the one tap Demo reset on, its three scenarios load from there, after a confirm, so the
  // picker above does not offer them a second time.
  const resetOn = useWardFeatureFlag("demo-reset");
  const resetScenarios: readonly string[] = DEMO_RESET_SCENARIOS;
  const pickable = resetOn ? WARD_SCENARIOS.filter((candidate) => !resetScenarios.includes(candidate)) : WARD_SCENARIOS;
  const fileInputRef = useRef<HTMLInputElement>(null);

  function saveToFile() {
    if (!saveScenarioFile) return;
    const built = saveScenarioFile();
    if (!built.ok) {
      setMessage(built.reason);
      return;
    }
    downloadBlob(new Blob([built.json], { type: "application/json" }), built.fileName);
    setMessage(`Saved ${built.fileName} to your downloads.`);
  }

  async function loadFromFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !loadScenarioFile) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMessage("That file could not be read, so nothing was loaded.");
      return;
    }
    const result = loadScenarioFile(text);
    setMessage(
      result.ok
        ? "Scenario loaded. It is kept in this tab only, so load the file again after a refresh."
        : result.reason,
    );
  }

  return (
    <div className={styles.toolBody} data-testid="ward-tools-demo-panel">
      <p className={styles.demoNotice}>Demo tools. They change the synthetic data only, never a clinical record.</p>
      {demoOn ? null : (
        <p id={offId} className={styles.note} data-testid="ward-tools-demo-off">
          {DEMO_CONTROLS_OFF}
        </p>
      )}
      <div className={styles.scenarioGrid} role="radiogroup" aria-label="Demo scenario">
        {pickable.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="radio"
            aria-checked={scenario === candidate}
            className={styles.scenarioCard}
            {...lock}
            onClick={() => {
              raise("SET_SCENARIO", { scenario: candidate });
              setMessage(`${scenarioLabels[candidate]} loaded.`);
            }}
          >
            <strong>{scenarioLabels[candidate]}</strong>
            {scenario === candidate ? <em>Loaded</em> : null}
          </button>
        ))}
      </div>
      <div className={styles.demoRow}>
        <span className={styles.demoClock}>
          Demo clock <b>{formatInstant(now)}</b>
        </span>
        <button
          type="button"
          className={styles.secondaryButton}
          {...lock}
          onClick={() => raise("ADVANCE_CLOCK", { minutes: 15 })}
        >
          +15 min
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          {...lock}
          onClick={() => raise("ADVANCE_CLOCK", { minutes: 60 })}
        >
          +1 hour
        </button>
      </div>
      {saveScenarioFile && loadScenarioFile ? (
        <div className={styles.demoRow} role="group" aria-label="Demo scenario file">
          <button type="button" className={styles.secondaryButton} onClick={saveToFile}>
            Save to file
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            {...lock}
            onClick={() => fileInputRef.current?.click()}
          >
            Load from file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void loadFromFile(event)}
          />
          {savingOnDevice === false ? (
            <span className={styles.note}>Device save paused (D-18 free-text lock)</span>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className={styles.resetButton}
        {...lock}
        onClick={() => {
          raise("RESET_SCENARIO");
          setMessage("Demo reset to the start of the scenario.");
        }}
      >
        Reset demo
      </button>
      <WardDemoReset className={styles.resetBlock} headingClassName={styles.resetHeading} offNoteId={offId} />
      <p className={styles.note}>Scenario files hold synthetic demo data only. Never type real patient details.</p>
      <p className={styles.liveNote} role="status">
        {message}
      </p>
    </div>
  );
}
