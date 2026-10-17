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
function openFirstRecord(worklist?: HTMLElement) {
  fireEvent.click(screen.getByRole("button", { name: /^History/ }));
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
function expectDeniedDetail(name: string, detail = screen.getByRole("region", { name: "Selected discharge details" })) {
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
    // Selection and closing replace contents, not these named regions or the detail shell.
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    const detail = screen.getByRole("region", { name: "Selected discharge details" });
    const detailShell = detail.parentElement!;
    const name = openFirstRecord(worklist);
    expect(detail).toBeInTheDocument();
    expectDeniedDetail(name, detail);
    expect(within(detailShell).getByRole("button", { name: "Close" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(within(detailShell).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(detail).toBeInTheDocument();
    expect(detail).toHaveTextContent("Select a record to view dates, blockers and ward follow-up.");
    access.mode = "normal";
    expect(worklist).toBeInTheDocument();
    fireEvent.click(within(worklist).getByRole("button", { name }));
    expect(detail).toBeInTheDocument();
    expect(within(detail).getByRole("heading", { name })).toBeInTheDocument();
  });

  it("removes opened details when a scenario reset invalidates the receipt", () => {
    renderBoard();
    const name = openFirstRecord();
    const detail = screen.getByRole("region", { name: "Selected discharge details" });
    expect(within(detail).getByRole("heading", { name })).toBeInTheDocument();
    expect(within(detail).getByTestId("ward-discharge-update-date-btn")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset scenario" }));
    // World-generation changes remount the workspace and clear selection altogether.
    const cleared = screen.getByRole("region", { name: "Selected discharge details" });
    expect(cleared).toHaveTextContent("Select a record to view dates, blockers and ward follow-up.");
    expect(within(cleared).queryByRole("heading", { name })).not.toBeInTheDocument();
    expect(within(cleared).queryByTestId("ward-discharge-update-date-btn")).not.toBeInTheDocument();
  });
});
