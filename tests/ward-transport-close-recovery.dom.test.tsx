import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmHost } from "@/components/wf";
import { renderEdTransportDialog } from "@/components/ward-management/ed/ed-screen-transport-dialog";
import { useEdRowPanels } from "@/components/ward-management/ed/use-ed-screen-state";
import type { EdScreenContext } from "@/components/ward-management/ed/ed-screen-context";
import type { EdBoardRowModel } from "@/components/ward-management/ed/ed-screen-board-row";
import { CommunityScreenTransportBookDialog } from "@/components/ward-management/community/community-screen-transport-dialogs";
import { useCommunityScreenTransport } from "@/components/ward-management/community/use-community-screen-overlays";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const state = seedWardFlowState();
const movement = state.movements.find((candidate) => candidate.stage === "pulled" && !candidate.transport)!;
const other: typeof movement = { ...movement, id: "WF-OTHER-SYNTHETIC" };

function deferred() {
  let resolve!: (answer: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function EdHarness({ dispatch }: { dispatch: WardCommandDispatch }) {
  const panels = useEdRowPanels();
  const [chosen, setChosen] = useState(movement);
  const row = {
    movement: chosen,
    patientInfo: resolveSubjectPatient(chosen, state),
    transportOpen: panels.transportOpenFor === chosen.id,
    transportBlocked: undefined,
  } as EdBoardRowModel;
  const ctx = {
    ...panels,
    now: NOW_ANCHOR,
    submitBookTransport: (_id, booking, save) =>
      save(
        () => dispatch({ type: "BOOK_TRANSPORT", role: "ed", now: NOW_ANCHOR, movementId: chosen.id, ...booking }),
        panels.closeTransportDialog,
      ),
  } as EdScreenContext;
  return (
    <>
      <ConfirmHost />
      <button onClick={() => panels.toggleBookTransport(chosen.id)}>Open booking</button>
      <button
        onClick={() => {
          setChosen(other);
          panels.toggleBookTransport(other.id);
        }}
      >
        Open other booking
      </button>
      {renderEdTransportDialog(row, ctx)}
    </>
  );
}

function CommunityHarness({ dispatch }: { dispatch: WardCommandDispatch }) {
  const transport = useCommunityScreenTransport({
    raise: wardRaise(dispatch, "community", NOW_ANCHOR),
    teamId: "synthetic-team",
    now: NOW_ANCHOR,
  });
  const view = {
    ...transport,
    now: NOW_ANCHOR,
    movements: [movement, other],
    umrnLookup: state,
  } as unknown as CommunityScreenView;
  return (
    <>
      <ConfirmHost />
      <button onClick={() => transport.openTransportBook(movement.id)}>Open booking</button>
      <button onClick={() => transport.openTransportBook(other.id)}>Open other booking</button>
      <CommunityScreenTransportBookDialog view={view} />
    </>
  );
}

function field(prefix: "ed" | "community", part: string, id = movement.id) {
  return screen.getByTestId(`ward-${prefix}-${part}-${id}`);
}

function answerBooking(prefix: "ed" | "community") {
  fireEvent.change(field(prefix, "transport-provider"), { target: { value: "Ambulance (St John)" } });
  fireEvent.change(field(prefix, prefix === "ed" ? "transport-cad-number" : "transport-cad"), {
    target: { value: "CAD-48213" },
  });
  fireEvent.change(field(prefix, "transport-estimated-time"), { target: { value: "11:15" } });
  fireEvent.click(field(prefix, "transport-estimated-day-today"));
  fireEvent.click(field(prefix, "transport-escort-no"));
  fireEvent.click(
    field(prefix, prefix === "ed" ? "transport-legal-status-involuntary" : "transport-legal-involuntary"),
  );
}

describe.each(["ed", "community"] as const)("%s transport answers survive close attempts", (prefix) => {
  const Harness = prefix === "ed" ? EdHarness : CommunityHarness;
  const dialogId = (id = movement.id) =>
    prefix === "ed" ? `ward-ed-book-transport-${id}` : `ward-community-book-transport-dialog-${id}`;
  const cadPart = prefix === "ed" ? "transport-cad-number" : "transport-cad";

  it("keeps edited answers on Escape unless discard is explicitly chosen", async () => {
    render(<Harness dispatch={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open booking" }));
    fireEvent.change(field(prefix, cadPart), { target: { value: "CAD-48213" } });
    fireEvent.keyDown(field(prefix, cadPart), { key: "Escape" });
    const question = await screen.findByTestId("wf-confirm-dialog");
    expect(screen.getByTestId(dialogId())).toBeInTheDocument();
    fireEvent.click(within(question).getByRole("button", { name: "Keep editing" }));
    await act(async () => {});
    expect(field(prefix, cadPart)).toHaveValue("CAD-48213");
    fireEvent.keyDown(field(prefix, cadPart), { key: "Escape" });
    fireEvent.click(
      within(await screen.findByTestId("wf-confirm-dialog")).getByRole("button", { name: "Discard answers" }),
    );
    await act(async () => {});
    expect(screen.queryByTestId(dialogId())).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open booking" }));
    expect(field(prefix, cadPart)).toHaveValue("");
  });

  it("cannot dismiss an in-flight save, and a refusal keeps answers for correction", async () => {
    const pending = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => pending.promise);
    render(<Harness dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Open booking" }));
    answerBooking(prefix);
    fireEvent.click(field(prefix, "book-transport-confirm"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByTestId(dialogId()), { key: "Escape" });
    expect(screen.getByTestId(dialogId())).toBeInTheDocument();
    expect(screen.queryByTestId("wf-confirm-dialog")).toBeNull();
    await act(async () =>
      pending.resolve({ commandId: "synthetic-booking", status: "refused", message: "Synthetic refusal" }),
    );
    expect(field(prefix, cadPart)).toHaveValue("CAD-48213");
    fireEvent.keyDown(field(prefix, cadPart), { key: "Escape" });
    const question = await screen.findByTestId("wf-confirm-dialog");
    fireEvent.click(within(question).getByRole("button", { name: "Keep editing" }));
    await act(async () => {});
    expect(field(prefix, cadPart)).toHaveValue("CAD-48213");
  });

  it("closes an accepted save without asking to discard and starts another patient's form blank", async () => {
    const dispatch = vi.fn<WardCommandDispatch>(() => ({ commandId: "synthetic-booking", status: "accepted" }));
    render(<Harness dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Open booking" }));
    answerBooking(prefix);
    fireEvent.click(field(prefix, "book-transport-confirm"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    await act(async () => {});
    expect(screen.queryByTestId(dialogId())).toBeNull();
    expect(screen.queryByTestId("wf-confirm-dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open other booking" }));
    expect(field(prefix, cadPart, other.id)).toHaveValue("");
  });

  it("leaves an untouched booking without a discard question", async () => {
    render(<Harness dispatch={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open booking" }));
    fireEvent.keyDown(screen.getByTestId(dialogId()), { key: "Escape" });
    await act(async () => {});
    expect(screen.queryByTestId(dialogId())).toBeNull();
    expect(screen.queryByTestId("wf-confirm-dialog")).toBeNull();
  });

  it("warns on an unload while entered answers have not been recorded", () => {
    render(<Harness dispatch={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open booking" }));
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(field(prefix, cadPart), { target: { value: "CAD-48213" } });
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("keeps an uncertain attempt until its original Retry confirms acceptance", async () => {
    const confirmation = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => ({
      commandId: "synthetic-booking",
      status: "failed",
      message: "Synthetic save not confirmed",
      confirmation: confirmation.promise,
    }));
    render(<Harness dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Open booking" }));
    answerBooking(prefix);
    fireEvent.click(field(prefix, "book-transport-confirm"));
    expect(screen.getByTestId(dialogId())).toHaveTextContent("Synthetic save not confirmed");
    fireEvent.keyDown(screen.getByTestId(dialogId()), { key: "Escape" });
    // Once the held save's error shows, closing asks first; keeping the answers keeps the attempt.
    fireEvent.click(
      within(await screen.findByTestId("wf-confirm-dialog")).getByRole("button", { name: "Keep editing" }),
    );
    await act(async () => {});
    expect(screen.getByTestId(dialogId())).toBeInTheDocument();
    expect(field(prefix, cadPart)).toHaveValue("CAD-48213");
    expect(dispatch).toHaveBeenCalledTimes(1);
    await act(async () => confirmation.resolve({ commandId: "synthetic-booking", status: "accepted" }));
    expect(screen.queryByTestId(dialogId())).toBeNull();
  });

  it("lets a booking held offline close after its error shows, still asking before discarding answers", async () => {
    const confirmation = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => ({
      commandId: "synthetic-booking",
      status: "failed",
      message: "Synthetic save not confirmed",
      confirmation: confirmation.promise,
    }));
    render(<Harness dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Open booking" }));
    answerBooking(prefix);
    fireEvent.click(field(prefix, "book-transport-confirm"));
    expect(screen.getByTestId(dialogId())).toHaveTextContent("Synthetic save not confirmed");
    // Submission stays locked to the held command.
    fireEvent.click(field(prefix, "book-transport-confirm"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(
      within(screen.getByTestId(dialogId())).getByRole("button", { name: prefix === "ed" ? "Close" : "Close dialog" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(field(prefix, cadPart), { key: "Escape" });
    const question = await screen.findByTestId("wf-confirm-dialog");
    expect(screen.getByTestId(dialogId())).toBeInTheDocument();
    fireEvent.click(within(question).getByRole("button", { name: "Discard answers" }));
    await act(async () => {});
    expect(screen.queryByTestId(dialogId())).toBeNull();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("does not apply an older discard answer to another booking", async () => {
    render(<Harness dispatch={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open booking" }));
    fireEvent.change(field(prefix, cadPart), { target: { value: "CAD-48213" } });
    fireEvent.keyDown(field(prefix, cadPart), { key: "Escape" });
    const question = await screen.findByTestId("wf-confirm-dialog");
    // Represent a parent/external record replacement while the asynchronous question is open.
    fireEvent.click(screen.getByText("Open other booking", { selector: "button" }));
    fireEvent.click(within(question).getByRole("button", { name: "Discard answers" }));
    await act(async () => {});
    expect(screen.getByTestId(dialogId(other.id))).toBeInTheDocument();
    expect(field(prefix, cadPart, other.id)).toHaveValue("");
  });
});
