"use client";

import { FlaskConical } from "lucide-react";
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WARD_SCENARIOS, scenarioLabels } from "@/components/ward-management/ward-scenarios";

import { requestToolsTool, useToolsPreview } from "@/components/ward-management/tools/ward-tools-preview";

import styles from "./ward-demo-controls.module.css";

/**
 * Whole-branch review I3. Spec §2 decision 5 ("Does the clock move? Yes, with a jump-forward
 * control") and §5 ("+15 min, +1 hour … so a pulled bed can be watched expiring in seconds rather
 * than in an hour") are settled product decisions. `ADVANCE_CLOCK` and `RESET_SCENARIO` were
 * implemented and tested in the reducer from Task 3 onward but dispatched only from test-harness
 * buttons (`tests/ward-flow-clock-consistency.dom.test.tsx`'s `ClockAdvancer`) — no product
 * surface ever raised either event, so `pullExpiresAt` (always `now + 60`) could never actually be
 * watched expiring, the one thing §5 says the control exists to demonstrate.
 *
 * Mounted once in the shared navigation chrome (`WardBar`, formerly `ClinicalRail`),
 * next to `WardRoleSwitcher`, so it is present on every `/mockups/ward-flow/*` route
 * without any per-screen wiring — the clock is shared state, not a per-screen concern.
 *
 * **This must never be mistaken for a clinical action.** Three distinct signals carry that,
 * deliberately redundant rather than resting on any one of them:
 *   - A warning-toned trigger (`ward-demo-controls.module.css`'s own `--dc-warn` palette), not the
 *     role switcher's blue — the two controls sit side by side in the rail and must not read as
 *     one family.
 *   - A flask icon (`FlaskConical`) rather than a clock or gear — nothing in the rest of this
 *     phase uses it, so it carries no borrowed clinical meaning.
 *   - Every visible string says "demo" or "scenario", never "clinical" or a clinical verb, and the
 *     open menu leads with a notice sentence before any button is reachable.
 *
 * `ADVANCE_CLOCK`/`RESET_SCENARIO` carry no reducer precondition beyond the role check
 * (`ward-flow-reducer.ts`'s `case "ADVANCE_CLOCK"`/`case "RESET_SCENARIO"` — see `EVENT_ROLE`'s
 * `demo` role), so unlike every clinical control in this phase, these two buttons need no
 * `*BlockedReason` guard: raised with `role: "demo"`, the reducer can never refuse either.
 */
