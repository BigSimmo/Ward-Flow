// Audit 1 (#1564): wrong-patient binding on every action. Each patient action is tied to the
// patient captured when its step opened, not to whatever is selected or first in a list when the
// confirm is pressed. Each test opens the action for patient A, then reorders the underlying lists
// and, where the screen allows it, selects someone else, then confirms and checks the change names
// patient A. Synthetic seed data only.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import type { BedMeetingSubject } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { MeetingActionsDue } from "@/components/ward-management/bed-meeting/meeting-actions-due";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { bedIsOccupied, LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  WardFlowOverride,
  WardFlowProvider,
  useWardFlow,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { getBedStep } from "./helpers/ward-bed-steps";

afterEach(() => cleanup());

type Flow = ReturnType<typeof useWardFlow>;

/** Set by the mounted wrapper: reverses every patient-bearing list the screen reads. */
const reorder = { lists: () => {} };

function reversedLists(value: Pick<Flow, "admissions" | "movements" | "patients" | "referrals">) {
  return {
    admissions: [...value.admissions].reverse(),
    movements: [...value.movements].reverse(),
    patients: [...value.patients].reverse(),
    referrals: [...value.referrals].reverse(),
  };
}

/** The real provider underneath; records what the screen sends and can reorder its lists. */
function Recorder({
  events,
  departures,
  children,
}: {
  events: WardFlowEvent[];
  departures?: string[];
  children: ReactNode;
}) {
  const flow = useWardFlow();
  const [reversed, setReversed] = useState(false);
  useEffect(() => {
    reorder.lists = () => setReversed(true);
  });
  const dispatch: WardCommandDispatch = (event) => {
    events.push(event);
    return flow.dispatch(event);
  };
  const recordWardDeparture: Flow["recordWardDeparture"] = (admissionId, ...rest) => {
    departures?.push(admissionId);
    return flow.recordWardDeparture(admissionId, ...rest);
  };
  const value = { ...flow, ...(reversed ? reversedLists(flow) : {}), dispatch, recordWardDeparture };
  return <WardFlowOverride value={value}>{children}</WardFlowOverride>;
}

/** A test-held world (the seed with a fixture tweak), run through the real reducer; can reorder. */
function StateHarness({
  initial,
  events,
  children,
}: {
  initial: WardFlowState;
  events: WardFlowEvent[];
  children: ReactNode;
}) {
  const context = useWardFlow();
  const [state, setState] = useState(initial);
  const [reversed, setReversed] = useState(false);
  useEffect(() => {
    reorder.lists = () => setReversed(true);
  });
  const dispatch = (event: WardFlowEvent) => {
    events.push(event);
    setState((current) => wardFlowReducer(current, event));
    return undefined;
  };
  const shown = reversed ? { ...state, ...reversedLists(state) } : state;
  return <WardFlowOverride value={{ ...context, ...shown, dispatch } as typeof context}>{children}</WardFlowOverride>;
}

describe("a bed move stays with the person picked up (Audit 1, #1564)", () => {
  const UNIT = "fsh-adult-secure";

  /** A ward whose stays have recorded beds, with a free open bed after them. */
  function world() {
    const state = seedWardFlowState();
    const unit = state.units.find((row) => row.id === UNIT)!;
    const occupiedLocked = unit.lockedBeds - unit.allocatableLocked;
    const current = state.admissions.filter((row) => row.unitId === UNIT && bedIsOccupied(row));
    current.forEach((row, index) => {
      row.bedKind = index < occupiedLocked ? "locked" : "open";
      row.bedNumber = index < occupiedLocked ? index + 1 : unit.lockedBeds + 1 + index - occupiedLocked;
    });
    const openStays = current.filter((row) => row.bedKind === "open" && row.state === "occupied");
    expect(openStays.length, "the ward has at least two people in open beds").toBeGreaterThan(1);
    return {
      state,
      moving: openStays[0]!,
      freeOpenBed: Math.max(...current.map((row) => row.bedNumber!)) + 1,
    };
  }

  it("moves patient A after the lists reorder, and the confirm names them with their bed", () => {
    const { state, moving, freeOpenBed } = world();
    const events: WardFlowEvent[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <StateHarness initial={state} events={events}>
            <WardScreen unitId={UNIT} />
          </StateHarness>
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-open-bed-board"));
    fireEvent.click(screen.getByTestId(`ward-board-bed-${moving.bedNumber}`));
    fireEvent.click(getBedStep("Move to another bed"));
    fireEvent.click(screen.getByTestId(`ward-board-bed-${freeOpenBed}`));

    // The confirm names the person and the bed they are in, not the name alone.
    const confirm = screen.getByTestId("ward-board-confirm");
    const fromBed = String(moving.bedNumber).padStart(2, "0");
    expect(confirm).toHaveTextContent(new RegExp(`^Move .+ from bed ${fromBed} to bed `));

    act(() => reorder.lists());
    fireEvent.click(screen.getByTestId("ward-board-confirm-send"));

    const moves = events.filter((event) => event.type === "PLACE_IN_BED");
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ admissionId: moving.id, bedNumber: freeOpenBed });
  });
});

