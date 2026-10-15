"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/wf";

import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
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
 */
export function WardDemoReset({ className, headingClassName }: { className?: string; headingClassName?: string }) {
  const enabled = useWardFeatureFlag("demo-reset");
  const { scenario, dispatch } = useWardFlow();
  const now = useWardFlowClock();
  const [pending, setPending] = useState<WardScenario | null>(null);
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
    dispatch({ type: "SET_SCENARIO", role: "demo", now, scenario: next });
    announceToWardShell(`${scenarioLabels[next]} loaded. Synthetic demo data only.`);
  }

  return (
    <section
      className={className ? `${styles.reset} ${className}` : styles.reset}
      aria-labelledby="ward-demo-reset-title"
      data-testid="ward-demo-reset"
    >
      <h3 id="ward-demo-reset-title" className={headingClassName}>
        <RotateCcw aria-hidden="true" strokeWidth={1.75} />
        Demo reset
        <span>Synthetic data, not a clinical action</span>
      </h3>
      <div className={styles.choices}>
        {DEMO_RESET_SCENARIOS.map((choice) => {
          const loaded = scenario === choice;
          return (
            <button
              key={choice}
              type="button"
              className={styles.choice}
              data-testid={`ward-demo-reset-${choice}`}
              aria-describedby={`ward-demo-reset-${choice}-note`}
              aria-pressed={loaded}
              onClick={() => setPending(choice)}
            >
              <strong>{scenarioLabels[choice]}</strong>
              <span id={`ward-demo-reset-${choice}-note`}>{scenarioDescriptions[choice]}</span>
              {loaded ? <em>Loaded</em> : null}
            </button>
          );
        })}
      </div>
      {pending ? (
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
