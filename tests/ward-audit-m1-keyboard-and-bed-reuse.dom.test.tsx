// Master audit M1 (10 Nov 2026), parts (a) and (b). Audits 1 and 2 (#1564, #1565) proved that a
// pointer press and an open dialog stay with the patient they were aimed at. This file adds:
//   (a) the same live re-sorts on the ED, Referrals, Ward and Discharges boards, driven by keyboard:
//       focus sits on the patient's control, another desk's update re-sorts the list, then Enter
//       acts on whatever now has focus. Focus must still be on the same patient.
//   (b) a bed vacated and refilled while a confirm is open: the confirm keeps naming the person it
//       opened for, and never acts on the new person now lying in that bed.
// Synthetic seed data only. The refill patient below is invented for this test.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { tileDomId } from "@/components/ward-management/board/ward-board-model";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { bedIsOccupied, LEAVING_DESTINATIONS, type Admission } from "@/components/ward-management/ward-admissions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  WardFlowOverride,
  WardFlowProvider,
  useWardFlow,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Patient } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { getBedStep } from "./helpers/ward-bed-steps";

afterEach(() => cleanup());

// ---------------------------------------------------------------------------------------------
// (a) Keyboard: the same re-sorts as tests/ward-live-resort-target.dom.test.tsx.
// ---------------------------------------------------------------------------------------------

type Adjust = (value: WardFlowContextValue) => WardFlowContextValue;

function Live({ adjust, sent, children }: { adjust: Adjust; sent: WardFlowEvent[]; children: ReactNode }) {
  const value = adjust(useWardFlow());
  const dispatch: WardFlowContextValue["dispatch"] = (event) => {
    sent.push(event);
    return value.dispatch(event);
  };
  return <WardFlowOverride value={{ ...value, dispatch }}>{children}</WardFlowOverride>;
}

function renderLive(ui: ReactNode) {
  const sent: WardFlowEvent[] = [];
  const tree = (adjust: Adjust) => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Live adjust={adjust} sent={sent}>
        {ui}
      </Live>
    </WardFlowProvider>
  );
  const view = render(tree((value) => value));
  const update = (adjust: Adjust) => act(() => view.rerender(tree(adjust)));
  return { sent, update };
}

function attributes(selector: string, attribute: string) {
  return [...document.querySelectorAll(selector)].map((node) => node.getAttribute(attribute)!);
}

/**
 * A keyboard press a live update interrupts: focus the control, the update lands, then Enter goes
 * to whatever holds focus NOW (as a browser sends it), not to the node the test held. A button's
 * Enter is a click in a browser; jsdom does not synthesise that, so the click is sent by hand to
 * the focused element.
 */
function enterThrough(node: HTMLElement, duringFocus: () => void): HTMLElement {
  act(() => node.focus());
  expect(document.activeElement).toBe(node);
  duringFocus();
  const focused = document.activeElement as HTMLElement;
  fireEvent.keyDown(focused, { key: "Enter" });
  fireEvent.keyUp(focused, { key: "Enter" });
  fireEvent.click(focused);
  return focused;
}

describe("ED board: a live re-sort while a row has keyboard focus (M1a)", () => {
  const TARGET = "WF-029";
  const INSERTED = "WF-SYN-LIVE-ED" as const;
  const rows = () => attributes("tr[data-testid^='ward-ed-patient-']", "data-testid");
  const resort: Adjust = (value) => {
    const template = value.movements.find((movement) => movement.id === "WF-306")!;
    const earliest = Math.min(...value.movements.map((movement) => movement.openedAt));
    const inserted = { ...template, id: INSERTED, openedAt: earliest - 30 };
    return { ...value, movements: [inserted, ...[...value.movements].reverse()] };
  };

  it("Enter opens the focused patient's sheet after the rows re-sort", () => {
    const { update } = renderLive(<EdScreen edId="fsh-ed" />);
    const before = rows();
    const name = screen.getByTestId(`ward-ed-row-name-${TARGET}`);

    const focused = enterThrough(name, () => {
      update(resort);
      expect(rows()).not.toEqual(before);
      expect(rows().indexOf(`ward-ed-patient-${INSERTED}`)).toBeLessThan(rows().indexOf(`ward-ed-patient-${TARGET}`));
    });

    expect(focused).toHaveAttribute("data-testid", `ward-ed-row-name-${TARGET}`);
    expect(attributes("tr[data-selected='true']", "data-testid")).toEqual([`ward-ed-patient-${TARGET}`]);
  });

  it("a menu item chosen by keyboard acts on the row whose menu was open when the list re-sorted", () => {
    const { sent, update } = renderLive(<EdScreen edId="fsh-ed" />);
    const unfold = screen.getByTestId(`ward-ed-unfold-${TARGET}`);
    act(() => unfold.focus());
    fireEvent.keyDown(unfold, { key: "Enter" });
    fireEvent.click(unfold);
    const item = screen.getByTestId(`ward-ed-no-transport-needed-${TARGET}`);

    const focused = enterThrough(item, () => {
      update(resort);
      expect(rows().indexOf(`ward-ed-patient-${INSERTED}`)).toBe(0);
    });

    expect(focused).toHaveAttribute("data-testid", `ward-ed-no-transport-needed-${TARGET}`);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "RECORD_TRANSPORT_NEED", movementId: TARGET, needed: false });
  });
});

