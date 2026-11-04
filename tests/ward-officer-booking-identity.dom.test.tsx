import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const commands = vi.hoisted(() => ({ raise: vi.fn() }));
vi.mock("@/components/ward-management/ward-flow-raise", () => ({ useWardRaise: () => commands.raise }));

import { OfficerScreen, isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { TransportCadToFollow } from "@/components/ward-management/transport/transport-cad-to-follow";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardShellPublicProvider } from "@/components/ward-management/shell/ward-shell-public-context";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { useModalFocus } from "@/components/wf/use-modal-focus";

const job = seedWardFlowState().movements.find(isOfficerJob)!;
const publicView = (children: ReactNode, accessLifetime: string) => (
  <WardShellPublicProvider
    value={{
      accessLifetime,
      places: wardPlaceLookup(seedWardFlowState().units),
      placeLabel: "Synthetic workspace",
      now: NOW_ANCHOR,
    }}
  >
    {children}
  </WardShellPublicProvider>
);
function SyntheticGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLElement>(null);
  useModalFocus({ open, onClose, panelRef, keyPhase: "bubble" });
  return open ? (
    <aside ref={panelRef} role="dialog" aria-modal={false} aria-label="Synthetic guide">
      <button onClick={onClose}>Close guide</button>
    </aside>
  ) : null;
}
function RebookingDesk({ collected = false }: { collected?: boolean }) {
  const world = useWardFlow();
  const [transportId, setTransportId] = useState("synthetic-original-booking");
  const [lifetime, setLifetime] = useState("synthetic-world-a");
  const [guide, setGuide] = useState(false);
  const movement = {
    ...job,
    transport: {
      ...job.transport!,
      id: transportId,
      acceptedAt: NOW_ANCHOR - 10,
      enRouteAt: NOW_ANCHOR - 5,
      collectedAt: collected ? NOW_ANCHOR - 2 : undefined,
      arrivedAt: undefined,
      cancelledAt: undefined,
    },
    closure: undefined,
  };
  return publicView(
    <WardFlowOverride value={{ ...world, movements: [movement] }}>
      <button onClick={() => setTransportId("synthetic-replacement-booking")}>Replace synthetic booking</button>
      <button onClick={() => setLifetime("synthetic-world-b")}>Replace synthetic world</button>
      <button onClick={() => setGuide(true)}>Open synthetic guide</button>
      <OfficerScreen />
      <SyntheticGuide open={guide} onClose={() => setGuide(false)} />
    </WardFlowOverride>,
    lifetime,
  );
}
beforeEach(() => {
  commands.raise.mockReset();
  commands.raise.mockReturnValue({ commandId: "synthetic-cad", status: "accepted" });
});
afterEach(cleanup);

