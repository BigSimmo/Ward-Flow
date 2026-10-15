"use client";

import { type ChangeEvent, useRef, useState } from "react";

import { formatInstant } from "../ward-clock";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import { WARD_SCENARIOS, scenarioLabels } from "../ward-scenarios";
import styles from "./ward-tools-sheet.module.css";

/**
 * Tools, Demo (Tools review item 9, 15 Oct 2026): the one place the prototype's scenario, clock and
 * scenario file are changed. It replaces the Shift desk "Scenario controls" menu and the footer clock
 * popover, which repeated the same controls, and is where the Demo reset cards land. Every event is
 * raised with `role: "demo"` exactly as before, and every string says demo, never clinical.
 */
export function WardDemoPanel() {
  const { scenario, dispatch, saveScenarioFile, loadScenarioFile, savingOnDevice } = useWardFlow();
  const now = useWardFlowClock();
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function saveToFile() {
    if (!saveScenarioFile) return;
    const built = saveScenarioFile();
    if (!built.ok) {
      setMessage(built.reason);
      return;
    }
    const url = URL.createObjectURL(new Blob([built.json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = built.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
      <div className={styles.scenarioGrid} role="radiogroup" aria-label="Demo scenario">
        {WARD_SCENARIOS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="radio"
            aria-checked={scenario === candidate}
            className={styles.scenarioCard}
            onClick={() => {
              dispatch({ type: "SET_SCENARIO", role: "demo", now, scenario: candidate });
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
          onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 15 })}
        >
          +15 min
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 60 })}
        >
          +1 hour
        </button>
      </div>
      {saveScenarioFile && loadScenarioFile ? (
        <div className={styles.demoRow} role="group" aria-label="Demo scenario file">
          <button type="button" className={styles.secondaryButton} onClick={saveToFile}>
            Save to file
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => fileInputRef.current?.click()}>
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
        onClick={() => {
          dispatch({ type: "RESET_SCENARIO", role: "demo", now });
          setMessage("Demo reset to the start of the scenario.");
        }}
      >
        Reset demo
      </button>
      <p className={styles.note}>Scenario files hold synthetic demo data only. Never type real patient details.</p>
      <p className={styles.liveNote} role="status">
        {message}
      </p>
    </div>
  );
}
