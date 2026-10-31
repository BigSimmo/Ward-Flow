// The setup file already loads these matchers; importing them here as well lets the commit-time
// per-file type check see them.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

/**
 * Audit F-02 (19 October 2026): in shared mode the server can refuse a change the screen has
 * already announced. The drawer's quick actions now wait for the command's outcome, so a refused
 * change says "Not recorded" and never the success line. The server is stood in for by wrapping
 * the provider's own dispatch; with `server.reply` unset every change is recorded as usual.
 */
const server = vi.hoisted(() => ({ reply: null as WardCommandOutcome | null }));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  const useWardFlowSelect: typeof actual.useWardFlowSelect = (...keys) => {
    const picked = actual.useWardFlowSelect(...keys);
    if (!("dispatch" in picked)) return picked;
    const real = (picked as { dispatch: WardCommandDispatch }).dispatch;
    const dispatch: WardCommandDispatch = (event) => (server.reply ? Promise.resolve(server.reply) : real(event));
    return { ...picked, dispatch };
  };
  return { ...actual, useWardFlowSelect };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { queryBedStep } from "./helpers/ward-bed-steps";

/** A ward with people in it, found from the seed; the bed is found on screen, since seeded stays have no bed number. */
const UNIT_ID = wardAdmissions.find((a) => a.state === "occupied")?.unitId;
if (!UNIT_ID) throw new Error("the seed has no occupied ward");
const PATH = `/ward-flow/ward/${UNIT_ID}`;
let bedNumber = 0;

function openBed(bed: number) {
  act(() => {
    window.history.replaceState(null, "", `${PATH}?bed=${bed}`);
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  });
}

async function openMarkAtEd() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={UNIT_ID!} />
    </WardFlowProvider>,
  );
  openBed(1);
  await screen.findByRole("dialog");
  for (bedNumber = 1; bedNumber <= 40; bedNumber += 1) {
    openBed(bedNumber);
    const button = queryBedStep("Mark at an ED");
    if (button) return button;
  }
  throw new Error("no bed on this ward offers Mark at an ED");
}

beforeEach(() => {
  server.reply = null;
  window.history.replaceState(null, "", PATH);
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

describe("ward drawer quick actions report the saved outcome", () => {
  it("a refused change says Not recorded, with the reason, and not the success line", async () => {
    const button = await openMarkAtEd();
    server.reply = { commandId: "cmd-1", status: "refused", message: "Someone else changed this stay first." };
    await act(async () => {
      fireEvent.click(button);
    });
    // Audit 1 (CS-07): the drawer asks once before it records the ED transfer.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Record ED transfer" }));
    });
    expect(screen.getByText("Not recorded: Someone else changed this stay first. Nothing was changed.")).toBeVisible();
    expect(screen.queryByText(/marked away at ED/u)).toBeNull();
  });

  it("a change the server could not confirm is reported as unconfirmed, never as unchanged", async () => {
    const button = await openMarkAtEd();
    server.reply = { commandId: "cmd-2", status: "failed" };
    await act(async () => {
      fireEvent.click(button);
    });
    // Audit 1 (CS-07): the drawer asks once before it records the ED transfer.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Record ED transfer" }));
    });
    // A failed save may still have reached the server, so it must not say nothing changed.
    expect(
      screen.getByText("Save is not confirmed. Check the board. If your change is not there, make it again."),
    ).toBeVisible();
    expect(screen.queryByText(/Nothing was changed|marked away at ED/u)).toBeNull();
  });

  it("an accepted change still shows the success line", async () => {
    const button = await openMarkAtEd();
    await act(async () => {
      fireEvent.click(button);
    });
    // Audit 1 (CS-07): the drawer asks once before it records the ED transfer.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Record ED transfer" }));
    });
    expect(screen.getByText(`Bed ${bedNumber} patient marked away at ED.`)).toBeVisible();
  });
});
