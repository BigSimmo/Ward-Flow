// F2 (frontend audit, 5 Nov 2026): a legal form's written or start time cannot be later than now,
// and its typed expiry must come after it. The engine refuses both, and the Patient page
// continuation form shows the same message before sending. MHA 2014 fields, so these block.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MovementWorkflowActions } from "@/components/ward-management/movements/movement-workflow-actions";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { typeDate } from "./helpers/type-date-time";

const NOW = NOW_ANCHOR;

function openMovementId(state: WardFlowState): string {
  return state.movements.find((m) => !m.closure && !m.expectFlag)!.id;
}

function written(state: WardFlowState, writtenAt: number, paperExpiresAt?: number) {
  return wardFlowReducer(state, {
    type: "RECORD_LEGAL_FORM_WRITTEN",
    role: "coordinator",
    now: NOW,
    movementId: openMovementId(state),
    formCode: "1A",
    writtenAt,
    ...(paperExpiresAt === undefined ? {} : { paperExpiresAt }),
  });
}

function continuation(state: WardFlowState, startedAt: number, paperExpiresAt?: number) {
  return wardFlowReducer(state, {
    type: "RECORD_LEGAL_FORM_CONTINUATION",
    role: "coordinator",
    now: NOW,
    movementId: openMovementId(state),
    formCode: "3A",
    startedAt,
    ...(paperExpiresAt === undefined ? {} : { paperExpiresAt }),
  });
}

describe("engine: legal form time order", () => {
  it("refuses a written time later than now and an expiry not after it", () => {
    const state = seedWardFlowState();
    const later = written(state, NOW + 10 * 60);
    expect(later.movements).toBe(state.movements);
    expect(later.rejections.at(-1)?.reason).toBe("The time written cannot be later than now.");
    const backwards = written(state, NOW - 60, NOW - 120);
    expect(backwards.movements).toBe(state.movements);
    expect(backwards.rejections.at(-1)?.reason).toBe("The expiry must be later than the time written.");
    expect(written(state, NOW - 60, NOW - 60).rejections.at(-1)?.reason).toBe(
      "The expiry must be later than the time written.",
    );
  });

  it("refuses a continuation starting later than now or ending before its start", () => {
    const state = seedWardFlowState();
    const later = continuation(state, NOW + 50 * 60);
    expect(later.movements).toBe(state.movements);
    expect(later.rejections.at(-1)?.reason).toBe("The time written cannot be later than now.");
    const backwards = continuation(state, NOW - 60, NOW - 24 * 60);
    expect(backwards.movements).toBe(state.movements);
    expect(backwards.rejections.at(-1)?.reason).toBe("The expiry must be later than the time written.");
  });

  it("still records times in order, including a written time equal to now", () => {
    const state = seedWardFlowState();
    expect(written(state, NOW, NOW + 72 * 60).rejections).toEqual(state.rejections);
    expect(continuation(state, NOW - 60, NOW + 24 * 60).rejections).toEqual(state.rejections);
  });
});

describe("Patient page continuation form: time order", () => {
  function setUp() {
    const state = seedWardFlowState();
    const id = openMovementId(state);
    function PaperWorkspace() {
      const { movements, dayZero } = useWardFlow();
      const current = movements.find((x) => x.id === id)!;
      // Perth wall time (UTC+8, no daylight saving), as the form reads what is typed.
      const stamp = (minutes: number) =>
        new Date(dayZero.getTime() + minutes * 60_000 + 8 * 3_600_000).toISOString().slice(0, 16);
      return (
        <>
          <output data-testid="later">{stamp(NOW + 120)}</output>
          <output data-testid="earlier">{stamp(NOW - 120)}</output>
          <output data-testid="earliest">{stamp(NOW - 240)}</output>
          <output data-testid="form-code">{current.legalForm?.code ?? ""}</output>
          <MovementWorkflowActions movement={current} />
        </>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW}>
        <PaperWorkspace />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Continuation form" }), { target: { value: "3A" } });
    return { before: screen.getByTestId("form-code").textContent };
  }

  it("shows the message and records nothing for a written time later than now", () => {
    const { before } = setUp();
    typeDate(screen.getByLabelText("Form written date and time"), screen.getByTestId("later").textContent!);
    fireEvent.click(screen.getByRole("button", { name: "Record legal form continuation" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The time written cannot be later than now.");
    expect(screen.getByTestId("form-code")).toHaveTextContent(before ?? "");
  });

  it("shows the message and records nothing for an expiry before the written time", () => {
    const { before } = setUp();
    typeDate(screen.getByLabelText("Form written date and time"), screen.getByTestId("earlier").textContent!);
    typeDate(screen.getByLabelText("Expiry written on paper"), screen.getByTestId("earliest").textContent!);
    fireEvent.click(screen.getByRole("button", { name: "Record legal form continuation" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The expiry must be later than the time written.");
    expect(screen.getByTestId("form-code")).toHaveTextContent(before ?? "");
  });
});
