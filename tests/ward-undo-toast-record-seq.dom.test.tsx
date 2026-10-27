import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/wf";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { UndoRecord } from "@/components/ward-management/ward-undo";

// H-0246 (26 Oct 2026), toast half: a referral decision or bed move toast sends its record's number
// with Undo, so the engine refuses it once a later decision or move replaced that record.
// Synthetic records only.
const decision = {
  kind: "referral-decision",
  action: "ACCEPT_REFERRAL",
  referralId: "RF-990",
  at: 642,
  role: "coordinator",
  unitId: null,
  noticeIds: [],
  seq: 7,
} as unknown as UndoRecord;
const placement = {
  kind: "bed-placement",
  admissionId: "AD-990",
  unitId: "ward-test",
  at: 642,
  role: "coordinator",
  beforeBed: null,
  afterBed: 4,
  seq: 9,
} as unknown as UndoRecord;

function Page({
  dispatch,
  undo,
}: {
  dispatch: (event: WardFlowEvent) => Promise<WardCommandOutcome>;
  undo: (now: number) => WardFlowEvent;
}) {
  const { run } = useUndoableStep({ dispatch, now: 642, routeRole: "coordinator", rejections: [] });
  const step = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as const;
  return <button onClick={() => run(step, { success: "Done", undo })}>Record</button>;
}

describe("H-0246: decision and bed move toasts send their record number", () => {
  it.each([
    [
      "UNDO_REFERRAL_DECISION",
      decision,
      (now: number): WardFlowEvent => ({
        type: "UNDO_REFERRAL_DECISION",
        role: "coordinator",
        now,
        referralId: "RF-990",
      }),
      7,
    ],
    [
      "UNDO_PLACE_IN_BED",
      placement,
      (now: number): WardFlowEvent => ({ type: "UNDO_PLACE_IN_BED", role: "coordinator", now, admissionId: "AD-990" }),
      9,
    ],
  ] as const)("%s carries recordSeq", async (_type, record, undo, seq) => {
    const dispatch = vi
      .fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>()
      .mockResolvedValueOnce({ commandId: "step", status: "accepted", undoRecords: [record] })
      .mockResolvedValueOnce({ commandId: "undo", status: "accepted" });
    render(
      <ToastProvider>
        <Page dispatch={dispatch} undo={undo} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Record"));
    });
    await act(async () => {
      fireEvent.click(within(screen.getByTestId("toast")).getByRole("button", { name: "Undo" }));
    });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[1]![0]).toMatchObject({ type: _type, recordSeq: seq });
  });
});