describe("a discharge stays with the person whose confirm opened (Audit 1, #1564)", () => {
  /** Each occupied tile's button, with the stay it stands for (the tile key is the admission id). */
  function occupiedStays() {
    return within(screen.getByTestId("ward-board-beds"))
      .getAllByRole("listitem")
      .filter((tile) => tile.getAttribute("data-bed-kind") === "occupied")
      .map((tile) => {
        const button = within(tile).getByRole("button");
        return { button, admissionId: button.id.replace(/^ward-board-tile-/u, "") };
      });
  }

  /** Reads the provider's own state, outside the recorder: the stays that have left. */
  function DepartedProbe() {
    const { admissions } = useWardFlow();
    return (
      <span data-testid="model-departed">
        {admissions
          .filter((admission) => admission.state === "departed")
          .map((admission) => admission.id)
          .join(" ")}
      </span>
    );
  }

  it("records patient A's departure after another bed is selected and the lists reorder", () => {
    const seed = seedWardFlowState();
    const unitId = seed.admissions.find((admission) => admission.state === "occupied")!.unitId;
    const events: WardFlowEvent[] = [];
    const departures: string[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Recorder events={events} departures={departures}>
            <WardBoard unitId={unitId} />
          </Recorder>
          <DepartedProbe />
        </ToastProvider>
      </WardFlowProvider>,
    );

    const [a, b] = occupiedStays();
    expect(b, "the ward shows at least two occupied beds").toBeDefined();
    expect(seed.admissions.some((admission) => admission.id === a!.admissionId)).toBe(true);
    fireEvent.click(a!.button);
    fireEvent.click(screen.getByTestId("ward-board-record-leaving-submit"));

    const confirm = () => document.getElementById("ward-board-confirm-dialog")!;
    const who = confirm().querySelector("#confirm-dialog-description strong")?.textContent ?? "";
    expect(who).not.toBe("");
    // DA-08: a second identifier (record number, and bed where recorded) beside the name.
    const identity = within(confirm()).getByTestId("ward-board-confirm-identity").textContent ?? "";
    expect(identity).toMatch(/^Check: .*\d{4,}/u);

    // Select a different person behind the dialog, then reorder every list.
    fireEvent.click(occupiedStays().find((stay) => stay.admissionId === b!.admissionId)!.button);
    act(() => reorder.lists());

    expect(confirm().querySelector("#confirm-dialog-description strong")).toHaveTextContent(who);
    expect(within(confirm()).getByTestId("ward-board-confirm-identity")).toHaveTextContent(identity);
    fireEvent.change(within(confirm()).getByTestId("ward-board-confirm-destination"), {
      target: { value: LEAVING_DESTINATIONS[0]!.id },
    });
    fireEvent.click(within(confirm()).getByTestId("ward-board-confirm-proceed"));

    // The departure was sent for A, and the model shows A left and B still in their bed.
    expect(departures).toEqual([a!.admissionId]);
    const departed = (screen.getByTestId("model-departed").textContent ?? "").split(" ");
    expect(departed).toContain(a!.admissionId);
    expect(departed).not.toContain(b!.admissionId);
  });
});