describe("Referrals board: a live re-sort while a row has keyboard focus (M1a)", () => {
  const TARGET = "RF-005";
  const INSERTED = "RF-SYN-LIVE" as const;
  const queue = () => attributes("tr[data-referral-id]", "data-referral-id");
  const resort: Adjust = (value) => {
    const template = value.referrals.find((referral) => referral.id === "RF-015")!;
    const earliest = Math.min(...value.referrals.map((referral) => referral.raisedAt));
    const inserted = { ...template, id: INSERTED, urgency: 1 as const, raisedAt: earliest - 30 };
    return { ...value, referrals: [inserted, ...[...value.referrals].reverse()] };
  };
  const drawerTitle = () => screen.getByTestId("ward-referral-detail").querySelector("h2")!.textContent;

  it("Enter opens the focused referral after the queue re-sorts", () => {
    const { update } = renderLive(<ReferralBoard />);
    const select = screen.getByTestId(`ward-referral-board-select-${TARGET}`);
    const name = select.textContent!;
    expect(name.length).toBeGreaterThan(0);
    const before = queue();

    const focused = enterThrough(select, () => {
      update(resort);
      expect(queue()).not.toEqual(before);
      expect(queue().indexOf(INSERTED)).toBeLessThan(queue().indexOf(TARGET));
    });

    expect(focused).toHaveAttribute("data-testid", `ward-referral-board-select-${TARGET}`);
    expect(drawerTitle()).toContain(name);
    expect(screen.getByTestId(`ward-referral-inspector-priority-${TARGET}`)).toBeInTheDocument();
  });
});

describe("Ward board: a live re-sort while a bed tile has keyboard focus (M1a)", () => {
  const UNIT = "rph-adult-secure";
  const TARGET = "AD-RPHS-11";
  const INSERTED = "AD-SYN-LIVE" as const;
  const tiles = () => attributes("[data-testid='ward-board-beds'] button[id]", "id");
  const resort: Adjust = (value) => {
    const template = value.admissions.find((admission) => admission.id === "AD-RPHS-15")!;
    const inserted = { ...template, id: INSERTED, arrivedAt: template.arrivedAt! - 60 * 24 * 30 };
    return { ...value, admissions: [inserted, ...[...value.admissions].reverse()] };
  };
  const tileOf = (key: string) => document.getElementById(tileDomId(key))!;

  it("Enter opens the focused person's record after the tiles re-sort, and its toggle acts on them", () => {
    const { sent, update } = renderLive(<WardBoard unitId={UNIT} />);
    const tile = tileOf(TARGET);
    const name = tile.querySelector("span")!.textContent!;
    const before = tiles();

    const focused = enterThrough(tile, () => {
      update(resort);
      expect(tiles()).not.toEqual(before);
      expect(tiles().indexOf(tileDomId(INSERTED))).toBeLessThan(tiles().indexOf(tileDomId(TARGET)));
    });

    expect(focused.id).toBe(tileDomId(TARGET));
    expect(screen.getByTestId("ward-board-detail")).toHaveTextContent(name);

    // A second re-sort while the record's own toggle has focus: Space/Enter still acts on TARGET.
    const toggle = screen.getByTestId("ward-board-stepdown-toggle");
    enterThrough(toggle, () =>
      update((value) => {
        const moved = resort(value);
        return { ...moved, admissions: [...moved.admissions].reverse() };
      }),
    );
    expect(screen.getByTestId("ward-board-detail")).toHaveTextContent(name);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "SET_STEP_DOWN_CANDIDATE", admissionId: TARGET });
  });
});

