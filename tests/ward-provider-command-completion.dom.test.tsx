import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useLayoutEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoordinatorCockpit } from "@/components/ward-management/coordinator/coordinator-cockpit";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  tryReadDemoState,
  tryWriteDemoState,
  WARD_FLOW_DEMO_STORAGE_VERSION,
} from "@/components/ward-management/ward-flow-demo-storage";
import { buildScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import { absoluteWallClockMinutes, demoDayZero } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});
describe("provider command completion", () => {
  it("returns exact immediate local outcomes for batched accepted, refused and accepted calls", () => {
    const results: unknown[] = [];
    function Probe() {
      const { dispatch, now, rejections } = useWardFlow();
      return (
        <>
          <output>
            {now}:{rejections.length}
          </output>
          <button
            onClick={() => {
              for (let index = 0; index < 64; index++)
                dispatch({ type: "ADVANCE_CLOCK", role: "ward", now, minutes: 15 });
              results.push(dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 15 }));
              results.push(dispatch({ type: "ADVANCE_CLOCK", role: "ward", now, minutes: 15 }));
              results.push(dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 15 }));
            }}
          >
            Batch
          </button>
          <button onClick={() => results.push(dispatch({ type: "RESET_SCENARIO", role: "demo", now }))}>
            Reset batched world
          </button>
        </>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByText("Batch"));
    expect(results).toMatchObject([{ status: "accepted" }, { status: "refused" }, { status: "accepted" }]);
    expect(screen.getByRole("status").textContent).toBe(`${NOW_ANCHOR + 30}:65`);
    fireEvent.click(screen.getByText("Reset batched world"));
    expect(results[3]).toMatchObject({ status: "accepted" });
    expect(screen.getByRole("status").textContent).toBe(`${NOW_ANCHOR}:0`);
  });
  it("waits for saved-world replay rather than claiming a seed-only departure succeeded", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T10:00:00Z"));
    const seed = seedWardFlowState();
    const admission = seed.admissions.find((row) => row.state === "occupied")!;
    const event = {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      leavingDestination: "discharged-to-the-community",
    } as const;
    const saved = wardFlowReducer(seed, event);
    expect(saved.rejections).toHaveLength(0);
    expect(tryWriteDemoState(saved, demoDayZero(new Date()), NOW_ANCHOR, absoluteWallClockMinutes())).toBe(true);
    expect(
      tryReadDemoState(demoDayZero(new Date()), absoluteWallClockMinutes()).saved?.state.admissions.find(
        (row) => row.id === admission.id,
      )?.state,
    ).toBe("departed");
    const finished = vi.fn();
    let dispatched = false;
    function Early() {
      const { dispatch } = useWardFlow();
      useLayoutEffect(() => {
        if (dispatched) return;
        dispatched = true;
        const outcome = dispatch(event);
        expect(outcome).toBeInstanceOf(Promise);
        void Promise.resolve(outcome).then(finished);
      }, [dispatch]);
      return null;
    }
    await act(async () => {
      render(
        <StrictMode>
          <WardFlowProvider>
            <Early />
          </WardFlowProvider>
        </StrictMode>,
      );
    });
    expect(finished).toHaveBeenCalledWith(expect.objectContaining({ status: "refused" }));
    expect(finished).not.toHaveBeenCalledWith(expect.objectContaining({ status: "accepted" }));
  });
});

