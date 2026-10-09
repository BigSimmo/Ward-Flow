import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardSharedConnection } from "../src/components/ward-management/ward-shared-access";
import { WardFlowProvider, useWardFlow } from "../src/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { AlertsScreen } from "../src/components/ward-management/alerts/alerts-screen";
import { eventLogEntryFor } from "../src/components/ward-management/ward-event-log";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";

const fake = vi.hoisted(() => ({ connection: null as WardSharedConnection | null }));
vi.mock("../src/components/ward-management/ward-shared-access", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/ward-shared-access")>();
  return { ...actual, useWardShared: (enabled: boolean) => ({ ...fake.connection!, enabled }) };
});
function Probe() {
  const { configuration, now, dispatch } = useWardFlow();
  return (
    <>
      <output>{configuration.pullHoldMinutes}</output>
      <input aria-label="Local draft" defaultValue="draft" />
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 15 })}>
        Advance
      </button>
    </>
  );
}
function connection(): WardSharedConnection {
  const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0)));
  state.configuration.pullHoldMinutes = 45;
  return {
    enabled: true,
    signedIn: true,
    status: "ready",
    error: null,
    eventLog: [],
    receivedAt: Date.now(),
    snapshot: {
      dataMode: "prototype",
      revision: 1,
      now: 642,
      payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
    },
    dispatch: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    retry: vi.fn(),
  };
}
beforeEach(() => {
  fake.connection = connection();
  vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("shared provider boundary", () => {
  it.each([true, false])("shows the confirmed shared broadcast outcome (accepted: %s)", (accepted) => {
    const tree = () => (
      <WardFlowProvider>
        <AlertsScreen />
      </WardFlowProvider>
    );
    const { rerender } = render(tree());
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
    fireEvent.change(screen.getByLabelText(/^Target scope$/i), { target: { value: "forensic" } });
    const title = screen.getByLabelText(/^Title$/i) as HTMLInputElement;
    const message = screen.getByLabelText(/^Directive$/i) as HTMLTextAreaElement;
    const draft = { title: title.value, message: message.value };
    fireEvent.click(screen.getByLabelText(/I confirm this directive is clinically authorised/i));
    fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
    expect(fake.connection!.dispatch).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("ward-alerts-broadcast-confirm")).toBeDisabled();
    expect(screen.queryByRole("status", { name: "Broadcast feedback" })).toBeNull();
    expect(screen.queryByRole("alert", { name: "Broadcast feedback" })).toBeNull();
    const dispatched = vi.mocked(fake.connection!.dispatch).mock.calls[0][0] as WardFlowEvent;
    expect(dispatched.type).toBe("DISPATCH_BROADCAST_ALERT");
    const revision = fake.connection!.snapshot!.revision;
    fake.connection = { ...fake.connection!, eventLog: [eventLogEntryFor(dispatched, accepted)] };
    rerender(tree());
    expect(fake.connection.snapshot!.revision).toBe(revision);
    if (accepted) {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("status", { name: "Broadcast feedback" })).toHaveTextContent(
        "dispatched to Frankland Centre Forensic Mental Health.",
      );
    } else {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("alert", { name: "Broadcast feedback" })).toHaveTextContent(
        "Broadcast was not accepted. Your draft has been kept.",
      );
      expect(title.value).toBe(draft.title);
      expect(message.value).toBe(draft.message);
      expect(screen.getByLabelText(/^Target scope$/i)).toHaveValue("forensic");
      expect(screen.getByTestId("ward-alerts-broadcast-confirm")).toBeEnabled();
    }
  });
  it("keeps the demonstration local when shared mode is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByText(/Local demonstration/)).toBeInTheDocument();
    expect(screen.queryByText("45")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(String(seedWardFlowStateAt(0).configuration.pullHoldMinutes));
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));
    expect(fake.connection!.dispatch).not.toHaveBeenCalled();
  });
  it("keeps a pinned demonstration local even when shared mode is enabled", () => {
    render(
      <WardFlowProvider initialNow={642}>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByText(/Local demonstration/)).toBeInTheDocument();
    expect(screen.queryByText("45")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(String(seedWardFlowStateAt(0).configuration.pullHoldMinutes));
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));
    expect(fake.connection!.dispatch).not.toHaveBeenCalled();
  });
  it("explains live data without switching databases or losing a prototype draft", () => {
    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    const draft = screen.getByRole("textbox");
    fireEvent.change(draft, { target: { value: "keep prototype draft" } });
    expect(screen.getByText("Data mode: Prototype")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hospital records (unavailable)" }));
    expect(screen.getByRole("heading", { name: "Hospital records are not connected" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(fake.connection!.dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Return to prototype" }));
    expect(screen.getByRole("textbox")).toBe(draft);
    expect(draft).toHaveValue("keep prototype draft");
  });
  it("adopts server state without reading or writing browser demo storage", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByText("Coordinator · shared synthetic workspace")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));
    expect(fake.connection!.dispatch).toHaveBeenCalledOnce();
    expect(screen.getByText("45")).toBeInTheDocument();
  });
  it("keeps drafts mounted while a newly committed server revision is adopted", () => {
    const tree = (
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>
    );
    const { rerender } = render(tree);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "keep this draft" } });
    fake.connection = {
      ...fake.connection!,
      snapshot: {
        ...fake.connection!.snapshot!,
        revision: 2,
        payload: {
          ...fake.connection!.snapshot!.payload,
          state: {
            ...fake.connection!.snapshot!.payload.state,
            configuration: { ...fake.connection!.snapshot!.payload.state.configuration, pullHoldMinutes: 60 },
          },
        },
      },
    };
    rerender(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveValue("keep this draft");
    expect(screen.getByText("60")).toBeInTheDocument();
  });
  it("removes the board when coordinator access is revoked", () => {
    const { rerender } = render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    fake.connection = { ...fake.connection!, snapshot: null, status: "not-authorised" };
    rerender(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in with Microsoft" })).toBeInTheDocument();
  });
});