describe("Discharges board: a live re-sort while a row has keyboard focus (M1a)", () => {
  const INSERTED = "derived-expected-SYN-LIVE" as const;
  const group = () => screen.getByTestId("ward-discharge-group-expected");
  const rows = () =>
    [...group().querySelectorAll("tr[data-release-id]")].map((row) => row.getAttribute("data-release-id")!);
  const rowOf = (id: string) => group().querySelector<HTMLElement>(`tr[data-release-id="${id}"]`)!;
  const resort: Adjust = (value) => {
    const expected = value.bedReleases.filter((release) => release.state === "expected");
    const earliest = Math.min(...expected.map((release) => release.expectedAt));
    const inserted = { ...expected[0]!, id: INSERTED, expectedAt: earliest - 60 };
    return { ...value, bedReleases: [inserted, ...value.bedReleases] };
  };
  const selected = () => attributes("tr[data-release-id][data-selected='true']", "data-release-id");

  it("Enter on the focused name opens that person's release after the rows re-sort", () => {
    const { update } = renderLive(<DischargeBoard />);
    const id = rows()[1]!;
    const name = within(rowOf(id)).getAllByRole("button")[0]!;
    const before = rows();

    const focused = enterThrough(name, () => {
      update(resort);
      expect(rows()).not.toEqual(before);
      expect(rows().indexOf(INSERTED)).toBeLessThan(rows().indexOf(id));
    });

    expect(focused.closest("tr")).toHaveAttribute("data-release-id", id);
    expect(selected()).toEqual([id]);
  });

  it("Enter on a row's own Confirm date opens the right release after a re-sort", () => {
    const { update } = renderLive(<DischargeBoard />);
    const id = rows()[1]!;
    const action = within(rowOf(id)).getByRole("button", { name: "Confirm date" });

    const focused = enterThrough(action, () => {
      update(resort);
      expect(rows()[0]).toBe(INSERTED);
    });

    expect(focused.closest("tr")).toHaveAttribute("data-release-id", id);
    expect(selected()).toEqual([id]);
  });
});

// ---------------------------------------------------------------------------------------------
// (b) A bed vacated and refilled while the confirm for its old occupant is open.
// ---------------------------------------------------------------------------------------------

const REFILL_PATIENT: Patient = {
  id: "PT-SYN-REFILL",
  umrn: "UM990001",
  givenName: "Refill",
  familyName: "Synthetic",
  dateOfBirth: "1980-01-01",
};
const REFILL_ADMISSION_ID = "AD-SYN-REFILL";

/** Another desk's change: A leaves, and a new person is admitted into the same bed. */
function vacateAndRefill(state: WardFlowState, leaving: Admission): WardFlowState {
  const now = NOW_ANCHOR + state.clockOffsetMinutes;
  const refill: Admission = {
    ...leaving,
    id: REFILL_ADMISSION_ID,
    patientId: REFILL_PATIENT.id,
    referralId: null,
    arrivedAt: now,
  };
  return {
    ...state,
    patients: [...state.patients, REFILL_PATIENT],
    admissions: [
      refill,
      ...state.admissions.map((row) =>
        row.id === leaving.id
          ? { ...row, state: "departed" as const, leftAt: now, leavingDestination: LEAVING_DESTINATIONS[0]!.id }
          : row,
      ),
    ],
  };
}

const world: {
  replace: (change: (state: WardFlowState) => WardFlowState) => void;
  current: WardFlowState | undefined;
} = { replace: () => {}, current: undefined };

/** A test-held world run through the real reducer; another desk can replace it mid-dialog. */
function StateHarness({
  initial,
  events,
  departures,
  children,
}: {
  initial: WardFlowState;
  events: WardFlowEvent[];
  departures: string[];
  children: ReactNode;
}) {
  const context = useWardFlow();
  const [state, setState] = useState(initial);
  useEffect(() => {
    world.replace = (change) => setState(change);
    world.current = state;
  });
  const dispatch = (event: WardFlowEvent) => {
    events.push(event);
    setState((current) => wardFlowReducer(current, event));
    return undefined;
  };
  const recordWardDeparture: WardFlowContextValue["recordWardDeparture"] = (admissionId) => {
    departures.push(admissionId);
    return undefined as unknown as ReturnType<WardFlowContextValue["recordWardDeparture"]>;
  };
  return (
    <WardFlowOverride value={{ ...context, ...state, dispatch, recordWardDeparture } as typeof context}>
      {children}
    </WardFlowOverride>
  );
}

const refillName = new RegExp(`${REFILL_PATIENT.familyName}|${REFILL_PATIENT.umrn}`, "u");

