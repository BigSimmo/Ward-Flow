// Audit M9 (GitHub issue #1576): one intent, one change. The backend half (one command ID applies
// once, a lost reply answered from the receipt) is proven against PostgreSQL in
// backend/ward-flow/postgres.test.mjs. This is the screen half: for each family of save button, a
// double tap or a double Enter sends exactly one command, and Retry after a send whose reply was
// lost sends that same command ID again, which the server applies once. The real shared client
// talks to the engine-backed stand-in server in tests/helpers/ward-desk-server.tsx. Synthetic only.
//
// The families, by how a screen sends its save:
//   1. a form held by `useWardFormSave` (48 forms): the ward drawer's discharge date;
//   2. a step through `useUndoableStep` (23 screens): the ward board's departure confirm;
//   3. a command through `useWardCommandCompletion` (the ward screen's lists): Pull the bed;
//   4. a plain `raise` with only the provider's repeat-tap guard (`dispatchAndReport`): the ward
//      board's Gone to an ED.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
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
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { createDeskServer, openDesk, type DeskServer } from "./helpers/ward-desk-server";

const clients: { dispose: () => void }[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.dispose();
  setDeskRole("coordinator");
});

async function mount(server: DeskServer, node: ReactNode) {
  const desk = await openDesk(server);
  clients.push(desk.client);
  render(
    <desk.Desk>
      <ToastProvider>{node}</ToastProvider>
    </desk.Desk>,
  );
  return desk;
}

/** Two presses before the screen can re-render between them: a double tap. */
async function doubleTap(button: HTMLElement) {
  await act(async () => {
    button.click();
    button.click();
  });
}

/** Two submits before the screen can re-render between them: a double Enter in a form field. */
async function doubleEnter(form: HTMLElement) {
  await act(async () => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
}

/**
 * The first send's reply is lost, a double press sends one command, and Retry in the status bar
 * sends the same command ID once more, which the server answers without applying it again.
 */
async function expectOneCommandThroughRetry(server: DeskServer, press: () => Promise<void>) {
  server.loseReplies = 1;
  await press();
  await waitFor(() => expect(server.sent).toHaveLength(1));
  expect(server.applied.size).toBe(1);
  const retry = await screen.findByRole("button", { name: "Retry" });
  // A press after the failed send, before Retry, joins the waiting save rather than adding one.
  await press();
  expect(server.sent).toHaveLength(1);
  await act(async () => {
    fireEvent.click(retry);
  });
  await waitFor(() => expect(server.sent).toHaveLength(2));
  expect(server.sent[1]!.commandId).toBe(server.sent[0]!.commandId);
  expect(server.sent[1]!.event).toEqual(server.sent[0]!.event);
  expect(server.applied.size).toBe(1);
  expect(server.invalid).toEqual([]);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Retry" })).toBeNull());
}

describe("one intent sends one command (M9, #1576)", () => {
  it("family 1, a form save: a double Enter on the discharge date sends one command, and Retry reuses its ID", async () => {
    setDeskRole("ward");
    const state = seedWardFlowState();
    const admission = state.admissions.find((row) => row.state === "occupied" && row.patientId)!;
    const unit = state.units.find((row) => row.id === admission.unitId)!;
    const server = createDeskServer({ state });
    await mount(
      server,
      <WardBedDossierDrawer
        selectedBed={3}
        bedItem={{
          bedNumber: 3,
          bedLabel: "Bed 03",
          status: "occupied",
          statusText: "Inpatient",
          admissionId: admission.id,
          patientAlias: "Synthetic person",
        }}
        unit={unit}
        onClose={() => {}}
        drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
        setDrawerLeavingDestination={() => {}}
        onRecordLeft={() => {}}
        bedDrawerRef={createRef<HTMLElement>()}
        onKeyDown={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Leaving" }));
    fireEvent.click(screen.getAllByTestId("ward-drawer-discharge-date-open")[0]!);
    const form = screen.getByTestId("ward-drawer-discharge-date");
    fireEvent.click(within(form).getByRole("button", { name: "Increase discharge day" }));
    fireEvent.change(within(form).getByLabelText("Expected discharge time"), { target: { value: "10:00" } });

    await expectOneCommandThroughRetry(server, () => doubleEnter(form));
    expect(server.sent[0]!.event.type).toBe("UPDATE_EXPECTED_DISCHARGE");
  });

  it("family 2, an undoable step: a double tap on the departure confirm sends one command, and Retry reuses its ID", async () => {
    const seed = seedWardFlowState();
    const unitId = seed.admissions.find((admission) => admission.state === "occupied")!.unitId;
    const server = createDeskServer({ state: seed });
    await mount(server, <WardBoard unitId={unitId} />);
    const tile = within(screen.getByTestId("ward-board-beds"))
      .getAllByRole("listitem")
      .find((item) => item.getAttribute("data-bed-kind") === "occupied")!;
    fireEvent.click(within(tile).getByRole("button"));
    fireEvent.click(screen.getByTestId("ward-board-record-leaving-submit"));
    const confirm = document.getElementById("ward-board-confirm-dialog")!;
    fireEvent.change(within(confirm).getByTestId("ward-board-confirm-destination"), {
      target: { value: LEAVING_DESTINATIONS[0]!.id },
    });
    const proceed = within(confirm).getByTestId("ward-board-confirm-proceed");

    await expectOneCommandThroughRetry(server, () => doubleTap(proceed));
    expect(server.sent[0]!.event.type).toBe("RECORD_PATIENT_DISCHARGE");
  });

  it("family 3, a ward list command: a double tap on Pull the bed sends one command, and Retry reuses its ID", async () => {
    const WARD = "bty-older-adult";
    const TARGET = "WF-013";
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
    const pull = within(await screen.findByTestId(`ward-accepted-${TARGET}`)).getByTestId(`ward-pull-${TARGET}`);

    await expectOneCommandThroughRetry(server, () => doubleTap(pull));
    expect(server.sent[0]!.event.type).toBe("PULL_PATIENT");
  });

  it("family 4, a plain raise: a double tap on Gone to an ED sends one command, and Retry reuses its ID", async () => {
    const seed = seedWardFlowState();
    const unitId = seed.admissions.find((admission) => admission.state === "occupied")!.unitId;
    const server = createDeskServer({ state: seed });
    await mount(server, <WardBoard unitId={unitId} />);
    const tile = within(screen.getByTestId("ward-board-beds"))
      .getAllByRole("listitem")
      .find((item) => item.getAttribute("data-bed-kind") === "occupied")!;
    fireEvent.click(within(tile).getByRole("button"));
    // The tile's own button records it at once, with no confirm.
    const gone = screen.getByRole("button", { name: "Gone to an ED" });

    await expectOneCommandThroughRetry(server, () => doubleTap(gone));
    expect(server.sent[0]!.event.type).toBe("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT");
  });
});
