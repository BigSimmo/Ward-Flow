import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/WF-005",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { PatientTransitOperations } from "@/components/ward-management/patients/patient-transit-operations";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { observationEditingToken } from "@/components/ward-management/ward-flow-observation-events";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  INTERMITTENT_INTERVAL_MINUTES,
  NO_INTERVAL_ERROR,
  NOT_RECORDED_OBSERVATION,
  PULL_NEEDS_OBSERVATION_LEVEL,
  observationAt,
  type Observation,
} from "@/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/*
 * D-188, tightened to every pull (Josh, 13 Nov 2026): the patient page's Pull the bed asks for an
 * observation level when the journey has none, records it with RECORD_OBSERVATION_LEVEL, then pulls.
 * A refused record pulls nothing. Synthetic seed only; the level chosen is only a recorded choice.
 */
afterEach(() => cleanup());

/** A seeded journey waiting for its bed whose pull is accepted as seeded. */
const JOURNEY_ID = (() => {
  const seed = seedWardFlowState();
  for (const movement of seed.movements) {
    if (movement.closure || movement.stage !== "accepted_awaiting_bed" || !movement.acceptedUnitId) continue;
    const pulled = wardFlowReducer(seed, {
      type: "PULL_PATIENT",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      unitId: movement.acceptedUnitId,
    });
    if (pulled.movements.find(({ id }) => id === movement.id)?.stage === "pulled") return movement.id;
  }
  throw new Error("the seed has no journey whose pull is accepted");
})();

/** The provider's latest view, kept after each render for the test's own setup and reads. */
const held: { api?: ReturnType<typeof useWardFlow> } = {};
/** When set, the deck is handed this copy of the journey instead of the live one (a stale screen). */
let frozen: Movement | undefined;

function Deck() {
  const flow = useWardFlow();
  useEffect(() => {
    held.api = flow;
  });
  const live = flow.movements.find((row) => row.id === JOURNEY_ID)!;
  return <PatientTransitOperations movement={frozen ?? live} showMetrics={false} bare />;
}

function journey(): Movement {
  return held.api!.movements.find((row) => row.id === JOURNEY_ID)!;
}

function setLevel(observation: Observation) {
  const movement = journey();
  act(() => {
    held.api!.dispatch({
      type: "RECORD_OBSERVATION_LEVEL",
      role: "coordinator",
      now: held.api!.now,
      target: { kind: "movement", movementId: movement.id },
      observation,
      expected: observationEditingToken(
        "movement",
        movement.id,
        movement.observation,
        movement.observationChanges?.length ?? 0,
      ),
    });
  });
}

function renderWithLevelNotRecorded() {
  frozen = undefined;
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <Deck />
      </ToastProvider>
    </WardFlowProvider>,
  );
  setLevel({ ...NOT_RECORDED_OBSERVATION });
  expect(journey().observation.level).toBe("not_recorded");
}

const pullButton = () => screen.getByRole("button", { name: /Pull the bed/u });
const levelChip = (name: string) =>
  within(screen.getByRole("group", { name: "Observation level" })).getByRole("button", { name });

describe("D-188: the patient page's Pull the bed asks for a level first", () => {
  it("asks with nothing chosen, and pulls nothing until a level is chosen", () => {
    renderWithLevelNotRecorded();
    expect(screen.getByTestId("ward-transit-pull-level-hint")).toHaveTextContent("No observation level is recorded");
    expect(screen.getByTestId("ward-transit-pull-level")).toHaveAttribute("data-value", "");
    expect(screen.getByRole("group", { name: "Observation level" }).querySelector("[aria-pressed='true']")).toBeNull();
    const changes = journey().observationChanges?.length;
    fireEvent.click(pullButton());
    expect(screen.getByTestId("ward-transit-pull-level-failure")).toHaveTextContent("Choose an observation level");
    expect(journey().stage).toBe("accepted_awaiting_bed");
    expect(journey().observationChanges?.length).toBe(changes);
  });

  it("refuses Intermittent with no interval chosen, recording nothing, then pulls once one is chosen", () => {
    renderWithLevelNotRecorded();
    fireEvent.click(levelChip("Intermittent"));
    expect(screen.getByTestId("ward-transit-pull-interval")).toHaveAttribute("data-value", "");
    fireEvent.click(pullButton());
    expect(screen.getByTestId("ward-transit-pull-level-failure")).toHaveTextContent(NO_INTERVAL_ERROR);
    expect(journey().observation.level).toBe("not_recorded");
    expect(journey().stage).toBe("accepted_awaiting_bed");
    // Once an interval is chosen, the level is recorded with it and the bed is pulled.
    const minutes = INTERMITTENT_INTERVAL_MINUTES[0]!;
    fireEvent.click(
      within(screen.getByRole("group", { name: "Check every" })).getByRole("button", {
        name: `Every ${minutes} minutes`,
      }),
    );
    fireEvent.click(pullButton());
    expect(journey().observation).toMatchObject({ level: "intermittent", intervalMinutes: minutes });
    expect(journey().stage).toBe("pulled");
  });

  it("records the chosen level, then pulls the bed carrying it", () => {
    renderWithLevelNotRecorded();
    fireEvent.click(levelChip("General"));
    fireEvent.click(pullButton());
    const pulled = journey();
    expect(pulled.observation.level).toBe("general");
    expect(pulled.observationChanges?.at(-1)?.to.level).toBe("general");
    expect(pulled.stage).toBe("pulled");
    // The pull copied the recorded level, so the record came first.
    const stay = held.api!.admissions.find(({ id }) => id === pulled.admissionId);
    expect(stay?.observation.level).toBe("general");
    expect(screen.queryByTestId("ward-transit-pull-level")).toBeNull();
  });

  it("a refused record pulls nothing and says so", () => {
    renderWithLevelNotRecorded();
    // The screen still shows the journey as it was; a colleague changes the level and clears it again,
    // so the editing token the screen sends is stale and the record is refused.
    frozen = journey();
    setLevel(observationAt("general"));
    setLevel({ ...NOT_RECORDED_OBSERVATION });
    fireEvent.click(levelChip("General"));
    fireEvent.click(pullButton());
    expect(screen.getByTestId("ward-transit-pull-level-failure")).toHaveTextContent("The bed is not pulled.");
    expect(journey().observation.level).toBe("not_recorded");
    expect(journey().stage).toBe("accepted_awaiting_bed");
    frozen = undefined;
  });

  it("an engine refusal for no level offers no override reason, since a reason cannot answer it", () => {
    frozen = undefined;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Deck />
        </ToastProvider>
      </WardFlowProvider>,
    );
    // The screen still shows the level as recorded; meanwhile it was cleared, so the engine refuses.
    frozen = journey();
    setLevel({ ...NOT_RECORDED_OBSERVATION });
    fireEvent.click(pullButton());
    expect(journey().stage).toBe("accepted_awaiting_bed");
    expect(held.api!.rejections.at(-1)?.reason).toBe(PULL_NEEDS_OBSERVATION_LEVEL);
    expect(screen.queryByText("Record why this is going ahead anyway")).toBeNull();
    frozen = undefined;
  });

  it("a journey with a level recorded pulls at once, with no ask", () => {
    frozen = undefined;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Deck />
        </ToastProvider>
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-transit-pull-level")).toBeNull();
    fireEvent.click(pullButton());
    expect(journey().stage).toBe("pulled");
  });
});
