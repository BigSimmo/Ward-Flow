import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MeetingActionsDue } from "@/components/ward-management/bed-meeting/meeting-actions-due";
import type { BedMeetingSubject } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/movements/x" }));

const subjects: BedMeetingSubject[] = [
  { kind: "movement", id: "WF-009" },
  { kind: "admission", id: seedWardFlowState().admissions[0]!.id },
];

function RecordActions({ subject, multiple }: { subject: BedMeetingSubject; multiple: boolean }) {
  const { dispatch } = useWardFlowSelect("dispatch");
  return (
    <button
      onClick={() => {
        for (const action of multiple ? (["book_transport", "chase_ndis"] as const) : (["book_transport"] as const)) {
          dispatch({
            type: "RECORD_BED_MEETING_ACTION",
            role: "coordinator",
            now: NOW_ANCHOR,
            subject,
            action,
            owner: "ed",
            dueAt: NOW_ANCHOR + 240,
          });
        }
      }}
    >
      Prepare actions
    </button>
  );
}

function setup(subject: BedMeetingSubject, multiple = false) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <RecordActions subject={subject} multiple={multiple} />
      <MeetingActionsDue subject={subject} />
      <button>Continue record</button>
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Prepare actions" }));
}

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("bed meeting action keyboard handover", () => {
  for (const subject of subjects) {
    for (const key of ["{Enter}", " "]) {
      it(`keeps focus beside the ${subject.kind} record after its final action completes with ${key}`, async () => {
        const user = userEvent.setup();
        setup(subject);
        const done = await screen.findByRole("button", { name: "Mark done: Book transport" });
        done.focus();
        await user.keyboard(key);

        expect(screen.queryByTestId("meeting-actions-due")).not.toBeInTheDocument();
        expect(screen.getByRole("group", { name: "Bed meeting actions" })).toHaveFocus();
        expect(document.activeElement).toHaveTextContent("No bed meeting actions are waiting.");
        expect(screen.getByText("No bed meeting actions are waiting.")).toBeVisible();
        await user.tab();
        expect(screen.getByRole("button", { name: "Continue record" })).toHaveFocus();
      });
    }
  }

  it("focuses the next action when another action is still open", async () => {
    const user = userEvent.setup();
    setup(subjects[0]!, true);
    const first = await screen.findByRole("button", { name: "Mark done: Book transport" });
    first.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "Mark done: Chase NDIS" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Continue record" })).toHaveFocus();
  });
});
