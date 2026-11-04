import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const seededMovement = seed.movements.find((entry) => entry.id === "WF-001");
if (!seededMovement) throw new Error("Synthetic movement fixture is missing");
function missingEdOrigin(): never {
  throw new Error("Synthetic movement fixture needs an ED origin");
}
const edId = seededMovement.originEdId ?? missingEdOrigin();
const movement = { ...seededMovement, examination: { at: NOW_ANCHOR - 1, outcome: "inpatient_order" as const } };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup(dispatch: WardCommandDispatch) {
  function Boundary({ children }: { children: ReactNode }) {
    const state = useWardFlow();
    const movements = state.movements.map((entry) => (entry.id === movement.id ? movement : entry));
    return <WardFlowOverride value={{ ...state, movements, dispatch }}>{children}</WardFlowOverride>;
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Boundary>
        <EdScreen edId={edId} />
      </Boundary>
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId(`ed-refer-cmht-${movement.id}`));
  const team = screen.getByTestId(`ward-ed-cmht-select-${movement.id}`) as HTMLSelectElement;
  expect(team.options.length).toBeGreaterThan(1);
  const chosenTeam = team.options[1]!.value;
  fireEvent.change(team, { target: { value: chosenTeam } });
  fireEvent.click(screen.getByTestId(`ward-ed-cmht-purpose-follow_up-${movement.id}`));
  return { team, chosenTeam, button: screen.getByTestId(`ward-ed-cmht-confirm-${movement.id}`) };
}

it("keeps the community referral answers and panel when recording is refused", async () => {
  const answer = deferred<WardCommandOutcome>();
  const dispatch = vi.fn<WardCommandDispatch>(() => answer.promise);
  const h = setup(dispatch);
  fireEvent.click(h.button);
  expect(h.team).toBeInTheDocument();
  expect(h.team).toHaveValue(h.chosenTeam);
  await act(async () =>
    answer.resolve({ commandId: "synthetic-community", status: "refused", message: "Synthetic refusal" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Synthetic refusal");
  expect(h.team).toHaveValue(h.chosenTeam);
});

it("waits for matching late acceptance before clearing the panel and cannot send twice", async () => {
  const confirmation = deferred<WardCommandOutcome>();
  const dispatch = vi.fn<WardCommandDispatch>(() => ({
    commandId: "synthetic-community",
    status: "failed",
    confirmation: confirmation.promise,
  }));
  const h = setup(dispatch);
  fireEvent.click(h.button);
  expect(h.team).toBeInTheDocument();
  fireEvent.click(h.button);
  expect(dispatch).toHaveBeenCalledTimes(1);
  await act(async () =>
    confirmation.resolve({ commandId: "synthetic-community", status: "accepted", isCurrent: () => true }),
  );
  expect(screen.queryByTestId(`ward-ed-cmht-panel-${movement.id}`)).not.toBeInTheDocument();
});
