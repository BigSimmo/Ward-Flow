"use client";

import { downloadBlob } from "@/components/ward-management/ward-download";

import { ChevronDown, Pause, Play } from "lucide-react";
import { type ChangeEvent, createContext, useContext, useId, useLayoutEffect, useRef, useState } from "react";

import { Dialog, useLivePause } from "@/components/wf";

import { RESET_KEEPS_CLOCK, WardDemoReset, demoDataReach } from "../demo-reset/ward-demo-reset";
import { WardPracticeMode } from "../demo-reset/ward-practice-mode";
import { formatInstant, formatInstantWithDay } from "../ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { WARD_FLOW_SCENARIO_FILE_MAX_BYTES } from "../ward-flow-scenario-file-limits";
import { DEMO_CONTROLS_OFF, useDemoControlsAvailable, useWardRaise } from "../ward-flow-raise";
import type { WardCommandOutcome } from "../ward-shared-client";
import { DEMO_RESET_SCENARIOS, WARD_SCENARIOS, scenarioLabels, type WardScenario } from "../ward-scenarios";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { WardDemoRoles } from "./ward-demo-roles";
import { resetWardDemoBrowserState } from "../ward-browser-data";
import styles from "./ward-tools-sheet.module.css";
import demo from "./ward-demo-panel.module.css";
import { useWardShellAuthority } from "../shell/ward-shell-public-context";
import { useExecutiveStatistics } from "../statistics/executive-statistics-context";

/**
 * Tools, Demo (Tools review item 9, 15 Oct 2026): the one place the prototype's scenario, clock and
 * scenario file are changed. It replaces the Shift desk "Scenario controls" menu and the footer clock
 * popover, which repeated the same controls, and holds the one tap Demo reset (`demo-reset` flag). Every event is
 * raised with `role: "demo"` exactly as before, and every string says demo, never clinical.
 *
 * `oneList` (change 8, D-77, 21 Oct 2026): the desktop Demo menu under the Synthetic pill shows all
 * seven scenarios as one list, so the separate Demo reset block and its three choices go there.
 * Phone Tools keeps both until a phone mock-up is approved.
 *
 * Demo menu layout (pop-demo, approved by Josh 31 Oct 2026; layout and wording only): the choice in
 * use reads "Current", the clock is one row, Practise a placement folds into a closed row with a
 * chevron, and Save to file and Load from file sit in a footer pinned to the foot of the scroll. The
 * safety lines stay word for word.
 *
 * Shared design parts item 8 (13 Nov 2026): the clock row (+15 min, +1 hour and Pause) and Reset
 * demo come first, then Scenario, then See it as, as wrapping 32px choices, so the panel fits a
 * 1366 x 768 or 1280 x 600 laptop without scrolling to Reset. Pause holds Board time on this
 * device's demo (D-229) and also runs the page's own pause, the one a tap on its Live chip runs
 * (`useLivePause`). On the shared board it is the page's pause alone, shown only where one exists.
 */
/** The world change waiting on its confirm: Reset demo, or a scenario card. */
type DemoConfirm = { kind: "reset" } | { kind: "load"; scenario: WardScenario; workedExamples?: boolean };
type DemoConfirmHold = readonly [DemoConfirm | null, (next: DemoConfirm | null) => void];

/**
 * Review E-14 (F-142): a pending confirm held above a layout switch. The Tools sheet draws the panel
 * in its right pane from 1280 wide and as its own page below that, so crossing the line remounts the
 * panel; holding the confirm in the sheet keeps it open through the switch. The hold ends with the
 * sheet, so closing Tools drops it. Without a provider the panel holds its own.
 */
export const WardDemoConfirmHold = createContext<DemoConfirmHold | null>(null);

/**
 * A pending confirm is dropped when demo controls go off, so it can never reopen by itself when
 * they come back (review finding on DA-10). Adjusted during render, not in an effect.
 */
export function useDemoConfirmHold(): DemoConfirmHold {
  const demoOn = useDemoControlsAvailable();
  const [pending, setPending] = useState<DemoConfirm | null>(null);
  if (!demoOn && pending) setPending(null);
  return [pending, setPending];
}

/**
 * `grow` lets the panel take its full height inside a scroller that already scrolls (the Tools
 * sheet), so it never becomes a second scroller and its footer flows after the content.
 */
/**
 * A16-14 (Josh, 13 Nov 2026): the legal-form worked examples are off by default and switched on
 * here by the presenter. Only the days built on the standard network carry them.
 */
const WORKED_EXAMPLE_SCENARIOS: readonly WardScenario[] = ["standard", "scarce"];