describe("transport confirmations belong to a booking, not only a journey", () => {
  it("requires a fresh identity tick after the same journey receives a replacement booking", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RebookingDesk />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-officer-select-${job.id}`));
    fireEvent.click(screen.getByTestId(`ward-officer-identity-check-${job.id}`));
    expect(screen.getByTestId(`ward-officer-identity-check-${job.id}`)).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Replace synthetic booking" }));
    expect(screen.getByTestId(`ward-officer-identity-check-${job.id}`)).toHaveAttribute("aria-pressed", "false");
  });

  it("leaves the selected job open when Escape closes a shared non-modal guide", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RebookingDesk />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-officer-select-${job.id}`));
    fireEvent.click(screen.getByRole("button", { name: "Open synthetic guide" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Synthetic guide" })).toBeNull();
    expect(screen.getByTestId("ward-officer-detail")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("ward-officer-detail")).toBeNull();
  });

  it("keeps diversion answers visible after a refused command", () => {
    commands.raise.mockReturnValue({
      status: "refused",
      commandId: "synthetic-diversion",
      message: "Synthetic diversion refused.",
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RebookingDesk collected />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-officer-select-${job.id}`));
    fireEvent.click(screen.getByTestId(`ward-officer-divert-${job.id}`));
    for (const field of ["reason", "place"]) {
      const input = screen.getByTestId(`ward-officer-diversion-${field}-${job.id}`) as HTMLSelectElement;
      fireEvent.change(input, { target: { value: input.options[1]!.value } });
    }
    fireEvent.click(screen.getByTestId(`ward-officer-record-diversion-${job.id}`));
    expect(screen.getByTestId(`ward-officer-diversion-${job.id}`)).toBeInTheDocument();
    expect((screen.getByTestId(`ward-officer-diversion-reason-${job.id}`) as HTMLSelectElement).value !== "").toBe(
      true,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/refused/i);
  });

  it("keeps an unfinished CAD number out of a replacement booking on the same journey", () => {
    const form = (transportId: string) => (
      <TransportCadToFollow
        movementId="synthetic-journey"
        transportId={transportId}
        role="officer"
        testId="booking-cad"
      />
    );
    const rendered = render(form("synthetic-booking-a"));
    fireEvent.change(screen.getByTestId("booking-cad-input"), { target: { value: "CAD-SYN-4410" } });
    rendered.rerender(form("synthetic-booking-b"));
    expect(screen.getByTestId("booking-cad-input")).toHaveValue("");
    fireEvent.click(screen.getByTestId("booking-cad-save"));
    expect(commands.raise).not.toHaveBeenCalled();
  });

  it("requires a fresh identity tick after the world changes with the same journey and booking IDs", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RebookingDesk />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-officer-select-${job.id}`));
    fireEvent.click(screen.getByTestId(`ward-officer-identity-check-${job.id}`));
    expect(screen.getByTestId(`ward-officer-identity-check-${job.id}`)).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Replace synthetic world" }));
    expect(screen.getByTestId(`ward-officer-identity-check-${job.id}`)).toHaveAttribute("aria-pressed", "false");
  });

  it("does not expose or clear the new world's draft when an old-world command confirms", async () => {
    let confirm!: (outcome: WardCommandOutcome) => void;
    commands.raise.mockReturnValue({
      commandId: "synthetic-world-cad",
      status: "failed",
      confirmation: new Promise<WardCommandOutcome>((done) => {
        confirm = done;
      }),
    });
    const form = (lifetime: string) =>
      publicView(
        <TransportCadToFollow
          movementId="synthetic-journey"
          transportId="synthetic-booking"
          role="officer"
          testId="booking-cad"
        />,
        lifetime,
      );
    const rendered = render(form("synthetic-world-a"));
    fireEvent.change(screen.getByTestId("booking-cad-input"), { target: { value: "CAD-SYN-4410" } });
    fireEvent.click(screen.getByTestId("booking-cad-save"));
    rendered.rerender(form("synthetic-world-b"));
    expect(screen.getByTestId("booking-cad-input")).toHaveValue("");
    fireEvent.change(screen.getByTestId("booking-cad-input"), { target: { value: "CAD-SYN-5520" } });
    await act(async () => confirm({ commandId: "synthetic-world-cad", status: "accepted" }));
    expect(screen.getByTestId("booking-cad-input")).toHaveValue("CAD-SYN-5520");
  });

  it("does not clear the replacement booking's CAD draft when the earlier booking is confirmed", async () => {
    let confirm!: (outcome: WardCommandOutcome) => void;
    commands.raise.mockReturnValue({
      commandId: "synthetic-uncertain-cad",
      status: "failed",
      confirmation: new Promise<WardCommandOutcome>((done) => {
        confirm = done;
      }),
    });
    const form = (transportId: string) => (
      <TransportCadToFollow
        movementId="synthetic-journey"
        transportId={transportId}
        role="officer"
        testId="booking-cad"
      />
    );
    const rendered = render(form("synthetic-booking-a"));
    fireEvent.change(screen.getByTestId("booking-cad-input"), { target: { value: "CAD-SYN-4410" } });
    fireEvent.click(screen.getByTestId("booking-cad-save"));
    rendered.rerender(form("synthetic-booking-b"));
    fireEvent.change(screen.getByTestId("booking-cad-input"), { target: { value: "CAD-SYN-5520" } });
    await act(async () => confirm({ commandId: "synthetic-uncertain-cad", status: "accepted" }));
    expect(screen.getByTestId("booking-cad-input")).toHaveValue("CAD-SYN-5520");
  });
});