describe("a bed vacated and refilled while its confirm is open (M1b)", () => {
  it("a discharge confirm never records the new occupant's departure", () => {
    const seed = seedWardFlowState();
    const leaving = seed.admissions.find((admission) => admission.state === "occupied")!;
    const events: WardFlowEvent[] = [];
    const departures: string[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <StateHarness initial={seed} events={events} departures={departures}>
            <WardBoard unitId={leaving.unitId} />
          </StateHarness>
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(document.getElementById(`ward-board-tile-${leaving.id}`)!);
    fireEvent.click(screen.getByTestId("ward-board-record-leaving-submit"));
    const dialog = () => document.getElementById("ward-board-confirm-dialog");
    const who = dialog()!.querySelector("#confirm-dialog-description strong")?.textContent ?? "";
    const identity = within(dialog()!).getByTestId("ward-board-confirm-identity").textContent ?? "";
    expect(who).not.toBe("");

    act(() => world.replace((state) => vacateAndRefill(state, leaving)));
    expect(
      document.getElementById(`ward-board-tile-${REFILL_ADMISSION_ID}`),
      "the bed now shows the new person",
    ).not.toBeNull();

    // Either the confirm closed because its person left, or it still names the person it opened
    // for. It must never switch to the new occupant.
    if (dialog()) {
      expect(dialog()!.querySelector("#confirm-dialog-description strong")).toHaveTextContent(who);
      expect(within(dialog()!).getByTestId("ward-board-confirm-identity")).toHaveTextContent(identity);
      expect(dialog()).not.toHaveTextContent(refillName);
      fireEvent.change(within(dialog()!).getByTestId("ward-board-confirm-destination"), {
        target: { value: LEAVING_DESTINATIONS[0]!.id },
      });
      const proceed = within(dialog()!).getByTestId("ward-board-confirm-proceed");
      if (!proceed.hasAttribute("disabled")) fireEvent.click(proceed);
    }
    expect(departures).not.toContain(REFILL_ADMISSION_ID);
    expect(departures.every((id) => id === leaving.id)).toBe(true);
  });

  it("a bed move confirm never moves the new occupant", () => {
    const UNIT = "fsh-adult-secure";
    const state = seedWardFlowState();
    const unit = state.units.find((row) => row.id === UNIT)!;
    const occupiedLocked = unit.lockedBeds - unit.allocatableLocked;
    const current = state.admissions.filter((row) => row.unitId === UNIT && bedIsOccupied(row));
    current.forEach((row, index) => {
      row.bedKind = index < occupiedLocked ? "locked" : "open";
      row.bedNumber = index < occupiedLocked ? index + 1 : unit.lockedBeds + 1 + index - occupiedLocked;
    });
    const moving = current.find((row) => row.bedKind === "open" && row.state === "occupied")!;
    const freeOpenBed = Math.max(...current.map((row) => row.bedNumber!)) + 1;
    const events: WardFlowEvent[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <StateHarness initial={state} events={events} departures={[]}>
            <WardScreen unitId={UNIT} />
          </StateHarness>
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-open-bed-board"));
    fireEvent.click(screen.getByTestId(`ward-board-bed-${moving.bedNumber}`));
    fireEvent.click(getBedStep("Move to another bed"));
    fireEvent.click(screen.getByTestId(`ward-board-bed-${freeOpenBed}`));
    const confirmText = screen.getByTestId("ward-board-confirm").textContent ?? "";
    expect(confirmText).toMatch(/^Move .+ from bed /u);

    act(() => world.replace((held) => vacateAndRefill(held, moving)));

    const confirm = screen.queryByTestId("ward-board-confirm");
    if (confirm) {
      expect(confirm).toHaveTextContent(confirmText);
      expect(confirm).not.toHaveTextContent(refillName);
      const send = screen.queryByTestId("ward-board-confirm-send");
      if (send && !send.hasAttribute("disabled")) fireEvent.click(send);
    }
    const moves = events.filter((event) => event.type === "PLACE_IN_BED");
    expect(moves.every((event) => (event as { admissionId: string }).admissionId === moving.id)).toBe(true);
    expect(moves.some((event) => (event as { admissionId: string }).admissionId === REFILL_ADMISSION_ID)).toBe(false);
    // The engine, given the stale move for the person who left, leaves the new occupant in their bed.
    const after = world.current!.admissions;
    expect(after.find((row) => row.id === REFILL_ADMISSION_ID)).toMatchObject({ bedNumber: moving.bedNumber });
    expect(after.find((row) => row.id === moving.id)).toMatchObject({ state: "departed" });
  });
});