export function WardDemoPanel({ oneList = false, grow = false }: { oneList?: boolean; grow?: boolean } = {}) {
  return useWardShellAuthority()?.role === "executive" ? (
    <ExecutiveDemoPanel grow={grow} />
  ) : (
    <OperationalDemoPanel oneList={oneList} grow={grow} />
  );
}
function ExecutiveDemoPanel({ grow = false }: { grow?: boolean }) {
  const report = useExecutiveStatistics();
  return (
    <div className={demo.body} data-grow={grow || undefined} data-testid="ward-tools-demo-panel">
      <div className={demo.scroll}>
        <p className={styles.note} data-testid="ward-tools-demo-off">
          {DEMO_CONTROLS_OFF}
        </p>
        <section className={demo.first} aria-label="Demo clock and reset">
          <div className={demo.clockRow}>
            <span className={demo.clock}>
              Demo clock {report && <b>{formatInstantWithDay(report.network.asAt.now, report.network.asAt.now)}</b>}
            </span>
            <button type="button" disabled className={demo.small}>
              +15 min
            </button>
            <button type="button" disabled className={demo.small}>
              +1 hour
            </button>
          </div>
          <button type="button" disabled className={demo.reset} data-testid="ward-tools-demo-reset">
            Reset demo
          </button>
        </section>
        <section className={demo.group} aria-label="Scenario">
          <h3 className={demo.groupHead}>Scenario</h3>
          <div className={demo.grid} role="group" aria-label="Demo scenario">
            {WARD_SCENARIOS.map((scenario) => (
              <button
                key={scenario}
                type="button"
                disabled
                aria-current={report?.sampleScenario === scenario ? "true" : undefined}
                className={demo.choice}
              >
                <strong>{scenarioLabels[scenario]}</strong>
                {report?.sampleScenario === scenario && <em>Current</em>}
              </button>
            ))}
          </div>
        </section>
        <p className={styles.demoNotice}>Demo tools. They change the synthetic data only, never a clinical record.</p>
      </div>
    </div>
  );
}
function OperationalDemoPanel({ oneList = false, grow = false }: { oneList?: boolean; grow?: boolean }) {
  const {
    scenario,
    saveScenarioFile,
    loadScenarioFile,
    savingOnDevice,
    worldGeneration,
    shared,
    captureCommandLifetime,
    workedExamples,
    boardClockPause,
  } = useWardFlowSelect(
    "scenario",
    "saveScenarioFile",
    "loadScenarioFile",
    "savingOnDevice",
    "worldGeneration",
    "shared",
    "captureCommandLifetime",
    "workedExamples",
    "boardClockPause",
  );
  // M12: the world's own flag. A scoped desk is not sent every example record, so reading them
  // here showed the examples as off and Load offered to switch them on again.
  const examplesOn = workedExamples;
  // The switch changes the whole network's demo, so only a whole-network desk offers it (coordinator
  // decision, 14 Nov 2026).
  const authority = useWardShellAuthority();
  const examplesOffered =
    WORKED_EXAMPLE_SCENARIOS.includes(scenario) && (authority === null || authority.scope.kind === "statewide");
  const now = useWardFlowClock();
  const livePause = useLivePause();
  // D-229 (stress test D1a-S-1, Josh 14 Nov 2026): Pause holds Board time on this device's demo, and
  // still freezes the page's lists as a tap on its Live chip does. The shared board keeps the page's
  // pause alone: its clock is the server's.
  const pause = boardClockPause
    ? {
        paused: boardClockPause.paused,
        toggle: () => {
          if (livePause && livePause.paused === boardClockPause.paused) livePause.toggle();
          boardClockPause.toggle();
        },
      }
    : livePause;
  const raise = useWardRaise("demo");
  const demoOn = useDemoControlsAvailable();
  const offId = useId();
  const lock = demoOn ? {} : { disabled: true, "aria-describedby": offId };
  const [message, setMessage] = useState<string | null>(null);
  // The world change waiting on its confirm: Reset demo, or a scenario card (overall review, 20 Oct
  // 2026: a card replaced all the demo data in one tap, so it now asks first, the same as Reset).
  // Held by the Tools sheet when the panel sits in one, so a layout switch does not drop it.
  const ownHold = useDemoConfirmHold();
  const [confirming, setConfirming] = useContext(WardDemoConfirmHold) ?? ownHold;
  // useDemoConfirmHold drops a pending confirm when demo controls go off (DA-10), wherever it is held.
  const reach = demoDataReach(shared?.enabled === true);
  // With the one tap Demo reset on, its three scenarios load from there, after a confirm, so the
  // picker above does not offer them a second time.
  const resetOn = useWardFeatureFlag("demo-reset") && !oneList;
  const resetScenarios: readonly string[] = DEMO_RESET_SCENARIOS;
  const pickable = resetOn ? WARD_SCENARIOS.filter((candidate) => !resetScenarios.includes(candidate)) : WARD_SCENARIOS;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importOwner = useRef(0);
  const importWorld = useRef(worldGeneration);
  useLayoutEffect(() => {
    importWorld.current = worldGeneration;
  }, [worldGeneration]);
  useLayoutEffect(
    () => () => {
      importOwner.current += 1;
    },
    [],
  );

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
    importOwner.current += 1;
    const pending = confirming;
    setConfirming(null);
    if (!pending) return;
    const from = worldGeneration;
    const examples = pending.kind === "load" ? pending.workedExamples : undefined;
    const label =
      scenarioLabels[pending.kind === "load" ? pending.scenario : scenario] +
      (examples === true ? " with worked examples" : examples === false ? " without worked examples" : "");
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
      // F-65: Reset demo also clears this browser's demo-day leftovers and, on this device's own
      // demo, puts the tab back on the bed coordinator's desk.
      if (pending.kind === "reset") resetWardDemoBrowserState({ desk: shared?.enabled !== true });
      setMessage(pending.kind === "reset" ? `${label} reset to its start ${reach}.` : `${label} loaded ${reach}.`);
    };
    setMessage(null);
    const outcome =
      pending.kind === "reset"
        ? raise("RESET_SCENARIO")
        : raise("SET_SCENARIO", {
            scenario: pending.scenario,
            ...(pending.workedExamples ? { workedExamples: true } : {}),
          });
    if (outcome && "then" in outcome) {
      void outcome.then(settle, () => setMessage(notConfirmed));
    } else settle(outcome);
  }

  const confirmLabel = confirming?.kind === "load" ? scenarioLabels[confirming.scenario] : scenarioLabels[scenario];
  const confirmExamples = confirming?.kind === "load" ? confirming.workedExamples : undefined;

  async function loadFromFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !loadScenarioFile) return;
    const owner = ++importOwner.current;
    if (file.size > WARD_FLOW_SCENARIO_FILE_MAX_BYTES) {
      setMessage("This scenario file is larger than 10 MiB, so nothing was loaded.");
      return;
    }
    const startedWorld = worldGeneration;
    const lifetime = captureCommandLifetime?.();
    const isCurrent = () =>
      owner === importOwner.current && startedWorld === importWorld.current && lifetime?.() !== false;
    try {
      const result = await loadScenarioFile(file.text(), isCurrent);
      if (owner === importOwner.current && (result.ok || isCurrent()))
        setMessage(result.ok ? "Scenario loaded." : result.reason);
    } catch {
      if (isCurrent()) setMessage("That file could not be read, so nothing was loaded.");
      return;
    }
  }

  return (
    <div className={demo.body} data-grow={grow || undefined} data-testid="ward-tools-demo-panel">
      <div className={demo.scroll}>
        {demoOn ? null : (
          <p id={offId} className={styles.note} data-testid="ward-tools-demo-off">
            {DEMO_CONTROLS_OFF}
          </p>
        )}
        <section className={demo.first} aria-label="Demo clock and reset">
          <div className={demo.clockRow}>
            <span className={demo.clock}>
              Demo clock <b>{formatInstant(now)}</b>
            </span>
            {/* D-150: the signed-in site runs on real Perth time, so its clock is not advanced. */}
            {shared?.enabled ? null : (
              <>
                <button
                  type="button"
                  className={demo.small}
                  {...lock}
                  onClick={() => raise("ADVANCE_CLOCK", { minutes: 15 })}
                >
                  +15 min
                </button>
                <button
                  type="button"
                  className={demo.small}
                  {...lock}
                  onClick={() => raise("ADVANCE_CLOCK", { minutes: 60 })}
                >
                  +1 hour
                </button>
              </>
            )}
            {/* Holds Board time and the page's lists (D-229); it changes no demo data. */}
            {pause ? (
              <button type="button" className={demo.small} data-testid="ward-tools-demo-pause" onClick={pause.toggle}>
                {pause.paused ? (
                  <Play aria-hidden="true" strokeWidth={1.75} />
                ) : (
                  <Pause aria-hidden="true" strokeWidth={1.75} />
                )}
                {pause.paused ? "Resume" : "Pause"}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className={demo.reset}
            {...lock}
            data-testid="ward-tools-demo-reset"
            onClick={() => setConfirming({ kind: "reset" })}
          >
            Reset demo
          </button>
        </section>
        <section className={demo.group} aria-label="Scenario">
          <h3 className={demo.groupHead}>Scenario</h3>
          <div className={demo.grid} role="group" aria-label="Demo scenario">
            {pickable.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-current={scenario === candidate ? "true" : undefined}
                className={demo.choice}
                {...lock}
                onClick={() => {
                  importOwner.current += 1;
                  setConfirming({ kind: "load", scenario: candidate });
                }}
              >
                <strong>{scenarioLabels[candidate]}</strong>
                {scenario === candidate ? <em>Current</em> : null}
              </button>
            ))}
          </div>
        </section>
        {examplesOffered ? (
          <section className={demo.group} aria-label="Worked examples" data-testid="ward-tools-demo-worked-examples">
            <h3 className={demo.groupHead}>Worked examples</h3>
            <p className={styles.note}>
              Example people at Armadale ED, one for each legal form. Off by default, so the day&apos;s figures come
              from ordinary sample people.
            </p>
            <button
              type="button"
              className={demo.small}
              aria-pressed={examplesOn}
              data-testid="ward-tools-demo-worked-examples-toggle"
              {...lock}
              onClick={() => {
                importOwner.current += 1;
                setConfirming({ kind: "load", scenario, workedExamples: !examplesOn });
              }}
            >
              {examplesOn ? "Hide worked examples" : "Show worked examples"}
            </button>
          </section>
        ) : null}
        <WardDemoRoles enabled={demoOn} />
        <p className={styles.demoNotice}>Demo tools. They change the synthetic data only, never a clinical record.</p>
        {oneList ? null : (
          <WardDemoReset className={styles.resetBlock} headingClassName={styles.resetHeading} offNoteId={offId} />
        )}
        <details className={demo.practice}>
          <summary>
            Practise a placement
            <ChevronDown aria-hidden="true" className={demo.practiceCaret} strokeWidth={1.75} />
          </summary>
          <WardPracticeMode className={demo.practiceBody} headingClassName={demo.practiceHeading} />
        </details>
        {savingOnDevice === false ? (
          <p className={styles.note} data-testid="ward-tools-device-save-paused">
            Not saved on this device, because this world holds typed text. Reloading loses it, so use Save to file to
            keep it.
          </p>
        ) : null}
      </div>
      <footer className={demo.foot}>
        {saveScenarioFile && loadScenarioFile ? (
          <div className={demo.footFiles} role="group" aria-label="Demo scenario file">
            <button type="button" className={demo.small} onClick={saveToFile}>
              Save to file
            </button>
            <button type="button" className={demo.small} {...lock} onClick={() => fileInputRef.current?.click()}>
              Load from file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => void loadFromFile(event)}
            />
          </div>
        ) : null}
        {/* Beside the file controls, so a save or load result is seen without scrolling the lists. */}
        <p className={styles.liveNote} role="status">
          {message}
        </p>
        <p className={demo.footNote}>Scenario files hold synthetic demo data only. Never type real patient details.</p>
      </footer>
      <Dialog
        open={confirming !== null && demoOn}
        onClose={() => setConfirming(null)}
        title={
          confirmExamples !== undefined
            ? `${confirmExamples ? "Show" : "Hide"} worked examples?`
            : confirming?.kind === "load"
              ? `Load ${confirmLabel}?`
              : "Reset the demo?"
        }
        description={
          confirmExamples !== undefined
            ? `This reloads ${confirmLabel} ${confirmExamples ? "with" : "without"} the worked examples and replaces the demo data ${reach}. There is no undo.`
            : confirming?.kind === "load"
              ? `This replaces the demo data ${reach}. There is no undo.`
              : `This puts ${confirmLabel} back to its start and replaces the demo data ${reach}. There is no undo. ${RESET_KEEPS_CLOCK}`
        }
        size="sm"
        data-testid={confirming?.kind === "load" ? "ward-tools-demo-load-confirm" : "ward-tools-demo-reset-confirm"}
        primary={{
          label:
            confirmExamples !== undefined
              ? `${confirmExamples ? "Show" : "Hide"} worked examples`
              : confirming?.kind === "load"
                ? `Load ${confirmLabel}`
                : "Reset demo",
          tone: "danger",
          onAction: confirmWorldChange,
        }}
        secondary={[{ label: "Cancel", onAction: () => setConfirming(null) }]}
      />
    </div>
  );
}
