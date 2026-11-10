// Audit M2 (master audit list): checks at the moment of commit. The server checks the patient's
// state, the bed and the sender's permission when the save arrives, not when the dialog opened.
// Each test opens an allocating or discharging dialog on one board, changes a precondition from a
// second desk that this screen has not heard about (no poll runs), saves, and checks that the save
// is refused, the reason is on screen naming the patient, and the server's world did not change.
// The server is the real engine behind tests/helpers/ward-desk-server.tsx. Synthetic seed only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { bedIsOccupied, LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { selectDischargeRecord } from "@/components/ward-management/ward-discharge-records";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { createDeskServer, openDesk, type DeskServer } from "./helpers/ward-desk-server";
import { getBedStep } from "./helpers/ward-bed-steps";

const clients: { dispose: () => void }[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.dispose();
});

/** Everything but the refusal bookkeeping, so "nothing changed" compares the whole world. */
function worldOf(server: DeskServer) {
  return JSON.stringify({ ...server.world.state, rejections: [] });
}

/** Everything the screen says after a save that was not recorded: toasts, alerts and status lines. */
async function notRecordedSaid() {
  return waitFor(() => {
    const text = [...document.querySelectorAll("[data-testid='toast'], [role='alert'], [role='status']")]
      .map((node) => node.textContent ?? "")
      .filter((words) => /not recorded/iu.test(words))
      .join(" | ");
    expect(text, "the screen says the save was not recorded").not.toBe("");
    return text;
  });
}

/** Each message says "Nothing was changed." once, not twice in a row. */
function expectNoRepeatedNothingChanged(text: string) {
  expect(text).not.toMatch(/Nothing was changed\.\s*Nothing was changed/u);
}

/** Checks `text` names the movement's patient, in either order ("Family, Given" or "Given Family"). */
function expectNamesPatient(text: string, server: DeskServer, movementId: string) {
  const movement = server.world.state.movements.find((row) => row.id === movementId)!;
  const name = patientIdentityLine(resolveSubjectPatient(movement, server.world.state)).split(" · ")[0]!;
  const [family, given] = name.split(", ");
  expect(family && given, `the seed patient for ${movementId} has a name`).toBeTruthy();
  expect(text).toContain(family!);
  expect(text).toContain(given!);
}

/** The shared status bar's words. */
function statusBar() {
  return screen.getByTestId("ward-shared-status-bar").textContent ?? "";
}

async function mount(server: DeskServer, screenNode: ReactNode) {
  const desk = await openDesk(server);
  clients.push(desk.client);
  render(
    <desk.Desk>
      <ToastProvider>{screenNode}</ToastProvider>
    </desk.Desk>,
  );
  return desk;
}

async function save(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}

const BED_UNIT = "fsh-adult-secure";

/** A ward whose stays have recorded beds, with free open beds after them. */
function bedWorld() {
  const state = seedWardFlowState();
  const unit = state.units.find((row) => row.id === BED_UNIT)!;
  const occupiedLocked = unit.lockedBeds - unit.allocatableLocked;
  const current = state.admissions.filter((row) => row.unitId === BED_UNIT && bedIsOccupied(row));
  current.forEach((row, index) => {
    row.bedKind = index < occupiedLocked ? "locked" : "open";
    row.bedNumber = index < occupiedLocked ? index + 1 : unit.lockedBeds + 1 + index - occupiedLocked;
  });
  const openStays = current.filter((row) => row.bedKind === "open" && row.state === "occupied");
  expect(openStays.length, "the ward has at least two people in open beds").toBeGreaterThan(1);
  return {
    state: state as WardFlowState,
    moving: openStays[0]!,
    other: openStays[1]!,
    freeOpenBed: Math.max(...current.map((row) => row.bedNumber!)) + 1,
  };
}