it("forwards the real provider's command outcome through the cockpit and role raise adapters", () => {
  const results: unknown[] = [];
  function AdapterProbe() {
    const { recordWardDeparture, admissions } = useWardFlow();
    const raise = useWardRaise("ward");
    return (
      <button
        onClick={() => {
          results.push(raise("ADVANCE_CLOCK", { minutes: 5 }));
          const admission = admissions.find((row) => row.state === "occupied")!;
          results.push(recordWardDeparture(admission.id, admission.unitId, "discharged-to-the-community"));
        }}
      >
        Adapters
      </button>
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CoordinatorCockpit>
        <AdapterProbe />
      </CoordinatorCockpit>
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByText("Adapters"));
  // Cockpit supplies coordinator: the demo-only clock step is refused, and departure is accepted.
  expect(results).toMatchObject([{ status: "refused" }, { status: "accepted" }]);
});

it("settles repeated pre-adoption dispatches of the same event object once each", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T10:00:00Z"));
  const event = { type: "ADVANCE_CLOCK", role: "demo", now: NOW_ANCHOR, minutes: 15 } as const;
  const finished = vi.fn();
  let dispatched = false;
  function EarlyRepeated() {
    const { dispatch, now } = useWardFlow();
    useLayoutEffect(() => {
      if (dispatched) return;
      dispatched = true;
      void Promise.resolve(dispatch(event)).then(finished);
      void Promise.resolve(dispatch(event)).then(finished);
      expect(finished).not.toHaveBeenCalled();
    }, [dispatch]);
    return <output data-testid="repeated-clock">{now}</output>;
  }
  await act(async () => {
    render(
      <StrictMode>
        <WardFlowProvider>
          <EarlyRepeated />
        </WardFlowProvider>
      </StrictMode>,
    );
  });
  expect(finished).toHaveBeenCalledTimes(2);
  expect(finished.mock.calls.map(([outcome]) => outcome.status)).toEqual(["accepted", "accepted"]);
  expect(new Set(finished.mock.calls.map(([outcome]) => outcome.commandId)).size).toBe(2);
  expect(screen.getByTestId("repeated-clock").textContent).toBe(String(NOW_ANCHOR + 30));
});

it("expires a local accepted completion when the world is reset", () => {
  let result: import("@/components/ward-management/ward-shared-client").WardCommandOutcome | undefined;
  function FenceProbe() {
    const { dispatch, now } = useWardFlow();
    return (
      <>
        <button
          onClick={() => {
            result = dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 1 }) as typeof result;
          }}
        >
          Record fenced
        </button>
        <button onClick={() => dispatch({ type: "RESET_SCENARIO", role: "demo", now })}>Reset fenced</button>
      </>
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <FenceProbe />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByText("Record fenced"));
  expect(result?.isCurrent?.()).toBe(true);
  fireEvent.click(screen.getByText("Reset fenced"));
  expect(result?.isCurrent?.()).toBe(false);
});

it("cancels a pre-adoption command when a scenario file replaces its world", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-17T10:00:00Z"));
  const imported = wardFlowReducer(seedWardFlowState(), {
    type: "ADVANCE_CLOCK",
    role: "demo",
    now: NOW_ANCHOR,
    minutes: 90,
  });
  expect(imported.rejections).toHaveLength(0);
  const file = buildScenarioFile(imported, NOW_ANCHOR + 90, WARD_FLOW_DEMO_STORAGE_VERSION, new Date());
  expect(file.ok).toBe(true);
  if (!file.ok) throw new Error(file.reason);
  const scenarioJson = file.json;
  const finished = vi.fn();
  let dispatched = false;
  function EarlyScenarioLoad() {
    const { dispatch, loadScenarioFile, now, worldGeneration } = useWardFlow();
    useLayoutEffect(() => {
      if (dispatched) return;
      dispatched = true;
      // Layout effects precede saved-session adoption. This command would be accepted
      // on the seed, but loading a file discards that seed before the promise settles.
      const pending = dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: NOW_ANCHOR, minutes: 15 });
      expect(pending).toBeInstanceOf(Promise);
      void Promise.resolve(pending).then(finished);
      expect(finished).not.toHaveBeenCalled();
      expect(loadScenarioFile?.(scenarioJson)).toEqual({ ok: true });
    }, [dispatch, loadScenarioFile]);
    return (
      <output data-testid="scenario-load-world">
        {now}:{worldGeneration}
      </output>
    );
  }
  await act(async () => {
    render(
      <StrictMode>
        <WardFlowProvider>
          <EarlyScenarioLoad />
        </WardFlowProvider>
      </StrictMode>,
    );
  });
  expect(finished).toHaveBeenCalledTimes(1);
  expect(finished).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "cancelled",
      message: expect.stringContaining("scenario was replaced"),
    }),
  );
  expect(finished.mock.calls[0]![0].isCurrent?.()).toBe(false);
  expect(screen.getByTestId("scenario-load-world").textContent).toBe(
    `${NOW_ANCHOR + 90}:${imported.worldGeneration + 1}`,
  );
});
