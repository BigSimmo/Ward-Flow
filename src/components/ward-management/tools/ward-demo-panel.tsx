"use client";

import { downloadBlob } from "@/components/ward-management/ward-download";

import { type ChangeEvent, useId, useRef, useState } from "react";

import { Dialog } from "@/components/wf";

import { WardDemoReset } from "../demo-reset/ward-demo-reset";
import { formatInstant } from "../ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { DEMO_CONTROLS_OFF, useDemoControlsAvailable, useWardRaise } from "../ward-flow-raise";
import type { WardCommandOutcome } from "../ward-shared-client";
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
  const { scenario, saveScenarioFile, loadScenarioFile, savingOnDevice, worldGeneration } = useWardFlowSelect(
    "scenario",
    "saveScenarioFile",
    "loadScenarioFile",
    "savingOnDevice",
    "worldGeneration",
  );
  const now = useWardFlowClock();
  const raise = useWardRaise("demo");
  const demoOn = useDemoControlsAvailable();
  const offId = useId();
  const lock = demoOn ? {} : { disabled: true, "aria-describedby": offId };
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  // A pending "Reset the demo?" is dropped when demo controls go off, so it can never reopen by
  // itself when they come back (review finding on DA-10). Adjusted during render, not in an effect.
  if (!demoOn && confirmingReset) setConfirmingReset(false);
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

  /**
   * DA-10 (design audit, Josh, 19 Oct 2026): Reset demo asks first, and the line under it says the
   * demo was reset only when the reducer actually reloaded the network (a new world generation). A
   * refused or unchanged reset says nothing changed. A failed shared save may already have reached
   * the server, so it says the reset is not confirmed rather than promising nothing changed.
   */
  function resetDemo() {
    setConfirmingReset(false);
    const from = worldGeneration;
    const notConfirmed = "The reset was not confirmed. Refresh the page and check the board before trying again.";
    const settle = (outcome: WardCommandOutcome | void) => {
      if (!outcome) return;
      if (outcome.status === "failed") {
        setMessage(outcome.message ?? notConfirmed);
        return;
      }
      const reloaded =
        outcome.status === "accepted" && (outcome.generation === undefined || outcome.generation !== from);
      setMessage(reloaded ? "Demo reset to the start of the scenario." : "The demo was not reset. Nothing changed.");
    };
    setMessage(null);
    const outcome = raise("RESET_SCENARIO");
    if (outcome && "then" in outcome) {
      void outcome.then(settle, () => setMessage(notConfirmed));
    } else settle(outcome);
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
        data-testid="ward-tools-demo-reset"
        onClick={() => setConfirmingReset(true)}
      >
        Reset demo
      </button>
      <Dialog
        open={confirmingReset && demoOn}
        onClose={() => setConfirmingReset(false)}
        title="Reset the demo?"
        description={`This puts ${scenarioLabels[scenario]} back to its start and replaces the demo data for everyone in this workspace. There is no undo.`}
        size="sm"
        data-testid="ward-tools-demo-reset-confirm"
        primary={{ label: "Reset demo", tone: "danger", onAction: resetDemo }}
        secondary={[{ label: "Cancel", onAction: () => setConfirmingReset(false) }]}
      />
      <WardDemoReset className={styles.resetBlock} headingClassName={styles.resetHeading} offNoteId={offId} />
      <p className={styles.note}>Scenario files hold synthetic demo data only. Never type real patient details.</p>
      <p className={styles.liveNote} role="status">
        {message}
      </p>
    </div>
  );
}