/** Opens the Bed board's move confirm for `moving` into `bed`, and returns the name it shows. */
function openMove(moving: { bedNumber?: number }, bed: number) {
  fireEvent.click(screen.getByTestId("ward-open-bed-board"));
  fireEvent.click(screen.getByTestId(`ward-board-bed-${moving.bedNumber}`));
  fireEvent.click(getBedStep("Move to another bed"));
  fireEvent.click(screen.getByTestId(`ward-board-bed-${bed}`));
  const name = /^Move (.+) from bed/u.exec(screen.getByTestId("ward-board-confirm").textContent ?? "")?.[1] ?? "";
  expect(name).not.toBe("");
  return name;
}

describe("a Bed board move is checked when it is saved (M2)", () => {
  it("refuses a move into a bed another desk filled after the confirm opened", async () => {
    const { state, moving, other, freeOpenBed } = bedWorld();
    const server = createDeskServer({ state });
    await mount(server, <WardScreen unitId={BED_UNIT} />);
    const name = openMove(moving, freeOpenBed);

    server.secondDesk({
      type: "PLACE_IN_BED",
      role: "ward",
      now: 0,
      admissionId: other.id,
      bedNumber: freeOpenBed,
      actingUnitId: BED_UNIT,
    });
    const before = worldOf(server);
    await save(screen.getByTestId("ward-board-confirm-send"));

    await waitFor(() => expect(server.sent).toHaveLength(1));
    const said = await notRecordedSaid();
    expect(said).toMatch(/already taken/u);
    expect(said).toContain(name);
    expectNoRepeatedNothingChanged(said);
    expect(worldOf(server)).toBe(before);
    expect(server.world.state.admissions.find((row) => row.id === moving.id)!.bedNumber).toBe(moving.bedNumber);
  });

  it("refuses placing a coordinator-sent person in a bed another desk filled after the confirm opened", async () => {
    const WARD = "bty-older-adult";
    const TARGET = "WF-013";
    const server = createDeskServer();
    await mount(server, <WardScreen unitId={WARD} />);
    fireEvent.click(screen.getByTestId("ward-open-bed-board"));
    fireEvent.click(screen.getByTestId(`ward-board-pick-${TARGET}`));
    const free = [...document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']")].find((cell) =>
      /, Ready, [^,]+, fits$/u.test(cell.getAttribute("aria-label") ?? ""),
    );
    expect(free, "a free bed fits the person picked up").toBeDefined();
    const bed = Number(free!.dataset.testid!.replace("ward-board-bed-", ""));
    fireEvent.click(free!);
    expect(screen.getByTestId("ward-board-confirm")).toBeInTheDocument();

    // Another desk moves someone already on the ward into that bed.
    const stay = server.world.state.admissions.find((row) => row.unitId === WARD && bedIsOccupied(row))!;
    server.secondDesk({
      type: "PLACE_IN_BED",
      role: "ward",
      now: 0,
      admissionId: stay.id,
      bedNumber: bed,
      actingUnitId: WARD,
    });
    const before = worldOf(server);
    await save(screen.getByTestId("ward-board-confirm-send"));

    await waitFor(() => expect(server.sent).toHaveLength(1));
    const said = await notRecordedSaid();
    expectNamesPatient(said, server, TARGET);
    expectNoRepeatedNothingChanged(said);
    expect(worldOf(server)).toBe(before);
    expect(server.world.state.movements.find((row) => row.id === TARGET)!.acceptedUnitId).toBeUndefined();
  });

  it("refuses a move once the account's role is removed, and changes nothing", async () => {
    const { state, moving, freeOpenBed } = bedWorld();
    const server = createDeskServer({ state });
    const desk = await mount(server, <WardScreen unitId={BED_UNIT} />);
    const name = openMove(moving, freeOpenBed);
    server.revoked = true;
    const before = worldOf(server);
    await save(screen.getByTestId("ward-board-confirm-send"));

    await waitFor(() => expect(server.sent).toHaveLength(1));
    expect(server.applied.size).toBe(0);
    expect(worldOf(server)).toBe(before);
    // The board closes and the desk holds no board; the shared shell asks for access, so no
    // patient is shown, the one in the dialog included.
    await waitFor(() => expect(screen.queryByTestId("ward-open-bed-board")).toBeNull());
    expect(["no-role", "not-authorised"]).toContain(desk.view()?.status);
    expect(desk.view()?.snapshot).toBeNull();
    expect(document.body.textContent).not.toContain(name);
  });
});

