"use client";

import { downloadBlob } from "@/components/ward-management/ward-download";

import { type ChangeEvent, useId, useRef, useState } from "react";

import { Dialog } from "@/components/wf";

import { WardDemoReset, demoDataReach } from "../demo-reset/ward-demo-reset";
import { WardPracticeMode } from "../demo-reset/ward-practice-mode";
import { formatInstant } from "../ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { DEMO_CONTROLS_OFF, useDemoControlsAvailable, useWardRaise } from "../ward-flow-raise";
import type { WardCommandOutcome } from "../ward-shared-client";
import { DEMO_RESET_SCENARIOS, WARD_SCENARIOS, scenarioLabels, type WardScenario } from "../ward-scenarios";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import styles from "./ward-tools-sheet.module.css";

/**
 * Tools, Demo (Tools review item 9, 15 Oct 2026): the one place the prototype's scenario, clock and
 * scenario file are changed. It replaces the Shift desk "Scenario controls" menu and the footer clock
 * popover, which repeated the same controls, and holds the one tap Demo reset (`demo-reset` flag). Every event is
 * raised with `role: "demo"` exactly as before, and every string says demo, never clinical.
 *
 * `oneList` (change 8, D-77, 21 Oct 2026): the desktop Demo menu under the Synthetic pill shows all
 * seven scenarios as one list, so the separate Demo reset block and its three choices go there.
 * Phone Tools keeps both until a phone mock-up is approved.
 */
export function WardDemoPanel({ oneList = false }: { oneList?: boolean } = {}) {
  const { scenario, saveScenarioFile, loadScenarioFile, savingOnDevice, worldGeneration, shared } = useWardFlowSelect(
    "scenario",
    "saveScenarioFile",
    "loadScenarioFile",
    "savingOnDevice",
    "worldGeneration",
    "shared",
  );
  const now = useWardFlowClock();
  const raise = useWardRaise("demo");
  const demoOn = useDemoControlsAvailable();
  const offId = useId();
  const lock = demoOn ? {} : { disabled: true, "aria-describedby": offId };
  const [message, setMessage] = useState<string | null>(null);
  // The world change waiting on its confirm: Reset demo, or a scenario card (overall review, 20 Oct
  // 2026: a card replaced all the demo data in one tap, so it now asks first, the same as Reset).
  const [confirming, setConfirming] = useState<{ kind: "reset" } | { kind: "load"; scenario: WardScenario } | null>(
    null,
  );
  // A pending confirm is dropped when demo controls go off, so it can never reopen by itself when
  // they come back (review finding on DA-10). Adjusted during render, not in an effect.
  if (!demoOn && confirming) setConfirming(null);
  const reach = demoDataReach(shared?.enabled === true);
  // With the one tap Demo reset on, its three scenarios load from there, after a confirm, so the
  // picker above does not offer them a second time.
  const resetOn = useWardFeatureFlag("demo-reset") && !oneList;
  const resetScenarios: readonly string[] = DEMO_RESET_SCENARIOS;
  const pickable = resetOn ? WARD_SCENARIOS.filter((candidate) => !resetScenarios.includes(candidate)) : WARD_SCENARIOS;
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveToFile() {
    if (!saveScenarioFile) return;
    const built = await saveScenarioFile();
    if (!built.ok) {
      setMessage(built.reason);
      return;
    }
    downloadBlob(new Blob([built.json], { type: "application/json" }), built.fileName);
    setMessage(`Download requested: ${built.fileName}. Check your browser downloads.`);
  }

  /**
   * DA-10 (design audit, Josh, 19 Oct 2026): Reset demo and the scenario cards ask first, and the
   * line under them says the demo changed only when the reducer actually reloaded the network (a new
   * world generation). A refused or unchanged one says nothing changed. A failed shared save may
   * already have reached the server, so it says the change is not confirmed rather than promising
   * nothing changed. Each line names who it reached (`demoDataReach`).
   */
  function confirmWorldChange() {
    const pending = confirming;
    setConfirming(null);
    if (!pending) return;
    const from = worldGeneration;
    const label = scenarioLabels[pending.kind === "load" ? pending.scenario : scenario];
    const notConfirmed =
      pending.kind === "reset"
        ? "The reset was not confirmed. Refresh the page and check the board before trying again."
        : `Loading ${label} was not confirmed. Refresh the page and check the board before trying again.`;
    const settle = (outcome: WardCommandOutcome | void) => {
      if (!outcome) return;
      if (outcome.status === "failed") {
        setMessage(outcome.message ?? notConfirmed);
        return;
      }
      const reloaded =
        outcome.status === "accepted" && (outcome.generation === undefined || outcome.generation !== from);
      if (!reloaded) {
        setMessage(
          pending.kind === "reset"
            ? "The demo was not reset. Nothing changed."
            : `${label} was not loaded. Nothing changed.`,
        );
        return;
      }
      setMessage(pending.kind === "reset" ? `${label} reset to its start ${reach}.` : `${label} loaded ${reach}.`);
    };
    setMessage(null);
    const outcome =
      pending.kind === "reset" ? raise("RESET_SCENARIO") : raise("SET_SCENARIO", { scenario: pending.scenario });
    if (outcome && "then" in outcome) {
      void outcome.then(settle, () => setMessage(notConfirmed));
    } else settle(outcome);
  }

  const confirmLabel = confirming?.kind === "load" ? scenarioLabels[confirming.scenario] : scenarioLabels[scenario];

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
    const result = await loadScenarioFile(text);
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
            onClick={() => setConfirming({ kind: "load", scenario: candidate })}
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
        onClick={() => setConfirming({ kind: "reset" })}
      >
        Reset demo
      </button>
      <Dialog
        open={confirming !== null && demoOn}
        onClose={() => setConfirming(null)}
        title={confirming?.kind === "load" ? `Load ${confirmLabel}?` : "Reset the demo?"}
        description={
          confirming?.kind === "load"
            ? `This replaces the demo data ${reach}. There is no undo.`
            : `This puts ${confirmLabel} back to its start and replaces the demo data ${reach}. There is no undo.`
        }
        size="sm"
        data-testid={confirming?.kind === "load" ? "ward-tools-demo-load-confirm" : "ward-tools-demo-reset-confirm"}
        primary={{
          label: confirming?.kind === "load" ? `Load ${confirmLabel}` : "Reset demo",
          tone: "danger",
          onAction: confirmWorldChange,
        }}
        secondary={[{ label: "Cancel", onAction: () => setConfirming(null) }]}
      />
      {oneList ? null : (
        <WardDemoReset className={styles.resetBlock} headingClassName={styles.resetHeading} offNoteId={offId} />
      )}
      <WardPracticeMode className={styles.resetBlock} headingClassName={styles.resetHeading} />
      <p className={styles.note}>Scenario files hold synthetic demo data only. Never type real patient details.</p>
      <p className={styles.liveNote} role="status">
        {message}
      </p>
    </div>
  );
}
