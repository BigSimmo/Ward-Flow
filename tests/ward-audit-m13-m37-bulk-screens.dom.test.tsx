// M13, M37 and M114 (master audit list, 10 Nov 2026): the screen half of the actions that send
// several saves (the list of flows is at the top of tests/ward-audit-m13-m37-multi-save-flows.test.ts).
// With the middle save refused or left unconfirmed, the person must see who was done and who was
// not, and an unconfirmed save must never read as done. Synthetic data only.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/wf";
import { WardDecisionsCockpit } from "@/components/ward-management/ward/ward-decisions-cockpit";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import type { Unit } from "@/components/ward-management/ward-model";

const unit = {
  id: "rph-adult-secure",
  name: "Ward 2K (Adult Acute)",
  beds: 24,
  gender: "mixed",
  security: "secure",
  service: "adult",
} as unknown as Unit;

type Report = (recorded?: boolean, undo?: (report: Report) => void) => void;

function threeReady(answers: [boolean | undefined, boolean | undefined, boolean | undefined]) {
  return (["One", "Two", "Three"] as const).map((word, index) => ({
    id: `r${index + 1}`,
    title: `SYNTHETIC, ${word} (bed not recorded)`,
    identity: `UM00000${index + 1} · born 0${index + 1}/02/1990`,
    badge: "Ready" as const,
    onConfirm: vi.fn((report?: Report) => report?.(answers[index])),
  }));
}

function signOffAll(departures: ReturnType<typeof threeReady>) {
  fireEvent.click(screen.getByRole("button", { name: "Sign off 3" }));
  const dialog = screen.getByTestId("ward-decisions-bulk-sign-off-confirm");
  // M37: the confirm lists each person with their UMRN before anything is sent.
  const listed = within(dialog).getAllByRole("listitem");
  expect(listed).toHaveLength(3);
  departures.forEach((row, index) => {
    expect(listed[index]).toHaveTextContent(row.title.replace(" (bed not recorded)", ""));
    expect(listed[index]).toHaveTextContent(row.identity.split(" · ")[0]!);
  });
  departures.forEach((row) => expect(row.onConfirm).not.toHaveBeenCalled());
  fireEvent.click(within(dialog).getByRole("button", { name: "Sign off 3" }));
}

describe("M13/M37: Ward Decisions Sign off N with the middle save refused or unconfirmed", () => {
  it("names who was signed off and who was not when the middle save is refused", () => {
    const departures = threeReady([true, false, true]);
    render(<WardDecisionsCockpit unit={unit} departures={departures} />);
    signOffAll(departures);
    departures.forEach((row) => expect(row.onConfirm).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 of 3 signed off: SYNTHETIC, One; SYNTHETIC, Three. Not recorded, nothing changed for SYNTHETIC, Two.",
    );
    // A refusal stays until it is closed (CT-09).
    expect(screen.getByRole("button", { name: "Close message" })).toBeInTheDocument();
  });

  it("never counts an unconfirmed middle save as done (M114)", () => {
    // The middle save gives no answer and its row still offers Sign off: it is not done.
    const departures = threeReady([true, undefined, true]);
    const view = render(<WardDecisionsCockpit unit={unit} departures={departures} />);
    signOffAll(departures);
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 of 3 signed off: SYNTHETIC, One; SYNTHETIC, Three. Not recorded, nothing changed for SYNTHETIC, Two.",
    );
    // Once the shared board reads the middle row back as signed off, and only then, it is done.
    view.rerender(
      <WardDecisionsCockpit
        unit={unit}
        departures={departures.map((row) =>
          row.id === "r2" ? { ...row, badge: "Done" as const, onConfirm: undefined } : row,
        )}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "3 discharges signed off: SYNTHETIC, One; SYNTHETIC, Two; SYNTHETIC, Three",
    );
  });

  it("says all three were signed off only when every save answers yes", () => {
    const departures = threeReady([true, true, true]);
    render(<WardDecisionsCockpit unit={unit} departures={departures} />);
    signOffAll(departures);
    expect(screen.getByRole("status")).toHaveTextContent(
      "3 discharges signed off: SYNTHETIC, One; SYNTHETIC, Two; SYNTHETIC, Three",
    );
  });
});

