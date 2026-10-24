import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EdMedicalPlacementControls } from "@/components/ward-management/ed/ed-medical-placement-controls";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";

const mocked = vi.hoisted(() => ({ flow: {} as WardFlowContextValue, now: 642, raise: vi.fn() }));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useWardFlowSelect: () => mocked.flow,
  useWardFlowClock: () => mocked.now,
}));
vi.mock("@/components/ward-management/ward-flow-raise", () => ({ useWardRaise: () => mocked.raise }));

function deferred() {
  let resolve!: (outcome: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const state = seedWardFlowState();
const original = state.movements.find((row) => row.stage === "pulled" && !row.transport && !row.sourceAdmissionId)!;
function open() {
  const view = render(<EdMedicalPlacementControls movementId={original.id} actingPlaceId={original.originEdId!} />);
  return { ...view, controls: screen.getByTestId(`ward-ed-medical-placement-${original.id}`) };
}
beforeEach(() => {
  mocked.raise.mockReset();
  mocked.flow = {
    movements: [{ ...original, medicalClearance: { at: mocked.now, cleared: true } }],
    referrals: state.referrals,
    rejections: [],
    eventLog: [],
    worldGeneration: 1,
    shared: { enabled: true, status: "ready", error: null },
  } as unknown as WardFlowContextValue;
});

const paths = [
  {
    kind: "cleared",
    open: "Record medically cleared",
    confirm: "Confirm medically cleared",
    success: "Recorded medically cleared.",
    event: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
  },
  {
    kind: "not_cleared",
    open: "Record not medically cleared",
    confirm: "Confirm not medically cleared",
    success: "Recorded not medically cleared.",
    event: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
  },
  {
    kind: "deterioration",
    open: "Record medical deterioration",
    confirm: "Confirm deterioration and release reservation",
    success: "Allocation cancelled; referral paused",
    event: "RECORD_ED_MEDICAL_DETERIORATION",
  },
] as const;
function confirmPath(controls: HTMLElement, path: (typeof paths)[number] = paths[0]) {
  fireEvent.click(within(controls).getByRole("button", { name: path.open }));
  fireEvent.click(within(controls).getByRole("button", { name: path.confirm }));
}
function redraw(view: ReturnType<typeof open>, id: string = original.id) {
  view.rerender(<EdMedicalPlacementControls movementId={id} actingPlaceId={original.originEdId!} />);
}
function receipt(commandId: string, accepted: boolean, sequence = 1) {
  return {
    commandId,
    accepted,
    sequence,
    type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE" as const,
    role: "ed" as const,
    now: mocked.now,
    movementId: original.id,
  };
}

describe("ED medical save confirmation", () => {
  it("does not announce a repeated same-minute clearance before this command answers", async () => {
    const pending = deferred();
    mocked.raise.mockReturnValue(pending.promise);
    const { controls } = open();
    confirmPath(controls);
    expect(within(controls).getByRole("status")).toHaveTextContent("Saving");
    await act(async () =>
      pending.resolve({ commandId: "medical-save", status: "failed", message: "Save is not confirmed." }),
    );
    expect(within(controls).getByRole("status")).toHaveTextContent("Save is not confirmed.");
    expect(within(controls).getByRole("button", { name: paths[0].confirm })).toBeInTheDocument();
  });

  it.each(paths)("waits for acceptance before closing $kind confirmation", async (path) => {
    const pending = deferred();
    mocked.raise.mockReturnValue(pending.promise);
    const { controls } = open();
    confirmPath(controls, path);
    expect(mocked.raise).toHaveBeenCalledOnce();
    expect(mocked.raise.mock.calls[0]?.[0]).toBe(path.event);
    expect(within(controls).getByRole("button", { name: path.confirm })).toHaveAttribute("aria-disabled", "true");
    expect(within(controls).getByRole("status")).toHaveTextContent("Saving");
    await act(async () => pending.resolve({ commandId: "medical-save", status: "accepted" }));
    expect(within(controls).queryByRole("button", { name: path.confirm })).not.toBeInTheDocument();
    expect(within(controls).getByRole("status")).toHaveTextContent(path.success);
  });

  it.each(paths)("keeps $kind editable after definitive refusal", async (path) => {
    const pending = deferred();
    mocked.raise.mockReturnValue(pending.promise);
    const { controls } = open();
    confirmPath(controls, path);
    await act(async () =>
      pending.resolve({ commandId: "medical-save", status: "refused", message: "Synthetic refusal." }),
    );
    expect(within(controls).getByRole("status")).toHaveTextContent("Synthetic refusal.");
    expect(within(controls).getByRole("button", { name: path.confirm })).not.toHaveAttribute("aria-disabled", "true");
    expect(within(controls).getByRole("button", { name: "Cancel" })).not.toHaveAttribute("aria-disabled", "true");
    mocked.raise.mockReturnValue({ commandId: "corrected-save", status: "accepted" });
    fireEvent.click(within(controls).getByRole("button", { name: path.confirm }));
    expect(mocked.raise).toHaveBeenCalledTimes(2);
    expect(within(controls).getByRole("status")).toHaveTextContent(path.success);
  });

  it("guards repeated confirmation and choice changes while saving or unconfirmed", async () => {
    const pending = deferred();
    mocked.raise.mockReturnValue(pending.promise);
    const { controls } = open();
    confirmPath(controls);
    const confirm = within(controls).getByRole("button", { name: paths[0].confirm });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(within(controls).getByRole("button", { name: paths[1].open }));
    fireEvent.click(within(controls).getByRole("button", { name: "Cancel" }));
    expect(mocked.raise).toHaveBeenCalledOnce();
    expect(confirm).toBeInTheDocument();
    await act(async () => pending.resolve({ commandId: "medical-save", status: "failed" }));
    fireEvent.click(confirm);
    expect(mocked.raise).toHaveBeenCalledOnce();
    expect(confirm).toHaveAttribute("aria-disabled", "true");
  });

  it("settles a failed save only from its same-command Retry acceptance", async () => {
    const pending = deferred();
    mocked.raise.mockReturnValue(pending.promise);
    const view = open();
    confirmPath(view.controls);
    await act(async () => pending.resolve({ commandId: "original-save", status: "failed" }));
    mocked.flow = { ...mocked.flow, eventLog: [receipt("another-save", true)] };
    redraw(view);
    expect(within(view.controls).getByRole("status")).not.toHaveTextContent("Recorded medically cleared.");
    expect(within(view.controls).getByRole("button", { name: paths[0].confirm })).toBeInTheDocument();
    mocked.flow = { ...mocked.flow, eventLog: [...mocked.flow.eventLog!, receipt("original-save", true, 2)] };
    redraw(view);
    expect(mocked.raise).toHaveBeenCalledOnce();
    expect(within(view.controls).queryByRole("button", { name: paths[0].confirm })).not.toBeInTheDocument();
    expect(within(view.controls).getByRole("status")).toHaveTextContent("Recorded medically cleared.");
  });

  it("keeps a refused Retry refused after matching snapshots and later unrelated acceptance", async () => {
    const pending = deferred();
    mocked.raise.mockReturnValue(pending.promise);
    const view = open();
    confirmPath(view.controls);
    await act(async () => pending.resolve({ commandId: "original-save", status: "failed" }));
    mocked.flow = {
      ...mocked.flow,
      shared: { enabled: true, status: "ready", error: "Synthetic refusal." },
      eventLog: [receipt("original-save", false)],
    };
    redraw(view);
    expect(within(view.controls).getByRole("status")).toHaveTextContent("Synthetic refusal.");
    mocked.flow = {
      ...mocked.flow,
      shared: { enabled: true, status: "ready", error: null },
      eventLog: [...mocked.flow.eventLog!, receipt("other-save", true, 2)],
    };
    redraw(view);
    expect(within(view.controls).getByRole("status")).toHaveTextContent("Synthetic refusal.");
    expect(within(view.controls).getByRole("button", { name: paths[0].confirm })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("does not apply an old record's completion to a newer confirmation", async () => {
    const first = deferred(),
      second = deferred();
    mocked.raise.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = open();
    confirmPath(view.controls);
    const other = { ...mocked.flow.movements[0]!, id: "WF-synthetic-other" as const };
    mocked.flow = { ...mocked.flow, movements: [...mocked.flow.movements, other] };
    redraw(view, other.id);
    const controls = screen.getByTestId(`ward-ed-medical-placement-${other.id}`);
    confirmPath(controls, paths[1]);
    expect(mocked.raise).toHaveBeenCalledTimes(2);
    await act(async () => first.resolve({ commandId: "old-save", status: "accepted" }));
    expect(within(controls).getByRole("button", { name: paths[1].confirm })).toBeInTheDocument();
    expect(within(controls).getByRole("status")).toHaveTextContent("Saving");
    await act(async () => second.resolve({ commandId: "new-save", status: "accepted" }));
    expect(within(controls).getByRole("status")).toHaveTextContent(paths[1].success);
  });

  it("does not apply an old world's completion to a new choice", async () => {
    const pending = deferred();
    mocked.raise.mockReturnValue(pending.promise);
    const view = open();
    confirmPath(view.controls);
    mocked.flow = { ...mocked.flow, worldGeneration: 2 };
    redraw(view);
    fireEvent.click(within(view.controls).getByRole("button", { name: paths[1].open }));
    await act(async () => pending.resolve({ commandId: "old-save", status: "accepted" }));
    expect(within(view.controls).getByRole("button", { name: paths[1].confirm })).toBeInTheDocument();
    expect(within(view.controls).queryByRole("status")).not.toBeInTheDocument();
  });

  it("releases waiting without reporting acceptance when the command lifetime ends", async () => {
    const pending = deferred();
    mocked.raise.mockReturnValue(pending.promise);
    const { controls } = open();
    confirmPath(controls);
    await act(async () => pending.resolve({ commandId: "ended-save", status: "accepted", isCurrent: () => false }));
    expect(within(controls).queryByRole("status")).not.toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: paths[0].confirm })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it.each(["throw", "reject"] as const)("retains the choice and error after a dispatch %s", async (failure) => {
    if (failure === "throw")
      mocked.raise.mockImplementation(() => {
        throw new Error("Synthetic dispatch error");
      });
    else mocked.raise.mockRejectedValue(new Error("Synthetic dispatch error"));
    const { controls } = open();
    confirmPath(controls);
    await act(async () => {});
    expect(within(controls).getByRole("status")).toHaveTextContent("Save is not confirmed.");
    expect(within(controls).getByRole("button", { name: paths[0].confirm })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
  it("does not reuse an earlier transport error as a Retry refusal reason", async () => {
    const pending = deferred();
    mocked.raise.mockReturnValue(pending.promise);
    const view = open();
    confirmPath(view.controls);
    await act(async () => pending.resolve({ commandId: "original-save", status: "failed" }));
    mocked.flow = {
      ...mocked.flow,
      shared: { enabled: true, status: "unavailable", error: "Save is not confirmed." },
      eventLog: [receipt("original-save", false)],
    };
    redraw(view);
    expect(within(view.controls).getByRole("status")).toHaveTextContent("Not recorded: The action was not applied.");
    expect(within(view.controls).getByRole("status")).not.toHaveTextContent("Not recorded: Save is not confirmed.");
  });
});