describe("a departure is checked when it is saved (M2)", () => {
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

  it("refuses a departure another desk recorded after the confirm opened", async () => {
    const seed = seedWardFlowState();
    const unitId = seed.admissions.find((admission) => admission.state === "occupied")!.unitId;
    const server = createDeskServer({ state: seed });
    await mount(server, <WardBoard unitId={unitId} />);
    const [stay] = occupiedStays();
    fireEvent.click(stay!.button);
    fireEvent.click(screen.getByTestId("ward-board-record-leaving-submit"));
    const confirm = document.getElementById("ward-board-confirm-dialog")!;
    const who = confirm.querySelector("#confirm-dialog-description strong")?.textContent ?? "";
    expect(who).not.toBe("");
    fireEvent.change(within(confirm).getByTestId("ward-board-confirm-destination"), {
      target: { value: LEAVING_DESTINATIONS[0]!.id },
    });

    // Another desk records the same person's departure first.
    const read = selectDischargeRecord(server.world.state, { role: "ward", actingUnitId: unitId }, stay!.admissionId);
    if (read.status !== "allowed" || read.value.identity.kind !== "linked") throw new Error("seed stay is not linked");
    server.secondDesk({
      type: "RECORD_PATIENT_DISCHARGE",
      role: "ward",
      now: 0,
      admissionId: stay!.admissionId,
      actingUnitId: unitId,
      leavingDestination: LEAVING_DESTINATIONS[0]!.id,
      patientId: read.value.identity.patient.id,
      expectedGeneration: server.world.state.worldGeneration,
      expectedRevision: server.world.state.dischargeRevisions[stay!.admissionId] ?? 0,
    });
    const before = worldOf(server);
    await save(within(confirm).getByTestId("ward-board-confirm-proceed"));

    await waitFor(() => expect(server.sent).toHaveLength(1));
    const said = await notRecordedSaid();
    expect(said).toContain(who);
    expectNoRepeatedNothingChanged(said);
    expect(worldOf(server)).toBe(before);
  });
});