describe("M37 (D-129): Sign off N offers a short Undo", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Each row signs off and hands back an Undo whose answer is `undoAnswers[index]`. */
  function undoable(undoAnswers: [boolean, boolean, boolean]) {
    return (["One", "Two", "Three"] as const).map((word, index) => {
      const undo = vi.fn((report: Report) => report(undoAnswers[index]));
      return {
        undo,
        row: {
          id: `r${index + 1}`,
          title: `SYNTHETIC, ${word} (bed not recorded)`,
          identity: `UM00000${index + 1} · born 0${index + 1}/02/1990`,
          badge: "Ready" as const,
          onConfirm: vi.fn((report?: Report) => report?.(true, undo)),
        },
      };
    });
  }

  it("takes every sign-off back from one Undo and says so", () => {
    const rows = undoable([true, true, true]);
    render(<WardDecisionsCockpit unit={unit} departures={rows.map((entry) => entry.row)} />);
    signOffAll(rows.map((entry) => entry.row));
    fireEvent.click(
      screen.getByRole("button", { name: "Undo sign off for SYNTHETIC, One; SYNTHETIC, Two; SYNTHETIC, Three" }),
    );
    rows.forEach((entry) => expect(entry.undo).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sign off undone for SYNTHETIC, One; SYNTHETIC, Two; SYNTHETIC, Three",
    );
  });

  it("names the one a colleague changed since, which stays signed off", () => {
    const rows = undoable([true, false, true]);
    render(<WardDecisionsCockpit unit={unit} departures={rows.map((entry) => entry.row)} />);
    signOffAll(rows.map((entry) => entry.row));
    fireEvent.click(screen.getByRole("button", { name: /^Undo sign off for/ }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sign off undone for SYNTHETIC, One; SYNTHETIC, Three. Not undone, nothing changed for SYNTHETIC, Two.",
    );
    expect(screen.getByRole("button", { name: "Close message" })).toBeInTheDocument();
  });

  it("offers Undo only for the sign-offs recorded, and only for a short time", () => {
    const departures = threeReady([true, false, true]).map((row) => ({
      ...row,
      onConfirm: vi.fn((report?: Report) => report?.(row.id !== "r2", row.id !== "r2" ? vi.fn() : undefined)),
    }));
    render(<WardDecisionsCockpit unit={unit} departures={departures} />);
    signOffAll(departures);
    expect(screen.getByRole("button", { name: "Undo sign off for SYNTHETIC, One; SYNTHETIC, Three" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS + 1));
    expect(screen.queryByRole("button", { name: /^Undo sign off/ })).toBeNull();
    // The refusal message itself stays until it is closed (CT-09).
    expect(screen.getByRole("status")).toHaveTextContent("Not recorded, nothing changed for SYNTHETIC, Two.");
  });
});

describe("M13/M37/M114: Tasks drawer Acknowledge visible with saves refused after the Undo window", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const seed = seedWardFlowState();
  const items = buildActionInbox(seed.movements.filter(isOpen), NOW_ANCHOR, seed.units);

  it("puts the rows back when the saves are not recorded (the screen reverts)", () => {
    // The engine refuses every acknowledgement: nothing reaches `acknowledgements`.
    const dispatch = vi.fn<(event: { type: string }) => { commandId: string; status: "refused"; message: string }>(
      () => ({ commandId: "synthetic", status: "refused", message: "Refused (synthetic)" }),
    );
    render(
      <ToastProvider>
        <WardTasksDrawer
          alertsScreenOpen={false}
          items={items}
          acknowledgements={{}}
          completions={{}}
          role="coordinator"
          now={NOW_ANCHOR}
          dispatch={dispatch}
          onClose={vi.fn()}
          onSelectMovement={vi.fn()}
        />
      </ToastProvider>,
    );
    const button = screen.getByRole("button", { name: /^Acknowledge visible/ });
    const n = Number(button.textContent?.match(/(\d+)\s*$/)?.[1]);
    expect(n).toBeGreaterThan(1);
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${n}` }));
    // While held in the Undo window the rows read as acknowledged.
    expect(screen.getByText(`${n} alerts acknowledged.`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Acknowledge visible/ })).toBeNull();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS + 1000));
    expect(dispatch.mock.calls.filter(([event]) => event.type === "ACKNOWLEDGE_INBOX_ITEM")).toHaveLength(n);
    // Nothing was recorded, so every row is offered again.
    expect(screen.getByRole("button", { name: /^Acknowledge visible/ })).toHaveTextContent(String(n));
  });

  const records = {
    movements: seed.movements,
    admissions: seed.admissions,
    patients: seed.patients,
    referrals: seed.referrals,
    units: seed.units,
  };

  type Answer = { commandId: string; status: "accepted" | "refused" | "failed"; message?: string };
  function renderWithRecords(answer: (index: number) => Answer) {
    let call = 0;
    const dispatch = vi.fn<(event: { type: string }) => Answer>(() => answer(call++));
    render(
      <ToastProvider>
        <WardTasksDrawer
          alertsScreenOpen={false}
          items={items}
          acknowledgements={{}}
          completions={{}}
          role="coordinator"
          now={NOW_ANCHOR}
          dispatch={dispatch}
          onClose={vi.fn()}
          onSelectMovement={vi.fn()}
          records={records}
        />
      </ToastProvider>,
    );
    const button = screen.getByRole("button", { name: /^Acknowledge visible/ });
    const n = Number(button.textContent?.match(/(\d+)\s*$/)?.[1]);
    expect(n).toBeGreaterThan(2);
    fireEvent.click(button);
    return { dispatch, n };
  }

  /** The person each offered alert names, in the order the drawer sends them. */
  function offeredPeople(dispatch: ReturnType<typeof renderWithRecords>["dispatch"]) {
    return dispatch.mock.calls.map(([event]) => {
      const item = items.find((row) => row.id === (event as unknown as { inboxItemId: string }).inboxItemId)!;
      const movement = seed.movements.find((row) => row.id === item.movementId);
      return { item, patient: movement ? resolveSubjectPatient(movement, records) : undefined };
    });
  }

  it("lists each patient with their UMRN in the Acknowledge visible confirm (M37)", () => {
    const { dispatch, n } = renderWithRecords(() => ({ commandId: "synthetic", status: "accepted" }));
    const dialog = screen.getByTestId("tasks-acknowledge-visible-confirm");
    const listed = within(dialog).getAllByRole("listitem");
    expect(listed).toHaveLength(n);
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: `Acknowledge ${n}` }));
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS + 1000));
    const people = offeredPeople(dispatch);
    expect(people.filter((entry) => entry.patient?.patient).length).toBeGreaterThan(0);
    people.forEach(({ item, patient }, index) => {
      expect(listed[index]).toHaveTextContent(item.title);
      if (patient?.patient) {
        expect(listed[index]).toHaveTextContent(patient.formalName);
        expect(listed[index]).toHaveTextContent(patient.umrn);
      }
    });
  });

  it("says N of M acknowledged and names each alert not acknowledged when the middle save is refused (M13/M114)", async () => {
    const { dispatch, n } = renderWithRecords((index) =>
      index === 1
        ? { commandId: "synthetic", status: "refused", message: "Refused (synthetic)" }
        : index === 2
          ? { commandId: "synthetic", status: "failed", message: "Not confirmed (synthetic)" }
          : { commandId: "synthetic", status: "accepted" },
    );
    fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${n}` }));
    // Inside the Undo window nothing is saved, and the toast says so.
    expect(screen.getByText("Nothing is saved until the Undo time ends and each save is confirmed.")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(UNDO_TOAST_MS + 1000);
    });
    // Let every save's answer arrive.
    await act(async () => {});
    const people = offeredPeople(dispatch);
    const named = ({ item, patient }: (typeof people)[number]) =>
      patient?.patient ? `${patient.formalName} (${item.title})` : item.title;
    const report = screen.getByText(new RegExp(`^${n - 2} of ${n} acknowledged:`));
    expect(report).toHaveTextContent(`Not recorded, nothing changed for ${named(people[1]!)}.`);
    expect(report).toHaveTextContent(`Not confirmed for ${named(people[2]!)}. Check before acknowledging again.`);
    expect(report.textContent).not.toContain(`acknowledged: ${named(people[1]!)}`);
  });

  it("says all were acknowledged only once every save is confirmed", async () => {
    const { n } = renderWithRecords(() => ({ commandId: "synthetic", status: "accepted" }));
    fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${n}` }));
    expect(screen.queryByText(`${n} alerts acknowledged and saved.`)).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(UNDO_TOAST_MS + 1000);
    });
    // Let every save's answer arrive.
    await act(async () => {});
    expect(screen.getByText(`${n} alerts acknowledged and saved.`)).toBeTruthy();
  });
});
