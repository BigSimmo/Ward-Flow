import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fault injection is limited to the record-access boundary. The list, audit receipts,
// scenario reset and all display data still come from the real provider and reducer.
const access = vi.hoisted(() => ({ mode: "normal" as "normal" | "denied" | "allocation-failed" }));
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  // The board reads named fields through `useWardFlowSelect`; both hooks get the same stand-ins.
  function withAccess<T extends Partial<ReturnType<typeof actual.useWardFlow>>>(context: T): T {
    const { openDischargeRecord, readDischargeRecord } = context;
    return {
      ...context,
      ...(openDischargeRecord && {
        openDischargeRecord: (...args: Parameters<typeof openDischargeRecord>) => {
          if (access.mode === "allocation-failed") throw new Error("Record request allocation unavailable");
          return openDischargeRecord(...args);
        },
      }),
      ...(readDischargeRecord && {
        readDischargeRecord: (...args: Parameters<typeof readDischargeRecord>) =>
          access.mode === "denied" ? { status: "denied" as const } : readDischargeRecord(...args),
      }),
    };
  }
  return {
    ...actual,
    useWardFlow: () => withAccess(actual.useWardFlow()),
    useWardFlowSelect: (...keys: (keyof ReturnType<typeof actual.useWardFlow>)[]) =>
      withAccess(actual.useWardFlowSelect(...keys)),
  };
});
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function ResetScenario() {
  const { dispatch, now } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "RESET_SCENARIO", role: "demo", now })}>
      Reset scenario
    </button>
  );
}
// Recorded (DC4, 3 Nov 2026) lists only discharges of the last 7 days, so these open a recent
// departed record. A departed stay offers no date update, so its UMRN line is the opened-record evidence.
function openFirstRecord(worklist?: HTMLElement) {
  fireEvent.click(screen.getByRole("button", { name: /^Recorded/ }));
  const rows = within(worklist ?? screen.getByRole("region", { name: "Discharge worklist" })).getAllByRole("row");
  // Only the first record is exercised; later row buttons add no assertion.
  let openers: HTMLElement[] = [];
  for (const row of rows) {
    openers = within(row).queryAllByRole("button");
    if (openers.length > 0) break;
  }
  const opener = openers[0];
  expect(opener).toBeDefined();
  const name = opener.textContent ?? "";
  expect(name.length).toBeGreaterThan(0);
  fireEvent.click(opener);
  return name;
}
function renderBoard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DischargeBoard />
      <ResetScenario />
    </WardFlowProvider>,
  );
}
// Drawer review (6 Nov 2026): the detail opens in the kit drawer, so it exists only while a row is open.
function expectDeniedDetail(name: string, detail = screen.getByTestId("ward-discharge-detail")) {
  expect(detail).toHaveTextContent("This record could not be opened. Select it again to retry.");
  expect(within(detail).queryByRole("heading", { name })).not.toBeInTheDocument();
  expect(within(detail).queryByTestId("ward-discharge-update-date-btn")).not.toBeInTheDocument();
  expect(within(detail).queryByText(/UMRN/)).not.toBeInTheDocument();
}

beforeEach(() => {
  access.mode = "normal";
});
describe("DischargeBoard guarded detail access", () => {
  it("does not substitute the list record when the detail read is denied", () => {
    access.mode = "denied";
    renderBoard();
    expectDeniedDetail(openFirstRecord());
  });

  it("shows a retryable failure when allocating an open receipt throws", () => {
    access.mode = "allocation-failed";
    renderBoard();
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    const name = openFirstRecord(worklist);
    const detail = screen.getByTestId("ward-discharge-detail");
    expectDeniedDetail(name, detail);
    // Closing removes the drawer; the worklist region stays.
    fireEvent.click(within(detail).getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("ward-discharge-detail")).toBeNull();
    access.mode = "normal";
    expect(worklist).toBeInTheDocument();
    fireEvent.click(within(worklist).getByRole("button", { name }));
    expect(within(screen.getByTestId("ward-discharge-detail")).getByRole("heading", { name })).toBeInTheDocument();
  });

  it("removes opened details when a scenario reset invalidates the receipt", () => {
    renderBoard();
    const name = openFirstRecord();
    const detail = screen.getByTestId("ward-discharge-detail");
    expect(within(detail).getByRole("heading", { name })).toBeInTheDocument();
    expect(within(detail).getByText(/UMRN/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset scenario" }));
    // World-generation changes remount the workspace and clear selection, so the drawer closes.
    expect(screen.queryByTestId("ward-discharge-detail")).toBeNull();
    expect(screen.queryByTestId("ward-discharge-update-date-btn")).not.toBeInTheDocument();
  });
});
