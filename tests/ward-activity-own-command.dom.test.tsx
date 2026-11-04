import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityOwnCommand } from "@/components/ward-management/coordinator/activity-own-command";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

const testState = vi.hoisted(() => ({
  now: 21,
  workingRole: "ward",
  undoRecords: [
    {
      kind: "step",
      undoType: "UNDO_BED_STEP",
      subjectId: "bed:synthetic-ward:4",
      seq: 7,
      at: 20,
      role: "ward",
      unitId: "synthetic-ward",
      action: "SET_BED_CLOSED",
      changes: [],
    },
  ],
  movements: [],
  referrals: [],
  admissions: [],
  dispatch: vi.fn(),
}));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useWardFlowClock: () => testState.now,
  useWardFlowSelect: () => testState,
}));
vi.mock("@/components/ward-management/shell/ward-access-store", () => ({
  useEffectiveWardAccess: () => ({ role: testState.workingRole, scope: { kind: "ward", unitIds: ["synthetic-ward"] } }),
}));
vi.mock("@/components/ward-management/use-ward-nav-counts", () => ({
  useWardNavCounts: () => ({ role: "ward", placeId: "synthetic-ward" }),
}));
const commandId = "11111111-1111-4111-8111-111111111111";
const receipt = {
  outcome: "accepted",
  commandRevision: 5,
  undoStep: { undoType: "UNDO_BED_STEP", subjectId: "bed:synthetic-ward:4", seq: 7 },
};
function show(read = vi.fn().mockResolvedValue(receipt)) {
  render(
    <SharedAccessContext
      value={{ api: { readOwnCommand: read } as unknown as SharedAccessApi, actorId: "synthetic", scopeKey: "desk" }}
    >
      <ActivityOwnCommand commandId={commandId} />
    </SharedAccessContext>,
  );
  return read;
}

describe("reviewing an own Activity command", () => {
  beforeEach(() => {
    testState.now = 21;
    testState.workingRole = "ward";
    testState.undoRecords[0]!.role = "ward";
    testState.dispatch.mockReset();
  });
  it("reads only on Review, then says Undone only after this inverse is accepted", async () => {
    const read = show();
    expect(read).not.toHaveBeenCalled();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Review your change" }));
    expect(read).toHaveBeenCalledWith(commandId);
    let settle!: (value: WardCommandOutcome) => void;
    testState.dispatch.mockReturnValue(
      new Promise<WardCommandOutcome>((resolve) => {
        settle = resolve;
      }),
    );
    await user.click(await screen.findByRole("button", { name: "Undo this change" }));
    expect(testState.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "UNDO_BED_STEP", recordSeq: 7 }));
    expect(screen.queryByText("Undone. The shared board confirmed the change.")).toBeNull();
    expect(screen.getByRole("button", { name: "Undo this change" })).toBeDisabled();
    await act(async () => {
      settle({ commandId: "inverse", status: "accepted" });
    });
    expect(screen.getByText("Undone. The shared board confirmed the change.")).toBeInTheDocument();
  });
  it("uses the current working role when the coordinator reviews a change from a ward page", async () => {
    testState.workingRole = "coordinator";
    testState.undoRecords[0]!.role = "coordinator";
    testState.dispatch.mockResolvedValue({ commandId: "inverse", status: "accepted" });
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Review your change" }));
    await user.click(await screen.findByRole("button", { name: "Undo this change" }));
    expect(testState.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ role: "coordinator", type: "UNDO_BED_STEP" }),
    );
    expect(testState.dispatch.mock.calls[0]![0]).not.toHaveProperty("actingUnitId");
  });
  it("does not offer a clinical inverse to an access administrator", async () => {
    testState.workingRole = "admin";
    show();
    await userEvent.click(screen.getByRole("button", { name: "Review your change" }));
    await screen.findByText("Your change was recorded.");
    expect(screen.queryByRole("button", { name: "Undo this change" })).toBeNull();
    expect(testState.dispatch).not.toHaveBeenCalled();
  });
  it("has no Undo for an expired, missing or unattributable receipt", async () => {
    show(vi.fn().mockResolvedValue(null));
    await userEvent.click(screen.getByRole("button", { name: "Review your change" }));
    expect(await screen.findByText(/No receipt is available/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo this change" })).toBeNull();
  });
  it("keeps an uncertain inverse honest", async () => {
    show();
    testState.dispatch.mockResolvedValue({ commandId: "inverse", status: "failed" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Review your change" }));
    await user.click(await screen.findByRole("button", { name: "Undo this change" }));
    expect(await screen.findByText(/Undo is not confirmed/)).toBeInTheDocument();
    expect(screen.queryByText("Undone. The shared board confirmed the change.")).toBeNull();
  });
});