describe("a referral accept stays with the person whose dialog opened (Audit 1, #1564)", () => {
  const WARD = unitById("gry-older-adult")!;
  const TARGET = "WF-013";

  it("accepts patient A in principle after the lists reorder", async () => {
    // The seed sends this ward one request; a second (a later movement, so the reorder puts it
    // first) makes "the first one in the list" a different person from A.
    const state = seedWardFlowState();
    const other = state.movements.find((movement) => movement.id === "WF-022")!;
    expect(state.movements.indexOf(other)).toBeGreaterThan(state.movements.findIndex((m) => m.id === TARGET));
    other.referredUnitIds = [...other.referredUnitIds, WARD.id];
    const events: WardFlowEvent[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StateHarness initial={state} events={events}>
          <WardScreen unitId={WARD.id} />
        </StateHarness>
      </WardFlowProvider>,
    );
    expect(await screen.findByTestId("ward-accept-WF-022")).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId(`ward-accept-${TARGET}`));
    const dialog = screen.getByTestId("ward-accept-dialog");
    const name = dialog.querySelector("#ward-answer-allocating-movement strong")?.textContent ?? "";
    expect(name).toMatch(/^[^,]+, [^,]+$/u);

    act(() => reorder.lists());

    const stillOpen = screen.getByTestId("ward-accept-dialog");
    expect(stillOpen.querySelector("#ward-answer-allocating-movement strong")).toHaveTextContent(name);
    fireEvent.click(within(stillOpen).getAllByRole("radio")[0]!);
    await act(async () => {
      fireEvent.click(within(stillOpen).getByRole("button", { name: "Confirm acceptance" }));
      await Promise.resolve();
    });

    const accepts = events.filter((event) => event.type === "ACCEPT_IN_PRINCIPLE");
    expect(accepts).toHaveLength(1);
    expect(accepts[0]).toMatchObject({ movementId: TARGET, unitId: WARD.id });
  });

  // Josh approved 9 Nov 2026: the dialog shows the UMRN beside the name (no bed is allocated here).
  it("the accept-in-principle dialog shows the patient's UMRN beside the name", async () => {
    const state = seedWardFlowState();
    const { umrn } = resolveSubjectPatient(
      state.movements.find((movement) => movement.id === TARGET)!,
      state,
    );
    expect(umrn).toMatch(/\S/u);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={WARD.id} />
      </WardFlowProvider>,
    );
    fireEvent.click(await screen.findByTestId(`ward-accept-${TARGET}`));
    const patient = screen.getByTestId("ward-accept-dialog").querySelector("#ward-answer-allocating-movement")!;
    expect(patient.querySelector("strong")).toHaveTextContent(/^[^,]+, [^,]+$/u);
    expect(patient).toHaveTextContent(umrn);
  });
});

describe("a bed meeting task marked done stays with its own patient (Audit 1, #1564)", () => {
  afterEach(() => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", null);
      resetWardAccessStoreForTests();
    });
  });

  /** The chair records the same action on two people, as the agenda does. Set-up only. */
  function RecordOnBoth({ subjects }: { subjects: readonly BedMeetingSubject[] }) {
    const { dispatch } = useWardFlowSelect("dispatch");
    return (
      <button
        type="button"
        data-testid="record-both"
        onClick={() =>
          subjects.forEach((subject) =>
            dispatch({
              type: "RECORD_BED_MEETING_ACTION",
              role: "coordinator",
              now: NOW_ANCHOR,
              subject,
              action: "book_transport",
              owner: "ed",
              dueAt: NOW_ANCHOR + 240,
            }),
          )
        }
      />
    );
  }

  it("completes patient A's action after the lists reorder, and not patient B's", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
    });
    const seed = seedWardFlowState();
    const a: BedMeetingSubject = { kind: "movement", id: "WF-009" };
    // B is last in the list, so the reorder puts B first.
    const b: BedMeetingSubject = { kind: "movement", id: seed.movements.at(-1)!.id };
    expect(b.id).not.toBe(a.id);
    const events: WardFlowEvent[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Recorder events={events}>
            <RecordOnBoth subjects={[b, a]} />
            <MeetingActionsDue subject={a} />
          </Recorder>
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("record-both"));
    expect(events.filter((event) => event.type === "RECORD_BED_MEETING_ACTION")).toHaveLength(2);
    const markDone = await screen.findByRole("button", { name: "Mark done: Book transport" });
    // Josh approved 9 Nov 2026: the card names whose actions these are, name and UMRN (no confirm).
    const line = (subject: BedMeetingSubject) =>
      patientIdentityLine(
        resolveSubjectPatient(
          seed.movements.find((movement) => movement.id === subject.id)!,
          seed,
        ),
      );
    expect(line(a)).not.toBe(line(b));
    const card = screen.getByTestId("meeting-actions-due");
    expect(card).toHaveTextContent(line(a));
    expect(card).not.toHaveTextContent(line(b));

    act(() => reorder.lists());
    fireEvent.click(markDone);

    const done = events.filter((event) => event.type === "COMPLETE_BED_MEETING_ACTION");
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ subject: a, action: "book_transport" });
  });
});
