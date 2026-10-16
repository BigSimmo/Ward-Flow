"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/wf";

import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  DEMO_CONTROLS_OFF,
  useDemoControlsAvailable,
  useWardRaise,
} from "@/components/ward-management/ward-flow-raise";
import {
  DEMO_RESET_SCENARIOS,
  scenarioDescriptions,
  scenarioLabels,
  type WardScenario,
} from "@/components/ward-management/ward-scenarios";

import styles from "./ward-demo-reset.module.css";

/**
 * THE ONE TAP DEMO RESET (Josh, 15 Oct 2026, item 10): quiet day, winter surge, ED crisis.
 *
 * Each button reloads the whole synthetic network through the reducer's own `SET_SCENARIO`, the
 * same event the demo clock menu uses, so it works the same way on this device and in the shared
 * workspace, and the generated network (`ward-demo-network.ts`) is the only source of the data.
 * It is a demo tool, never a clinical action, and it says so. Behind the `demo-reset` flag.
 *
 * A choice asks once before it loads (15 Oct 2026, review): in the shared workspace a stray tap
 * would replace everyone's demo data mid demonstration, and there is no undo.
 *
 * `offNoteId` names a "demo controls are off" note the host already shows (the Tools demo panel), so
 * the reason appears once on the page and the choices point at it.
 */
export function WardDemoReset({
  className,
  headingClassName,
  offNoteId,
}: {
  className?: string;
  headingClassName?: string;
  offNoteId?: string;
}) {
  const enabled = useWardFeatureFlag("demo-reset");
  const { scenario } = useWardFlowSelect("scenario");
  const raise = useWardRaise("demo");
  const demoOn = useDemoControlsAvailable();
  const [pending, setPending] = useState<WardScenario | null>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const ownOffId = `${baseId}-off`;
  const offId = offNoteId ?? ownOffId;
  const loadButton = useRef<HTMLButtonElement>(null);
  // The confirm takes focus as it opens, so keyboard and screen reader users meet it straight away.
  useEffect(() => {
    if (pending) loadButton.current?.focus();
  }, [pending]);
  if (!enabled) return null;

  function cancel() {
    const choice = pending;
    setPending(null);
    if (choice) document.querySelector<HTMLElement>(`[data-testid="ward-demo-reset-${choice}"]`)?.focus();
  }

  function load(next: WardScenario) {
    setPending(null);
    raise("SET_SCENARIO", { scenario: next });
    announceToWardShell(`${scenarioLabels[next]} loaded. Synthetic demo data only.`);
  }

  return (
    <section
      className={className ? `${styles.reset} ${className}` : styles.reset}
      aria-labelledby={titleId}
      data-testid="ward-demo-reset"
    >
      <h3 id={titleId} className={headingClassName}>
        <RotateCcw aria-hidden="true" strokeWidth={1.75} />
        Demo reset
        <span>Synthetic data, not a clinical action</span>
      </h3>
      {demoOn || offNoteId ? null : (
        <p id={ownOffId} data-testid="ward-demo-reset-off">
          {DEMO_CONTROLS_OFF}
        </p>
      )}
      <div className={styles.choices}>
        {DEMO_RESET_SCENARIOS.map((choice) => {
          const loaded = scenario === choice;
          const noteId = `${baseId}-${choice}-note`;
          return (
            <button
              key={choice}
              type="button"
              className={styles.choice}
              data-testid={`ward-demo-reset-${choice}`}
              aria-describedby={demoOn ? noteId : `${noteId} ${offId}`}
              aria-pressed={loaded}
              disabled={!demoOn}
              onClick={() => setPending(choice)}
            >
              <strong>{scenarioLabels[choice]}</strong>
              <span id={noteId}>{scenarioDescriptions[choice]}</span>
              {loaded ? <em>Loaded</em> : null}
            </button>
          );
        })}
      </div>
      {pending && demoOn ? (
        <div
          className={styles.confirm}
          role="group"
          aria-label="Confirm demo reset"
          data-testid="ward-demo-reset-confirm"
        >
          <p>Load {scenarioLabels[pending]}? This replaces the demo data for everyone in this workspace.</p>
          <Button
            ref={loadButton}
            variant="pri"
            onClick={() => load(pending)}
            data-testid="ward-demo-reset-confirm-load"
          >
            Load {scenarioLabels[pending]}
          </Button>
          <Button onClick={cancel}>Cancel</Button>
        </div>
      ) : null}
    </section>
  );
}