export function WardDemoControls() {
  const { scenario, dispatch, saveScenarioFile, loadScenarioFile, savingOnDevice } = useWardFlow();
  const now = useWardFlowClock();
  const [open, setOpen] = useState(false);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function advance(minutes: number) {
    dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes });
  }

  function reset() {
    dispatch({ type: "RESET_SCENARIO", role: "demo", now });
    setOpen(false);
  }

  function selectScenario(next: (typeof WARD_SCENARIOS)[number]) {
    dispatch({ type: "SET_SCENARIO", role: "demo", now, scenario: next });
  }

  /** Downloads the whole synthetic world (`ward-flow-scenario-file.ts`). Nothing goes to browser
   *  storage; the browser's own download is the only copy. */
  function saveToFile() {
    if (!saveScenarioFile) return;
    const built = saveScenarioFile();
    if (!built.ok) {
      setFileMessage(built.reason);
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
    setFileMessage(`Saved ${built.fileName} to your downloads.`);
  }

  async function loadFromFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared so picking the same file again still raises a change.
    input.value = "";
    if (!file || !loadScenarioFile) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setFileMessage("That file could not be read, so nothing was loaded.");
      return;
    }
    const result = loadScenarioFile(text);
    setFileMessage(
      result.ok
        ? "Scenario loaded. It is kept in this tab only, so load the file again after a refresh."
        : result.reason,
    );
  }

  return (
    <div className={styles.demo} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        data-testid="ward-demo-controls-trigger"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="ward-demo-controls-menu"
        aria-label="Demo clock controls — not a clinical action"
        title="Demo clock controls — moves only the prototype's scenario clock, never a clinical action"
        onClick={() => setOpen((value) => !value)}
      >
        <FlaskConical aria-hidden="true" />
      </button>
      {open ? (
        <div id="ward-demo-controls-menu" className={styles.menu} role="menu" aria-label="Demo clock controls">
          <p className={styles.notice}>
            Demo tool, not part of the clinical record. Moves only this prototype&apos;s shared scenario clock.
          </p>
          <span className={styles.clockReadout} data-testid="ward-demo-clock-readout">
            Scenario clock: {formatInstant(now)}
          </span>
          {savingOnDevice === false ? (
            <div className={styles.fileRow} role="status" data-testid="ward-demo-d18-lock">
              <span className={styles.fileHint}>Device save paused (D-18 free-text lock)</span>
              {saveScenarioFile ? (
                <button
                  type="button"
                  data-testid="ward-demo-save-scenario-file"
                  className={styles.advanceButton}
                  onClick={saveToFile}
                >
                  Save scenario file
                </button>
              ) : null}
            </div>
          ) : null}
          <div className={styles.actionRow}>
            <button
              type="button"
              role="menuitem"
              data-testid="ward-demo-advance-15"
              className={styles.advanceButton}
              onClick={() => advance(15)}
            >
              +15 min
            </button>
            <button
              type="button"
              role="menuitem"
              data-testid="ward-demo-advance-60"
              className={styles.advanceButton}
              onClick={() => advance(60)}
            >
              +1 hour
            </button>
          </div>
          {/* `menuitemradio` + `aria-checked`, not `menuitem` + `aria-pressed`. The scenarios are
              mutually exclusive — exactly one night is loaded — which is what `menuitemradio`
              means, and `menuitem` does not support `aria-pressed` at all, so the state was being
              announced to nobody. `role="radiogroup"` on the wrapper is what makes the set
              coherent to a screen reader rather than two unrelated checkable items. */}
          <div className={styles.scenarioRow} role="radiogroup" aria-label="Demo scenario">
            {WARD_SCENARIOS.map((candidate) => (
              <button
                type="button"
                role="menuitemradio"
                key={candidate}
                data-testid={`ward-demo-scenario-${candidate}`}
                className={styles.scenarioButton}
                aria-checked={scenario === candidate}
                onClick={() => selectScenario(candidate)}
              >
                {scenarioLabels[candidate]}
              </button>
            ))}
          </div>
          {saveScenarioFile && loadScenarioFile ? (
            <div className={styles.fileRow} role="group" aria-label="Demo scenario file">
              <p className={styles.fileHint}>
                Scenario files hold synthetic demo data only. Never type real patient details.
              </p>
              <div className={styles.actionRow}>
                <button
                  type="button"
                  role="menuitem"
                  data-testid="ward-demo-save-file"
                  className={styles.advanceButton}
                  onClick={saveToFile}
                >
                  Save to file
                </button>
                <button
                  type="button"
                  role="menuitem"
                  data-testid="ward-demo-load-file"
                  className={styles.advanceButton}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Load from file
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                data-testid="ward-demo-load-file-input"
                onChange={(event) => void loadFromFile(event)}
              />
              {fileMessage ? (
                <p className={styles.fileMessage} role="status" data-testid="ward-demo-file-message">
                  {fileMessage}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className={styles.resetRow}>
            <button
              type="button"
              role="menuitem"
              data-testid="ward-demo-reset"
              className={styles.resetButton}
              onClick={reset}
            >
              Reset scenario
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type WardDemoClockPopoverProps = {
  className?: string;
  title?: string;
  "aria-label"?: string;
  children?: ReactNode;
  testId?: string;
};

/**
 * Compact 1-click popover on the existing clock pill (`ward-rail.tsx` / `ward-bar.tsx`):
 * preserves all caller `aria-label`, `title`, and children on the clock display while letting
 * the user click the clock pill to open a `.glass` popover with `+15m`, `+1h`, Scenario preset
 * selector, D-18 save-file action when device saving is paused, and `Reset demo`.
 */
export function WardDemoClockPopover({
  className,
  title,
  "aria-label": ariaLabel,
  children,
  testId = "ward-demo-clock-pill",
}: WardDemoClockPopoverProps) {
  const { scenario, dispatch, saveScenarioFile, savingOnDevice } = useWardFlow();
  const now = useWardFlowClock();
  const [open, setOpen] = useState(false);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function saveToFile() {
    if (!saveScenarioFile) return;
    const built = saveScenarioFile();
    if (!built.ok) {
      setFileMessage(built.reason);
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
    setFileMessage(`Saved ${built.fileName} to your downloads.`);
  }

  const clockText = formatInstant(now);
  // Tools review mockup: with `?tools=new` the pill opens the one Demo panel in Tools instead.
  const toolsPreview = useToolsPreview();

  if (toolsPreview) {
    return (
      <button
        type="button"
        className={className}
        title={title ?? `Board time ${clockText} AWST`}
        aria-label={`${ariaLabel ?? `Board time ${clockText} AWST`}. Open demo controls in Tools`}
        data-testid={testId}
        onClick={() => requestToolsTool("demo")}
      >
        {children ?? (
          <>
            <span>Board time</span> <b>{clockText}</b> <span>AWST</span>
          </>
        )}
      </button>
    );
  }

  // `styles.demo` carries the --dc-* tokens the menu and buttons read; display stays block as before.
  return (
    <div ref={containerRef} className={styles.demo} style={{ display: "block" }}>
      <button
        type="button"
        className={className}
        title={title ?? `Board time ${clockText} AWST`}
        aria-label={ariaLabel ?? `Board time ${clockText} AWST`}
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen((prev) => !prev)}
      >
        {children ?? (
          <>
            <span>Board time</span> <b>{clockText}</b> <span>AWST</span>
          </>
        )}
      </button>
      {open ? (
        <div
          className={`glass ${styles.menu}`}
          role="dialog"
          aria-label="Demo clock and scenario controls"
          data-testid="ward-demo-clock-popover"
        >
          <span className={styles.clockReadout}>Scenario clock: {clockText} AWST</span>
          {savingOnDevice === false ? (
            <div className={styles.fileRow} role="status" data-testid="ward-demo-clock-d18-lock">
              <span className={styles.fileHint}>Device save paused (D-18 free-text lock)</span>
              {saveScenarioFile ? (
                <button
                  type="button"
                  data-testid="ward-demo-clock-save-scenario-file"
                  className={styles.advanceButton}
                  onClick={saveToFile}
                >
                  Save scenario file
                </button>
              ) : null}
              {fileMessage ? <p className={styles.fileMessage}>{fileMessage}</p> : null}
            </div>
          ) : null}
          <div className={styles.actionRow}>
            <button
              type="button"
              data-testid="ward-demo-clock-advance-15"
              className={styles.advanceButton}
              onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 15 })}
            >
              +15m
            </button>
            <button
              type="button"
              data-testid="ward-demo-clock-advance-60"
              className={styles.advanceButton}
              onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 60 })}
            >
              +1h
            </button>
          </div>
          <div className={styles.scenarioRow} role="radiogroup" aria-label="Demo scenario preset">
            {WARD_SCENARIOS.map((candidate) => (
              <button
                type="button"
                role="radio"
                key={candidate}
                data-testid={`ward-demo-clock-scenario-${candidate}`}
                className={styles.scenarioButton}
                aria-checked={scenario === candidate}
                onClick={() => dispatch({ type: "SET_SCENARIO", role: "demo", now, scenario: candidate })}
              >
                {scenarioLabels[candidate]}
              </button>
            ))}
          </div>
          <div className={styles.resetRow}>
            <button
              type="button"
              data-testid="ward-demo-clock-reset"
              className={styles.resetButton}
              onClick={() => {
                dispatch({ type: "RESET_SCENARIO", role: "demo", now });
                setOpen(false);
              }}
            >
              Reset demo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
