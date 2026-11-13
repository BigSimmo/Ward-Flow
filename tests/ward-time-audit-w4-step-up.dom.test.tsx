// Time audit C7 (13 Nov 2026): the local demo's step-up confirm lasts a set window on the demo
// clock. Reset sends that clock back and starts a new world, so a confirm made before it no longer
// counts: before, `now - at` went negative there and read as still inside the window.
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { forgetStepUp, useStepUp } from "@/components/ward-management/shell/ward-step-up";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function Guarded() {
  const { guard, dialog } = useStepUp();
  const { dispatch, now } = useWardFlow();
  const [runs, setRuns] = useState(0);
  return (
    <>
      <button type="button" onClick={() => void guard(async () => (setRuns((count) => count + 1), null))}>
        Powerful step
      </button>
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 5 })}>
        Advance
      </button>
      <button type="button" onClick={() => dispatch({ type: "RESET_SCENARIO", role: "demo", now })}>
        Reset
      </button>
      <output data-testid="runs">{runs}</output>
      {dialog}
    </>
  );
}

afterEach(() => {
  cleanup();
  forgetStepUp();
});

async function step() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Powerful step" }));
  });
}

it("asks again after Reset, though Reset sent the demo clock back past the confirm", async () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Guarded />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Advance" }));
  await step();
  await act(async () => {
    fireEvent.click(
      within(await screen.findByTestId("ward-step-up")).getByRole("button", { name: "Confirm and carry on" }),
    );
  });
  expect(screen.getByTestId("runs")).toHaveTextContent("1");

  // Within the window on the same world, a second step runs without asking.
  await step();
  expect(screen.queryByTestId("ward-step-up")).not.toBeInTheDocument();
  expect(screen.getByTestId("runs")).toHaveTextContent("2");

  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  await step();
  expect(await screen.findByTestId("ward-step-up")).toBeInTheDocument();
  expect(screen.getByTestId("runs")).toHaveTextContent("2");
});