describe("accept in principle is checked when it is saved (M2)", () => {
  const WARD = "bty-older-adult";
  const TARGET = "WF-013";

  async function openAccept(server: DeskServer) {
    await mount(server, <WardScreen unitId={WARD} />);
    fireEvent.click(await screen.findByTestId(`ward-accept-${TARGET}`));
    const dialog = screen.getByTestId("ward-accept-dialog");
    const name = dialog.querySelector("#ward-answer-allocating-movement strong")?.textContent ?? "";
    expect(name).not.toBe("");
    fireEvent.click(within(dialog).getAllByRole("radio")[0]!);
    return { confirm: within(dialog).getByRole("button", { name: "Confirm acceptance" }), name };
  }

  it("refuses an acceptance after the coordinator withdrew this ward's request", async () => {
    const server = createDeskServer();
    const { confirm, name } = await openAccept(server);
    server.secondDesk({
      type: "WITHDRAW_WARD_REQUEST",
      role: "coordinator",
      now: 0,
      movementId: TARGET,
      unitId: WARD,
      reason: "needs_changed_ward_no_longer_suits",
    });
    const before = worldOf(server);
    await save(confirm);

    await waitFor(() => expect(server.sent).toHaveLength(1));
    // Said in the shared status bar only, and without the patient's name: see the to-do below.
    // The stand-in answers a clash as postgres.mjs does (code "stale", the record type), so the
    // client names the record type it changed, never the person.
    await waitFor(() =>
      expect(statusBar()).toMatch(
        /Another desk changed this movement while you were looking\. Your action was not applied\./u,
      ),
    );
    expect(name).not.toBe("");
    expect(statusBar()).not.toContain(name);
    expect(worldOf(server)).toBe(before);
    expect(screen.queryByTestId("ward-accept-dialog")).toBeNull();
  });

  it("refuses an acceptance after this desk was moved to another ward", async () => {
    const server = createDeskServer({ access: { role: "ward", scope: { kind: "ward", unitIds: [WARD] } } });
    const { confirm, name } = await openAccept(server);
    // An access admin moves this account to another ward while the dialog is open.
    server.access = { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } };
    const before = worldOf(server);
    await save(confirm);

    await waitFor(() => expect(server.sent).toHaveLength(1));
    await waitFor(() => expect(statusBar()).toMatch(/outside your role's place\. Nothing was changed\./u));
    expect(name).not.toBe("");
    expect(worldOf(server)).toBe(before);
  });

  // SM2-11 (Clinical Safety Case, open): an accept refused at commit is said only in the shared
  // status bar, and the server's words never name the patient (P058). The ward screen says a
  // movement refusal on that person's referral row, which the refreshed board has removed (the
  // request was withdrawn, or the ward is no longer this desk's). Where it should be said instead
  // (a toast, the dialog kept open, or the row kept) is a design choice for Josh.
  it.todo("names the patient when an accept in principle is refused after its referral row has gone (SM2-11)");
});

describe("pulling the bed is checked when it is saved (M2)", () => {
  const WARD = "bty-older-adult";
  const TARGET = "WF-013";

  it("refuses a pull after another desk set the ward's ready beds to none", async () => {
    const server = createDeskServer();
    server.secondDesk({
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: 0,
      movementId: TARGET,
      unitId: WARD,
      actingUnitId: WARD,
    });
    await mount(server, <WardScreen unitId={WARD} />);
    const row = await screen.findByTestId(`ward-accepted-${TARGET}`);
    const pull = within(row).getByTestId(`ward-pull-${TARGET}`);
    const unit = server.world.state.units.find((candidate) => candidate.id === WARD)!;
    server.secondDesk({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: 0,
      unitId: WARD,
      actingUnitId: WARD,
      value: 0,
      expectedRevision: unit.allocatable.revision ?? 0,
    });
    const before = worldOf(server);
    await save(pull);

    await waitFor(() => expect(server.sent).toHaveLength(1));
    const said = await notRecordedSaid();
    expectNoRepeatedNothingChanged(said);
    // The refusal is said on this person's own row, which names them.
    const refusedRow = screen.getByTestId(`ward-accepted-${TARGET}`);
    expect(within(refusedRow).getByRole("alert")).toHaveTextContent(/Pull the bed not recorded: No Ready bed/u);
    expectNamesPatient(refusedRow.textContent ?? "", server, TARGET);
    expect(worldOf(server)).toBe(before);
  });
});

describe("confirming an arrival is checked when it is saved (M2)", () => {
  const WARD = "rph-adult-secure";
  const TARGET = "WF-014";

  it("refuses an arrival another desk already recorded", async () => {
    const server = createDeskServer();
    await mount(server, <WardScreen unitId={WARD} />);
    fireEvent.click(await screen.findByTestId(`ward-confirm-arrival-${TARGET}`));
    const check = screen.getByTestId("ward-arrival-identity");
    server.secondDesk({ type: "PATIENT_ARRIVED", role: "ward", now: 0, movementId: TARGET, actingUnitId: WARD });
    const before = worldOf(server);
    await save(within(check).getByRole("button", { name: "Confirm arrival" }));

    await waitFor(() => expect(server.sent).toHaveLength(1));
    const said = await notRecordedSaid();
    expectNamesPatient(said, server, TARGET);
    expectNoRepeatedNothingChanged(said);
    expect(worldOf(server)).toBe(before);
  });
});
