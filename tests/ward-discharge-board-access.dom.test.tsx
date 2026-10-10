import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fault injection is limited to the record-access boundary. The list, audit receipts,
// scenario reset and all display data still come from the real provider and reducer.
const access = vi.hoisted(() => ({ mode: "normal" as "normal" | "denied" | "allocation-failed" }));
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlow: () => {
      const context = actual.useWardFlow();
      return {
        ...context,
        openDischargeRecord: (...args: Parameters<typeof context.openDischargeRecord>) => {
          if (access.mode === "allocation-failed") throw new Error("Record request allocation unavailable");
          return context.openDischargeRecord(...args);
        },
        readDischargeRecord: (...args: Parameters<typeof context.readDischargeRecord>) =>
          access.mode === "denied" ? { status: "denied" as const } : context.readDischargeRecord(...args),
      };
    },
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
function openFirstRecord() {
  fireEvent.click(screen.getByRole("button", { name: /^History/ }));
  const rows = within(screen.getByRole("region", { name: "Discharge worklist" })).getAllByRole("row");
  const opener = rows.flatMap((row) => within(row).queryAllByRole("button"))[0];
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
function expectDeniedDetail(name: string) {
  const detail = screen.getByRole("region", { name: "Selected discharge details" });
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
    const name = openFirstRecord();
    expectDeniedDetail(name);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Selected discharge details" })).toHaveTextContent(
      "Select a record to view dates, blockers and ward follow-up.",
    );
    access.mode = "normal";
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    fireEvent.click(within(worklist).getByRole("button", { name }));
    expect(
      within(screen.getByRole("region", { name: "Selected discharge details" })).getByRole("heading", { name }),
    ).toBeInTheDocument();
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
