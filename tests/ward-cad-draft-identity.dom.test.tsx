import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-events";

const capture = vi.hoisted(() => ({ raise: vi.fn() }));
vi.mock("@/components/ward-management/ward-flow-raise", () => ({ useWardRaise: () => capture.raise }));

import { TransportCadToFollow } from "@/components/ward-management/transport/transport-cad-to-follow";

const A = "WF-SYNTHETIC-A";
const B = "WF-SYNTHETIC-B";
const CAD_A = "CAD-SYN-4410";
const CAD_B = "CAD-SYN-5520";
const form = (movementId: string, role: WardFlowRole = "officer", actingUnitId?: string) => (
  <TransportCadToFollow
    movementId={movementId}
    transportId={`transport-${movementId}`}
    role={role}
    actingUnitId={actingUnitId}
    testId="cad-draft"
  />
);
const input = () => screen.getByTestId("cad-draft-input");
const save = () => screen.getByTestId("cad-draft-save");
const type = (value: string) => fireEvent.change(input(), { target: { value } });

beforeEach(() => {
  capture.raise.mockReset();
  capture.raise.mockReturnValue({ status: "accepted", commandId: "synthetic-command" } satisfies WardCommandOutcome);
});
afterEach(cleanup);

describe("CAD drafts belong to their movement", () => {
  it("keeps each movement's draft separate and clears only the movement whose save is accepted", () => {
    const view = render(form(A));
    type(CAD_A);
    view.rerender(form(B));
    expect(input()).toHaveValue("");
    expect(save()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(save());
    expect(capture.raise).not.toHaveBeenCalled();

    type(CAD_B);
    view.rerender(form(A));
    expect(input()).toHaveValue(CAD_A);
    view.rerender(form(B));
    expect(input()).toHaveValue(CAD_B);
    fireEvent.click(save());
    expect(capture.raise).toHaveBeenCalledExactlyOnceWith("RECORD_TRANSPORT_CAD", {
      movementId: B,
      cadNumber: CAD_B,
    });
    expect(input()).toHaveValue("");
    view.rerender(form(A));
    expect(input()).toHaveValue(CAD_A);
  });

  it("keeps a refused draft and warning on their own movement", () => {
    capture.raise.mockReturnValue({ status: "refused", commandId: "synthetic-refusal", message: "Review this job." });
    const view = render(form(A));
    type(CAD_A);
    fireEvent.click(save());
    expect(input()).toHaveValue(CAD_A);
    expect(screen.getByRole("alert")).toHaveTextContent("Not recorded: Review this job.");

    view.rerender(form(B));
    expect(input()).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
    view.rerender(form(A));
    expect(input()).toHaveValue(CAD_A);
    expect(save()).not.toHaveAttribute("aria-disabled", "true");
  });

  it("retains the pending save lock and ignores its accepted answer after switching movements", async () => {
    let finish!: (outcome: WardCommandOutcome) => void;
    capture.raise.mockReturnValue(new Promise<WardCommandOutcome>((resolve) => (finish = resolve)));
    const view = render(form(A));
    type(CAD_A);
    fireEvent.click(save());
    expect(input()).toHaveValue(CAD_A);
    expect(input()).toBeDisabled();
    view.rerender(form(B));
    expect(input()).toHaveValue("");
    expect(input()).not.toBeDisabled();
    fireEvent.click(save());
    expect(capture.raise).toHaveBeenCalledTimes(1);

    await act(async () => finish({ status: "accepted", commandId: "synthetic-pending" }));
    expect(input()).toHaveValue("");
    expect(input()).not.toBeDisabled();
    type(CAD_B);
    view.rerender(form(A));
    expect(input()).toHaveValue(CAD_A);
    view.rerender(form(B));
    expect(input()).toHaveValue(CAD_B);
  });

  it("does not let A's later same-command confirmation clear B's newer draft", async () => {
    let confirm!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((resolve) => (confirm = resolve));
    capture.raise.mockReturnValue({
      status: "failed",
      commandId: "synthetic-uncertain",
      message: "Save not confirmed.",
      confirmation,
    } satisfies WardCommandOutcome);
    const view = render(form(A));
    type(CAD_A);
    fireEvent.click(save());
    expect(input()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Save not confirmed.");

    view.rerender(form(B));
    expect(input()).toHaveValue("");
    expect(input()).not.toBeDisabled();
    type(CAD_B);
    await act(async () => confirm({ status: "accepted", commandId: "synthetic-uncertain" }));
    expect(input()).toHaveValue(CAD_B);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(capture.raise).toHaveBeenCalledTimes(1);
  });

  it("keeps drafts separate when the desk role or acting ward changes", () => {
    const view = render(form(A, "ward", "synthetic-ward-a"));
    type(CAD_A);
    view.rerender(form(A, "ward", "synthetic-ward-b"));
    expect(input()).toHaveValue("");
    type(CAD_B);
    view.rerender(form(A, "coordinator", "synthetic-ward-b"));
    expect(input()).toHaveValue("");
    view.rerender(form(A, "ward", "synthetic-ward-a"));
    expect(input()).toHaveValue(CAD_A);
    view.rerender(form(A, "ward", "synthetic-ward-b"));
    expect(input()).toHaveValue(CAD_B);
    fireEvent.click(save());
    expect(capture.raise).toHaveBeenCalledExactlyOnceWith("RECORD_TRANSPORT_CAD", {
      movementId: A,
      cadNumber: CAD_B,
      actingUnitId: "synthetic-ward-b",
    });
  });

  it("keeps the same-command lock when returning to A and permits a new edit only after confirmation", async () => {
    let confirm!: (outcome: WardCommandOutcome) => void;
    capture.raise.mockReturnValue({
      status: "failed",
      commandId: "synthetic-earlier-opening",
      confirmation: new Promise<WardCommandOutcome>((resolve) => (confirm = resolve)),
    } satisfies WardCommandOutcome);
    const view = render(form(A));
    type(CAD_A);
    fireEvent.click(save());
    view.rerender(form(B));
    expect(input()).toHaveValue("");
    view.rerender(form(A));
    expect(input()).toHaveValue(CAD_A);
    expect(input()).toBeDisabled();
    fireEvent.click(save());
    expect(capture.raise).toHaveBeenCalledTimes(1);
    await act(async () => confirm({ status: "accepted", commandId: "synthetic-earlier-opening" }));
    expect(input()).not.toBeDisabled();
    expect(input()).toHaveValue(CAD_A);
    type(CAD_B);
    expect(input()).toHaveValue(CAD_B);
    expect(capture.raise).toHaveBeenCalledTimes(1);
  });
});
