import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ refuse: false }));
vi.mock("@/components/ward-management/ward-flow-reducer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-reducer")>();
  return {
    ...actual,
    wardFlowReducer: (
      state: Parameters<typeof actual.wardFlowReducer>[0],
      event: Parameters<typeof actual.wardFlowReducer>[1],
    ) =>
      actual.wardFlowReducer(
        state,
        harness.refuse && event.type === "DISPATCH_BROADCAST_ALERT" ? { ...event, durationMinutes: 0 } : event,
      ),
  };
});

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  harness.refuse = false;
});

function prepareBroadcast() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByText("+ Broadcast Network Alert"));
  fireEvent.change(screen.getByLabelText(/Broadcast Target Scope/i), { target: { value: "forensic" } });
  fireEvent.click(screen.getByLabelText(/I confirm this directive is clinically authorised/i));
}

it("announces accepted dispatch for the selected scope and restores keyboard focus", () => {
  prepareBroadcast();
  fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Broadcast feedback" })).toHaveTextContent(
    "dispatched to Frankland Centre Forensic Mental Health.",
  );
  expect(screen.getByRole("status", { name: "Broadcast feedback" })).not.toHaveTextContent("dispatched statewide");
  expect(screen.getByText("+ Broadcast Network Alert").closest("button")).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notice" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("+ Broadcast Network Alert"));
  expect(screen.getByTestId("ward-alerts-broadcast-confirm")).toBeDisabled();
});

it("keeps the draft and modal open after the engine refuses a dispatch, then allows retry", () => {
  prepareBroadcast();
  const title = screen.getByLabelText(/Directive Headline \/ Title/i) as HTMLInputElement;
  const message = screen.getByLabelText(/Message Body & Clinical Instructions/i) as HTMLTextAreaElement;
  const before = { title: title.value, message: message.value };
  harness.refuse = true;
  fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("alert", { name: "Broadcast feedback" })).toHaveTextContent(
    "Broadcast was not accepted. Your draft has been kept.",
  );
  expect(title.value).toBe(before.title);
  expect(message.value).toBe(before.message);
  expect((screen.getByLabelText(/Broadcast Target Scope/i) as HTMLSelectElement).value).toBe("forensic");
  expect(screen.queryByText(/dispatched to/i)).not.toBeInTheDocument();
  harness.refuse = false;
  fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Broadcast feedback" })).toHaveTextContent(
    "dispatched to Frankland Centre Forensic Mental Health.",
  );
});
